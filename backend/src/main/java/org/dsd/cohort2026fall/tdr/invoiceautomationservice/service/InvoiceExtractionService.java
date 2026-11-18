package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.UserRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Manual review flow: run the AI on an uploaded invoice (extract), then save what a
 * person confirmed (verify). Extraction results aren't stored; only verified values are.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InvoiceExtractionService {

    // Still waiting on a person to confirm the invoice's details
    private static final Set<String> REVIEWABLE = Set.of(
            InvoiceStatus.INGESTED.getValue(),
            InvoiceStatus.PENDING_MAPPING.getValue(),
            InvoiceStatus.FAILED.getValue());

    private static final int AUDIT_NOTES_MAX = 3000;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final InvoiceService invoiceService;
    private final ExtractionScorer scorer;
    private final AuditLogService auditLogService;
    private final InvoiceRepository invoiceRepository;
    private final PropertyVendorMappingRepository mappingRepository;
    private final VendorRepository vendorRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate transactionTemplate;
    private final EntityManager entityManager;

    public InvoiceExtractionResponse extract(UUID invoiceUuid) {
        InvoiceEntity invoice = findInvoice(invoiceUuid);
        requireReviewable(invoice);
        if (invoice.getBlobFileUrl() == null || invoice.getBlobFileUrl().isBlank()) {
            throw new InvoiceConflictException("This invoice has no uploaded file to extract from.");
        }

        // InvoiceService.analyzeInvoice retries malformed JSON and throws
        // InvoiceAnalysisFailureException (502) or InvoiceNoDataException (422)
        InvoiceAnalysisResponse analysis;
        try {
            analysis = invoiceService.analyzeInvoice(invoiceUuid);
        } catch (InvoiceAnalysisFailureException | InvoiceNoDataException
                 | ResourceNotFoundException | StorageException e) {
            recordExtractionFailure(invoice, AuditLogService.reasonOf(e));
            throw e;
        } catch (RuntimeException e) {
            // e.g. the AI service timed out or rejected the request
            log.warn("AI call failed for invoice {}", invoiceUuid, e);
            recordExtractionFailure(invoice, "AI service call failed: " + AuditLogService.reasonOf(e));
            throw new InvoiceAnalysisFailureException(
                    "The AI service didn't respond. Try again, or enter the details by hand.");
        }

        // Read the generated model as a JSON tree, so this doesn't depend on how the generator
        // named the nested classes. Keys stay snake_case (vendor_name, total_amount_due, ...).
        JsonNode root = JSON.valueToTree(analysis);
        String aiError = ExtractionScorer.text(root.path("error"));
        ExtractionScorer.Result scored = scorer.score(root.path("extractedValues"), invoiceUuid);
        String toStatus = InvoiceStatus.PENDING_MAPPING.getValue();

        transactionTemplate.executeWithoutResult(tx -> {
            InvoiceEntity current = findInvoice(invoiceUuid);
            // This request may still hold the copy it loaded before the AI call (open-in-view).
            // Reload so from_state reflects any extraction that finished in the meantime.
            entityManager.refresh(current);
            requireReviewable(current);
            String fromStatus = current.getInvoiceStatus();
            boolean rerun = toStatus.equals(fromStatus);
            current.setInvoiceStatus(toStatus);
            current.setUpdatedAt(now());
            invoiceRepository.save(current);
            auditLogService.record(invoiceUuid, InvoiceUploadService.SYSTEM_USER_ID,
                    ActionTypeEnum.SYSTEM_IDENTIFIED,
                    rerun ? "AI re-extracted invoice fields" : "AI extracted invoice fields",
                    fromStatus, toStatus, truncate(describe(scored.fields(), aiError), AUDIT_NOTES_MAX));
        });

        InvoiceExtractionResponse response = new InvoiceExtractionResponse();
        response.setInvoiceUuid(invoiceUuid);
        response.setInvoiceStatus(InvoiceStatus.fromValue(toStatus));
        response.setFields(scored.fields());
        response.setError(aiError);
        response.setSuggestedVendorUuid(scored.vendorUuid());
        response.setSuggestedPropertyUuid(scored.propertyUuid());
        response.setSuggestedMappingUuid(scored.mappingUuid());
        return response;
    }

    public InvoiceResponse verify(UUID invoiceUuid, InvoiceVerifyRequest request) {
        // Checked first: an unknown reviewer is a bad request, not a review attempt to log
        UUID reviewer = reviewerId(request.getReviewedBy());
        try {
            return verifyInTransaction(invoiceUuid, request, reviewer);
        } catch (RuntimeException e) {
            recordReviewRejection(invoiceUuid, reviewer, ActionTypeEnum.USER_VALIDATED, "Reviewer confirmation rejected", e);
            throw e;
        }
    }

    private InvoiceResponse verifyInTransaction(UUID invoiceUuid, InvoiceVerifyRequest request, UUID reviewer) {
        return transactionTemplate.execute(tx -> {
            InvoiceEntity invoice = findInvoice(invoiceUuid);
            requireReviewable(invoice);
            String fromStatus = invoice.getInvoiceStatus();
            // replace=true: the form sends every field, so ones left empty are cleared
            Applied applied = apply(invoice, Confirmed.of(request), true);

            String toStatus = InvoiceStatus.PENDING_APPROVAL.getValue();
            invoice.setInvoiceStatus(toStatus);
            invoice.setFailureReason(null);
            invoice.setUpdatedAt(now());
            invoiceRepository.saveAndFlush(invoice);

            String notes = (request.getNotes() == null ? "" : request.getNotes()) + linkNote(applied, invoice);
            boolean corrected = Boolean.TRUE.equals(request.getAiValuesChanged());
            // The Approvals page shows this entry's user as "Sent for approval by"
            auditLogService.record(invoiceUuid, reviewer,
                    corrected ? ActionTypeEnum.USER_IDENTIFIED : ActionTypeEnum.USER_VALIDATED,
                    corrected ? "Reviewer corrected and confirmed invoice details" : "Reviewer confirmed invoice details",
                    fromStatus, toStatus, truncate(blankToNull(notes), AUDIT_NOTES_MAX));

            return invoiceService.getInvoice(invoiceUuid);
        });
    }

    /** Saves the fields confirmed so far; the invoice stays in PENDING_MAPPING until it's verified. */
    public InvoiceResponse saveProgress(UUID invoiceUuid, InvoiceProgressRequest request) {
        UUID reviewer = reviewerId(request.getReviewedBy());
        try {
            return saveProgressInTransaction(invoiceUuid, request, reviewer);
        } catch (RuntimeException e) {
            recordReviewRejection(invoiceUuid, reviewer, ActionTypeEnum.USER_IDENTIFIED, "Review progress save rejected", e);
            throw e;
        }
    }

    private InvoiceResponse saveProgressInTransaction(UUID invoiceUuid, InvoiceProgressRequest request, UUID reviewer) {
        return transactionTemplate.execute(tx -> {
            InvoiceEntity invoice = findInvoice(invoiceUuid);
            requireReviewable(invoice);
            String fromStatus = invoice.getInvoiceStatus();
            // replace=false: only what was sent is written; everything else stays as it was
            Applied applied = apply(invoice, Confirmed.of(request), false);
            if (applied.saved().isEmpty()) {
                throw new InvalidInvoiceException("Nothing to save: confirm at least one field first.");
            }

            String toStatus = InvoiceStatus.PENDING_MAPPING.getValue();
            invoice.setInvoiceStatus(toStatus);
            invoice.setUpdatedAt(now());
            invoiceRepository.saveAndFlush(invoice);

            auditLogService.record(invoiceUuid, reviewer,
                    ActionTypeEnum.USER_IDENTIFIED, "Reviewer saved review progress",
                    fromStatus, toStatus,
                    truncate("Saved: " + String.join(", ", applied.saved()) + linkNote(applied, invoice), AUDIT_NOTES_MAX));

            return invoiceService.getInvoice(invoiceUuid);
        });
    }

    // ---- writing confirmed values ----------------------------------------

    // The values a reviewer confirmed; null means not confirmed (or left empty)
    private record Confirmed(UUID vendorUuid, UUID propertyUuid, String accountNumber, String invoiceNumber,
                             BigDecimal amount, LocalDate dueDate, LocalDate periodStart, LocalDate periodEnd,
                             LocalDate issued) {

        static Confirmed of(InvoiceVerifyRequest r) {
            return new Confirmed(r.getVendorUuid(), r.getPropertyUuid(), blankToNull(r.getVendorAccountNumber()),
                    blankToNull(r.getVendorSuppliedInvoiceId()), r.getAmount(), r.getDueDate(),
                    r.getBillingPeriodStart(), r.getBillingPeriodEnd(), r.getInvoiceCreationDate());
        }

        static Confirmed of(InvoiceProgressRequest r) {
            return new Confirmed(r.getVendorUuid(), r.getPropertyUuid(), blankToNull(r.getVendorAccountNumber()),
                    blankToNull(r.getVendorSuppliedInvoiceId()), r.getAmount(), r.getDueDate(),
                    r.getBillingPeriodStart(), r.getBillingPeriodEnd(), r.getInvoiceCreationDate());
        }
    }

    private record Applied(boolean newLink, List<String> saved) {}

    /**
     * Writes confirmed values onto the invoice, then checks the result.
     * Vendor, property and account number make up the vendor/property link, so they're applied together.
     * replace=true also clears optional fields that were left empty; replace=false leaves them alone.
     */
    private Applied apply(InvoiceEntity invoice, Confirmed c, boolean replace) {
        if (c.amount() != null && c.amount().stripTrailingZeros().scale() > 2) {
            throw new InvalidInvoiceException("amount can have at most 2 decimal places.");
        }

        List<String> saved = new ArrayList<>();
        boolean newLink = false;
        if (c.vendorUuid() != null && c.propertyUuid() != null && c.accountNumber() != null) {
            VendorEntity vendor = vendorRepository.findById(c.vendorUuid())
                    .orElseThrow(() -> new ResourceNotFoundException("Vendor not found: " + c.vendorUuid()));
            PropertyEntity property = propertyRepository.findById(c.propertyUuid())
                    .orElseThrow(() -> new ResourceNotFoundException("Property not found: " + c.propertyUuid()));

            PropertyVendorMappingEntity mapping = mappingRepository
                    .findByVendor_VendorIdAndProperty_PropertyId(vendor.getVendorId(), property.getPropertyId())
                    .orElse(null);
            if (mapping == null) {
                mapping = mappingRepository.save(PropertyVendorMappingEntity.builder()
                        .mappingId(UUID.randomUUID())
                        .vendor(vendor)
                        .property(property)
                        .vendorAccountNumber(c.accountNumber())
                        .build());
                newLink = true;
            } else if (!ExtractionScorer.normalize(mapping.getVendorAccountNumber())
                    .equals(ExtractionScorer.normalize(c.accountNumber()))) {
                // Paying against the wrong account is worse than stopping here
                throw new InvoiceConflictException("Account number " + c.accountNumber() + " doesn't match the one on file for "
                        + vendor.getName() + " at " + property.getName() + " (" + mapping.getVendorAccountNumber() + ").");
            }
            invoice.setMapping(mapping);
            saved.add("vendor, property and account number");
        }

        set(c.invoiceNumber(), replace, invoice::setVendorSuppliedInvoiceId, "invoice number", saved);
        set(c.amount(), replace, invoice::setAmount, "amount", saved);
        set(c.dueDate(), replace, invoice::setDueDate, "due date", saved);
        set(c.periodStart(), replace, invoice::setBillingPeriodStart, "billing period start", saved);
        set(c.periodEnd(), replace, invoice::setBillingPeriodEnd, "billing period end", saved);
        set(c.issued(), replace, invoice::setInvoiceCreationDate, "invoice date", saved);

        // Check the invoice as it now stands: earlier saves can supply the other half of a pair
        LocalDate start = invoice.getBillingPeriodStart();
        LocalDate end = invoice.getBillingPeriodEnd();
        if (start != null && end != null && start.isAfter(end)) {
            throw new InvalidInvoiceException("Billing period start must be on or before its end.");
        }
        PropertyVendorMappingEntity mapping = invoice.getMapping();
        String number = invoice.getVendorSuppliedInvoiceId();
        if (mapping != null && number != null && end != null && invoiceRepository
                .existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEndAndInvoiceIdNot(
                        mapping.getMappingId(), number, end, invoice.getInvoiceId())) {
            throw new InvoiceAlreadyExistsException("Invoice " + number + " for this billing period is already in the system.");
        }
        return new Applied(newLink, saved);
    }

    private static <T> void set(T value, boolean replace, Consumer<T> setter, String label, List<String> saved) {
        if (value != null) {
            setter.accept(value);
            saved.add(label);
        } else if (replace) {
            setter.accept(null);
        }
    }

    private static String linkNote(Applied applied, InvoiceEntity invoice) {
        if (!applied.newLink()) return "";
        PropertyVendorMappingEntity m = invoice.getMapping();
        return "\n\nCreated vendor/property link: " + m.getVendor().getName() + " at " + m.getProperty().getName()
                + " (account " + m.getVendorAccountNumber() + ")";
    }

    // ---- helpers ----------------------------------------------------------

    private InvoiceEntity findInvoice(UUID invoiceUuid) {
        return invoiceRepository.findById(invoiceUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceUuid));
    }

    private static void requireReviewable(InvoiceEntity invoice) {
        if (!REVIEWABLE.contains(invoice.getInvoiceStatus())) {
            throw new InvoiceConflictException("This invoice is " + invoice.getInvoiceStatus() + " and is past review.");
        }
    }

    // Audit note for an extraction: a summary line, then the fields to check first
    private static String describe(InvoiceExtractedFields f, String aiError) {
        Map<String, ExtractedField> fields = new LinkedHashMap<>();
        fields.put("Vendor", f.getVendorName());
        fields.put("Account number", f.getVendorAccountNumber());
        fields.put("Property address", f.getPropertyAddress());
        fields.put("Property name", f.getPropertyName());
        fields.put("Invoice number", f.getVendorSuppliedInvoiceId());
        fields.put("Amount", f.getAmount());
        fields.put("Due date", f.getDueDate());
        fields.put("Invoice date", f.getInvoiceCreationDate());
        fields.put("Billing period start", f.getBillingPeriodStart());
        fields.put("Billing period end", f.getBillingPeriodEnd());

        List<String> high = new ArrayList<>();
        List<String> check = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        fields.forEach((label, field) -> {
            switch (field.getLevel()) {
                case HIGH -> high.add(label + ": " + field.getValue());
                case NOT_FOUND -> missing.add(label);
                default -> check.add(label + ": " + field.getValue()
                        + " (" + levelWord(field) + ": " + field.getReason() + ")");
            }
        });

        StringBuilder sb = new StringBuilder()
                .append("Read ").append(fields.size() - missing.size()).append(" of ").append(fields.size())
                .append(" fields: ").append(high.size()).append(" high confidence, ")
                .append(check.size()).append(" to check, ").append(missing.size()).append(" not found.");
        section(sb, "To check", check);
        section(sb, "High confidence", high);
        if (!missing.isEmpty()) sb.append("\n\nNot found: ").append(String.join(", ", missing));
        if (aiError != null) sb.append("\n\nAI reported: ").append(aiError);
        return sb.toString();
    }

    private static void section(StringBuilder sb, String title, List<String> lines) {
        if (lines.isEmpty()) return;
        sb.append("\n\n").append(title).append(':');
        lines.forEach(line -> sb.append("\n• ").append(line));
    }

    private static String levelWord(ExtractedField field) {
        return field.getLevel() == ExtractedField.LevelEnum.LOW ? "Low" : "Medium";
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    private void recordExtractionFailure(InvoiceEntity invoice, String reason) {
        auditLogService.recordFailure(invoice.getInvoiceId(), InvoiceUploadService.SYSTEM_USER_ID,
                ActionTypeEnum.SYSTEM_IDENTIFIED, "AI extraction failed", invoice.getInvoiceStatus(), reason);
    }

    // Who the review's audit entries are recorded under: the reviewer sent with the request, or the
    // system user when none was sent.
    // TODO(auth): take the signed-in user from the session instead of the request
    private UUID reviewerId(UUID reviewedBy) {
        if (reviewedBy == null) return InvoiceUploadService.SYSTEM_USER_ID;
        if (!userRepository.existsById(reviewedBy)) {
            throw new BadRequestException("Unknown reviewer: " + reviewedBy);
        }
        return reviewedBy;
    }

    // The review transaction has already rolled back, so this reads the status from before the attempt
    private void recordReviewRejection(UUID invoiceUuid, UUID reviewer, ActionTypeEnum actionType, String actionTaken, RuntimeException e) {
        String status;
        try {
            status = invoiceRepository.findById(invoiceUuid).map(InvoiceEntity::getInvoiceStatus).orElse(null);
        } catch (RuntimeException lookupFailed) {
            status = null;
        }
        auditLogService.recordFailure(invoiceUuid, reviewer,
                actionType, actionTaken, status, AuditLogService.reasonOf(e));
    }
}