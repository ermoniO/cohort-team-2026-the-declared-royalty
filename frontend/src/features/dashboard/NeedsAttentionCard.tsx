import { TbArrowRight } from "react-icons/tb";
import { navigateTo } from "@/app/navigation";
import { formatCurrency } from "@/features/invoices/invoiceFormat";
import { INVOICE_STATUS_BADGES } from "@/features/invoices/invoiceStatus";
import type { InvoicePageState } from "@/features/invoices/useInvoices";
import type { InvoiceResponse } from "@/types/invoice";

type NeedsAttentionCardProps = {
  state: InvoicePageState;
  onSelectInvoice: (invoice: InvoiceResponse) => void;
};

export default function NeedsAttentionCard({
  state,
  onSelectInvoice,
}: NeedsAttentionCardProps) {
  const items =
    state.status === "loaded"
      ? state.data.items
      : state.status === "loading"
        ? (state.previous?.items ?? [])
        : [];

  return (
    <div className="flex flex-col rounded-xl border border-[#e6ebe8] bg-white">
      <div className="flex items-center justify-between border-b border-[#e6ebe8] px-5 py-4">
        <div>
          <h2 className="font-inter-semibold text-base text-[#14532d]">Needs attention</h2>
          <p className="font-inter-regular mt-0.5 text-xs text-[#68766f]">
            Top invoices awaiting review or exception resolution
          </p>
        </div>
        <button
          className="font-inter-medium flex items-center gap-1 text-xs text-[#16834a] hover:underline"
          onClick={() => navigateTo("/bills")}
          type="button"
        >
          View all
          <TbArrowRight size={14} />
        </button>
      </div>

      {state.status === "error" && (
        <p className="font-inter-regular px-5 py-6 text-sm text-[#b4322c]" role="alert">
          {`Couldn't load invoices needing attention. ${state.message}`}
        </p>
      )}

      {state.status === "loading" && items.length === 0 && (
        <p className="font-inter-regular px-5 py-8 text-center text-sm text-[#68766f]">
          Loading invoices…
        </p>
      )}

      {state.status === "loaded" && items.length === 0 && (
        <p className="font-inter-regular px-5 py-8 text-center text-sm text-[#68766f]">
          Nothing needs attention right now.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-[#e6ebe8]">
          {items.map((invoice) => {
            const badge = INVOICE_STATUS_BADGES[invoice.invoiceStatus];
            const title =
              invoice.vendorName ?? invoice.originalFilename ?? `Invoice ${invoice.invoiceUuid.slice(0, 8)}`;
            const detailParts = [
              invoice.propertyName,
              invoice.vendorSuppliedInvoiceId,
              invoice.amount !== null ? formatCurrency(invoice.amount) : null,
            ].filter(Boolean);
            const subtitle =
              invoice.failureReason ?? (detailParts.length > 0 ? detailParts.join(" · ") : "Awaiting details");

            return (
              <li key={invoice.invoiceUuid}>
                <button
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#f8faf9]"
                  onClick={() => onSelectInvoice(invoice)}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="font-inter-medium truncate text-sm text-[#25362f]">{title}</p>
                    <p className="font-inter-regular truncate text-xs text-[#68766f]">{subtitle}</p>
                  </div>
                  <span
                    className={`font-inter-medium shrink-0 rounded-full px-2.5 py-1 text-xs ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

