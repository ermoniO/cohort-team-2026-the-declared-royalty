package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AddressRecord;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyCategoryResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.springdoc.api.OpenApiResourceNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final JdbcTemplate jdbcTemplate;

    public PropertyService(PropertyRepository propertyRepository, JdbcTemplate jdbcTemplate) {
        this.propertyRepository = propertyRepository;
        this.jdbcTemplate = jdbcTemplate;
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

    @Transactional(readOnly = true)
    public List<PropertyCategoryResponse> getAllPropertyCategories() {
        String sql = "SELECT category_code, name, description FROM property_categories WHERE status = 'ACTIVE' ORDER BY name ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            PropertyCategoryResponse res = new PropertyCategoryResponse();
            res.setCategoryCode(rs.getString("category_code"));
            res.setName(rs.getString("name"));
            res.setDescription(rs.getString("description"));
            return res;
        });
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

        String category = request.getCategory() != null && !request.getCategory().isBlank()
                ? request.getCategory()
                : "COMMERCIAL_OFFICE";

        PropertyEntity createdProperty = PropertyEntity.builder()
                .propertyId(UUID.randomUUID())
                .name(request.getName())
                .category(category)
                .address(addressRecord)
                .status("ACTIVE")
                .build();

        PropertyEntity savedProperty = propertyRepository.save(createdProperty);
        return savedProperty.toResponse();
    }
}
