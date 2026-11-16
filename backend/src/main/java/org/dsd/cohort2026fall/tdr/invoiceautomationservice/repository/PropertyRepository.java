package org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PropertyRepository extends JpaRepository<PropertyEntity, UUID>, JpaSpecificationExecutor<PropertyEntity> {
    Page<PropertyEntity> findByPropertyId(UUID propertyId, Pageable pageable);

    @Query(value = "SELECT COUNT(*) > 0 FROM properties WHERE LOWER(address->>'streetAddress') = LOWER(:streetAddress) AND address->>'zipCode' = :zipCode", nativeQuery = true)
    Boolean existsByStreetAddressIgnoreCaseAndZipCode(@Param("streetAddress") String streetAddress, @Param("zipCode") String zipCode);
}
