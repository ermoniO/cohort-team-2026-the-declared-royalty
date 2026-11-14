import { API_BASE_URL, apiClient } from "@/app/services/apiClient";
import type {InvoiceExtractionResponse, InvoicePageResponse, InvoiceResponse, InvoiceStatus, InvoiceSummaryResponse, InvoiceVerifyRequest } from "@/types/invoice";
import { ApiError } from "./invoiceUploadService";

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

// TODO(auth): passes withAuth=false like the other services; drop `undefined, false` once login exists
export function getInvoices(query: InvoiceListQuery): Promise<InvoicePageResponse> {
  return apiClient.get<InvoicePageResponse>(invoiceListUrl(query), undefined, false);
}

// One invoice; rejects with a 404 HttpError when it doesn't exist
export function getInvoiceByUuid(invoiceUuid: string): Promise<InvoiceResponse> {
  return apiClient.get<InvoiceResponse>(`/api/v1/invoices/${invoiceUuid}`, undefined, false);
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

// Like apiClient.post, but keeps the backend's ErrorResponse message (e.g. "Account number
// doesn't match…") so the review modal can show it.
// TODO(auth): bypasses apiClient, so add the Authorization header here once login exists
async function postForJson<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = (await response.json()) as { message?: string };
      if (error.message) message = error.message;
    } catch {
      // body wasn't JSON
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}

// Runs the AI on the invoice's file; the free model can take 10–30 seconds
export function extractInvoice(invoiceUuid: string): Promise<InvoiceExtractionResponse> {
  return postForJson<InvoiceExtractionResponse>(`/api/v1/invoices/${invoiceUuid}/extract`);
}

// Saves the reviewer-confirmed values and sends the invoice for approval
export function verifyInvoice(invoiceUuid: string, request: InvoiceVerifyRequest): Promise<InvoiceResponse> {
  return postForJson<InvoiceResponse>(`/api/v1/invoices/${invoiceUuid}/verify`, request);
}

// The file as a Blob, so the review modal can show it through an object URL. Framing the
// backend URL directly is blocked: Spring Security sends X-Frame-Options: DENY by default.
export async function fetchInvoiceFile(invoiceUuid: string): Promise<Blob> {
  const response = await fetch(invoiceFileUrl(invoiceUuid));
  if (!response.ok) throw new ApiError(response.status, `Couldn't load the file (${response.status})`);
  return response.blob();
}