package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.InvalidStatusTransitionException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AuditLogCreateRequest.ActionTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvoiceTransitionServiceTest {

    private static final UUID INVOICE_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();

    @Mock private InvoiceRepository invoiceRepository;
    @Mock private AuditLogService auditLogService;

    @InjectMocks private InvoiceTransitionService service;

    private InvoiceEntity invoiceIn(InvoiceStatus status) {
        PropertyVendorMappingEntity mapping = PropertyVendorMappingEntity.builder()
                .mappingId(UUID.randomUUID())
                .vendorAccountNumber("ACC-TEST")
                .build();
        InvoiceEntity invoice = InvoiceEntity.builder()
                .invoiceId(INVOICE_ID)
                .mapping(mapping)
                .invoiceStatus(status.getValue())
                .build();
        when(invoiceRepository.findByIdForUpdate(INVOICE_ID)).thenReturn(Optional.of(invoice));
        return invoice;
    }

    @Test
    void transition_toPendingApprovalWithoutMapping_throwsBadRequest() {
        InvoiceEntity invoice = invoiceIn(InvoiceStatus.PENDING_MAPPING);
        invoice.setMapping(null);

        assertThatThrownBy(() -> service.transition(INVOICE_ID, InvoiceStatus.PENDING_APPROVAL, USER_ID, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A property-vendor mapping is required before moving to PENDING_APPROVAL");

        verify(invoiceRepository, never()).save(any());
        verify(auditLogService, never()).record(any(), any(), any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void transition_allowed_updatesStatusAndRecordsAuditOnce() {
        InvoiceEntity invoice = invoiceIn(InvoiceStatus.PENDING_APPROVAL);

        boolean changed = service.transition(INVOICE_ID, InvoiceStatus.APPROVED, USER_ID, null);

        assertThat(changed).isTrue();
        assertThat(invoice.getInvoiceStatus()).isEqualTo("APPROVED");
        assertThat(invoice.getUpdatedAt()).isNotNull();
        verify(invoiceRepository).save(invoice);
        verify(auditLogService).record(eq(INVOICE_ID), eq(USER_ID), eq(ActionTypeEnum.USER_APPROVED),
                eq("Status changed to APPROVED"), eq("PENDING_APPROVAL"), eq("APPROVED"), eq(null));
    }

    @Test
    void transition_sameState_isNoOp() {
        invoiceIn(InvoiceStatus.PAID);

        boolean changed = service.transition(INVOICE_ID, InvoiceStatus.PAID, null, null);

        assertThat(changed).isFalse();
        verify(invoiceRepository, never()).save(any());
        verify(auditLogService, never()).record(any(), any(), any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void transition_notAllowed_throwsAndWritesNothing() {
        invoiceIn(InvoiceStatus.PAID);

        assertThatThrownBy(() -> service.transition(INVOICE_ID, InvoiceStatus.PENDING_APPROVAL, USER_ID, null))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(invoiceRepository, never()).save(any());
        verify(auditLogService, never()).record(any(), any(), any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void transition_toApprovedWithoutActor_throwsBadRequest() {
        InvoiceEntity invoice = invoiceIn(InvoiceStatus.PENDING_APPROVAL);

        assertThatThrownBy(() -> service.transition(INVOICE_ID, InvoiceStatus.APPROVED, null, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A human approver is required");

        assertThat(invoice.getInvoiceStatus()).isEqualTo("PENDING_APPROVAL");
        verify(auditLogService, never()).record(any(), any(), any(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void transition_toFailedWithBlankReason_throwsBadRequest() {
        invoiceIn(InvoiceStatus.APPROVED);

        assertThatThrownBy(() -> service.transition(INVOICE_ID, InvoiceStatus.FAILED, null, "  "))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("failureReason is required");
    }

    @Test
    void transition_toFailedWithReason_recordsReasonAsNotes() {
        invoiceIn(InvoiceStatus.APPROVED);

        service.transition(INVOICE_ID, InvoiceStatus.FAILED, null, "card declined");

        verify(auditLogService).record(eq(INVOICE_ID), eq(InvoiceUploadService.SYSTEM_USER_ID),
                eq(ActionTypeEnum.SYSTEM_FAILED), anyString(), eq("APPROVED"), eq("FAILED"), eq("card declined"));
    }

    @Test
    void transition_nullActor_recordsSystemUserAndSystemActionType() {
        invoiceIn(InvoiceStatus.INGESTED);

        service.transition(INVOICE_ID, InvoiceStatus.PENDING_MAPPING, null, null);

        verify(auditLogService).record(eq(INVOICE_ID), eq(InvoiceUploadService.SYSTEM_USER_ID),
                eq(ActionTypeEnum.SYSTEM_IDENTIFIED), anyString(), eq("INGESTED"), eq("PENDING_MAPPING"), eq(null));
    }

    @Test
    void transition_missingInvoice_throwsResourceNotFound() {
        when(invoiceRepository.findByIdForUpdate(INVOICE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.transition(INVOICE_ID, InvoiceStatus.VOID, USER_ID, null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void transition_auditFailure_propagates() {
        invoiceIn(InvoiceStatus.PENDING_APPROVAL);
        when(auditLogService.record(any(), any(), any(), anyString(), anyString(), anyString(), any()))
                .thenThrow(new ResourceNotFoundException("User not found"));

        assertThatThrownBy(() -> service.transition(INVOICE_ID, InvoiceStatus.APPROVED, USER_ID, null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void tryTransition_notAllowed_returnsFalseAndWritesNothing() {
        invoiceIn(InvoiceStatus.PAID);

        boolean changed = service.tryTransition(INVOICE_ID, InvoiceStatus.PROCESSING_PAYMENT, null, null);

        assertThat(changed).isFalse();
        verify(invoiceRepository, never()).save(any());
        verify(auditLogService, never()).record(any(), any(), any(), anyString(), anyString(), anyString(), any());
    }
}

