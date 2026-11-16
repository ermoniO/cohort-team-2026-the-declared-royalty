import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  Invoice,
  Property,
  Vendor,
  PropertyVendorRelationship,
} from '@/types';

const sampleProperties: Property[] = [
  {
    id: 'prop-1',
    name: 'Grandview Office Tower',
    address: '100 Main St, San Francisco, CA',
    propertyType: 'Commercial',
    ownerEntity: 'Grandview Holdings LLC',
    managerName: 'Marcus Vance',
    sqft: 145000,
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
    costType: 'FIXED_MONTHLY',
    defaultGlCode: '5300',
    autoApprovalEnabled: true,
    status: 'ACTIVE',
  },
];

const sampleInvoices: Invoice[] = [
  {
    id: 'inv-match-1',
    invoiceNumber: 'INV-MATCH-101',
    vendorId: '',
    vendorName: 'Unmatched Utility Co',
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
    lineItems: [],
    auditTrail: [],
  },
  {
    id: 'inv-approved-2',
    invoiceNumber: 'INV-READY-404',
    vendorId: 'vend-1',
    vendorName: 'Pacific Water & Power',
    propertyId: 'prop-1',
    propertyName: 'Grandview Office Tower',
    mappingId: 'map-1',
    accountNumber: 'PWP-9001',
    amount: 2450,
    subtotal: 2450,
    tax: 0,
    issueDate: '2026-11-08',
    dueDate: '2026-11-22',
    status: 'approved',
    backendStatus: 'APPROVED',
    confidenceScore: 99,
    approvalTier: 'property_manager',
    intakeMethod: 'pdf_upload',
    paymentInfo: {
      method: 'CREDIT_CARD',
      status: 'unpaid',
    },
    lineItems: [],
    auditTrail: [],
  },
];

vi.mock('@/context/InvoiceContext', () => ({
  useInvoiceStore: () => ({
    invoices: sampleInvoices,
    selectedInvoice: sampleInvoices[1],
    properties: sampleProperties,
    scopedProperties: sampleProperties,
    isPropertiesLive: false,
    vendors: sampleVendors,
    isVendorsLive: false,
    mappings: sampleMappings,
    propertyCategories: [{ categoryCode: 'COMMERCIAL', categoryName: 'Commercial' }],
    vendorCategories: [{ categoryCode: 'UTILITIES', categoryName: 'Utilities' }],
    paymentMethods: [{ methodCode: 'ACH', methodName: 'ACH Transfer' }],
    companyPolicy: {
      maxAutoApproveAmount: 1000,
      maxAutoPayAmount: 500,
      minConfidenceScore: 90,
      requiresPoMatch: false,
      autoPayEnabled: true,
    },
    activeRole: 'vp_finance',
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
      canEditPolicy: true,
      description: 'Unlimited signing authority',
    },
    addNewProperty: vi.fn(async () => sampleProperties[0]),
    addNewVendor: vi.fn(async () => sampleVendors[0]),
    addMapping: vi.fn(async () => sampleMappings[0]),
    toggleAutoApproval: vi.fn(),
    updateMappingTerms: vi.fn(),
    updateCompanyPolicy: vi.fn(),
    updatePropertyPolicy: vi.fn(),
    evaluatePolicyForInvoice: vi.fn(),
    executeStripePayment: vi.fn(async () => ({ success: true, message: 'Paid' })),
    batchExecutePayments: vi.fn(async () => {}),
    openInvoiceWorkspace: vi.fn(),
    setSelectedInvoiceId: vi.fn(),
    setActiveTab: vi.fn(),
  }),
}));

vi.mock('@/features/auditLogs/useAuditHistory', () => ({
  useAuditHistory: () => ({
    logs: [
      {
        auditLogId: 'aud-1',
        invoice: '11111111-1111-1111-1111-111111111111',
        user: 'usr-vp',
        actionType: 'USER_APPROVED',
        actionTaken: 'Approved invoice INV-READY-404',
        fromState: 'PENDING_APPROVAL',
        toState: 'APPROVED',
        notes: 'Verified Tier 2 escalation',
        createdAt: '2026-11-12T15:30:00Z',
        updatedAt: '2026-11-12T15:30:00Z',
      },
    ],
    filtered: [
      {
        auditLogId: 'aud-1',
        invoice: '11111111-1111-1111-1111-111111111111',
        user: 'usr-vp',
        actionType: 'USER_APPROVED',
        actionTaken: 'Approved invoice INV-READY-404',
        fromState: 'PENDING_APPROVAL',
        toState: 'APPROVED',
        notes: 'Verified Tier 2 escalation',
        createdAt: '2026-11-12T15:30:00Z',
        updatedAt: '2026-11-12T15:30:00Z',
      },
    ],
    view: { sort: 'oldest', query: '', actionType: '', actorUuid: '', day: '' },
    setView: vi.fn(),
    resetView: vi.fn(),
    isLoading: false,
    error: null,
    actorFor: () => ({ name: 'Victoria Chen', role: 'VP of Finance' }),
    actorName: (u?: string) => (u === 'usr-vp' ? 'Victoria Chen' : 'System'),
    invoiceLabel: (id: string) => `Invoice ${id.slice(0, 8)}`,
    actorOptions: [{ value: 'usr-vp', label: 'Victoria Chen' }],
    refresh: vi.fn(async () => {}),
  }),
}));

import { MasterDataHubPage } from '@/components/MasterDataHubPage';
import { AuditHistoryLog } from '@/components/AuditHistoryLog';
import { PaymentHub } from '@/components/PaymentHub';
import { PayerPolicyRules } from '@/components/PayerPolicyRules';

describe('Task 6 Admin & Disbursements Screens', () => {
  it('renders MasterDataHubPage with dynamic primary CTAs per sub-tab and unmatched bills banner', () => {
    const propHtml = renderToStaticMarkup(<MasterDataHubPage initialTab="properties" />);
    expect(propHtml).toContain('Properties &amp; Vendors');
    expect(propHtml).toContain('New Property');
    expect(propHtml).toContain('Grandview Office Tower');
    expect(propHtml).toContain('bg-[#16834a]');

    const vendorHtml = renderToStaticMarkup(<MasterDataHubPage initialTab="vendors" />);
    expect(vendorHtml).toContain('New Vendor');
    expect(vendorHtml).toContain('Pacific Water &amp; Power');

    const mappingHtml = renderToStaticMarkup(<MasterDataHubPage initialTab="mappings" />);
    expect(mappingHtml).toContain('New Mapping');
    expect(mappingHtml).toContain('Unmatched Invoices');
    expect(mappingHtml).toContain('Review in Action Required');
    expect(mappingHtml).toContain('PWP-9001');
  });

  it('renders AuditHistoryLog with global Audit Ledger header without single-invoice lock', () => {
    const html = renderToStaticMarkup(<AuditHistoryLog />);
    expect(html).toContain('Audit Ledger');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Invoice 11111111');
    expect(html).toContain('Victoria Chen');
    expect(html).toContain('<img');
    expect(html).not.toContain('Master Invoice Audit &amp; Compliance Ledger');
    expect(html).not.toContain('Inspect Full Event Stream For Invoice');
  });

  it('renders PaymentHub with Disbursements header and Forest Green primary actions', () => {
    const html = renderToStaticMarkup(<PaymentHub />);
    expect(html).toContain('Disbursements');
    expect(html).toContain('INV-READY-404');
    expect(html).toContain('bg-[#16834a]');
  });

  it('renders PayerPolicyRules with Approval Policies header and without + Add Property or legacy baseline sliders', () => {
    const html = renderToStaticMarkup(<PayerPolicyRules />);
    expect(html).toContain('Approval Policies');
    expect(html).not.toContain('Add Property');
    expect(html).not.toContain('Portfolio Default Baseline Policy');
    expect(html).toContain('bg-[#16834a]');
  });
});
