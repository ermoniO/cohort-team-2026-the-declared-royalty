import { TbCheck, TbMessageCircle, TbX } from "react-icons/tb";
import type { ActionMenuItem } from "@/components/ui/ActionMenu";
import { formatReceived } from "@/features/invoices/invoiceFormat";
import { type DecisionKind, rejectionReason } from "./approvalDecision";
import { type ApprovalItem, type ApprovalStatus, parseLocalDate } from "./approvalQueue";

export const APPROVAL_BADGES: Record<ApprovalStatus, { label: string; className: string }> = {
  awaiting: { label: "Awaiting approval", className: "bg-[#e8f7ed] text-[#16834a]" },
  infoRequested: { label: "Information requested", className: "bg-[#fdf6e3] text-[#946200]" },
  approved: { label: "Approved", className: "bg-[#e8f7ed] text-[#16834a]" },
  rejected: { label: "Rejected", className: "bg-[#fdeeee] text-[#b4322c]" },
  processing: { label: "Processing payment", className: "bg-[#eaf1fb] text-[#2f5ea8]" },
  paid: { label: "Paid", className: "bg-[#f1f4f2] text-[#4f5d56]" },
};

// The line under the badge: what happened, or what's needed next
export function approvalStatusDetail(item: ApprovalItem): string {
  const decidedOn = item.decision ? formatReceived(item.decision.createdAt) : null;
  switch (item.status) {
    case "awaiting":
      return item.decision ? "Resubmitted for approval" : "Awaiting a decision";
    case "infoRequested":
      return "Waiting for a response";
    case "approved":
      return decidedOn ? `Approved ${decidedOn}` : "Approved";
    case "rejected":
      return (item.decision && rejectionReason(item.decision.actionTaken)) ?? "Rejected";
    case "processing":
      return "Payment in progress";
    case "paid":
      return "Payment recorded";
  }
}

export function billName(item: ApprovalItem): string {
  return item.invoice.vendorName ?? item.invoice.originalFilename ?? "Unmatched bill";
}

export function formatDueDate(value: string | null): string | null {
  const date = parseLocalDate(value);
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
}

// The choices in every Action menu for a bill awaiting approval
export const DECISION_MENU_ITEMS: readonly ActionMenuItem<DecisionKind>[] = [
  { id: "approve", label: "Approve", icon: TbCheck, tone: "success" },
  { id: "reject", label: "Reject", icon: TbX, tone: "danger" },
  { id: "requestInfo", label: "Request information", icon: TbMessageCircle },
];
