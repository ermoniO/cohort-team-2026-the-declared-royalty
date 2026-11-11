package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import com.stripe.StripeClient;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.StripeProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.InvoiceStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PaymentAttemptRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.StripeWebhookEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

class StripePaymentServiceTest {

    private final InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
    private final PaymentAttemptRepository paymentAttemptRepository = mock(PaymentAttemptRepository.class);
    private final StripeWebhookEventRepository webhookEventRepository = mock(StripeWebhookEventRepository.class);
    private final ObjectProvider<StripeClient> stripeClientProvider = mock(ObjectProvider.class);
    private final StripePaymentService service = new StripePaymentService(
            invoiceRepository,
            paymentAttemptRepository,
            new StripeProperties(true, "sk_test_key", "whsec_test", "usd"),
            stripeClientProvider,
            webhookEventRepository);
    private final UUID invoiceId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(approvedInvoice()));
        when(paymentAttemptRepository.findFirstByInvoice_InvoiceIdAndStatusInOrderByCreatedAtDesc(
                eq(invoiceId), anyList())).thenReturn(Optional.empty());
    }

    @Test
    void rejectsPaymentWithoutExplicitHumanApproval() {
        StripePaymentRequest request = new StripePaymentRequest("pm_card_visa", "usd", new BigDecimal("125.00"), false);

        assertThrows(BadRequestException.class, () -> service.createPayment(invoiceId, request));
        verifyNoInteractions(stripeClientProvider);
        verify(paymentAttemptRepository, never()).save(any());
    }

    @Test
    void rejectsApprovedAmountThatDiffersFromPersistedInvoice() {
        StripePaymentRequest request = new StripePaymentRequest("pm_card_visa", "usd", new BigDecimal("124.99"), true);

        assertThrows(BadRequestException.class, () -> service.createPayment(invoiceId, request));
        verifyNoInteractions(stripeClientProvider);
        verify(paymentAttemptRepository, never()).save(any());
    }

    @Test
    void rejectsInvoiceThatIsNotApproved() {
        InvoiceEntity invoice = approvedInvoice();
        invoice.setInvoiceStatus(InvoiceStatus.PENDING_APPROVAL.getValue());
        when(invoiceRepository.findById(invoiceId)).thenReturn(Optional.of(invoice));
        StripePaymentRequest request = new StripePaymentRequest("pm_card_visa", "usd", new BigDecimal("125.00"), true);

        assertThrows(BadRequestException.class, () -> service.createPayment(invoiceId, request));
        verifyNoInteractions(stripeClientProvider);
        verify(paymentAttemptRepository, never()).save(any());
    }

    private InvoiceEntity approvedInvoice() {
        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setInvoiceId(invoiceId);
        invoice.setInvoiceStatus(InvoiceStatus.APPROVED.getValue());
        invoice.setAmount(new BigDecimal("125.00"));
        return invoice;
    }
}
