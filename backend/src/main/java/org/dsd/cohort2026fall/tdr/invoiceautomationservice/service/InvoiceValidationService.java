package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import lombok.RequiredArgsConstructor;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck.IdEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck.StatusEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * The checks shown to the approver on the Approvals page. They only inform the decision:
 * nothing is blocked or changed when one fails, a person decides what to do about it.
 */
@Service
@RequiredArgsConstructor
public class InvoiceValidationService {

    private static final String ACTIVE = "ACTIVE";

    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    public InvoiceValidationResponse validate(UUID invoiceUuid) {
        InvoiceEntity invoice = invoiceRepository.findById(invoiceUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceUuid));
        return validate(invoice, new HashMap<>());
    }

    /** The same checks for several invoices, in the order asked for; unknown ids are left out. */
    @Transactional(readOnly = true)
    public List<InvoiceValidationResponse> validateAll(List<UUID> invoiceUuids) {
        Map<UUID, InvoiceEntity> found = new HashMap<>();
        invoiceRepository.findAllById(invoiceUuids).forEach(invoice -> found.put(invoice.getInvoiceId(), invoice));
        // Bills on the same vendor + property share one lookup of the other bills there
        Map<UUID, List<InvoiceEntity>> billsByMapping = new HashMap<>();
        return invoiceUuids.stream().distinct()
                .map(found::get)
                .filter(Objects::nonNull)
                .map(invoice -> validate(invoice, billsByMapping))
                .toList();
    }

    private InvoiceValidationResponse validate(InvoiceEntity invoice, Map<UUID, List<InvoiceEntity>> billsByMapping) {
        List<InvoiceValidationCheck> checks = List.of(
                propertyCheck(invoice.getMapping()),
                accountCheck(invoice.getMapping()),
                duplicateCheck(invoice, billsByMapping),
                amountCheck(invoice));
        int passed = (int) checks.stream().filter(check -> check.getStatus() == StatusEnum.PASSED).count();
        return new InvoiceValidationResponse(invoice.getInvoiceId(), passed == checks.size(), passed, checks.size(), checks);
    }

    // The property is reached through the vendor + property link
    private static InvoiceValidationCheck propertyCheck(PropertyVendorMappingEntity mapping) {
        PropertyEntity property = mapping == null ? null : mapping.getProperty();
        if (property == null) return failed(IdEnum.PROPERTY, "active property", "Not matched to a property.");
        if (!ACTIVE.equals(property.getStatus())) {
            return failed(IdEnum.PROPERTY, "active property",
                    property.getName() + " is " + String.valueOf(property.getStatus()).toLowerCase(Locale.ROOT) + ".");
        }
        return passed(IdEnum.PROPERTY, "active property");
    }

    // The bill's account number is the one on its vendor + property link, so a linked bill has a
    // verified account. The vendor must still be active.
    private static InvoiceValidationCheck accountCheck(PropertyVendorMappingEntity mapping) {
        if (mapping == null || isBlank(mapping.getVendorAccountNumber()) || mapping.getVendor() == null) {
            return failed(IdEnum.ACCOUNT, "verified account", "No account on file for this vendor and property.");
        }
        VendorEntity vendor = mapping.getVendor();
        if (!ACTIVE.equals(vendor.getStatus())) {
            return failed(IdEnum.ACCOUNT, "verified account", vendor.getName() + " is inactive.");
        }
        return passed(IdEnum.ACCOUNT, "verified account");
    }

    // Same invoice number (ignoring case, spaces and punctuation) on the same vendor + property.
    // Rejected (VOID) bills don't count.
    private InvoiceValidationCheck duplicateCheck(InvoiceEntity invoice, Map<UUID, List<InvoiceEntity>> billsByMapping) {
        String label = "no duplicate invoice";
        String number = ExtractionScorer.normalize(invoice.getVendorSuppliedInvoiceId());
        if (number.isEmpty()) return unknown(IdEnum.DUPLICATE, label, "No invoice number to compare.");
        PropertyVendorMappingEntity mapping = invoice.getMapping();
        if (mapping == null) return unknown(IdEnum.DUPLICATE, label, "Not linked to a vendor and property yet.");

        List<InvoiceEntity> onMapping = billsByMapping.computeIfAbsent(mapping.getMappingId(),
                invoiceRepository::findByMapping_MappingId);
        long duplicates = onMapping.stream()
                .filter(other -> !other.getInvoiceId().equals(invoice.getInvoiceId()))
                .filter(other -> !InvoiceStatus.VOID.getValue().equals(other.getInvoiceStatus()))
                .filter(other -> number.equals(ExtractionScorer.normalize(other.getVendorSuppliedInvoiceId())))
                .count();
        if (duplicates == 0) return passed(IdEnum.DUPLICATE, label);
        return failed(IdEnum.DUPLICATE, label, "Invoice " + invoice.getVendorSuppliedInvoiceId() + " is on file "
                + (duplicates == 1 ? "once more" : duplicates + " more times") + " for " + label(mapping) + ".");
    }

    // Stands in for "line items match total": bills don't have itemized charges yet
    private static InvoiceValidationCheck amountCheck(InvoiceEntity invoice) {
        List<String> missing = new ArrayList<>();
        if (invoice.getAmount() == null) missing.add("amount");
        if (invoice.getDueDate() == null) missing.add("due date");
        return missing.isEmpty()
                ? passed(IdEnum.AMOUNT, "amount and due date set")
                : failed(IdEnum.AMOUNT, "amount and due date set", "Missing " + String.join(" and ", missing) + ".");
    }

    // ---- helpers ------------------------------------------------------------

    private static InvoiceValidationCheck passed(IdEnum id, String label) {
        return new InvoiceValidationCheck(id, label, StatusEnum.PASSED);
    }

    private static InvoiceValidationCheck failed(IdEnum id, String label, String detail) {
        InvoiceValidationCheck check = new InvoiceValidationCheck(id, label, StatusEnum.FAILED);
        check.setDetail(detail);
        return check;
    }

    private static InvoiceValidationCheck unknown(IdEnum id, String label, String detail) {
        InvoiceValidationCheck check = new InvoiceValidationCheck(id, label, StatusEnum.UNKNOWN);
        check.setDetail(detail);
        return check;
    }

    private static String label(PropertyVendorMappingEntity mapping) {
        String vendor = mapping.getVendor() == null ? null : mapping.getVendor().getName();
        String property = mapping.getProperty() == null ? null : mapping.getProperty().getName();
        if (vendor == null || property == null) return "this vendor and property";
        return vendor + " at " + property;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
