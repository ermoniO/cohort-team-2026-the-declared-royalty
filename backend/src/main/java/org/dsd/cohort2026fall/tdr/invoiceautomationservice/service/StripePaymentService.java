package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.terminal.Configuration;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.StripeProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PaymentAttemptEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.StripeWebhookEventEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceConflictException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentSource;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PaymentAttemptRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.StripeWebhookEventRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.List;

@Slf4j
@Service
public class StripePaymentService {

    private final InvoiceRepository invoiceRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final StripeProperties stripeProperties;
    private final ObjectProvider<StripeClient> stripeClientProvider;
    private final StripeWebhookEventRepository webhookEventRepository;
    private final AuditLogService auditLogService;

    public StripePaymentService(
            InvoiceRepository invoiceRepository,
            PaymentAttemptRepository paymentAttemptRepository,
            StripeProperties stripeProperties,
            ObjectProvider<StripeClient> stripeClientProvider,
            StripeWebhookEventRepository webhookEventRepository,
            AuditLogService auditLogService) {
        this.invoiceRepository = invoiceRepository;
        this.paymentAttemptRepository = paymentAttemptRepository;
        this.stripeProperties = stripeProperties;
        this.stripeClientProvider = stripeClientProvider;
        this.webhookEventRepository = webhookEventRepository;
        this.auditLogService = auditLogService;
    }

    // Attempt statuses meaning Stripe turned the payment down. A FAILED bill can be paid again only
    // when its latest attempt is one of these, not when someone set FAILED by hand.
    public static final List<String> FAILED_ATTEMPT_STATUSES = List.of("FAILED", "REQUIRES_PAYMENT_METHOD");

    // The /stripe-payment endpoint: a person asked for this payment
    @Transactional(noRollbackFor = BadRequestException.class)
    public StripePaymentResponse createPayment(UUID invoiceId, StripePaymentRequest request) {
        return createPayment(invoiceId, request, PaymentSource.MANUAL);
    }

    // noRollbackFor: when Stripe rejects a payment, the FAILED attempt and FAILED invoice are still saved
    // (before this, the BadRequestException rolled it back)
    @Transactional(noRollbackFor = BadRequestException.class)
    public StripePaymentResponse createPayment(UUID invoiceId, StripePaymentRequest request, PaymentSource source) {
        if (!stripeProperties.enabled()) {
            throw new BadRequestException("Stripe integration is disabled");
        }
        ActionTypeEnum actionType = source == PaymentSource.AUTO_PAY
                ? ActionTypeEnum.SYSTEM_PAID : ActionTypeEnum.USER_PAID;

        var existing = paymentAttemptRepository
                .findFirstByInvoice_InvoiceIdAndStatusInOrderByCreatedAtDesc(
                        invoiceId, List.of("CREATED", "PROCESSING", "REQUIRES_ACTION"));
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        InvoiceEntity invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
        if (!canStartPayment(invoice, source)) {
            throw rejected(invoice, actionType, source == PaymentSource.AUTO_PAY
                    ? "Invoice must be APPROVED before auto-pay requests a payment"
                    : "Invoice must be APPROVED, or have a failed payment, before a payment is requested", null);
        }
        if (!Boolean.TRUE.equals(request.getHumanApprovalConfirmed())) {
            throw rejected(invoice, actionType, "Human approval is required before finalizing a Stripe payment request", null);
        }
        if (invoice.getAmount() == null || request.getApprovedAmount().compareTo(invoice.getAmount()) != 0) {
            throw rejected(invoice, actionType, "approvedAmount must exactly match the persisted invoice amount",
                    "Requested " + plain(request.getApprovedAmount()) + ", invoice amount is " + plain(invoice.getAmount()));
        }
        String currency = request.getCurrency().trim().toLowerCase();
        if (!stripeProperties.currency().equalsIgnoreCase(currency)) {
            throw rejected(invoice, actionType, "Unsupported Stripe currency: " + currency, null);
        }
        String fromStatus = invoice.getInvoiceStatus();

        // Claim the bill before calling Stripe. If Pay now and auto-pay race, only one of them
        // moves it out of fromStatus; the other gets 0 rows and stops here without charging.
        if (invoiceRepository.claimForPayment(invoiceId, fromStatus, OffsetDateTime.now()) == 0) {
            auditLogService.recordFailure(invoiceId, InvoiceUploadService.SYSTEM_USER_ID, actionType,
                    "Payment request skipped", fromStatus,
                    "Another payment for this invoice started first (" + source.getValue() + " request skipped)");
            throw new InvoiceConflictException("A payment for this invoice is already in progress");
        }
        // The claim cleared the persistence context; load the claimed copy (now PROCESSING_PAYMENT)
        invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));

        UUID attemptId = UUID.randomUUID();
        String idempotencyKey = "invoice-payment-" + invoiceId + "-" + attemptId;
        PaymentAttemptEntity attempt = PaymentAttemptEntity.builder()
                .paymentAttemptId(attemptId)
                .invoice(invoice)
                .idempotencyKey(idempotencyKey)
                .amount(invoice.getAmount())
                .currency(currency)
                .status("CREATED")
                .humanApproved(true)
                .paymentSource(source.getValue())
                .build();
        paymentAttemptRepository.save(attempt);

        long amountInMinorUnits = invoice.getAmount()
                .movePointRight(2)
                .setScale(0, RoundingMode.UNNECESSARY)
                .longValueExact();
        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(amountInMinorUnits)
                .setCurrency(currency)
                .setPaymentMethod(request.getPaymentMethodId().trim())
                .setConfirm(true)
                // Server-side charge with no page to return to: only allow methods that don't redirect
                .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true)
                        .setAllowRedirects(PaymentIntentCreateParams.AutomaticPaymentMethods.AllowRedirects.NEVER)
                        .build())
                .putMetadata("invoice_id", invoiceId.toString())
                .putMetadata("payment_attempt_id", attemptId.toString())
                .build();

        PaymentIntent intent;
        try {
            RequestOptions options = RequestOptions.builder()
                    .setIdempotencyKey(idempotencyKey)
                    .build();
            intent = stripeClientProvider.getObject().v1().paymentIntents().create(params, options);
        } catch (StripeException ex) {
            markFailed(invoice, attempt, safeMessage(ex));
            recordPaymentFailure(invoice, actionType, "Stripe rejected payment request", attemptId, safeMessage(ex));
            throw new BadRequestException("Stripe rejected the payment request");
        } catch (RuntimeException ex) {
            // Outcome unknown: park the bill as FAILED so a person checks it before retrying,
            // instead of rolling back to APPROVED where auto-pay would pick it up again
            log.error("Payment request failed for invoice {}", invoiceId, ex);
            markFailed(invoice, attempt, safeMessage(ex));
            recordPaymentFailure(invoice, actionType, "Payment request failed", attemptId, safeMessage(ex));
            throw new BadRequestException("Payment request failed. Review the invoice before trying again");
        }

        // Outside the try on purpose: Stripe has accepted the request by now,
        // so a failure below must not mark the attempt FAILED
        applyIntent(attempt, intent);
        paymentAttemptRepository.save(attempt);
        // TODO(auth): record the person who confirmed the payment instead of the system user
        auditLogService.record(invoiceId, InvoiceUploadService.SYSTEM_USER_ID, actionType,
                "Payment requested via Stripe", fromStatus, invoice.getInvoiceStatus(),
                "Amount: " + plain(attempt.getAmount()) + " " + currency.toUpperCase()
                        + " | Stripe status: " + attempt.getStatus()
                        + " | source: " + source.getValue()
                        + " | payment intent: " + attempt.getStripePaymentIntentId()
                        + " | payment attempt: " + attemptId);
        return toResponse(attempt);
    }

    // APPROVED can always be paid. FAILED only by a person, and only after a real payment failure;
    // auto-pay never retries.
    private boolean canStartPayment(InvoiceEntity invoice, PaymentSource source) {
        String status = invoice.getInvoiceStatus();
        if (InvoiceStatus.APPROVED.getValue().equals(status)) {
            return true;
        }
        return source == PaymentSource.MANUAL
                && InvoiceStatus.FAILED.getValue().equals(status)
                && paymentAttemptRepository.findFirstByInvoice_InvoiceIdOrderByCreatedAtDesc(invoice.getInvoiceId())
                .map(latest -> FAILED_ATTEMPT_STATUSES.contains(latest.getStatus()))
                .orElse(false);
    }

    // A failed attempt leaves the bill FAILED with the reason; only a person can retry it (Pay now)
    private void markFailed(InvoiceEntity invoice, PaymentAttemptEntity attempt, String reason) {
        attempt.setStatus("FAILED");
        attempt.setFailureReason(reason);
        paymentAttemptRepository.save(attempt);
        invoice.setInvoiceStatus(InvoiceStatus.FAILED.getValue());
        invoice.setFailureReason(reason);
        invoice.setUpdatedAt(OffsetDateTime.now());
        invoiceRepository.save(invoice);
    }

    @Transactional
    public void processWebhook(String payload, String signature) {
        if (!stripeProperties.enabled() || stripeProperties.webhookSecret() == null
                || stripeProperties.webhookSecret().isBlank()) {
            throw new BadRequestException("Stripe webhook integration is not configured");
        }
        try {
            com.stripe.model.Event event = com.stripe.net.Webhook.constructEvent(
                    payload, signature, stripeProperties.webhookSecret());
            if (webhookEventRepository.existsById(event.getId())) {
                return;
            }
            webhookEventRepository.save(StripeWebhookEventEntity.builder()
                    .eventId(event.getId())
                    .eventType(event.getType())
                    .build());
            var object = event.getDataObjectDeserializer().getObject().orElse(null);
            if (object instanceof PaymentIntent intent) {
                paymentAttemptRepository.findByStripePaymentIntentId(intent.getId())
                        .ifPresent(attempt -> {
                            String fromStatus = attempt.getInvoice().getInvoiceStatus();
                            applyIntent(attempt, intent);
                            paymentAttemptRepository.save(attempt);
                            auditLogService.record(attempt.getInvoice().getInvoiceId(),
                                    InvoiceUploadService.SYSTEM_USER_ID, ActionTypeEnum.SYSTEM_PAID,
                                    "Stripe reported payment " + attempt.getStatus().toLowerCase(),
                                    fromStatus, attempt.getInvoice().getInvoiceStatus(),
                                    "Stripe event: " + event.getId() + " (" + event.getType() + ")"
                                            + " | payment intent: " + intent.getId());
                        });
            }
        } catch (Exception ex) {
            throw new BadRequestException("Invalid Stripe webhook");
        }
    }

    private void applyIntent(PaymentAttemptEntity attempt, PaymentIntent intent) {
        attempt.setStripePaymentIntentId(intent.getId());
        String status = intent.getStatus() == null ? "UNKNOWN" : intent.getStatus().toUpperCase();
        attempt.setStatus(status);
        if ("SUCCEEDED".equals(status)) {
            attempt.getInvoice().setInvoiceStatus(InvoiceStatus.PAID.getValue());
            attempt.getInvoice().setFailureReason(null);
        } else if ("PROCESSING".equals(status) || "REQUIRES_ACTION".equals(status)) {
            attempt.getInvoice().setInvoiceStatus(InvoiceStatus.PROCESSING_PAYMENT.getValue());
        } else if ("REQUIRES_PAYMENT_METHOD".equals(status)) {
            String reason = intent.getLastPaymentError() != null && intent.getLastPaymentError().getMessage() != null
                    ? intent.getLastPaymentError().getMessage()
                    : "Stripe declined the payment method";
            attempt.setFailureReason(reason);
            attempt.getInvoice().setInvoiceStatus(InvoiceStatus.FAILED.getValue());
            attempt.getInvoice().setFailureReason(reason);
        }
    }

    // Logs a payment request our own checks turned down, and returns the error for the caller to throw
    private BadRequestException rejected(InvoiceEntity invoice, ActionTypeEnum actionType, String message, String detail) {
        // TODO(auth): record the person who requested the payment instead of the system user
        auditLogService.recordFailure(invoice.getInvoiceId(), InvoiceUploadService.SYSTEM_USER_ID,
                actionType, "Payment request rejected", invoice.getInvoiceStatus(),
                detail == null ? message : message + ". " + detail);
        return new BadRequestException(message);
    }

    private void recordPaymentFailure(InvoiceEntity invoice, ActionTypeEnum actionType, String actionTaken,
                                      UUID attemptId, String reason) {
        auditLogService.recordFailure(invoice.getInvoiceId(), InvoiceUploadService.SYSTEM_USER_ID,
                actionType, actionTaken, invoice.getInvoiceStatus(),
                "Payment attempt " + attemptId + ": " + reason);
    }

    private static String plain(BigDecimal value) {
        return value == null ? "(empty)" : value.toPlainString();
    }

    private StripePaymentResponse toResponse(PaymentAttemptEntity attempt) {
        StripePaymentResponse response = new StripePaymentResponse(
                attempt.getPaymentAttemptId(),
                attempt.getInvoice().getInvoiceId(),
                attempt.getAmount(),
                attempt.getCurrency(),
                attempt.getStatus());
        response.setStripePaymentIntentId(attempt.getStripePaymentIntentId());
        return response;
    }

    private String safeMessage(Exception ex) {
        String message = ex.getMessage();
        return message == null ? ex.getClass().getSimpleName() : message.substring(0, Math.min(message.length(), 2000));
    }
}
