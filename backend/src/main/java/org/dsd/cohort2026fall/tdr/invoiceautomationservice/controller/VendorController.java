package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.VendorsApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PaymentMethod;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.VendorCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.VendorResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.VendorStatus;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.VendorUpdateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@RestController
public class VendorController implements VendorsApi {

    private final VendorRepository vendorRepository;

    public VendorController(VendorRepository vendorRepository) {
        this.vendorRepository = vendorRepository;
    }

    @Override
    public ResponseEntity<List<VendorResponse>> getVendors() {
        List<VendorResponse> vendors = vendorRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(vendors);
    }

    @Override
    public ResponseEntity<VendorResponse> createVendor(VendorCreateRequest request) {
        VendorStatus status = request.getStatus() != null ? request.getStatus() : VendorStatus.ACTIVE;
        PaymentMethod paymentMethod = request.getPaymentMethod() != null ? request.getPaymentMethod() : PaymentMethod.ACH;
        OffsetDateTime now = now();

        // No @GeneratedValue on the entity, so the UUID is assigned here
        VendorEntity entity = new VendorEntity();
        entity.setVendorId(UUID.randomUUID());
        entity.setName(request.getName());
        entity.setPhoneNumber(request.getPhoneNumber());
        entity.setStatus(status.getValue());
        entity.setPaymentUrl(request.getPaymentUrl());
        entity.setPaymentMethod(paymentMethod.getValue());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        VendorEntity saved = vendorRepository.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Override
    public ResponseEntity<VendorResponse> getVendorByUuid(UUID vendorUuid) {
        return ResponseEntity.ok(toResponse(findVendor(vendorUuid)));
    }

    @Override
    public ResponseEntity<VendorResponse> updateVendor(UUID vendorUuid, VendorUpdateRequest request) {
        VendorEntity entity = findVendor(vendorUuid);

        // Full replacement: optional fields omitted from the request are cleared.
        // vendorId and createdAt are intentionally left untouched.
        entity.setName(request.getName());
        entity.setPhoneNumber(request.getPhoneNumber());
        entity.setStatus(request.getStatus().getValue());
        entity.setPaymentUrl(request.getPaymentUrl());
        entity.setPaymentMethod(request.getPaymentMethod().getValue());
        entity.setUpdatedAt(now());

        VendorEntity saved = vendorRepository.save(entity);
        return ResponseEntity.ok(toResponse(saved));
    }

    // Postgres stores microseconds; truncate so the response matches what later reads return
    private OffsetDateTime now() {
        return OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }

    private VendorEntity findVendor(UUID vendorUuid) {
        return vendorRepository.findById(vendorUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Vendor not found: " + vendorUuid));
    }

    private VendorResponse toResponse(VendorEntity entity) {
        VendorResponse response = new VendorResponse();
        response.setVendorUuid(entity.getVendorId());
        response.setName(entity.getName());
        response.setPhoneNumber(entity.getPhoneNumber());
        response.setStatus(VendorStatus.fromValue(entity.getStatus()));
        response.setPaymentUrl(entity.getPaymentUrl());
        response.setPaymentMethod(PaymentMethod.fromValue(entity.getPaymentMethod()));
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
