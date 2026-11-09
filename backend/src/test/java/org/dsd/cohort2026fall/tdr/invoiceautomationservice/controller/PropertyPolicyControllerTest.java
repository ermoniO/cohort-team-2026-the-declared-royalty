package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.BadRequestException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.GlobalExceptionHandler;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.ResourceNotFoundException;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyPolicyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {CorporatePolicyController.class, PropertyController.class})
@Import(GlobalExceptionHandler.class)
class PropertyPolicyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PropertyPolicyService propertyPolicyService;

    @MockitoBean
    private org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyService propertyService;

    @Test
    void getRoles_returns200WithRolesList() throws Exception {
        RoleResponse role = new RoleResponse();
        role.setRoleSlug("SENIOR_PROPERTY_MANAGER");
        role.setDisplayName("Senior Property Manager (SPM)");
        role.setDescription("Manages flagship assets");
        role.setStatus("ACTIVE");

        when(propertyPolicyService.getAllRoles()).thenReturn(List.of(role));

        mockMvc.perform(get("/api/v1/roles").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].roleSlug").value("SENIOR_PROPERTY_MANAGER"))
                .andExpect(jsonPath("$[0].displayName").value("Senior Property Manager (SPM)"));

        verify(propertyPolicyService).getAllRoles();
    }

    @Test
    void getCorporatePolicyTiers_returns200WithTiersList() throws Exception {
        CorporatePolicyTierResponse tier = new CorporatePolicyTierResponse();
        tier.setTierSlug("TIER_2_MID_SPM");
        tier.setDisplayName("Senior PM Operational Tier");
        tier.setAllowedRole("SENIOR_PROPERTY_MANAGER");
        tier.setVariableMax(5000.0);
        tier.setFixedAutoMax(10000.0);
        tier.setStatus("ACTIVE");

        when(propertyPolicyService.getAllPolicyTiers()).thenReturn(List.of(tier));

        mockMvc.perform(get("/api/v1/corporate-policy-tiers").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].tierSlug").value("TIER_2_MID_SPM"))
                .andExpect(jsonPath("$[0].variableMax").value(5000.0))
                .andExpect(jsonPath("$[0].fixedAutoMax").value(10000.0));

        verify(propertyPolicyService).getAllPolicyTiers();
    }

    @Test
    void getPropertyUserPolicies_returns200WithAssignments() throws Exception {
        UUID propertyId = UUID.randomUUID();
        UUID userUuid = UUID.randomUUID();

        PropertyUserPolicyResponse assignment = new PropertyUserPolicyResponse();
        assignment.setPropertyUuid(propertyId);
        assignment.setUserUuid(userUuid);
        assignment.setUserName("Sarah Jenkins");
        assignment.setUserEmail("s.jenkins@pmfirm.com");
        assignment.setUserRole("SENIOR_PROPERTY_MANAGER");
        assignment.setTierSlug("TIER_2_MID_SPM");
        assignment.setTierDisplayName("Senior PM Operational Tier");
        assignment.setVariableMax(5000.0);
        assignment.setFixedAutoMax(10000.0);
        assignment.setStatus("ACTIVE");
        assignment.setCreatedAt(OffsetDateTime.now());
        assignment.setUpdatedAt(OffsetDateTime.now());

        when(propertyPolicyService.getPropertyUserPolicies(propertyId)).thenReturn(List.of(assignment));

        mockMvc.perform(get("/api/v1/properties/{propertyId}/user-policies", propertyId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].userName").value("Sarah Jenkins"))
                .andExpect(jsonPath("$[0].tierSlug").value("TIER_2_MID_SPM"));

        verify(propertyPolicyService).getPropertyUserPolicies(propertyId);
    }

    @Test
    void assignPropertyUserPolicy_validPayload_returns200() throws Exception {
        UUID propertyId = UUID.randomUUID();
        UUID userUuid = UUID.randomUUID();

        PropertyUserPolicyResponse response = new PropertyUserPolicyResponse();
        response.setPropertyUuid(propertyId);
        response.setUserUuid(userUuid);
        response.setUserName("Sarah Jenkins");
        response.setUserEmail("s.jenkins@pmfirm.com");
        response.setUserRole("SENIOR_PROPERTY_MANAGER");
        response.setTierSlug("TIER_2_MID_SPM");
        response.setTierDisplayName("Senior PM Operational Tier");
        response.setVariableMax(5000.0);
        response.setFixedAutoMax(10000.0);
        response.setStatus("ACTIVE");
        response.setCreatedAt(OffsetDateTime.now());
        response.setUpdatedAt(OffsetDateTime.now());

        when(propertyPolicyService.assignUserPolicy(eq(propertyId), eq(userUuid), any(PropertyUserPolicyAssignmentRequest.class)))
                .thenReturn(response);

        String json = "{\"userUuid\":\"" + userUuid + "\",\"tierSlug\":\"TIER_2_MID_SPM\"}";

        mockMvc.perform(put("/api/v1/properties/{propertyId}/user-policies/{userUuid}", propertyId, userUuid)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tierSlug").doesNotExist())
                .andExpect(jsonPath("$.tierSlug").value("TIER_2_MID_SPM"))
                .andExpect(jsonPath("$.variableMax").value(5000.0));

        verify(propertyPolicyService).assignUserPolicy(eq(propertyId), eq(userUuid), any(PropertyUserPolicyAssignmentRequest.class));
    }

    @Test
    void assignPropertyUserPolicy_illegalRoleTier_returns400() throws Exception {
        UUID propertyId = UUID.randomUUID();
        UUID userUuid = UUID.randomUUID();

        when(propertyPolicyService.assignUserPolicy(eq(propertyId), eq(userUuid), any(PropertyUserPolicyAssignmentRequest.class)))
                .thenThrow(new BadRequestException("Policy tier 'TIER_3_HIGH_RD' is not legally allowed for role 'PROPERTY_MANAGER'"));

        String json = "{\"userUuid\":\"" + userUuid + "\",\"tierSlug\":\"TIER_3_HIGH_RD\"}";

        mockMvc.perform(put("/api/v1/properties/{propertyId}/user-policies/{userUuid}", propertyId, userUuid)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Policy tier 'TIER_3_HIGH_RD' is not legally allowed for role 'PROPERTY_MANAGER'"));
    }

    @Test
    void removePropertyUserPolicy_returns204() throws Exception {
        UUID propertyId = UUID.randomUUID();
        UUID userUuid = UUID.randomUUID();

        doNothing().when(propertyPolicyService).removeUserPolicy(propertyId, userUuid);

        mockMvc.perform(delete("/api/v1/properties/{propertyId}/user-policies/{userUuid}", propertyId, userUuid))
                .andExpect(status().isNoContent());

        verify(propertyPolicyService).removeUserPolicy(propertyId, userUuid);
    }
}

