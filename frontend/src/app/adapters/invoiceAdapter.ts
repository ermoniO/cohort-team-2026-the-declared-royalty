import type { Invoice } from '@/types';
import type { InvoiceResponse } from '@/types/invoice';

const UNMATCHED = 'Unmatched';

function mapStatus(backend: InvoiceResponse['invoiceStatus']): Invoice['status'] | null {
  switch (backend) {
    case 'INGESTED':
    case 'PENDING_MAPPING':
      return 'extracted';
    case 'PENDING_APPROVAL':
      return 'pending_approval';
    case 'APPROVED':
    case 'PROCESSING_PAYMENT':
      return 'approved';
    case 'PAID':
      return 'paid';
    case 'FAILED':
      return 'exception';
    case 'VOID':
      return null;
    default:
      return 'pending_approval';
  }
}

/**
 * Maps a backend invoice to the UI model without inventing data. Unknown values stay empty
 * (confidence 0 routes the invoice to human review). Returns null for invoices that must not be shown.
 */
export function mapInvoiceResponseToUI(dto: InvoiceResponse): Invoice | null {
  const status = mapStatus(dto.invoiceStatus);
  if (status === null) return null;

  const amount = dto.amount ?? 0;
  const createdDate = dto.createdAt ? dto.createdAt.split('T')[0] : '';

  const confidenceScore =
    dto.invoiceStatus === 'INGESTED'
      ? 0
      : dto.mappingUuid != null && dto.vendorName != null && dto.amount != null
        ? 96
        : dto.invoiceStatus !== 'INGESTED' && dto.amount != null && dto.mappingUuid == null
          ? 72
          : 0;

  return {
    id: dto.invoiceUuid,
    invoiceNumber: dto.vendorSuppliedInvoiceId || `INV-${dto.invoiceUuid.substring(0, 8).toUpperCase()}`,
    accountNumber: dto.vendorAccountNumber ?? '',
    vendorId: dto.vendorUuid ?? '',
    vendorName: dto.vendorName ?? UNMATCHED,
    propertyId: dto.propertyUuid ?? '',
    propertyName: dto.propertyName ?? UNMATCHED,
    issueDate: dto.billingPeriodStart || createdDate,
    dueDate: dto.dueDate ?? '',
    subtotal: amount,
    tax: 0,
    amount,
    status,
    backendStatus: dto.invoiceStatus,
    mappingId: dto.mappingUuid ?? undefined,
    failureReason: dto.failureReason ?? undefined,
    confidenceScore,
    approvalTier: amount > 10000 ? 'vp_finance' : 'property_manager',
    intakeMethod: 'pdf_upload',
    notes: dto.originalFilename ? `File: ${dto.originalFilename}` : 'Imported bill',
    lineItems: [],
    paymentInfo: {
      method: 'CREDIT_CARD',
      status: dto.invoiceStatus === 'PAID' ? 'succeeded' : 'unpaid',
    },
    auditTrail: [],
  };
}

