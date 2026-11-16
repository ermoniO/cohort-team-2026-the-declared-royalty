import { apiClient } from "@/app/services/apiClient";
import type { components } from "@/types/api.generated";

export type PolicyEvaluationRequest = components["schemas"]["PolicyEvaluationRequest"];
export type PolicyEvaluationResponse = components["schemas"]["PolicyEvaluationResponse"];

export function evaluatePropertyPolicy(
  propertyId: string,
  request: PolicyEvaluationRequest,
): Promise<PolicyEvaluationResponse> {
  const url = `/api/v1/properties/${propertyId}/policy-evaluation`;
  return apiClient.post<PolicyEvaluationResponse, PolicyEvaluationRequest>(url, request, undefined, false);
}
