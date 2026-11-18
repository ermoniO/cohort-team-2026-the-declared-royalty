import type { ApprovalStatus } from "./approvalQueue";
import { APPROVAL_BADGES } from "./approvalStatus";

export default function ApprovalStatusPill({ status }: { status: ApprovalStatus }) {
  const badge = APPROVAL_BADGES[status];
  return (
    <span className={`font-inter-medium inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs ${badge.className}`}>
      {badge.label}
    </span>
  );
}
