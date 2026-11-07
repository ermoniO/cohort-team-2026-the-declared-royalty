import type { PropertyResponse, PropertyCreateRequest } from "../../types/property";
import type { Property as UIProperty } from "../../types";
import { apiClient } from "./apiClient";
import { toUIProperty, toBackendPropertyCreate, CreatePropertyInput } from "../adapters/propertyAdapter";

export function getProperties(): Promise<PropertyResponse[]> {
  return apiClient.get<PropertyResponse[]>("/api/v1/properties", undefined, false);
}

export function getPropertyById(propertyId: string): Promise<PropertyResponse> {
  return apiClient.get<PropertyResponse>(`/api/v1/properties/${propertyId}`, undefined, false);
}

export function createProperty(request: PropertyCreateRequest): Promise<PropertyResponse> {
  return apiClient.post<PropertyResponse, PropertyCreateRequest>("/api/v1/properties", request, undefined, false);
}

/**
 * High-level creation function that adapts UI form input to backend DTO and
 * returns the created property as a UI Property model.
 */
export async function createUIProperty(input: CreatePropertyInput): Promise<UIProperty> {
  const req = toBackendPropertyCreate(input);
  const dto = await createProperty(req);
  return toUIProperty(dto);
}

/**
 * High-level fetch function that fetches backend Property DTOs and adapts them
 * to the rich UI Property model expected by the React state.
 */
export async function fetchUIProperties(existingProperties?: UIProperty[]): Promise<UIProperty[]> {
  const backendDtos = await getProperties();
  if (!Array.isArray(backendDtos)) {
    return [];
  }
  return backendDtos.map((dto) => {
    const existing = existingProperties?.find((p) => p.id === dto.propertyId);
    return toUIProperty(dto, existing);
  });
}
