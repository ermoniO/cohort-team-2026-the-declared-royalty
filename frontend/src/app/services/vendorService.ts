import type { VendorResponse, VendorCreateRequest, VendorUpdateRequest } from "@/types/vendor.ts";
import {apiClient} from "@/app/services/apiClient.ts";

export function getVendors(): Promise<VendorResponse[]> {
    return apiClient.get<VendorResponse[]>("/api/v1/vendors", undefined, false);
}

export function getVendorByUuid(vendorUuid: string): Promise<VendorResponse> {
    return apiClient.get<VendorResponse>(`/api/v1/vendors/${vendorUuid}`, undefined, false);
}

// status defaults to ACTIVE and paymentMethod to ACH when omitted
export function createVendor(request: VendorCreateRequest): Promise<VendorResponse> {
    return apiClient.post<VendorResponse, VendorCreateRequest>("/api/v1/vendors", request, undefined, false);
}

// Partial update: only the fields sent are changed; send "NULL" to clear phoneNumber or paymentUrl
export function updateVendor(vendorUuid: string, request: VendorUpdateRequest): Promise<VendorResponse> {
    return apiClient.put<VendorResponse, VendorUpdateRequest>(`/api/v1/vendors/${vendorUuid}`, request, undefined, false);
}
import { apiClient } from "@/app/services/apiClient";
import type {
  Vendor,
  VendorCreateRequest,
  VendorUpdateRequest,
} from "@/types/vendor";

export const vendorService = {
  /**
   * Fetch all vendors from the Spring Boot API.
   * Endpoint: GET /api/v1/vendors
   */
  async getAll(): Promise<Vendor[]> {
    return apiClient.get<Vendor[]>("/api/v1/vendors", undefined, false);
  },

  /**
   * Fetch a single vendor by UUID.
   * Endpoint: GET /api/v1/vendors/{vendorUuid}
   */
  async getByUuid(vendorUuid: string): Promise<Vendor> {
    return apiClient.get<Vendor>(
      `/api/v1/vendors/${vendorUuid}`,
      undefined,
      false,
    );
  },

  /**
   * Create a new vendor.
   * Endpoint: POST /api/v1/vendors
   */
  async create(data: VendorCreateRequest): Promise<Vendor> {
    return apiClient.post<Vendor, VendorCreateRequest>(
      "/api/v1/vendors",
      data,
      undefined,
      false,
    );
  },

  /**
   * Update an existing vendor by UUID (partial update).
   * Endpoint: PUT /api/v1/vendors/{vendorUuid}
   */
  async update(
    vendorUuid: string,
    updates: VendorUpdateRequest,
  ): Promise<Vendor> {
    return apiClient.put<Vendor, VendorUpdateRequest>(
      `/api/v1/vendors/${vendorUuid}`,
      updates,
      undefined,
      false,
    );
  },
};

