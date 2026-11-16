import type { PropertyResponse, PropertyCreateRequest, PropertyUpdateRequest} from "@/types/property.ts";
import {apiClient} from "@/app/services/apiClient.ts";

export function getProperties(): Promise<PropertyResponse[]> {
    return apiClient.get<PropertyResponse[]>("/api/v1/properties");
}

export function getPropertyById(propertyId: string): Promise<PropertyResponse> {
    return apiClient.get<PropertyResponse>(`/api/v1/properties/${propertyId}`);
}

export function createProperty(request: PropertyCreateRequest,): Promise<PropertyResponse> {
    return apiClient.post<PropertyResponse, PropertyCreateRequest>("/api/v1/properties", request);
}

// The backend endpoint is still being built; until it ships this fails with 405 Method Not Allowed
export function updateProperty(propertyId: string, request: PropertyUpdateRequest): Promise<PropertyResponse> {
    return apiClient.put<PropertyResponse, PropertyUpdateRequest>(`/api/v1/properties/${propertyId}`, request);
}

// Being built by the backend team; until it ships this fails with 405 Method Not Allowed
export function deleteProperty(propertyId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/properties/${propertyId}`);
}