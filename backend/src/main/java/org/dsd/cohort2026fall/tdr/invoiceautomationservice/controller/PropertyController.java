package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.PropertiesApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyPolicyService;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class PropertyController implements PropertiesApi {

    private final PropertyService propertyService;
    private final PropertyPolicyService propertyPolicyService;

    public PropertyController(PropertyService propertyService, PropertyPolicyService propertyPolicyService) {
        this.propertyService = propertyService;
        this.propertyPolicyService = propertyPolicyService;
    }

    @Override
    public ResponseEntity<List<PropertyResponse>> getProperties() {
        return ResponseEntity.ok(propertyService.getAllProperties());
    }

    @Override
    public ResponseEntity<PropertyResponse> createProperty(PropertyCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(propertyService.createProperty(request));
    }

    @Override
    public ResponseEntity<PropertyResponse> getPropertyById(UUID propertyId) {
        return ResponseEntity.ok(propertyService.getPropertyById(propertyId));
    }

    @Override
    public ResponseEntity<List<PropertyCategoryResponse>> getPropertyCategories() {
        return ResponseEntity.ok(propertyService.getAllPropertyCategories());
    }

    @Override
    public ResponseEntity<List<PropertyGlAccountResponse>> getPropertyGlAccounts(UUID propertyId) {
        return ResponseEntity.ok(propertyService.getAllPropertyGlAccounts(propertyId));
    }

    @Override
    public ResponseEntity<List<PropertyUserPolicyResponse>> getPropertyUserPolicies(UUID propertyId) {
        return ResponseEntity.ok(propertyPolicyService.getPropertyUserPolicies(propertyId));
    }

    @Override
    public ResponseEntity<PropertyUserPolicyResponse> assignPropertyUserPolicy(
            UUID propertyId, UUID userUuid, PropertyUserPolicyAssignmentRequest request) {
        return ResponseEntity.ok(propertyPolicyService.assignUserPolicy(propertyId, userUuid, request));
    }

    @Override
    public ResponseEntity<Void> removePropertyUserPolicy(UUID propertyId, UUID userUuid) {
        propertyPolicyService.removeUserPolicy(propertyId, userUuid);
        return ResponseEntity.noContent().build();
    }
}
