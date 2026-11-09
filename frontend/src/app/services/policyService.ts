import type {
  RoleResponse,
  CorporatePolicyTierResponse,
  PropertyUserPolicyResponse,
  PropertyUserPolicyAssignmentRequest,
} from '@/types/api';
import { apiClient } from './apiClient';

export async function getRoles(): Promise<RoleResponse[]> {
  const { data, error } = await apiClient.GET('/api/v1/roles');
  if (error || !data) return [];
  return data;
}

export async function getCorporatePolicyTiers(): Promise<CorporatePolicyTierResponse[]> {
  const { data, error } = await apiClient.GET('/api/v1/corporate-policy-tiers');
  if (error || !data) return [];
  return data;
}

export async function getPropertyUserPolicies(
  propertyId: string
): Promise<PropertyUserPolicyResponse[]> {
  const { data, error } = await apiClient.GET(
    '/api/v1/properties/{propertyId}/user-policies',
    {
      params: { path: { propertyId } },
    }
  );
  if (error || !data) return [];
  return data;
}

export async function assignPropertyUserPolicy(
  propertyId: string,
  userUuid: string,
  request: PropertyUserPolicyAssignmentRequest
): Promise<PropertyUserPolicyResponse> {
  const { data, error } = await apiClient.PUT(
    '/api/v1/properties/{propertyId}/user-policies/{userUuid}',
    {
      params: { path: { propertyId, userUuid } },
      body: request,
    }
  );
  if (error || !data) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to assign user policy tier');
  }
  return data;
}

export async function removePropertyUserPolicy(
  propertyId: string,
  userUuid: string
): Promise<void> {
  const { error } = await apiClient.DELETE(
    '/api/v1/properties/{propertyId}/user-policies/{userUuid}',
    {
      params: { path: { propertyId, userUuid } },
    }
  );
  if (error) {
    const serverMsg = (error as { message?: string })?.message;
    throw new Error(serverMsg || 'Failed to remove user policy assignment');
  }
}

