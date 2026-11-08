import type { Property as UIProperty, PayerPolicy } from '../../types';
import type { PropertyResponse, PropertyCreateRequest } from '@/types/api';
import { COMPANY_DEFAULT_POLICY } from '../../data/mockData';

/**
 * Adapter to translate backend PropertyResponse DTO into the rich UI Property model.
 * Preserves user-configured policies, address, and fills sensible defaults for UI-only attributes.
 */
export function toUIProperty(
  dto: PropertyResponse,
  existingUIProp?: UIProperty
): UIProperty {
  const addr = dto.address;
  const fullAddress = addr
    ? [addr.streetAddress, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ')
    : '';

  const uiCategory = dto.category || existingUIProp?.propertyType || '';
  const defaultPolicy: PayerPolicy = { ...COMPANY_DEFAULT_POLICY };

  return {
    id: dto.propertyId,
    name: dto.name,
    address: fullAddress,
    propertyType: uiCategory,
    ownerEntity: dto.ownerEntity || existingUIProp?.ownerEntity,
    managerName: existingUIProp?.managerName || 'Operations Manager',
    sqft: dto.sqft ?? existingUIProp?.sqft ?? 250000,
    policy: existingUIProp?.policy || defaultPolicy,
    hasCustomPolicy: existingUIProp?.hasCustomPolicy ?? false,
  };
}

export interface CreatePropertyInput {
  name: string;
  category: string;
  ownerEntity?: string;
  sqft?: number;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * Adapter to transform a UI Property creation form into a backend PropertyCreateRequest.
 */
export function toBackendPropertyCreate(
  ui: CreatePropertyInput
): PropertyCreateRequest {
  return {
    name: ui.name.trim() || 'Untitled Property',
    category: ui.category.trim(),
    ownerEntity: ui.ownerEntity?.trim() || undefined,
    sqft: ui.sqft || undefined,
    address: {
      streetAddress: ui.streetAddress.trim() || '',
      city: ui.city.trim() || '',
      state: ui.state.trim().toUpperCase() || '',
      zipCode: ui.zipCode.trim() || '',
    },
  };
}
