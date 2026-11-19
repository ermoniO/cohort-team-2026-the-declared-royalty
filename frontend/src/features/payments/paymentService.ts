import { apiClient } from "@/app/services/apiClient";
import type { AutoPaySettings, PaymentPageResponse, PaymentResponse, PaymentStatus, PaymentSummaryResponse } from "@/types/payment";

export type PaymentListQuery = {
  page?: number;
  size?: number;
  statuses?: PaymentStatus[];
  search?: string;
};

function paymentListUrl({ page = 0, size = 20, statuses = [], search = "" }: PaymentListQuery): string {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  for (const status of statuses) params.append("status", status);
  if (search.trim()) params.set("q", search.trim());
  return `/api/v1/payments?${params.toString()}`;
}

export function getPayments(query: PaymentListQuery = {}): Promise<PaymentPageResponse> {
  return apiClient.get<PaymentPageResponse>(paymentListUrl(query), undefined, false);
}

export function getPaymentSummary(): Promise<PaymentSummaryResponse> {
  return apiClient.get<PaymentSummaryResponse>("/api/v1/payments/summary", undefined, false);
}

export function getPayment(paymentId: string): Promise<PaymentResponse> {
  return apiClient.get<PaymentResponse>(`/api/v1/payments/${paymentId}`, undefined, false);
}

export function getAutoPaySettings(): Promise<AutoPaySettings> {
  return apiClient.get<AutoPaySettings>("/api/v1/payments/auto-pay", undefined, false);
}

export function updateAutoPaySettings(enabled: boolean): Promise<AutoPaySettings> {
  return apiClient.put<AutoPaySettings>("/api/v1/payments/auto-pay", { enabled }, undefined, false);
}

export function payNow(paymentId: string, approvedAmount: number): Promise<PaymentResponse> {
  return apiClient.post<PaymentResponse>(
    `/api/v1/payments/${paymentId}/pay-now`,
    { approvedAmount },
    undefined,
    false,
  );
}