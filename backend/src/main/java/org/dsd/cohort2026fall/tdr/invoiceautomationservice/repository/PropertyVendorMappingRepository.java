package org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PropertyVendorMappingRepository extends JpaRepository<PropertyVendorMappingEntity, UUID> {
    // vendor + property is unique (unique_key_property_vendor)
    Optional<PropertyVendorMappingEntity> findByVendor_VendorIdAndProperty_PropertyId(UUID vendorId, UUID propertyId);
}
