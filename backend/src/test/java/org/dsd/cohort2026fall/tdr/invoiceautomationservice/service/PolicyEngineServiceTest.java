package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PolicyEvaluationRequest.CostTypeEnum;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PolicyEvaluationResponse.TierEnum;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PolicyEngineServiceTest {

    @Mock
    private AccountsPayableApprovalMatrixService matrixService;

    private PolicyEngineService policyEngineService;

    private final UUID propertyId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        policyEngineService = new PolicyEngineService(matrixService);
    }

    private AccountsPayableApprovalMatrixResponse createMatrixStep(
            int sequence, String seatSlug, String seatDisplayName, String thresholdSlug,
            Double variableMax, Double fixedAutoMax) {
        AccountsPayableApprovalMatrixResponse step = new AccountsPayableApprovalMatrixResponse();
        step.setMatrixUuid(UUID.randomUUID());
        step.setPropertyUuid(propertyId);
        step.setAccountsPayableApprovalSequence(sequence);
        step.setAccountsPayableSeatSlug(seatSlug);
        step.setSeatDisplayName(seatDisplayName);
        step.setAccountsPayableThresholdSlug(thresholdSlug);
        step.setVariableMax(variableMax);
        step.setFixedAutoMax(fixedAutoMax);
        step.setAssignedUserUuid(UUID.randomUUID());
        step.setAssignedUserName("User " + seatSlug);
        step.setStatus("ACTIVE");
        return step;
    }

    private ApprovalQueueStepResponse createQueueStep(
            int sequence, String seatSlug, String seatDisplayName, String thresholdSlug,
            Double variableMax, Double fixedAutoMax) {
        ApprovalQueueStepResponse step = new ApprovalQueueStepResponse();
        step.setSequence(sequence);
        step.setSeatSlug(seatSlug);
        step.setSeatDisplayName(seatDisplayName);
        step.setThresholdSlug(thresholdSlug);
        step.setVariableMax(variableMax);
        step.setFixedAutoMax(fixedAutoMax);
        step.setUserUuid(UUID.randomUUID());
        step.setUserName("User " + seatSlug);
        step.setIsVacant(false);
        step.setIsProxy(false);
        return step;
    }

    private ApprovalQueueResponse createQueueResponse(Double grossAmount, String costType, List<ApprovalQueueStepResponse> steps) {
        ApprovalQueueResponse res = new ApprovalQueueResponse();
        res.setPropertyUuid(propertyId);
        res.setGrossAmount(grossAmount);
        res.setCostType(costType);
        res.setHasVacantStep(false);
        res.setSteps(steps);
        return res;
    }

    @Test
    void evaluate_step0LimitNone_aiDisabled_requiresHumanReview() {
        AccountsPayableApprovalMatrixResponse step0 = createMatrixStep(
                0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_NONE", 0.0, 0.0);
        AccountsPayableApprovalMatrixResponse step1 = createMatrixStep(
                1, "PROP_MGR", "Property Manager", "LIMIT_MID", 5000.0, 10000.0);

        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step0, step1));

        ApprovalQueueStepResponse q0 = createQueueStep(0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_NONE", 0.0, 0.0);
        ApprovalQueueStepResponse q1 = createQueueStep(1, "PROP_MGR", "Property Manager", "LIMIT_MID", 5000.0, 10000.0);
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 50.0, "VARIABLE"))
                .thenReturn(createQueueResponse(50.0, "VARIABLE", List.of(q0, q1)));

        PolicyEvaluationRequest req = new PolicyEvaluationRequest();
        req.setGrossAmount(50.0);
        req.setConfidenceScore(95);
        req.setCostType(CostTypeEnum.VARIABLE);

        PolicyEvaluationResponse res = policyEngineService.evaluate(propertyId, req);

        assertThat(res.getIsAutoApproved()).isFalse();
        assertThat(res.getRequiresHumanReview()).isTrue();
        assertThat(res.getAutoPayEligible()).isFalse();
        assertThat(res.getReason()).containsIgnoringCase("AI automation is disabled");
        assertThat(res.getTier()).isEqualTo(TierEnum.PROPERTY_MANAGER);
        assertThat(res.getClearingStep().getSequence()).isEqualTo(1);
    }

    @Test
    void evaluate_lowConfidence_requiresReviewRegardlessOfAmount() {
        AccountsPayableApprovalMatrixResponse step0 = createMatrixStep(
                0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step0));

        ApprovalQueueStepResponse q0 = createQueueStep(0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 15.0, "VARIABLE"))
                .thenReturn(createQueueResponse(15.0, "VARIABLE", List.of(q0)));

        PolicyEvaluationRequest req = new PolicyEvaluationRequest();
        req.setGrossAmount(15.0);
        req.setConfidenceScore(75);
        req.setCostType(CostTypeEnum.VARIABLE);

        PolicyEvaluationResponse res = policyEngineService.evaluate(propertyId, req);

        assertThat(res.getIsAutoApproved()).isFalse();
        assertThat(res.getRequiresHumanReview()).isTrue();
        assertThat(res.getAutoPayEligible()).isFalse();
        assertThat(res.getReason()).contains("75%").contains("85%");
        assertThat(res.getTier()).isEqualTo(TierEnum.PROPERTY_MANAGER);
        assertThat(res.getClearingStep().getSequence()).isEqualTo(0);
    }

    @Test
    void evaluate_highConfidenceUnderStep0_autoApproved() {
        AccountsPayableApprovalMatrixResponse step0 = createMatrixStep(
                0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step0));

        ApprovalQueueStepResponse q0 = createQueueStep(0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 800.0, "VARIABLE"))
                .thenReturn(createQueueResponse(800.0, "VARIABLE", List.of(q0)));

        PolicyEvaluationRequest req = new PolicyEvaluationRequest();
        req.setGrossAmount(800.0);
        req.setConfidenceScore(95);
        req.setCostType(CostTypeEnum.VARIABLE);

        PolicyEvaluationResponse res = policyEngineService.evaluate(propertyId, req);

        assertThat(res.getIsAutoApproved()).isTrue();
        assertThat(res.getRequiresHumanReview()).isFalse();
        assertThat(res.getAutoPayEligible()).isTrue();
        assertThat(res.getTier()).isEqualTo(TierEnum.AUTO_APPROVED);
        assertThat(res.getReason()).containsIgnoringCase("Auto-approved");
        assertThat(res.getClearingStep().getSequence()).isEqualTo(0);
    }

    @Test
    void evaluate_fixedMonthlyUnderAutoPayCap_autoPayEligible() {
        AccountsPayableApprovalMatrixResponse step0 = createMatrixStep(
                0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step0));

        ApprovalQueueStepResponse q0 = createQueueStep(0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 400.0, "FIXED_MONTHLY"))
                .thenReturn(createQueueResponse(400.0, "FIXED_MONTHLY", List.of(q0)));

        PolicyEvaluationRequest req = new PolicyEvaluationRequest();
        req.setGrossAmount(400.0);
        req.setConfidenceScore(95);
        req.setCostType(CostTypeEnum.FIXED_MONTHLY);

        PolicyEvaluationResponse res = policyEngineService.evaluate(propertyId, req);

        assertThat(res.getIsAutoApproved()).isTrue();
        assertThat(res.getAutoPayEligible()).isTrue();
    }

    @Test
    void evaluate_overStep0_escalatesToClearingStepInMatrix() {
        AccountsPayableApprovalMatrixResponse step0 = createMatrixStep(
                0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        AccountsPayableApprovalMatrixResponse step1 = createMatrixStep(
                1, "PROP_MGR", "Property Manager", "LIMIT_MID", 5000.0, 10000.0);
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step0, step1));

        ApprovalQueueStepResponse q0 = createQueueStep(0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        ApprovalQueueStepResponse q1 = createQueueStep(1, "PROP_MGR", "Property Manager", "LIMIT_MID", 5000.0, 10000.0);
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 4500.0, "VARIABLE"))
                .thenReturn(createQueueResponse(4500.0, "VARIABLE", List.of(q0, q1)));

        PolicyEvaluationRequest req = new PolicyEvaluationRequest();
        req.setGrossAmount(4500.0);
        req.setConfidenceScore(95);
        req.setCostType(CostTypeEnum.VARIABLE);

        PolicyEvaluationResponse res = policyEngineService.evaluate(propertyId, req);

        assertThat(res.getIsAutoApproved()).isFalse();
        assertThat(res.getRequiresHumanReview()).isTrue();
        assertThat(res.getAutoPayEligible()).isFalse();
        assertThat(res.getTier()).isEqualTo(TierEnum.PROPERTY_MANAGER);
        assertThat(res.getClearingStep().getSequence()).isEqualTo(1);
        assertThat(res.getReason()).contains("exceeds Step 0 threshold");
    }

    @Test
    void evaluate_overStep2_escalatesToVpFinance() {
        AccountsPayableApprovalMatrixResponse step0 = createMatrixStep(
                0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        AccountsPayableApprovalMatrixResponse step5 = createMatrixStep(
                5, "CORP_VP_OF_OPERATIONS", "VP Operations", "LIMIT_UNLIMITED", 10000000.0, 10000000.0);
        when(matrixService.getPropertyApprovalMatrix(propertyId)).thenReturn(List.of(step0, step5));

        ApprovalQueueStepResponse q0 = createQueueStep(0, "CORP_HQ_ACCOUNTANT_01", "HQ Accountant", "LIMIT_LOW", 1000.0, 2500.0);
        ApprovalQueueStepResponse q5 = createQueueStep(5, "CORP_VP_OF_OPERATIONS", "VP Operations", "LIMIT_UNLIMITED", 10000000.0, 10000000.0);
        when(matrixService.calculateInvoiceRoutingQueue(propertyId, 35000.0, "VARIABLE"))
                .thenReturn(createQueueResponse(35000.0, "VARIABLE", List.of(q0, q5)));

        PolicyEvaluationRequest req = new PolicyEvaluationRequest();
        req.setGrossAmount(35000.0);
        req.setConfidenceScore(95);
        req.setCostType(CostTypeEnum.VARIABLE);

        PolicyEvaluationResponse res = policyEngineService.evaluate(propertyId, req);

        assertThat(res.getIsAutoApproved()).isFalse();
        assertThat(res.getRequiresHumanReview()).isTrue();
        assertThat(res.getAutoPayEligible()).isFalse();
        assertThat(res.getTier()).isEqualTo(TierEnum.VP_FINANCE);
        assertThat(res.getClearingStep().getSequence()).isEqualTo(5);
    }
}
