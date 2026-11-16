import type {
  PropertyResponse,
  PropertyCreateRequest,
  PropertyGlAccountResponse,
} from "@/types/api";
import type { PropertyUpdateRequest } from "@/types/property";
import type { Property as UIProperty } from "@/types";
import { apiClient } from "./apiClient";
import {
  toUIProperty,
  toBackendPropertyCreate,
  CreatePropertyInput,
} from "../adapters/propertyAdapter";

export async function getProperties(): Promise<PropertyResponse[]> {
  const { data, error } = await apiClient.GET("/api/v1/properties");
  if (error) throw new Error("Failed to fetch properties");
  return data ?? [];
}

export async function getPropertyById(propertyId: string): Promise<PropertyResponse> {
  const { data, error } = await apiClient.GET("/api/v1/properties/{propertyId}", {
    params: { path: { propertyId } },
  });
  if (error || !data) throw new Error(`Property ${propertyId} not found`);
  return data;
}

export async function createProperty(request: PropertyCreateRequest): Promise<PropertyResponse> {
  const { data, error } = await apiClient.POST("/api/v1/properties", {
    body: request,
  });
  if (error || !data) throw new Error("Failed to create property");
  return data;
}

export function updateProperty(propertyId: string, request: PropertyUpdateRequest): Promise<PropertyResponse> {
  return apiClient.put<PropertyResponse, PropertyUpdateRequest>(`/api/v1/properties/${propertyId}`, request, undefined, false);
}

export function deleteProperty(propertyId: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/properties/${propertyId}`, undefined, false);
}

export async function getPropertyGlAccounts(propertyId: string): Promise<PropertyGlAccountResponse[]> {
  const { data, error } = await apiClient.GET("/api/v1/properties/{propertyId}/gl-accounts", {
    params: { path: { propertyId } },
  });
  if (error || !data) return [];
  return data;
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
