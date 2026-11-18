import { describe, expect, it } from "vitest";
import {
  type ApprovalItem,
  applyView,
  buildQueue,
  DEFAULT_QUEUE_VIEW,
  dueDetail,
  isPastDue,
  sentForApprovalEntry,
  summarize,
} from "@/features/approvals/approvalQueue";
import type { AuditLogsResponse } from "@/types/auditlogs";
import type { InvoiceResponse } from "@/types/invoice";

// A fixed "today": Nov 10, 2026, mid-afternoon local time
const TODAY = new Date(2026, 10, 10, 15, 30);

let seq = 0;
const invoice = (overrides: Partial<InvoiceResponse> = {}): InvoiceResponse => ({
  invoiceUuid: `00000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`,
  mappingUuid: "m",
  vendorUuid: "v",
  vendorName: "Gasco",
  vendorAccountNumber: "GC-1",
  propertyUuid: "p",
  propertyName: "Oak Street Lofts",
  originalFilename: "gasco.pdf",
  uploadedByUuid: null,
  uploadedByName: null,
  vendorSuppliedInvoiceId: "GAS-1",
  description: "Natural gas service",
  billingPeriodStart: null,
  billingPeriodEnd: null,
  invoiceCreationDate: null,
  amount: 230,
  dueDate: "2026-11-12",
  invoiceStatus: "PENDING_APPROVAL",
  failureReason: null,
  blobFileUrl: "key.pdf",
  blobFileSha256: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  ...overrides,
});

const decision = (inv: InvoiceResponse, toState: string, createdAt = "2026-11-09T12:00:00Z", actionTaken = "Approved"): AuditLogsResponse => ({
  auditLogId: `a-${++seq}`,
  invoice: inv.invoiceUuid,
  user: "u",
  actionType: "USER_APPROVED",
  actionTaken,
  fromState: "PENDING_APPROVAL",
  toState,
  notes: null,
  createdAt,
  updatedAt: createdAt,
});

const item = (overrides: Partial<InvoiceResponse> = {}, status: ApprovalItem["status"] = "awaiting"): ApprovalItem => ({
  invoice: invoice(overrides),
  status,
  decision: null,
});

describe("buildQueue", () => {
  it("includes everything awaiting approval, decided or not", () => {
    const fresh = invoice();
    const resubmitted = invoice();
    const queue = buildQueue([fresh, resubmitted], [decision(resubmitted, "PENDING_MAPPING")]);
    expect(queue.map((q) => q.status)).toEqual(["awaiting", "awaiting"]);
    expect(queue[1].decision?.toState).toBe("PENDING_MAPPING");
  });

  it("maps decided invoices onto approval statuses using their decision", () => {
    const approved = invoice({ invoiceStatus: "APPROVED" });
    const rejected = invoice({ invoiceStatus: "VOID" });
    const info = invoice({ invoiceStatus: "PENDING_MAPPING" });
    const paid = invoice({ invoiceStatus: "PAID" });
    const queue = buildQueue(
      [approved, rejected, info, paid],
      [decision(approved, "APPROVED"), decision(rejected, "VOID"), decision(info, "PENDING_MAPPING"), decision(paid, "APPROVED")],
    );
    expect(queue.map((q) => q.status)).toEqual(["approved", "rejected", "infoRequested", "paid"]);
  });

  it("leaves out bills that never went through the queue (e.g. a fresh upload awaiting review)", () => {
    const unmatched = invoice({ invoiceStatus: "PENDING_MAPPING" });
    const voided = invoice({ invoiceStatus: "VOID" });
    expect(buildQueue([unmatched, voided], [])).toEqual([]);
  });

  it("ignores entries that aren't decisions, like a rejected duplicate upload", () => {
    const inv = invoice();
    const duplicate = { ...decision(inv, "PENDING_APPROVAL", "2026-11-09T12:00:00Z", "Duplicate upload rejected"), actionType: "SYSTEM_INGESTED" as const };
    const sameState = decision(inv, "PENDING_APPROVAL");
    expect(buildQueue([inv], [duplicate, sameState])[0].decision).toBeNull();
    expect(buildQueue([invoice({ invoiceStatus: "VOID" })], [{ ...duplicate, toState: "VOID" }])).toEqual([]);
  });

  it("uses the latest decision and skips duplicate invoices", () => {
    const inv = invoice({ invoiceStatus: "VOID" });
    const older = decision(inv, "PENDING_MAPPING", "2026-11-01T00:00:00Z", "Information requested");
    const newer = decision(inv, "VOID", "2026-11-05T00:00:00Z", "Rejected: Other");
    const queue = buildQueue([inv, inv], [newer, older]);
    expect(queue).toHaveLength(1);
    expect(queue[0].decision?.actionTaken).toBe("Rejected: Other");
  });
});

describe("due dates", () => {
  it("describes how far away the due date is, in local calendar days", () => {
    expect(dueDetail(item({ dueDate: "2026-11-12" }), TODAY)).toEqual({ text: "In 2 days", pastDue: false });
    expect(dueDetail(item({ dueDate: "2026-11-11" }), TODAY)?.text).toBe("Due tomorrow");
    expect(dueDetail(item({ dueDate: "2026-11-10" }), TODAY)?.text).toBe("Due today");
    expect(dueDetail(item({ dueDate: "2026-11-08" }), TODAY)).toEqual({ text: "Past due · 2 days", pastDue: true });
    expect(dueDetail(item({ dueDate: "2026-11-09" }), TODAY)?.text).toBe("Past due · 1 day");
  });

  it("handles missing due dates and settled bills", () => {
    expect(dueDetail(item({ dueDate: null }), TODAY)).toBeNull();
    expect(dueDetail(item({ dueDate: "2026-11-01" }, "paid"), TODAY)).toEqual({ text: "Settled", pastDue: false });
    expect(dueDetail(item({ dueDate: "2026-11-01" }, "rejected"), TODAY)).toBeNull();
  });

  it("counts any unpaid status as past due, but never rejected or paid bills", () => {
    const late = { dueDate: "2026-11-01" };
    expect(isPastDue(item(late, "awaiting"), TODAY)).toBe(true);
    expect(isPastDue(item(late, "approved"), TODAY)).toBe(true);
    expect(isPastDue(item(late, "infoRequested"), TODAY)).toBe(true);
    expect(isPastDue(item(late, "rejected"), TODAY)).toBe(false);
    expect(isPastDue(item(late, "paid"), TODAY)).toBe(false);
    expect(isPastDue(item({ dueDate: "2026-11-10" }), TODAY)).toBe(false);
  });
});

describe("applyView", () => {
  const metro = item({ vendorName: "Metro Energy", propertyName: "Riverside Court", amount: 640, dueDate: "2026-11-08" });
  const gasco = item({ vendorName: "Gasco", propertyName: "Oak Street Lofts", amount: 230, dueDate: "2026-11-12" });
  const aqua = item({ vendorName: "Aqua Services", propertyName: "Maple Residences", amount: 380, dueDate: "2026-11-16" }, "approved");
  const noDate = item({ vendorName: "City Waste", amount: null, dueDate: null });
  const all = [gasco, aqua, noDate, metro];
  const names = (items: ApprovalItem[]) => items.map((i) => i.invoice.vendorName);

  it("sorts by due date, earliest first, with missing dates last", () => {
    expect(names(applyView(all, DEFAULT_QUEUE_VIEW, TODAY))).toEqual(["Metro Energy", "Gasco", "Aqua Services", "City Waste"]);
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, sort: "dueDesc" }, TODAY))).toEqual([
      "Aqua Services",
      "Gasco",
      "Metro Energy",
      "City Waste",
    ]);
  });

  it("sorts by amount, highest first, with missing amounts last", () => {
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, sort: "amountDesc" }, TODAY))).toEqual([
      "Metro Energy",
      "Aqua Services",
      "Gasco",
      "City Waste",
    ]);
  });

  it("filters by status, including past due", () => {
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, status: "approved" }, TODAY))).toEqual(["Aqua Services"]);
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, status: "pastDue" }, TODAY))).toEqual(["Metro Energy"]);
  });

  it("filters by due window without including past-due bills", () => {
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, due: "week" }, TODAY))).toEqual(["Gasco", "Aqua Services"]);
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, due: "day" }, TODAY))).toEqual([]);
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, due: "pastDue" }, TODAY))).toEqual(["Metro Energy"]);
  });

  it("searches vendor, property and invoice number, ignoring case", () => {
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, search: "  RIVERSIDE " }, TODAY))).toEqual(["Metro Energy"]);
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, search: "gas-1" }, TODAY))).toHaveLength(4);
    expect(names(applyView(all, { ...DEFAULT_QUEUE_VIEW, search: "nothing" }, TODAY))).toEqual([]);
    const pest = item({ vendorName: "Cedar Valley", description: "Quarterly pest prevention and inspection" });
    expect(names(applyView([...all, pest], { ...DEFAULT_QUEUE_VIEW, search: "PEST" }, TODAY))).toEqual(["Cedar Valley"]);
  });
});

describe("summarize", () => {
  it("counts and totals what's awaiting, past due and waiting on information", () => {
    const summary = summarize(
      [
        item({ amount: 640, dueDate: "2026-11-08" }),
        item({ amount: 230 }),
        item({ amount: null }),
        item({ dueDate: "2026-11-01" }, "infoRequested"),
        item({ dueDate: "2026-11-01" }, "paid"),
      ],
      TODAY,
    );
    expect(summary).toEqual({ awaitingCount: 3, awaitingTotal: 870, pastDueCount: 2, infoRequestedCount: 1 });
  });
});

describe("sentForApprovalEntry", () => {
  const entry = (overrides: Partial<AuditLogsResponse>): AuditLogsResponse => ({
    auditLogId: `a-${++seq}`,
    invoice: "i",
    user: "reviewer",
    actionType: "USER_VALIDATED",
    actionTaken: "Reviewer confirmed invoice details",
    fromState: "PENDING_MAPPING",
    toState: "PENDING_APPROVAL",
    notes: null,
    createdAt: "2026-11-05T12:00:00Z",
    updatedAt: "2026-11-05T12:00:00Z",
    ...overrides,
  });

  it("finds the review that sent the bill for approval", () => {
    const review = entry({});
    const upload = entry({ actionType: "USER_INGESTED", fromState: "NONE", toState: "INGESTED", user: "uploader" });
    expect(sentForApprovalEntry([upload, review])).toBe(review);
  });

  it("counts a review where the AI's values were corrected", () => {
    const corrected = entry({ actionType: "USER_IDENTIFIED" });
    expect(sentForApprovalEntry([corrected])).toBe(corrected);
  });

  it("uses the latest one when a bill was sent back and sent again", () => {
    const first = entry({ user: "first", createdAt: "2026-11-01T12:00:00Z" });
    const again = entry({ user: "second", createdAt: "2026-11-08T12:00:00Z" });
    expect(sentForApprovalEntry([again, first])?.user).toBe("second");
  });

  it("ignores saved progress, decisions and other entries that don't send it for approval", () => {
    const progress = entry({ actionType: "USER_IDENTIFIED", toState: "PENDING_MAPPING" });
    const decided = entry({ actionType: "USER_APPROVED", fromState: "PENDING_APPROVAL", toState: "APPROVED" });
    const sameState = entry({ fromState: "PENDING_APPROVAL" });
    const matched = entry({ actionType: "SYSTEM_MATCHED", fromState: "INGESTED" });
    expect(sentForApprovalEntry([progress, decided, sameState, matched])).toBeNull();
  });
});
