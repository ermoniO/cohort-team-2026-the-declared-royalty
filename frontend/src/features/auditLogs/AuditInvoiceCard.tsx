import { formatCurrency } from "@/features/invoices/invoiceFormat";
import InvoiceStatusPill from "@/features/invoices/InvoiceStatusPill";
import type { InvoiceResponse } from "@/types/invoice";

type AuditInvoiceCardProps = {
  invoice: InvoiceResponse | undefined;
  loading: boolean;
};

export default function AuditInvoiceCard({ invoice, loading }: AuditInvoiceCardProps) {
  if (!invoice) {
    return (
      <div className="rounded-xl border border-[#e6ebe8] bg-white px-5 py-4">
        <p className="font-inter-regular text-sm text-[#68766f]" role="status">
          {loading ? "Loading bill…" : "Bill details aren't available. The history below is still complete."}
        </p>
      </div>
    );
  }

  const title = invoice.vendorName ?? invoice.originalFilename ?? "Unmatched invoice";
  const subtitle = invoice.propertyName ?? "Not matched to a property yet";

  return (
    <section aria-label="Bill" className="rounded-xl border border-[#e6ebe8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="font-inter-semibold flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f4f2] text-[#25362f]"
          >
            {title.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="font-inter-semibold truncate text-base text-[#14532d]" title={title}>
              {title}
            </h2>
            <p className="font-inter-regular truncate text-[13px] text-[#68766f]">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-inter-semibold text-2xl tabular-nums text-[#25362f]">
            {invoice.amount === null ? "—" : formatCurrency(invoice.amount)}
          </p>
          <p className="font-inter-regular text-xs text-[#98a29c]">USD</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-inter-regular text-[13px] text-[#68766f]">Current status</span>
          <InvoiceStatusPill invoice={invoice} />
        </div>
        <span className="font-inter-regular text-xs text-[#98a29c]">Invoice context · not audit fields</span>
      </div>
    </section>
  );
}
