import type { VendorResponse, VendorCreateRequest, VendorUpdateRequest } from "@/types/vendor.ts";
import type { Vendor as UIVendor } from "@/types.ts";
import { apiClient } from "@/app/services/apiClient.ts";
import { toUIVendor, toBackendVendorCreate, CreateVendorInput } from "@/app/adapters/vendorAdapter.ts";

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

/**
 * High-level creation function that adapts UI form input to backend DTO and
 * returns the created vendor as a rich UI Vendor model.
 */
export async function createUIVendor(input: CreateVendorInput): Promise<UIVendor> {
  const req = toBackendVendorCreate(input);
  const dto = await createVendor(req);
  return toUIVendor(dto);
}

/**
 * High-level fetch function that fetches backend Vendor DTOs and adapts them
 * to the rich UI Vendor model.
 */
export async function fetchUIVendors(existingVendors?: UIVendor[]): Promise<UIVendor[]> {
  const backendDtos = await getVendors();
  if (!Array.isArray(backendDtos)) return [];
  return backendDtos.map((dto) => {
    const existing = existingVendors?.find((v) => v.id === dto.vendorUuid);
    return toUIVendor(dto, existing);
  });
}
