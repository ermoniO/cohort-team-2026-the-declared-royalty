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

// GET /api/v1/invoices/{invoiceUuid}/validation: checks shown to the approver. They only inform
// the decision; nothing is blocked when one fails.
export type InvoiceValidationCheck = {
    id: "PROPERTY" | "ACCOUNT" | "DUPLICATE" | "AMOUNT";
    label: string; // short, lower case, e.g. "active property"
    status: "PASSED" | "FAILED" | "UNKNOWN"; // UNKNOWN: not enough on the bill to run it
    detail: string | null; // why it failed or couldn't run; null when it passed
};

export type InvoiceValidationResponse = {
    invoiceUuid: string;
    passed: boolean;
    passedCount: number;
    totalCount: number;
    checks: InvoiceValidationCheck[];
};

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "NOT_FOUND";

// One value the AI read from the bill. level and reason come from checks against our
// vendors, properties, account numbers and past bills; value is null when it wasn't found.
export type ExtractedField = {
    value: string | null;
    confidence: number; // AI's readability score, 0–1
    level: ConfidenceLevel;
    reason: string | null;
};

export type InvoiceExtractedFields = {
    vendorName: ExtractedField;
    propertyAddress: ExtractedField;
    propertyName: ExtractedField;
    vendorSuppliedInvoiceId: ExtractedField;
    vendorAccountNumber: ExtractedField;
    amount: ExtractedField;
    dueDate: ExtractedField;
    billingPeriodStart: ExtractedField;
    billingPeriodEnd: ExtractedField;
    invoiceCreationDate: ExtractedField;
};

export type InvoiceExtractionResponse = {
    invoiceUuid: string;
    invoiceStatus: InvoiceStatus;
    fields: InvoiceExtractedFields;
    error: string | null;
    suggestedVendorUuid: string | null;
    suggestedPropertyUuid: string | null;
    suggestedMappingUuid: string | null;
};

// Body for POST /api/v1/invoices/{invoiceUuid}/verify
export type InvoiceVerifyRequest = {
    vendorUuid: string;
    propertyUuid: string;
    vendorAccountNumber: string;
    vendorSuppliedInvoiceId?: string;
    amount: number;
    dueDate: string;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    invoiceCreationDate?: string;
    notes?: string; // audit note: what the reviewer changed from the AI's values
    aiValuesChanged?: boolean; // true → logged as USER_IDENTIFIED instead of USER_VALIDATED
    // Who is sending it for approval; the audit entry is recorded under them (System when omitted)
    // TODO(auth): drop once the backend takes the user from the session
    reviewedBy?: string;
};

// Body for POST /api/v1/invoices/{invoiceUuid}/progress: only the fields the reviewer confirmed.
// Vendor, property and account number are saved together or not at all. reviewedBy isn't a field.
export type InvoiceProgressRequest = Partial<Omit<InvoiceVerifyRequest, "notes" | "aiValuesChanged">>;
