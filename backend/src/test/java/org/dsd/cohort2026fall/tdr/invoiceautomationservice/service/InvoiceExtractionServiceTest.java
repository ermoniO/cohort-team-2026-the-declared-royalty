package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import jakarta.persistence.EntityManager;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceProgressRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceVerifyRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.UserRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// Who the review's audit entries are recorded under
class InvoiceExtractionServiceTest {

    private final InvoiceService invoiceService = mock(InvoiceService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
    private final PropertyVendorMappingRepository mappingRepository = mock(PropertyVendorMappingRepository.class);
    private final VendorRepository vendorRepository = mock(VendorRepository.class);
    private final PropertyRepository propertyRepository = mock(PropertyRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final TransactionTemplate transactionTemplate = mock(TransactionTemplate.class);

    private final InvoiceExtractionService service = new InvoiceExtractionService(
            invoiceService, mock(ExtractionScorer.class), auditLogService, invoiceRepository, mappingRepository,
            vendorRepository, propertyRepository, userRepository, transactionTemplate, mock(EntityManager.class));

    private final UUID invoiceUuid = UUID.randomUUID();
    private final UUID reviewer = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceUuid);
        invoice.setInvoiceStatus(InvoiceStatus.PENDING_MAPPING.getValue());
        when(invoiceRepository.findById(invoiceUuid)).thenReturn(Optional.of(invoice));
        when(invoiceRepository.saveAndFlush(any(InvoiceEntity.class))).thenAnswer(call -> call.getArgument(0));
        when(invoiceService.getInvoice(invoiceUuid)).thenReturn(new InvoiceResponse());
        // Run the transaction's body directly
        when(transactionTemplate.execute(any())).thenAnswer(call -> {
            TransactionCallback<?> body = call.getArgument(0);
            return body.doInTransaction(null);
        });
        when(userRepository.existsById(reviewer)).thenReturn(true);
    }

    @Test
    void verify_recordsTheReviewerWhoSentItForApproval() {
        InvoiceVerifyRequest request = verifyRequest();
        request.setReviewedBy(reviewer);

        service.verify(invoiceUuid, request);

        verify(auditLogService).record(eq(invoiceUuid), eq(reviewer), eq(ActionTypeEnum.USER_VALIDATED), anyString(),
                eq(InvoiceStatus.PENDING_MAPPING.getValue()), eq(InvoiceStatus.PENDING_APPROVAL.getValue()), any());
    }

    @Test
    void verify_withoutAReviewer_recordsTheSystemUser() {
        service.verify(invoiceUuid, verifyRequest());

        verify(auditLogService).record(eq(invoiceUuid), eq(InvoiceUploadService.SYSTEM_USER_ID), any(), anyString(),
                any(), eq(InvoiceStatus.PENDING_APPROVAL.getValue()), any());
    }

    @Test
    void verify_unknownReviewer_isABadRequest_andNothingIsSavedOrLogged() {
        UUID stranger = UUID.randomUUID();
        InvoiceVerifyRequest request = verifyRequest();
        request.setReviewedBy(stranger);

        assertThrows(BadRequestException.class, () -> service.verify(invoiceUuid, request));
        verifyNoInteractions(auditLogService, transactionTemplate);
    }

    @Test
    void verify_rejected_logsTheRejectionUnderTheReviewer() {
        InvoiceVerifyRequest request = verifyRequest();
        request.setReviewedBy(reviewer);
        request.setAmount(new BigDecimal("10.001"));

        assertThrows(RuntimeException.class, () -> service.verify(invoiceUuid, request));
        verify(auditLogService).recordFailure(eq(invoiceUuid), eq(reviewer), eq(ActionTypeEnum.USER_VALIDATED),
                anyString(), any(), any());
    }

    @Test
    void saveProgress_recordsTheReviewer() {
        InvoiceProgressRequest request = new InvoiceProgressRequest();
        request.setAmount(new BigDecimal("186.42"));
        request.setReviewedBy(reviewer);

        service.saveProgress(invoiceUuid, request);

        verify(auditLogService).record(eq(invoiceUuid), eq(reviewer), eq(ActionTypeEnum.USER_IDENTIFIED), anyString(),
                any(), eq(InvoiceStatus.PENDING_MAPPING.getValue()), anyString());
    }

    @Test
    void saveProgress_reviewerAlone_isNotAFieldToSave() {
        InvoiceProgressRequest request = new InvoiceProgressRequest();
        request.setReviewedBy(reviewer);

        assertThrows(RuntimeException.class, () -> service.saveProgress(invoiceUuid, request));
        verify(auditLogService).recordFailure(eq(invoiceUuid), eq(reviewer), any(), anyString(), any(), any());
    }

    // A complete request whose vendor and property already have a mapping with this account number
    private InvoiceVerifyRequest verifyRequest() {
        VendorEntity vendor = new VendorEntity();
        vendor.setVendorId(UUID.randomUUID());
        vendor.setName("Alder Creek Landscaping");
        PropertyEntity property = new PropertyEntity();
        property.setPropertyId(UUID.randomUUID());
        property.setName("Alder Creek Workshop");
        PropertyVendorMappingEntity mapping = new PropertyVendorMappingEntity();
        mapping.setMappingId(UUID.randomUUID());
        mapping.setVendor(vendor);
        mapping.setProperty(property);
        mapping.setVendorAccountNumber("2000456700");
        when(vendorRepository.findById(vendor.getVendorId())).thenReturn(Optional.of(vendor));
        when(propertyRepository.findById(property.getPropertyId())).thenReturn(Optional.of(property));
        when(mappingRepository.findByVendor_VendorIdAndProperty_PropertyId(vendor.getVendorId(), property.getPropertyId()))
                .thenReturn(Optional.of(mapping));

        InvoiceVerifyRequest request = new InvoiceVerifyRequest(
                vendor.getVendorId(), property.getPropertyId(), "2000456700", new BigDecimal("186.42"), LocalDate.of(2026, 10, 16));
        request.setVendorSuppliedInvoiceId("BILL-1001");
        return request;
    }
}
