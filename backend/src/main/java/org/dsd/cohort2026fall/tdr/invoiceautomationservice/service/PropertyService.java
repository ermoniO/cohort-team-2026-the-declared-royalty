package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AddressRecord;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.springdoc.api.OpenApiResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class PropertyService {

    private final PropertyRepository propertyRepository;

    public PropertyService(PropertyRepository propertyRepository) {
        this.propertyRepository = propertyRepository;
    }

    @Transactional(readOnly = true)
    public List<PropertyResponse> getAllProperties() {
        return propertyRepository.findAll().stream()
                .map(PropertyEntity::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PropertyResponse getPropertyById(UUID propertyId) {
        PropertyEntity property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new OpenApiResourceNotFoundException("Property not found in database."));
        return property.toResponse();
    }

    public PropertyResponse createProperty(PropertyCreateRequest request) {
        AddressRecord addressRecord = request.getAddress() != null
                ? new AddressRecord(
                        request.getAddress().getStreetAddress(),
                        request.getAddress().getCity(),
                        request.getAddress().getState(),
                        request.getAddress().getZipCode()
                )
                : null;

        String pType = request.getPropertyType() != null
                ? request.getPropertyType().getValue()
                : "COMMERCIAL_OFFICE";

        PropertyEntity createdProperty = PropertyEntity.builder()
                .propertyId(UUID.randomUUID())
                .name(request.getName())
                .propertyType(pType)
                .address(addressRecord)
                .status("ACTIVE")
                .build();

        PropertyEntity savedProperty = propertyRepository.save(createdProperty);
        return savedProperty.toResponse();
    }
}
