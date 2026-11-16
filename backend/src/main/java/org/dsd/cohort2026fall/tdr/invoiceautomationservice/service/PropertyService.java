package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.AddressRecord;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyCategoryResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyGlAccountResponse;
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

    @Transactional(readOnly = true)
    public List<PropertyGlAccountResponse> getAllPropertyGlAccounts(UUID propertyId) {
        String sql = "SELECT property_gl_account_uuid, gl_code, property_uuid, gl_account_name, description, status " +
                     "FROM property_gl_accounts WHERE property_uuid = ? AND status = 'ACTIVE' ORDER BY gl_code ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            PropertyGlAccountResponse res = new PropertyGlAccountResponse();
            res.setPropertyGlAccountUuid((UUID) rs.getObject("property_gl_account_uuid"));
            res.setGlCode(rs.getString("gl_code"));
            res.setPropertyUuid((UUID) rs.getObject("property_uuid"));
            res.setGlAccountName(rs.getString("gl_account_name"));
            res.setDescription(rs.getString("description"));
            res.setStatus(rs.getString("status"));
            return res;
        }, propertyId);
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
                .ownerEntity(request.getOwnerEntity())
                .sqft(request.getSqft())
                .address(addressRecord)
                .status("ACTIVE")
                .build();

        PropertyEntity savedProperty = propertyRepository.save(createdProperty);

        // Automatically initialize default Step 0 (Intake Floor) and Step 5 (Permanent Safety Net)
        try {
            String initStepSql = """
                INSERT INTO accounts_payable_approval_matrix 
                    (property_uuid, accounts_payable_seat_slug, accounts_payable_threshold_slug, accounts_payable_approval_sequence, status)
                VALUES 
                    (?, 'CORP_HQ_ACCOUNTANT_01', 'LIMIT_LOW', 0, 'ACTIVE'),
                    (?, 'CORP_VP_OF_OPERATIONS', 'LIMIT_UNLIMITED', 5, 'ACTIVE')
            """;
            jdbcTemplate.update(initStepSql, savedProperty.getPropertyId(), savedProperty.getPropertyId());
        } catch (Exception ignored) {
            // Best-effort initialization if default seats exist
        }

        return savedProperty.toResponse();
    }
}
