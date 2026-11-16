package org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PropertyVendorMappingRepository extends JpaRepository<PropertyVendorMappingEntity, UUID> {

    List<PropertyVendorMappingEntity> findAllByOrderByCreatedAtDesc();

    Optional<PropertyVendorMappingEntity> findByVendor_VendorIdAndProperty_PropertyId(UUID vendorId, UUID propertyId);

    List<PropertyVendorMappingEntity> findByVendorAccountNumberIgnoreCaseAndStatus(String vendorAccountNumber, String status);

    List<PropertyVendorMappingEntity> findByStatus(String status);
}
