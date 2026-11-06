package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "invoices")
public class InvoiceEntity {

    @Id
    @Column(name = "invoice_uuid", updatable = false, nullable = false)
    private UUID invoiceId;

    @Column(name = "vendor_supplied_invoice_id", updatable = false, length = 100)
    private String vendorSuppliedInvoiceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mapping_uuid", nullable = false)
    private PropertyVendorMappingEntity mapping;

    @Column(name = "billing_period_start")
    private LocalDate billingPeriodStart;

    @Column(name = "billing_period_end")
    private LocalDate billingPeriodEnd;

    @Column(name = "invoice_creation_date")
    private LocalDate invoiceCreationDate;

    @Column(name = "amount", precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Builder.Default
    @Column(name = "invoice_status", nullable = false)
    private String invoiceStatus = "INGESTED";

    @Column(name = "failure_reason", length = 2000)
    private String failureReason;

    @Column(name = "blob_file_url", length = 1000)
    private String blobFileUrl;

    @Column(name = "blob_file_sha256", length = 100)
    private String blobFileSha256;

    @Builder.Default
    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

}
