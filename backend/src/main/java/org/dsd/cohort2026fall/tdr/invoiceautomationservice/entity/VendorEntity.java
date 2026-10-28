package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "vendors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VendorEntity {

    @Id
    @Column(name = "vendor_uuid", updatable = false, nullable = false)
    private UUID vendorId;

    @Column(name = "vendor_name", nullable = false)
    private String name;

    @Column(name = "billing_phone_number", nullable = false)
    private String phoneNumber;

    @Builder.Default
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "payment_url", nullable = false)
    private String paymentUrl;

    @Column(name = "payment_method", nullable = false)
    private String paymentMethod;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
