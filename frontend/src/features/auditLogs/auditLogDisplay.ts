import type { AuditActionType, AuditLogsResponse } from "@/types/auditlogs";

const STAGES = ["INGESTED", "IDENTIFIED", "MATCHED", "VALIDATED", "APPROVED", "PAID"] as const;

const STAGE_LABELS: Record<string, string> = {
  INGESTED: "Intake",
  IDENTIFIED: "Identification",
  MATCHED: "Matching",
  VALIDATED: "Validation",
  APPROVED: "Approval",
  PAID: "Payment",
};

export const ACTION_TYPES: AuditActionType[] = STAGES.flatMap(
  (stage) => [`SYSTEM_${stage}`, `USER_${stage}`] as AuditActionType[],
);

// The page URL for one bill's history, or for every bill's when no id is given
export function auditHistoryPath(invoiceUuid?: string): string {
  return invoiceUuid ? `/activity?invoice=${encodeURIComponent(invoiceUuid)}` : "/activity";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function describeActionType(actionType: string): { stage: string; byUser: boolean } {
  const [actor, ...rest] = actionType.split("_");
  const stage = rest.join("_");
  return { stage: STAGE_LABELS[stage] ?? titleCase(stage || actionType), byUser: actor === "USER" };
}

export function actionTypeLabel(actionType: string): string {
  const { stage, byUser } = describeActionType(actionType);
  return `${stage} (${byUser ? "user" : "system"})`;
}

export function titleCase(value: string): string {
  const words = value.trim().replace(/[_\s]+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type AuditSort = "oldest" | "newest";

export type AuditLogView = {
  sort: AuditSort;
  query: string;
  actionType: AuditActionType | "";
  actorUuid: string;
  day: string;
};

export const DEFAULT_VIEW: AuditLogView = { sort: "oldest", query: "", actionType: "", actorUuid: "", day: "" };

export function filterAuditLogs(
  logs: AuditLogsResponse[],
  view: AuditLogView,
  actorName: (userUuid: string) => string,
): AuditLogsResponse[] {
  const query = view.query.trim().toLowerCase();

  const matches = logs.filter((log) => {
    if (view.actionType && log.actionType !== view.actionType) return false;
    if (view.actorUuid && log.user !== view.actorUuid) return false;
    if (view.day && localDayKey(log.createdAt) !== view.day) return false;
    if (!query) return true;
    return [
      log.actionTaken,
      log.notes ?? "",
      log.fromState,
      log.toState,
      log.actionType,
      actionTypeLabel(log.actionType),
      actorName(log.user),
    ].some((field) => field.toLowerCase().includes(query));
  });

  const direction = view.sort === "oldest" ? 1 : -1;
  return matches.sort((a, b) => direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
}

export function localDayKey(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupByDay(logs: AuditLogsResponse[]): { day: string; events: AuditLogsResponse[] }[] {
  const groups: { day: string; events: AuditLogsResponse[] }[] = [];
  for (const log of logs) {
    const day = localDayKey(log.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(log);
    else groups.push({ day, events: [log] });
  }
  return groups;
}

export function formatDayHeading(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) return "Unknown date";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function formatOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function formatFullTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return `${localDayKey(isoTimestamp)} ${time} ${formatOffset(date)}`;
}


export function timeZoneLabel(date: Date): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const short = date
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop();
  return `${zone} · ${short} (UTC${formatOffset(date)})`;
}

// Quotes a CSV cell. Cells starting with = + - @ get a leading apostrophe so a
// spreadsheet shows them as text instead of running them as formulas; notes can
// come from users or the AI, so they aren't trusted.
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const CSV_COLUMNS = [
  "created_at",
  "audit_uuid",
  "invoice_uuid",
  "user_uuid",
  "actor",
  "action_type",
  "action_taken",
  "from_state",
  "to_state",
  "notes",
  "updated_at",
];

export function auditLogsToCsv(logs: AuditLogsResponse[], actorName: (userUuid: string) => string): string {
  const rows = logs.map((log) =>
    [
      log.createdAt,
      log.auditLogId,
      log.invoice,
      log.user,
      actorName(log.user),
      log.actionType,
      log.actionTaken,
      log.fromState,
      log.toState,
      log.notes ?? "",
      log.updatedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}