package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InvoiceServiceTest {

    private final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
    private final PropertyVendorMappingRepository mappingRepository = mock(PropertyVendorMappingRepository.class);
    private final InvoiceTransitionService transitionService = mock(InvoiceTransitionService.class);
    private final InvoiceAnalysisService invoiceAnalysisService = mock(InvoiceAnalysisService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final InvoiceService invoiceService = new InvoiceService(
            invoiceRepository, mappingRepository, transitionService, invoiceAnalysisService, auditLogService);
    private final UUID mappingUuid = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        PropertyVendorMappingEntity mapping = new PropertyVendorMappingEntity();
        mapping.setMappingId(mappingUuid);
        when(mappingRepository.findById(mappingUuid)).thenReturn(Optional.of(mapping));
        when(invoiceRepository.existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEnd(
                mappingUuid, "INV-100", LocalDate.of(2026, 10, 31))).thenReturn(false);
        when(invoiceRepository.save(any(InvoiceEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createInvoice_defaultsStatusAndPreservesExactAmount() {
        InvoiceCreateRequest request = new InvoiceCreateRequest(mappingUuid);
        request.setVendorSuppliedInvoiceId("INV-100");
        request.setBillingPeriodStart(LocalDate.of(2026, 10, 1));
        request.setBillingPeriodEnd(LocalDate.of(2026, 10, 31));
        request.setAmount(new BigDecimal("1250.40"));

        var response = invoiceService.createInvoice(request);

        assertEquals(InvoiceStatus.INGESTED, response.getInvoiceStatus());
        assertEquals(new BigDecimal("1250.40"), response.getAmount());
        assertEquals(mappingUuid, response.getMappingUuid());
        verify(invoiceRepository).save(any(InvoiceEntity.class));
    }

    @Test
    void createInvoice_rejectsDuplicateForSameMappingAndPeriod() {
        when(invoiceRepository.existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEnd(
                mappingUuid, "INV-100", LocalDate.of(2026, 10, 31))).thenReturn(true);
        InvoiceCreateRequest request = new InvoiceCreateRequest(mappingUuid);
        request.setVendorSuppliedInvoiceId("INV-100");
        request.setBillingPeriodEnd(LocalDate.of(2026, 10, 31));

        assertThrows(InvoiceAlreadyExistsException.class, () -> invoiceService.createInvoice(request));
        verify(invoiceRepository, never()).save(any(InvoiceEntity.class));
    }

    @Test
    void createInvoice_rejectsInvalidBillingPeriod() {
        InvoiceCreateRequest request = new InvoiceCreateRequest(mappingUuid);
        request.setBillingPeriodStart(LocalDate.of(2026, 11, 1));
        request.setBillingPeriodEnd(LocalDate.of(2026, 10, 31));

        assertThrows(InvalidInvoiceException.class, () -> invoiceService.createInvoice(request));
        verify(invoiceRepository, never()).save(any(InvoiceEntity.class));
    }

    @Test
    void createInvoice_rejectsAmountWithMoreThanTwoDecimalPlaces() {
        InvoiceCreateRequest request = new InvoiceCreateRequest(mappingUuid);
        request.setAmount(new BigDecimal("10.001"));

        assertThrows(InvalidInvoiceException.class, () -> invoiceService.createInvoice(request));
        verify(invoiceRepository, never()).save(any(InvoiceEntity.class));
    }

    @Test
    void getInvoices_returnsUnmappedUploadWithoutVendorOrProperty() {
        InvoiceEntity upload = new InvoiceEntity();
        upload.setInvoiceId(UUID.randomUUID());
        upload.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());
        upload.setOriginalFilename("northline-bill.pdf");
        when(invoiceRepository.findAll(ArgumentMatchers.<Specification<InvoiceEntity>>any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(upload), PageRequest.of(0, 20), 1));

        InvoicePageResponse page = invoiceService.getInvoices(0, 20, null, null);

        var item = page.getItems().get(0);
        assertNull(item.getMappingUuid());
        assertNull(item.getVendorName());
        assertNull(item.getPropertyName());
        assertEquals("northline-bill.pdf", item.getOriginalFilename());
    }

    @Test
    void getInvoices_includesVendorAndPropertyForMappedInvoice() {
        VendorEntity vendor = new VendorEntity();
        vendor.setVendorId(UUID.randomUUID());
        vendor.setName("Northline Electric");
        PropertyEntity property = new PropertyEntity();
        property.setPropertyId(UUID.randomUUID());
        property.setName("Industrial Business Park");
        PropertyVendorMappingEntity mapping = new PropertyVendorMappingEntity();
        mapping.setMappingId(mappingUuid);
        mapping.setVendor(vendor);
        mapping.setProperty(property);
        mapping.setVendorAccountNumber("2000456700");

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(UUID.randomUUID());
        invoice.setMapping(mapping);
        invoice.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL.getValue());
        when(invoiceRepository.findAll(ArgumentMatchers.<Specification<InvoiceEntity>>any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(invoice), PageRequest.of(0, 20), 1));

        var item = invoiceService.getInvoices(0, 20, List.of(InvoiceStatus.PENDING_APPROVAL), "north")
                 .getItems().get(0);

        assertEquals(mappingUuid, item.getMappingUuid());
        assertEquals("Northline Electric", item.getVendorName());
        assertEquals("2000456700", item.getVendorAccountNumber());
        assertEquals("Industrial Business Park", item.getPropertyName());
   }

   @Test
   void getSummary_countsEachDashboardGroup() {
       OffsetDateTime since = OffsetDateTime.parse("2026-11-09T06:00:00Z");
       when(invoiceRepository.countByInvoiceStatusIn(InvoiceService.PENDING_STATUSES)).thenReturn(24L);
       when(invoiceRepository.countDistinctPropertiesByInvoiceStatusIn(InvoiceService.PENDING_STATUSES)).thenReturn(8L);
       when(invoiceRepository.countByInvoiceStatus(anyString())).thenReturn(0L);
       when(invoiceRepository.countByInvoiceStatus("PENDING_MAPPING")).thenReturn(7L);
       when(invoiceRepository.countByInvoiceStatus("PENDING_APPROVAL")).thenReturn(5L);
       when(invoiceRepository.countByInvoiceStatus("FAILED")).thenReturn(2L);
       when(invoiceRepository.countByInvoiceStatusAndCreatedAtGreaterThanEqual("PENDING_MAPPING", since)).thenReturn(3L);
       when(invoiceRepository.sumAmountByInvoiceStatus("PENDING_APPROVAL")).thenReturn(new BigDecimal("18642.00"));

       InvoiceSummaryResponse summary = invoiceService.getSummary(since);

       assertEquals(24L, summary.getPendingCount());
       assertEquals(8L, summary.getPendingPropertyCount());
       assertEquals(7L, summary.getNeedsReviewCount());
       assertEquals(3L, summary.getNeedsReviewReceivedSince());
       assertEquals(5L, summary.getAwaitingApprovalCount());
       assertEquals(new BigDecimal("18642.00"), summary.getAwaitingApprovalTotal());
       assertEquals(2L, summary.getExceptionsCount());
   }

   @Test
   void getSummary_withoutReceivedSince_reportsZeroReceivedToday() {
       when(invoiceRepository.sumAmountByInvoiceStatus(anyString())).thenReturn(BigDecimal.ZERO);

       InvoiceSummaryResponse summary = invoiceService.getSummary(null);

       assertEquals(0L, summary.getNeedsReviewReceivedSince());
       verify(invoiceRepository, never()).countByInvoiceStatusAndCreatedAtGreaterThanEqual(anyString(), any());
    }

    // ---------- create: status ----------

    @Test
    void createInvoice_withNonIngestedStatus_isRejected() {
        InvoiceCreateRequest request = new InvoiceCreateRequest(mappingUuid);
        request.setInvoiceStatus(InvoiceStatus.PAID);

        var ex = assertThrows(org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException.class,
                () -> invoiceService.createInvoice(request));

        assertEquals("New invoices must start as INGESTED", ex.getMessage());
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    void createInvoice_withNullStatus_startsIngested() {
        var response = invoiceService.createInvoice(new InvoiceCreateRequest(mappingUuid));

        assertEquals(InvoiceStatus.INGESTED, response.getInvoiceStatus());
    }

    // ---------- update: status and locks ----------

    private InvoiceEntity storedInvoice(InvoiceStatus status, String amount) {
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(UUID.randomUUID());
        invoice.setInvoiceStatus(status.getValue());
        invoice.setAmount(new BigDecimal(amount));
        PropertyVendorMappingEntity mapping = new PropertyVendorMappingEntity();
        mapping.setMappingId(mappingUuid);
        invoice.setMapping(mapping);
        when(invoiceRepository.findByIdForUpdate(invoice.getInvoiceId())).thenReturn(Optional.of(invoice));
        return invoice;
    }

    @Test
    void updateInvoice_statusChange_delegatesToTransitionService() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.PENDING_APPROVAL, "100.00");
        UUID actor = UUID.randomUUID();
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setInvoiceStatus(InvoiceStatus.APPROVED);
        request.setActedBy(actor);

        invoiceService.updateInvoice(invoice.getInvoiceId(), request);

        verify(transitionService).transition(invoice.getInvoiceId(), InvoiceStatus.APPROVED, actor, null);
    }

    @Test
    void updateInvoice_illegalTransition_propagates() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.PAID, "100.00");
        when(transitionService.transition(any(), any(), any(), any()))
                .thenThrow(new org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvalidStatusTransitionException(
                        InvoiceStatus.PAID, InvoiceStatus.PENDING_APPROVAL));
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL);

        assertThrows(org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvalidStatusTransitionException.class,
                () -> invoiceService.updateInvoice(invoice.getInvoiceId(), request));
    }

    @Test
    void updateInvoice_amountChangeOnLockedStatuses_isRejected() {
        for (InvoiceStatus locked : List.of(InvoiceStatus.APPROVED, InvoiceStatus.PROCESSING_PAYMENT,
                InvoiceStatus.PAID, InvoiceStatus.VOID)) {
            InvoiceEntity invoice = storedInvoice(locked, "100.00");
            var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
            request.setAmount(new BigDecimal("999.00"));

            assertThrows(org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceLockedException.class,
                    () -> invoiceService.updateInvoice(invoice.getInvoiceId(), request), locked.toString());
        }
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    void updateInvoice_mappingChangeOnApprovedInvoice_isRejected() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.APPROVED, "100.00");
        UUID otherMapping = UUID.randomUUID();
        PropertyVendorMappingEntity other = new PropertyVendorMappingEntity();
        other.setMappingId(otherMapping);
        when(mappingRepository.findById(otherMapping)).thenReturn(Optional.of(other));
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setMappingUuid(otherMapping);

        assertThrows(org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvoiceLockedException.class,
                () -> invoiceService.updateInvoice(invoice.getInvoiceId(), request));
        verify(invoiceRepository, never()).save(any());
    }

    @Test
    void updateInvoice_sameAmountOnApprovedInvoice_isAllowed() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.APPROVED, "100.00");
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setAmount(new BigDecimal("100.00"));

        invoiceService.updateInvoice(invoice.getInvoiceId(), request);

        verify(invoiceRepository).save(invoice);
    }

    @Test
    void updateInvoice_amountChangeOnPendingApproval_isAllowed() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.PENDING_APPROVAL, "100.00");
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setAmount(new BigDecimal("250.00"));

        invoiceService.updateInvoice(invoice.getInvoiceId(), request);

        assertEquals(new BigDecimal("250.00"), invoice.getAmount());
    }

    @Test
    void updateInvoice_noStatusInRequest_doesNotCallTransitionService() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.PENDING_APPROVAL, "100.00");
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setAmount(new BigDecimal("101.00"));

        invoiceService.updateInvoice(invoice.getInvoiceId(), request);

        verify(transitionService, never()).transition(any(), any(), any(), any());
    }

    @Test
    void updateInvoice_unmappedInvoice_canChangeStatus() {
        InvoiceEntity invoice = storedInvoice(InvoiceStatus.INGESTED, "100.00");
        invoice.setMapping(null);
        var request = new org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceUpdateRequest();
        request.setInvoiceStatus(InvoiceStatus.PENDING_MAPPING);

        invoiceService.updateInvoice(invoice.getInvoiceId(), request);

        verify(transitionService).transition(invoice.getInvoiceId(), InvoiceStatus.PENDING_MAPPING, null, null);
    }

    @Test
    void analyzeInvoice_lockedInvoice_throwsInvoiceLockedException() {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.APPROVED.getValue());
        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));

        assertThrows(InvoiceLockedException.class, () -> invoiceService.analyzeInvoice(invoiceId));
    }

    @Test
    void analyzeInvoice_noData_throwsInvoiceNoDataException() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());
        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));

        InvoiceAnalysisResponse analysisResponse = new InvoiceAnalysisResponse();
        analysisResponse.setError("No values could be extracted");
        when(invoiceAnalysisService.analyzeInvoice(invoiceId)).thenReturn(analysisResponse);

        assertThrows(InvoiceNoDataException.class, () -> invoiceService.analyzeInvoice(invoiceId));
    }

    @Test
    void analyzeInvoice_failure_throwsInvoiceAnalysisFailureException() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());
        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));

        when(invoiceAnalysisService.analyzeInvoice(invoiceId))
                .thenThrow(new com.fasterxml.jackson.core.JsonParseException(null, "Bad JSON"));

        assertThrows(InvoiceAnalysisFailureException.class, () -> invoiceService.analyzeInvoice(invoiceId));
    }

    @Test
    void analyzeInvoice_autoMatchesActiveVendorAccountAndTransitionsToPendingApproval() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());

        PropertyVendorMappingEntity activeMapping = new PropertyVendorMappingEntity();
        activeMapping.setMappingId(UUID.randomUUID());
        activeMapping.setVendorAccountNumber("2000456700");
        activeMapping.setStatus("ACTIVE");

        InvoiceAnalysisResponseExtractedValues extracted = new InvoiceAnalysisResponseExtractedValues()
                .invoiceNumber(new StringField().value("BILL-1001"))
                .accountNumber(new StringField().value("2000456700"))
                .vendorName(new StringField().value("Alder Creek Landscaping"))
                .propertyName(new StringField().value("Industrial Business Park"))
                .billingPeriodStart(new StringField().value("2026-10-01"))
                .billingPeriodEnd(new StringField().value("2026-10-31"))
                .invoiceIssuedDate(new StringField().value("2026-10-02"))
                .paymentDueDate(new StringField().value("2026-10-16"))
                .totalAmountDue(new NumberField().value(186.42));
        InvoiceAnalysisResponse analysisResponse = new InvoiceAnalysisResponse()
                .extractedValues(extracted);

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(invoiceAnalysisService.analyzeInvoice(invoiceId)).thenReturn(analysisResponse);
        when(mappingRepository.findByVendorAccountNumberIgnoreCaseAndStatus("2000456700", "ACTIVE"))
                .thenReturn(List.of(activeMapping));
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_MAPPING,
                InvoiceUploadService.SYSTEM_USER_ID,
                "AI extracted invoice fields")).thenReturn(true);
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_APPROVAL,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-matched active property-vendor mapping")).thenReturn(true);

        InvoiceAnalysisResponse result = invoiceService.analyzeInvoice(invoiceId);

        assertNotNull(result);
        assertEquals("BILL-1001", invoice.getVendorSuppliedInvoiceId());
        assertEquals(new BigDecimal("186.42"), invoice.getAmount());
        assertEquals(LocalDate.of(2026, 10, 16), invoice.getDueDate());
        assertEquals(LocalDate.of(2026, 10, 1), invoice.getBillingPeriodStart());
        assertEquals(LocalDate.of(2026, 10, 31), invoice.getBillingPeriodEnd());
        assertEquals(LocalDate.of(2026, 10, 2), invoice.getInvoiceCreationDate());
        assertEquals(activeMapping, invoice.getMapping());
        verify(transitionService).tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_MAPPING,
                InvoiceUploadService.SYSTEM_USER_ID,
                "AI extracted invoice fields");
        verify(transitionService).tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_APPROVAL,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-matched active property-vendor mapping");
    }

    @Test
    void analyzeInvoice_whenNoMappingFound_transitionsToPendingMappingOnly() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());

        InvoiceAnalysisResponseExtractedValues extracted = new InvoiceAnalysisResponseExtractedValues()
                .invoiceNumber(new StringField().value("BILL-UNMAPPED"))
                .accountNumber(new StringField().value("999999"))
                .vendorName(new StringField().value("Cedar Valley Pest Control"))
                .propertyName(new StringField().value("Industrial Business Park"));
        InvoiceAnalysisResponse analysisResponse = new InvoiceAnalysisResponse()
                .extractedValues(extracted);

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(invoiceAnalysisService.analyzeInvoice(invoiceId)).thenReturn(analysisResponse);
        when(mappingRepository.findByVendorAccountNumberIgnoreCaseAndStatus("999999", "ACTIVE"))
                .thenReturn(List.of());
        when(mappingRepository.findByStatus("ACTIVE")).thenReturn(List.of());
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_MAPPING,
                InvoiceUploadService.SYSTEM_USER_ID,
                "AI extracted invoice fields")).thenReturn(true);

        invoiceService.analyzeInvoice(invoiceId);

        assertNull(invoice.getMapping());
        assertEquals("BILL-UNMAPPED", invoice.getVendorSuppliedInvoiceId());
        verify(transitionService).tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_MAPPING,
                InvoiceUploadService.SYSTEM_USER_ID,
                "AI extracted invoice fields");
        verify(transitionService, never()).tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_APPROVAL,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-matched active property-vendor mapping");
    }

    @Test
    void analyzeInvoice_autoMatchesByVendorAndPropertyAddressFallback() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());

        VendorEntity vendor = VendorEntity.builder()
                .vendorId(UUID.randomUUID())
                .name("Alder Creek Landscaping")
                .build();
        PropertyEntity property = PropertyEntity.builder()
                .propertyId(UUID.randomUUID())
                .name("Industrial Business Park")
                .address(new AddressRecord("125 Industrial Way", "Springfield", "IL", "62701"))
                .build();
        PropertyVendorMappingEntity activeMapping = PropertyVendorMappingEntity.builder()
                .mappingId(UUID.randomUUID())
                .vendor(vendor)
                .property(property)
                .vendorAccountNumber("OLD-ACCT")
                .status("ACTIVE")
                .build();

        InvoiceAnalysisResponseExtractedValues extracted = new InvoiceAnalysisResponseExtractedValues()
                .vendorName(new StringField().value("Alder Creek Landscaping"))
                .propertyAddress(new StringField().value("125 Industrial Way, Springfield, IL 62701"));
        InvoiceAnalysisResponse analysisResponse = new InvoiceAnalysisResponse()
                .extractedValues(extracted);

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(invoiceAnalysisService.analyzeInvoice(invoiceId)).thenReturn(analysisResponse);
        when(mappingRepository.findByStatus("ACTIVE")).thenReturn(List.of(activeMapping));
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_MAPPING,
                InvoiceUploadService.SYSTEM_USER_ID,
                "AI extracted invoice fields")).thenReturn(true);
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_APPROVAL,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-matched active property-vendor mapping")).thenReturn(true);

        invoiceService.analyzeInvoice(invoiceId);

        assertEquals(activeMapping, invoice.getMapping());
        verify(transitionService).tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_APPROVAL,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-matched active property-vendor mapping");
    }

    @Test
    void analyzeInvoice_success_updatesFieldsAndExtracts() throws Exception {
        UUID invoiceId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());
        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));

        InvoiceAnalysisResponse analysisResponse = new InvoiceAnalysisResponse();
        analysisResponse.setError(null);
        InvoiceAnalysisResponseExtractedValues values = new InvoiceAnalysisResponseExtractedValues();
        values.setInvoiceNumber(new StringField().value("INV-999"));
        values.setTotalAmountDue(new NumberField().value(new BigDecimal("123.45")));
        analysisResponse.setExtractedValues(values);

        when(invoiceAnalysisService.analyzeInvoice(invoiceId)).thenReturn(analysisResponse);

        InvoiceAnalysisResponse result = invoiceService.analyzeInvoice(invoiceId);
        assertNotNull(result);
        assertEquals(analysisResponse, result);
        verify(auditLogService).record(
                org.mockito.ArgumentMatchers.eq(invoiceId),
                any(UUID.class),
                org.mockito.ArgumentMatchers.eq(AuditLogCreateRequest.ActionTypeEnum.SYSTEM_IDENTIFIED),
                anyString(),
                anyString(),
                anyString(),
                anyString());
    }

    @Test
    void analyzeInvoice_whenMappingAutoApprovalEnabledAndPolicyAutoApproved_transitionsToApproved() throws Exception {
        PolicyEngineService policyEngineService = mock(PolicyEngineService.class);
        AccountsPayableApprovalMatrixService matrixService = mock(AccountsPayableApprovalMatrixService.class);
        InvoiceService serviceWithPolicy = new InvoiceService(
                invoiceRepository, mappingRepository, transitionService,
                invoiceAnalysisService, auditLogService, policyEngineService, matrixService);

        UUID invoiceId = UUID.randomUUID();
        UUID propertyId = UUID.randomUUID();
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.INGESTED.getValue());

        PropertyEntity property = PropertyEntity.builder()
                .propertyId(propertyId)
                .name("Industrial Business Park")
                .build();
        PropertyVendorMappingEntity activeMapping = PropertyVendorMappingEntity.builder()
                .mappingId(UUID.randomUUID())
                .property(property)
                .vendorAccountNumber("2000456700")
                .costType("FIXED_MONTHLY")
                .status("ACTIVE")
                .autoApprovalEnabled(true)
                .build();

        InvoiceAnalysisResponseExtractedValues extracted = new InvoiceAnalysisResponseExtractedValues()
                .invoiceNumber(new StringField().value("BILL-AUTO-1"))
                .accountNumber(new StringField().value("2000456700"))
                .totalAmountDue(new NumberField().value(186.42));
        InvoiceAnalysisResponse analysisResponse = new InvoiceAnalysisResponse()
                .extractedValues(extracted);

        PolicyEvaluationResponse evalResponse = new PolicyEvaluationResponse()
                .isAutoApproved(true)
                .reason("Auto-approved below Step 0 threshold with 96% OCR confidence.");

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(invoiceAnalysisService.analyzeInvoice(invoiceId)).thenReturn(analysisResponse);
        when(mappingRepository.findByVendorAccountNumberIgnoreCaseAndStatus("2000456700", "ACTIVE"))
                .thenReturn(List.of(activeMapping));
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_MAPPING,
                InvoiceUploadService.SYSTEM_USER_ID,
                "AI extracted invoice fields")).thenReturn(true);
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.PENDING_APPROVAL,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-matched active property-vendor mapping")).thenReturn(true);
        when(policyEngineService.evaluate(org.mockito.ArgumentMatchers.eq(propertyId), any(PolicyEvaluationRequest.class)))
                .thenReturn(evalResponse);
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.APPROVED,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-approved below Step 0 threshold with 96% OCR confidence.")).thenReturn(true);

        serviceWithPolicy.analyzeInvoice(invoiceId);

        assertEquals(InvoiceStatus.APPROVED.getValue(), invoice.getInvoiceStatus());
        verify(transitionService).tryTransition(
                invoiceId,
                InvoiceStatus.APPROVED,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-approved below Step 0 threshold with 96% OCR confidence.");
    }

    @Test
    void updateInvoice_whenTransitionedToPendingApprovalWithAutoApproveMapping_autoTransitionsToApproved() {
        PolicyEngineService policyEngineService = mock(PolicyEngineService.class);
        AccountsPayableApprovalMatrixService matrixService = mock(AccountsPayableApprovalMatrixService.class);
        InvoiceService serviceWithPolicy = new InvoiceService(
                invoiceRepository, mappingRepository, transitionService,
                invoiceAnalysisService, auditLogService, policyEngineService, matrixService);

        UUID invoiceId = UUID.randomUUID();
        UUID propertyId = UUID.randomUUID();
        UUID autoMappingId = UUID.randomUUID();
        PropertyEntity property = PropertyEntity.builder()
                .propertyId(propertyId)
                .name("Industrial Business Park")
                .build();
        PropertyVendorMappingEntity autoMapping = PropertyVendorMappingEntity.builder()
                .mappingId(autoMappingId)
                .property(property)
                .vendorAccountNumber("2000456702")
                .costType("FIXED_MONTHLY")
                .status("ACTIVE")
                .autoApprovalEnabled(true)
                .build();

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.PENDING_MAPPING.getValue());
        invoice.setAmount(new BigDecimal("518.70"));

        PolicyEvaluationResponse evalResponse = new PolicyEvaluationResponse()
                .isAutoApproved(true)
                .reason("Auto-approved under Step 0 fixed threshold");

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(mappingRepository.findById(autoMappingId)).thenReturn(Optional.of(autoMapping));
        when(policyEngineService.evaluate(org.mockito.ArgumentMatchers.eq(propertyId), any(PolicyEvaluationRequest.class)))
                .thenReturn(evalResponse);
        when(transitionService.tryTransition(
                invoiceId,
                InvoiceStatus.APPROVED,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-approved under Step 0 fixed threshold")).thenReturn(true);

        InvoiceUpdateRequest request = new InvoiceUpdateRequest();
        request.setMappingUuid(autoMappingId);
        request.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL);

        InvoiceResponse response = serviceWithPolicy.updateInvoice(invoiceId, request);

        assertEquals(InvoiceStatus.APPROVED, response.getInvoiceStatus());
        verify(transitionService).tryTransition(
                invoiceId,
                InvoiceStatus.APPROVED,
                InvoiceUploadService.SYSTEM_USER_ID,
                "Auto-approved under Step 0 fixed threshold");
    }

    @Test
    void updateInvoice_whenHumanApproverBelowPropertyMatrixLimit_throwsBadRequestException() {
        PolicyEngineService policyEngineService = mock(PolicyEngineService.class);
        AccountsPayableApprovalMatrixService matrixService = mock(AccountsPayableApprovalMatrixService.class);
        InvoiceService serviceWithPolicy = new InvoiceService(
                invoiceRepository, mappingRepository, transitionService,
                invoiceAnalysisService, auditLogService, policyEngineService, matrixService);

        UUID invoiceId = UUID.randomUUID();
        UUID propertyId = UUID.randomUUID();
        UUID pmUserId = UUID.randomUUID();

        PropertyEntity property = PropertyEntity.builder()
                .propertyId(propertyId)
                .name("Grandview Office Tower")
                .build();
        PropertyVendorMappingEntity mapping = PropertyVendorMappingEntity.builder()
                .mappingId(mappingUuid)
                .property(property)
                .costType("VARIABLE")
                .status("ACTIVE")
                .build();

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL.getValue());
        invoice.setAmount(new BigDecimal("4500.00"));
        invoice.setMapping(mapping);

        AccountsPayableSeatResponse pmSeat = new AccountsPayableSeatResponse();
        pmSeat.setAccountsPayableSeatSlug("PM_SEAT_FRISCO_OFFICE");
        pmSeat.setAssignedUserUuid(pmUserId);

        AccountsPayableApprovalMatrixResponse step1 = new AccountsPayableApprovalMatrixResponse();
        step1.setAccountsPayableApprovalSequence(1);
        step1.setAssignedUserUuid(pmUserId);
        step1.setAccountsPayableThresholdSlug("LIMIT_LOW");
        step1.setVariableMax(1000.0);
        step1.setFixedAutoMax(2500.0);

        ApprovalQueueResponse queueResponse = new ApprovalQueueResponse();
        queueResponse.setSteps(List.of());

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(matrixService.getAllSeats()).thenReturn(List.of(pmSeat));
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step1));
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 4500.00, "VARIABLE")).thenReturn(queueResponse);

        InvoiceUpdateRequest request = new InvoiceUpdateRequest();
        request.setInvoiceStatus(InvoiceStatus.APPROVED);
        request.setActedBy(pmUserId);

        assertThrows(BadRequestException.class, () -> serviceWithPolicy.updateInvoice(invoiceId, request));
        verify(transitionService, never()).transition(any(), any(), any(), any());
    }

    @Test
    void updateInvoice_whenHumanApproverMeetsPropertyMatrixLimit_transitionsToApproved() {
        PolicyEngineService policyEngineService = mock(PolicyEngineService.class);
        AccountsPayableApprovalMatrixService matrixService = mock(AccountsPayableApprovalMatrixService.class);
        InvoiceService serviceWithPolicy = new InvoiceService(
                invoiceRepository, mappingRepository, transitionService,
                invoiceAnalysisService, auditLogService, policyEngineService, matrixService);

        UUID invoiceId = UUID.randomUUID();
        UUID propertyId = UUID.randomUUID();
        UUID seniorPmUserId = UUID.randomUUID();

        PropertyEntity property = PropertyEntity.builder()
                .propertyId(propertyId)
                .name("Grandview Office Tower")
                .build();
        PropertyVendorMappingEntity mapping = PropertyVendorMappingEntity.builder()
                .mappingId(mappingUuid)
                .property(property)
                .costType("VARIABLE")
                .status("ACTIVE")
                .build();

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL.getValue());
        invoice.setAmount(new BigDecimal("4500.00"));
        invoice.setMapping(mapping);

        AccountsPayableSeatResponse spmSeat = new AccountsPayableSeatResponse();
        spmSeat.setAccountsPayableSeatSlug("SPM_SEAT_DOWNTOWN");
        spmSeat.setAssignedUserUuid(seniorPmUserId);

        AccountsPayableApprovalMatrixResponse step2 = new AccountsPayableApprovalMatrixResponse();
        step2.setAccountsPayableApprovalSequence(2);
        step2.setAssignedUserUuid(seniorPmUserId);
        step2.setAccountsPayableThresholdSlug("LIMIT_MID");
        step2.setVariableMax(5000.0);
        step2.setFixedAutoMax(10000.0);

        ApprovalQueueStepResponse qStep = new ApprovalQueueStepResponse();
        qStep.setSequence(2);
        qStep.setUserUuid(seniorPmUserId);
        qStep.setThresholdSlug("LIMIT_MID");
        qStep.setVariableMax(5000.0);
        qStep.setFixedAutoMax(10000.0);

        ApprovalQueueResponse queueResponse = new ApprovalQueueResponse();
        queueResponse.setSteps(List.of(qStep));

        when(invoiceRepository.findByIdForUpdate(invoiceId)).thenReturn(Optional.of(invoice));
        when(matrixService.getAllSeats()).thenReturn(List.of(spmSeat));
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step2));
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 4500.00, "VARIABLE")).thenReturn(queueResponse);

        InvoiceUpdateRequest request = new InvoiceUpdateRequest();
        request.setInvoiceStatus(InvoiceStatus.APPROVED);
        request.setActedBy(seniorPmUserId);
        request.setFailureReason("Approved within Senior PM threshold");

        InvoiceResponse response = serviceWithPolicy.updateInvoice(invoiceId, request);

        assertEquals(InvoiceStatus.APPROVED, response.getInvoiceStatus());
        verify(transitionService).transition(
                invoiceId,
                InvoiceStatus.APPROVED,
                seniorPmUserId,
                "Approved within Senior PM threshold");
    }

    @Test
    void updateInvoice_whenRejectedOrReevaluated_transitionsToFailedOrPendingMapping() {
        UUID reviewerId = UUID.randomUUID();
        InvoiceEntity rejectInvoice = storedInvoice(InvoiceStatus.PENDING_APPROVAL, "324.16");

        InvoiceUpdateRequest rejectRequest = new InvoiceUpdateRequest();
        rejectRequest.setInvoiceStatus(InvoiceStatus.FAILED);
        rejectRequest.setActedBy(reviewerId);
        rejectRequest.setFailureReason("Duplicate billing period");

        InvoiceResponse rejectResponse = invoiceService.updateInvoice(rejectInvoice.getInvoiceId(), rejectRequest);
        assertEquals(InvoiceStatus.FAILED, rejectResponse.getInvoiceStatus());
        verify(transitionService).transition(
                rejectInvoice.getInvoiceId(),
                InvoiceStatus.FAILED,
                reviewerId,
                "Duplicate billing period");

        InvoiceEntity reevalInvoice = storedInvoice(InvoiceStatus.PENDING_APPROVAL, "324.16");
        InvoiceUpdateRequest reevalRequest = new InvoiceUpdateRequest();
        reevalRequest.setInvoiceStatus(InvoiceStatus.PENDING_MAPPING);
        reevalRequest.setActedBy(reviewerId);
        reevalRequest.setFailureReason("Incorrect GL code mapping");

        InvoiceResponse reevalResponse = invoiceService.updateInvoice(reevalInvoice.getInvoiceId(), reevalRequest);
        assertEquals(InvoiceStatus.PENDING_MAPPING, reevalResponse.getInvoiceStatus());
        verify(transitionService).transition(
                reevalInvoice.getInvoiceId(),
                InvoiceStatus.PENDING_MAPPING,
                reviewerId,
                "Incorrect GL code mapping");
    }
}