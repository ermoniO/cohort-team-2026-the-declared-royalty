import { apiClient } from "./apiClient";
import type {
  PropertyCategoryResponse,
  VendorCategoryResponse,
  PaymentMethodResponse,
} from "@/types/api";

export async function fetchPropertyCategories(): Promise<PropertyCategoryResponse[]> {
  const { data, error } = await apiClient.GET("/api/v1/properties/categories");
  return !error && Array.isArray(data) ? data : [];
}

export async function fetchVendorCategories(): Promise<VendorCategoryResponse[]> {
  const { data, error } = await apiClient.GET("/api/v1/vendors/categories");
  return !error && Array.isArray(data) ? data : [];
}

export async function fetchPaymentMethods(): Promise<PaymentMethodResponse[]> {
  const { data, error } = await apiClient.GET("/api/v1/vendors/payment-methods");
  return !error && Array.isArray(data) ? data : [];
}
