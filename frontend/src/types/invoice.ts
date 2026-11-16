import type { PropertyVendorMapping } from "@/types/propertyvendormapping.ts";

export type Invoice = {
    invoiceId: string,
    vendorSuppliedInvoiceId: string,
    mapping: PropertyVendorMapping,
    billingPeriodStart: string,
    billingPeriodEnd: string,
    invoiceCreationDate: string,
    amount: number,
    dueDate: string,
    invoiceStatus: string,
    failureReason: string,
    blobFileUrl: string,
    blobFileSha256: string,
    createdAt: string,
    updatedAt: string,
}

export type InvoiceStatus =
    | "INGESTED"
    | "PENDING_MAPPING"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "PAID"
    | "FAILED"
    | "PROCESSING_PAYMENT"
    | "VOID";

// Vendor and property fields are null until the invoice is matched to a mapping
export type InvoiceResponse = {
    invoiceUuid: string;
    mappingUuid: string | null;
    vendorUuid: string | null;
    vendorName: string | null;
    vendorAccountNumber: string | null;
    propertyUuid: string | null;
    propertyName: string | null;
    originalFilename: string | null;
    // Who uploaded the file; null for manually entered invoices
    uploadedByUuid: string | null;
    uploadedByName: string | null;
    vendorSuppliedInvoiceId: string | null;
    // What the bill is for, as written on it (e.g. "Monthly water usage and sewer service")
    description: string | null;
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    invoiceCreationDate: string | null;
    amount: number | null;
    dueDate: string | null;
    invoiceStatus: InvoiceStatus;
    failureReason: string | null;
    blobFileUrl: string | null;
    blobFileSha256: string | null;
    createdAt: string;
    updatedAt: string;
};

export type InvoicePageResponse = {
    items: InvoiceResponse[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
};

export type InvoiceSummaryResponse = {
    pendingCount: number;
    pendingPropertyCount: number;
    needsReviewCount: number;
    needsReviewReceivedSince: number;
    awaitingApprovalCount: number;
    awaitingApprovalTotal: number;
    exceptionsCount: number;
};
// PATCH /api/v1/invoices/{invoiceUuid}: only the fields sent are changed
export type InvoiceUpdateRequest = Partial<{
    // An explicit mapping wins; otherwise propertyAddress (plus vendorUuid, or the invoice's
    // current vendor) picks the property. The backend refuses with 422 when it can't match exactly one.
    mappingUuid: string;
    propertyAddress: string;
    // The property's name as printed on the bill; several properties can share one address
    propertyName: string;
    vendorUuid: string;
    invoiceStatus: InvoiceStatus;
    // An empty string clears it
    description: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    invoiceCreationDate: string;
    amount: number;
    dueDate: string;
    failureReason: string;
}>;
