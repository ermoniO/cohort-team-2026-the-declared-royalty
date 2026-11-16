package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceAlreadyExistsException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceAnalysisFailureException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceLockedException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceNoDataException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvalidInvoiceException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@Transactional
public class InvoiceService {

    // Still moving through the pipeline. APPROVED, PAID and VOID are past the processing queue.
    // This list drives the pending count in the /invoices/summary response.
    static final List<String> PENDING_STATUSES = List.of(
        InvoiceStatus.INGESTED.getValue(),
        InvoiceStatus.PENDING_MAPPING.getValue(),
        InvoiceStatus.PENDING_APPROVAL.getValue(),
        InvoiceStatus.PROCESSING_PAYMENT.getValue(),
        InvoiceStatus.FAILED.getValue());

    private final InvoiceRepository invoiceRepository;
    private final PropertyVendorMappingRepository mappingRepository;
    private final InvoiceTransitionService transitionService;
    private final InvoiceAnalysisService invoiceAnalysisService;
    private final AuditLogService auditLogService;
    private final PolicyEngineService policyEngineService;
    private final AccountsPayableApprovalMatrixService approvalMatrixService;

    @Value("${llm.max-attempts:3}")
    private int maxAttempts = 3;

    // Once an invoice is approved its amount and mapping are what the approver signed off on.
    private static final java.util.Set<String> EDIT_LOCKED_STATUSES = java.util.Set.of(
            InvoiceStatus.APPROVED.getValue(),
            InvoiceStatus.PROCESSING_PAYMENT.getValue(),
            InvoiceStatus.PAID.getValue(),
            InvoiceStatus.VOID.getValue());

    public InvoiceService(
            InvoiceRepository invoiceRepository,
            PropertyVendorMappingRepository mappingRepository,
            InvoiceTransitionService transitionService) {
        this(invoiceRepository, mappingRepository, transitionService, null, null, null, null);
    }

    public InvoiceService(
            InvoiceRepository invoiceRepository,
            PropertyVendorMappingRepository mappingRepository,
            InvoiceTransitionService transitionService,
            InvoiceAnalysisService invoiceAnalysisService,
            AuditLogService auditLogService) {
        this(invoiceRepository, mappingRepository, transitionService, invoiceAnalysisService, auditLogService, null, null);
    }

    @Autowired
    public InvoiceService(
            InvoiceRepository invoiceRepository,
            PropertyVendorMappingRepository mappingRepository,
            InvoiceTransitionService transitionService,
            InvoiceAnalysisService invoiceAnalysisService,
            AuditLogService auditLogService,
            PolicyEngineService policyEngineService,
            AccountsPayableApprovalMatrixService approvalMatrixService) {
        this.invoiceRepository = invoiceRepository;
        this.mappingRepository = mappingRepository;
        this.transitionService = transitionService;
        this.invoiceAnalysisService = invoiceAnalysisService;
        this.auditLogService = auditLogService;
        this.policyEngineService = policyEngineService;
        this.approvalMatrixService = approvalMatrixService;
    }

    private void applyExtractedValues(InvoiceEntity invoice, InvoiceAnalysisResponseExtractedValues extracted) {
        if (extracted == null) {
            return;
        }
        String invoiceNumber = extractString(extracted.getInvoiceNumber());
        if (invoiceNumber != null) {
            invoice.setVendorSuppliedInvoiceId(invoiceNumber);
        }
        LocalDate billingStart = extractDate(extracted.getBillingPeriodStart());
        if (billingStart != null) {
            invoice.setBillingPeriodStart(billingStart);
        }
        LocalDate billingEnd = extractDate(extracted.getBillingPeriodEnd());
        if (billingEnd != null) {
            invoice.setBillingPeriodEnd(billingEnd);
        }
        LocalDate issuedDate = extractDate(extracted.getInvoiceIssuedDate());
        if (issuedDate != null) {
            invoice.setInvoiceCreationDate(issuedDate);
        }
        BigDecimal totalAmount = extractAmount(extracted.getTotalAmountDue());
        if (totalAmount != null) {
            invoice.setAmount(totalAmount);
        }
        LocalDate paymentDueDate = extractDate(extracted.getPaymentDueDate());
        if (paymentDueDate != null) {
            invoice.setDueDate(paymentDueDate);
        }
    }

    private PropertyVendorMappingEntity autoMatchActiveMapping(InvoiceAnalysisResponseExtractedValues extracted) {
        if (extracted == null || mappingRepository == null) {
            return null;
        }

        String accountNumber = extractString(extracted.getAccountNumber());
        if (accountNumber != null) {
            List<PropertyVendorMappingEntity> byAccount = mappingRepository
                    .findByVendorAccountNumberIgnoreCaseAndStatus(accountNumber, "ACTIVE");
            if (byAccount != null && byAccount.size() == 1) {
                return byAccount.get(0);
            }
        }

        String vendorName = normalizeText(extractString(extracted.getVendorName()));
        String propertyName = normalizeText(extractString(extracted.getPropertyName()));
        String propertyAddress = normalizeText(extractString(extracted.getPropertyAddress()));
        if (vendorName == null || (propertyName == null && propertyAddress == null)) {
            return null;
        }

        List<PropertyVendorMappingEntity> activeMappings = mappingRepository.findByStatus("ACTIVE");
        if (activeMappings == null || activeMappings.isEmpty()) {
            return null;
        }

        List<PropertyVendorMappingEntity> exactMatches = activeMappings.stream()
                .filter(m -> m.getVendor() != null && vendorName.equals(normalizeText(m.getVendor().getName())))
                .filter(m -> propertyMatches(m.getProperty(), propertyName, propertyAddress, true))
                .toList();
        if (exactMatches.size() == 1) {
            return exactMatches.get(0);
        }

        List<PropertyVendorMappingEntity> fuzzyMatches = activeMappings.stream()
                .filter(m -> vendorMatches(m.getVendor(), vendorName))
                .filter(m -> propertyMatches(m.getProperty(), propertyName, propertyAddress, false))
                .toList();
        return fuzzyMatches.size() == 1 ? fuzzyMatches.get(0) : null;
    }

    private boolean vendorMatches(VendorEntity vendor, String extractedVendorName) {
        if (vendor == null || extractedVendorName == null) {
            return false;
        }
        String candidateName = normalizeText(vendor.getName());
        if (candidateName == null) {
            return false;
        }
        if (candidateName.equals(extractedVendorName)) {
            return true;
        }
        return extractedVendorName.length() >= 4
                && candidateName.length() >= 4
                && (extractedVendorName.contains(candidateName) || candidateName.contains(extractedVendorName));
    }

    private boolean propertyMatches(
            PropertyEntity property, String propertyName, String propertyAddress, boolean exactOnly) {
        if (property == null) {
            return false;
        }
        String candidateName = normalizeText(property.getName());
        if (candidateName != null) {
            if (propertyName != null && propertyName.equals(candidateName)) {
                return true;
            }
            if (!exactOnly) {
                if (propertyName != null && propertyName.length() >= 4
                        && (propertyName.contains(candidateName) || candidateName.contains(propertyName))) {
                    return true;
                }
                if (propertyAddress != null && propertyAddress.contains(candidateName)) {
                    return true;
                }
            }
        }
        AddressRecord address = property.getAddress();
        if (address != null) {
            String candidateStreet = normalizeText(address.streetAddress());
            if (candidateStreet != null) {
                if (propertyAddress != null && (propertyAddress.equals(candidateStreet)
                        || (!exactOnly && propertyAddress.contains(candidateStreet)))) {
                    return true;
                }
                if (propertyName != null && (propertyName.equals(candidateStreet)
                        || (!exactOnly && propertyName.contains(candidateStreet)))) {
                    return true;
                }
            }
        }
        return false;
    }

    private String extractString(StringField field) {
        if (field == null || field.getValue() == null) {
            return null;
        }
        String value = field.getValue().toString().trim();
        return value.isEmpty() ? null : value;
    }

    private LocalDate extractDate(StringField field) {
        String raw = extractString(field);
        if (raw == null) {
            return null;
        }
        try {
            return LocalDate.parse(raw);
        } catch (DateTimeParseException ex) {
            log.debug("Ignoring unparseable extracted date '{}'", raw);
            return null;
        }
    }

    private BigDecimal extractAmount(NumberField field) {
        if (field == null || field.getValue() == null) {
            return null;
        }
        Object raw = field.getValue();
        try {
            if (raw instanceof BigDecimal bd) {
                return bd.setScale(2, RoundingMode.HALF_UP);
            }
            if (raw instanceof Number num) {
                return BigDecimal.valueOf(num.doubleValue()).setScale(2, RoundingMode.HALF_UP);
            }
            String cleaned = raw.toString().replace("$", "").replace(",", "").trim();
            if (cleaned.isEmpty()) {
                return null;
            }
            return new BigDecimal(cleaned).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException ex) {
            log.debug("Ignoring unparseable extracted amount '{}'", raw);
            return null;
        }
    }

    private String normalizeText(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        return normalized.isEmpty() ? null : normalized;
    }

    public InvoiceAnalysisResponse analyzeInvoice(UUID invoiceUuid) {
        InvoiceEntity invoice = invoiceRepository.findByIdForUpdate(invoiceUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceUuid));

        if (EDIT_LOCKED_STATUSES.contains(invoice.getInvoiceStatus())) {
            throw new InvoiceLockedException("Invoice is locked and cannot be re-analyzed: " + invoiceUuid);
        }

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                InvoiceAnalysisResponse response = invoiceAnalysisService.analyzeInvoice(invoiceUuid);
                if (response.getError() != null && response.getError().contains("No values could be extracted")) {
                    throw new InvoiceNoDataException("File " + invoiceUuid + " contains no valid data, likely not an invoice");
                }

                InvoiceAnalysisResponseExtractedValues extracted = response.getExtractedValues();
                applyExtractedValues(invoice, extracted);
                invoice.setUpdatedAt(now());
                invoiceRepository.save(invoice);

                boolean movedToMapping = false;
                if (InvoiceStatus.INGESTED.getValue().equals(invoice.getInvoiceStatus()) && transitionService != null) {
                    movedToMapping = transitionService.tryTransition(
                            invoice.getInvoiceId(),
                            InvoiceStatus.PENDING_MAPPING,
                            InvoiceUploadService.SYSTEM_USER_ID,
                            "AI extracted invoice fields");
                    if (movedToMapping) {
                        invoice.setInvoiceStatus(InvoiceStatus.PENDING_MAPPING.getValue());
                    }
                }

                if (!movedToMapping && auditLogService != null) {
                    auditLogService.record(
                            invoice.getInvoiceId(),
                            InvoiceUploadService.SYSTEM_USER_ID,
                            AuditLogCreateRequest.ActionTypeEnum.SYSTEM_IDENTIFIED,
                            "AI extracted invoice fields",
                            invoice.getInvoiceStatus(),
                            invoice.getInvoiceStatus(),
                            "Extracted invoice data via LLM analysis");
                }

                PropertyVendorMappingEntity matched = autoMatchActiveMapping(extracted);
                if (matched != null) {
                    invoice.setMapping(matched);
                    invoice.setUpdatedAt(now());
                    invoiceRepository.save(invoice);

                    if ((InvoiceStatus.INGESTED.getValue().equals(invoice.getInvoiceStatus())
                            || InvoiceStatus.PENDING_MAPPING.getValue().equals(invoice.getInvoiceStatus()))
                            && transitionService != null) {
                        boolean movedToApproval = transitionService.tryTransition(
                                invoice.getInvoiceId(),
                                InvoiceStatus.PENDING_APPROVAL,
                                InvoiceUploadService.SYSTEM_USER_ID,
                                "Auto-matched active property-vendor mapping");
                        if (movedToApproval) {
                            invoice.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL.getValue());
                            tryAutoApproveIfEligible(invoice);
                        }
                    } else if (InvoiceStatus.PENDING_APPROVAL.getValue().equals(invoice.getInvoiceStatus())) {
                        tryAutoApproveIfEligible(invoice);
                    }
                }

                return response;
            } catch (JsonProcessingException e) {
                log.error("Attempt {} failed. Model returned malformed Json object: {}", attempt, e.getMessage());
                if (attempt == maxAttempts) {
                    throw new InvoiceAnalysisFailureException(
                            "Invoice extraction failed after " + attempt + " attempts. Model returned malformed Json object.");
                }
            }
        }
        throw new IllegalStateException("Unexpected retry state.");
    }

    @Transactional(readOnly = true)
    public InvoicePageResponse getInvoices(int page, int size, List<InvoiceStatus> statuses, String search) {
        Page<InvoiceEntity> invoicePage = invoiceRepository.findAll(
                matching(statuses, search),
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("invoiceId"))));

        InvoicePageResponse response = new InvoicePageResponse();
        response.setItems(invoicePage.getContent().stream().map(this::toResponse).toList());
        response.setPage(invoicePage.getNumber());
        response.setSize(invoicePage.getSize());
        response.setTotalElements(invoicePage.getTotalElements());
        response.setTotalPages(invoicePage.getTotalPages());
        return response;
    }

    @Transactional(readOnly = true)
    public InvoiceSummaryResponse getSummary(OffsetDateTime receivedSince) {
        String needsReview = InvoiceStatus.PENDING_MAPPING.getValue();
        String awaitingApproval = InvoiceStatus.PENDING_APPROVAL.getValue();

        InvoiceSummaryResponse summary = new InvoiceSummaryResponse();
        summary.setPendingCount(invoiceRepository.countByInvoiceStatusIn(PENDING_STATUSES));
        summary.setPendingPropertyCount(invoiceRepository.countDistinctPropertiesByInvoiceStatusIn(PENDING_STATUSES));
        summary.setNeedsReviewCount(invoiceRepository.countByInvoiceStatus(needsReview));
        summary.setNeedsReviewReceivedSince(receivedSince == null
                ? 0L
                : invoiceRepository.countByInvoiceStatusAndCreatedAtGreaterThanEqual(needsReview, receivedSince));
        summary.setAwaitingApprovalCount(invoiceRepository.countByInvoiceStatus(awaitingApproval));
        summary.setAwaitingApprovalTotal(invoiceRepository.sumAmountByInvoiceStatus(awaitingApproval));
        summary.setExceptionsCount(invoiceRepository.countByInvoiceStatus(InvoiceStatus.FAILED.getValue()));
        return summary;
    }

    @Transactional(readOnly = true)
    public InvoiceResponse getInvoice(UUID invoiceUuid) {
        return toResponse(findInvoice(invoiceUuid));
    }

    public InvoiceResponse createInvoice(InvoiceCreateRequest request) {
        if (request.getInvoiceStatus() != null && request.getInvoiceStatus() != InvoiceStatus.INGESTED) {
            throw new BadRequestException("New invoices must start as INGESTED");
        }
        PropertyVendorMappingEntity mapping = findMapping(request.getMappingUuid());
        validateBillingPeriod(request.getBillingPeriodStart(), request.getBillingPeriodEnd());
        validateAmount(request.getAmount());
        ensureNotDuplicate(mapping.getMappingId(), request.getVendorSuppliedInvoiceId(), request.getBillingPeriodEnd(), null);

        OffsetDateTime now = now();
        InvoiceEntity invoice = InvoiceEntity.builder()
                .invoiceId(UUID.randomUUID())
                .vendorSuppliedInvoiceId(request.getVendorSuppliedInvoiceId())
                .mapping(mapping)
                .billingPeriodStart(request.getBillingPeriodStart())
                .billingPeriodEnd(request.getBillingPeriodEnd())
                .invoiceCreationDate(request.getInvoiceCreationDate())
                .amount(request.getAmount())
                .dueDate(request.getDueDate())
                .invoiceStatus(request.getInvoiceStatus() == null
                        ? InvoiceStatus.INGESTED.getValue()
                        : request.getInvoiceStatus().getValue())
                .blobFileUrl(request.getBlobFileUrl())
                .blobFileSha256(request.getBlobFileSha256())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return toResponse(invoiceRepository.save(invoice));
    }

    public InvoiceResponse updateInvoice(UUID invoiceUuid, InvoiceUpdateRequest request) {
        // Locked read: the status/amount checks below must see the row as it is now, not a stale copy
        InvoiceEntity invoice = invoiceRepository.findByIdForUpdate(invoiceUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceUuid));
        PropertyVendorMappingEntity mapping = request.getMappingUuid() == null
                ? invoice.getMapping()
                : findMapping(request.getMappingUuid());

        var billingPeriodStart = request.getBillingPeriodStart() == null
                ? invoice.getBillingPeriodStart()
                : request.getBillingPeriodStart();
        var billingPeriodEnd = request.getBillingPeriodEnd() == null
                ? invoice.getBillingPeriodEnd()
                : request.getBillingPeriodEnd();
        validateBillingPeriod(billingPeriodStart, billingPeriodEnd);
        validateAmount(request.getAmount());
        rejectEditsToLockedInvoice(invoice, mapping, request);
        if (mapping != null) {
            ensureNotDuplicate(mapping.getMappingId(), invoice.getVendorSuppliedInvoiceId(), billingPeriodEnd, invoiceUuid);
        }

        invoice.setMapping(mapping);
        if (request.getBillingPeriodStart() != null) {
            invoice.setBillingPeriodStart(request.getBillingPeriodStart());
        }
        if (request.getBillingPeriodEnd() != null) {
            invoice.setBillingPeriodEnd(request.getBillingPeriodEnd());
        }
        if (request.getInvoiceCreationDate() != null) {
            invoice.setInvoiceCreationDate(request.getInvoiceCreationDate());
        }
        if (request.getAmount() != null) {
            invoice.setAmount(request.getAmount());
        }
        if (request.getDueDate() != null) {
            invoice.setDueDate(request.getDueDate());
        }
        if (request.getFailureReason() != null) {
            invoice.setFailureReason(request.getFailureReason());
        }
        if (request.getBlobFileUrl() != null) {
            invoice.setBlobFileUrl(request.getBlobFileUrl());
        }
        if (request.getBlobFileSha256() != null) {
            invoice.setBlobFileSha256(request.getBlobFileSha256());
        }
        invoice.setUpdatedAt(now());

        InvoiceEntity saved = invoiceRepository.save(invoice);
        if (request.getInvoiceStatus() != null) {
            if (request.getInvoiceStatus() == InvoiceStatus.APPROVED) {
                validateHumanApprovalClearance(invoice, request.getActedBy());
            }
            transitionService.transition(invoiceUuid, request.getInvoiceStatus(), request.getActedBy(), request.getFailureReason());
            saved.setInvoiceStatus(request.getInvoiceStatus().getValue());
            if (request.getInvoiceStatus() == InvoiceStatus.PENDING_APPROVAL) {
                tryAutoApproveIfEligible(saved);
            }
        } else if (request.getMappingUuid() != null
                && InvoiceStatus.PENDING_APPROVAL.getValue().equals(saved.getInvoiceStatus())) {
            tryAutoApproveIfEligible(saved);
        }
        return toResponse(saved);
    }

    /**
     * Automatically transitions an invoice from PENDING_APPROVAL to APPROVED when it carries an active
     * auto-approval mapping and satisfies the property's Step 0 policy threshold.
     */
    private void tryAutoApproveIfEligible(InvoiceEntity invoice) {
        if (policyEngineService == null || transitionService == null || invoice == null) {
            return;
        }
        if (!InvoiceStatus.PENDING_APPROVAL.getValue().equals(invoice.getInvoiceStatus())) {
            return;
        }
        PropertyVendorMappingEntity mapping = invoice.getMapping();
        if (mapping == null
                || !"ACTIVE".equalsIgnoreCase(mapping.getStatus())
                || !mapping.isAutoApprovalEnabled()
                || mapping.getProperty() == null
                || mapping.getProperty().getPropertyId() == null
                || invoice.getAmount() == null) {
            return;
        }
        try {
            PolicyEvaluationRequest evalReq = new PolicyEvaluationRequest();
            evalReq.setGrossAmount(invoice.getAmount().doubleValue());
            evalReq.setConfidenceScore(96);
            String costTypeStr = mapping.getCostType() != null && !mapping.getCostType().isBlank()
                    ? mapping.getCostType()
                    : "VARIABLE";
            evalReq.setCostType(PolicyEvaluationRequest.CostTypeEnum.fromValue(costTypeStr));

            PolicyEvaluationResponse eval = policyEngineService.evaluate(
                    mapping.getProperty().getPropertyId(), evalReq);
            if (eval != null && Boolean.TRUE.equals(eval.getIsAutoApproved())) {
                String reason = eval.getReason() != null
                        ? eval.getReason()
                        : "Auto-approved under Step 0 property policy threshold";
                boolean approved = transitionService.tryTransition(
                        invoice.getInvoiceId(),
                        InvoiceStatus.APPROVED,
                        InvoiceUploadService.SYSTEM_USER_ID,
                        reason);
                if (approved) {
                    invoice.setInvoiceStatus(InvoiceStatus.APPROVED.getValue());
                }
            }
        } catch (Exception ex) {
            log.warn("Auto-approval evaluation skipped for invoice {}: {}", invoice.getInvoiceId(), ex.getMessage());
        }
    }

    /**
     * Enforces property approval matrix seat and dollar threshold clearance for known AP seat occupants.
     */
    private void validateHumanApprovalClearance(InvoiceEntity invoice, UUID actorUserId) {
        if (approvalMatrixService == null
                || actorUserId == null
                || InvoiceUploadService.SYSTEM_USER_ID.equals(actorUserId)
                || invoice.getMapping() == null
                || invoice.getMapping().getProperty() == null
                || invoice.getMapping().getProperty().getPropertyId() == null
                || invoice.getAmount() == null) {
            return;
        }

        List<AccountsPayableSeatResponse> allSeats = approvalMatrixService.getAllSeats();
        if (allSeats == null || allSeats.isEmpty()) {
            return;
        }

        boolean actorHoldsSeat = allSeats.stream()
                .anyMatch(seat -> actorUserId.equals(seat.getAssignedUserUuid()));
        if (!actorHoldsSeat) {
            return;
        }

        UUID propertyId = invoice.getMapping().getProperty().getPropertyId();
        String costType = invoice.getMapping().getCostType() != null && !invoice.getMapping().getCostType().isBlank()
                ? invoice.getMapping().getCostType()
                : "VARIABLE";
        boolean isFixed = "FIXED_MONTHLY".equalsIgnoreCase(costType);

        List<AccountsPayableApprovalMatrixResponse> matrixSteps = approvalMatrixService.getPropertyApprovalMatrix(propertyId);
        if (matrixSteps == null || matrixSteps.isEmpty()) {
            return;
        }

        double invoiceAmount = invoice.getAmount().doubleValue();
        double maxAuthorizedLimit = -1.0;

        for (AccountsPayableApprovalMatrixResponse step : matrixSteps) {
            if (step.getAccountsPayableApprovalSequence() != null
                    && step.getAccountsPayableApprovalSequence() > 0
                    && actorUserId.equals(step.getAssignedUserUuid())) {
                double limit = effectiveStepLimit(
                        step.getFixedAutoMax(),
                        step.getVariableMax(),
                        step.getAccountsPayableThresholdSlug(),
                        isFixed);
                maxAuthorizedLimit = Math.max(maxAuthorizedLimit, limit);
            }
        }

        ApprovalQueueResponse routingQueue = approvalMatrixService.calculateInvoiceRoutingQueue(
                propertyId, invoiceAmount, costType);
        if (routingQueue != null && routingQueue.getSteps() != null) {
            for (ApprovalQueueStepResponse qStep : routingQueue.getSteps()) {
                if (qStep.getSequence() != null
                        && qStep.getSequence() > 0
                        && actorUserId.equals(qStep.getUserUuid())) {
                    double limit = effectiveStepLimit(
                            qStep.getFixedAutoMax(),
                            qStep.getVariableMax(),
                            qStep.getThresholdSlug(),
                            isFixed);
                    maxAuthorizedLimit = Math.max(maxAuthorizedLimit, limit);
                }
            }
        }

        if (maxAuthorizedLimit < invoiceAmount) {
            throw new BadRequestException(String.format(
                    Locale.US,
                    "Approver does not have sufficient seat clearance or approval threshold ($%.2f) for invoice amount ($%.2f)",
                    Math.max(0.0, maxAuthorizedLimit),
                    invoiceAmount));
        }
    }

    private double effectiveStepLimit(Double fixedAutoMax, Double variableMax, String thresholdSlug, boolean isFixed) {
        if ("LIMIT_UNLIMITED".equalsIgnoreCase(thresholdSlug)) {
            return Double.MAX_VALUE;
        }
        if ("LIMIT_NONE".equalsIgnoreCase(thresholdSlug)) {
            return 0.0;
        }
        Double raw = isFixed ? fixedAutoMax : variableMax;
        return raw != null ? raw : 0.0;
    }

    private void rejectEditsToLockedInvoice(InvoiceEntity invoice, PropertyVendorMappingEntity newMapping, InvoiceUpdateRequest request) {
        if (!EDIT_LOCKED_STATUSES.contains(invoice.getInvoiceStatus())) {
            return;
        }
        boolean amountChanged = request.getAmount() != null
                && (invoice.getAmount() == null || request.getAmount().compareTo(invoice.getAmount()) != 0);
        UUID currentMappingId = invoice.getMapping() == null ? null : invoice.getMapping().getMappingId();
        UUID newMappingId = newMapping == null ? null : newMapping.getMappingId();
        boolean mappingChanged = !java.util.Objects.equals(currentMappingId, newMappingId);
        if (amountChanged || mappingChanged) {
            throw new InvoiceLockedException(
                    "Amount and mapping cannot change once the invoice is " + invoice.getInvoiceStatus());
        }
    }

    private InvoiceEntity findInvoice(UUID invoiceUuid) {
        return invoiceRepository.findById(invoiceUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceUuid));
    }

    private PropertyVendorMappingEntity findMapping(UUID mappingUuid) {
        return mappingRepository.findById(mappingUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Property-vendor mapping not found: " + mappingUuid));
    }

    private void ensureNotDuplicate(UUID mappingUuid, String vendorInvoiceId, java.time.LocalDate billingPeriodEnd, UUID currentInvoiceUuid) {
        if (vendorInvoiceId == null || billingPeriodEnd == null) {
            return;
        }

        boolean duplicate = currentInvoiceUuid == null
                ? invoiceRepository.existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEnd(
                mappingUuid, vendorInvoiceId, billingPeriodEnd)
                : invoiceRepository.existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEndAndInvoiceIdNot(
                mappingUuid, vendorInvoiceId, billingPeriodEnd, currentInvoiceUuid);
        if (duplicate) {
            throw new InvoiceAlreadyExistsException("An invoice with this vendor identifier and billing period already exists for the mapping.");
        }
    }

    private void validateBillingPeriod(java.time.LocalDate start, java.time.LocalDate end) {
        if (start != null && end != null && start.isAfter(end)) {
            throw new InvalidInvoiceException("billingPeriodStart must not be after billingPeriodEnd.");
        }
    }

    private void validateAmount(BigDecimal amount) {
        if (amount != null && (amount.abs().compareTo(new BigDecimal("99999999.99")) > 0
                || amount.stripTrailingZeros().scale() > 2)) {
            throw new InvalidInvoiceException("amount must fit DECIMAL(10, 2).");
        }
    }

    private static Specification<InvoiceEntity> matching(List<InvoiceStatus> statuses, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (statuses != null && !statuses.isEmpty()) {
                predicates.add(root.get("invoiceStatus").in(statuses.stream().map(InvoiceStatus::getValue).toList()));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + escapeLike(search.trim().toLowerCase(Locale.ROOT)) + "%";
                // LEFT joins so unmapped invoices (no vendor or property yet) can still match on filename
                Join<InvoiceEntity, PropertyVendorMappingEntity> mapping = root.join("mapping", JoinType.LEFT);
                Join<PropertyVendorMappingEntity, VendorEntity> vendor = mapping.join("vendor", JoinType.LEFT);
                Join<PropertyVendorMappingEntity, PropertyEntity> property = mapping.join("property", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("vendorSuppliedInvoiceId")), pattern, '\\'),
                        cb.like(cb.lower(root.get("originalFilename")), pattern, '\\'),
                        cb.like(cb.lower(vendor.get("name")), pattern, '\\'),
                        cb.like(cb.lower(property.get("name")), pattern, '\\')));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    // Treat % and _ typed by the user as literal characters, not wildcards
    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    private InvoiceResponse toResponse(InvoiceEntity entity) {
        InvoiceResponse response = new InvoiceResponse();
        response.setInvoiceUuid(entity.getInvoiceId());
        PropertyVendorMappingEntity mapping = entity.getMapping();
        if (mapping != null) {
            response.setMappingUuid(mapping.getMappingId());
            response.setVendorAccountNumber(mapping.getVendorAccountNumber());
            if (mapping.getVendor() != null) {
                response.setVendorUuid(mapping.getVendor().getVendorId());
                response.setVendorName(mapping.getVendor().getName());
            }
            if (mapping.getProperty() != null) {
                response.setPropertyUuid(mapping.getProperty().getPropertyId());
                response.setPropertyName(mapping.getProperty().getName());
           }
        }
        response.setOriginalFilename(entity.getOriginalFilename());
        response.setVendorSuppliedInvoiceId(entity.getVendorSuppliedInvoiceId());
        response.setBillingPeriodStart(entity.getBillingPeriodStart());
        response.setBillingPeriodEnd(entity.getBillingPeriodEnd());
        response.setInvoiceCreationDate(entity.getInvoiceCreationDate());
        response.setAmount(entity.getAmount());
        response.setDueDate(entity.getDueDate());
        response.setInvoiceStatus(InvoiceStatus.fromValue(entity.getInvoiceStatus()));
        response.setFailureReason(entity.getFailureReason());
        response.setBlobFileUrl(entity.getBlobFileUrl());
        response.setBlobFileSha256(entity.getBlobFileSha256());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
