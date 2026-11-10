package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.PropertiesApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.AccountsPayableApprovalMatrixService;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class PropertyController implements PropertiesApi {

    private final PropertyService propertyService;
    private final AccountsPayableApprovalMatrixService matrixService;

    public PropertyController(PropertyService propertyService, AccountsPayableApprovalMatrixService matrixService) {
        this.propertyService = propertyService;
        this.matrixService = matrixService;
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
    public ResponseEntity<List<AccountsPayableApprovalMatrixResponse>> getPropertyApprovalMatrix(UUID propertyId) {
        return ResponseEntity.ok(matrixService.getPropertyApprovalMatrix(propertyId));
    }

    @Override
    public ResponseEntity<AccountsPayableApprovalMatrixResponse> addPropertyApprovalMatrixStep(
            UUID propertyId, AccountsPayableApprovalMatrixStepRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(matrixService.addMatrixStep(propertyId, request));
    }

    @Override
    public ResponseEntity<AccountsPayableApprovalMatrixResponse> updatePropertyApprovalMatrixStep(
            UUID propertyId, Integer sequence, AccountsPayableApprovalMatrixStepRequest request) {
        return ResponseEntity.ok(matrixService.updateMatrixStep(propertyId, sequence, request));
    }

    @Override
    public ResponseEntity<Void> deletePropertyApprovalMatrixStep(UUID propertyId, Integer sequence) {
        matrixService.deleteMatrixStep(propertyId, sequence);
        return ResponseEntity.noContent().build();
    }

    @Override
    public ResponseEntity<ApprovalQueueResponse> calculateInvoiceApprovalQueue(
            UUID propertyId, Double grossAmount, String costType) {
        return ResponseEntity.ok(matrixService.calculateInvoiceRoutingQueue(propertyId, grossAmount, costType));
    }
}
