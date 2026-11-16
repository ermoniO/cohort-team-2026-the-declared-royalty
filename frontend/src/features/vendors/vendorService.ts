import type { VendorResponse, VendorCreateRequest, VendorUpdateRequest } from "@/types/vendor.ts";
import {apiClient} from "@/app/services/apiClient.ts";

export function getVendors(): Promise<VendorResponse[]> {
    return apiClient.get<VendorResponse[]>("/api/v1/vendors");
}

export function getVendorByUuid(vendorUuid: string): Promise<VendorResponse> {
    return apiClient.get<VendorResponse>(`/api/v1/vendors/${vendorUuid}`);
}

// status defaults to ACTIVE and paymentMethod to ACH when omitted
export function createVendor(request: VendorCreateRequest): Promise<VendorResponse> {
    return apiClient.post<VendorResponse, VendorCreateRequest>("/api/v1/vendors", request);
}

// Partial update: only the fields sent are changed; send "NULL" to clear phoneNumber or paymentUrl
export function updateVendor(vendorUuid: string, request: VendorUpdateRequest): Promise<VendorResponse> {
    return apiClient.put<VendorResponse, VendorUpdateRequest>(`/api/v1/vendors/${vendorUuid}`, request);
}

// Not in the backend yet; until it ships this fails with 405 Method Not Allowed
export function deleteVendor(vendorUuid: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/vendors/${vendorUuid}`);
}
