import { useState } from "react";
import { FiCheck, FiChevronRight, FiClock, FiSearch } from "react-icons/fi";
import { TbAlertTriangle, TbCreditCard, TbExternalLink } from "react-icons/tb";

type PaymentStatus = "Needs approval" | "Scheduled" | "Processing" | "Paid" | "Exception";

type Payment = {
  id: string;
  vendor: string;
  invoice: string;
  property: string;
  amount: string;
  dueDate: string;
  paymentDate?: string;
  status: PaymentStatus;
  method: string;
};

const payments: Payment[] = [
  {
    id: "acme-1042",
    vendor: "Acme Power & Light",
    invoice: "INV-1042",
    property: "Oak Terrace",
    amount: "$1,240.00",
    dueDate: "Mar 20, 2026",
    paymentDate: "Mar 18, 2026",
    status: "Scheduled",
    method: "ACH ···· 4821",
  },
  {
    id: "green-8831",
    vendor: "Greenway Landscaping",
    invoice: "INV-8831",
    property: "Maple Commons",
    amount: "$875.00",
    dueDate: "Mar 21, 2026",
    status: "Needs approval",
    method: "ACH ···· 4821",
  },
  {
    id: "metro-7710",
    vendor: "Metro Water District",
    invoice: "INV-7710",
    property: "Riverside Flats",
    amount: "$2,418.50",
    dueDate: "Mar 17, 2026",
    status: "Processing",
    method: "ACH ···· 4821",
  },
  {
    id: "north-2190",
    vendor: "Northstar HVAC",
    invoice: "INV-2190",
    property: "Oak Terrace",
    amount: "$640.00",
    dueDate: "Mar 14, 2026",
    paymentDate: "Mar 14, 2026",
    status: "Paid",
    method: "ACH ···· 4821",
  },
  {
    id: "city-3302",
    vendor: "City Waste Services",
    invoice: "INV-3302",
    property: "Pine Court",
    amount: "$310.00",
    dueDate: "Mar 16, 2026",
    status: "Exception",
    method: "ACH ···· 4821",
  },
];

const statusStyles: Record<PaymentStatus, string> = {
  "Needs approval": "bg-[#f1edfb] text-[#5b45a8]",
  Scheduled: "bg-[#e8f7ed] text-[#16834a]",
  Processing: "bg-[#eaf1fb] text-[#2f5ea8]",
  Paid: "bg-[#e8f7ed] text-[#16834a]",
  Exception: "bg-[#fdeeee] text-[#b4322c]",
};

function StatusPill({ status }: { status: PaymentStatus }) {
  const dot = status === "Exception" ? "bg-[#b4322c]" : status === "Processing" ? "bg-[#2f5ea8]" : status === "Needs approval" ? "bg-[#5b45a8]" : "bg-[#16834a]";
  return (
    <span className={`font-inter-medium inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${statusStyles[status]}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function SummaryCard({ label, value, detail, dot }: { label: string; value: string; detail: string; dot: string }) {
  return (
    <div className="relative rounded-xl border border-[#e6ebe8] bg-white px-5 py-4">
      <span aria-hidden="true" className={`absolute right-5 top-5 h-2 w-2 rounded-full ${dot}`} />
      <p className="font-inter-regular text-[13px] text-[#25362f]">{label}</p>
      <p className="font-inter-semibold mt-2 text-[28px] leading-none text-[#14532d]">{value}</p>
      <p className="font-inter-regular mt-2 text-xs text-[#68766f]">{detail}</p>
    </div>
  );
}

function PaymentProgress({ payment }: { payment: Payment }) {
  const failed = payment.status === "Exception";
  const steps = [
    { label: "Invoice approved", detail: "Approved by Jordan Lee · Mar 14, 9:42 AM", complete: true },
    { label: "Payment scheduled", detail: payment.paymentDate ? `Scheduled for ${payment.paymentDate}` : "Waiting for approval", complete: payment.status !== "Needs approval" },
    { label: "Payment processing", detail: payment.status === "Processing" ? "Waiting for bank confirmation" : "ACH transfer in progress", complete: payment.status === "Paid" },
    { label: "Payment successful", detail: payment.status === "Paid" ? "Bank confirmation received · Mar 14, 2:18 PM" : "Confirmation will appear here", complete: payment.status === "Paid" },
  ];

  return (
    <section aria-labelledby="payment-progress-title" className="rounded-xl border border-[#e6ebe8] bg-white">
      <div className="border-b border-[#e6ebe8] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-inter-semibold text-base text-[#14532d]" id="payment-progress-title">Payment progress</h2>
            <p className="font-inter-regular mt-1 text-[13px] text-[#68766f]">Follow this payment from approval to settlement.</p>
          </div>
          <FiClock aria-hidden="true" className="text-[#98a29c]" size={18} />
        </div>
      </div>

      {failed && (
        <div className="mx-5 mt-4 flex gap-3 rounded-lg border border-[#f2c9c6] bg-[#fff7f6] p-3.5">
          <TbAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-[#b4322c]" size={17} />
          <div>
            <p className="font-inter-semibold text-[13px] text-[#b4322c]">Payment needs attention</p>
            <p className="font-inter-regular mt-1 text-xs text-[#68766f]">The bank could not process this payment. Review the exception and try again.</p>
          </div>
        </div>
      )}

      <ol className="px-5 py-5">
        {steps.map((step, index) => {
          const active = !step.complete && !failed && (index === 1 || payment.status === "Processing");
          const last = index === steps.length - 1;
          return (
            <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-3" key={step.label}>
              <div aria-hidden="true" className="relative flex justify-center">
                {!last && <span className={`absolute top-5 bottom-0 w-px ${step.complete ? "bg-[#16834a]" : "bg-[#e6ebe8]"}`} />}
                <span className={`relative flex size-5 items-center justify-center rounded-full border ${step.complete ? "border-[#16834a] bg-[#16834a] text-white" : active ? "border-[#2f5ea8] bg-[#eaf1fb] text-[#2f5ea8]" : "border-[#cbd5cf] bg-white text-transparent"}`}>
                  {step.complete ? <FiCheck size={12} /> : active ? <span className="size-1.5 rounded-full bg-[#2f5ea8]" /> : null}
                </span>
              </div>
              <div className={last ? "pb-0" : "pb-6"}>
                <p className={`font-inter-semibold text-sm ${step.complete ? "text-[#25362f]" : active ? "text-[#2f5ea8]" : "text-[#98a29c]"}`}>{step.label}</p>
                <p className="font-inter-regular mt-1 text-xs text-[#68766f]">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function PaymentsPage() {
  const [selectedId, setSelectedId] = useState(payments[0].id);
  const [filter, setFilter] = useState<PaymentStatus | "All">("All");
  const [search, setSearch] = useState("");
  const selected = payments.find((payment) => payment.id === selectedId) ?? payments[0];
  const visiblePayments = payments.filter((payment) => {
    const matchesFilter = filter === "All" || payment.status === filter;
    const query = search.trim().toLowerCase();
    return matchesFilter && (!query || `${payment.vendor} ${payment.invoice} ${payment.property}`.toLowerCase().includes(query));
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-inter-regular text-sm text-[#68766f]">Track approved invoices from authorization to settlement.</p>
        <button className="font-inter-semibold flex h-9 items-center gap-2 rounded-[7px] bg-[#16834a] px-4 text-sm text-white hover:bg-[#13723f]" type="button">
          <TbCreditCard size={16} />
          Schedule payment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard detail="Across 4 properties" dot="bg-[#5b45a8]" label="Needs approval" value="3" />
        <SummaryCard detail="Next payment Mar 18" dot="bg-[#16834a]" label="Scheduled" value="12" />
        <SummaryCard detail="2 payments in progress" dot="bg-[#2f5ea8]" label="Processing" value="$4,670" />
        <SummaryCard detail="March total" dot="bg-[#16834a]" label="Paid this month" value="$42,800" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section aria-labelledby="payment-queue-title" className="flex min-h-[420px] min-w-0 flex-col rounded-xl border border-[#e6ebe8] bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
            <div>
              <h2 className="font-inter-semibold text-base text-[#14532d]" id="payment-queue-title">Payment queue</h2>
              <p className="font-inter-regular mt-1 text-[13px] text-[#68766f]">{visiblePayments.length} payments shown</p>
            </div>
            <label className="flex h-9 w-full items-center gap-2 rounded-[7px] border border-[#e6ebe8] bg-white px-3 sm:w-56">
              <FiSearch aria-hidden="true" className="shrink-0 text-[#98a29c]" size={15} />
              <span className="sr-only">Search payments</span>
              <input className="font-inter-regular w-full bg-transparent text-sm text-[#25362f] outline-none placeholder:text-[#98a29c]" onChange={(event) => setSearch(event.target.value)} placeholder="Search payments..." type="search" value={search} />
            </label>
          </div>

          <div aria-label="Payment status" className="mt-4 flex gap-5 overflow-x-auto border-b border-[#e6ebe8] px-5" role="tablist">
            {(["All", "Needs approval", "Scheduled", "Processing", "Paid", "Exception"] as const).map((status) => (
              <button aria-selected={filter === status} className={`font-inter-medium -mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm ${filter === status ? "border-[#16834a] text-[#16834a]" : "border-transparent text-[#68766f] hover:text-[#25362f]"}`} key={status} onClick={() => setFilter(status)} role="tab" type="button">
                {status}
              </button>
            ))}
          </div>

          <div className="relative flex-1 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead><tr className="font-inter-semibold border-b border-[#e6ebe8] bg-[#f8faf9] text-[11px] text-[#98a29c]"><th className="px-5 py-2.5 font-normal">VENDOR</th><th className="px-5 py-2.5 font-normal">PROPERTY</th><th className="px-5 py-2.5 text-right font-normal">AMOUNT</th><th className="px-5 py-2.5 font-normal">STATUS</th><th className="px-5 py-2.5"><span className="sr-only">Action</span></th></tr></thead>
              <tbody className="font-inter-regular text-[#25362f]">
                {visiblePayments.map((payment) => <tr className={`cursor-pointer border-b border-[#e6ebe8] last:border-b-0 hover:bg-[#f8faf9] ${selectedId === payment.id ? "bg-[#f6fbf8]" : ""}`} key={payment.id} onClick={() => setSelectedId(payment.id)}><td className="px-5 py-3.5"><span className="font-inter-semibold block">{payment.vendor}</span><span className="text-xs text-[#68766f]">{payment.invoice}</span></td><td className="px-5 py-3.5">{payment.property}</td><td className="font-inter-semibold whitespace-nowrap px-5 py-3.5 text-right tabular-nums">{payment.amount}</td><td className="px-5 py-3.5"><StatusPill status={payment.status} /></td><td className="px-5 py-3.5 text-right"><FiChevronRight aria-hidden="true" className="ml-auto text-[#98a29c]" size={16} /></td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex min-h-0 flex-col gap-4">
          <section aria-label="Selected payment" className="rounded-xl border border-[#e6ebe8] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="font-inter-semibold flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f4f2] text-[#25362f]">{selected.vendor.charAt(0)}</span><div className="min-w-0"><h2 className="font-inter-semibold truncate text-base text-[#14532d]">{selected.vendor}</h2><p className="font-inter-regular truncate text-[13px] text-[#68766f]">{selected.invoice} · {selected.property}</p></div></div>
              <div className="text-right"><p className="font-inter-semibold text-2xl tabular-nums text-[#25362f]">{selected.amount}</p><p className="font-inter-regular text-xs text-[#98a29c]">USD</p></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-3"><StatusPill status={selected.status} /><span className="font-inter-regular text-xs text-[#68766f]">Due {selected.dueDate}</span></div>
          </section>
          <PaymentProgress payment={selected} />
          <div className="flex flex-wrap gap-2"><button className="font-inter-medium inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] hover:bg-[#f8faf9]" type="button">View invoice <TbExternalLink size={14} /></button><button className="font-inter-medium inline-flex h-8 items-center rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] hover:bg-[#f8faf9]" type="button">View full activity</button></div>
        </div>
      </div>
    </div>
  );
}
