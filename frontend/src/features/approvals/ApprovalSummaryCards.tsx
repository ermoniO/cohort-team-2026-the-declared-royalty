import { formatCurrency, plural } from "@/features/invoices/invoiceFormat";
import type { QueueSummary } from "./approvalQueue";

type Card = { label: string; value: string; detail: string; valueClassName: string };

function cardsFor(summary: QueueSummary | null): Card[] {
  const count = (n: number | undefined) => (n === undefined ? "—" : plural(n, "bill"));
  return [
    {
      label: "Awaiting approval",
      value: count(summary?.awaitingCount),
      detail: summary ? `${formatCurrency(summary.awaitingTotal)} awaiting a decision` : "",
      valueClassName: "text-[#14532d]",
    },
    {
      label: "Past due",
      value: count(summary?.pastDueCount),
      detail: summary ? (summary.pastDueCount > 0 ? "Timing alert: unpaid past its due date" : "Nothing overdue") : "",
      valueClassName: summary && summary.pastDueCount > 0 ? "text-[#946200]" : "text-[#14532d]",
    },
    {
      label: "Information requested",
      value: count(summary?.infoRequestedCount),
      detail: summary ? (summary.infoRequestedCount > 0 ? "Waiting for a response" : "No open requests") : "",
      valueClassName: "text-[#14532d]",
    },
  ];
}

// Counts come from the loaded queue, so they always match the table below
export default function ApprovalSummaryCards({ summary }: { summary: QueueSummary | null }) {
  return (
    <ul aria-busy={summary === null} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cardsFor(summary).map((card) => (
        <li className="rounded-xl border border-[#e6ebe8] bg-white px-5 py-4" key={card.label}>
          <p className="font-inter-regular text-[13px] text-[#68766f]">{card.label}</p>
          <p className={`font-inter-semibold mt-2 text-[26px] leading-none ${card.valueClassName}`}>{card.value}</p>
          <p className="font-inter-regular mt-2 min-h-[18px] text-xs text-[#68766f]">{card.detail}</p>
        </li>
      ))}
    </ul>
  );
}
