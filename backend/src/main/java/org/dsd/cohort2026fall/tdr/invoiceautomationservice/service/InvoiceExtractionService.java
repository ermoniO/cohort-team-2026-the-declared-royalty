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
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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
            throw e;
        } catch (RuntimeException e) {
            // e.g. the AI service timed out or rejected the request
            log.warn("AI call failed for invoice {}", invoiceUuid, e);
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
        return transactionTemplate.execute(tx -> {
            InvoiceEntity invoice = findInvoice(invoiceUuid);
            requireReviewable(invoice);
            validate(request);

            VendorEntity vendor = vendorRepository.findById(request.getVendorUuid())
                    .orElseThrow(() -> new ResourceNotFoundException("Vendor not found: " + request.getVendorUuid()));
            PropertyEntity property = propertyRepository.findById(request.getPropertyUuid())
                    .orElseThrow(() -> new ResourceNotFoundException("Property not found: " + request.getPropertyUuid()));
            String accountNumber = request.getVendorAccountNumber().trim();

            PropertyVendorMappingEntity mapping = mappingRepository
                    .findByVendor_VendorIdAndProperty_PropertyId(vendor.getVendorId(), property.getPropertyId())
                    .orElse(null);
            boolean newMapping = mapping == null;
            if (newMapping) {
                mapping = mappingRepository.save(PropertyVendorMappingEntity.builder()
                        .mappingId(UUID.randomUUID())
                        .vendor(vendor)
                        .property(property)
                        .vendorAccountNumber(accountNumber)
                        .build());
            } else if (!ExtractionScorer.normalize(mapping.getVendorAccountNumber())
                    .equals(ExtractionScorer.normalize(accountNumber))) {
                // Paying against the wrong account is worse than stopping here
                throw new InvoiceConflictException("Account number " + accountNumber + " doesn't match the one on file for "
                        + vendor.getName() + " at " + property.getName() + " (" + mapping.getVendorAccountNumber() + ").");
            }

            String invoiceNumber = blankToNull(request.getVendorSuppliedInvoiceId());
            LocalDate periodEnd = request.getBillingPeriodEnd();
            if (invoiceNumber != null && periodEnd != null && invoiceRepository
                    .existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEndAndInvoiceIdNot(
                            mapping.getMappingId(), invoiceNumber, periodEnd, invoiceUuid)) {
                throw new InvoiceAlreadyExistsException(
                        "Invoice " + invoiceNumber + " for this billing period is already in the system.");
            }

            String fromStatus = invoice.getInvoiceStatus();
            String toStatus = InvoiceStatus.PENDING_APPROVAL.getValue();
            invoice.setMapping(mapping);
            invoice.setVendorSuppliedInvoiceId(invoiceNumber);
            invoice.setAmount(request.getAmount());
            invoice.setDueDate(request.getDueDate());
            invoice.setBillingPeriodStart(request.getBillingPeriodStart());
            invoice.setBillingPeriodEnd(periodEnd);
            invoice.setInvoiceCreationDate(request.getInvoiceCreationDate());
            invoice.setInvoiceStatus(toStatus);
            invoice.setFailureReason(null);
            invoice.setUpdatedAt(now());
            invoiceRepository.saveAndFlush(invoice);

            String notes = (request.getNotes() == null ? "" : request.getNotes())
                    + (newMapping
                    ? "\n\nCreated vendor/property link: " + vendor.getName() + " at " + property.getName()
                            + " (account " + accountNumber + ")"
                    : "");
            boolean corrected = Boolean.TRUE.equals(request.getAiValuesChanged());
            // TODO(auth): record the signed-in reviewer instead of the system user
            auditLogService.record(invoiceUuid, InvoiceUploadService.SYSTEM_USER_ID,
                    corrected ? ActionTypeEnum.USER_IDENTIFIED : ActionTypeEnum.USER_VALIDATED,
                    corrected ? "Reviewer corrected and confirmed invoice details" : "Reviewer confirmed invoice details",
                    fromStatus, toStatus, truncate(blankToNull(notes), AUDIT_NOTES_MAX));

            return invoiceService.getInvoice(invoiceUuid);
        });
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

    private static void validate(InvoiceVerifyRequest request) {
        if (request.getAmount().stripTrailingZeros().scale() > 2) {
            throw new InvalidInvoiceException("amount can have at most 2 decimal places.");
        }
        LocalDate start = request.getBillingPeriodStart();
        LocalDate end = request.getBillingPeriodEnd();
        if (start != null && end != null && start.isAfter(end)) {
            throw new InvalidInvoiceException("Billing period start must be on or before its end.");
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
}