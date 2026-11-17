import { useEffect, useState } from "react";
import { getInvoices } from "@/features/invoices/invoiceService";
import type { InvoiceResponse, InvoiceStatus } from "@/types/invoice";

export const PAYMENT_INVOICE_STATUSES: InvoiceStatus[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "PROCESSING_PAYMENT",
  "PAID",
  "FAILED",
];

export type PaymentSummaryData = {
  needsApprovalCount: number;
  scheduledCount: number;
  scheduledTotal: number;
  processingCount: number;
  processingTotal: number;
  paidCount: number;
  paidTotal: number;
};

export type PaymentSummaryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; data: PaymentSummaryData };

export function summarizePayments(items: InvoiceResponse[]): PaymentSummaryData {
  let needsApprovalCount = 0;
  let scheduledCount = 0;
  let scheduledTotal = 0;
  let processingCount = 0;
  let processingTotal = 0;
  let paidCount = 0;
  let paidTotal = 0;

  for (const invoice of items) {
    const amount = invoice.amount ?? 0;
    switch (invoice.invoiceStatus) {
      case "PENDING_APPROVAL":
        needsApprovalCount += 1;
        break;
      case "APPROVED":
        scheduledCount += 1;
        scheduledTotal += amount;
        break;
      case "PROCESSING_PAYMENT":
        processingCount += 1;
        processingTotal += amount;
        break;
      case "PAID":
        paidCount += 1;
        paidTotal += amount;
        break;
      default:
        break;
    }
  }

  return {
    needsApprovalCount,
    scheduledCount,
    scheduledTotal,
    processingCount,
    processingTotal,
    paidCount,
    paidTotal,
  };
}

export function usePaymentSummary(reloadKey = 0): PaymentSummaryState {
  const [result, setResult] = useState<{
    key: number;
    data?: PaymentSummaryData;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    getInvoices({ page: 0, size: 100, statuses: PAYMENT_INVOICE_STATUSES })
      .then((response) => {
        if (active) {
          setResult({ key: reloadKey, data: summarizePayments(response.items) });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({
            key: reloadKey,
            error: error instanceof Error ? error.message : "Unable to load payments.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (result?.key !== reloadKey) return { status: "loading" };
  if (result.error !== undefined) return { status: "error", message: result.error };
  return { status: "loaded", data: result.data as PaymentSummaryData };
}

