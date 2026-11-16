import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/app/services/apiClient";
import { decisionAuditEntry, NOTE_MAX, rejectionReason, validateDecision } from "@/features/approvals/approvalDecision";
import { AlreadyDecidedError, submitDecision } from "@/features/approvals/approvalService";

const INVOICE = "99999999-9999-9999-9999-999999999999";
const USER = "00000000-0000-0000-0000-000000000001";

describe("validateDecision", () => {
  it("lets an approval through with or without a comment", () => {
    expect(validateDecision({ kind: "approve", comment: "" })).toEqual({});
    expect(validateDecision({ kind: "approve", comment: "x".repeat(NOTE_MAX + 1) }).comment).toBeDefined();
  });

  it("needs a reason to reject, and details only when the reason is Other", () => {
    expect(validateDecision({ kind: "reject", reason: "" as never, details: "" }).reason).toBe("Choose a reason.");
    expect(validateDecision({ kind: "reject", reason: "incorrectBilling", details: "" })).toEqual({});
    expect(validateDecision({ kind: "reject", reason: "other", details: "   " }).details).toBeDefined();
    expect(validateDecision({ kind: "reject", reason: "other", details: "Wrong rate" })).toEqual({});
  });

  it("needs a message to request information", () => {
    expect(validateDecision({ kind: "requestInfo", message: " " }).message).toBeDefined();
    expect(validateDecision({ kind: "requestInfo", message: "Attach the rate schedule" })).toEqual({});
  });
});

describe("decisionAuditEntry", () => {
  it("records an approval with the comment as its note", () => {
    expect(decisionAuditEntry({ kind: "approve", comment: " Looks right " }, INVOICE, USER)).toEqual({
      invoice: INVOICE,
      user: USER,
      actionType: "USER_APPROVED",
      actionTaken: "Approved",
      fromState: "PENDING_APPROVAL",
      toState: "APPROVED",
      notes: "Looks right",
    });
  });

  it("leaves out an empty note", () => {
    expect(decisionAuditEntry({ kind: "approve", comment: "  " }, INVOICE, USER)).not.toHaveProperty("notes");
  });

  it("maps reject to VOID and request info to PENDING_MAPPING, naming the decision", () => {
    const reject = decisionAuditEntry({ kind: "reject", reason: "incorrectBilling", details: "Wrong rate" }, INVOICE, USER);
    expect(reject).toMatchObject({ actionTaken: "Rejected: Incorrect billing", toState: "VOID", notes: "Wrong rate" });
    expect(rejectionReason(reject.actionTaken)).toBe("Incorrect billing");

    const info = decisionAuditEntry({ kind: "requestInfo", message: "Attach the schedule" }, INVOICE, USER);
    expect(info).toMatchObject({ actionTaken: "Information requested", toState: "PENDING_MAPPING", notes: "Attach the schedule" });
  });

  it("stays within the backend's 225-character actionTaken limit", () => {
    for (const reason of ["propertyInvalid", "incorrectBilling", "other"] as const) {
      expect(decisionAuditEntry({ kind: "reject", reason, details: "" }, INVOICE, USER).actionTaken.length).toBeLessThanOrEqual(225);
    }
  });
});

describe("submitDecision", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const respond = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  const invoice = (invoiceStatus: string) => ({ invoiceUuid: INVOICE, invoiceStatus });

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("checks the status, updates the invoice, then records the decision", async () => {
    respond(200, invoice("PENDING_APPROVAL"));
    respond(200, invoice("APPROVED"));
    respond(201, { auditLogId: "a" });

    await expect(submitDecision(INVOICE, { kind: "approve", comment: "" }, USER)).resolves.toMatchObject({ logged: true });

    const calls = fetchMock.mock.calls.map(([url, init]) => [init?.method ?? "GET", String(url).replace(API_BASE_URL, "")]);
    expect(calls).toEqual([
      ["GET", `/api/v1/invoices/${INVOICE}`],
      ["PATCH", `/api/v1/invoices/${INVOICE}`],
      ["POST", "/api/v1/audit-logs"],
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ invoiceStatus: "APPROVED" });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ user: USER, toState: "APPROVED" });
  });

  it("refuses a bill someone else already decided, without changing anything", async () => {
    respond(200, invoice("APPROVED"));
    await expect(submitDecision(INVOICE, { kind: "approve", comment: "" }, USER)).rejects.toBeInstanceOf(AlreadyDecidedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't record anything when the status change fails", async () => {
    respond(200, invoice("PENDING_APPROVAL"));
    respond(500, { message: "boom" });
    await expect(submitDecision(INVOICE, { kind: "requestInfo", message: "?" }, USER)).rejects.toThrow("500");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports when the decision was saved but the audit entry wasn't", async () => {
    respond(200, invoice("PENDING_APPROVAL"));
    respond(200, invoice("VOID"));
    respond(500, { message: "audit down" });
    await expect(submitDecision(INVOICE, { kind: "reject", reason: "other", details: "x" }, USER)).resolves.toMatchObject({
      logged: false,
    });
  });
});
