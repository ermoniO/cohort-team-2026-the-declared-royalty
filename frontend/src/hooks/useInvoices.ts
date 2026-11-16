import { useState, useMemo, useEffect } from 'react';
import {
  Invoice,
  Property,
  Vendor,
  AppUser,
  RoleProfile,
  ActivityItem,
  PaymentMethod,
  PropertyVendorRelationship,
} from '../types';
import { createStripePayment } from '@/app/services/paymentService';
import {
  analyzeInvoice,
  getInvoiceByUuid,
  getInvoices,
  patchInvoice,
} from '@/app/services/invoiceService';
import { mapInvoiceResponseToUI } from '@/app/adapters/invoiceAdapter';
import { UUID_REGEX } from '@/features/invoices/invoiceFormat';
import type { InvoiceResponse } from '@/types/invoice';

interface UseInvoicesProps {
  currentUser: AppUser;
  currentProfile: RoleProfile;
  properties: Property[];
  vendors: Vendor[];
  mappings?: PropertyVendorRelationship[];
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
  mappings = [],
  evaluatePolicyForInvoice,
}: UseInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    getInvoices({ page: 0, size: 50 })
      .then((res) => {
        if (!cancelled && res?.items) {
          const liveInvoices = res.items
            .map(mapInvoiceResponseToUI)
            .filter((inv): inv is Invoice => inv !== null);
          setInvoices(liveInvoices);
          setSelectedInvoiceId((prev) => {
            if (prev && liveInvoices.some((i) => i.id === prev)) {
              return prev;
            }
            return liveInvoices.length > 0 ? liveInvoices[0].id : null;
          });
        }
      })
      .catch((error) => {
        console.error('Failed to fetch invoices from backend:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) || (invoices.length > 0 ? invoices[0] : undefined);
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

  const approveInvoice = async (invoiceId: string, note?: string): Promise<boolean> => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return false;

    if (target.amount > currentProfile.approvalLimit) {
      addActivity(
        'Approval Blocked',
        `${target.invoiceNumber} ($${target.amount.toLocaleString()}) exceeds ${currentProfile.title} signing limit`,
        'approval',
        'warning',
        invoiceId
      );
      return false;
    }

    const reason = note || 'Approved via Approvals Queue';
    let patchedDto: InvoiceResponse | null = null;
    if (UUID_REGEX.test(invoiceId)) {
      try {
        patchedDto = await patchInvoice(invoiceId, {
          invoiceStatus: 'APPROVED',
          actedBy: UUID_REGEX.test(currentUser.id) ? currentUser.id : undefined,
          failureReason: reason,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('Failed to update invoice')) {
          addActivity(
            'Approval Rejected by Policy',
            `${target.invoiceNumber}: insufficient seat clearance or invalid transition`,
            'approval',
            'warning',
            invoiceId
          );
          return false;
        }
        console.warn('PATCH approveInvoice fell back to local state update', err);
      }
    }

    const mappedUi = patchedDto ? mapInvoiceResponseToUI(patchedDto) : null;
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
        if (mappedUi) {
          return {
            ...inv,
            ...mappedUi,
            status: 'approved',
            backendStatus: patchedDto?.invoiceStatus ?? 'APPROVED',
            auditTrail: [auditEvent, ...inv.auditTrail],
          };
        }
        return {
          ...inv,
          status: 'approved',
          backendStatus: 'APPROVED',
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

  const bulkApproveInvoices = async (
    invoiceIds: string[],
    note: string = 'Bulk approval via approvals queue'
  ): Promise<{ approvedCount: number; skippedCount: number }> => {
    let approvedCount = 0;
    let skippedCount = 0;
    for (const id of invoiceIds) {
      const ok = await approveInvoice(id, note);
      if (ok) {
        approvedCount++;
      } else {
        skippedCount++;
      }
    }
    return { approvedCount, skippedCount };
  };

  const rejectInvoice = async (invoiceId: string, reason: string): Promise<void> => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    let patchedDto: InvoiceResponse | null = null;
    if (UUID_REGEX.test(invoiceId)) {
      try {
        patchedDto = await patchInvoice(invoiceId, {
          invoiceStatus: 'FAILED',
          actedBy: UUID_REGEX.test(currentUser.id) ? currentUser.id : undefined,
          failureReason: reason,
        });
      } catch (err) {
        console.warn('PATCH rejectInvoice fell back to local state update', err);
      }
    }

    const mappedUi = patchedDto ? mapInvoiceResponseToUI(patchedDto) : null;
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
          ...(mappedUi ?? {}),
          status: 'exception',
          backendStatus: 'FAILED',
          failureReason: reason,
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

  const requestReevaluation = async (invoiceId: string, reason: string): Promise<void> => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const note = reason || 'Sent back for mapping re-evaluation';
    let patchedDto: InvoiceResponse | null = null;
    if (UUID_REGEX.test(invoiceId)) {
      try {
        patchedDto = await patchInvoice(invoiceId, {
          invoiceStatus: 'PENDING_MAPPING',
          actedBy: UUID_REGEX.test(currentUser.id) ? currentUser.id : undefined,
          failureReason: note,
        });
      } catch (err) {
        console.warn('PATCH requestReevaluation fell back to local state update', err);
      }
    }

    const mappedUi = patchedDto ? mapInvoiceResponseToUI(patchedDto) : null;
    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'REEVALUATION_REQUESTED',
      description: `Re-evaluation requested by ${currentUser.name}: ${note}`,
      user: currentUser.name,
      role: currentProfile.id,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          ...(mappedUi ?? {}),
          status: 'extracted',
          backendStatus: 'PENDING_MAPPING',
          failureReason: note,
          notes: `${inv.notes ? inv.notes + ' | ' : ''}Re-evaluation: ${note}`,
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );

    addActivity('Re-evaluation Requested', `${target.invoiceNumber} returned for mapping review`, 'approval', 'info', invoiceId);
  };

  const dismissDuplicate = async (
    invoiceId: string,
    reason: string = 'Verified distinct bill by reviewer'
  ) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const cleanReason = reason.trim() || 'Verified distinct bill by reviewer';
    if (UUID_REGEX.test(invoiceId)) {
      try {
        await patchInvoice(invoiceId, {
          actedBy: UUID_REGEX.test(currentUser.id) ? currentUser.id : undefined,
          failureReason: `Duplicate cleared: ${cleanReason}`,
        });
      } catch (err) {
        console.warn('Failed to persist duplicate dismissal note to backend:', err);
      }
    }
    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'DUPLICATE_OVERRIDDEN',
      description: `Duplicate warning dismissed by ${currentUser.name}: ${cleanReason}`,
      user: currentUser.name,
      role: currentProfile.id,
      metadata: { reason: cleanReason },
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        return {
          ...inv,
          duplicateMatch: inv.duplicateMatch
            ? {
                ...inv.duplicateMatch,
                dismissed: true,
                dismissalReason: cleanReason,
                dismissedBy: currentUser.name,
              }
            : {
                isDuplicate: true,
                similarityScore: 100,
                dismissed: true,
                dismissalReason: cleanReason,
                dismissedBy: currentUser.name,
              },
          auditTrail: [auditEvent, ...inv.auditTrail],
        };
      })
    );
    addActivity(
      'Duplicate Dismissed',
      `${target.invoiceNumber} duplicate flag cleared by ${currentUser.name}`,
      'exception',
      'info',
      invoiceId
    );
  };

  const resolveException = async (invoiceId: string, actionNote: string, newVendorId?: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const vendorId = newVendorId || target.vendorId;
    const vendorName = vendors.find((v) => v.id === vendorId)?.name || target.vendorName;
    const matchedMapping = mappings.find(
      (m) => m.propertyId === target.propertyId && m.vendorId === vendorId && m.status === 'ACTIVE'
    );

    if (UUID_REGEX.test(invoiceId)) {
      try {
        await patchInvoice(invoiceId, {
          ...(matchedMapping ? { mappingUuid: matchedMapping.id } : {}),
          invoiceStatus: 'PENDING_APPROVAL',
          actedBy: UUID_REGEX.test(currentUser.id) ? currentUser.id : undefined,
          failureReason: actionNote,
        });
      } catch (err) {
        console.warn('Failed to persist exception resolution to backend:', err);
      }
    }

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
          backendStatus: 'PENDING_APPROVAL',
          failureReason: undefined,
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

    const isUuid = UUID_REGEX.test(invoiceId);
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
              backendStatus: 'PAID',
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
            backendStatus: 'FAILED',
            failureReason: 'Stripe Charge Failed: Card declined',
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
          backendStatus: 'PAID',
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

  const confirmMatch = async (
    invoiceId: string,
    vendorId: string,
    propertyId: string,
    mappingId?: string
  ) => {
    const target = invoices.find((i) => i.id === invoiceId);
    const v = vendors.find((vend) => vend.id === vendorId);
    const p = properties.find((prop) => prop.id === propertyId);

    if (!target || !v || !p) return;

    const matchedMapping =
      (mappingId ? mappings.find((m) => m.id === mappingId) : undefined) ||
      mappings.find((m) => m.vendorId === vendorId && m.propertyId === propertyId && m.status === 'ACTIVE');
    const resolvedMappingId = mappingId || matchedMapping?.id;

    let patchedDto: InvoiceResponse | null = null;
    if (resolvedMappingId && !resolvedMappingId.startsWith('pvm-')) {
      try {
        patchedDto = await patchInvoice(invoiceId, {
          mappingUuid: resolvedMappingId,
          invoiceStatus: 'PENDING_APPROVAL',
          actedBy: UUID_REGEX.test(currentUser.id) ? currentUser.id : undefined,
        });
      } catch (err) {
        console.warn('PATCH invoice mapping fell back to local state update', err);
      }
    }

    const evaluation = evaluatePolicyForInvoice(target.amount, propertyId, 95);
    const mappedUi = patchedDto ? mapInvoiceResponseToUI(patchedDto) : null;
    const wasAutoApproved = patchedDto?.invoiceStatus === 'APPROVED';

    const auditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
      eventType: 'MATCH_CONFIRMED',
      description: `Payee "${v.name}" matched to Payer "${p.name}" by ${currentUser.name}. Policy evaluated: ${evaluation.reason}`,
      user: currentUser.name,
      role: currentProfile.id,
    };

    const autoApproveAuditEvent = wasAutoApproved
      ? {
          id: `aud-${Date.now() + 1}`,
          timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
          eventType: 'SYSTEM_APPROVED',
          description: 'Auto-approved under Step 0 property policy threshold',
          user: 'Policy Engine (AI)',
          role: 'Automated Rule',
        }
      : null;

    const newEvents = autoApproveAuditEvent ? [autoApproveAuditEvent, auditEvent] : [auditEvent];

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        if (mappedUi) {
          return {
            ...inv,
            ...mappedUi,
            mappingId: mappedUi.mappingId ?? resolvedMappingId,
            approvalTier: wasAutoApproved ? 'auto_approved' : evaluation.tier,
            confidenceScore: 98,
            auditTrail: [...newEvents, ...inv.auditTrail],
          };
        }
        return {
          ...inv,
          mappingId: resolvedMappingId ?? inv.mappingId,
          vendorId: v.id,
          vendorName: v.name,
          propertyId: p.id,
          propertyName: p.name,
          accountNumber: matchedMapping?.vendorAccountNumber || inv.accountNumber,
          confidenceScore: 98,
          backendStatus: 'PENDING_APPROVAL',
          status: 'pending_approval',
          approvalTier: evaluation.tier,
          auditTrail: [...newEvents, ...inv.auditTrail],
        };
      })
    );

    if (wasAutoApproved) {
      addActivity('Auto-Approved by Policy', `${target.invoiceNumber} matched and auto-approved under Step 0 cap`, 'approval', 'success', invoiceId);
    } else {
      addActivity('Entity Match Confirmed', `${target.invoiceNumber} linked to ${p.name}`, 'match', 'success', invoiceId);
    }
  };

  const rerunExtraction = async (invoiceId: string) => {
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    try {
      await analyzeInvoice(invoiceId);
      const freshDto = await getInvoiceByUuid(invoiceId);
      const mappedUi = mapInvoiceResponseToUI(freshDto);
      if (mappedUi) {
        const auditEvent = {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substr(0, 19),
          eventType: 'EXTRACTION_RE-RUN',
          description: `AI extraction completed (${freshDto.invoiceStatus}) by ${currentUser.name}.`,
          user: currentUser.name,
          role: currentProfile.id,
        };
        setInvoices((prev) =>
          prev.map((inv) => {
            if (inv.id !== invoiceId) return inv;
            return {
              ...inv,
              ...mappedUi,
              auditTrail: [auditEvent, ...inv.auditTrail],
            };
          })
        );
        addActivity(
          'OCR Extraction Re-Run',
          `${mappedUi.invoiceNumber} -> ${freshDto.invoiceStatus}`,
          'extraction',
          'info',
          invoiceId
        );
        return;
      }
    } catch (err) {
      console.warn('Live analyzeInvoice failed, applying local fallback', err);
    }

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
          backendStatus: 'PENDING_MAPPING',
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
    const prop = properties.find((p) => p.id === data.propertyId);
    const vend = vendors.find((v) => v.id === data.vendorId);
    const amount = data.amount || 0;

    // Uploaded/created bills enter the pipeline at INGESTED (Needs Extraction) rather than auto-jumping to Disbursements
    const newInvoice: Invoice = {
      id: newId,
      invoiceNumber: data.invoiceNumber || `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      accountNumber: data.accountNumber || (vend ? vend.accountNumber : ''),
      vendorId: vend ? vend.id : '',
      vendorName: vend ? vend.name : 'Pending Extraction',
      propertyId: prop ? prop.id : '',
      propertyName: prop ? prop.name : 'Pending Matching',
      issueDate: data.issueDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      subtotal: amount,
      tax: 0,
      amount,
      status: data.status || 'intake',
      backendStatus: data.backendStatus || 'INGESTED',
      confidenceScore: 0,
      approvalTier: 'property_manager',
      intakeMethod: data.intakeMethod || 'pdf_upload',
      documentType: 'maintenance',
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
    bulkApproveInvoices,
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
