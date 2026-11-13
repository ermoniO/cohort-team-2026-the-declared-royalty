import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AuditLogsResponse } from "@/types/auditlogs";
import type { InvoiceResponse } from "@/types/invoice";
import type { UserResponse } from "@/types/user";
import { getAuditLogs } from "@/features/auditLogs/auditLogService";
import { DEFAULT_VIEW, type AuditLogView } from "@/features/auditLogs/auditLogDisplay";
import { getInvoiceByUuid, getInvoices } from "@/features/invoices/invoiceService";
import { getUsers } from "@/features/users/userService";

export interface AuditLogState {
  // The bill whose history is shown; null means every bill
  invoiceUuid: string | null;
  logs: AuditLogsResponse[];
  // Lookups for names and labels, keyed by UUID. Missing entries fall back to the UUID.
  invoices: Record<string, InvoiceResponse>;
  users: Record<string, UserResponse>;
  view: AuditLogView;
  isLoading: boolean;
  error: string | null;

  fetchHistory: (invoiceUuid: string | null) => Promise<void>;
  setView: (changes: Partial<AuditLogView>) => void;
  resetView: () => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  invoiceUuid: null,
  logs: [],
  invoices: {},
  users: {},
  view: DEFAULT_VIEW,
  isLoading: false,
  error: null,
};

function byId<T>(items: T[], getId: (item: T) => string): Record<string, T> {
  return Object.fromEntries(items.map((item) => [getId(item), item]));
}

// One bill's invoice, or the latest 100 so the all-bills view can name them
async function loadInvoices(invoiceUuid: string | null): Promise<InvoiceResponse[]> {
  if (invoiceUuid) return [await getInvoiceByUuid(invoiceUuid)];
  return (await getInvoices({ size: 100 })).items;
}

export const useAuditLogStore = create<AuditLogState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchHistory: async (invoiceUuid) => {
        set(
          { invoiceUuid, logs: [], invoices: {}, view: DEFAULT_VIEW, isLoading: true, error: null },
          false,
          "auditLog/fetchHistory/pending",
        );

        const [logs, invoices, users] = await Promise.allSettled([
          getAuditLogs(invoiceUuid ? { invoice: invoiceUuid } : {}),
          loadInvoices(invoiceUuid),
          getUsers(),
        ]);

        // The user opened another bill while this one was loading
        if (get().invoiceUuid !== invoiceUuid) return;

        if (logs.status === "rejected") {
          const message = logs.reason instanceof Error ? logs.reason.message : "Failed to load audit logs";
          set({ error: message, isLoading: false }, false, "auditLog/fetchHistory/rejected");
          return;
        }

        set(
          {
            logs: logs.value,
            invoices: invoices.status === "fulfilled" ? byId(invoices.value, (i) => i.invoiceUuid) : {},
            users: users.status === "fulfilled" ? byId(users.value, (u) => u.userId) : get().users,
            isLoading: false,
          },
          false,
          "auditLog/fetchHistory/fulfilled",
        );
      },

      setView: (changes) => {
        set((state) => ({ view: { ...state.view, ...changes } }), false, "auditLog/setView");
      },

      resetView: () => {
        set({ view: DEFAULT_VIEW }, false, "auditLog/resetView");
      },

      clearError: () => {
        set({ error: null }, false, "auditLog/clearError");
      },

      reset: () => {
        set(initialState, false, "auditLog/reset");
      },
    }),
    { name: "AuditLogStore" },
  ),
);