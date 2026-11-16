package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.PropertyVendorMappingsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingUpdateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyVendorMappingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class PropertyVendorMappingController implements PropertyVendorMappingsApi {

    private final PropertyVendorMappingService mappingService;

    public PropertyVendorMappingController(PropertyVendorMappingService mappingService) {
        this.mappingService = mappingService;
    }

    @Override
    public ResponseEntity<List<PropertyVendorMappingResponse>> getPropertyVendorMappings(
            UUID propertyId, UUID vendorId, String status) {
        return ResponseEntity.ok(mappingService.getMappings(propertyId, vendorId, status));
    }

    @Override
    public ResponseEntity<PropertyVendorMappingResponse> createPropertyVendorMapping(
            PropertyVendorMappingCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mappingService.createMapping(request));
    }

    @Override
    public ResponseEntity<PropertyVendorMappingResponse> updatePropertyVendorMapping(
            UUID mappingUuid, PropertyVendorMappingUpdateRequest request) {
        return ResponseEntity.ok(mappingService.updateMapping(mappingUuid, request));
    }
}

