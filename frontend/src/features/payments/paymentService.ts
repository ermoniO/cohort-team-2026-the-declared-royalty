import { apiClient } from "@/app/services/apiClient";
import type { PaymentPageResponse, PaymentResponse, PaymentStatus, PaymentSummaryResponse } from "@/types/payment";

export type PaymentListQuery = {
  page?: number;
  size?: number;
  statuses?: PaymentStatus[];
  search?: string;
};

export type PaymentExceptionAction = "RETRY" | "VOID";

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

export function resolvePaymentException(
  paymentId: string,
  action: PaymentExceptionAction,
  user: string,
  note: string,
): Promise<PaymentResponse> {
  return apiClient.post<PaymentResponse>(`/api/v1/payments/${paymentId}/exception-resolution`, {
    action,
    user,
    note,
  }, undefined, false);
}
