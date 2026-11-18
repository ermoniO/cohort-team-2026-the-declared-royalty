import { describe, expect, it } from "vitest";
import type { InvoiceResponse, InvoiceStatus } from "@/types/invoice";
import { summarizePayments } from "./usePaymentSummary";

function makeInvoice(invoiceStatus: InvoiceStatus, amount: number | null): InvoiceResponse {
  return {
    invoiceUuid: "00000000-0000-0000-0000-000000000001",
    mappingUuid: null,
    vendorUuid: null,
    vendorName: null,
    vendorAccountNumber: null,
    propertyUuid: null,
    propertyName: null,
    originalFilename: null,
    uploadedByUuid: null,
    uploadedByName: null,
    vendorSuppliedInvoiceId: null,
    description: null,
    billingPeriodStart: null,
    billingPeriodEnd: null,
    invoiceCreationDate: null,
    amount,
    dueDate: null,
    invoiceStatus,
    failureReason: null,
    blobFileUrl: null,
    blobFileSha256: null,
    createdAt: "2026-11-17T00:00:00Z",
    updatedAt: "2026-11-17T00:00:00Z",
  };
}

describe("summarizePayments", () => {
  it("returns zeroes for an empty list", () => {
    expect(summarizePayments([])).toEqual({
      needsApprovalCount: 0,
      scheduledCount: 0,
      scheduledTotal: 0,
      processingCount: 0,
      processingTotal: 0,
      paidCount: 0,
      paidTotal: 0,
    });
  });

  it("aggregates counts and dollar totals across payment statuses", () => {
    const result = summarizePayments([
      makeInvoice("PENDING_APPROVAL", 100),
      makeInvoice("APPROVED", 250),
      makeInvoice("APPROVED", 50),
      makeInvoice("PROCESSING_PAYMENT", 120.5),
      makeInvoice("PROCESSING_PAYMENT", null),
      makeInvoice("PAID", 400),
      makeInvoice("PAID", 99.5),
      makeInvoice("FAILED", 500),
    ]);

    expect(result).toEqual({
      needsApprovalCount: 1,
      scheduledCount: 2,
      scheduledTotal: 300,
      processingCount: 2,
      processingTotal: 120.5,
      paidCount: 2,
      paidTotal: 499.5,
    });
  });
});

