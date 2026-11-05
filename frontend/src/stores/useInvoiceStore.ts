import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Invoice } from "@/types/invoice";
import { invoiceService, type InvoiceFilterParams } from "@/app/services/invoiceService";

/**
 * State definitions
 */
export interface InvoiceState {
  invoices: Invoice[];
  selectedInvoice: Invoice | null;
  isLoading: boolean;
  error: string | null;
  filters: InvoiceFilterParams;

  // Actions
  fetchInvoices: (params?: InvoiceFilterParams) => Promise<void>;
  fetchInvoiceById: (id: string) => Promise<void>;
  createInvoice: (invoice: Partial<Invoice>) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<Invoice>;
  deleteInvoice: (id: string) => Promise<void>;
  selectInvoice: (invoice: Invoice | null) => void;
  setFilters: (filters: InvoiceFilterParams) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  invoices: [],
  selectedInvoice: null,
  isLoading: false,
  error: null,
  filters: {},
};

export const useInvoiceStore = create<InvoiceState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchInvoices: async (params) => {
        const queryParams = params ?? get().filters;
        set({ isLoading: true, error: null }, false, "invoice/fetchInvoices/pending");

        try {
          const data = await invoiceService.getAll(queryParams);
          set(
            { invoices: data, isLoading: false, filters: queryParams },
            false,
            "invoice/fetchInvoices/fulfilled"
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to load invoices";
          set({ error: message, isLoading: false }, false, "invoice/fetchInvoices/rejected");
        }
      },

      fetchInvoiceById: async (id: string) => {
        set({ isLoading: true, error: null }, false, "invoice/fetchInvoiceById/pending");
        try {
          const invoice = await invoiceService.getById(id);
          set(
            { selectedInvoice: invoice, isLoading: false },
            false,
            "invoice/fetchInvoiceById/fulfilled"
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : `Failed to load invoice ${id}`;
          set({ error: message, isLoading: false }, false, "invoice/fetchInvoiceById/rejected");
        }
      },

      createInvoice: async (newInvoiceData) => {
        set({ isLoading: true, error: null }, false, "invoice/createInvoice/pending");
        try {
          const created = await invoiceService.create(newInvoiceData);
          set(
            (state) => ({
              invoices: [created, ...state.invoices],
              isLoading: false,
            }),
            false,
            "invoice/createInvoice/fulfilled"
          );
          return created;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Failed to create invoice";
          set({ error: message, isLoading: false }, false, "invoice/createInvoice/rejected");
          throw err;
        }
      },

      updateInvoice: async (id, updates) => {
        set({ isLoading: true, error: null }, false, "invoice/updateInvoice/pending");
        try {
          const updated = await invoiceService.update(id, updates);
          set(
            (state) => ({
              invoices: state.invoices.map((inv) => (inv.invoiceId === id ? updated : inv)),
              selectedInvoice:
                state.selectedInvoice?.invoiceId === id ? updated : state.selectedInvoice,
              isLoading: false,
            }),
            false,
            "invoice/updateInvoice/fulfilled"
          );
          return updated;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : `Failed to update invoice ${id}`;
          set({ error: message, isLoading: false }, false, "invoice/updateInvoice/rejected");
          throw err;
        }
      },

      deleteInvoice: async (id: string) => {
        set({ isLoading: true, error: null }, false, "invoice/deleteInvoice/pending");
        try {
          await invoiceService.delete(id);
          set(
            (state) => ({
              invoices: state.invoices.filter((inv) => inv.invoiceId !== id),
              selectedInvoice:
                state.selectedInvoice?.invoiceId === id ? null : state.selectedInvoice,
              isLoading: false,
            }),
            false,
            "invoice/deleteInvoice/fulfilled"
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : `Failed to delete invoice ${id}`;
          set({ error: message, isLoading: false }, false, "invoice/deleteInvoice/rejected");
          throw err;
        }
      },

      selectInvoice: (invoice) => {
        set({ selectedInvoice: invoice }, false, "invoice/selectInvoice");
      },

      setFilters: (filters) => {
        set({ filters }, false, "invoice/setFilters");
      },

      clearError: () => {
        set({ error: null }, false, "invoice/clearError");
      },

      reset: () => {
        set(initialState, false, "invoice/reset");
      },
    }),
    { name: "InvoiceStore" }
  )
);

