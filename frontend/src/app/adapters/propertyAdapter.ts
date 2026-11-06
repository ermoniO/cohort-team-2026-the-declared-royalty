import type { Property as UIProperty, PayerPolicy } from '../../types';
import type { PropertyResponse, PropertyCreateRequest } from '../../types/property';
import { COMPANY_DEFAULT_POLICY } from '../../data/mockData';

/**
 * Adapter to translate backend PropertyResponse DTO into the rich UI Property model.
 * Preserves user-configured policies, address, and fills sensible defaults for UI-only attributes.
 */
export function toUIProperty(
  dto: PropertyResponse,
  existingUIProp?: UIProperty
): UIProperty {
  const fullAddress = [dto.streetAddress, dto.city, dto.state, dto.zipCode]
    .filter(Boolean)
    .join(', ');

  const defaultPolicy: PayerPolicy = { ...COMPANY_DEFAULT_POLICY };

  return {
    id: dto.propertyId,
    name: dto.name,
    address: fullAddress,
    propertyType: existingUIProp?.propertyType || 'commercial_office',
    managerName: existingUIProp?.managerName || 'Operations Manager',
    sqft: existingUIProp?.sqft || 250000,
    policy: existingUIProp?.policy || defaultPolicy,
    hasCustomPolicy: existingUIProp?.hasCustomPolicy ?? false,
  };
}

/**
 * Adapter to transform a UI Property creation form into a backend PropertyCreateRequest.
 */
export function toBackendPropertyCreate(
  ui: Partial<UIProperty> & {
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  }
): PropertyCreateRequest {
  let street = ui.streetAddress || '';
  let city = ui.city || '';
  let state = ui.state || '';
  let zip = ui.zipCode || '';

  if (!street && ui.address) {
    const parts = ui.address.split(',').map((s) => s.trim());
    street = parts[0] || '';
    city = parts[1] || '';
    if (parts[2]) {
      const stateZip = parts[2].split(' ').filter(Boolean);
      state = stateZip[0] || '';
      zip = stateZip[1] || '';
    }
  }

  return {
    name: ui.name || 'Untitled Property',
    streetAddress: street || '100 Main St',
    city: city || 'Springfield',
    state: state || 'IL',
    zipCode: zip || '62701',
  };
}

