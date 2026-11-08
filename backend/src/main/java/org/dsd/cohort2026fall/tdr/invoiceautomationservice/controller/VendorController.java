package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.VendorsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.VendorService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class VendorController implements VendorsApi {

    private final VendorService vendorService;

    public VendorController(VendorService vendorService) {
        this.vendorService = vendorService;
    }

    @Override
    public ResponseEntity<List<VendorResponse>> getVendors() {
        return ResponseEntity.ok(vendorService.getAllVendors());
    }

    @Override
    public ResponseEntity<VendorResponse> createVendor(VendorCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(vendorService.createVendor(request));
    }

    @Override
    public ResponseEntity<VendorResponse> getVendorByUuid(UUID vendorUuid) {
        return ResponseEntity.ok(vendorService.getVendorByUuid(vendorUuid));
    }

    @Override
    public ResponseEntity<VendorResponse> updateVendor(UUID vendorUuid, VendorUpdateRequest request) {
        return ResponseEntity.ok(vendorService.updateVendor(vendorUuid, request));
    }

    @Override
    public ResponseEntity<List<VendorCategoryResponse>> getVendorCategories() {
        return ResponseEntity.ok(vendorService.getAllVendorCategories());
    }

    @Override
    public ResponseEntity<List<PaymentMethod>> getVendorPaymentMethods() {
        return ResponseEntity.ok(vendorService.getAllPaymentMethods());
    }
}
