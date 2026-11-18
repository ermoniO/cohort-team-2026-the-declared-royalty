import { FiSearch } from "react-icons/fi";
import { TbAlertTriangle, TbArrowsMaximize, TbCircleCheck } from "react-icons/tb";
import ActionMenu from "@/components/ui/ActionMenu";
import Icon from "@/components/ui/Icon";
import { formatCurrency, plural } from "@/features/invoices/invoiceFormat";
import type { DecisionKind } from "./approvalDecision";
import {
  type ApprovalItem,
  dueDetail,
  DUE_FILTERS,
  type QueueView,
  SORT_ORDERS,
  STATUS_FILTERS,
  validationIssues,
} from "./approvalQueue";
import { approvalStatusDetail, billName, DECISION_MENU_ITEMS, formatDueDate } from "./approvalStatus";
import ApprovalStatusPill from "./ApprovalStatusPill";
import NotAvailable from "./NotAvailable";

type ApprovalQueueTableProps = {
  // The rows after filtering and sorting, or null while the first load runs
  rows: ApprovalItem[] | null;
  total: number;
  loading: boolean;
  error: string | null;
  view: QueueView;
  onViewChange: (changes: Partial<QueueView>) => void;
  today: Date;
  // Why decisions are unavailable (e.g. no signed-in user), or null when they're allowed
  decideBlockedReason: string | null;
  onOpen: (item: ApprovalItem) => void;
  onDecide: (item: ApprovalItem, kind: DecisionKind) => void;
};

const selectClass =
  "font-inter-medium h-9 rounded-[7px] border border-[#e6ebe8] bg-white pl-3 pr-8 text-[13px] text-[#25362f] outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20";

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabledOption,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabledOption?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-inter-regular text-[13px] text-[#68766f]">{label}</span>
      <select className={selectClass} onChange={(event) => onChange(event.target.value as T)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {disabledOption && <option disabled>{disabledOption}</option>}
      </select>
    </label>
  );
}

const COLUMN_COUNT = 8;

// Uploader, and who confirmed the details and sent it for approval (they can differ)
function SubmittedCell({ item }: { item: ApprovalItem }) {
  return (
    <>
      <span className="block">{item.invoice.uploadedByName ?? <NotAvailable label="Unknown" />}</span>
      <span className="block text-xs text-[#68766f]">
        {item.sentForApprovalBy ? `Sent by ${item.sentForApprovalBy}` : "Sender not recorded"}
      </span>
    </>
  );
}

// "4/4 passed", or each issue: the approver decides what to do, nothing is blocked
function ValidationCell({ item }: { item: ApprovalItem }) {
  if (!item.validation) return <NotAvailable label="Not checked" />;
  const issues = validationIssues(item.validation);
  if (issues.length === 0) {
    return (
      <span className="font-inter-medium inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#e8f7ed] px-2 py-0.5 text-xs text-[#16834a]">
        <Icon icon={TbCircleCheck} size={13} />
        {item.validation.passedCount}/{item.validation.totalCount} passed
      </span>
    );
  }
  return (
    <div className="max-w-[240px]" title={issues.join("\n")}>
      <span className="font-inter-medium inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#fdf6e3] px-2 py-0.5 text-xs text-[#946200]">
        <Icon icon={TbAlertTriangle} size={13} />
        {plural(issues.length, "issue")}
      </span>
      <ul className="mt-1 text-xs text-[#68766f]">
        {issues.map((issue) => (
          <li className="truncate" key={issue}>
            {issue}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyRow({ children, alert = false }: { children: string; alert?: boolean }) {
  return (
    <tr>
      <td className="px-5 py-16 text-center" colSpan={COLUMN_COUNT}>
        <p className={`font-inter-regular text-sm ${alert ? "text-[#b42318]" : "text-[#68766f]"}`} role={alert ? "alert" : "status"}>
          {children}
        </p>
      </td>
    </tr>
  );
}

export default function ApprovalQueueTable({
  rows,
  total,
  loading,
  error,
  view,
  onViewChange,
  today,
  decideBlockedReason,
  onOpen,
  onDecide,
}: ApprovalQueueTableProps) {
  const filtering = view.search.trim() !== "" || view.status !== "all" || view.due !== "all";

  return (
    <div className="rounded-xl border border-[#e6ebe8] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <h2 className="font-inter-semibold text-base text-[#14532d]">Approval queue</h2>
        <span className="font-inter-medium rounded-md bg-[#f1f4f2] px-2 py-0.5 text-xs text-[#4f5d56]">
          {rows ? plural(total, "bill") : "Loading…"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-5 pb-4 pt-4">
        <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-[7px] border border-[#e6ebe8] bg-white px-3">
          <FiSearch aria-hidden="true" className="shrink-0 text-[#98a29c]" size={15} />
          <span className="sr-only">Search bills</span>
          <input
            className="font-inter-regular w-full bg-transparent text-sm text-[#25362f] outline-none placeholder:text-[#98a29c]"
            maxLength={100}
            onChange={(event) => onViewChange({ search: event.target.value })}
            placeholder="Search vendor, property, invoice number or who submitted it"
            type="search"
            value={view.search}
          />
        </label>
        <Select label="Status" onChange={(status) => onViewChange({ status })} options={STATUS_FILTERS} value={view.status} />
        <Select label="Due" onChange={(due) => onViewChange({ due })} options={DUE_FILTERS} value={view.due} />
        <Select
          disabledOption="Priority: high first (not available yet)"
          label="Sort"
          onChange={(sort) => onViewChange({ sort })}
          options={SORT_ORDERS}
          value={view.sort}
        />
      </div>

      {error && rows && (
        <p className="font-inter-regular border-t border-[#e6ebe8] px-5 py-2.5 text-sm text-[#b42318]" role="alert">
          {`Couldn't refresh the queue. ${error}`}
        </p>
      )}

      <div className="relative overflow-x-auto">
        <table aria-busy={loading} className={`w-full min-w-[1180px] text-left text-[13px] ${loading && rows ? "opacity-60" : ""}`}>
          <thead>
            <tr className="font-inter-semibold border-y border-[#e6ebe8] bg-[#f8faf9] text-[11px] text-[#98a29c]">
              <th className="px-5 py-2.5 font-normal" scope="col">BILL / PROPERTY</th>
              <th className="px-5 py-2.5 text-right font-normal" scope="col">AMOUNT</th>
              <th className="px-5 py-2.5 font-normal" scope="col">SUBMITTED BY</th>
              <th className="px-5 py-2.5 font-normal" scope="col">VALIDATION</th>
              <th className="px-5 py-2.5 font-normal" scope="col">PRIORITY</th>
              <th className="px-5 py-2.5 font-normal" scope="col">STATUS</th>
              <th className="px-5 py-2.5 font-normal" scope="col">DUE DATE</th>
              <th className="px-5 py-2.5 text-right font-normal" scope="col">ACTIONS / DETAILS</th>
            </tr>
          </thead>
          <tbody className="font-inter-regular text-[#25362f]">
            {!rows ? (
              error ? <EmptyRow alert>{`Couldn't load the approval queue. ${error}`}</EmptyRow> : <EmptyRow>Loading the approval queue…</EmptyRow>
            ) : rows.length === 0 ? (
              <EmptyRow>{filtering ? "No bills match these filters." : "No bills are waiting for approval."}</EmptyRow>
            ) : (
              rows.map((item) => {
                const { invoice } = item;
                const name = billName(item);
                const due = dueDetail(item, today);
                const amount = invoice.amount === null ? "no amount" : formatCurrency(invoice.amount);
                return (
                  <tr className="border-b border-[#e6ebe8] last:border-b-0 hover:bg-[#f8faf9]" key={invoice.invoiceUuid}>
                    <td className="px-5 py-3.5">
                      <span className="font-inter-semibold block text-[#25362f]">{name}</span>
                      {invoice.description && (
                        <span className="block max-w-[320px] truncate text-xs text-[#4f5d56]" title={invoice.description}>
                          {invoice.description}
                        </span>
                      )}
                      <span className="block text-xs text-[#68766f]">{invoice.propertyName ?? "No property matched"}</span>
                      {invoice.vendorSuppliedInvoiceId && (
                        <span className="block font-mono text-[11px] text-[#98a29c]">{invoice.vendorSuppliedInvoiceId}</span>
                      )}
                    </td>
                    <td className="font-inter-semibold whitespace-nowrap px-5 py-3.5 text-right tabular-nums">
                      {invoice.amount === null ? <NotAvailable label="Not set" /> : formatCurrency(invoice.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <SubmittedCell item={item} />
                    </td>
                    <td className="px-5 py-3.5">
                      <ValidationCell item={item} />
                    </td>
                    <td className="px-5 py-3.5">
                      <NotAvailable label="Priority isn't available yet" />
                    </td>
                    <td className="px-5 py-3.5">
                      <ApprovalStatusPill status={item.status} />
                      <span className="mt-1 block text-xs text-[#68766f]">{approvalStatusDetail(item)}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="block">{formatDueDate(invoice.dueDate) ?? <NotAvailable label="No due date" />}</span>
                      {due && (
                        <span className={`block text-xs ${due.pastDue ? "font-inter-medium text-[#946200]" : "text-[#68766f]"}`}>{due.text}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "awaiting" && (
                          <span title={decideBlockedReason ?? undefined}>
                            <ActionMenu
                              disabled={decideBlockedReason !== null}
                              items={DECISION_MENU_ITEMS}
                              onSelect={(kind) => onDecide(item, kind)}
                              label={`Actions for ${name}, ${amount}`}
                            />
                          </span>
                        )}
                        <button
                          aria-label={`Details for ${name}, ${amount}`}
                          className="flex size-8 items-center justify-center rounded-[7px] border border-[#e6ebe8] bg-white text-[#4f5d56] hover:bg-[#f8faf9]"
                          onClick={() => onOpen(item)}
                          title="Details"
                          type="button"
                        >
                          <Icon icon={TbArrowsMaximize} size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="font-inter-regular flex flex-wrap items-center justify-between gap-2 border-t border-[#e6ebe8] px-5 py-3 text-xs text-[#68766f]">
        <span>{rows ? `Showing ${rows.length} of ${plural(total, "bill")}` : ""}</span>
        <span>Past due describes timing, not approval status.</span>
      </div>
    </div>
  );
}
