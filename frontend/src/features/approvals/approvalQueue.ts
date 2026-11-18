import type { AuditLogsResponse } from "@/types/auditlogs";
import type { InvoiceResponse, InvoiceStatus, InvoiceValidationResponse } from "@/types/invoice";

// The backend has no REJECTED or INFORMATION_REQUESTED status yet, so decisions map onto
// existing ones, and the audit entry written with the decision tells them apart:
//   Approve          PENDING_APPROVAL -> APPROVED
//   Reject           PENDING_APPROVAL -> VOID
//   Request info     PENDING_APPROVAL -> PENDING_MAPPING (back to review on the Bills page)
// TODO(backend): switch to real statuses once the API has them.
export const AWAITING: InvoiceStatus = "PENDING_APPROVAL";

export type ApprovalStatus = "awaiting" | "infoRequested" | "approved" | "rejected" | "processing" | "paid";

export type ApprovalItem = {
  invoice: InvoiceResponse;
  status: ApprovalStatus;
  // The latest decision made in the approval queue, if any
  decision: AuditLogsResponse | null;
  // The backend's validation checks; null when they couldn't be loaded
  validation: InvoiceValidationResponse | null;
  // Who confirmed the details and sent it for approval; null when not recorded or not loaded
  sentForApprovalBy: string | null;
};

// Loaded alongside the queue; each is optional so a failure only affects its own column
export type QueueExtras = {
  validations?: InvoiceValidationResponse[];
  // Audit entries that moved bills to PENDING_APPROVAL
  reviews?: AuditLogsResponse[];
  // userId -> display name
  userNames?: Record<string, string>;
};

// Where each invoice status lands once it has left the queue through a decision
const DECIDED_STATUS: Partial<Record<InvoiceStatus, ApprovalStatus>> = {
  APPROVED: "approved",
  VOID: "rejected",
  PENDING_MAPPING: "infoRequested",
  PROCESSING_PAYMENT: "processing",
  PAID: "paid",
};

// Statuses to fetch for invoices that were decided here (they must also have a decision entry)
export const DECIDED_INVOICE_STATUSES = Object.keys(DECIDED_STATUS) as InvoiceStatus[];

// A decision someone made in the queue. Other entries can start at PENDING_APPROVAL too,
// e.g. the backend logs "Duplicate upload rejected" with the same state before and after.
export function isQueueDecision(log: AuditLogsResponse): boolean {
  return log.actionType === "USER_APPROVED" && log.fromState === AWAITING && log.toState !== AWAITING;
}

// The review that sent the bill for approval most recently (a bill sent back can be sent again).
// The backend logs it as USER_VALIDATED, or USER_IDENTIFIED when the reviewer corrected the AI.
export function sentForApprovalEntry(logs: AuditLogsResponse[]): AuditLogsResponse | null {
  let latest: AuditLogsResponse | null = null;
  for (const log of logs) {
    const review = log.actionType === "USER_VALIDATED" || log.actionType === "USER_IDENTIFIED";
    if (!review || log.toState !== AWAITING || log.fromState === AWAITING) continue;
    if (!latest || Date.parse(log.createdAt) > Date.parse(latest.createdAt)) latest = log;
  }
  return latest;
}

// Every invoice awaiting approval, plus any invoice with a decision made from the queue
export function buildQueue(invoices: InvoiceResponse[], logs: AuditLogsResponse[], extras: QueueExtras = {}): ApprovalItem[] {
  const latest = new Map<string, AuditLogsResponse>();
  for (const log of logs) {
    if (!isQueueDecision(log)) continue;
    const current = latest.get(log.invoice);
    if (!current || Date.parse(log.createdAt) > Date.parse(current.createdAt)) latest.set(log.invoice, log);
  }

  const validations = new Map((extras.validations ?? []).map((v) => [v.invoiceUuid, v]));
  const reviewsByInvoice = new Map<string, AuditLogsResponse[]>();
  for (const review of extras.reviews ?? []) {
    reviewsByInvoice.set(review.invoice, [...(reviewsByInvoice.get(review.invoice) ?? []), review]);
  }
  const sentBy = (invoiceUuid: string) => {
    const entry = sentForApprovalEntry(reviewsByInvoice.get(invoiceUuid) ?? []);
    if (!entry) return null;
    return extras.userNames?.[entry.user] ?? `User ${entry.user.slice(0, 8)}`;
  };

  const seen = new Set<string>();
  const items: ApprovalItem[] = [];
  for (const invoice of invoices) {
    if (seen.has(invoice.invoiceUuid)) continue;
    seen.add(invoice.invoiceUuid);

    const decision = latest.get(invoice.invoiceUuid) ?? null;
    const details = {
      decision,
      validation: validations.get(invoice.invoiceUuid) ?? null,
      sentForApprovalBy: sentBy(invoice.invoiceUuid),
    };
    if (invoice.invoiceStatus === AWAITING) {
      // A bill sent back and resubmitted is awaiting again; its old decision is still history
      items.push({ invoice, status: "awaiting", ...details });
      continue;
    }
    const status = DECIDED_STATUS[invoice.invoiceStatus];
    if (status && decision) items.push({ invoice, status, ...details });
  }
  return items;
}

// The validation column's text: "4/4 passed", or the checks that need a look
export function validationIssues(validation: InvoiceValidationResponse): string[] {
  return validation.checks
    .filter((check) => check.status !== "PASSED")
    .map((check) => (check.status === "FAILED" ? check.detail ?? check.label : `Couldn't check ${check.label}`));
}

// --- Dates ---

// "2026-11-16" as a local calendar date (Date.parse would read it as UTC midnight)
export function parseLocalDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Whole days from today to the due date: negative when it's past
export function daysUntilDue(invoice: InvoiceResponse, today: Date): number | null {
  const due = parseLocalDate(invoice.dueDate);
  if (!due) return null;
  return Math.round((due.getTime() - startOfDay(today).getTime()) / 86_400_000);
}

// Still owed and past its due date. "Past due" is about timing, so it can overlap
// with any unpaid workflow status; rejected and paid bills are never past due.
export function isPastDue(item: ApprovalItem, today: Date): boolean {
  if (item.status === "rejected" || item.status === "paid") return false;
  const days = daysUntilDue(item.invoice, today);
  return days !== null && days < 0;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The line under the due date: "In 2 days", "Due today", "Past due · 2 days", "Settled"
export function dueDetail(item: ApprovalItem, today: Date): { text: string; pastDue: boolean } | null {
  if (item.status === "paid") return { text: "Settled", pastDue: false };
  if (item.status === "rejected") return null;
  const days = daysUntilDue(item.invoice, today);
  if (days === null) return null;
  if (days < 0) return { text: `Past due · ${plural(-days, "day")}`, pastDue: true };
  if (days === 0) return { text: "Due today", pastDue: false };
  if (days === 1) return { text: "Due tomorrow", pastDue: false };
  return { text: `In ${plural(days, "day")}`, pastDue: false };
}

// --- Priority ---

export type PriorityLevel = "high" | "medium" | "low";
export type Priority = { level: PriorityLevel; reason: string };

// Days before the due date at which a bill becomes urgent, and "due soon"
export const PRIORITY_DAYS = { urgent: 2, soon: 7 } as const;

const dueText = (days: number) =>
  days < 0 ? `Past due · ${plural(-days, "day")}` : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${plural(days, "day")}`;

// How soon a bill awaiting approval needs a decision, with the reason shown next to it.
// From the due date and the validation checks; decided bills have no priority.
//   High:   past due or due within 2 days, or a validation issue and due within 7 days
//   Medium: due within 7 days, or any validation issue
//   Low:    everything else
export function priorityOf(item: ApprovalItem, today: Date): Priority | null {
  if (item.status !== "awaiting") return null;
  const days = daysUntilDue(item.invoice, today);
  const issues = item.validation ? validationIssues(item.validation).length : 0;
  const issueText = plural(issues, "validation issue");

  if (days !== null && days <= PRIORITY_DAYS.urgent) return { level: "high", reason: dueText(days) };
  if (issues > 0 && days !== null && days <= PRIORITY_DAYS.soon) return { level: "high", reason: `${issueText} · ${dueText(days).toLowerCase()}` };
  if (days !== null && days <= PRIORITY_DAYS.soon) return { level: "medium", reason: dueText(days) };
  if (issues > 0) return { level: "medium", reason: issueText };
  return { level: "low", reason: days === null ? "No due date" : dueText(days) };
}

const PRIORITY_RANK: Record<PriorityLevel, number> = { high: 0, medium: 1, low: 2 };

// --- Filters and sorting ---

export type StatusFilter = "all" | ApprovalStatus | "pastDue";
export type DueFilter = "all" | "month" | "week" | "day" | "pastDue";
export type SortOrder = "priority" | "dueAsc" | "dueDesc" | "amountDesc";

export type QueueView = { search: string; status: StatusFilter; due: DueFilter; sort: SortOrder };

export const DEFAULT_QUEUE_VIEW: QueueView = { search: "", status: "all", due: "all", sort: "priority" };

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "awaiting", label: "Awaiting approval" },
  { value: "infoRequested", label: "Information requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "processing", label: "Processing payment" },
  { value: "paid", label: "Paid" },
  { value: "pastDue", label: "Past due" },
];

export const DUE_FILTERS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "All dates" },
  { value: "month", label: "Due within 1 month" },
  { value: "week", label: "Due within 1 week" },
  { value: "day", label: "Due within 1 day" },
  { value: "pastDue", label: "Past due" },
];

export const SORT_ORDERS: { value: SortOrder; label: string }[] = [
  { value: "priority", label: "Priority: high first" },
  { value: "dueAsc", label: "Due date: earliest first" },
  { value: "dueDesc", label: "Due date: latest first" },
  { value: "amountDesc", label: "Amount: highest first" },
];

const DUE_WINDOW_DAYS: Record<"month" | "week" | "day", number> = { month: 31, week: 7, day: 1 };

function matchesSearch(item: ApprovalItem, query: string): boolean {
  if (!query) return true;
  const { invoice } = item;
  return [
    invoice.vendorName,
    invoice.propertyName,
    invoice.vendorSuppliedInvoiceId,
    invoice.originalFilename,
    invoice.description,
    invoice.uploadedByName,
    item.sentForApprovalBy,
  ].some(
    (field) => field?.toLowerCase().includes(query),
  );
}

function matchesDue(item: ApprovalItem, due: DueFilter, today: Date): boolean {
  if (due === "all") return true;
  if (due === "pastDue") return isPastDue(item, today);
  const days = daysUntilDue(item.invoice, today);
  // "Due within a week": from today up to 7 days out, so past-due bills aren't included
  return days !== null && days >= 0 && days <= DUE_WINDOW_DAYS[due];
}

// Missing values sort last in every order
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction * (a - b);
}

export function applyView(items: ApprovalItem[], view: QueueView, today: Date): ApprovalItem[] {
  const query = view.search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (view.status === "pastDue" ? !isPastDue(item, today) : view.status !== "all" && item.status !== view.status) {
      return false;
    }
    return matchesDue(item, view.due, today) && matchesSearch(item, query);
  });

  const dueTime = (item: ApprovalItem) => parseLocalDate(item.invoice.dueDate)?.getTime() ?? null;
  // Bills without a priority (already decided) sort after every level
  const rank = (item: ApprovalItem) => {
    const priority = priorityOf(item, today);
    return priority ? PRIORITY_RANK[priority.level] : 3;
  };
  return filtered.sort((a, b) => {
    const byOrder =
      view.sort === "amountDesc"
        ? compareNullable(a.invoice.amount, b.invoice.amount, -1)
        : view.sort === "priority"
          ? // Then earliest due first within a level
            rank(a) - rank(b) || compareNullable(dueTime(a), dueTime(b), 1)
          : compareNullable(dueTime(a), dueTime(b), view.sort === "dueAsc" ? 1 : -1);
    // Stable tie-break so equal rows don't jump around between renders
    return byOrder || a.invoice.invoiceUuid.localeCompare(b.invoice.invoiceUuid);
  });
}

// --- Summary cards ---

export type QueueSummary = { awaitingCount: number; awaitingTotal: number; pastDueCount: number; infoRequestedCount: number };

export function summarize(items: ApprovalItem[], today: Date): QueueSummary {
  const awaiting = items.filter((item) => item.status === "awaiting");
  return {
    awaitingCount: awaiting.length,
    awaitingTotal: awaiting.reduce((sum, item) => sum + (item.invoice.amount ?? 0), 0),
    pastDueCount: items.filter((item) => isPastDue(item, today)).length,
    infoRequestedCount: items.filter((item) => item.status === "infoRequested").length,
  };
}
