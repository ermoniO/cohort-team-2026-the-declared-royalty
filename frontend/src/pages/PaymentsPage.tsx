import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiChevronRight, FiClock, FiSearch } from "react-icons/fi";
import { TbAlertTriangle, TbExternalLink } from "react-icons/tb";
import { navigateTo } from "@/app/navigation";
import { auditHistoryPath } from "@/features/auditLogs/auditLogDisplay";
import { formatCurrency } from "@/features/invoices/invoiceFormat";
import { invoiceFileUrl } from "@/features/invoices/invoiceService";
import {
  getAutoPaySettings,
  getPayments,
  updateAutoPaySettings,
} from "@/features/payments/paymentService";
import type {
  PaymentResponse,
} from "@/types/payment";
import PaymentsSummaryCards from "@/features/payments/PaymentsSummaryCards";
import type { PaymentSummaryState } from "@/features/payments/usePaymentSummary";

type PaymentStatus =
  | "Needs approval"
  | "Scheduled"
  | "Processing"
  | "Paid"
  | "Exception";

type Payment = {
  id: string;
  vendor: string;
  invoice: string;
  property: string;
  amount: number | null;
  dueDate: string | null;
  paymentDate?: string;
  status: PaymentStatus;
  failureReason: string | null;
  retryable: boolean;
  hasInvoiceFile: boolean;
};

const statusStyles: Record<PaymentStatus, string> = {
  "Needs approval": "bg-[#f1edfb] text-[#5b45a8]",
  Scheduled: "bg-[#e8f7ed] text-[#16834a]",
  Processing: "bg-[#eaf1fb] text-[#2f5ea8]",
  Paid: "bg-[#e8f7ed] text-[#16834a]",
  Exception: "bg-[#fdeeee] text-[#b4322c]",
};

function toPayment(payment: PaymentResponse): Payment {
  const status: PaymentStatus =
    payment.paymentStatus === "NEEDS_APPROVAL"
      ? "Needs approval"
      : payment.paymentStatus === "SCHEDULED"
        ? "Scheduled"
        : payment.paymentStatus === "PROCESSING"
          ? "Processing"
          : payment.paymentStatus === "PAID"
            ? "Paid"
            : "Exception";

  return {
    id: payment.paymentId,
    vendor:
      payment.vendorName ?? payment.originalFilename ?? "Unmatched invoice",
    invoice:
      payment.vendorSuppliedInvoiceId ?? payment.originalFilename ?? "Invoice",
    property: payment.propertyName ?? "Unassigned property",
    amount: payment.amount,
    dueDate: payment.dueDate,
    paymentDate: payment.paymentDate ?? undefined,
    status,
    failureReason: payment.failureReason,
    retryable: payment.retryable,
    hasInvoiceFile: Boolean(payment.blobFileUrl),
  };
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusPill({ status }: { status: PaymentStatus }) {
  const dot =
    status === "Exception"
      ? "bg-[#b4322c]"
      : status === "Processing"
        ? "bg-[#2f5ea8]"
        : status === "Needs approval"
          ? "bg-[#5b45a8]"
          : "bg-[#16834a]";
  return (
    <span
      className={`font-inter-medium inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${statusStyles[status]}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function PaymentProgress({ payment }: { payment: Payment }) {
  const failed = payment.status === "Exception";
  const approved = payment.status !== "Needs approval";
  const processing =
    payment.status === "Processing" || payment.status === "Paid";
  const paid = payment.status === "Paid";
  const steps = [
    {
      label: "Invoice approved",
      detail: approved ? "Approved invoice" : "Waiting for invoice approval",
      complete: approved,
    },
    {
      label: "Payment scheduled",
      detail: approved
        ? "Ready for payment processing"
        : "Waiting for approval",
      complete: approved,
    },
    {
      label: "Payment processing",
      detail: paid
        ? "Payment completed"
        : processing
          ? "Waiting for payment confirmation"
          : "Not started",
      complete: paid,
    },
    {
      label: "Payment successful",
      detail: paid
        ? `Payment confirmed · ${payment.paymentDate ?? "date unavailable"}`
        : "Confirmation will appear here",
      complete: paid,
    },
  ];

  return (
    <section
      aria-labelledby="payment-progress-title"
      className="rounded-xl border border-[#e6ebe8] bg-white"
    >
      <div className="border-b border-[#e6ebe8] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              className="font-inter-semibold text-base text-[#14532d]"
              id="payment-progress-title"
            >
              Payment progress
            </h2>
            <p className="font-inter-regular mt-1 text-[13px] text-[#68766f]">
              Progress based on the current invoice status in the database.
            </p>
          </div>
          <FiClock aria-hidden="true" className="text-[#98a29c]" size={18} />
        </div>
      </div>
      {failed && (
        <div className="mx-5 mt-4 flex gap-3 rounded-lg border border-[#f2c9c6] bg-[#fff7f6] p-3.5">
          <TbAlertTriangle
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[#b4322c]"
            size={17}
          />
          <div>
            <p className="font-inter-semibold text-[13px] text-[#b4322c]">
              Payment needs attention
            </p>
            <p className="font-inter-regular mt-1 text-xs text-[#68766f]">
              {payment.failureReason ??
                "The invoice is marked as failed. Review the exception before trying again."}{" "}
              {payment.retryable
                ? "A retry may be available after confirming the payment details."
                : "This payment requires review before it can be retried."}
            </p>
          </div>
        </div>
      )}
      <ol className="px-5 py-5">
        {steps.map((step, index) => {
          const active =
            !step.complete &&
            !failed &&
            (index === 0 || payment.status === "Processing");
          const last = index === steps.length - 1;
          return (
            <li
              className="grid grid-cols-[20px_minmax(0,1fr)] gap-3"
              key={step.label}
            >
              <div aria-hidden="true" className="relative flex justify-center">
                {!last && (
                  <span
                    className={`absolute top-5 bottom-0 w-px ${step.complete ? "bg-[#16834a]" : "bg-[#e6ebe8]"}`}
                  />
                )}
                <span
                  className={`relative flex size-5 items-center justify-center rounded-full border ${step.complete ? "border-[#16834a] bg-[#16834a] text-white" : active ? "border-[#2f5ea8] bg-[#eaf1fb] text-[#2f5ea8]" : "border-[#cbd5cf] bg-white text-transparent"}`}
                >
                  {step.complete ? (
                    <FiCheck size={12} />
                  ) : active ? (
                    <span className="size-1.5 rounded-full bg-[#2f5ea8]" />
                  ) : null}
                </span>
              </div>
              <div className={last ? "pb-0" : "pb-6"}>
                <p
                  className={`font-inter-semibold text-sm ${step.complete ? "text-[#25362f]" : active ? "text-[#2f5ea8]" : "text-[#98a29c]"}`}
                >
                  {step.label}
                </p>
                <p className="font-inter-regular mt-1 text-xs text-[#68766f]">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Message({
  children,
  alert = false,
}: {
  children: string;
  alert?: boolean;
}) {
  return (
    <p
      className="font-inter-regular px-5 py-16 text-center text-sm text-[#68766f]"
      role={alert ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayLoading, setAutoPayLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PaymentStatus | "All">("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    getPayments({ page: 0, size: 100 })
      .then((response) => {
        if (!active) return;
        const loadedPayments = response.items.map(toPayment);
        setPayments(loadedPayments);
        setSelectedId((current) => current ?? loadedPayments[0]?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load payments.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Auto-pay is an optional control; it must not prevent the payment queue
    // from rendering if its settings endpoint is unavailable.
    getAutoPaySettings()
      .then((response) => {
        if (active) setAutoPayEnabled(response.enabled);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const toggleAutoPay = async () => {
    const nextValue = !autoPayEnabled;
    setAutoPayLoading(true);
    setError(null);
    try {
      const response = await updateAutoPaySettings(nextValue);
      setAutoPayEnabled(response.enabled);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update auto-pay.",
      );
    } finally {
      setAutoPayLoading(false);
    }
  };

  const visiblePayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesFilter = filter === "All" || payment.status === filter;
      const searchable =
        `${payment.vendor} ${payment.invoice} ${payment.property}`.toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [filter, payments, search]);

  const selected =
    visiblePayments.find((payment) => payment.id === selectedId) ??
    visiblePayments[0] ??
    payments[0];
  const processingPayments = payments.filter(
    (payment) => payment.status === "Processing",
  );
  const needsApproval = payments.filter(
    (payment) => payment.status === "Needs approval",
  ).length;
  const scheduledPayments = payments.filter(
    (payment) => payment.status === "Scheduled",
  );
  const paidPayments = payments.filter((payment) => payment.status === "Paid");
  const sumAmount = (list: Payment[]) =>
    list.reduce((total, payment) => total + (payment.amount ?? 0), 0);
  const summaryState: PaymentSummaryState = loading
    ? { status: "loading" }
    : error
      ? { status: "error", message: error }
      : {
          status: "loaded",
          data: {
            needsApprovalCount: needsApproval,
            scheduledCount: scheduledPayments.length,
            scheduledTotal: sumAmount(scheduledPayments),
            processingCount: processingPayments.length,
            processingTotal: sumAmount(processingPayments),
            paidCount: paidPayments.length,
            paidTotal: sumAmount(paidPayments),
          },
        };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-inter-regular text-sm text-[#68766f]">
          Track approved invoices from authorization to settlement.
        </p>
        <button
          aria-checked={autoPayEnabled}
          aria-label="Schedule payment"
          className="font-inter-semibold flex items-center gap-2 text-sm text-[#14532d] disabled:cursor-wait disabled:opacity-60"
          disabled={autoPayLoading}
          onClick={toggleAutoPay}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={`relative h-5 w-9 rounded-full transition-colors ${autoPayEnabled ? "bg-[#16834a]" : "bg-[#b9c8be]"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${autoPayEnabled ? "translate-x-4" : "translate-x-0"}`}
            />
          </span>
          <span>Schedule payment</span>
        </button>
      </div>

      <PaymentsSummaryCards state={summaryState} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section
          aria-labelledby="payment-queue-title"
          className="flex min-h-105 min-w-0 flex-col rounded-xl border border-[#e6ebe8] bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
            <div>
              <h2
                className="font-inter-semibold text-base text-[#14532d]"
                id="payment-queue-title"
              >
                Payment queue
              </h2>
              <p className="font-inter-regular mt-1 text-[13px] text-[#68766f]">
                {loading
                  ? "Loading payments…"
                  : `${visiblePayments.length} payments shown`}
              </p>
            </div>
            <label className="flex h-9 w-full items-center gap-2 rounded-[7px] border border-[#e6ebe8] bg-white px-3 sm:w-56">
              <FiSearch
                aria-hidden="true"
                className="shrink-0 text-[#98a29c]"
                size={15}
              />
              <span className="sr-only">Search payments</span>
              <input
                className="font-inter-regular w-full bg-transparent text-sm text-[#25362f] outline-none placeholder:text-[#98a29c]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search payments..."
                type="search"
                value={search}
              />
            </label>
          </div>
          <div
            aria-label="Payment status"
            className="mt-4 flex gap-5 overflow-x-auto border-b border-[#e6ebe8] px-5"
            role="tablist"
          >
            {(
              [
                "All",
                "Needs approval",
                "Scheduled",
                "Processing",
                "Paid",
                "Exception",
              ] as const
            ).map((status) => (
              <button
                aria-selected={filter === status}
                className={`font-inter-medium -mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm ${filter === status ? "border-[#16834a] text-[#16834a]" : "border-transparent text-[#68766f] hover:text-[#25362f]"}`}
                key={status}
                onClick={() => setFilter(status)}
                role="tab"
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
          <div className="relative flex-1 overflow-x-auto">
            <table className="w-full min-w-190 text-left text-[13px]">
              <thead>
                <tr className="font-inter-semibold border-b border-[#e6ebe8] bg-[#f8faf9] text-[11px] text-[#98a29c]">
                  <th className="px-5 py-2.5 font-normal">VENDOR</th>
                  <th className="px-5 py-2.5 font-normal">PROPERTY</th>
                  <th className="px-5 py-2.5 text-right font-normal">AMOUNT</th>
                  <th className="px-5 py-2.5 font-normal">STATUS</th>
                  <th className="px-5 py-2.5">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="font-inter-regular text-[#25362f]">
                {loading ? (
                  <tr>
                    <td colSpan={5}>
                      <Message>Loading payments…</Message>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5}>
                      <Message
                        alert
                      >{`Couldn't load payments. ${error}`}</Message>
                    </td>
                  </tr>
                ) : visiblePayments.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <Message>
                        {search.trim()
                          ? "No payments match your search."
                          : "No payment records found."}
                      </Message>
                    </td>
                  </tr>
                ) : (
                  visiblePayments.map((payment) => (
                    <tr
                      className={`cursor-pointer border-b border-[#e6ebe8] last:border-b-0 hover:bg-[#f8faf9] ${selected?.id === payment.id ? "bg-[#f6fbf8]" : ""}`}
                      key={payment.id}
                      onClick={() => setSelectedId(payment.id)}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-inter-semibold block">
                          {payment.vendor}
                        </span>
                        <span className="text-xs text-[#68766f]">
                          {payment.invoice}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">{payment.property}</td>
                      <td className="font-inter-semibold whitespace-nowrap px-5 py-3.5 text-right tabular-nums">
                        {payment.amount === null
                          ? "—"
                          : formatCurrency(payment.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={payment.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <FiChevronRight
                          aria-hidden="true"
                          className="ml-auto text-[#98a29c]"
                          size={16}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selected ? (
          <div className="flex min-h-0 flex-col gap-4">
            <section
              aria-label="Selected payment"
              className="rounded-xl border border-[#e6ebe8] bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="font-inter-semibold flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f1f4f2] text-[#25362f]"
                  >
                    {selected.vendor.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-inter-semibold truncate text-base text-[#14532d]">
                      {selected.vendor}
                    </h2>
                    <p className="font-inter-regular truncate text-[13px] text-[#68766f]">
                      {selected.invoice} · {selected.property}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-inter-semibold text-2xl tabular-nums text-[#25362f]">
                    {selected.amount === null
                      ? "—"
                      : formatCurrency(selected.amount)}
                  </p>
                  <p className="font-inter-regular text-xs text-[#98a29c]">
                    USD
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-3">
                <StatusPill status={selected.status} />
                <span className="font-inter-regular text-xs text-[#68766f]">
                  Due {formatDate(selected.dueDate)}
                </span>
              </div>
            </section>
            <PaymentProgress payment={selected} />
            <div className="flex flex-wrap gap-2">
              {selected.hasInvoiceFile ? (
                <a
                  className="font-inter-medium inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] hover:bg-[#f8faf9]"
                  href={invoiceFileUrl(selected.id)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View invoice <TbExternalLink size={14} />
                </a>
              ) : (
                <button
                  className="font-inter-medium inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#98a29c]"
                  disabled
                  type="button"
                >
                  No invoice file
                </button>
              )}
              <button
                className="font-inter-medium inline-flex h-8 items-center rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] hover:bg-[#f8faf9]"
                onClick={() => navigateTo(auditHistoryPath(selected.id))}
                type="button"
              >
                View full activity
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e6ebe8] bg-white">
            <Message>Select a payment to view its details.</Message>
          </div>
        )}
      </div>
    </div>
  );
}
