import type { Vendor as UIVendor, PaymentMethod } from '../../types';
import type { VendorResponse, VendorCreateRequest } from '../../types/vendor';

/**
 * Adapter to translate backend VendorResponse DTO into rich UI Vendor model.
 * Preserves frontend fields (category, taxId, remittanceAddress) while populating
 * real backend fields (vendorUuid, name, phoneNumber, paymentUrl, paymentMethod, status).
 */
export function toUIVendor(
  dto: VendorResponse,
  existingUIVendor?: UIVendor
): UIVendor {
  const cleanPhone =
    dto.phoneNumber && dto.phoneNumber !== 'NULL' ? dto.phoneNumber : undefined;
  const cleanUrl =
    dto.paymentUrl && dto.paymentUrl !== 'NULL' ? dto.paymentUrl : undefined;

  // Frontend statuses: 'verified' | 'unverified' | 'pending_review'
  let uiStatus: 'verified' | 'unverified' | 'pending_review' = 'verified';
  if (existingUIVendor?.status) {
    uiStatus = existingUIVendor.status;
  } else if (dto.status === 'INACTIVE') {
    uiStatus = 'unverified';
  }

  return {
    id: dto.vendorUuid,
    name: dto.name,
    category: existingUIVendor?.category || 'Commercial Facilities & Services',
    accountNumber:
      existingUIVendor?.accountNumber || `ACT-${dto.vendorUuid.slice(0, 6).toUpperCase()}`,
    defaultPaymentMethod: dto.paymentMethod,
    remittanceAddress:
      existingUIVendor?.remittanceAddress || 'PO Box 1000, Commercial Suite, US',
    taxId: existingUIVendor?.taxId || 'XX-XXXXXXX',
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
  ui: Partial<UIVendor>
): VendorCreateRequest {
  return {
    name: ui.name || 'Untitled Vendor',
    phoneNumber: ui.phoneNumber,
    paymentUrl: ui.paymentUrl,
    paymentMethod: ui.defaultPaymentMethod || 'ACH',
    status: ui.status === 'unverified' ? 'INACTIVE' : 'ACTIVE',
  };
}

