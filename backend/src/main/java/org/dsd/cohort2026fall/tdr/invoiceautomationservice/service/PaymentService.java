package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PaymentAttemptEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentPageResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentExceptionResolutionRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentSummaryResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PaymentAttemptRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
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
    private final AuditLogService auditLogService;

    public PaymentService(InvoiceRepository invoiceRepository,
                          PaymentAttemptRepository paymentAttemptRepository,
                          AuditLogService auditLogService) {
        this.invoiceRepository = invoiceRepository;
        this.paymentAttemptRepository = paymentAttemptRepository;
        this.auditLogService = auditLogService;
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

    @Transactional
    public PaymentResponse resolveException(UUID paymentId, PaymentExceptionResolutionRequest request) {
        InvoiceEntity invoice = invoiceRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));
        if (!"FAILED".equals(invoice.getInvoiceStatus())) {
            throw new BadRequestException("Only failed payments can be manually resolved");
        }
        if (request == null || request.getAction() == null || request.getUser() == null
                || request.getNote() == null || request.getNote().isBlank()) {
            throw new BadRequestException("Action, user, and resolution note are required");
        }

        PaymentAttemptEntity attempt = paymentAttemptRepository
                .findFirstByInvoice_InvoiceIdOrderByCreatedAtDesc(invoice.getInvoiceId())
                .orElse(null);

        String action = request.getAction().getValue();
        String targetState;
        String actionTaken;
        if ("RETRY".equals(action)) {
            invoice.setInvoiceStatus("APPROVED");
            invoice.setFailureReason(null);
            targetState = "APPROVED";
            actionTaken = "Manually approved exception for retry";
        } else if ("VOID".equals(action)) {
            invoice.setInvoiceStatus("VOID");
            targetState = "VOID";
            actionTaken = "Manually voided payment exception";
        } else {
            throw new BadRequestException("Unsupported exception action: " + action);
        }

        invoice.setUpdatedAt(OffsetDateTime.now());
        invoice.setExceptionResolutionStatus(action);
        invoice.setExceptionResolutionNote(request.getNote().trim());
        invoice.setExceptionResolvedAt(OffsetDateTime.now());
        invoice.setExceptionResolvedByUser(auditLogService.getUserReference(request.getUser()));
        if (attempt != null) {
            attempt.setExceptionResolutionStatus(action);
            attempt.setResolutionNote(request.getNote().trim());
            attempt.setResolvedAt(OffsetDateTime.now());
            attempt.setResolvedByUser(auditLogService.getUserReference(request.getUser()));
            attempt.setStatus("RESOLVED_" + action);
            paymentAttemptRepository.save(attempt);
        }
        invoiceRepository.save(invoice);
        auditLogService.record(invoice.getInvoiceId(), request.getUser(),
                org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum.USER_EXCEPTION,
                actionTaken, "FAILED", targetState, request.getNote().trim());
        return toResponse(invoice);
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
