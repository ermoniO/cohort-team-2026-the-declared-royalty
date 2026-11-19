import type { InvoiceStatus } from "@/types/invoice";

export type PaymentStatus = "NEEDS_APPROVAL" | "SCHEDULED" | "PROCESSING" | "PAID" | "EXCEPTION";

export type PaymentSource = "MANUAL" | "AUTO_PAY";

export type PaymentResponse = {
  paymentId: string;
  paymentAttemptId: string | null;
  invoiceUuid: string;
  vendorName: string | null;
  propertyName: string | null;
  vendorSuppliedInvoiceId: string | null;
  originalFilename: string | null;
  amount: number | null;
  currency: string | null;
  dueDate: string | null;
  paymentStatus: PaymentStatus;
  invoiceStatus: InvoiceStatus;
  providerStatus: string | null;
  failureReason: string | null;
  retryable: boolean;
  paymentSource: PaymentSource | null;
  payNowAvailable: boolean;
  paymentDate: string | null;
  blobFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentPageResponse = {
  items: PaymentResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type PaymentSummaryResponse = {
  needsApprovalCount: number;
  scheduledCount: number;
  nextScheduledDate: string | null;
  processingCount: number;
  processingTotal: number;
  paidCount: number;
  paidTotal: number;
  exceptionCount: number;
};

export type AutoPaySettings = {
  enabled: boolean;
};
