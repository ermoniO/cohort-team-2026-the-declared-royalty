import { API_BASE_URL, apiClient } from "@/app/services/apiClient";
import type { InvoiceAnalysisResponse, InvoiceUpdateRequest } from "@/types/api";
import type { InvoicePageResponse, InvoiceResponse, InvoiceStatus, InvoiceSummaryResponse } from "@/types/invoice";

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
  return apiClient.get<InvoicePageResponse>(invoiceListUrl(query), undefined, false);
}

export async function getInvoiceByUuid(invoiceUuid: string): Promise<InvoiceResponse> {
  const { data, error } = await apiClient.GET("/api/v1/invoices/{invoiceUuid}", {
    params: { path: { invoiceUuid } },
  });
  if (error || !data) throw new Error(`Invoice ${invoiceUuid} not found`);
  return data as unknown as InvoiceResponse;
}

// receivedSince is the start of the user's "today", so "received today" follows their time zone
export function getInvoiceSummary(receivedSince: Date): Promise<InvoiceSummaryResponse> {
  const params = new URLSearchParams({ receivedSince: receivedSince.toISOString() });
  return apiClient.get<InvoiceSummaryResponse>(`/api/v1/invoices/summary?${params.toString()}`, undefined, false);
}

// The original uploaded file, served inline by the backend (opens in a new tab)
export function invoiceFileUrl(invoiceUuid: string): string {
  return `${API_BASE_URL}/api/v1/invoices/${invoiceUuid}/file`;
}

export async function patchInvoice(
  invoiceUuid: string,
  payload: InvoiceUpdateRequest,
): Promise<InvoiceResponse> {
  const { data, error } = await apiClient.PATCH("/api/v1/invoices/{invoiceUuid}", {
    params: { path: { invoiceUuid } },
    body: payload,
  });
  if (error || !data) throw new Error(`Failed to update invoice ${invoiceUuid}`);
  return data as unknown as InvoiceResponse;
}

export async function analyzeInvoice(invoiceUuid: string): Promise<InvoiceAnalysisResponse> {
  const { data, error } = await apiClient.PUT("/api/v1/invoices/{invoiceUuid}", {
    params: { path: { invoiceUuid } },
  });
  if (error || !data) throw new Error(`Failed to analyze invoice ${invoiceUuid}`);
  return data;
}
