import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { plural } from "@/features/invoices/invoiceFormat";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { DatePicker } from "@/components/ui/DatePicker";
import type { AuditActionType } from "@/types/auditlogs";
import AuditEventItem from "./AuditEventItem";
import {
  ACTION_TYPES,
  actionTypeLabel,
  formatDayHeading,
  groupByDay,
  timeZoneLabel,
} from "./auditLogDisplay";
import { useAuditHistory } from "./useAuditHistory";

const controlClass =
  "font-inter-regular h-9 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20";

function Message({ children, alert = false }: { children: string; alert?: boolean }) {
  return (
    <p
      className="font-inter-regular px-5 py-16 text-center text-sm text-[#68766f]"
      role={alert ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

type AuditTimelineProps = {
  targetInvoiceUuid?: string;
  showInvoice?: boolean;
  onSelectInvoice?: (invoiceUuid: string) => void;
  auditHistory?: ReturnType<typeof useAuditHistory>;
};

export default function AuditTimeline({
  targetInvoiceUuid,
  showInvoice = false,
  onSelectInvoice,
  auditHistory,
}: AuditTimelineProps) {
  const internalHistory = useAuditHistory(targetInvoiceUuid, !auditHistory);
  const {
    logs,
    filtered,
    view,
    setView,
    resetView,
    isLoading,
    error,
    actorFor,
    invoiceLabel,
    actorOptions,
  } = auditHistory ?? internalHistory;

  // Expanded rows are per-visit UI state, so they stay local
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtering =
    view.query.trim() !== "" || view.actionType !== "" || view.actorUuid !== "" || view.day !== "";
  const groups = groupByDay(filtered);

  let body;
  if (error) body = <Message alert>{`Couldn't load the history. ${error}`}</Message>;
  else if (isLoading) body = <Message>Loading history…</Message>;
  else if (logs.length === 0) body = <Message>No events recorded yet.</Message>;
  else if (filtered.length === 0) body = <Message>No events match these filters.</Message>;
  else {
    body = (
      <div className="flex flex-col">
        {groups.map((group, index) => (
          <section
            aria-label={formatDayHeading(group.day)}
            className={`px-5 py-4 ${index > 0 ? "border-t border-[#e6ebe8]" : ""}`}
            key={group.day}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-inter-semibold text-[13px] text-[#25362f]">
                {formatDayHeading(group.day)}
              </h3>
              {group.events[0] && (
                <span className="font-inter-regular text-xs text-[#98a29c]">
                  {timeZoneLabel(new Date(group.events[0].createdAt))}
                </span>
              )}
            </div>
            <ol>
              {group.events.map((log, i) => (
                <AuditEventItem
                  actor={actorFor(log.user)}
                  expanded={expanded.has(log.auditLogId)}
                  invoiceLabel={showInvoice ? invoiceLabel(log.invoice) : undefined}
                  key={log.auditLogId}
                  last={i === group.events.length - 1}
                  log={log}
                  onSelectInvoice={onSelectInvoice}
                  onToggle={() => toggle(log.auditLogId)}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="event-history-title"
      className="flex min-h-[320px] flex-1 flex-col rounded-xl border border-[#e6ebe8] bg-white shadow-xs"
    >
      <div className="flex flex-col gap-3 border-b border-[#e6ebe8] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="font-inter-semibold text-base text-[#14532d]" id="event-history-title">
              Event history
            </h2>
            <span className="font-inter-regular text-xs text-[#98a29c]">
              {plural(logs.length, "event")}
            </span>
          </div>
          <button
            aria-label={`Sorted ${view.sort} first. Switch to ${view.sort === "oldest" ? "newest" : "oldest"} first`}
            className="font-inter-medium text-xs text-[#68766f] hover:text-[#25362f]"
            onClick={() => setView({ sort: view.sort === "oldest" ? "newest" : "oldest" })}
            type="button"
          >
            {view.sort === "oldest" ? "Oldest first" : "Newest first"}
          </button>
        </div>

        <label className={`${controlClass} flex items-center gap-2 bg-[#f8faf9]`}>
          <FiSearch aria-hidden="true" className="shrink-0 text-[#98a29c]" size={14} />
          <span className="sr-only">Search actions or notes</span>
          <input
            className="w-full bg-transparent outline-none placeholder:text-[#98a29c]"
            maxLength={100}
            onChange={(event) => setView({ query: event.target.value })}
            placeholder="Search actions or notes…"
            type="search"
            value={view.query}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <SelectDropdown
            ariaLabel="Action type"
            value={view.actionType}
            onChange={(val) => setView({ actionType: val as AuditActionType | "" })}
            className="min-w-[165px]"
            buttonClassName="h-9 rounded-[7px]"
            options={[
              { value: "", label: "All action types" },
              ...ACTION_TYPES.map((type) => ({
                value: type,
                label: actionTypeLabel(type),
              })),
            ]}
          />
          <SelectDropdown
            ariaLabel="Actor"
            value={view.actorUuid}
            onChange={(val) => setView({ actorUuid: val })}
            className="min-w-[155px]"
            buttonClassName="h-9 rounded-[7px]"
            options={[
              { value: "", label: "All actors" },
              ...actorOptions.map((option) => ({
                value: option.value,
                label: option.label,
              })),
            ]}
          />
          <DatePicker
            ariaLabel="Day"
            value={view.day}
            onChange={(val) => setView({ day: val })}
            placeholder="All dates"
            allowClear
            className="min-w-[160px]"
            buttonClassName="h-9 rounded-[7px]"
          />
          {filtering && (
            <button
              className="font-inter-medium px-1 text-xs text-[#16834a] hover:underline"
              onClick={resetView}
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div aria-busy={isLoading} className="flex-1">
        {body}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#e6ebe8] px-5 py-3">
        <span className="font-inter-regular text-xs text-[#68766f]" role="status">
          {filtering
            ? `Showing ${filtered.length} of ${plural(logs.length, "event")}`
            : `Showing ${plural(logs.length, "event")}${showInvoice ? "" : " for this invoice"}`}
        </span>
        <span className="font-inter-regular text-xs text-[#98a29c]">Read-only history</span>
      </div>
    </section>
  );
}

