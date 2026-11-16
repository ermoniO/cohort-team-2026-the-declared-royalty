import { describe, expect, it } from 'vitest';
import type { Invoice } from '@/types';
import {
  NAVIGATION_SECTIONS,
  computeActionRequiredBreakdown,
  computeActionRequiredCount,
  computeDisbursementsCount,
  filterInvoicesForList,
} from './navigation';
import { isInvoiceReadyForDisbursement } from '@/features/invoices/invoiceFormat';

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-001',
    accountNumber: 'ACC-1',
    vendorId: 'v-1',
    vendorName: 'Pacific Water',
    propertyId: 'p-1',
    propertyName: 'Grandview Tower',
    issueDate: '2026-11-01',
    dueDate: '2026-11-15',
    subtotal: 500,
    tax: 0,
    amount: 500,
    lineItems: [],
    status: 'pending_approval',
    confidenceScore: 95,
    approvalTier: 'property_manager',
    intakeMethod: 'pdf_upload',
    auditTrail: [],
    ...overrides,
  };
}

describe('navigation config and triage selectors', () => {
  it('defines OPERATIONS (4 items) and ADMIN & SETUP (3 items)', () => {
    expect(NAVIGATION_SECTIONS).toHaveLength(2);
    expect(NAVIGATION_SECTIONS[0].title).toBe('OPERATIONS');
    expect(NAVIGATION_SECTIONS[0].items.map((i) => i.id)).toEqual([
      'overview',
      'invoices',
      'action_required',
      'disbursements',
    ]);
    expect(NAVIGATION_SECTIONS[1].title).toBe('ADMIN & SETUP');
    expect(NAVIGATION_SECTIONS[1].items.map((i) => i.id)).toEqual([
      'master_data',
      'policies',
      'audit_ledger',
    ]);
  });

  it('deduplicates an invoice that is both pending_approval and a flagged duplicate in totalUnique', () => {
    const invNeedsMatch = makeInvoice({
      id: 'inv-match',
      status: 'extracted',
      backendStatus: 'PENDING_MAPPING',
    });
    const invPendingAndDup = makeInvoice({
      id: 'inv-dup',
      status: 'pending_approval',
      backendStatus: 'PENDING_APPROVAL',
      duplicateMatch: { isDuplicate: true, similarityScore: 98, dismissed: false },
    });
    const invFailed = makeInvoice({
      id: 'inv-fail',
      status: 'exception',
      backendStatus: 'FAILED',
    });
    const invPaid = makeInvoice({
      id: 'inv-paid',
      status: 'paid',
      backendStatus: 'PAID',
    });

    const breakdown = computeActionRequiredBreakdown([
      invNeedsMatch,
      invPendingAndDup,
      invFailed,
      invPaid,
    ]);

    expect(breakdown.needsMatching).toHaveLength(1);
    expect(breakdown.pendingApproval).toHaveLength(1);
    expect(breakdown.exceptionsAndDuplicates).toHaveLength(2);
    expect(breakdown.totalUnique).toBe(3);
    expect(computeActionRequiredCount([invNeedsMatch, invPendingAndDup, invFailed, invPaid])).toBe(3);
  });

  it('filters invoices by statusFilter, propertyFilter, and case-insensitive searchQuery', () => {
    const a = makeInvoice({
      id: '1',
      invoiceNumber: 'INV-100',
      vendorName: 'Apex HVAC',
      propertyId: 'prop-a',
      propertyName: 'Harborfront',
      status: 'approved',
      backendStatus: 'APPROVED',
    });
    const b = makeInvoice({
      id: '2',
      invoiceNumber: 'INV-200',
      vendorName: 'Pacific Water',
      propertyId: 'prop-b',
      propertyName: 'Grandview',
      status: 'extracted',
      backendStatus: 'PENDING_MAPPING',
    });

    expect(filterInvoicesForList([a, b], 'APPROVED', 'all', '')).toEqual([a]);
    expect(filterInvoicesForList([a, b], 'all', 'prop-b', '')).toEqual([b]);
    expect(filterInvoicesForList([a, b], 'all', 'all', 'apex')).toEqual([a]);
    expect(filterInvoicesForList([a, b], 'all', 'all', 'inv-200')).toEqual([b]);
  });

  it('keeps isInvoiceReadyForDisbursement in parity with computeDisbursementsCount across settlement and failure transitions', () => {
    const approvedLive = makeInvoice({
      id: 'inv-approved-live',
      status: 'approved',
      backendStatus: 'APPROVED',
      paymentInfo: { method: 'CREDIT_CARD', status: 'unpaid' },
    });
    const paidSettled = makeInvoice({
      id: 'inv-paid-settled',
      status: 'paid',
      backendStatus: 'PAID',
      paymentInfo: { method: 'CREDIT_CARD', status: 'succeeded' },
    });
    const declinedFailed = makeInvoice({
      id: 'inv-declined',
      status: 'exception',
      backendStatus: 'FAILED',
      paymentInfo: { method: 'CREDIT_CARD', status: 'declined' },
    });

    const sample = [approvedLive, paidSettled, declinedFailed];
    expect(sample.filter(isInvoiceReadyForDisbursement)).toEqual([approvedLive]);
    expect(computeDisbursementsCount(sample)).toBe(1);
  });
});

