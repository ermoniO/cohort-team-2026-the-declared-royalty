import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { FiAlertCircle, FiX } from "react-icons/fi";
import { TbAlertTriangle, TbCircleCheck, TbExternalLink, TbFileText, TbInfoCircle } from "react-icons/tb";
import ActionMenu from "@/components/ui/ActionMenu";
import Icon from "@/components/ui/Icon";
import { getAuditLogs } from "@/features/auditLogs/auditLogService";
import { formatTime } from "@/features/auditLogs/auditLogDisplay";
import { formatCurrency, formatReceived } from "@/features/invoices/invoiceFormat";
import { getInvoiceValidation, invoiceFileUrl } from "@/features/invoices/invoiceService";
import { getPropertyById } from "@/features/properties/propertyService";
import { getDisplayName } from "@/features/users/userDisplay";
import { getUsers } from "@/features/users/userService";
import type { AuditLogsResponse } from "@/types/auditlogs";
import type { InvoiceValidationResponse } from "@/types/invoice";
import type { PropertyResponse } from "@/types/property";
import type { UserResponse } from "@/types/user";
import { type DecisionKind, NOTE_MAX } from "./approvalDecision";
import { type ApprovalItem, dueDetail, sentForApprovalEntry } from "./approvalQueue";
import { billName, DECISION_MENU_ITEMS, formatDueDate } from "./approvalStatus";
import ApprovalStatusPill from "./ApprovalStatusPill";

type BillDetailModalProps = {
  item: ApprovalItem;
  today: Date;
  decideBlockedReason: string | null;
  // Approves with the comment as the decision's note; throwing shows the error
  onApprove: (comment: string) => Promise<void>;
  // Opens the Reject or Request information form on top of this one
  onOpenDecision: (kind: "reject" | "requestInfo") => void;
  onClose: () => void;
};

type History =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; logs: AuditLogsResponse[]; users: Record<string, UserResponse> };

function Detail({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-inter-regular text-xs text-[#68766f]">{label}</dt>
      <dd className={`mt-0.5 truncate text-[13px] text-[#25362f] ${mono ? "font-mono" : "font-inter-medium"}`}>{children}</dd>
    </div>
  );
}

function Missing({ children }: { children: string }) {
  return <span className="font-inter-regular text-[#98a29c]">{children}</span>;
}

function Placeholder({ children }: { children: string }) {
  return (
    <p className="font-inter-regular flex items-start gap-2 rounded-lg border border-dashed border-[#d5ddd8] bg-[#f8faf9] px-3 py-3 text-[13px] text-[#68766f]">
      <Icon className="mt-0.5 shrink-0" icon={TbInfoCircle} size={15} />
      <span>{children}</span>
    </p>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="font-inter-semibold mb-3 text-sm text-[#14532d]">{children}</h3>;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The backend's validation checks. Failed or unchecked ones are listed with the reason, so the
// approver can decide what to do; the checks don't block anything themselves.
type Validation = { status: "loading" } | { status: "error" } | { status: "loaded"; result: InvoiceValidationResponse };

function ValidationCard({ validation }: { validation: Validation }) {
  if (validation.status !== "loaded") {
    return (
      <p
        className="font-inter-regular rounded-lg border border-[#e6ebe8] bg-[#f8faf9] px-4 py-3 text-[13px] text-[#68766f]"
        role={validation.status === "error" ? "alert" : "status"}
      >
        {validation.status === "error" ? "Couldn't run the validation checks." : "Running validation checks…"}
      </p>
    );
  }
  const { result } = validation;
  const open = result.checks.filter((check) => check.status !== "PASSED");
  const title = result.passed
    ? `Validation passed · ${result.passedCount} of ${result.totalCount}`
    : `${result.passedCount} of ${result.totalCount} checks passed`;
  return (
    <div className={`rounded-lg border px-4 py-3 ${result.passed ? "border-[#cfe9d8] bg-[#f3faf5]" : "border-[#f3dfb0] bg-[#fdf9ee]"}`}>
      <p className={`font-inter-semibold flex items-center gap-2 text-[13px] ${result.passed ? "text-[#14532d]" : "text-[#946200]"}`}>
        <Icon className="shrink-0" icon={result.passed ? TbCircleCheck : TbAlertTriangle} size={17} />
        {title}
      </p>
      {result.passed ? (
        <p className="font-inter-regular mt-1 text-xs text-[#68766f]">
          {capitalize(result.checks.map((check) => check.label).join(" · "))}.
        </p>
      ) : (
        <ul className="font-inter-regular mt-2 flex flex-col gap-1 text-xs text-[#25362f]">
          {open.map((check) => (
            <li className="flex gap-1.5" key={check.id}>
              <span className={`font-inter-medium shrink-0 ${check.status === "FAILED" ? "text-[#b4322c]" : "text-[#68766f]"}`}>
                {check.status === "FAILED" ? "Failed:" : "Couldn't check:"}
              </span>
              <span>
                {capitalize(check.label)}. {check.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const servicePeriod = (start: string | null, end: string | null) =>
  start && end ? `${formatDueDate(start)} – ${formatDueDate(end)}` : (formatDueDate(start ?? end) ?? null);

export default function BillDetailModal({ item, today, decideBlockedReason, onApprove, onOpenDecision, onClose }: BillDetailModalProps) {
  const { invoice } = item;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const commentId = useId();
  const [history, setHistory] = useState<History>({ status: "loading" });
  const [property, setProperty] = useState<PropertyResponse | null>(null);
  const [validation, setValidation] = useState<Validation>({ status: "loading" });
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = billName(item);
  const due = dueDetail(item, today);
  const awaiting = item.status === "awaiting";

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // History and the service address load with the modal; either failing only affects its own section
  useEffect(() => {
    let active = true;
    Promise.all([getAuditLogs({ invoice: invoice.invoiceUuid }), getUsers().catch(() => [] as UserResponse[])])
      .then(([logs, users]) => {
        if (!active) return;
        const sorted = [...logs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        setHistory({ status: "loaded", logs: sorted, users: Object.fromEntries(users.map((u) => [u.userId, u])) });
      })
      .catch(() => active && setHistory({ status: "error" }));
    return () => {
      active = false;
    };
  }, [invoice.invoiceUuid]);

  // The service address and the validation checks; each failing only affects its own section
  useEffect(() => {
    let active = true;
    getInvoiceValidation(invoice.invoiceUuid)
      .then((result) => active && setValidation({ status: "loaded", result }))
      .catch(() => active && setValidation({ status: "error" }));
    if (invoice.propertyUuid) {
      getPropertyById(invoice.propertyUuid)
        .then((found) => active && setProperty(found))
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [invoice.invoiceUuid, invoice.propertyUuid]);

  const actor = (userId: string) => {
    const user = history.status === "loaded" ? history.users[userId] : undefined;
    return user ? getDisplayName(user) : `User ${userId.slice(0, 8)}`;
  };

  // Who confirmed the details and sent the bill for approval (can differ from the uploader)
  const sentForApproval = (): ReactNode => {
    if (history.status === "loading") return <Missing>Loading…</Missing>;
    if (history.status === "error") return <Missing>Couldn't load</Missing>;
    const entry = sentForApprovalEntry(history.logs);
    return entry ? (
      <span title={formatTime(entry.createdAt)}>{actor(entry.user)}</span>
    ) : (
      <Missing>Not recorded</Missing>
    );
  };

  const close = () => dialogRef.current?.close();

  const decide = (kind: DecisionKind) => {
    if (kind !== "approve") {
      onOpenDecision(kind);
      return;
    }
    if (comment.trim().length > NOTE_MAX) {
      setError(`Keep the comment to ${NOTE_MAX} characters or fewer.`);
      return;
    }
    setBusy(true);
    setError(null);
    onApprove(comment)
      .then(() => close())
      .catch((approveError: unknown) => {
        setError(approveError instanceof Error ? approveError.message : "Couldn't approve the bill.");
        setBusy(false);
      });
  };

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto max-h-[92dvh] w-[calc(100vw-2rem)] max-w-[920px] overflow-hidden rounded-xl border-0 bg-white p-0 text-[#25362f] shadow-xl backdrop:bg-black/30"
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
      ref={dialogRef}
    >
      <div className="flex max-h-[92dvh] flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-[#e6ebe8] px-6 py-5">
          <span
            aria-hidden="true"
            className="font-inter-semibold flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f7ed] text-[#16834a]"
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-inter-medium text-[11px] uppercase tracking-wide text-[#98a29c]">Bill details</p>
            <h2 className="font-inter-semibold truncate text-xl text-[#14532d]" id={titleId}>
              {name}
            </h2>
            {invoice.description && <p className="font-inter-regular text-[13px] text-[#25362f]">{invoice.description}</p>}
            <p className="font-inter-regular truncate text-[13px] text-[#68766f]">
              {[invoice.propertyName, invoice.vendorSuppliedInvoiceId].filter(Boolean).join(" · ") || "Not matched to a property yet"}
            </p>
            <div className="mt-2">
              <ApprovalStatusPill status={item.status} />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-inter-semibold text-2xl tabular-nums text-[#14532d]">
              {invoice.amount === null ? <Missing>No amount</Missing> : formatCurrency(invoice.amount)}
            </p>
            <p className={`font-inter-regular text-xs ${due?.pastDue ? "text-[#946200]" : "text-[#68766f]"}`}>
              {formatDueDate(invoice.dueDate) ? `Due ${formatDueDate(invoice.dueDate)}${due ? ` · ${due.text}` : ""}` : "No due date"}
            </p>
          </div>
          <button
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#68766f] hover:bg-[#f8faf9] disabled:opacity-40"
            disabled={busy}
            onClick={close}
            type="button"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-8 gap-y-6 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            <section>
              <SectionTitle>Invoice & account</SectionTitle>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Detail label="Invoice number">{invoice.vendorSuppliedInvoiceId ?? <Missing>Not set</Missing>}</Detail>
                <Detail label="Account number">{invoice.vendorAccountNumber ?? <Missing>Not set</Missing>}</Detail>
                <Detail label="Property">{invoice.propertyName ?? <Missing>Not matched</Missing>}</Detail>
                <Detail label="Vendor ID" mono>
                  {invoice.vendorUuid ? <span title={invoice.vendorUuid}>{invoice.vendorUuid.slice(0, 8)}</span> : <Missing>Not matched</Missing>}
                </Detail>
                <Detail label="Invoice date">{formatDueDate(invoice.invoiceCreationDate) ?? <Missing>Not set</Missing>}</Detail>
                <Detail label="Service period">
                  {servicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd) ?? <Missing>Not set</Missing>}
                </Detail>
                <Detail label="Submitted by">
                  {invoice.uploadedByName ?? <Missing>{invoice.originalFilename ? "Unknown" : "Entered manually"}</Missing>}
                </Detail>
                <Detail label="Sent for approval by">{sentForApproval()}</Detail>
              </dl>
              {property && (
                <p className="font-inter-regular mt-3 text-xs text-[#68766f]">
                  Service address: {property.streetAddress}, {property.city}, {property.state} {property.zipCode}
                </p>
              )}
            </section>

            <section>
              <SectionTitle>Line items</SectionTitle>
              {invoice.description ? (
                <>
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="font-inter-semibold border-b border-[#e6ebe8] text-[11px] text-[#98a29c]">
                        <th className="pb-2 font-normal" scope="col">DESCRIPTION</th>
                        <th className="pb-2 text-right font-normal" scope="col">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody className="font-inter-regular">
                      <tr className="border-b border-[#e6ebe8]">
                        <td className="py-2 pr-3">{invoice.description}</td>
                        <td className="whitespace-nowrap py-2 text-right tabular-nums">
                          {invoice.amount === null ? <Missing>Not set</Missing> : formatCurrency(invoice.amount)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="font-inter-semibold">
                        <th className="pt-2 font-normal" scope="row">Total</th>
                        <td className="pt-2 text-right tabular-nums">
                          {invoice.amount === null ? <Missing>Not set</Missing> : formatCurrency(invoice.amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="font-inter-regular mt-2 text-xs text-[#68766f]">Shown as one line; itemized charges aren't available yet.</p>
                </>
              ) : (
                <Placeholder>No description yet. The bill total is shown above.</Placeholder>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-[#e6ebe8] px-3 py-2.5">
                <Icon className="shrink-0 text-[#68766f]" icon={TbFileText} size={20} />
                <div className="min-w-0 flex-1">
                  <p className="font-inter-medium truncate text-[13px]">{invoice.originalFilename ?? "No file attached"}</p>
                  <p className="font-inter-regular text-xs text-[#68766f]">{invoice.blobFileUrl ? "Original invoice" : "Entered manually"}</p>
                </div>
                {invoice.blobFileUrl && (
                  <a
                    className="font-inter-medium inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] hover:bg-[#f8faf9]"
                    href={invoiceFileUrl(invoice.invoiceUuid)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View invoice
                    <Icon icon={TbExternalLink} size={14} />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </div>
              <ValidationCard validation={validation} />
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {awaiting && (
              <section>
                <label className="font-inter-semibold mb-3 block text-sm text-[#14532d]" htmlFor={commentId}>
                  Comment for approver <span className="font-inter-regular text-[#98a29c]">(optional)</span>
                </label>
                <textarea
                  className="font-inter-regular min-h-[96px] w-full resize-y rounded-[7px] border border-[#e6ebe8] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#b0bab5] focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20 disabled:bg-[#f8faf9]"
                  disabled={busy}
                  id={commentId}
                  maxLength={NOTE_MAX}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Add context for the audit log"
                  value={comment}
                />
                <p className="font-inter-regular mt-1 text-xs text-[#68766f]">Saved with your approval in the audit log.</p>
              </section>
            )}

            <section>
              <SectionTitle>Previous decisions & audit</SectionTitle>
              {history.status === "loading" && <p className="font-inter-regular text-[13px] text-[#68766f]">Loading history…</p>}
              {history.status === "error" && (
                <p className="font-inter-regular text-[13px] text-[#b42318]" role="alert">
                  Couldn't load this bill's history.
                </p>
              )}
              {history.status === "loaded" &&
                (history.logs.length === 0 ? (
                  <p className="font-inter-regular text-[13px] text-[#68766f]">No history recorded yet.</p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {history.logs.map((log) => (
                      <li className="border-l-2 border-[#e6ebe8] pl-3" key={log.auditLogId}>
                        <p className="font-inter-regular text-xs text-[#68766f]">
                          {formatReceived(log.createdAt)}, {formatTime(log.createdAt)} · {actor(log.user)}
                        </p>
                        <p className="font-inter-medium text-[13px]">{log.actionTaken}</p>
                        {log.notes && <p className="font-inter-regular break-words text-[13px] text-[#4f5d56]">{log.notes}</p>}
                      </li>
                    ))}
                  </ol>
                ))}
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[#e6ebe8] px-6 py-4">
          <div className="mr-auto min-w-0">
            {error ? (
              <p className="font-inter-regular flex items-start gap-2 text-sm text-[#b42318]" role="alert">
                <FiAlertCircle className="mt-0.5 shrink-0" size={16} />
                <span>{error}</span>
              </p>
            ) : (
              <>
                <p className="font-inter-medium text-[13px]">Approval doesn't execute payment.</p>
                <p className="font-inter-regular text-xs text-[#68766f]">Decisions and notes are recorded in the audit log.</p>
              </>
            )}
          </div>
          <button
            className="font-inter-medium h-9 rounded-[7px] border border-[#e6ebe8] bg-white px-4 text-sm text-[#25362f] hover:bg-[#f8faf9] disabled:opacity-50"
            disabled={busy}
            onClick={close}
            type="button"
          >
            {awaiting ? "Cancel" : "Close"}
          </button>
          {awaiting && (
            <>
              <button
                aria-describedby={`${titleId}-drafts`}
                className="font-inter-medium h-9 cursor-not-allowed rounded-[7px] border border-[#e6ebe8] bg-white px-4 text-sm text-[#25362f] opacity-50"
                disabled
                type="button"
              >
                Save & Close
              </button>
              <span className="sr-only" id={`${titleId}-drafts`}>
                Saving drafts isn't available yet
              </span>
              <span title={decideBlockedReason ?? undefined}>
                <ActionMenu
                  disabled={busy || decideBlockedReason !== null}
                  items={DECISION_MENU_ITEMS}
                  onSelect={decide}
                  label={busy ? "Saving decision…" : `Decide on ${name}`}
                  variant="primary"
                />
              </span>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
