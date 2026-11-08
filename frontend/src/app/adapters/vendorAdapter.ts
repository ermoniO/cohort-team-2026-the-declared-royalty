import type { Vendor as UIVendor, PaymentMethod } from '../../types';
import type { VendorResponse, VendorCreateRequest } from '../../types/vendor';

export interface CreateVendorInput {
  name: string;
  category: string;
  taxId: string;
  defaultPaymentMethod: PaymentMethod;
  phoneNumber?: string;
  paymentUrl?: string;
  remittanceAddress?: string;
}

/**
 * Adapter to translate backend VendorResponse DTO into rich UI Vendor model.
 * Preserves frontend fields (remittanceAddress) while populating
 * real backend fields (vendorUuid, name, category, taxId, phoneNumber, paymentUrl, paymentMethod, status).
 */
export function toUIVendor(
  dto: VendorResponse,
  existingUIVendor?: UIVendor
): UIVendor {
  const cleanPhone =
    dto.phoneNumber && dto.phoneNumber !== 'NULL' ? dto.phoneNumber : undefined;
  const cleanUrl =
    dto.paymentUrl && dto.paymentUrl !== 'NULL' ? dto.paymentUrl : undefined;

  let uiStatus: 'verified' | 'unverified' | 'pending_review' = 'verified';
  if (existingUIVendor?.status) {
    uiStatus = existingUIVendor.status;
  } else if (dto.status === 'INACTIVE') {
    uiStatus = 'unverified';
  }

  return {
    id: dto.vendorUuid,
    name: dto.name,
    category: dto.category || existingUIVendor?.category || '',
    accountNumber:
      existingUIVendor?.accountNumber || `ACT-${dto.vendorUuid.slice(0, 6).toUpperCase()}`,
    defaultPaymentMethod: dto.paymentMethod,
    remittanceAddress:
      existingUIVendor?.remittanceAddress || 'PO Box 1000, Commercial Suite, US',
    taxId: dto.taxId || existingUIVendor?.taxId || 'XX-XXXXXXX',
    status: uiStatus,
    historicalMatchesCount: existingUIVendor?.historicalMatchesCount || 1,
    phoneNumber: cleanPhone,
    paymentUrl: cleanUrl,
  };
}

/**
 * Adapter to transform UI Vendor into backend VendorCreateRequest.
 */
export function toBackendVendorCreate(
  ui: CreateVendorInput
): VendorCreateRequest {
  return {
    name: ui.name.trim() || 'Untitled Vendor',
    category: ui.category.trim(),
    taxId: ui.taxId.trim(),
    phoneNumber: ui.phoneNumber?.trim() || undefined,
    paymentUrl: ui.paymentUrl?.trim() || undefined,
    paymentMethod: ui.defaultPaymentMethod || 'ACH',
    status: 'ACTIVE',
  };
}
