import type { VendorResponse, VendorCreateRequest, VendorUpdateRequest } from "@/types/api";
import type { Vendor as UIVendor } from "@/types";
import { apiClient } from "@/app/services/apiClient";
import {
  toUIVendor,
  toBackendVendorCreate,
  CreateVendorInput,
} from "@/app/adapters/vendorAdapter";

export async function getVendors(): Promise<VendorResponse[]> {
  const { data, error } = await apiClient.GET("/api/v1/vendors");
  if (error) throw new Error("Failed to fetch vendors");
  return data ?? [];
}

export async function getVendorByUuid(vendorUuid: string): Promise<VendorResponse> {
  const { data, error } = await apiClient.GET("/api/v1/vendors/{vendorUuid}", {
    params: { path: { vendorUuid } },
  });
  if (error || !data) throw new Error(`Vendor ${vendorUuid} not found`);
  return data;
}

export async function createVendor(request: VendorCreateRequest): Promise<VendorResponse> {
  const { data, error } = await apiClient.POST("/api/v1/vendors", {
    body: request,
  });
  if (error || !data) throw new Error("Failed to create vendor");
  return data;
}

export async function updateVendor(
  vendorUuid: string,
  request: VendorUpdateRequest
): Promise<VendorResponse> {
  const { data, error } = await apiClient.PUT("/api/v1/vendors/{vendorUuid}", {
    params: { path: { vendorUuid } },
    body: request,
  });
  if (error || !data) throw new Error("Failed to update vendor");
  return data;
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
