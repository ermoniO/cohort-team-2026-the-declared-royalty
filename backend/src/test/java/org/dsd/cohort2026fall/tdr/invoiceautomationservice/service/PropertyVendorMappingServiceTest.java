package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyVendorMappingEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.VendorEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyVendorMappingUpdateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyVendorMappingRepository;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.VendorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PropertyVendorMappingServiceTest {

    @Mock private PropertyVendorMappingRepository mappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private VendorRepository vendorRepository;

    @InjectMocks private PropertyVendorMappingService service;

    private UUID propertyId;
    private UUID vendorId;
    private PropertyEntity property;
    private VendorEntity vendor;

    @BeforeEach
    void setUp() {
        propertyId = UUID.randomUUID();
        vendorId = UUID.randomUUID();
        property = PropertyEntity.builder()
                .propertyId(propertyId)
                .name("Industrial Business Park")
                .build();
        vendor = VendorEntity.builder()
                .vendorId(vendorId)
                .name("Cedar Valley Pest Control")
                .category("GENERAL_MAINTENANCE")
                .paymentMethod("ACH")
                .phoneNumber("555-0100")
                .build();
    }

    @Test
    void getMappings_filtersByPropertyVendorAndStatus() {
        PropertyEntity otherProp = PropertyEntity.builder().propertyId(UUID.randomUUID()).name("Other").build();
        PropertyVendorMappingEntity active = PropertyVendorMappingEntity.builder()
                .mappingId(UUID.randomUUID())
                .property(property)
                .vendor(vendor)
                .vendorAccountNumber("2000456705")
                .costType("FIXED_MONTHLY")
                .defaultGlCode("5200")
                .autoApprovalEnabled(true)
                .status("ACTIVE")
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        PropertyVendorMappingEntity inactive = PropertyVendorMappingEntity.builder()
                .mappingId(UUID.randomUUID())
                .property(otherProp)
                .vendor(vendor)
                .vendorAccountNumber("9999")
                .costType("VARIABLE")
                .status("INACTIVE")
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
        when(mappingRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(active, inactive));

        List<PropertyVendorMappingResponse> result = service.getMappings(propertyId, vendorId, "ACTIVE");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMappingUuid()).isEqualTo(active.getMappingId());
        assertThat(result.get(0).getPropertyName()).isEqualTo("Industrial Business Park");
        assertThat(result.get(0).getVendorCategory()).isEqualTo("GENERAL_MAINTENANCE");
    }

    @Test
    void createMapping_createsNewAndNormalizesBlankGlCode() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendor));
        when(mappingRepository.findByVendor_VendorIdAndProperty_PropertyId(vendorId, propertyId))
                .thenReturn(Optional.empty());
        when(mappingRepository.save(any(PropertyVendorMappingEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        PropertyVendorMappingCreateRequest req = new PropertyVendorMappingCreateRequest(
                propertyId,
                vendorId,
                " 2000456705 ",
                PropertyVendorMappingCreateRequest.CostTypeEnum.FIXED_MONTHLY);
        req.setDefaultGlCode("   ");
        req.setAutoApprovalEnabled(true);

        PropertyVendorMappingResponse response = service.createMapping(req);

        assertThat(response.getMappingUuid()).isNotNull();
        assertThat(response.getVendorAccountNumber()).isEqualTo("2000456705");
        assertThat(response.getDefaultGlCode()).isNull();
        assertThat(response.getCostType()).isEqualTo(PropertyVendorMappingResponse.CostTypeEnum.FIXED_MONTHLY);
        assertThat(response.getAutoApprovalEnabled()).isTrue();
        assertThat(response.getStatus()).isEqualTo(PropertyVendorMappingResponse.StatusEnum.ACTIVE);
    }

    @Test
    void createMapping_updatesExistingPairGracefully() {
        UUID existingId = UUID.randomUUID();
        PropertyVendorMappingEntity existing = PropertyVendorMappingEntity.builder()
                .mappingId(existingId)
                .property(property)
                .vendor(vendor)
                .vendorAccountNumber("OLD-ACC")
                .costType("VARIABLE")
                .status("INACTIVE")
                .autoApprovalEnabled(false)
                .build();
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
        when(vendorRepository.findById(vendorId)).thenReturn(Optional.of(vendor));
        when(mappingRepository.findByVendor_VendorIdAndProperty_PropertyId(vendorId, propertyId))
                .thenReturn(Optional.of(existing));
        when(mappingRepository.save(any(PropertyVendorMappingEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        PropertyVendorMappingCreateRequest req = new PropertyVendorMappingCreateRequest(
                propertyId,
                vendorId,
                "2000456706",
                PropertyVendorMappingCreateRequest.CostTypeEnum.FIXED_MONTHLY);
        req.setDefaultGlCode("5400");
        req.setStatus(PropertyVendorMappingCreateRequest.StatusEnum.ACTIVE);

        PropertyVendorMappingResponse response = service.createMapping(req);

        assertThat(response.getMappingUuid()).isEqualTo(existingId);
        assertThat(response.getVendorAccountNumber()).isEqualTo("2000456706");
        assertThat(response.getDefaultGlCode()).isEqualTo("5400");
        assertThat(response.getStatus()).isEqualTo(PropertyVendorMappingResponse.StatusEnum.ACTIVE);
    }

    @Test
    void createMapping_missingProperty_throwsNotFound() {
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.empty());
        PropertyVendorMappingCreateRequest req = new PropertyVendorMappingCreateRequest(
                propertyId, vendorId, "123", PropertyVendorMappingCreateRequest.CostTypeEnum.VARIABLE);

        assertThatThrownBy(() -> service.createMapping(req))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void updateMapping_updatesFieldsAndClearsBlankGlCode() {
        UUID mappingId = UUID.randomUUID();
        PropertyVendorMappingEntity existing = PropertyVendorMappingEntity.builder()
                .mappingId(mappingId)
                .property(property)
                .vendor(vendor)
                .vendorAccountNumber("111")
                .costType("VARIABLE")
                .defaultGlCode("5100")
                .autoApprovalEnabled(false)
                .status("ACTIVE")
                .build();
        when(mappingRepository.findById(mappingId)).thenReturn(Optional.of(existing));
        when(mappingRepository.save(any(PropertyVendorMappingEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        PropertyVendorMappingUpdateRequest req = new PropertyVendorMappingUpdateRequest();
        req.setCostType(PropertyVendorMappingUpdateRequest.CostTypeEnum.FIXED_MONTHLY);
        req.setDefaultGlCode("");
        req.setAutoApprovalEnabled(true);

        PropertyVendorMappingResponse response = service.updateMapping(mappingId, req);

        assertThat(response.getCostType()).isEqualTo(PropertyVendorMappingResponse.CostTypeEnum.FIXED_MONTHLY);
        assertThat(response.getDefaultGlCode()).isNull();
        assertThat(response.getAutoApprovalEnabled()).isTrue();
    }

    @Test
    void updateMapping_missingId_throwsNotFound() {
        UUID mappingId = UUID.randomUUID();
        when(mappingRepository.findById(mappingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateMapping(mappingId, new PropertyVendorMappingUpdateRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}

