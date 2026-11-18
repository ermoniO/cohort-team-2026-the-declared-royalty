package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.StripeProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.AutoPaySettingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.AutoPaySettingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AutoPaySchedulerTest {

    private final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
    private final AutoPaySettingRepository autoPaySettingRepository = mock(AutoPaySettingRepository.class);
    private final StripePaymentService stripePaymentService = mock(StripePaymentService.class);
    private final AutoPayScheduler scheduler = new AutoPayScheduler(
            invoiceRepository,
            autoPaySettingRepository,
            stripePaymentService,
            new StripeProperties(true, "sk_test_key", "whsec_test", "usd", "pm_card_visa"));

    @Test
    void processesDueApprovedInvoicesWhenAutoPayIsEnabled() {
        InvoiceEntity invoice = invoice("APPROVED", LocalDate.now());
        when(autoPaySettingRepository.findById(AutoPaySettingEntity.SINGLETON_ID))
                .thenReturn(Optional.of(new AutoPaySettingEntity(1, true)));
        when(invoiceRepository.findByInvoiceStatusAndDueDateLessThanEqualOrderByDueDateAsc(
                eq("APPROVED"), any(LocalDate.class))).thenReturn(List.of(invoice));

        scheduler.processDuePayments();

        verify(stripePaymentService).createPayment(eq(invoice.getInvoiceId()), any());
    }

    @Test
    void doesNothingWhenAutoPayIsDisabled() {
        when(autoPaySettingRepository.findById(AutoPaySettingEntity.SINGLETON_ID))
                .thenReturn(Optional.of(new AutoPaySettingEntity(1, false)));

        scheduler.processDuePayments();

        verifyNoInteractions(invoiceRepository, stripePaymentService);
    }

    @Test
    void continuesAfterOneInvoiceFails() {
        InvoiceEntity first = invoice("APPROVED", LocalDate.now());
        InvoiceEntity second = invoice("APPROVED", LocalDate.now());
        when(autoPaySettingRepository.findById(AutoPaySettingEntity.SINGLETON_ID))
                .thenReturn(Optional.of(new AutoPaySettingEntity(1, true)));
        when(invoiceRepository.findByInvoiceStatusAndDueDateLessThanEqualOrderByDueDateAsc(
                eq("APPROVED"), any(LocalDate.class))).thenReturn(List.of(first, second));
        doThrow(new RuntimeException("Stripe unavailable"))
                .when(stripePaymentService).createPayment(eq(first.getInvoiceId()), any());

        scheduler.processDuePayments();

        verify(stripePaymentService).createPayment(eq(first.getInvoiceId()), any());
        verify(stripePaymentService).createPayment(eq(second.getInvoiceId()), any());
    }

    private InvoiceEntity invoice(String status, LocalDate dueDate) {
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(UUID.randomUUID());
        invoice.setInvoiceStatus(status);
        invoice.setAmount(new BigDecimal("125.00"));
        invoice.setDueDate(dueDate);
        return invoice;
    }
}
