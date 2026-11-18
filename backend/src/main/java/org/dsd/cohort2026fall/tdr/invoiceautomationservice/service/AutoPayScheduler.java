package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import lombok.extern.slf4j.Slf4j;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.config.StripeProperties;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.AutoPaySettingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.StripePaymentRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.AutoPaySettingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.InvoiceRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
public class AutoPayScheduler {

    private static final String APPROVED = "APPROVED";

    private final InvoiceRepository invoiceRepository;
    private final AutoPaySettingRepository autoPaySettingRepository;
    private final StripePaymentService stripePaymentService;
    private final StripeProperties stripeProperties;

    public AutoPayScheduler(InvoiceRepository invoiceRepository,
                            AutoPaySettingRepository autoPaySettingRepository,
                            StripePaymentService stripePaymentService,
                            StripeProperties stripeProperties) {
        this.invoiceRepository = invoiceRepository;
        this.autoPaySettingRepository = autoPaySettingRepository;
        this.stripePaymentService = stripePaymentService;
        this.stripeProperties = stripeProperties;
    }

    @Scheduled(fixedDelayString = "${stripe.auto-pay-interval-ms:300000}")
    public void processDuePayments() {
        if (!stripeProperties.enabled() || !isEnabled()) {
            return;
        }
        if (stripeProperties.autoPayPaymentMethodId() == null
                || stripeProperties.autoPayPaymentMethodId().isBlank()) {
            log.warn("Auto-pay is enabled but STRIPE_AUTO_PAY_PAYMENT_METHOD_ID is not configured");
            return;
        }

        List<InvoiceEntity> dueInvoices = invoiceRepository
                .findByInvoiceStatusAndDueDateLessThanEqualOrderByDueDateAsc(APPROVED, LocalDate.now());
        for (InvoiceEntity invoice : dueInvoices) {
            try {
                stripePaymentService.createPayment(invoice.getInvoiceId(), new StripePaymentRequest(
                        stripeProperties.autoPayPaymentMethodId(),
                        stripeProperties.currency(),
                        invoice.getAmount(),
                        true));
            } catch (RuntimeException ex) {
                // Continue processing other due invoices; the payment service records failures.
                log.error("Auto-pay failed for invoice {}", invoice.getInvoiceId(), ex);
            }
        }
    }

    private boolean isEnabled() {
        return autoPaySettingRepository.findById(AutoPaySettingEntity.SINGLETON_ID)
                .map(AutoPaySettingEntity::isEnabled)
                .orElse(false);
    }
}
