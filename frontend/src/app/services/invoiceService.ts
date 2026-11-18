import { apiClient } from "@/app/services/apiClient";
import type { Invoice } from "@/types/invoice";

export type InvoiceFilterParams = {
  status?: string;
  vendorSuppliedInvoiceId?: string;
};

export const invoiceService = {
  /**
   * Fetch all invoices with optional query filters.
   */
  async getAll(params?: InvoiceFilterParams): Promise<Invoice[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.vendorSuppliedInvoiceId) {
      query.set("vendorSuppliedInvoiceId", params.vendorSuppliedInvoiceId);
    }
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get<Invoice[]>(`/api/v1/invoices${queryString}`, undefined, false);
  },

  /**
   * Fetch a single invoice by its UUID.
   */
  async getById(invoiceId: string): Promise<Invoice> {
    return apiClient.get<Invoice>(`/api/v1/invoices/${invoiceId}`, undefined, false);
  },

  /**
   * Create a new invoice record.
   */
  async create(invoice: Partial<Invoice>): Promise<Invoice> {
    return apiClient.post<Invoice, Partial<Invoice>>("/api/v1/invoices", invoice, undefined, false);
  },

  /**
   * Update an existing invoice record.
   */
  async update(invoiceId: string, updates: Partial<Invoice>): Promise<Invoice> {
    return apiClient.put<Invoice, Partial<Invoice>>(`/api/v1/invoices/${invoiceId}`, updates, undefined, false);
  },

  /**
   * Delete an invoice.
   */
  async delete(invoiceId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/invoices/${invoiceId}`, undefined, false);
  },
};

