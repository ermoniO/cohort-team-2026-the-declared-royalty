import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  DEFAULT_VIEW,
  actionTypeLabel,
  auditHistoryPath,
  auditLogsToCsv,
  describeActionType,
  filterAuditLogs,
  groupByDay,
  isUuid,
  localDayKey,
} from "@/features/auditLogs/auditLogDisplay";
import type { AuditLogsResponse } from "@/types/auditlogs";

const INVOICE_ID = "7b8a9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d";
const EMMA = "6aabd049-1200-4b71-b72f-1e24907045d7";
const SYSTEM = "00000000-0000-0000-0000-000000000001";

function log(overrides: Partial<AuditLogsResponse>): AuditLogsResponse {
  return {
    auditLogId: crypto.randomUUID(),
    invoice: INVOICE_ID,
    user: SYSTEM,
    actionType: "SYSTEM_INGESTED",
    actionTaken: "File uploaded and stored",
    fromState: "NONE",
    toState: "INGESTED",
    notes: null,
    createdAt: "2026-10-24T14:02:00Z",
    updatedAt: "2026-10-24T14:02:00Z",
    ...overrides,
  };
}

const names: Record<string, string> = { [EMMA]: "Emma Wilson", [SYSTEM]: "System" };
const actorName = (id: string) => names[id] ?? id;

const received = log({ createdAt: "2026-10-24T14:02:00Z" });
const approved = log({
  user: EMMA,
  actionType: "USER_APPROVED",
  actionTaken: "Finance approved",
  fromState: "PENDING_APPROVAL",
  toState: "APPROVED",
  notes: "Within the utility budget",
  createdAt: "2026-10-24T16:40:00Z",
});
const paid = log({ actionType: "SYSTEM_PAID", actionTaken: "Payment scheduled", createdAt: "2026-10-26T15:00:00Z" });
const logs = [paid, received, approved];

describe("describeActionType", () => {
  it("splits who acted from the pipeline stage", () => {
    expect(describeActionType("USER_APPROVED")).toEqual({ stage: "Approval", byUser: true });
    expect(describeActionType("SYSTEM_INGESTED")).toEqual({ stage: "Intake", byUser: false });
    expect(actionTypeLabel("SYSTEM_PAID")).toBe("Payment (system)");
  });

  it("still shows something readable for a type the frontend doesn't know", () => {
    expect(describeActionType("SYSTEM_VOIDED")).toEqual({ stage: "Voided", byUser: false });
  });

  it("lists every backend action type", () => {
    expect(ACTION_TYPES).toHaveLength(12);
  });
});

describe("filterAuditLogs", () => {
  it("sorts oldest first by default, and newest first when asked", () => {
    expect(filterAuditLogs(logs, DEFAULT_VIEW, actorName)).toEqual([received, approved, paid]);
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, sort: "newest" }, actorName)).toEqual([paid, approved, received]);
  });

  it("searches action, notes, states and the actor's name, ignoring case", () => {
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, query: "BUDGET" }, actorName)).toEqual([approved]);
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, query: "emma" }, actorName)).toEqual([approved]);
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, query: "pending_approval" }, actorName)).toEqual([approved]);
  });

  it("filters by action type, actor and day", () => {
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, actionType: "SYSTEM_PAID" }, actorName)).toEqual([paid]);
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, actorUuid: SYSTEM }, actorName)).toEqual([received, paid]);
    const day = localDayKey(paid.createdAt);
    expect(filterAuditLogs(logs, { ...DEFAULT_VIEW, day }, actorName)).toEqual([paid]);
  });

  it("doesn't reorder the list it was given", () => {
    filterAuditLogs(logs, DEFAULT_VIEW, actorName);
    expect(logs).toEqual([paid, received, approved]);
  });
});

describe("groupByDay", () => {
  it("starts a new group when the day changes, keeping the order", () => {
    const sorted = filterAuditLogs(logs, DEFAULT_VIEW, actorName);
    const groups = groupByDay(sorted);
    expect(groups.map((g) => g.events)).toEqual([[received, approved], [paid]]);
    expect(groups[0].day).toBe(localDayKey(received.createdAt));
  });
});

describe("auditLogsToCsv", () => {
  it("writes a header and one quoted row per log", () => {
    const [header, row] = auditLogsToCsv([approved], actorName).split("\r\n");
    expect(header.split(",")).toContain("audit_uuid");
    expect(row).toContain('"Emma Wilson"');
    expect(row).toContain('"Within the utility budget"');
  });

  it("escapes quotes and stops spreadsheets running cells as formulas", () => {
    const risky = log({ notes: '=HYPERLINK("x")', actionTaken: 'Said "hi"' });
    const row = auditLogsToCsv([risky], actorName).split("\r\n")[1];
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('"Said ""hi"""');
  });
});

describe("auditHistoryPath and isUuid", () => {
  it("builds the page URL for one bill or all bills", () => {
    expect(auditHistoryPath(INVOICE_ID)).toBe(`/activity?invoice=${INVOICE_ID}`);
    expect(auditHistoryPath()).toBe("/activity");
  });

  it("only accepts UUIDs", () => {
    expect(isUuid(INVOICE_ID)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});