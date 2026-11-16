import { createAuditLog, getAuditLogs } from "@/features/auditLogs/auditLogService";
import { getInvoiceByUuid, getInvoices, updateInvoice } from "@/features/invoices/invoiceService";
import type { AuditLogsResponse } from "@/types/auditlogs";
import type { InvoiceResponse } from "@/types/invoice";
import { type Decision, DECISION_STATUS, decisionAuditEntry } from "./approvalDecision";
import { AWAITING, DECIDED_INVOICE_STATUSES } from "./approvalQueue";

// The backend's page size limit
const MAX_PAGE = 100;

export type QueueData = {
  invoices: InvoiceResponse[];
  decisions: AuditLogsResponse[];
  // More bills await approval than one request returns
  truncated: boolean;
};

// Bills awaiting approval, plus recently decided ones and the decisions made on them.
// TODO(backend): one request per group, capped at 100 each and newest first, since the API
// can't filter by "decided in the queue" or sort by due date. Fine for now, not at scale.
export async function loadQueueData(): Promise<QueueData> {
  const [awaiting, decided, decisions] = await Promise.all([
    getInvoices({ size: MAX_PAGE, statuses: [AWAITING] }),
    getInvoices({ size: MAX_PAGE, statuses: DECIDED_INVOICE_STATUSES }),
    // Decisions are the USER_APPROVED entries; other entries can leave PENDING_APPROVAL too
    getAuditLogs({ fromState: AWAITING, actionType: "USER_APPROVED" }),
  ]);
  return {
    invoices: [...awaiting.items, ...decided.items],
    decisions,
    truncated: awaiting.totalElements > awaiting.items.length,
  };
}

// Thrown when someone else decided the bill first
export class AlreadyDecidedError extends Error {
  readonly invoice: InvoiceResponse;

  constructor(invoice: InvoiceResponse) {
    super("This bill was already decided by someone else. The queue has been refreshed.");
    this.name = "AlreadyDecidedError";
    this.invoice = invoice;
  }
}

export type DecisionResult = { invoice: InvoiceResponse; logged: boolean };

// Saves a decision: checks the bill is still awaiting approval, changes its status, then
// records the audit entry. The status change goes first so the log never claims a decision
// that didn't happen; if only the log fails, `logged` is false and the caller says so.
// TODO(backend): one endpoint doing both in a transaction, with the user taken from the session.
export async function submitDecision(invoiceUuid: string, decision: Decision, userId: string): Promise<DecisionResult> {
  const current = await getInvoiceByUuid(invoiceUuid);
  if (current.invoiceStatus !== AWAITING) throw new AlreadyDecidedError(current);

  const invoice = await updateInvoice(invoiceUuid, { invoiceStatus: DECISION_STATUS[decision.kind] });
  try {
    await createAuditLog(decisionAuditEntry(decision, invoiceUuid, userId));
    return { invoice, logged: true };
  } catch {
    return { invoice, logged: false };
  }
}
