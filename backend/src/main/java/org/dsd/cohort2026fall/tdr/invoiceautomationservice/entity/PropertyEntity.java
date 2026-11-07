package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.*;
import lombok.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.Address;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AddressRecord;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyType;
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
    @Column(name = "property_type", nullable = false)
    private String propertyType = "COMMERCIAL_OFFICE";

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
        PropertyType pType;
        try {
            pType = propertyType != null ? PropertyType.fromValue(propertyType) : PropertyType.COMMERCIAL_OFFICE;
        } catch (Exception e) {
            pType = PropertyType.COMMERCIAL_OFFICE;
        }
        return new PropertyResponse(propertyId, name, pType, addressDto, status);
    }
}
