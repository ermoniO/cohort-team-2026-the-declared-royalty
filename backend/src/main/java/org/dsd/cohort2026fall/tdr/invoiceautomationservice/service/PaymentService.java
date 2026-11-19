package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.StripeProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PaymentAttemptEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.AutoPaySettingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentSource;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PayNowRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PaymentAttemptRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.AutoPaySettingRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class PaymentService {

    private static final List<String> PAYMENT_INVOICE_STATUSES = List.of(
            "PENDING_APPROVAL", "APPROVED", "PROCESSING_PAYMENT", "PAID", "FAILED");

    private final InvoiceRepository invoiceRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;
    private final AutoPaySettingRepository autoPaySettingRepository;
    private final StripePaymentService stripePaymentService;
    private final StripeProperties stripeProperties;

    public PaymentService(InvoiceRepository invoiceRepository,
                          PaymentAttemptRepository paymentAttemptRepository,
                          AutoPaySettingRepository autoPaySettingRepository,
                          StripePaymentService stripePaymentService,
                          StripeProperties stripeProperties) {
        this.invoiceRepository = invoiceRepository;
        this.paymentAttemptRepository = paymentAttemptRepository;
        this.autoPaySettingRepository = autoPaySettingRepository;
        this.stripePaymentService = stripePaymentService;
        this.stripeProperties = stripeProperties;
    }

    public PaymentPageResponse getPayments(Integer page, Integer size, List<PaymentStatus> statuses, String search) {
        int safePage = page == null ? 0 : page;
        int safeSize = size == null ? 20 : Math.min(size, 100);
        Page<InvoiceEntity> invoicePage = invoiceRepository.findAll(
                matching(statuses, search),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.asc("dueDate"), Sort.Order.desc("createdAt"))));

        PaymentPageResponse response = new PaymentPageResponse();
        response.setItems(invoicePage.getContent().stream().map(this::toResponse).toList());
        response.setPage(invoicePage.getNumber());
        response.setSize(invoicePage.getSize());
        response.setTotalElements(invoicePage.getTotalElements());
        response.setTotalPages(invoicePage.getTotalPages());
        return response;
    }

    public PaymentResponse getPayment(UUID paymentId) {
        return invoiceRepository.findById(paymentId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));
    }

    public PaymentSummaryResponse getSummary() {
        PaymentSummaryResponse response = new PaymentSummaryResponse();
        response.setNeedsApprovalCount(invoiceRepository.countByInvoiceStatus("PENDING_APPROVAL"));
        response.setScheduledCount(invoiceRepository.countByInvoiceStatus("APPROVED"));
        response.setProcessingCount(invoiceRepository.countByInvoiceStatus("PROCESSING_PAYMENT"));
        response.setProcessingTotal(sumFor("PROCESSING_PAYMENT"));
        response.setPaidCount(invoiceRepository.countByInvoiceStatus("PAID"));
        response.setPaidTotal(sumFor("PAID"));
        response.setExceptionCount(invoiceRepository.countByInvoiceStatus("FAILED"));
        response.setNextScheduledDate(nextScheduledDate());
        return response;
    }

    public AutoPaySettingsResponse getAutoPaySettings() {
        AutoPaySettingEntity setting = autoPaySettingRepository.findById(AutoPaySettingEntity.SINGLETON_ID)
                .orElseGet(() -> new AutoPaySettingEntity(AutoPaySettingEntity.SINGLETON_ID, false));
        return new AutoPaySettingsResponse(setting.isEnabled());
    }

    @Transactional
    public AutoPaySettingsResponse updateAutoPaySettings(AutoPaySettingsRequest request) {
        if (request == null || request.getEnabled() == null) {
            throw new BadRequestException("enabled is required");
        }
        AutoPaySettingEntity setting = autoPaySettingRepository.findById(AutoPaySettingEntity.SINGLETON_ID)
                .orElseGet(() -> new AutoPaySettingEntity(AutoPaySettingEntity.SINGLETON_ID, false));
        setting.setEnabled(request.getEnabled());
        autoPaySettingRepository.save(setting);
        return new AutoPaySettingsResponse(setting.isEnabled());
    }

    // Pay now: charges the configured payment method right away, with auto-pay on or off.
    // noRollbackFor matches StripePaymentService so a Stripe rejection's FAILED state is kept.
    @Transactional(noRollbackFor = BadRequestException.class)
    public PaymentResponse payNow(UUID paymentId, PayNowRequest request) {
        if (request == null || request.getApprovedAmount() == null) {
            throw new BadRequestException("approvedAmount is required");
        }
        InvoiceEntity invoice = invoiceRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));
        PaymentAttemptEntity latest = paymentAttemptRepository
                .findFirstByInvoice_InvoiceIdOrderByCreatedAtDesc(paymentId)
                .orElse(null);
        if (!isPayNowAvailable(invoice, latest)) {
            throw new BadRequestException(
                    "Pay now is only available for approved bills due today or earlier, or bills whose last payment failed");
        }
        String paymentMethodId = stripeProperties.autoPayPaymentMethodId();
        if (paymentMethodId == null || paymentMethodId.isBlank()) {
            throw new BadRequestException("No payment method is configured (STRIPE_AUTO_PAY_PAYMENT_METHOD_ID)");
        }
        stripePaymentService.createPayment(paymentId, new StripePaymentRequest(
                paymentMethodId, stripeProperties.currency(), request.getApprovedAmount(), true), PaymentSource.MANUAL);
        return getPayment(paymentId);
    }

    // One rule for the button (payNowAvailable) and the endpoint, so they can't disagree
    private boolean isPayNowAvailable(InvoiceEntity invoice, PaymentAttemptEntity latest) {
        if (invoice.getAmount() == null) {
            return false;
        }
        String status = invoice.getInvoiceStatus();
        if ("APPROVED".equals(status)) {
            return invoice.getDueDate() != null && !invoice.getDueDate().isAfter(LocalDate.now());
        }
        return "FAILED".equals(status) && latest != null
                && StripePaymentService.FAILED_ATTEMPT_STATUSES.contains(latest.getStatus());
    }

    private BigDecimal sumFor(String status) {
        return invoiceRepository.sumAmountByInvoiceStatus(status);
    }

    private LocalDate nextScheduledDate() {
        return invoiceRepository.findFirstByInvoiceStatusAndDueDateIsNotNullOrderByDueDateAsc("APPROVED")
                .map(InvoiceEntity::getDueDate)
                .orElse(null);
    }

    private PaymentResponse toResponse(InvoiceEntity invoice) {
        PaymentAttemptEntity attempt = paymentAttemptRepository
                .findFirstByInvoice_InvoiceIdOrderByCreatedAtDesc(invoice.getInvoiceId())
                .orElse(null);
        PaymentStatus status = paymentStatus(invoice.getInvoiceStatus());

        PaymentResponse response = new PaymentResponse();
        response.setPaymentId(invoice.getInvoiceId());
        response.setInvoiceUuid(invoice.getInvoiceId());
        response.setPaymentAttemptId(attempt == null ? null : attempt.getPaymentAttemptId());
        response.setVendorName(invoice.getMapping() == null || invoice.getMapping().getVendor() == null
                ? null : invoice.getMapping().getVendor().getName());
        response.setPropertyName(invoice.getMapping() == null || invoice.getMapping().getProperty() == null
                ? null : invoice.getMapping().getProperty().getName());
        response.setVendorSuppliedInvoiceId(invoice.getVendorSuppliedInvoiceId());
        response.setOriginalFilename(invoice.getOriginalFilename());
        response.setAmount(invoice.getAmount());
        response.setCurrency(attempt == null ? null : attempt.getCurrency());
        response.setDueDate(invoice.getDueDate());
        response.setPaymentStatus(status);
        response.setInvoiceStatus(org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus.fromValue(invoice.getInvoiceStatus()));
        response.setProviderStatus(attempt == null ? null : attempt.getStatus());
        response.setFailureReason(attempt != null && attempt.getFailureReason() != null
                ? attempt.getFailureReason() : invoice.getFailureReason());
        response.setRetryable(status == PaymentStatus.EXCEPTION && (attempt == null
                || !"SUCCEEDED".equals(attempt.getStatus())));
        response.setPaymentSource(attempt == null || attempt.getPaymentSource() == null
                ? null : PaymentSource.fromValue(attempt.getPaymentSource()));
        response.setPayNowAvailable(isPayNowAvailable(invoice, attempt));
        response.setPaymentDate(status == PaymentStatus.PAID && attempt != null ? attempt.getUpdatedAt() : null);
        response.setBlobFileUrl(invoice.getBlobFileUrl());
        response.setCreatedAt(invoice.getCreatedAt());
        response.setUpdatedAt(invoice.getUpdatedAt());
        return response;
    }

    private PaymentStatus paymentStatus(String invoiceStatus) {
        return switch (invoiceStatus) {
            case "PENDING_APPROVAL" -> PaymentStatus.NEEDS_APPROVAL;
            case "APPROVED" -> PaymentStatus.SCHEDULED;
            case "PROCESSING_PAYMENT" -> PaymentStatus.PROCESSING;
            case "PAID" -> PaymentStatus.PAID;
            case "FAILED" -> PaymentStatus.EXCEPTION;
            default -> PaymentStatus.EXCEPTION;
        };
    }

    private static Specification<InvoiceEntity> matching(List<PaymentStatus> statuses, String search) {
        Collection<String> invoiceStatuses = statuses == null || statuses.isEmpty()
                ? PAYMENT_INVOICE_STATUSES
                : statuses.stream().map(PaymentService::invoiceStatusFor).toList();

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(root.get("invoiceStatus").in(invoiceStatuses));
            if (search != null && !search.isBlank()) {
                String pattern = "%" + escapeLike(search.trim().toLowerCase(Locale.ROOT)) + "%";
                Join<InvoiceEntity, ?> mapping = root.join("mapping", JoinType.LEFT);
                Join<?, ?> vendor = mapping.join("vendor", JoinType.LEFT);
                Join<?, ?> property = mapping.join("property", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("vendorSuppliedInvoiceId")), pattern, '\\'),
                        cb.like(cb.lower(root.get("originalFilename")), pattern, '\\'),
                        cb.like(cb.lower(vendor.get("name")), pattern, '\\'),
                        cb.like(cb.lower(property.get("name")), pattern, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String invoiceStatusFor(PaymentStatus status) {
        return switch (status) {
            case NEEDS_APPROVAL -> "PENDING_APPROVAL";
            case SCHEDULED -> "APPROVED";
            case PROCESSING -> "PROCESSING_PAYMENT";
            case PAID -> "PAID";
            case EXCEPTION -> "FAILED";
        };
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
