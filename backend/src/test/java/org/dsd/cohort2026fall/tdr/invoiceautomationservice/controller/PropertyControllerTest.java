package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.exception.GlobalExceptionHandler;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PropertyGlAccountResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PolicyEvaluationRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PolicyEvaluationResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.AccountsPayableApprovalMatrixService;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PolicyEngineService;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.service.PropertyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PropertyController.class)
@Import(GlobalExceptionHandler.class)
class PropertyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PropertyService propertyService;

    @MockitoBean
    private AccountsPayableApprovalMatrixService matrixService;

    @MockitoBean
    private PolicyEngineService policyEngineService;

    @Test
    void getPropertyGlAccounts_returns200WithList() throws Exception {
        UUID propertyId = UUID.randomUUID();
        UUID glAccountUuid = UUID.randomUUID();

        PropertyGlAccountResponse account = new PropertyGlAccountResponse();
        account.setPropertyGlAccountUuid(glAccountUuid);
        account.setGlCode("5100");
        account.setPropertyUuid(propertyId);
        account.setGlAccountName("Janitorial & Cleaning");
        account.setDescription("Daily office cleaning");
        account.setStatus("ACTIVE");

        when(propertyService.getAllPropertyGlAccounts(propertyId)).thenReturn(List.of(account));

        mockMvc.perform(get("/api/v1/properties/{propertyId}/gl-accounts", propertyId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].propertyGlAccountUuid").value(glAccountUuid.toString()))
                .andExpect(jsonPath("$[0].glCode").value("5100"))
                .andExpect(jsonPath("$[0].glAccountName").value("Janitorial & Cleaning"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));

        verify(propertyService).getAllPropertyGlAccounts(propertyId);
    }

    @Test
    void getPropertyGlAccounts_emptyList_returns200() throws Exception {
        UUID propertyId = UUID.randomUUID();
        when(propertyService.getAllPropertyGlAccounts(propertyId)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/properties/{propertyId}/gl-accounts", propertyId)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        verify(propertyService).getAllPropertyGlAccounts(propertyId);
    }

    @Test
    void evaluatePropertyPolicy_returns200WithEvaluation() throws Exception {
        UUID propertyId = UUID.randomUUID();
        PolicyEvaluationResponse mockResponse = new PolicyEvaluationResponse();
        mockResponse.setPropertyUuid(propertyId);
        mockResponse.setGrossAmount(450.0);
        mockResponse.setCostType("VARIABLE");
        mockResponse.setConfidenceScore(95);
        mockResponse.setIsAutoApproved(true);
        mockResponse.setRequiresHumanReview(false);
        mockResponse.setAutoPayEligible(true);
        mockResponse.setTier(PolicyEvaluationResponse.TierEnum.AUTO_APPROVED);
        mockResponse.setReason("Auto-approved below Step 0 threshold with 95% OCR confidence.");
        mockResponse.setStep0Threshold(1000.0);

        when(policyEngineService.evaluate(eq(propertyId), any(PolicyEvaluationRequest.class))).thenReturn(mockResponse);

        String payload = """
            {
                "grossAmount": 450.0,
                "confidenceScore": 95,
                "costType": "VARIABLE"
            }
        """;

        mockMvc.perform(post("/api/v1/properties/{propertyId}/policy-evaluation", propertyId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.propertyUuid").value(propertyId.toString()))
                .andExpect(jsonPath("$.grossAmount").value(450.0))
                .andExpect(jsonPath("$.isAutoApproved").value(true))
                .andExpect(jsonPath("$.requiresHumanReview").value(false))
                .andExpect(jsonPath("$.autoPayEligible").value(true))
                .andExpect(jsonPath("$.tier").value("auto_approved"))
                .andExpect(jsonPath("$.reason").value("Auto-approved below Step 0 threshold with 95% OCR confidence."));

        verify(policyEngineService).evaluate(eq(propertyId), any(PolicyEvaluationRequest.class));
    }
}
