import type { Property as UIProperty, PayerPolicy } from '../../types';
import type {
  PropertyResponse,
  PropertyCreateRequest,
  PropertyTypeDTO,
  AddressDTO,
} from '../../types/property';
import { COMPANY_DEFAULT_POLICY } from '../../data/mockData';

export const UI_TO_BACKEND_PROPERTY_TYPE: Record<UIProperty['propertyType'], PropertyTypeDTO> = {
  commercial_office: 'COMMERCIAL_OFFICE',
  retail_plaza: 'RETAIL_PLAZA',
  industrial_park: 'INDUSTRIAL_PARK',
  medical_center: 'MEDICAL_CENTER',
};

export const BACKEND_TO_UI_PROPERTY_TYPE: Record<PropertyTypeDTO, UIProperty['propertyType']> = {
  COMMERCIAL_OFFICE: 'commercial_office',
  RETAIL_PLAZA: 'retail_plaza',
  INDUSTRIAL_PARK: 'industrial_park',
  MEDICAL_CENTER: 'medical_center',
};

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

  const uiType = dto.propertyType
    ? BACKEND_TO_UI_PROPERTY_TYPE[dto.propertyType] || 'commercial_office'
    : existingUIProp?.propertyType || 'commercial_office';

  const defaultPolicy: PayerPolicy = { ...COMPANY_DEFAULT_POLICY };

  return {
    id: dto.propertyId,
    name: dto.name,
    address: fullAddress,
    propertyType: uiType,
    managerName: existingUIProp?.managerName || 'Operations Manager',
    sqft: existingUIProp?.sqft || 250000,
    policy: existingUIProp?.policy || defaultPolicy,
    hasCustomPolicy: existingUIProp?.hasCustomPolicy ?? false,
  };
}

export interface CreatePropertyInput {
  name: string;
  propertyType: UIProperty['propertyType'];
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
  const backendType = UI_TO_BACKEND_PROPERTY_TYPE[ui.propertyType] || 'COMMERCIAL_OFFICE';

  return {
    name: ui.name.trim() || 'Untitled Property',
    propertyType: backendType,
    address: {
      streetAddress: ui.streetAddress.trim() || '',
      city: ui.city.trim() || '',
      state: ui.state.trim().toUpperCase() || '',
      zipCode: ui.zipCode.trim() || '',
    },
  };
}
