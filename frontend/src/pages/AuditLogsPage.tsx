import { useEffect } from "react";
import { TbArrowLeft, TbDownload } from "react-icons/tb";
import Icon from "@/components/ui/Icon";
import { navigateTo } from "@/app/navigation";
import { useAuditLogStore } from "@/stores";
import AuditInvoiceCard from "@/features/auditLogs/AuditInvoiceCard";
import AuditTimeline from "@/features/auditLogs/AuditTimeline";
import { auditHistoryPath, auditLogsToCsv, isUuid, localDayKey } from "@/features/auditLogs/auditLogDisplay";
import { useAuditHistory } from "@/features/auditLogs/useAuditHistory";

type AuditLogsPageProps = {
  // From ?invoice= in the URL; null shows every bill's history
  invoiceUuid: string | null;
};

function downloadCsv(csv: string, filename: string) {
  // The BOM makes Excel read the file as UTF-8
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage({ invoiceUuid }: AuditLogsPageProps) {
  const fetchHistory = useAuditLogStore((s) => s.fetchHistory);
  const invoice = useAuditLogStore((s) => (invoiceUuid ? s.invoices[invoiceUuid] : undefined));
  const isLoading = useAuditLogStore((s) => s.isLoading);
  const { filtered, actorName } = useAuditHistory();

  const validId = invoiceUuid === null || isUuid(invoiceUuid);

  useEffect(() => {
    if (validId) void fetchHistory(invoiceUuid);
  }, [fetchHistory, invoiceUuid, validId]);

  if (!validId) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-[#e6ebe8] bg-white">
        <p className="font-inter-regular text-sm text-[#68766f]" role="alert">
          This link doesn't point to a bill.
        </p>
        <button className="font-inter-medium text-sm text-[#16834a] hover:underline" onClick={() => navigateTo(auditHistoryPath())} type="button">
          See all activity
        </button>
      </div>
    );
  }

  const exportLog = () => {
    const scope = invoiceUuid ? invoiceUuid.slice(0, 8) : "all-bills";
    downloadCsv(auditLogsToCsv(filtered, actorName), `audit-log-${scope}-${localDayKey(new Date().toISOString())}.csv`);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          {invoiceUuid && (
            <button
              className="font-inter-medium flex items-center gap-1 self-start text-[13px] text-[#16834a] hover:underline"
              onClick={() => navigateTo(auditHistoryPath())}
              type="button"
            >
              <Icon icon={TbArrowLeft} size={14} />
              All activity
            </button>
          )}
          <p className="font-inter-regular text-sm text-[#68766f]">
            {invoiceUuid
              ? "Follow this bill's history, from intake to payment."
              : "Every recorded action across all bills. Pick a bill to see its full history."}
          </p>
        </div>
        <button
          className="font-inter-semibold flex h-9 items-center gap-2 rounded-[7px] bg-[#16834a] px-4 text-sm text-white hover:bg-[#13723f] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading || filtered.length === 0}
          onClick={exportLog}
          title="Downloads the events shown below as a CSV file"
          type="button"
        >
          <Icon icon={TbDownload} size={16} />
          Export log
        </button>
      </div>

      {invoiceUuid && <AuditInvoiceCard invoice={invoice} loading={isLoading} />}

      {/* Keyed so expanded rows reset when you open another bill */}
      <AuditTimeline key={invoiceUuid ?? "all"} showInvoice={!invoiceUuid} />
    </div>
  );
}
