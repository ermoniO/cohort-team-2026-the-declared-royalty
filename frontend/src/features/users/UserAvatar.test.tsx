import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserAvatar } from './UserAvatar';
import {
  buildDeterministicFaceSvgDataUrl,
  isSystemUser,
  resolveKnownUserId,
} from './userDisplay';
import { resolveExpectedApprover, resolveInvoiceClearingSummary } from '@/components/ApprovalsQueue';
import AuditEventItem from '@/features/auditLogs/AuditEventItem';
import { InvoiceStateStepper } from '@/components/InvoiceStateStepper';
import type { Invoice } from '@/types';
import type { AuditLogsResponse } from '@/types/auditlogs';

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001';

describe('UserAvatar & actor profile picture integration', () => {
  it('generates deterministic SVG face portraits and renders an img for human users', () => {
    const uri1 = buildDeterministicFaceSvgDataUrl('usr-elena', 'Elena Rostova');
    const uri2 = buildDeterministicFaceSvgDataUrl('usr-elena', 'Elena Rostova');
    const uriOther = buildDeterministicFaceSvgDataUrl('usr-marcus', 'Marcus Vance');

    expect(uri1).toMatch(/^data:image\/svg\+xml/);
    expect(uri1).toBe(uri2);
    expect(uri1).not.toBe(uriOther);

    const html = renderToStaticMarkup(
      <UserAvatar
        userId="f47ac10b-58cc-4372-a567-0e02b2c3d481"
        name="Elena Rostova"
        role="ACCOUNTANT"
        sizeClassName="size-8"
      />,
    );

    expect(html).toContain('<img');
    expect(html).toContain('alt="Elena Rostova"');
    expect(html).toContain('data:image/svg+xml');
    expect(html).toContain('data-initials="ER"');
  });

  it('prefers explicit avatarUrl when provided and honors showInitialsOnly fallback mode', () => {
    const htmlWithPhoto = renderToStaticMarkup(
      <UserAvatar
        name="Sarah Jenkins"
        avatarUrl="https://example.com/sarah.jpg"
        sizeClassName="size-8"
      />,
    );
    expect(htmlWithPhoto).toContain('src="https://example.com/sarah.jpg"');

    const htmlFallback = renderToStaticMarkup(
      <UserAvatar
        name="Sarah Jenkins"
        forceInitialsFallback
        sizeClassName="size-8"
      />,
    );
    expect(htmlFallback).not.toContain('<img');
    expect(htmlFallback).toContain('SJ');
    expect(htmlFallback).toContain('bg-[#e8f7ed]');
  });

  it('renders an AI/System badge instead of a human portrait for system actors', () => {
    expect(isSystemUser({ userId: SYSTEM_ID })).toBe(true);
    expect(isSystemUser({ name: 'System Bot' })).toBe(true);
    expect(isSystemUser({ name: 'Elena Rostova' })).toBe(false);

    const html = renderToStaticMarkup(
      <UserAvatar userId={SYSTEM_ID} name="System" sizeClassName="size-6" />,
    );
    expect(html).toContain('data-testid="system-actor-avatar"');
    expect(html).not.toContain('<img');
  });

  it('renders actor UserAvatar inside AuditEventItem and expectedApprover face inside InvoiceStateStepper', () => {
    const sampleLog: AuditLogsResponse = {
      auditLogId: 'aud-1',
      invoice: 'inv-1',
      user: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
      actionType: 'USER_APPROVED',
      actionTaken: 'Approved invoice #INV-001',
      fromState: 'PENDING_APPROVAL',
      toState: 'APPROVED',
      notes: 'Cleared Tier 1 limit',
      createdAt: '2026-11-14T15:00:00Z',
      updatedAt: '2026-11-14T15:00:00Z',
    };

    const auditHtml = renderToStaticMarkup(
      <AuditEventItem
        log={sampleLog}
        actor={{ name: 'Elena Rostova', role: 'Accountant' }}
        expanded={false}
        onToggle={() => {}}
        last
      />,
    );

    expect(auditHtml).toContain('alt="Elena Rostova"');
    expect(auditHtml).toContain('Elena Rostova');

    const pendingInvoice: Invoice = {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-2002',
      accountNumber: 'ACC-200',
      vendorId: 'v-1',
      vendorName: 'Pacific Water',
      propertyId: 'prop-grandview',
      propertyName: 'Grandview Office Tower',
      issueDate: '2026-11-01',
      dueDate: '2026-11-20',
      subtotal: 4000,
      tax: 0,
      amount: 4000,
      lineItems: [],
      status: 'pending_approval',
      backendStatus: 'PENDING_APPROVAL',
      confidenceScore: 98,
      approvalTier: 'property_manager',
      intakeMethod: 'pdf_upload',
      auditTrail: [],
    };

    const stepperHtml = renderToStaticMarkup(
      <InvoiceStateStepper
        invoice={pendingInvoice}
        expectedApprover={{
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
          name: 'Marcus Vance',
          role: 'Property Manager',
        }}
      />,
    );

    expect(stepperHtml).toContain('alt="Marcus Vance"');
    expect(stepperHtml).toContain('Next: Marcus Vance');
  });

  it('recognizes AI/bot system actors and resolves canonical userIds for fallback approvers', () => {
    expect(isSystemUser({ name: 'Policy Engine (AI)' })).toBe(true);
    expect(isSystemUser({ name: 'Duplicate Guard Bot' })).toBe(true);

    const policyHtml = renderToStaticMarkup(
      <UserAvatar name="Policy Engine (AI)" role="Automated Rule" sizeClassName="size-6" />,
    );
    expect(policyHtml).toContain('data-testid="system-actor-avatar"');
    expect(policyHtml).not.toContain('<img');

    expect(resolveKnownUserId('Elena Rostova')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d481');
    expect(resolveKnownUserId('Victoria Chen')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d483');

    const clearing = resolveInvoiceClearingSummary([], 'usr-1', 1000, 15000, 'VARIABLE');
    const resolved = resolveExpectedApprover(
      {
        id: 'inv-fallback',
        invoiceNumber: 'INV-900',
        accountNumber: 'ACC-9',
        vendorId: 'v-1',
        vendorName: 'Vendor',
        propertyId: 'p-1',
        propertyName: 'Prop',
        issueDate: '2026-11-01',
        dueDate: '2026-11-20',
        subtotal: 15000,
        tax: 0,
        amount: 15000,
        lineItems: [],
        status: 'pending_approval',
        confidenceScore: 95,
        approvalTier: 'vp_finance',
        intakeMethod: 'pdf_upload',
        auditTrail: [],
      },
      clearing,
    );
    expect(resolved.name).toBe('Victoria Chen');
    expect(resolved.id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d483');
  });
});

