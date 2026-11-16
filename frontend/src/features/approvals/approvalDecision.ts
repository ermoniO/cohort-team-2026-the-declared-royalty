import type { AuditLogCreateRequest } from "@/types/auditlogs";
import type { InvoiceStatus } from "@/types/invoice";
import { AWAITING } from "./approvalQueue";

export type DecisionKind = "approve" | "reject" | "requestInfo";

export type RejectReason = "propertyInvalid" | "incorrectBilling" | "other";

export const REJECT_REASONS: { value: RejectReason; label: string }[] = [
  { value: "propertyInvalid", label: "Property no longer valid" },
  { value: "incorrectBilling", label: "Incorrect billing" },
  { value: "other", label: "Other" },
];

export type Decision =
  | { kind: "approve"; comment: string }
  | { kind: "reject"; reason: RejectReason; details: string }
  | { kind: "requestInfo"; message: string };

// The backend's audit notes limit (AuditLogService.NOTES_MAX)
export const NOTE_MAX = 3000;

// Where each decision sends the invoice (see the status mapping in approvalQueue.ts)
export const DECISION_STATUS: Record<DecisionKind, InvoiceStatus> = {
  approve: "APPROVED",
  reject: "VOID",
  requestInfo: "PENDING_MAPPING",
};

export const DECISION_LABELS: Record<DecisionKind, string> = {
  approve: "Approved",
  reject: "Rejected",
  requestInfo: "Information requested",
};

export type DecisionErrors = Partial<Record<"reason" | "details" | "message" | "comment", string>>;

function tooLong(value: string): boolean {
  return value.trim().length > NOTE_MAX;
}

export function validateDecision(decision: Decision): DecisionErrors {
  const errors: DecisionErrors = {};
  if (decision.kind === "approve") {
    if (tooLong(decision.comment)) errors.comment = `Keep the comment to ${NOTE_MAX} characters or fewer.`;
  } else if (decision.kind === "reject") {
    if (!REJECT_REASONS.some((r) => r.value === decision.reason)) errors.reason = "Choose a reason.";
    if (decision.reason === "other" && !decision.details.trim()) {
      errors.details = "Tell the submitter what to fix.";
    } else if (tooLong(decision.details)) {
      errors.details = `Keep it to ${NOTE_MAX} characters or fewer.`;
    }
  } else {
    if (!decision.message.trim()) errors.message = "Write what you need from the submitter.";
    else if (tooLong(decision.message)) errors.message = `Keep the message to ${NOTE_MAX} characters or fewer.`;
  }
  return errors;
}

const reasonLabel = (reason: RejectReason) => REJECT_REASONS.find((r) => r.value === reason)?.label ?? "Other";

// The audit entry that records a decision. Every decision is an approval-stage action by a
// person, so it's USER_APPROVED; actionTaken says which decision it was.
export function decisionAuditEntry(decision: Decision, invoiceUuid: string, userId: string): AuditLogCreateRequest {
  const actionTaken = decision.kind === "reject" ? `Rejected: ${reasonLabel(decision.reason)}` : DECISION_LABELS[decision.kind];
  const note = decision.kind === "approve" ? decision.comment : decision.kind === "reject" ? decision.details : decision.message;

  const entry: AuditLogCreateRequest = {
    invoice: invoiceUuid,
    user: userId,
    actionType: "USER_APPROVED",
    actionTaken,
    fromState: AWAITING,
    toState: DECISION_STATUS[decision.kind],
  };
  if (note.trim()) entry.notes = note.trim();
  return entry;
}

// "Rejected: Incorrect billing" -> "Incorrect billing", for the status line in the queue
export function rejectionReason(actionTaken: string): string | null {
  const match = /^Rejected:\s*(.+)$/.exec(actionTaken);
  return match ? match[1] : null;
}
