import type { Invoice, PropertyVendorRelationship } from '@/types';

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// 8420.16 -> "$8,420.16"
export function formatCurrency(amount: number): string {
  return currency.format(amount);
}

// ISO timestamp -> "Nov 9, 2026" in the viewer's time zone
export function formatReceived(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_GL_OPTIONS = [
  { glCode: '5100', glAccountName: 'Janitorial & Cleaning' },
  { glCode: '5200', glAccountName: 'HVAC / Maintenance' },
  { glCode: '5300', glAccountName: 'Utilities' },
  { glCode: '5400', glAccountName: 'Security & Access Control' },
  { glCode: '5500', glAccountName: 'Landscaping & Grounds' },
] as const;

export function getInvoiceCostType(
  invoice: Invoice,
  mappings: PropertyVendorRelationship[]
): 'FIXED_MONTHLY' | 'VARIABLE' {
  const mapping =
    mappings.find((m) => invoice.mappingId && m.id === invoice.mappingId) ||
    mappings.find(
      (m) => m.propertyId === invoice.propertyId && m.vendorId === invoice.vendorId
    );
  return mapping?.costType === 'FIXED_MONTHLY' ? 'FIXED_MONTHLY' : 'VARIABLE';
}

export function isInvoiceReadyForDisbursement(inv: Invoice): boolean {
  if (inv.status === 'paid' || inv.backendStatus === 'PAID') return false;
  if (inv.paymentInfo?.status === 'succeeded') return false;
  return inv.backendStatus === 'APPROVED' || inv.status === 'approved';
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : pluralForm}`;
}

