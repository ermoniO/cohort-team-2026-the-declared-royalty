import { createAuditLog, getAuditLogs } from "@/features/auditLogs/auditLogService";
import { getInvoiceByUuid, getInvoices, getInvoiceValidations, updateInvoice } from "@/features/invoices/invoiceService";
import { getDisplayName } from "@/features/users/userDisplay";
import { getUsers } from "@/features/users/userService";
import type { AuditLogsResponse } from "@/types/auditlogs";
import type { InvoiceResponse } from "@/types/invoice";
import { type Decision, DECISION_STATUS, decisionAuditEntry } from "./approvalDecision";
import { AWAITING, DECIDED_INVOICE_STATUSES, type QueueExtras } from "./approvalQueue";

// The backend's page size limit
const MAX_PAGE = 100;

export type QueueData = {
  invoices: InvoiceResponse[];
  decisions: AuditLogsResponse[];
  // Validation results, who sent each bill for approval, and user names for the table's columns
  extras: QueueExtras;
  // More bills await approval than one request returns
  truncated: boolean;
};

// Bills awaiting approval, plus recently decided ones and the decisions made on them.
// TODO(backend): one request per group, capped at 100 each and newest first, since the API
// can't filter by "decided in the queue" or sort by due date. Fine for now, not at scale.
export async function loadQueueData(): Promise<QueueData> {
  const [awaiting, decided, decisions, reviews, users] = await Promise.all([
    getInvoices({ size: MAX_PAGE, statuses: [AWAITING] }),
    getInvoices({ size: MAX_PAGE, statuses: DECIDED_INVOICE_STATUSES }),
    // Decisions are the USER_APPROVED entries; other entries can leave PENDING_APPROVAL too
    getAuditLogs({ fromState: AWAITING, actionType: "USER_APPROVED" }),
    // The extras are optional: if one fails, only its column shows "not available"
    getAuditLogs({ toState: AWAITING }).catch(() => undefined),
    getUsers().catch(() => undefined),
  ]);
  const invoices = [...awaiting.items, ...decided.items];
  // One request for the whole queue (at most 2 × 100 bills, within the endpoint's limit of 200)
  const validations =
    invoices.length === 0 ? [] : await getInvoiceValidations(invoices.map((invoice) => invoice.invoiceUuid)).catch(() => undefined);

  return {
    invoices,
    decisions,
    extras: {
      validations,
      reviews,
      userNames: users && Object.fromEntries(users.map((user) => [user.userId, getDisplayName(user)])),
    },
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
