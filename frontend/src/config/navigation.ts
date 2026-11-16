import type { ElementType } from 'react';
import {
  BellRing,
  Building2,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { resolveBackendStatus } from '@/components/InvoiceStateStepper';
import type { Invoice, NavTab } from '@/types';

export interface NavItemConfig {
  id: NavTab;
  label: string;
  subtitle: string;
  icon: ElementType;
  badgeKey?: 'actionRequiredCount' | 'disbursementsCount';
}

export interface NavSectionConfig {
  title: 'OPERATIONS' | 'ADMIN & SETUP';
  items: NavItemConfig[];
}

export const NAVIGATION_SECTIONS: NavSectionConfig[] = [
  {
    title: 'OPERATIONS',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        subtitle:
          'Real-time multi-property invoice pipeline, AI extraction metrics, and live activity stream',
        icon: LayoutDashboard,
      },
      {
        id: 'invoices',
        label: 'Invoices',
        subtitle:
          'Unified portfolio invoice ledger from ingestion and OCR extraction through settlement',
        icon: FileText,
      },
      {
        id: 'action_required',
        label: 'Action Required',
        subtitle:
          'Single human-in-the-loop task queue for ambiguity matching, policy approvals, duplicate verification, and exception recovery',
        icon: BellRing,
        badgeKey: 'actionRequiredCount',
      },
      {
        id: 'disbursements',
        label: 'Disbursements',
        subtitle:
          'Approved invoices ready for settlement and historical disbursement ledger',
        icon: CreditCard,
        badgeKey: 'disbursementsCount',
      },
    ],
  },
  {
    title: 'ADMIN & SETUP',
    items: [
      {
        id: 'master_data',
        label: 'Properties & Vendors',
        subtitle:
          'Centralized master data directory for managed properties, vendor payees, and GL account mappings',
        icon: Building2,
      },
      {
        id: 'policies',
        label: 'Approval Policies',
        subtitle:
          'Sequential 0–5 escalation matrix, RBAC operational seats, and live invoice routing simulator',
        icon: ShieldCheck,
      },
      {
        id: 'audit_ledger',
        label: 'Audit Ledger',
        subtitle:
          'End-to-end immutable compliance ledger across all portfolio properties, invoices, and actors',
        icon: History,
      },
    ],
  },
];

export function isNeedsMatchingInvoice(inv: Invoice): boolean {
  const status = resolveBackendStatus(inv);
  if (status === 'PENDING_MAPPING') return true;
  if (!inv.backendStatus && inv.status === 'extracted') return true;
  if (
    !inv.backendStatus &&
    !inv.mappingId &&
    inv.confidenceScore < 90 &&
    status === 'INGESTED'
  ) {
    return true;
  }
  return false;
}

export function isPendingApprovalInvoice(inv: Invoice): boolean {
  return resolveBackendStatus(inv) === 'PENDING_APPROVAL';
}

export function isExceptionOrDuplicateInvoice(inv: Invoice): boolean {
  const isFailed = resolveBackendStatus(inv) === 'FAILED';
  const hasActiveDuplicate = Boolean(
    inv.duplicateMatch?.isDuplicate && !inv.duplicateMatch?.dismissed,
  );
  return isFailed || hasActiveDuplicate;
}

export interface ActionRequiredBreakdown {
  totalUnique: number;
  needsMatching: Invoice[];
  pendingApproval: Invoice[];
  exceptionsAndDuplicates: Invoice[];
  allTasks: Invoice[];
}

export function computeActionRequiredBreakdown(
  invoices: Invoice[],
): ActionRequiredBreakdown {
  const needsMatching = invoices.filter(isNeedsMatchingInvoice);
  const pendingApproval = invoices.filter(isPendingApprovalInvoice);
  const exceptionsAndDuplicates = invoices.filter(isExceptionOrDuplicateInvoice);

  const uniqueMap = new Map<string, Invoice>();
  for (const inv of [
    ...needsMatching,
    ...pendingApproval,
    ...exceptionsAndDuplicates,
  ]) {
    if (!uniqueMap.has(inv.id)) {
      uniqueMap.set(inv.id, inv);
    }
  }

  const allTasks = Array.from(uniqueMap.values());
  return {
    totalUnique: allTasks.length,
    needsMatching,
    pendingApproval,
    exceptionsAndDuplicates,
    allTasks,
  };
}

export function computeActionRequiredCount(invoices: Invoice[]): number {
  return computeActionRequiredBreakdown(invoices).totalUnique;
}

export function computeDisbursementsCount(invoices: Invoice[]): number {
  return invoices.filter((inv) => {
    const backend = resolveBackendStatus(inv);
    return (
      backend === 'APPROVED' ||
      (inv.status === 'approved' && inv.paymentInfo?.status !== 'succeeded')
    );
  }).length;
}

export type InvoiceListFilter =
  | 'all'
  | 'INGESTED'
  | 'PENDING_MAPPING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'FAILED';

export function filterInvoicesForList(
  invoices: Invoice[],
  statusFilter: InvoiceListFilter,
  propertyFilter: string,
  searchQuery: string,
): Invoice[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return invoices.filter((inv) => {
    if (propertyFilter && propertyFilter !== 'all' && inv.propertyId !== propertyFilter) {
      return false;
    }

    if (statusFilter !== 'all') {
      const status = resolveBackendStatus(inv);
      if (statusFilter === 'PENDING_MAPPING') {
        if (!isNeedsMatchingInvoice(inv)) return false;
      } else if (status !== statusFilter) {
        return false;
      }
    }

    if (normalizedQuery) {
      const haystack = `${inv.invoiceNumber} ${inv.vendorName} ${inv.propertyName} ${inv.accountNumber}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}

