package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import lombok.extern.slf4j.Slf4j;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.StripeProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PaymentAttemptEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.StripeWebhookEventEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PaymentAttemptRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.StripeWebhookEventRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
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

    public StripePaymentService(
            InvoiceRepository invoiceRepository,
            PaymentAttemptRepository paymentAttemptRepository,
            StripeProperties stripeProperties,
            ObjectProvider<StripeClient> stripeClientProvider,
            StripeWebhookEventRepository webhookEventRepository) {
        this.invoiceRepository = invoiceRepository;
        this.paymentAttemptRepository = paymentAttemptRepository;
        this.stripeProperties = stripeProperties;
        this.stripeClientProvider = stripeClientProvider;
        this.webhookEventRepository = webhookEventRepository;
    }

    @Transactional
    public StripePaymentResponse createPayment(UUID invoiceId, StripePaymentRequest request) {
        if (!stripeProperties.enabled()) {
            throw new BadRequestException("Stripe integration is disabled");
        }

        var existing = paymentAttemptRepository
                .findFirstByInvoice_InvoiceIdAndStatusInOrderByCreatedAtDesc(
                        invoiceId, List.of("CREATED", "PROCESSING", "REQUIRES_ACTION"));
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        InvoiceEntity invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
        if (!InvoiceStatus.APPROVED.getValue().equals(invoice.getInvoiceStatus())) {
            throw new BadRequestException("Invoice must be APPROVED before a Stripe payment is requested");
        }
        if (!Boolean.TRUE.equals(request.getHumanApprovalConfirmed())) {
            throw new BadRequestException("Human approval is required before finalizing a Stripe payment request");
        }
        if (invoice.getAmount() == null || request.getApprovedAmount().compareTo(invoice.getAmount()) != 0) {
            throw new BadRequestException("approvedAmount must exactly match the persisted invoice amount");
        }
        String currency = request.getCurrency().trim().toLowerCase();
        if (!stripeProperties.currency().equalsIgnoreCase(currency)) {
            throw new BadRequestException("Unsupported Stripe currency: " + currency);
        }

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
                .putMetadata("invoice_id", invoiceId.toString())
                .putMetadata("payment_attempt_id", attemptId.toString())
                .build();

        try {
            RequestOptions options = RequestOptions.builder()
                    .setIdempotencyKey(idempotencyKey)
                    .build();
            PaymentIntent intent = stripeClientProvider.getObject().v1().paymentIntents().create(params, options);
            applyIntent(attempt, intent);
            paymentAttemptRepository.save(attempt);
            return toResponse(attempt);
        } catch (StripeException ex) {
            attempt.setStatus("FAILED");
            attempt.setFailureReason(safeMessage(ex));
            paymentAttemptRepository.save(attempt);
            throw new BadRequestException("Stripe rejected the payment request");
        } catch (RuntimeException ex) {
            attempt.setStatus("FAILED");
            attempt.setFailureReason(safeMessage(ex));
            paymentAttemptRepository.save(attempt);
            throw ex;
        }
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
                            applyIntent(attempt, intent);
                            paymentAttemptRepository.save(attempt);
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
        } else if ("PROCESSING".equals(status) || "REQUIRES_ACTION".equals(status)) {
            attempt.getInvoice().setInvoiceStatus(InvoiceStatus.PROCESSING_PAYMENT.getValue());
        } else if ("REQUIRES_PAYMENT_METHOD".equals(status)) {
            attempt.getInvoice().setInvoiceStatus(InvoiceStatus.FAILED.getValue());
        }
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
