import { formatCurrency, plural } from "@/features/invoices/invoiceFormat";
import type { PaymentSummaryState } from "./usePaymentSummary";

type Card = { label: string; value: string; detail: string; dotClassName: string };

function cardsFor(state: PaymentSummaryState, compact: boolean): Card[] {
  const loaded = state.status === "loaded" ? state.data : null;
  const count = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("en-US"));
  const money = (n: number | undefined) => (n === undefined ? "—" : formatCurrency(n));

  const cards: Card[] = [
    {
      label: "Needs approval",
      value: count(loaded?.needsApprovalCount),
      detail: "From loaded invoice records",
      dotClassName: "bg-[#5b45a8]",
    },
    {
      label: "Scheduled",
      value: money(loaded?.scheduledTotal),
      detail: loaded ? `${plural(loaded.scheduledCount, "invoice")} scheduled` : "",
      dotClassName: "bg-[#16834a]",
    },
    {
      label: "Processing",
      value: money(loaded?.processingTotal),
      detail: loaded ? `${plural(loaded.processingCount, "invoice")} in progress` : "",
      dotClassName: "bg-[#2f5ea8]",
    },
    {
      label: "Paid total",
      value: money(loaded?.paidTotal),
      detail: loaded ? `${plural(loaded.paidCount, "paid invoice")}` : "",
      dotClassName: "bg-[#16834a]",
    },
  ];

  return compact ? cards.slice(1) : cards;
}

export default function PaymentsSummaryCards({
  state,
  compact = false,
}: {
  state: PaymentSummaryState;
  compact?: boolean;
}) {
  const gridClassName = compact
    ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
    : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className="flex flex-col gap-2">
      <ul aria-busy={state.status === "loading"} className={gridClassName}>
        {cardsFor(state, compact).map((card) => (
          <li className="relative rounded-xl border border-[#e6ebe8] bg-white px-5 py-4" key={card.label}>
            <span aria-hidden="true" className={`absolute right-5 top-5 h-2 w-2 rounded-full ${card.dotClassName}`} />
            <p className="font-inter-regular text-[13px] text-[#25362f]">{card.label}</p>
            <p className="font-inter-semibold mt-2 text-[28px] leading-none text-[#14532d]">{card.value}</p>
            <p className="font-inter-regular mt-2 min-h-[18px] text-xs text-[#68766f]">{card.detail}</p>
          </li>
        ))}
      </ul>
      {state.status === "error" && (
        <p className="font-inter-regular text-sm text-[#b4322c]" role="alert">
          {`Couldn't load payment summary. ${state.message}`}
        </p>
      )}
    </div>
  );
}

