package org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PaymentAttemptEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttemptEntity, UUID> {
    Optional<PaymentAttemptEntity> findByStripePaymentIntentId(String stripePaymentIntentId);

    Optional<PaymentAttemptEntity> findFirstByInvoice_InvoiceIdAndStatusInOrderByCreatedAtDesc(
            UUID invoiceId, List<String> statuses);
}
