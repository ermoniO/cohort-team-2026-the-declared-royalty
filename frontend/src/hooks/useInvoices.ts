import { useState, useMemo, useEffect } from 'react';
import {
  Invoice,
  Property,
  Vendor,
  AppUser,
  RoleProfile,
  ActivityItem,
  PaymentMethod,
} from '../types';
import { INITIAL_INVOICES, INITIAL_ACTIVITIES } from '../data/mockData';
import { createStripePayment } from '@/app/services/paymentService';
import { getInvoices } from '@/app/services/invoiceService';
import type { InvoiceResponse } from '@/types/invoice';

interface UseInvoicesProps {
  currentUser: AppUser;
  currentProfile: RoleProfile;
  properties: Property[];
  vendors: Vendor[];
  evaluatePolicyForInvoice: (amount: number, propertyId: string, confidence: number) => {
    isAutoApproved: boolean;
    tier: 'auto_approved' | 'property_manager' | 'vp_finance';
    effectiveMaxAmount: number;
    requiresHumanReview: boolean;
    reason: string;
  };
}

function mapBackendInvoiceToUI(
  dto: InvoiceResponse,
  defaultProperty?: Property,
  defaultVendor?: Vendor
): Invoice {
  const isPaid = dto.invoiceStatus === 'PAID';
  const isApproved = dto.invoiceStatus === 'APPROVED' || isPaid;
  const isException = dto.invoiceStatus === 'FAILED';

  let status: Invoice['status'] = 'pending_approval';
  if (isPaid) status = 'paid';
  else if (isApproved) status = 'approved';
  else if (isException) status = 'exception';
  else if (dto.invoiceStatus === 'INGESTED') status = 'extracted';
  else if (dto.invoiceStatus === 'PENDING_MAPPING') status = 'unmatched';

  return {
    id: dto.invoiceUuid,
    invoiceNumber: dto.vendorSuppliedInvoiceId || `INV-${dto.invoiceUuid.substring(0, 8).toUpperCase()}`,
    accountNumber: dto.vendorAccountNumber || 'ACC-9921',
    vendorId: dto.vendorUuid || defaultVendor?.id || 'ven-apex-hvac',
    vendorName: dto.vendorName || defaultVendor?.name || 'Apex Commercial HVAC',
    propertyId: dto.propertyUuid || defaultProperty?.id || 'prop-grandview',
    propertyName: dto.propertyName || defaultProperty?.name || 'Grandview Point Logistics',
    issueDate: dto.billingPeriodStart || (dto.createdAt ? dto.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
    dueDate: dto.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    subtotal: dto.amount || 0,
    tax: 0,
    amount: dto.amount || 0,
    status,
    confidenceScore: 95,
    approvalTier: (dto.amount || 0) > 10000 ? 'vp_finance' : 'property_manager',
    intakeMethod: 'pdf_upload',
    documentType: 'operational',
    notes: dto.originalFilename ? `File: ${dto.originalFilename}` : 'Imported bill',
    lineItems: [
      {
        id: `li-${dto.invoiceUuid}-1`,
        description: dto.originalFilename || 'Commercial Services',
        quantity: 1,
        unitRate: dto.amount || 0,
        amount: dto.amount || 0,
        glCode: '6100-MAINT',
      },
    ],
    paymentInfo: {
      method: 'CREDIT_CARD',
      status: isPaid ? 'succeeded' : 'unpaid',
    },
    auditTrail: [
      {
        id: `aud-${Date.now()}`,
        timestamp: dto.createdAt ? dto.createdAt.replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19),
        eventType: 'INTAKE_INGESTED',
        description: `Ingested invoice from backend (${dto.invoiceStatus}).`,
        user: 'System',
        role: 'system',
      },
    ],
  };
}

export function useInvoices({
  currentUser,
  currentProfile,
  properties,
  vendors,
  evaluatePolicyForInvoice,
}: UseInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>('inv-001');
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);

  useEffect(() => {
    let cancelled = false;
    getInvoices({ page: 0, size: 50 })
      .then((res) => {
        if (!cancelled && res?.items && res.items.length > 0) {
          const liveInvoices = res.items.map((dto) =>
            mapBackendInvoiceToUI(dto, properties[0], vendors[0])
          );
          setInvoices((prev) => {
            const liveIds = new Set(liveInvoices.map((i) => i.id));
            const remainingMock = prev.filter((i) => !liveIds.has(i.id));
            return [...liveInvoices, ...remainingMock];
          });
        }
      })
      .catch(() => {
        // Fallback to initial seed if backend is offline
      });
    return () => {
      cancelled = true;
    };
  }, [properties, vendors]);

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0];
  }, [invoices, selectedInvoiceId]);

  const addActivity = (
    title: string,
    subtitle: string,
    type: ActivityItem['type'],
    status: ActivityItem['status'],
    invoiceId?: string
  ) => {
    const newItem: ActivityItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: 'Just now',
      title,
      subtitle,
      type,
      status,
      invoiceId,
    };
    setActivities((prev) => [newItem, ...prev.slice(0, 24)]);
  };

  const approveInvoice = (invoiceId: string, note?: string): boolean => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return false;

    if (target.amount > currentProfile.approvalLimit) {
      alert(
        `Approval denied: Invoice amount ($${target.amount.toLocaleString()}) exceeds your signing limit ($${currentProfile.approvalLimit.toLocaleString()}).`
      );
      return false;
    }

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'APPROVED',
      description: `Approval granted by ${currentUser.name} (${currentProfile.title}). ${
        note ? `Note: ${note}` : ''
      }`,
      user: currentUser.name,
      role: currentProfile.id,
      metadata: { note, amount: target.amount },
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          status: 'approved',
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity(
      'Invoice Approved',
      `${target.invoiceNumber} ($${target.amount.toLocaleString()}) approved by ${currentUser.name}`,
      'approval',
      'success',
      invoiceId
    );

    return true;
  };

  const rejectInvoice = (invoiceId: string, reason: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'REJECTED',
      description: `Invoice rejected by ${currentUser.name}. Reason: ${reason}`,
      user: currentUser.name,
      role: currentProfile.id,
      metadata: { reason },
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          status: 'exception',
          exception: {
            type: 'conflicting_data',
            message: `Rejected: ${reason}`,
            assignedTo: currentUser.name,
            resolved: false,
          },
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity(
      'Invoice Rejected',
      `${target.invoiceNumber} flagged to exception inbox`,
      'exception',
      'warning',
      invoiceId
    );
  };

  const requestReevaluation = (invoiceId: string, reason: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'REEVALUATION_REQUESTED',
      description: `Re-evaluation requested by ${currentUser.name}: ${reason}`,
      user: currentUser.name,
      role: currentProfile.id,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          status: 'pending_approval',
          notes: `${inv.notes ? inv.notes + ' | ' : ''}Re-evaluation: ${reason}`,
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Re-evaluation Requested', `${target.invoiceNumber} returned for review`, 'approval', 'info', invoiceId);
  };

  const dismissDuplicate = (invoiceId: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
    addActivity('Duplicate Dismissed', `${target.invoiceNumber} removed as duplicate`, 'exception', 'info', invoiceId);
  };

  const resolveException = (invoiceId: string, actionNote: string, newVendorId?: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const vendorId = newVendorId || target.vendorId;
    const vendorName = vendors.find((v) => v.id === vendorId)?.name || target.vendorName;

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'EXCEPTION_RESOLVED',
      description: `Exception cleared by ${currentUser.name}: ${actionNote}`,
      user: currentUser.name,
      role: currentProfile.id,
      metadata: { actionNote, newVendorId },
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          status: 'pending_approval',
          vendorId,
          vendorName,
          exception: inv.exception ? { ...inv.exception, resolved: true, overrideReason: actionNote } : undefined,
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Exception Resolved', `${target.invoiceNumber} routed to Approvals Queue`, 'exception', 'success', invoiceId);
  };

  const executeStripePayment = async (
    invoiceId: string,
    testCardType: 'success' | 'decline' | 'insufficient' = 'success'
  ): Promise<{ success: boolean; message: string; chargeId?: string }> => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return { success: false, message: 'Invoice not found' };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
    if (isUuid) {
      try {
        const pmId = testCardType === 'decline' ? 'pm_card_chargeCustomerFail' : 'pm_card_visa';
        const res = await createStripePayment(invoiceId, {
          paymentMethodId: pmId,
          currency: 'usd',
          approvedAmount: target.amount,
          humanApprovalConfirmed: true,
        });
        const chargeId = res.stripePaymentIntentId || res.paymentAttemptId;
        const paidTimestamp = new Date().toISOString();
        const successEvent = {
          id: `aud-${Date.now()}`,
          timestamp: paidTimestamp.replace('T', ' ').substring(0, 19),
          eventType: 'PAYMENT_EXECUTED',
          description: `Disbursed $${target.amount.toLocaleString()} via live Stripe backend (${res.status}). Ref: ${chargeId}`,
          user: currentUser.name,
          role: currentProfile.id,
          metadata: { chargeId, amount: target.amount, rail: 'CREDIT_CARD' },
        };
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            return {
              ...inv,
              status: 'paid',
              paymentInfo: {
                method: 'CREDIT_CARD',
                status: 'succeeded',
                transactionRef: chargeId,
                paidAt: paidTimestamp,
                cardLast4: '4242',
                authCode: 'AUTH-OK-99',
              },
              auditTrail: [successEvent, ...inv.auditTrail],
            };
          })
        );
        addActivity('Payment Settled', `${target.invoiceNumber} disbursed via Stripe ($${target.amount.toLocaleString()})`, 'payment', 'success', invoiceId);
        return { success: true, message: `Stripe charge authorized and settled (${res.status})`, chargeId };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const failEvent = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          eventType: 'PAYMENT_FAILED',
          description: `Stripe charge failed: ${errorMsg}`,
          user: currentUser.name,
          role: currentProfile.id,
        };
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            return {
              ...inv,
              auditTrail: [failEvent, ...inv.auditTrail],
            };
          })
        );
        addActivity('Payment Failed', `${target.invoiceNumber} rejected by Stripe (${errorMsg})`, 'payment', 'error', invoiceId);
        return { success: false, message: `Stripe error: ${errorMsg}` };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 800));

    if (testCardType === 'decline') {
      const failEvent = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
        eventType: 'PAYMENT_FAILED',
        description: 'Stripe charge failed: Card was declined (generic_decline).',
        user: currentUser.name,
        role: currentProfile.id,
      };

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invoiceId) return inv;
          return {
            ...inv,
            status: 'exception',
            paymentInfo: {
              method: 'CREDIT_CARD',
              status: 'declined',
              failureReason: 'Your card was declined by issuing bank.',
            },
            exception: {
              type: 'payment_failed',
              message: 'Stripe Charge Failed: Card declined',
              aiSuggestion: 'Prompt AP specialist for alternative ACH or Check disbursement.',
              assignedTo: currentUser.name,
              resolved: false,
            },
            auditTrail: [failEvent, ...inv.auditTrail],
          };
        })
      );

      addActivity('Payment Declined', `${target.invoiceNumber} Stripe CC charge declined`, 'payment', 'warning', invoiceId);
      return { success: false, message: 'Card declined by Stripe simulator' };
    }

    if (testCardType === 'insufficient') {
      return { success: false, message: 'Insufficient funds on test account' };
    }

    const chargeId = `ch_3M${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const paidTimestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);

    const successEvent = {
      id: `aud-${Date.now()}`,
      timestamp: paidTimestamp,
      eventType: 'PAYMENT_EXECUTED',
      description: `Payment settled via Stripe Test CC ($${target.amount.toLocaleString()}). Charge ID: ${chargeId}.`,
      user: currentUser.name,
      role: currentProfile.id,
      metadata: { chargeId, amount: target.amount, method: 'CREDIT_CARD' },
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          status: 'paid',
          paymentInfo: {
            method: 'CREDIT_CARD',
            status: 'succeeded',
            transactionRef: chargeId,
            paidAt: paidTimestamp,
            cardLast4: '4242',
            authCode: 'AUTH-OK-99',
          },
          auditTrail: [successEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Payment Settled', `${target.invoiceNumber} disbursed via Stripe ($${target.amount.toLocaleString()})`, 'payment', 'success', invoiceId);
    return { success: true, message: 'Stripe charge authorized and settled', chargeId };
  };

  const batchExecutePayments = async (invoiceIds: string[]) => {
    let succeeded = 0;
    for (const id of invoiceIds) {
      const res = await executeStripePayment(id, 'success');
      if (res.success) succeeded++;
    }
    return { processed: invoiceIds.length, succeeded };
  };

  const confirmMatch = (invoiceId: string, vendorId: string, propertyId: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    const v = vendors.find((vend) => vend.id === vendorId);
    const p = properties.find((prop) => prop.id === propertyId);

    if (!target || !v || !p) return;

    const evaluation = evaluatePolicyForInvoice(target.amount, propertyId, 95);

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'MATCH_CONFIRMED',
      description: `Payee "${v.name}" matched to Payer "${p.name}" by ${currentUser.name}. Policy evaluated: ${evaluation.reason}`,
      user: currentUser.name,
      role: currentProfile.id,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          vendorId: v.id,
          vendorName: v.name,
          propertyId: p.id,
          propertyName: p.name,
          confidenceScore: 98,
          status: evaluation.isAutoApproved ? 'approved' : 'pending_approval',
          approvalTier: evaluation.tier,
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Entity Match Confirmed', `${target.invoiceNumber} linked to ${p.name}`, 'intake', 'success', invoiceId);
  };

  const rerunExtraction = (invoiceId: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'EXTRACTION_RE-RUN',
      description: `AI OCR extraction re-executed by ${currentUser.name}. Confidence elevated to 94%.`,
      user: currentUser.name,
      role: currentProfile.id,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          confidenceScore: 94,
          status: 'extracted',
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('OCR Extraction Re-Run', `${target.invoiceNumber} re-parsed successfully`, 'intake', 'info', invoiceId);
  };

  const updateExtractedInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return { ...inv, ...updates };
      })
    );
  };

  const addNewInvoice = (data: Partial<Invoice>): string => {
    const newId = data.id || `inv-${Date.now().toString().slice(-4)}`;
    const prop = properties.find((p) => p.id === data.propertyId) || properties[0];
    const vend = vendors.find((v) => v.id === data.vendorId) || vendors[0];
    const amount = data.amount || 1200;

    const evaluation = evaluatePolicyForInvoice(amount, prop ? prop.id : '', 92);

    const newInvoice: Invoice = {
      id: newId,
      invoiceNumber: data.invoiceNumber || `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      accountNumber: data.accountNumber || (vend ? vend.accountNumber : 'ACC-1000'),
      vendorId: vend ? vend.id : '',
      vendorName: vend ? vend.name : '',
      propertyId: prop ? prop.id : '',
      propertyName: prop ? prop.name : '',
      issueDate: data.issueDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      subtotal: amount,
      tax: 0,
      amount,
      status: evaluation.isAutoApproved ? 'approved' : 'pending_approval',
      confidenceScore: 92,
      approvalTier: evaluation.tier,
      intakeMethod: data.intakeMethod || 'pdf_upload',
      documentType: 'operational',
      notes: data.notes || 'Submitted via Bill Intake upload modal.',
      lineItems: data.lineItems || [
        {
          id: `li-${Date.now()}-1`,
          description: 'Commercial Service Fee',
          quantity: 1,
          unitRate: amount,
          amount,
          glCode: '6100-MAINT',
        },
      ],
      paymentInfo: {
        method: (vend?.defaultPaymentMethod as PaymentMethod) || 'CREDIT_CARD',
        status: 'unpaid',
      },
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
          eventType: 'INTAKE_UPLOADED',
          description: `Uploaded and extracted by ${currentUser.name} via intake workspace.`,
          user: currentUser.name,
          role: currentProfile.id,
        },
      ],
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    setSelectedInvoiceId(newId);

    addActivity(
      'New Invoice Ingested',
      `${newInvoice.invoiceNumber} ($${amount.toLocaleString()}) parsed and ready for verification`,
      'intake',
      'info',
      newId
    );

    return newId;
  };

  return {
    invoices,
    selectedInvoiceId,
    setSelectedInvoiceId,
    selectedInvoice,
    activities,
    approveInvoice,
    rejectInvoice,
    requestReevaluation,
    dismissDuplicate,
    resolveException,
    executeStripePayment,
    batchExecutePayments,
    confirmMatch,
    rerunExtraction,
    updateExtractedInvoice,
    addNewInvoice,
  };
}
