import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  InvoiceStateStepper,
  deriveStepperModel,
} from '@/components/InvoiceStateStepper';
import type { Invoice } from '@/types';
import type { AuditLogsResponse } from '@/types/auditlogs';

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001';
const USER_SARAH_ID = '11111111-1111-1111-1111-111111111111';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-100',
    invoiceNumber: 'BILL-1001',
    accountNumber: '2000456700',
    vendorId: 'vend-1',
    vendorName: 'Alder Creek Landscaping',
    propertyId: 'prop-1',
    propertyName: 'Industrial Business Park',
    issueDate: '2026-10-02',
    dueDate: '2026-10-16',
    subtotal: 186.42,
    tax: 0,
    amount: 186.42,
    status: 'extracted',
    backendStatus: 'PENDING_MAPPING',
    confidenceScore: 72,
    approvalTier: 'property_manager',
    intakeMethod: 'pdf_upload',
    lineItems: [],
    auditTrail: [],
    ...overrides,
  };
}

function makeAuditLog(overrides: Partial<AuditLogsResponse>): AuditLogsResponse {
  return {
    auditLogId: `aud-${Math.random().toString(36).slice(2, 8)}`,
    invoice: 'inv-100',
    user: SYSTEM_ID,
    actionType: 'SYSTEM_INGESTED',
    actionTaken: 'PDF uploaded',
    fromState: 'NONE',
    toState: 'INGESTED',
    notes: null,
    createdAt: '2026-11-14T15:00:00Z',
    updatedAt: '2026-11-14T15:00:00Z',
    ...overrides,
  };
}

describe('InvoiceStateStepper', () => {
  it('renders PENDING_MAPPING with Auto-Ingested stage completed, Needs Mapping active, and 100% first progress bar', () => {
    const invoice = makeInvoice({ backendStatus: 'PENDING_MAPPING', status: 'extracted' });
    const logs = [
      makeAuditLog({ actionType: 'SYSTEM_INGESTED', toState: 'INGESTED' }),
      makeAuditLog({ actionType: 'SYSTEM_IDENTIFIED', fromState: 'INGESTED', toState: 'PENDING_MAPPING' }),
    ];

    const model = deriveStepperModel(invoice, logs);
    expect(model.completedHops).toBe(1);
    expect(model.stages[0].status).toBe('completed');
    expect(model.stages[0].pill?.label).toBe('Auto-Ingested');
    expect(model.stages[1].status).toBe('active');
    expect(model.stages[1].pill?.label).toBe('Needs Mapping');
    expect(model.stages[2].status).toBe('upcoming');
    expect(model.stages[3].status).toBe('upcoming');

    const html = renderToStaticMarkup(<InvoiceStateStepper invoice={invoice} auditLogs={logs} />);
    expect(html).toContain('Auto-Ingested');
    expect(html).toContain('Needs Mapping');
    expect(html).toContain('data-testid="stepper-progress-fill-0"');
    expect(html).toContain('width:100%');
    expect(html).toContain('width:0%');
  });

  it('shows Auto-Matched compliance pill and AI avatar when SYSTEM_MATCHED advances to PENDING_APPROVAL', () => {
    const invoice = makeInvoice({
      backendStatus: 'PENDING_APPROVAL',
      status: 'pending_approval',
      mappingId: 'map-1',
    });
    const logs = [
      makeAuditLog({ actionType: 'SYSTEM_IDENTIFIED', fromState: 'INGESTED', toState: 'PENDING_MAPPING' }),
      makeAuditLog({
        actionType: 'SYSTEM_MATCHED',
        actionTaken: 'Auto-matched active property-vendor mapping',
        fromState: 'PENDING_MAPPING',
        toState: 'PENDING_APPROVAL',
      }),
    ];

    const model = deriveStepperModel(invoice, logs);
    expect(model.completedHops).toBe(2);
    expect(model.stages[1].status).toBe('completed');
    expect(model.stages[1].pill?.label).toBe('Auto-Matched');
    expect(model.stages[1].actors[0].isSystem).toBe(true);
    expect(model.stages[2].status).toBe('active');

    const html = renderToStaticMarkup(<InvoiceStateStepper invoice={invoice} auditLogs={logs} />);
    expect(html).toContain('Auto-Matched');
    expect(html).toContain('PENDING_APPROVAL');
  });

  it('shows all 4 stages completed and all 3 progress bars at 100% for PAID straight-through invoices', () => {
    const invoice = makeInvoice({
      backendStatus: 'PAID',
      status: 'paid',
      approvalTier: 'auto_approved',
    });
    const logs = [
      makeAuditLog({ actionType: 'SYSTEM_INGESTED', toState: 'INGESTED' }),
      makeAuditLog({ actionType: 'SYSTEM_MATCHED', fromState: 'PENDING_MAPPING', toState: 'PENDING_APPROVAL' }),
      makeAuditLog({ actionType: 'SYSTEM_APPROVED', fromState: 'PENDING_APPROVAL', toState: 'APPROVED' }),
      makeAuditLog({ actionType: 'SYSTEM_PAID', fromState: 'APPROVED', toState: 'PAID' }),
    ];

    const model = deriveStepperModel(invoice, logs);
    expect(model.completedHops).toBe(3);
    expect(model.stages.map((s) => s.status)).toEqual(['completed', 'completed', 'completed', 'completed']);
    expect(model.stages[2].pill?.label).toBe('Auto-Approved');

    const html = renderToStaticMarkup(<InvoiceStateStepper invoice={invoice} auditLogs={logs} />);
    expect(html).toContain('Straight-Through Complete');
    expect(html).toContain('Auto-Approved');
    expect(html).not.toContain('width:0%');
  });

  it('renders FAILED state inline on the failing macro-stage with failureReason and without extra dead-end branch nodes', () => {
    const invoice = makeInvoice({
      backendStatus: 'FAILED',
      status: 'exception',
      failureReason: 'Missing property-vendor mapping',
      vendorId: '',
      mappingId: undefined,
    });

    const model = deriveStepperModel(invoice, []);
    expect(model.stages).toHaveLength(4);
    expect(model.faultStageIndex).toBe(1);
    expect(model.stages[0].status).toBe('completed');
    expect(model.stages[1].status).toBe('failed');
    expect(model.stages[2].status).toBe('upcoming');
    expect(model.stages[3].status).toBe('upcoming');

    const html = renderToStaticMarkup(<InvoiceStateStepper invoice={invoice} />);
    expect(html).toContain('data-stage-status="failed"');
    expect(html).toContain('Missing property-vendor mapping');
    expect(html).toContain('Halted / Exception');
  });

  it('renders overlapping actor initials avatar and hover tooltip text for human and AI actors', () => {
    const invoice = makeInvoice({ backendStatus: 'APPROVED', status: 'approved' });
    const logs = [
      makeAuditLog({
        user: SYSTEM_ID,
        actionType: 'SYSTEM_IDENTIFIED',
        actionTaken: 'AI extracted fields',
        fromState: 'INGESTED',
        toState: 'PENDING_MAPPING',
      }),
      makeAuditLog({
        user: USER_SARAH_ID,
        actionType: 'USER_APPROVED',
        actionTaken: 'Approved Bill',
        fromState: 'PENDING_APPROVAL',
        toState: 'APPROVED',
      }),
    ];

    const actorFor = (id: string) =>
      id === USER_SARAH_ID
        ? { name: 'Sarah Morgan', role: 'Property Manager' }
        : { name: 'System', role: 'Automated Engine' };

    const html = renderToStaticMarkup(
      <InvoiceStateStepper invoice={invoice} auditLogs={logs} actorFor={actorFor} />,
    );
    expect(html).toContain('SM');
    expect(html).toContain('Sarah Morgan · Property Manager');
    expect(html).toContain('Approved Bill');
  });
});

