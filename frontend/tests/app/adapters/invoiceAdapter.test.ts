import { describe, expect, it } from "vitest";
import { mapInvoiceResponseToUI } from "@/app/adapters/invoiceAdapter";
import type { InvoiceResponse } from "@/types/invoice";

function makeDto(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    invoiceUuid: "7b8a9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
    mappingUuid: null,
    vendorUuid: null,
    vendorName: null,
    vendorAccountNumber: null,
    propertyUuid: null,
    propertyName: null,
    originalFilename: "bill.pdf",
    vendorSuppliedInvoiceId: null,
    billingPeriodStart: null,
    billingPeriodEnd: null,
    invoiceCreationDate: null,
    amount: 1250.5,
    dueDate: null,
    invoiceStatus: "INGESTED",
    failureReason: null,
    blobFileUrl: null,
    blobFileSha256: null,
    createdAt: "2026-11-13T07:00:00Z",
    ...overrides,
  } as InvoiceResponse;
}

describe("mapInvoiceResponseToUI status", () => {
  it.each([
    ["INGESTED", "extracted"],
    ["PENDING_MAPPING", "extracted"],
    ["PENDING_APPROVAL", "pending_approval"],
    ["APPROVED", "approved"],
    ["PROCESSING_PAYMENT", "approved"],
    ["PAID", "paid"],
    ["FAILED", "exception"],
  ] as const)("maps %s to %s", (backend, ui) => {
    expect(mapInvoiceResponseToUI(makeDto({ invoiceStatus: backend }))?.status).toBe(ui);
  });

  it("marks a paid invoice's payment as succeeded", () => {
    const invoice = mapInvoiceResponseToUI(makeDto({ invoiceStatus: "PAID" }));
    expect(invoice?.paymentInfo?.status).toBe("succeeded");
  });

  it("returns null for a VOID invoice", () => {
    expect(mapInvoiceResponseToUI(makeDto({ invoiceStatus: "VOID" }))).toBeNull();
  });
});

describe("mapInvoiceResponseToUI unknown values", () => {
  it("shows Unmatched with empty ids when vendor and property are null", () => {
    const invoice = mapInvoiceResponseToUI(makeDto())!;
    expect(invoice.vendorName).toBe("Unmatched");
    expect(invoice.propertyName).toBe("Unmatched");
    expect(invoice.vendorId).toBe("");
    expect(invoice.propertyId).toBe("");
  });

  it("passes vendor and property through when present", () => {
    const invoice = mapInvoiceResponseToUI(
      makeDto({ vendorUuid: "v-1", vendorName: "Pacific Power", propertyUuid: "p-1", propertyName: "Harborfront Plaza" }),
    )!;
    expect(invoice.vendorId).toBe("v-1");
    expect(invoice.vendorName).toBe("Pacific Power");
    expect(invoice.propertyId).toBe("p-1");
    expect(invoice.propertyName).toBe("Harborfront Plaza");
  });

  it("does not invent account number or due date", () => {
    const invoice = mapInvoiceResponseToUI(makeDto())!;
    expect(invoice.accountNumber).toBe("");
    expect(invoice.dueDate).toBe("");
  });

  it("does not invent line items, audit trail or confidence", () => {
    const invoice = mapInvoiceResponseToUI(makeDto())!;
    expect(invoice.lineItems).toEqual([]);
    expect(invoice.auditTrail).toEqual([]);
    expect(invoice.confidenceScore).toBe(0);
  });

  it("treats a null amount as zero", () => {
    const invoice = mapInvoiceResponseToUI(makeDto({ amount: null }))!;
    expect(invoice.amount).toBe(0);
    expect(invoice.subtotal).toBe(0);
  });
});

