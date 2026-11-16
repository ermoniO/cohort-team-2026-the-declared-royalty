import { useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { TbShieldCheck } from "react-icons/tb";
import Icon from "@/components/ui/Icon";
import { type Decision, type DecisionKind, DECISION_LABELS } from "@/features/approvals/approvalDecision";
import { type ApprovalItem, applyView, DEFAULT_QUEUE_VIEW, type QueueView, summarize } from "@/features/approvals/approvalQueue";
import ApprovalQueueTable from "@/features/approvals/ApprovalQueueTable";
import { AlreadyDecidedError, submitDecision } from "@/features/approvals/approvalService";
import { billName } from "@/features/approvals/approvalStatus";
import ApprovalSummaryCards from "@/features/approvals/ApprovalSummaryCards";
import BillDetailModal from "@/features/approvals/BillDetailModal";
import DecisionFormModal from "@/features/approvals/DecisionFormModal";
import { useApprovalQueue } from "@/features/approvals/useApprovalQueue";
import { formatCurrency } from "@/features/invoices/invoiceFormat";
import { useCurrentUserContext } from "@/features/users/currentUserContext";

type Message = { tone: "success" | "warning" | "error"; text: string };

type DecisionForm = { kind: "reject" | "requestInfo"; item: ApprovalItem };

const describeError = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

function MessageBar({ message }: { message: Message }) {
  const styles = {
    success: "border-[#bfe5cc] bg-[#e8f7ed] text-[#14532d]",
    warning: "border-[#f5e3b3] bg-[#fdf6e3] text-[#7a5200]",
    error: "border-[#fecdca] bg-[#fef3f2] text-[#b42318]",
  }[message.tone];
  return (
    <p className={`font-inter-regular flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm ${styles}`}>
      {message.tone === "success" ? <FiCheckCircle className="mt-0.5 shrink-0" size={16} /> : <FiAlertCircle className="mt-0.5 shrink-0" size={16} />}
      <span>{message.text}</span>
    </p>
  );
}

export default function ApprovalsPage() {
  const { user, loading: userLoading } = useCurrentUserContext();
  // Fixed for the visit, so "past due" and "in 2 days" don't shift while you work
  const [today] = useState(() => new Date());
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<QueueView>(DEFAULT_QUEUE_VIEW);
  const [detail, setDetail] = useState<ApprovalItem | null>(null);
  const [form, setForm] = useState<DecisionForm | null>(null);
  const [rowBusy, setRowBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const queue = useApprovalQueue(reloadKey);
  const items = queue.status === "loaded" ? queue.items : (queue.previous ?? null);
  const rows = useMemo(() => (items ? applyView(items, view, today) : null), [items, view, today]);
  const summary = useMemo(() => (items ? summarize(items, today) : null), [items, today]);

  // TODO(auth): the decision is recorded under the signed-in user once login exists
  const decideBlockedReason = rowBusy
    ? "Saving a decision…"
    : queue.status === "loading"
      ? "Refreshing the queue…"
      : userLoading
      ? "Loading your account…"
      : user
        ? null
        : "Couldn't load your account, so decisions can't be recorded.";

  // Submits, then refreshes the queue. Rethrows so the form or modal that asked can show the error.
  const decide = async (item: ApprovalItem, decision: Decision) => {
    if (!user) throw new Error("Couldn't load your account, so decisions can't be recorded.");
    const name = billName(item);
    try {
      const { logged } = await submitDecision(item.invoice.invoiceUuid, decision, user.userId);
      const amount = item.invoice.amount === null ? "" : ` (${formatCurrency(item.invoice.amount)})`;
      setMessage(
        logged
          ? { tone: "success", text: `${DECISION_LABELS[decision.kind]}: ${name}${amount}.` }
          : {
              tone: "warning",
              text: `${DECISION_LABELS[decision.kind]}: ${name}${amount}, but it couldn't be added to the audit log. Let an admin know.`,
            },
      );
      setDetail(null);
      setForm(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      if (error instanceof AlreadyDecidedError) {
        setDetail(null);
        setForm(null);
        setMessage({ tone: "warning", text: `${name}: ${error.message}` });
        setReloadKey((key) => key + 1);
        return;
      }
      throw error;
    }
  };

  // From a row's Action menu: Approve right away, or open the matching form
  const decideFromRow = (item: ApprovalItem, kind: DecisionKind) => {
    if (kind !== "approve") {
      setForm({ kind, item });
      return;
    }
    setRowBusy(true);
    setMessage(null);
    decide(item, { kind: "approve", comment: "" })
      .catch((error: unknown) => setMessage({ tone: "error", text: `Couldn't approve ${billName(item)}. ${describeError(error)}` }))
      .finally(() => setRowBusy(false));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-inter-regular text-sm text-[#68766f]">Review the essentials. Open a bill when you need the full picture.</p>
        <p className="font-inter-regular text-[13px] text-[#68766f]">
          As of {today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <div aria-live="polite" role="status">
        {message && <MessageBar message={message} />}
      </div>

      <ApprovalSummaryCards summary={summary} />

      {queue.status === "loaded" && queue.truncated && (
        <p className="font-inter-regular text-[13px] text-[#946200]">
          Showing the 100 newest bills awaiting approval. Older ones will appear as these are decided.
        </p>
      )}

      <ApprovalQueueTable
        decideBlockedReason={decideBlockedReason}
        error={queue.status === "error" ? queue.message : null}
        loading={queue.status === "loading"}
        onDecide={decideFromRow}
        onOpen={setDetail}
        onViewChange={(changes) => setView((current) => ({ ...current, ...changes }))}
        rows={rows}
        today={today}
        total={items?.length ?? 0}
        view={view}
      />

      <p className="font-inter-regular flex items-center gap-2 text-xs text-[#68766f]">
        <Icon icon={TbShieldCheck} size={15} />
        Every decision is logged. Approval authorizes the bill; it never starts a payment.
      </p>

      {detail && (
        <BillDetailModal
          decideBlockedReason={decideBlockedReason}
          item={detail}
          onApprove={(comment) => decide(detail, { kind: "approve", comment })}
          onClose={() => setDetail(null)}
          onOpenDecision={(kind) => setForm({ kind, item: detail })}
          today={today}
        />
      )}

      {form && (
        <DecisionFormModal
          describeError={describeError}
          item={form.item}
          key={`${form.kind}-${form.item.invoice.invoiceUuid}`}
          kind={form.kind}
          onClose={() => setForm(null)}
          onSubmit={(decision) => decide(form.item, decision)}
        />
      )}
    </div>
  );
}
