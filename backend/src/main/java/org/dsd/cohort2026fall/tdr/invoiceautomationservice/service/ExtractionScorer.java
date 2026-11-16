package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.ExtractedField;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.ExtractedField.LevelEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceExtractedFields;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * Sets each extracted field's confidence from checks against our own data (vendors,
 * properties, account numbers, past bills), not from the AI's opinion of itself.
 * The AI's confidence only means "how clearly was it printed", and can only lower a level.
 */
@Component
@RequiredArgsConstructor
public class ExtractionScorer {

    // Below this, the AI is telling us the text was smudged, cut off or ambiguous
    private static final double AI_CLEAR = 0.8;
    // An amount more than 50% away from the recent average gets flagged
    private static final BigDecimal UNUSUAL_CHANGE = new BigDecimal("0.50");
    private static final long LONG_PERIOD_DAYS = 93;

    private final PropertyVendorMappingRepository mappingRepository;
    private final VendorRepository vendorRepository;
    private final PropertyRepository propertyRepository;
    private final InvoiceRepository invoiceRepository;

    public record Result(InvoiceExtractedFields fields, UUID vendorUuid, UUID propertyUuid, UUID mappingUuid) {}

    // One value as the AI read it, before scoring
    private record Raw(String value, double aiConfidence) {}

    public Result score(JsonNode values, UUID invoiceUuid) {
        Raw vendorName = raw(values, "vendor_name");
        Raw vendorPhone = raw(values, "vendor_phone");
        Raw address = raw(values, "property_address");
        Raw propertyName = raw(values, "property_name");
        Raw account = raw(values, "account_number");
        Raw invoiceNumber = raw(values, "invoice_number");
        Raw amount = raw(values, "total_amount_due");
        Raw dueDate = raw(values, "payment_due_date");
        Raw periodStart = raw(values, "billing_period_start");
        Raw periodEnd = raw(values, "billing_period_end");
        Raw issued = raw(values, "invoice_issued_date");

        // An account number belongs to exactly one vendor + property link
        List<PropertyVendorMappingEntity> accountHits = account.value() == null ? List.of()
                : mappingRepository.findAll().stream()
                  .filter(m -> normalize(m.getVendorAccountNumber()).equals(normalize(account.value())))
                  .toList();
        PropertyVendorMappingEntity byAccount = accountHits.size() == 1 ? accountHits.getFirst() : null;

        List<VendorEntity> vendors = vendorRepository.findAll();
        VendorEntity byName = vendorByName(vendors, vendorName.value());
        VendorEntity byPhone = vendorByPhone(vendors, vendorPhone.value());
        
        List<PropertyEntity> properties = propertyRepository.findAll();
        PropertyEntity byAddress = propertyByAddress(properties, address.value());
        PropertyEntity byPropertyName = propertyByName(properties, propertyName.value());

        VendorEntity vendor = byAccount != null ? byAccount.getVendor() : byName != null ? byName : byPhone;
        PropertyEntity property = byAccount != null ? byAccount.getProperty()
                : byAddress != null ? byAddress : byPropertyName;
        PropertyVendorMappingEntity mapping = byAccount != null ? byAccount
                : vendor == null || property == null ? null
                  : mappingRepository.findByVendor_VendorIdAndProperty_PropertyId(vendor.getVendorId(), property.getPropertyId())
                    .orElse(null);

        // Past bills on the same link, newest first
        List<InvoiceEntity> history = mapping == null ? List.of()
                : invoiceRepository.findTop6ByMapping_MappingIdAndInvoiceIdNotOrderByCreatedAtDesc(mapping.getMappingId(), invoiceUuid);

        LocalDate start = date(periodStart.value());
        LocalDate end = date(periodEnd.value());
        LocalDate issuedOn = date(issued.value());

        InvoiceExtractedFields fields = new InvoiceExtractedFields();
        fields.setVendorAccountNumber(scoreAccount(account, accountHits, mapping));
        fields.setVendorName(scoreVendor(vendorName, byAccount, byName, byPhone));
        fields.setPropertyAddress(scorePropertyAddress(address, byAccount, byAddress));
        fields.setPropertyName(scorePropertyName(propertyName, byAccount, byPropertyName));
        fields.setVendorSuppliedInvoiceId(scoreInvoiceNumber(invoiceNumber, mapping, invoiceUuid));
        fields.setAmount(scoreAmount(amount, mapping, history));
        fields.setDueDate(scoreDueDate(dueDate, issuedOn));
        fields.setBillingPeriodStart(scorePeriodStart(periodStart, start, end, history));
        fields.setBillingPeriodEnd(scorePeriodEnd(periodEnd, start, end));
        fields.setInvoiceCreationDate(scoreIssued(issued, issuedOn));

        return new Result(fields,
                vendor == null ? null : vendor.getVendorId(),
                property == null ? null : property.getPropertyId(),
                mapping == null ? null : mapping.getMappingId());
    }

    // ---- per-field rules --------------------------------------------------

    private ExtractedField scoreAccount(Raw account, List<PropertyVendorMappingEntity> hits, PropertyVendorMappingEntity mapping) {
        if (account.value() == null) return notFound("No account number found on the bill");
        if (hits.size() == 1) return verified(account, "On file for " + label(hits.getFirst()));
        if (hits.size() > 1) return medium(account, "On file for more than one vendor/property; check which one this bill is for");
        if (mapping != null) {
            return low(account, "Doesn't match " + mapping.getVendorAccountNumber() + ", the account on file for " + label(mapping));
        }
        return medium(account, "Not on file yet; confirming creates a new vendor/property link");
    }

    private ExtractedField scoreVendor(Raw name, PropertyVendorMappingEntity byAccount, VendorEntity byName, VendorEntity byPhone) {
        if (name.value() == null && byPhone == null) return notFound("No vendor name found on the bill");
        if (byAccount != null) {
            VendorEntity onFile = byAccount.getVendor();
            if (byName != null && !same(byName, onFile)) {
                return low(name, "The bill names " + byName.getName() + ", but the account belongs to " + onFile.getName());
            }
            return verified(name, "The account number belongs to " + onFile.getName()
                    + (same(byName, onFile) ? ", and the name matches" : ""));
        }
        if (byName != null && byPhone != null) {
            return same(byName, byPhone)
                    ? verified(name, "Name and phone number match " + byName.getName())
                    : low(name, "Name matches " + byName.getName() + ", but the phone number matches " + byPhone.getName());
        }
        if (byName != null) return medium(name, "Name matches " + byName.getName() + "; no account or phone match to back it up");
        if (byPhone != null) return medium(name, "Phone number matches " + byPhone.getName() + ", but the name doesn't");
        return low(name, "No vendor in your list matches; add it on the Vendors page");
    }

    private ExtractedField scorePropertyAddress(Raw address, PropertyVendorMappingEntity byAccount, PropertyEntity byAddress) {        if (address.value() == null) return notFound("No service address found on the bill");
        if (byAccount != null) {
            PropertyEntity onFile = byAccount.getProperty();
            // Check the account's own property first: other properties can share a street address
            if (containsStreet(address.value(), onFile)) {
                return verified(address, "Matches " + onFile.getName() + ", the property on this account");
            }
            if (byAddress != null) {
                return low(address, "The address matches " + byAddress.getName() + ", but the account belongs to " + onFile.getName());
            }
            return medium(address, "The account belongs to " + onFile.getName()
                    + ", but the address doesn't match its street address (" + onFile.getStreetAddress() + ")");
        }
        if (byAddress != null) return medium(address, "Address matches " + byAddress.getName() + "; no account match to back it up");
        return low(address, "No property in your list matches");
    }

    private ExtractedField scorePropertyName(Raw name, PropertyVendorMappingEntity byAccount, PropertyEntity byName) {
        if (name.value() == null) return notFound("No property name on the bill");
        if (byAccount != null) {
            PropertyEntity onFile = byAccount.getProperty();
            if (normalize(name.value()).equals(normalize(onFile.getName()))) {
                return verified(name, "Matches " + onFile.getName() + ", the property on this account");
            }
            if (byName != null) {
                return low(name, "Names " + byName.getName() + ", but the account belongs to " + onFile.getName());
            }
            return medium(name, "Doesn't match " + onFile.getName() + ", the property on this account");
        }
        if (byName != null) return medium(name, "Matches " + byName.getName() + "; no account match to back it up");
        return low(name, "No property in your list has this name");
    }

    private ExtractedField scoreInvoiceNumber(Raw number, PropertyVendorMappingEntity mapping, UUID invoiceUuid) {
        if (number.value() == null) return notFound("No invoice number found on the bill");
        if (mapping != null && invoiceRepository.existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndInvoiceIdNot(
                mapping.getMappingId(), number.value(), invoiceUuid)) {
            return low(number, "Invoice " + number.value() + " is already on file for " + label(mapping));
        }
        return plausible(number, mapping != null ? "Not a duplicate of a bill on file" : "Nothing on file to compare");
    }

    private ExtractedField scoreAmount(Raw amount, PropertyVendorMappingEntity mapping, List<InvoiceEntity> history) {
        if (amount.value() == null) return notFound("No total amount found on the bill");
        BigDecimal value = decimal(amount.value());
        if (value == null) return low(amount, "Not a valid amount");
        if (mapping == null) return medium(amount, "No vendor/property match, so no past bills to compare");

        List<BigDecimal> past = history.stream().map(InvoiceEntity::getAmount).filter(Objects::nonNull).toList();
        if (past.isEmpty()) return medium(amount, "First bill for " + label(mapping) + "; nothing to compare");

        BigDecimal average = past.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(past.size()), 2, RoundingMode.HALF_UP);
        if (average.signum() == 0) return medium(amount, "Past bills average $0.00");
        BigDecimal change = value.subtract(average).abs().divide(average.abs(), 2, RoundingMode.HALF_UP);
        String avg = "$" + average.toPlainString();
        return change.compareTo(UNUSUAL_CHANGE) <= 0
                ? plausible(amount, "In line with recent bills (average " + avg + ")")
                : medium(amount, "Unusual: recent bills for " + label(mapping) + " average " + avg);
    }

    private ExtractedField scoreDueDate(Raw due, LocalDate issuedOn) {
        if (due.value() == null) return notFound("No due date found on the bill");
        LocalDate date = date(due.value());
        if (date == null) return low(due, "Not a valid date");
        if (issuedOn != null && date.isBefore(issuedOn)) return low(due, "Falls before the invoice date (" + issuedOn + ")");
        return plausible(due, issuedOn != null ? "Valid date, after the invoice date" : "Valid date");
    }

    private ExtractedField scorePeriodStart(Raw raw, LocalDate start, LocalDate end, List<InvoiceEntity> history) {
        if (raw.value() == null) return notFound("No billing period found on the bill");
        if (start == null) return low(raw, "Not a valid date");
        if (end != null && start.isAfter(end)) return low(raw, "Falls after the period end");

        LocalDate lastEnd = history.stream().map(InvoiceEntity::getBillingPeriodEnd)
                .filter(Objects::nonNull).findFirst().orElse(null);
        if (lastEnd != null) {
            long gap = ChronoUnit.DAYS.between(lastEnd, start);
            // Bills usually start the day after (or the same day) the last one ended
            return gap == 0 || gap == 1
                    ? verified(raw, "Picks up where the last bill ended (" + lastEnd + ")")
                    : medium(raw, "The last bill ended " + lastEnd + "; this doesn't pick up from there");
        }
        if (end != null && ChronoUnit.DAYS.between(start, end) > LONG_PERIOD_DAYS) {
            return medium(raw, "Unusually long billing period");
        }
        return plausible(raw, "Valid date");
    }

    private ExtractedField scorePeriodEnd(Raw raw, LocalDate start, LocalDate end) {
        if (raw.value() == null) return notFound("No billing period found on the bill");
        if (end == null) return low(raw, "Not a valid date");
        if (start != null && start.isAfter(end)) return low(raw, "Falls before the period start");
        if (start != null && ChronoUnit.DAYS.between(start, end) > LONG_PERIOD_DAYS) {
            return medium(raw, "Unusually long billing period");
        }
        return plausible(raw, "Valid date");
    }

    private ExtractedField scoreIssued(Raw raw, LocalDate issuedOn) {
        if (raw.value() == null) return notFound("No invoice date found on the bill");
        if (issuedOn == null) return low(raw, "Not a valid date");
        return plausible(raw, "Valid date");
    }

    // ---- matching against our tables ---------------------------------------

    private static VendorEntity vendorByName(List<VendorEntity> vendors, String name) {
        String wanted = normalize(name);
        if (wanted.isEmpty()) return null;
        VendorEntity exact = only(vendors.stream().filter(v -> normalize(v.getName()).equals(wanted)).toList());
        if (exact != null) return exact;
        // "City Water" on file vs "City Water Utility" on the bill, or the other way round
        return only(vendors.stream().filter(v -> {
            String n = normalize(v.getName());
            return !n.isEmpty() && (n.contains(wanted) || wanted.contains(n));
        }).toList());
    }

    private static VendorEntity vendorByPhone(List<VendorEntity> vendors, String phone) {
        String wanted = lastDigits(phone);
        if (wanted.length() < 7) return null; // too short to tell vendors apart
        return only(vendors.stream().filter(v -> lastDigits(v.getPhoneNumber()).equals(wanted)).toList());
    }

    private static PropertyEntity propertyByAddress(List<PropertyEntity> properties, String address) {
        String wanted = normalize(address);
        if (wanted.isEmpty()) return null;
        // The bill's address usually includes city/state/zip, so look for the street inside it
        return only(properties.stream().filter(p -> {
            return containsStreet(address, p);
        }).toList());
    }

    // The bill's address usually includes city/state/zip, so look for the street inside it
    private static boolean containsStreet(String address, PropertyEntity property) {
        String street = normalize(property.getStreetAddress());
        return !street.isEmpty() && normalize(address).contains(street);
    }

    private static PropertyEntity propertyByName(List<PropertyEntity> properties, String name) {
        String wanted = normalize(name);
        if (wanted.isEmpty()) return null;
        return only(properties.stream().filter(p -> normalize(p.getName()).equals(wanted)).toList());
    }

    // ---- building fields ----------------------------------------------------

    private static ExtractedField field(Raw raw, LevelEnum level, String reason) {
        ExtractedField field = new ExtractedField();
        field.setValue(raw.value());
        field.setConfidence(raw.aiConfidence());
        field.setLevel(level);
        field.setReason(reason);
        return field;
    }

    private static ExtractedField notFound(String reason) {
        return field(new Raw(null, 0.0), LevelEnum.NOT_FOUND, reason);
    }

    // Confirmed against our own data, so how clearly the AI read it doesn't matter
    private static ExtractedField verified(Raw raw, String reason) {
        return field(raw, LevelEnum.HIGH, reason);
    }

    // Passed our checks, but only the AI saw it: trust it only if the AI read it clearly
    private static ExtractedField plausible(Raw raw, String reason) {
        return raw.aiConfidence() >= AI_CLEAR
                ? field(raw, LevelEnum.HIGH, reason)
                : field(raw, LevelEnum.MEDIUM, reason + "; the AI flagged it as hard to read");
    }

    private static ExtractedField medium(Raw raw, String reason) {
        return field(raw, LevelEnum.MEDIUM, reason);
    }

    private static ExtractedField low(Raw raw, String reason) {
        return field(raw, LevelEnum.LOW, reason);
    }

    // ---- helpers ------------------------------------------------------------

    private static Raw raw(JsonNode values, String name) {
        JsonNode node = values.path(name);
        JsonNode value = node.path("value");
        String text = value.isNumber() ? value.decimalValue().toPlainString() : text(value);
        double confidence = node.path("confidence").asDouble(0.0);
        return new Raw(text, text == null ? 0.0 : Math.max(0.0, Math.min(1.0, confidence)));
    }

    static String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return null;
        String s = node.asText().strip();
        return s.isEmpty() || s.equalsIgnoreCase("null") ? null : s;
    }

    private static LocalDate date(String value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static BigDecimal decimal(String value) {
        try {
            BigDecimal amount = new BigDecimal(value.replaceAll("[$,\\s]", ""));
            return amount.stripTrailingZeros().scale() > 2 ? null : amount;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String label(PropertyVendorMappingEntity mapping) {
        return mapping.getVendor().getName() + " at " + mapping.getProperty().getName();
    }

    private static boolean same(VendorEntity a, VendorEntity b) {
        return a != null && b != null && a.getVendorId().equals(b.getVendorId());
    }

    // Last 10 digits, so "+1 (555) 019-2000" and "555-019-2000" compare equal
    private static String lastDigits(String phone) {
        String digits = phone == null ? "" : phone.replaceAll("\\D", "");
        return digits.length() > 10 ? digits.substring(digits.length() - 10) : digits;
    }

    static String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private static <T> T only(List<T> list) {
        return list.size() == 1 ? list.getFirst() : null;
    }
}