import { apiClient } from './apiClient';
import type {
  PropertyCategoryResponse,
  VendorCategoryResponse,
  PaymentMethodResponse,
} from '../../types/metadata';

export async function fetchPropertyCategories(): Promise<PropertyCategoryResponse[]> {
  try {
    const data = await apiClient.get<PropertyCategoryResponse[]>(
      '/api/v1/properties/categories',
      undefined,
      false
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchVendorCategories(): Promise<VendorCategoryResponse[]> {
  try {
    const data = await apiClient.get<VendorCategoryResponse[]>(
      '/api/v1/vendors/categories',
      undefined,
      false
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchPaymentMethods(): Promise<PaymentMethodResponse[]> {
  try {
    const data = await apiClient.get<PaymentMethodResponse[]>(
      '/api/v1/vendors/payment-methods',
      undefined,
      false
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
