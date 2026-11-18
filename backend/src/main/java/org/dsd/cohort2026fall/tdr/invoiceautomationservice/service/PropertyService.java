package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;


import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.springdoc.api.OpenApiResourceNotFoundException;
import org.springframework.boot.context.properties.PropertyMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final PropertyAddressMatcher propertyAddressMatcher;


    public PropertyService(PropertyRepository propertyRepository, PropertyAddressMatcher propertyAddressMatcher) { // add in PropertyVendorMappingEntity propertyVendorMapper in the parameters
        this.propertyRepository = propertyRepository;
        this.propertyAddressMatcher = propertyAddressMatcher;
    }

    @Transactional(readOnly = true)
    public List<PropertyResponse> matchByAddress(String address, String name) {
        return propertyAddressMatcher.findMatches(address, name).stream().map(PropertyEntity::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PropertyResponse> getAllProperties() {
        return propertyRepository.findAll().stream()
                // .map(propertyVendorMapper::toResponse) - will replace current mapping to response below
                .map(PropertyEntity::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PropertyResponse getPropertyById(UUID propertyId) {
        PropertyEntity property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new OpenApiResourceNotFoundException("Property not found in database."));
        // return propertyVendorMapper.toResponse(property) - will replace current return statement below
        return property.toResponse();
    }

    public PropertyResponse createProperty(PropertyCreateRequest request) {
        PropertyEntity createdProperty = PropertyEntity.builder()
                .propertyId(UUID.randomUUID())
                .name(request.getName())
                .streetAddress(request.getStreetAddress())
                .city(request.getCity())
                .state(request.getState())
                .zipCode(request.getZipCode())
                .status("ACTIVE")
                .build();
        PropertyEntity savedProperty = propertyRepository.save(createdProperty);
        // return propertyVendorMapper.toRepsonse(savedProperty) - will replace current return statement below
        return savedProperty.toResponse();
    }
}