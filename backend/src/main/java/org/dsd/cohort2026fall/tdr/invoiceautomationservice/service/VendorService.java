package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class VendorService {

    private static final String MISSING_VALUE = "NULL";

    private final VendorRepository vendorRepository;
    private final JdbcTemplate jdbcTemplate;

    public VendorService(VendorRepository vendorRepository, JdbcTemplate jdbcTemplate) {
        this.vendorRepository = vendorRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<VendorResponse> getAllVendors() {
        return vendorRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public VendorResponse getVendorByUuid(UUID vendorUuid) {
        return toResponse(findVendor(vendorUuid));
    }

    @Transactional(readOnly = true)
    public List<VendorCategoryResponse> getAllVendorCategories() {
        String sql = "SELECT category_code, name, description FROM vendor_categories WHERE status = 'ACTIVE' ORDER BY name ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            VendorCategoryResponse res = new VendorCategoryResponse();
            res.setCategoryCode(rs.getString("category_code"));
            res.setName(rs.getString("name"));
            res.setDescription(rs.getString("description"));
            return res;
        });
    }

    @Transactional(readOnly = true)
    public List<PaymentMethodResponse> getAllPaymentMethods() {
        String sql = "SELECT method_code, name, description FROM payment_methods WHERE status = 'ACTIVE' ORDER BY name ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            PaymentMethodResponse res = new PaymentMethodResponse();
            res.setMethodCode(rs.getString("method_code"));
            res.setName(rs.getString("name"));
            res.setDescription(rs.getString("description"));
            return res;
        });
    }

    public VendorResponse createVendor(VendorCreateRequest request) {
        VendorStatus status = request.getStatus() != null ? request.getStatus() : VendorStatus.ACTIVE;
        String paymentMethod = request.getPaymentMethod() != null ? request.getPaymentMethod().getValue() : "ACH";
        OffsetDateTime now = now();

        VendorEntity entity = new VendorEntity();
        entity.setVendorId(UUID.randomUUID());
        entity.setName(request.getName());
        entity.setCategory(request.getCategory());
        entity.setTaxId(request.getTaxId());
        entity.setPhoneNumber(toStored(request.getPhoneNumber()));
        entity.setStatus(status.getValue());
        entity.setPaymentUrl(toStored(request.getPaymentUrl()));
        entity.setPaymentMethod(paymentMethod);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        VendorEntity saved = vendorRepository.save(entity);
        return toResponse(saved);
    }

    public VendorResponse updateVendor(UUID vendorUuid, VendorUpdateRequest request) {
        VendorEntity entity = findVendor(vendorUuid);

        if (request.getName() != null) {
            entity.setName(request.getName());
        }
        if (request.getCategory() != null) {
            entity.setCategory(request.getCategory());
        }
        if (request.getTaxId() != null) {
            entity.setTaxId(request.getTaxId());
        }
        if (isProvided(request.getPhoneNumber())) {
            entity.setPhoneNumber(nullIfNullKeyword(request.getPhoneNumber()));
        }
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus().getValue());
        }
        if (isProvided(request.getPaymentUrl())) {
            entity.setPaymentUrl(nullIfNullKeyword(request.getPaymentUrl()));
        }
        if (request.getPaymentMethod() != null) {
            entity.setPaymentMethod(request.getPaymentMethod().getValue());
        }
        entity.setUpdatedAt(now());

        VendorEntity saved = vendorRepository.save(entity);
        return toResponse(saved);
    }

    private String toStored(String value) {
        return isProvided(value) ? nullIfNullKeyword(value) : MISSING_VALUE;
    }

    private boolean isProvided(String value) {
        return value != null && !value.isEmpty();
    }

    private String nullIfNullKeyword(String value) {
        return MISSING_VALUE.equalsIgnoreCase(value) ? null : value;
    }

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
        response.setCategory(entity.getCategory());
        response.setTaxId(entity.getTaxId());
        response.setPhoneNumber(entity.getPhoneNumber());
        response.setStatus(VendorStatus.fromValue(entity.getStatus()));
        response.setPaymentUrl(entity.getPaymentUrl());
        response.setPaymentMethod(PaymentMethod.fromValue(entity.getPaymentMethod()));
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
