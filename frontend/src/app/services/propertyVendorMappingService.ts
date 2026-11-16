import { apiClient } from '@/app/services/apiClient';
import type { PropertyVendorRelationship } from '@/types';
import type {
  PropertyVendorMappingCreateRequest,
  PropertyVendorMappingResponse,
  PropertyVendorMappingUpdateRequest,
} from '@/types/api';

export type PropertyVendorMappingQuery = {
  propertyId?: string;
  vendorId?: string;
  status?: string;
};

export async function getPropertyVendorMappings(
  query?: PropertyVendorMappingQuery,
): Promise<PropertyVendorMappingResponse[]> {
  const { data, error } = await apiClient.GET('/api/v1/property-vendor-mappings', {
    params: { query },
  });
  if (error) throw new Error('Failed to fetch property-vendor mappings');
  return data ?? [];
}

export async function createPropertyVendorMapping(
  request: PropertyVendorMappingCreateRequest,
): Promise<PropertyVendorMappingResponse> {
  const { data, error } = await apiClient.POST('/api/v1/property-vendor-mappings', {
    body: request,
  });
  if (error || !data) throw new Error('Failed to create property-vendor mapping');
  return data;
}

export async function updatePropertyVendorMapping(
  mappingUuid: string,
  request: PropertyVendorMappingUpdateRequest,
): Promise<PropertyVendorMappingResponse> {
  const { data, error } = await apiClient.PATCH('/api/v1/property-vendor-mappings/{mappingUuid}', {
    params: { path: { mappingUuid } },
    body: request,
  });
  if (error || !data) throw new Error(`Failed to update property-vendor mapping ${mappingUuid}`);
  return data;
}

export function mapMappingDtoToUI(dto: PropertyVendorMappingResponse): PropertyVendorRelationship {
  return {
    id: dto.mappingUuid,
    propertyId: dto.propertyUuid,
    propertyName: dto.propertyName ?? '',
    vendorId: dto.vendorUuid,
    vendorName: dto.vendorName ?? '',
    vendorAccountNumber: dto.vendorAccountNumber,
    autoApprovalEnabled: dto.autoApprovalEnabled,
    costType: dto.costType,
    defaultGlCode: dto.defaultGlCode ?? undefined,
    status: dto.status,
    createdAt: dto.createdAt,
  };
}

export async function fetchUIMappings(
  query?: PropertyVendorMappingQuery,
): Promise<PropertyVendorRelationship[]> {
  const dtos = await getPropertyVendorMappings(query);
  if (!Array.isArray(dtos)) return [];
  return dtos.map(mapMappingDtoToUI);
}

export async function createUIMapping(
  request: PropertyVendorMappingCreateRequest,
): Promise<PropertyVendorRelationship> {
  const dto = await createPropertyVendorMapping(request);
  return mapMappingDtoToUI(dto);
}

export async function updateUIMapping(
  mappingUuid: string,
  request: PropertyVendorMappingUpdateRequest,
): Promise<PropertyVendorRelationship> {
  const dto = await updatePropertyVendorMapping(mappingUuid, request);
  return mapMappingDtoToUI(dto);
}

