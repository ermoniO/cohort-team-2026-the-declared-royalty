import { useState, useMemo } from 'react';
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
          status: 'extracted',
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Re-evaluation Requested', `${target.invoiceNumber} returned to extraction`, 'intake', 'info', invoiceId);
  };

  const dismissDuplicate = (invoiceId: string, reason: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'DUPLICATE_DISMISSED',
      description: `Duplicate flag dismissed by ${currentUser.name}. Reason: ${reason}`,
      user: currentUser.name,
      role: currentProfile.id,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          duplicateMatch: inv.duplicateMatch
            ? {
                ...inv.duplicateMatch,
                isDuplicate: false,
                dismissed: true,
                dismissalReason: reason,
                dismissedBy: currentUser.name,
              }
            : undefined,
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Duplicate Warning Cleared', `${target.invoiceNumber} marked as valid`, 'approval', 'info', invoiceId);
  };

  const resolveException = (invoiceId: string, actionNote: string, newVendorId?: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    let vendorName = target.vendorName;
    let vendorId = target.vendorId;

    if (newVendorId) {
      const v = vendors.find((vend) => vend.id === newVendorId);
      if (v) {
        vendorName = v.name;
        vendorId = v.id;
      }
    }

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'EXCEPTION_RESOLVED',
      description: `Exception resolved by ${currentUser.name}. Note: ${actionNote}`,
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
    const newId = `inv-${Date.now().toString().slice(-4)}`;
    const prop = properties.find((p) => p.id === data.propertyId) || properties[0];
    const vend = vendors.find((v) => v.id === data.vendorId) || vendors[0];
    const amount = data.amount || 1200;

    const evaluation = evaluatePolicyForInvoice(amount, prop.id, 92);

    const newInvoice: Invoice = {
      id: newId,
      invoiceNumber: data.invoiceNumber || `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      accountNumber: data.accountNumber || vend.accountNumber,
      vendorId: vend.id,
      vendorName: vend.name,
      propertyId: prop.id,
      propertyName: prop.name,
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
        method: vend.defaultPaymentMethod as PaymentMethod,
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

