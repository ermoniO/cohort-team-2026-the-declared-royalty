import { TbArrowRight, TbHistory } from "react-icons/tb";
import { navigateTo } from "@/app/navigation";
import { formatReceived } from "@/features/invoices/invoiceFormat";
import type { AuditLogsResponse } from "@/types/auditlogs";

type RecentActivityCardProps = {
  logs: AuditLogsResponse[];
  isLoading: boolean;
  error: string | null;
  actorName: (userUuid: string) => string;
  invoiceLabel: (invoiceUuid: string) => string;
};

export default function RecentActivityCard({
  logs,
  isLoading,
  error,
  actorName,
  invoiceLabel,
}: RecentActivityCardProps) {
  const recentLogs = logs.slice(0, 5);

  return (
    <div className="flex flex-col rounded-xl border border-[#e6ebe8] bg-white">
      <div className="flex items-center justify-between border-b border-[#e6ebe8] px-5 py-4">
        <div>
          <h2 className="font-inter-semibold text-base text-[#14532d]">Recent activity</h2>
          <p className="font-inter-regular mt-0.5 text-xs text-[#68766f]">
            Latest recorded actions across all bills
          </p>
        </div>
        <button
          className="font-inter-medium flex items-center gap-1 text-xs text-[#16834a] hover:underline"
          onClick={() => navigateTo("/activity")}
          type="button"
        >
          All activity
          <TbArrowRight size={14} />
        </button>
      </div>

      {error && (
        <p className="font-inter-regular px-5 py-6 text-sm text-[#b4322c]" role="alert">
          {`Couldn't load recent activity. ${error}`}
        </p>
      )}

      {isLoading && recentLogs.length === 0 && !error && (
        <p className="font-inter-regular px-5 py-8 text-center text-sm text-[#68766f]">
          Loading recent activity…
        </p>
      )}

      {!isLoading && !error && recentLogs.length === 0 && (
        <p className="font-inter-regular px-5 py-8 text-center text-sm text-[#68766f]">
          No recent activity yet.
        </p>
      )}

      {recentLogs.length > 0 && (
        <ul className="divide-y divide-[#e6ebe8]">
          {recentLogs.map((log) => (
            <li className="flex items-start gap-3 px-5 py-3.5" key={log.auditLogId}>
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f8faf9] text-[#16834a]">
                <TbHistory size={15} />
              </span>
              <div className="min-w-0">
                <p className="font-inter-medium truncate text-sm text-[#25362f]">{log.actionTaken}</p>
                <p className="font-inter-regular truncate text-xs text-[#68766f]">
                  {`${actorName(log.user)} · ${invoiceLabel(log.invoice)} · ${formatReceived(log.createdAt)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

