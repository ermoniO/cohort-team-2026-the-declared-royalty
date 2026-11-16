import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePropertyPolicy } from "@/app/services/policyService";
import { API_BASE_URL } from "@/app/services/apiClient";
import type { components } from "@/types/api.generated";

type PolicyEvaluationRequest = components["schemas"]["PolicyEvaluationRequest"];
type PolicyEvaluationResponse = components["schemas"]["PolicyEvaluationResponse"];

const PROPERTY_ID = "4a1c2a9e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";
const BASE_URL = `${API_BASE_URL}/api/v1/properties/${PROPERTY_ID}/policy-evaluation`;

const mockResponse: PolicyEvaluationResponse = {
  propertyUuid: PROPERTY_ID,
  grossAmount: 450.0,
  costType: "VARIABLE",
  confidenceScore: 95,
  isAutoApproved: true,
  requiresHumanReview: false,
  autoPayEligible: true,
  tier: "auto_approved",
  reason: "Auto-approved below Step 0 threshold with 95% OCR confidence.",
  step0Threshold: 1000.0,
  routingSteps: [],
};

const fetchMock = vi.fn<typeof fetch>();

function respondWith(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

function lastRequest() {
  const [url, init] = fetchMock.mock.lastCall ?? [];
  return { url: String(url), init };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("policyService", () => {
  describe("evaluatePropertyPolicy", () => {
    const request: PolicyEvaluationRequest = {
      grossAmount: 450.0,
      confidenceScore: 95,
      costType: "VARIABLE",
    };

    it("POSTs the policy evaluation request to the property endpoint and returns the response", async () => {
      respondWith(200, mockResponse);

      const result = await evaluatePropertyPolicy(PROPERTY_ID, request);

      expect(result).toEqual(mockResponse);

      const { url, init } = lastRequest();
      expect(url).toBe(BASE_URL);
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify(request));
      expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    });

    it("rejects when the property is not found (404)", async () => {
      respondWith(404, { status: 404, message: `Property not found: ${PROPERTY_ID}` });

      await expect(evaluatePropertyPolicy(PROPERTY_ID, request)).rejects.toThrow("404");
    });
  });
});
