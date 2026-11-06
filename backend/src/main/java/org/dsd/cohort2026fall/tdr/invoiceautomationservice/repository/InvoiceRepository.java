package org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.InvoiceEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID>, JpaSpecificationExecutor<InvoiceEntity> {
    Page<InvoiceEntity> findByMapping_Property_PropertyId(UUID propertyId, Pageable pageable);

    Page<InvoiceEntity> findByInvoiceStatus(String status, Pageable pageable);

    boolean existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEnd(
            UUID mappingId, String vendorSuppliedInvoiceId, LocalDate billingPeriodEnd);

    boolean existsByMapping_MappingIdAndVendorSuppliedInvoiceIdAndBillingPeriodEndAndInvoiceIdNot(
            UUID mappingId, String vendorSuppliedInvoiceId, LocalDate billingPeriodEnd, UUID invoiceId);
}