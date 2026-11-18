package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck.IdEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationCheck.StatusEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceValidationResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InvoiceValidationServiceTest {

    private final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
    private final InvoiceValidationService service = new InvoiceValidationService(invoiceRepository);

    private PropertyVendorMappingEntity mapping;
    private InvoiceEntity invoice;

    @BeforeEach
    void setUp() {
        VendorEntity vendor = new VendorEntity();
        vendor.setVendorId(UUID.randomUUID());
        vendor.setName("Gasco");
        vendor.setStatus("ACTIVE");
        PropertyEntity property = new PropertyEntity();
        property.setPropertyId(UUID.randomUUID());
        property.setName("Oak Street Lofts");
        property.setStatus("ACTIVE");
        mapping = new PropertyVendorMappingEntity();
        mapping.setMappingId(UUID.randomUUID());
        mapping.setVendor(vendor);
        mapping.setProperty(property);
        mapping.setVendorAccountNumber("GC-048219");

        invoice = bill("GAS-2026-10482", "PENDING_APPROVAL");
        invoice.setAmount(new BigDecimal("230.00"));
        invoice.setDueDate(LocalDate.of(2026, 11, 25));
        when(invoiceRepository.findById(invoice.getInvoiceId())).thenReturn(Optional.of(invoice));
        others();
    }

    @Test
    void cleanLinkedBill_passesAllFour() {
        InvoiceValidationResponse result = service.validate(invoice.getInvoiceId());

        assertTrue(result.getPassed());
        assertEquals(4, result.getPassedCount());
        assertEquals(4, result.getTotalCount());
        assertEquals(List.of(IdEnum.PROPERTY, IdEnum.ACCOUNT, IdEnum.DUPLICATE, IdEnum.AMOUNT),
                result.getChecks().stream().map(InvoiceValidationCheck::getId).toList());
        result.getChecks().forEach(check -> assertNull(check.getDetail()));
    }

    @Test
    void inactiveProperty_fails() {
        mapping.getProperty().setStatus("INACTIVE");

        InvoiceValidationCheck check = check(IdEnum.PROPERTY);
        assertEquals(StatusEnum.FAILED, check.getStatus());
        assertEquals("Oak Street Lofts is inactive.", check.getDetail());
    }

    @Test
    void unmatchedBill_failsPropertyAndAccount_andCantCheckDuplicates() {
        invoice.setMapping(null);

        InvoiceValidationResponse result = service.validate(invoice.getInvoiceId());
        assertFalse(result.getPassed());
        assertEquals(1, result.getPassedCount()); // only the amount check
        assertEquals(StatusEnum.FAILED, check(IdEnum.PROPERTY).getStatus());
        assertEquals(StatusEnum.FAILED, check(IdEnum.ACCOUNT).getStatus());
        assertEquals(StatusEnum.UNKNOWN, check(IdEnum.DUPLICATE).getStatus());
    }

    @Test
    void inactiveVendor_failsTheAccountCheck() {
        mapping.getVendor().setStatus("INACTIVE");

        assertEquals("Gasco is inactive.", check(IdEnum.ACCOUNT).getDetail());
    }

    @Test
    void sameNumberOnTheSameLink_isADuplicate_ignoringCaseAndPunctuation() {
        others(bill("gas 2026 10482", "APPROVED"));

        InvoiceValidationCheck check = check(IdEnum.DUPLICATE);
        assertEquals(StatusEnum.FAILED, check.getStatus());
        assertEquals("Invoice GAS-2026-10482 is on file once more for Gasco at Oak Street Lofts.", check.getDetail());
    }

    @Test
    void rejectedBillsAndOtherNumbers_areNotDuplicates() {
        others(bill("GAS-2026-10482", "VOID"), bill("GAS-2026-09001", "PAID"));

        assertEquals(StatusEnum.PASSED, check(IdEnum.DUPLICATE).getStatus());
    }

    @Test
    void noInvoiceNumber_cantCheckDuplicates() {
        invoice.setVendorSuppliedInvoiceId(null);

        assertEquals(StatusEnum.UNKNOWN, check(IdEnum.DUPLICATE).getStatus());
    }

    @Test
    void missingAmountAndDueDate_fails() {
        invoice.setAmount(null);
        invoice.setDueDate(null);

        assertEquals("Missing amount and due date.", check(IdEnum.AMOUNT).getDetail());
    }

    @Test
    void validateAll_keepsTheRequestedOrder_skipsUnknownIds_andLooksUpEachMappingOnce() {
        InvoiceEntity second = bill("GAS-2026-10999", "PENDING_APPROVAL");
        second.setAmount(new BigDecimal("12.00"));
        second.setDueDate(LocalDate.of(2026, 12, 1));
        others(second);
        UUID unknown = UUID.randomUUID();
        when(invoiceRepository.findAllById(List.of(second.getInvoiceId(), unknown, invoice.getInvoiceId())))
                .thenReturn(List.of(invoice, second));

        List<InvoiceValidationResponse> results =
                service.validateAll(List.of(second.getInvoiceId(), unknown, invoice.getInvoiceId()));

        assertEquals(List.of(second.getInvoiceId(), invoice.getInvoiceId()),
                results.stream().map(InvoiceValidationResponse::getInvoiceUuid).toList());
        results.forEach(result -> assertTrue(result.getPassed()));
        org.mockito.Mockito.verify(invoiceRepository, org.mockito.Mockito.times(1))
                .findByMapping_MappingId(mapping.getMappingId());
    }

    @Test
    void unknownInvoice_isNotFound() {
        UUID missing = UUID.randomUUID();
        when(invoiceRepository.findById(missing)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.validate(missing));
    }

    private InvoiceValidationCheck check(IdEnum id) {
        return service.validate(invoice.getInvoiceId()).getChecks().stream()
                .filter(check -> check.getId() == id).findFirst().orElseThrow();
    }

    private InvoiceEntity bill(String number, String status) {
        InvoiceEntity bill = new InvoiceEntity();
        bill.setInvoiceId(UUID.randomUUID());
        bill.setMapping(mapping);
        bill.setVendorSuppliedInvoiceId(number);
        bill.setInvoiceStatus(status);
        return bill;
    }

    // The bills on the mapping: the invoice itself plus these
    private void others(InvoiceEntity... bills) {
        List<InvoiceEntity> onMapping = new java.util.ArrayList<>(List.of(bills));
        onMapping.add(invoice);
        when(invoiceRepository.findByMapping_MappingId(mapping.getMappingId())).thenReturn(onMapping);
    }
}
