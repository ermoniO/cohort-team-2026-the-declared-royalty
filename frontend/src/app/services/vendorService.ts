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

