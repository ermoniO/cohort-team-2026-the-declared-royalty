import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Invoice, Property, Vendor, PropertyVendorRelationship } from '@/types';

const sampleProperties: Property[] = [
  {
    id: 'prop-1',
    name: 'Grandview Office Tower',
    address: '100 Main St',
    propertyType: 'Commercial',
    ownerEntity: 'Grandview Holdings LLC',
    managerName: 'Marcus Vance',
    sqft: 120000,
    policy: {
      maxAutoApproveAmount: 1000,
      maxAutoPayAmount: 500,
      minConfidenceScore: 90,
      requiresPoMatch: false,
      autoPayEnabled: true,
    },
    hasCustomPolicy: false,
  },
];

const sampleVendors: Vendor[] = [
  {
    id: 'vend-1',
    name: 'Pacific Water & Power',
    category: 'Utilities',
    taxId: '94-1112233',
    defaultPaymentMethod: 'ach',
    accountNumber: 'PWP-9001',
    remittanceAddress: 'PO Box 100, San Francisco, CA',
    status: 'verified',
    historicalMatchesCount: 14,
  },
];

const sampleMappings: PropertyVendorRelationship[] = [
  {
    id: 'map-1',
    propertyId: 'prop-1',
    propertyName: 'Grandview Office Tower',
    vendorId: 'vend-1',
    vendorName: 'Pacific Water & Power',
    vendorAccountNumber: 'PWP-9001',
    costType: 'VARIABLE',
    defaultGlCode: '5300',
    autoApprovalEnabled: false,
    status: 'ACTIVE',
  },
];

const sampleInvoices: Invoice[] = [
  {
    id: 'inv-match-1',
    invoiceNumber: 'INV-MATCH-101',
    vendorId: '',
    vendorName: 'Unrecognized Utility Co',
    propertyId: 'prop-1',
    propertyName: 'Grandview Office Tower',
    accountNumber: 'ACCT-77',
    amount: 640,
    subtotal: 600,
    tax: 40,
    issueDate: '2026-11-10',
    dueDate: '2026-11-25',
    status: 'extracted',
    backendStatus: 'PENDING_MAPPING',
    confidenceScore: 72,
    approvalTier: 'auto_approved',
    intakeMethod: 'pdf_upload',
    lineItems: [{ id: 'li-1', description: 'Water Usage', quantity: 1, unitRate: 600, amount: 600 }],
    auditTrail: [],
  },
  {
    id: 'inv-appr-2',
    invoiceNumber: 'INV-APPR-202',
    vendorId: 'vend-1',
    vendorName: 'Pacific Water & Power',
    propertyId: 'prop-1',
    propertyName: 'Grandview Office Tower',
    mappingId: 'map-1',
    accountNumber: 'PWP-9001',
    amount: 18500,
    subtotal: 18500,
    tax: 0,
    issueDate: '2026-11-11',
    dueDate: '2026-11-28',
    status: 'pending_approval',
    backendStatus: 'PENDING_APPROVAL',
    confidenceScore: 98,
    approvalTier: 'vp_finance',
    intakeMethod: 'pdf_upload',
    duplicateMatch: {
      isDuplicate: true,
      similarityScore: 98,
      dismissed: false,
      matchedInvoiceNumber: 'INV-OLD-100',
      matchedAmount: 18500,
      matchedDate: '2026-10-14',
    },
    lineItems: [{ id: 'li-2', description: 'Chiller Retrofit', quantity: 1, unitRate: 18500, amount: 18500 }],
    auditTrail: [],
  },
  {
    id: 'inv-exc-3',
    invoiceNumber: 'INV-EXC-303',
    vendorId: 'vend-1',
    vendorName: 'Pacific Water & Power',
    propertyId: 'prop-1',
    propertyName: 'Grandview Office Tower',
    mappingId: 'map-1',
    accountNumber: 'PWP-9001',
    amount: 1200,
    subtotal: 1200,
    tax: 0,
    issueDate: '2026-11-12',
    dueDate: '2026-11-26',
    status: 'exception',
    backendStatus: 'FAILED',
    confidenceScore: 84,
    approvalTier: 'property_manager',
    intakeMethod: 'pdf_upload',
    exception: {
      type: 'unknown_vendor',
      message: 'Remittance bank suffix differs from master vendor record',
      aiSuggestion: 'Verify DBA alias against Pacific Water & Power',
    },
    lineItems: [{ id: 'li-3', description: 'Emergency Line Flush', quantity: 1, unitRate: 1200, amount: 1200 }],
    auditTrail: [],
  },
];

vi.mock('@/context/InvoiceContext', () => ({
  useInvoiceStore: () => ({
    invoices: sampleInvoices,
    selectedInvoice: sampleInvoices[1],
    properties: sampleProperties,
    scopedProperties: sampleProperties,
    vendors: sampleVendors,
    mappings: sampleMappings,
    currentUser: {
      id: 'usr-vp',
      name: 'Victoria Chen',
      email: 'v.chen@pmfirm.com',
      role: 'vp_finance',
      title: 'VP of Finance',
      propertyScope: 'Portfolio-Wide',
    },
    currentProfile: {
      role: 'vp_finance',
      title: 'VP of Finance',
      approvalLimit: Infinity,
      description: 'Unlimited signing authority',
    },
    approveInvoice: vi.fn(async () => true),
    bulkApproveInvoices: vi.fn(async () => ({ approvedCount: 1, skippedCount: 0 })),
    rejectInvoice: vi.fn(async () => {}),
    requestReevaluation: vi.fn(async () => {}),
    dismissDuplicate: vi.fn(),
    resolveException: vi.fn(),
    confirmMatch: vi.fn(async () => {}),
    addMapping: vi.fn(async () => sampleMappings[0]),
    openInvoiceWorkspace: vi.fn(),
    closeInvoiceWorkspace: vi.fn(),
    setSelectedInvoiceId: vi.fn(),
    setActiveTab: vi.fn(),
    rerunExtraction: vi.fn(async () => {}),
    updateExtractedInvoice: vi.fn(),
  }),
}));

vi.mock('@/features/auditLogs/useAuditHistory', () => ({
  useAuditHistory: () => ({
    logs: [],
    isLoading: false,
    error: null,
    actorFor: () => ({ name: 'Elena Rostova', role: 'Corporate Accountant' }),
    actorName: (u?: string) => u || 'System Automation',
  }),
}));

import { ActionRequiredPage } from '@/components/ActionRequiredPage';
import { UnifiedInvoiceWorkspace } from '@/components/UnifiedInvoiceWorkspace';

describe('ActionRequiredPage & UnifiedInvoiceWorkspace', () => {
  it('renders unified Action Required inbox with all 3 actionable buckets and expected approver portrait', () => {
    const html = renderToStaticMarkup(<ActionRequiredPage initialFilter="all" />);

    expect(html).toContain('Action Required');
    expect(html).toContain('All Tasks');
    expect(html).toContain('Needs Matching');
    expect(html).toContain('Pending Approval');
    expect(html).toContain('Exceptions');
    expect(html).toContain('INV-MATCH-101');
    expect(html).toContain('INV-APPR-202');
    expect(html).toContain('INV-EXC-303');
    expect(html).toContain('Compare Duplicate');
    expect(html).toContain('Victoria Chen');
    expect(html).toContain('<img');
    expect(html).toContain('bg-[#16834a]');
  });

  it('filters sections cleanly for matching, approvals, and exceptions pills', () => {
    const matchingHtml = renderToStaticMarkup(<ActionRequiredPage initialFilter="matching" />);
    expect(matchingHtml).toContain('INV-MATCH-101');
    expect(matchingHtml).not.toContain('INV-EXC-303');

    const approvalsHtml = renderToStaticMarkup(<ActionRequiredPage initialFilter="approvals" />);
    expect(approvalsHtml).toContain('INV-APPR-202');
    expect(approvalsHtml).toContain('Victoria Chen');
    expect(approvalsHtml).not.toContain('INV-MATCH-101');

    const exceptionsHtml = renderToStaticMarkup(<ActionRequiredPage initialFilter="exceptions" />);
    expect(exceptionsHtml).toContain('INV-EXC-303');
    expect(exceptionsHtml).toContain('Verify DBA alias');
    expect(exceptionsHtml).not.toContain('INV-MATCH-101');
  });

  it('renders Expected Approval Path with approver face inside UnifiedInvoiceWorkspace Policy & Approval tab', () => {
    const html = renderToStaticMarkup(<UnifiedInvoiceWorkspace initialRightTab="approval" />);

    expect(html).toContain('Policy &amp; Approval');
    expect(html).toContain('Expected Approval Path');
    expect(html).toContain('Victoria Chen');
    expect(html).toContain('<img');
  });
});
