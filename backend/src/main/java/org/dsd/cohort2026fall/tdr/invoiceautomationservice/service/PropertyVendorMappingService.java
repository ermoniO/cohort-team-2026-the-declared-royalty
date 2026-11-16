package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingUpdateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PropertyVendorMappingService {

    private final PropertyVendorMappingRepository mappingRepository;
    private final PropertyRepository propertyRepository;
    private final VendorRepository vendorRepository;

    public PropertyVendorMappingService(
            PropertyVendorMappingRepository mappingRepository,
            PropertyRepository propertyRepository,
            VendorRepository vendorRepository) {
        this.mappingRepository = mappingRepository;
        this.propertyRepository = propertyRepository;
        this.vendorRepository = vendorRepository;
    }

    @Transactional(readOnly = true)
    public List<PropertyVendorMappingResponse> getMappings(UUID propertyId, UUID vendorId, String status) {
        return mappingRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(m -> propertyId == null || (m.getProperty() != null && propertyId.equals(m.getProperty().getPropertyId())))
                .filter(m -> vendorId == null || (m.getVendor() != null && vendorId.equals(m.getVendor().getVendorId())))
                .filter(m -> status == null || status.isBlank() || status.trim().equalsIgnoreCase(m.getStatus()))
                .map(this::toResponse)
                .toList();
    }

    public PropertyVendorMappingResponse createMapping(PropertyVendorMappingCreateRequest request) {
        PropertyEntity property = propertyRepository.findById(request.getPropertyUuid())
                .orElseThrow(() -> new ResourceNotFoundException("Property not found: " + request.getPropertyUuid()));
        VendorEntity vendor = vendorRepository.findById(request.getVendorUuid())
                .orElseThrow(() -> new ResourceNotFoundException("Vendor not found: " + request.getVendorUuid()));

        String accountNumber = requireNonBlank(request.getVendorAccountNumber(), "vendorAccountNumber");
        String costType = request.getCostType() != null
                ? request.getCostType().getValue()
                : PropertyVendorMappingResponse.CostTypeEnum.VARIABLE.getValue();
        String status = request.getStatus() != null
                ? request.getStatus().getValue()
                : PropertyVendorMappingResponse.StatusEnum.ACTIVE.getValue();
        String glCode = blankToNull(request.getDefaultGlCode());
        boolean autoApproval = Boolean.TRUE.equals(request.getAutoApprovalEnabled());
        OffsetDateTime now = now();

        PropertyVendorMappingEntity entity = mappingRepository
                .findByVendor_VendorIdAndProperty_PropertyId(vendor.getVendorId(), property.getPropertyId())
                .orElseGet(() -> PropertyVendorMappingEntity.builder()
                        .mappingId(UUID.randomUUID())
                        .vendor(vendor)
                        .property(property)
                        .createdAt(now)
                        .build());

        entity.setVendorAccountNumber(accountNumber);
        entity.setCostType(costType);
        entity.setDefaultGlCode(glCode);
        entity.setAutoApprovalEnabled(autoApproval);
        entity.setStatus(status);
        entity.setUpdatedAt(now);

        return toResponse(mappingRepository.save(entity));
    }

    public PropertyVendorMappingResponse updateMapping(UUID mappingUuid, PropertyVendorMappingUpdateRequest request) {
        PropertyVendorMappingEntity entity = mappingRepository.findById(mappingUuid)
                .orElseThrow(() -> new ResourceNotFoundException("Property-vendor mapping not found: " + mappingUuid));

        if (request.getVendorAccountNumber() != null) {
            entity.setVendorAccountNumber(requireNonBlank(request.getVendorAccountNumber(), "vendorAccountNumber"));
        }
        if (request.getCostType() != null) {
            entity.setCostType(request.getCostType().getValue());
        }
        if (request.getDefaultGlCode() != null) {
            entity.setDefaultGlCode(blankToNull(request.getDefaultGlCode()));
        }
        if (request.getAutoApprovalEnabled() != null) {
            entity.setAutoApprovalEnabled(request.getAutoApprovalEnabled());
        }
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus().getValue());
        }
        entity.setUpdatedAt(now());

        return toResponse(mappingRepository.save(entity));
    }

    private PropertyVendorMappingResponse toResponse(PropertyVendorMappingEntity entity) {
        PropertyVendorMappingResponse response = new PropertyVendorMappingResponse();
        response.setMappingUuid(entity.getMappingId());
        if (entity.getProperty() != null) {
            response.setPropertyUuid(entity.getProperty().getPropertyId());
            response.setPropertyName(entity.getProperty().getName());
        }
        if (entity.getVendor() != null) {
            response.setVendorUuid(entity.getVendor().getVendorId());
            response.setVendorName(entity.getVendor().getName());
            response.setVendorCategory(entity.getVendor().getCategory());
        }
        response.setVendorAccountNumber(entity.getVendorAccountNumber());
        response.setCostType(PropertyVendorMappingResponse.CostTypeEnum.fromValue(entity.getCostType()));
        response.setDefaultGlCode(entity.getDefaultGlCode());
        response.setAutoApprovalEnabled(entity.isAutoApprovalEnabled());
        response.setStatus(PropertyVendorMappingResponse.StatusEnum.fromValue(entity.getStatus()));
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required");
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static OffsetDateTime now() {
        return OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS);
    }
}

