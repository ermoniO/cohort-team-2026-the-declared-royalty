import type { ReactNode } from "react";
import { TbCheck, TbChevronDown, TbChevronUp } from "react-icons/tb";
import Icon from "@/components/ui/Icon";
import { navigateTo } from "@/app/navigation";
import type { AuditLogsResponse } from "@/types/auditlogs";
import { auditHistoryPath, describeActionType, formatFullTimestamp, formatTime } from "./auditLogDisplay";
import type { Actor } from "./useAuditHistory";

type AuditEventItemProps = {
  log: AuditLogsResponse;
  actor: Actor;
  // Shown on the all-bills view so each event says which bill it belongs to
  invoiceLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  last: boolean;
};

const mono = "font-mono text-xs text-[#68766f]";

function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className={mono}>{label}</dt>
      <dd className="font-inter-regular mt-1 break-words text-[13px] text-[#25362f]">{children}</dd>
    </div>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-0.5">
      <dt className={`${mono} w-24 shrink-0`}>{label}</dt>
      <dd className="break-all font-mono text-xs text-[#25362f]">{value}</dd>
    </div>
  );
}

export default function AuditEventItem({ log, actor, invoiceLabel, expanded, onToggle, last }: AuditEventItemProps) {
  const { stage } = describeActionType(log.actionType);
  const detailsId = `audit-event-${log.auditLogId}`;
  const sameTimestamp = log.createdAt === log.updatedAt;

  return (
    <li className="grid grid-cols-[44px_20px_minmax(0,1fr)] gap-x-3">
      <time className="font-inter-regular pt-0.5 text-xs tabular-nums text-[#68766f]" dateTime={log.createdAt}>
        {formatTime(log.createdAt)}
      </time>

      {/* Timeline rail: a dot per event joined by a line */}
      <div aria-hidden="true" className="relative flex justify-center">
        {!last && <span className="absolute top-5 bottom-0 w-px bg-[#e6ebe8]" />}
        {expanded ? (
          <span className="relative mt-0.5 flex size-4 items-center justify-center rounded-full bg-[#16834a] text-white">
            <Icon icon={TbCheck} size={11} />
          </span>
        ) : (
          <span className="relative mt-1 size-2.5 rounded-full border-2 border-[#98a29c] bg-white" />
        )}
      </div>

      <div className={last ? "pb-1" : "pb-6"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="font-inter-semibold text-sm text-[#25362f]">{log.actionTaken}</h4>
            <p className="font-inter-regular mt-0.5 text-xs text-[#68766f]">
              {actor.name}
              {actor.role && ` · ${actor.role}`} / {stage.toLowerCase()}
            </p>
            {invoiceLabel && (
              <button
                className="font-inter-medium mt-0.5 text-left text-xs text-[#16834a] hover:underline"
                onClick={() => navigateTo(auditHistoryPath(log.invoice))}
                type="button"
              >
                {invoiceLabel}
              </button>
            )}
            <p className={`${mono} mt-1 break-words`}>
              {log.fromState} <span aria-label="to">→</span> {log.toState}
            </p>
          </div>
          <button
            aria-controls={detailsId}
            aria-expanded={expanded}
            className="font-inter-medium flex shrink-0 items-center gap-1 text-xs text-[#16834a] hover:underline"
            onClick={onToggle}
            type="button"
          >
            {expanded ? "Hide details" : "View details"}
            <Icon icon={expanded ? TbChevronUp : TbChevronDown} size={13} />
          </button>
        </div>

        {expanded && (
          <div className="mt-3 rounded-lg border border-[#d7ebdd] bg-[#f6fbf8] p-4" id={detailsId}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h5 className="font-inter-semibold text-[13px] text-[#14532d]">Event details</h5>
              <span className={mono}>audit_logs · read-only</span>
            </div>

            <dl className="flex flex-col gap-1.5 border-b border-[#d7ebdd] pb-3">
              <IdRow label="audit_uuid" value={log.auditLogId} />
              <IdRow label="invoice_uuid" value={log.invoice} />
              <IdRow label="user_uuid" value={log.user} />
            </dl>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 pt-3 sm:grid-cols-2">
              <Detail label="action_type">
                <span className="font-mono text-xs">{log.actionType}</span>
              </Detail>
              <Detail label="action_taken">{log.actionTaken}</Detail>
              <Detail label="from_state">
                <span className="font-mono text-xs">{log.fromState}</span>
              </Detail>
              <Detail label="to_state">
                <span className="font-mono text-xs">{log.toState}</span>
              </Detail>
              <Detail label="notes" wide>
                {log.notes?.trim() ? <span className="whitespace-pre-wrap">{log.notes}</span> : "—"}
              </Detail>
              <Detail label="created_at">
                <span className="font-mono text-xs">{formatFullTimestamp(log.createdAt)}</span>
              </Detail>
              <Detail label="updated_at">
                <span className="font-mono text-xs">{formatFullTimestamp(log.updatedAt)}</span>
              </Detail>
            </dl>

            <p className="font-inter-regular mt-3 text-xs text-[#68766f]">
              created_at is the event time; updated_at is the stored record timestamp.{" "}
              {sameTimestamp ? "They are equal here." : "They differ here."} Audit logs are append-only and are never edited.
            </p>
          </div>
        )}
      </div>
    </li>
  );
}