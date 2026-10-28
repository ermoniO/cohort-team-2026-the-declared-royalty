package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table(name = "property_vendor_mapping")
public class PropertyVendorMappingEntity {

    @Id
    @Column(name = "mapping_uuid", updatable = false, nullable = false)
    private UUID mappingId;

    @ManyToOne
    @JoinColumn(name = "vendor_uuid", nullable = false)
    private VendorEntity vendor;

    @ManyToOne
    @JoinColumn(name = "property_uuid", nullable = false)
    private PropertyEntity property;

    @Column(name = "vendor_account_number", nullable = false)
    private String vendorAccountNumber;

    @Builder.Default
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "auto_approval_enabled", nullable = false)
    private boolean autoApprovalEnabled;

    @Builder.Default
    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

}