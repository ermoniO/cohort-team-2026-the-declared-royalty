import type { InvoiceResponse } from "@/types/invoice";
import { INVOICE_STATUS_BADGES } from "./invoiceStatus";

// The colored status badge, shared by the Bills table and the audit log header
export default function InvoiceStatusPill({ invoice }: { invoice: InvoiceResponse }) {
  const badge = INVOICE_STATUS_BADGES[invoice.invoiceStatus];
  return (
    <span
      className={`font-inter-medium inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${badge.className}`}
      title={invoice.failureReason ?? undefined}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${badge.dotClassName}`} />
      {badge.label}
    </span>
  );
}