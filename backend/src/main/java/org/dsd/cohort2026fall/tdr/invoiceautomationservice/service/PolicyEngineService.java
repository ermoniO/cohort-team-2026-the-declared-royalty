package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.*;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.PolicyEvaluationResponse.TierEnum;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional(readOnly = true)
public class PolicyEngineService {

    public static final int MIN_CONFIDENCE_SCORE = 85;

    private final AccountsPayableApprovalMatrixService matrixService;

    public PolicyEngineService(AccountsPayableApprovalMatrixService matrixService) {
        this.matrixService = matrixService;
    }

    public PolicyEvaluationResponse evaluate(UUID propertyId, PolicyEvaluationRequest request) {
        double grossAmount = request.getGrossAmount() != null ? request.getGrossAmount() : 0.0;
        int confidence = request.getConfidenceScore() != null ? request.getConfidenceScore() : 95;
        String costType = (request.getCostType() != null)
                ? request.getCostType().getValue()
                : "VARIABLE";
        boolean isFixed = "FIXED_MONTHLY".equalsIgnoreCase(costType);

        List<AccountsPayableApprovalMatrixResponse> matrix = matrixService.getPropertyApprovalMatrix(propertyId);
        Optional<AccountsPayableApprovalMatrixResponse> step0Opt = matrix.stream()
                .filter(s -> s.getAccountsPayableApprovalSequence() != null && s.getAccountsPayableApprovalSequence() == 0)
                .findFirst();

        double step0EffectiveLimit = 0.0;
        double fixedAutoMax = 0.0;
        boolean isLimitNone = true;

        if (step0Opt.isPresent()) {
            AccountsPayableApprovalMatrixResponse step0 = step0Opt.get();
            step0EffectiveLimit = isFixed
                    ? (step0.getFixedAutoMax() != null ? step0.getFixedAutoMax() : 0.0)
                    : (step0.getVariableMax() != null ? step0.getVariableMax() : 0.0);
            fixedAutoMax = step0.getFixedAutoMax() != null ? step0.getFixedAutoMax() : 0.0;
            isLimitNone = "LIMIT_NONE".equalsIgnoreCase(step0.getAccountsPayableThresholdSlug())
                    || step0EffectiveLimit <= 0.0;
        }

        ApprovalQueueResponse queue = matrixService.calculateInvoiceRoutingQueue(propertyId, grossAmount, costType);
        List<ApprovalQueueStepResponse> queueSteps = (queue != null && queue.getSteps() != null)
                ? queue.getSteps()
                : Collections.emptyList();

        ApprovalQueueStepResponse clearingStep = queueSteps.isEmpty() ? null : queueSteps.get(queueSteps.size() - 1);

        boolean isAutoApproved;
        boolean requiresHumanReview;
        boolean autoPayEligible;
        TierEnum tier;
        String reason;

        if (isLimitNone) {
            isAutoApproved = false;
            requiresHumanReview = true;
            autoPayEligible = false;
            tier = resolveTier(clearingStep);
            reason = "AI automation is disabled for this property (Step 0 threshold is LIMIT_NONE). Human review required.";
        } else if (confidence < MIN_CONFIDENCE_SCORE) {
            isAutoApproved = false;
            requiresHumanReview = true;
            autoPayEligible = false;
            tier = resolveTier(clearingStep);
            reason = "OCR confidence score (" + confidence + "%) is below the minimum threshold (" + MIN_CONFIDENCE_SCORE + "%). Human review required.";
        } else if (grossAmount <= step0EffectiveLimit) {
            isAutoApproved = true;
            requiresHumanReview = false;
            autoPayEligible = grossAmount <= fixedAutoMax;
            tier = TierEnum.AUTO_APPROVED;
            reason = "Auto-approved below Step 0 threshold with " + confidence + "% OCR confidence.";
            if (!queueSteps.isEmpty()) {
                clearingStep = queueSteps.get(0);
            }
        } else {
            isAutoApproved = false;
            requiresHumanReview = true;
            autoPayEligible = false;
            tier = resolveTier(clearingStep);
            String seatName = clearingStep != null ? clearingStep.getSeatDisplayName() : "fiduciary authority";
            reason = String.format(Locale.US,
                    "Invoice amount ($%.2f) exceeds Step 0 threshold ($%.2f). Escalated to %s.",
                    grossAmount, step0EffectiveLimit, seatName);
        }

        PolicyEvaluationResponse response = new PolicyEvaluationResponse();
        response.setPropertyUuid(propertyId);
        response.setGrossAmount(grossAmount);
        response.setCostType(costType);
        response.setConfidenceScore(confidence);
        response.setIsAutoApproved(isAutoApproved);
        response.setRequiresHumanReview(requiresHumanReview);
        response.setAutoPayEligible(autoPayEligible);
        response.setTier(tier);
        response.setReason(reason);
        response.setStep0Threshold(step0EffectiveLimit);
        response.setClearingStep(clearingStep);
        response.setRoutingSteps(queueSteps);

        return response;
    }

    private TierEnum resolveTier(ApprovalQueueStepResponse clearingStep) {
        if (clearingStep == null || clearingStep.getSequence() == null) {
            return TierEnum.PROPERTY_MANAGER;
        }
        return clearingStep.getSequence() <= 2 ? TierEnum.PROPERTY_MANAGER : TierEnum.VP_FINANCE;
    }
}
