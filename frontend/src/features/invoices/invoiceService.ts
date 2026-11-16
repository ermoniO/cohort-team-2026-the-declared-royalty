import {
  API_BASE_URL,
  apiClient,
  fetchWithAuth,
  HttpError,
} from "@/app/services/apiClient";
import type { InvoicePageResponse, InvoiceResponse, InvoiceStatus, InvoiceSummaryResponse } from "@/types/invoice"

export type InvoiceListQuery = {
  page?: number;
  size?: number;
  statuses?: InvoiceStatus[];
  search?: string;
};

// Builds /api/v1/invoices?page=0&size=20&status=A&status=B&q=...
export function invoiceListUrl({ page = 0, size = 20, statuses = [], search = "" }: InvoiceListQuery): string {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  for (const status of statuses) params.append("status", status);
  const q = search.trim();
  if (q) params.set("q", q);
  return `/api/v1/invoices?${params.toString()}`;
}

export function getInvoices(query: InvoiceListQuery): Promise<InvoicePageResponse> {
  return apiClient.get<InvoicePageResponse>(invoiceListUrl(query));
}

// One invoice; rejects with a 404 HttpError when it doesn't exist
export function getInvoiceByUuid(invoiceUuid: string): Promise<InvoiceResponse> {
  return apiClient.get<InvoiceResponse>(`/api/v1/invoices/${invoiceUuid}`);
}

// receivedSince is the start of the user's "today", so "received today" follows their time zone
export function getInvoiceSummary(receivedSince: Date): Promise<InvoiceSummaryResponse> {
  const params = new URLSearchParams({ receivedSince: receivedSince.toISOString() });
  return apiClient.get<InvoiceSummaryResponse>(`/api/v1/invoices/summary?${params.toString()}`);
}

export async function getInvoiceFile(invoiceUuid: string): Promise<Blob> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/v1/invoices/${invoiceUuid}/file`,
  );
  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Request failed with status ${response.status}: ${response.statusText}`,
    );
  }
  return response.blob();
}