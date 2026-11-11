package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.Address;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AddressRecord;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyResponse;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "properties")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PropertyEntity {

    @Id
    @Column(name = "property_uuid", updatable = false, nullable = false)
    private UUID propertyId;

    @Column(name = "name", nullable = false)
    private String name;

    @Builder.Default
    @Column(name = "category", nullable = false)
    private String category = "COMMERCIAL_OFFICE";

    @Column(name = "owner_entity")
    private String ownerEntity;

    @Column(name = "sqft")
    private Integer sqft;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "address", columnDefinition = "jsonb", nullable = false)
    private AddressRecord address;

    @Builder.Default
    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public PropertyResponse toResponse() {
        Address addressDto = address != null
                ? new Address(address.streetAddress(), address.city(), address.state(), address.zipCode())
                : null;
        PropertyResponse res = new PropertyResponse();
        res.setPropertyId(propertyId);
        res.setName(name);
        res.setCategory(category);
        res.setOwnerEntity(ownerEntity);
        res.setSqft(sqft);
        res.setAddress(addressDto);
        res.setStatus(status);
        return res;
    }
}
