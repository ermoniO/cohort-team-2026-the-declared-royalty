import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  Invoice,
  Property,
  Vendor,
  PayerPolicy,
  UserRole,
  NavTab,
  ActivityItem,
  RoleProfile,
  AuditEvent
} from '../types';
import {
  INITIAL_INVOICES,
  INITIAL_PROPERTIES,
  INITIAL_VENDORS,
  INITIAL_ACTIVITIES,
  COMPANY_DEFAULT_POLICY,
  ROLE_PROFILES
} from '../data/mockData';

interface InvoiceContextType {
  activeRole: UserRole;
  currentProfile: RoleProfile;
  setActiveRole: (role: UserRole) => void;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  invoices: Invoice[];
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: (id: string | null) => void;
  selectedInvoice: Invoice | undefined;
  properties: Property[];
  vendors: Vendor[];
  companyPolicy: PayerPolicy;
  activities: ActivityItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  propertyFilter: string;
  setPropertyFilter: (p: string) => void;
  approveInvoice: (invoiceId: string, note?: string) => boolean;
  rejectInvoice: (invoiceId: string, reason: string) => void;
  requestReevaluation: (invoiceId: string, reason: string) => void;
  dismissDuplicate: (invoiceId: string, reason: string) => void;
  resolveException: (invoiceId: string, actionNote: string, newVendorId?: string) => void;
  updatePropertyPolicy: (propertyId: string, policy: Partial<PayerPolicy>) => void;
  updateCompanyPolicy: (policy: Partial<PayerPolicy>) => void;
  executeStripePayment: (invoiceId: string, testCardType?: 'success' | 'decline' | 'insufficient') => Promise<{ success: boolean; message: string; chargeId?: string }>;
  batchExecutePayments: (invoiceIds: string[]) => Promise<{ processed: number; succeeded: number }>;
  confirmMatch: (invoiceId: string, vendorId: string, propertyId: string) => void;
  rerunExtraction: (invoiceId: string) => void;
  updateExtractedInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  addNewInvoice: (newInvoiceData: Partial<Invoice>) => string;
  evaluatePolicyForInvoice: (amount: number, propertyId: string, confidence: number) => {
    isAutoApproved: boolean;
    tier: 'auto_approved' | 'property_manager' | 'vp_finance';
    effectiveMaxAmount: number;
    requiresHumanReview: boolean;
    reason: string;
  };
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);

export const InvoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('ap_specialist');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>('inv-001');
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [companyPolicy, setCompanyPolicy] = useState<PayerPolicy>(COMPANY_DEFAULT_POLICY);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const currentProfile = ROLE_PROFILES[activeRole];

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0];
  }, [invoices, selectedInvoiceId]);

  const addActivity = (title: string, subtitle: string, type: ActivityItem['type'], status: ActivityItem['status'], invoiceId?: string) => {
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

  const evaluatePolicyForInvoice = (amount: number, propertyId: string, confidence: number) => {
    const prop = properties.find((p) => p.id === propertyId);
    const policy = prop?.hasCustomPolicy ? prop.policy : companyPolicy;
    const effectiveMaxAmount = policy.maxAutoApproveAmount;
    const minConfidence = policy.minConfidenceScore;

    if (confidence < minConfidence) {
      return {
        isAutoApproved: false,
        tier: amount > 10000 ? ('vp_finance' as const) : ('property_manager' as const),
        effectiveMaxAmount,
        requiresHumanReview: true,
        reason: `Confidence score (${confidence}%) is below minimum required (${minConfidence}%).`,
      };
    }

    if (amount <= effectiveMaxAmount) {
      return {
        isAutoApproved: true,
        tier: 'auto_approved' as const,
        effectiveMaxAmount,
        requiresHumanReview: false,
        reason: `Amount $${amount.toLocaleString()} is within automated policy limit of $${effectiveMaxAmount.toLocaleString()}.`,
      };
    }

    if (amount <= 10000) {
      return {
        isAutoApproved: false,
        tier: 'property_manager' as const,
        effectiveMaxAmount,
        requiresHumanReview: true,
        reason: `Amount $${amount.toLocaleString()} exceeds auto-approval limit ($${effectiveMaxAmount.toLocaleString()}). Requires Property Manager approval.`,
      };
    }

    return {
      isAutoApproved: false,
      tier: 'vp_finance' as const,
      effectiveMaxAmount,
      requiresHumanReview: true,
      reason: `Amount $${amount.toLocaleString()} exceeds executive limit ($10,000.00). Requires VP Finance approval.`,
    };
  };

  const approveInvoice = (invoiceId: string, note?: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return false;

    // Privilege check
    if (currentProfile.approvalLimit > 0 && target.amount > currentProfile.approvalLimit) {
      alert(`Permission Denied: Your role (${currentProfile.title}) has a maximum approval authority of $${currentProfile.approvalLimit.toLocaleString()}. This invoice requires higher-tier executive authorization.`);
      return false;
    }

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'APPROVAL_GRANTED',
      description: `Approval granted by ${currentProfile.userName} (${currentProfile.title}). ${note ? `Note: ${note}` : ''}`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'approved',
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Invoice Approved',
      `${target.invoiceNumber} ($${target.amount.toLocaleString()}) approved by ${currentProfile.userName}`,
      'approval',
      'success',
      invoiceId
    );

    return true;
  };

  const rejectInvoice = (invoiceId: string, reason: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return;

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'APPROVAL_REJECTED',
      description: `Invoice rejected by ${currentProfile.userName}. Reason: ${reason}`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'exception',
            exception: {
              type: 'policy_limit_exceeded',
              message: `Approval rejected: ${reason}`,
              assignedTo: currentProfile.userName,
              resolved: false,
            },
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Invoice Rejected',
      `${target.invoiceNumber} rejected: ${reason}`,
      'exception',
      'error',
      invoiceId
    );
  };

  const requestReevaluation = (invoiceId: string, reason: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return;

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'REEVALUATION_REQUESTED',
      description: `Re-evaluation requested by ${currentProfile.userName}: ${reason}`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'extracted',
            confidenceScore: Math.min(inv.confidenceScore, 75),
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Re-evaluation Requested',
      `${target.invoiceNumber} returned to matching & verification queue`,
      'extraction',
      'warning',
      invoiceId
    );
  };

  const dismissDuplicate = (invoiceId: string, reason: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target || !target.duplicateMatch) return;

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'DUPLICATE_OVERRIDDEN',
      description: `Duplicate flag dismissed by ${currentProfile.userName}. Reason: ${reason}`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId && inv.duplicateMatch) {
          return {
            ...inv,
            duplicateMatch: {
              ...inv.duplicateMatch,
              dismissed: true,
              dismissalReason: reason,
              dismissedBy: currentProfile.userName,
            },
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Duplicate Flag Cleared',
      `${target.invoiceNumber} duplicate flag dismissed with verified explanation`,
      'approval',
      'info',
      invoiceId
    );
  };

  const resolveException = (invoiceId: string, actionNote: string, newVendorId?: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return;

    let updatedVendorName = target.vendorName;
    if (newVendorId) {
      const v = vendors.find((vend) => vend.id === newVendorId);
      if (v) updatedVendorName = v.name;
    }

    const evaluation = evaluatePolicyForInvoice(target.amount, target.propertyId, 95);

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'EXCEPTION_RESOLVED',
      description: `Exception resolved by ${currentProfile.userName}. Note: ${actionNote}`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            vendorId: newVendorId || inv.vendorId,
            vendorName: updatedVendorName,
            status: evaluation.isAutoApproved ? 'approved' : 'pending_approval',
            approvalTier: evaluation.tier,
            confidenceScore: 95,
            exception: undefined,
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Exception Resolved',
      `${target.invoiceNumber} successfully triaged: ${actionNote}`,
      'exception',
      'success',
      invoiceId
    );
  };

  const updatePropertyPolicy = (propertyId: string, policyUpdates: Partial<PayerPolicy>) => {
    setProperties((prev) =>
      prev.map((prop) => {
        if (prop.id === propertyId) {
          return {
            ...prop,
            hasCustomPolicy: true,
            policy: {
              ...prop.policy,
              ...policyUpdates,
            },
          };
        }
        return prop;
      })
    );

    const propName = properties.find((p) => p.id === propertyId)?.name || propertyId;
    addActivity(
      'Property Policy Updated',
      `Custom automation policy thresholds saved for ${propName}`,
      'policy',
      'info'
    );
  };

  const updateCompanyPolicy = (policyUpdates: Partial<PayerPolicy>) => {
    setCompanyPolicy((prev) => ({
      ...prev,
      ...policyUpdates,
    }));

    addActivity(
      'Company Baseline Policy Updated',
      `Default auto-approval threshold set to $${(policyUpdates.maxAutoApproveAmount || companyPolicy.maxAutoApproveAmount).toLocaleString()}`,
      'policy',
      'info'
    );
  };

  const executeStripePayment = async (
    invoiceId: string,
    testCardType: 'success' | 'decline' | 'insufficient' = 'success'
  ): Promise<{ success: boolean; message: string; chargeId?: string }> => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return { success: false, message: 'Invoice not found.' };

    // Update status to processing
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            paymentInfo: {
              ...(inv.paymentInfo || { method: 'stripe_test_cc' }),
              status: 'processing',
            },
          };
        }
        return inv;
      })
    );

    // Simulate network latency (800ms)
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (testCardType === 'decline') {
      const failAudit: AuditEvent = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        eventType: 'PAYMENT_DECLINED',
        description: `Stripe Test Payment declined: Card generic_decline code 05.`,
        user: currentProfile.userName,
        role: activeRole,
      };

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === invoiceId) {
            return {
              ...inv,
              status: 'exception',
              exception: {
                type: 'payment_failed',
                message: 'Stripe transaction declined: generic_decline. Contact issuing institution or retry.',
                assignedTo: currentProfile.userName,
                resolved: false,
              },
              paymentInfo: {
                method: 'stripe_test_cc',
                status: 'declined',
                failureReason: 'Card issuer declined charge (test card simulation)',
              },
              auditTrail: [...inv.auditTrail, failAudit],
            };
          }
          return inv;
        })
      );

      addActivity(
        'Payment Declined',
        `Stripe Test charge for ${target.invoiceNumber} ($${target.amount.toLocaleString()}) was declined`,
        'payment',
        'error',
        invoiceId
      );

      return { success: false, message: 'Card was declined by card issuer.' };
    }

    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const chargeId = `ch_3M${Date.now().toString(36)}${randomSuffix}`;
    const authCode = `AUTH_${Math.floor(10000 + Math.random() * 90000)}`;
    const paidAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const successAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: paidAt,
      eventType: 'PAYMENT_EXECUTED',
      description: `Payment of $${target.amount.toLocaleString()} settled via Stripe TEST CC (•••• 4242). Charge Ref: ${chargeId}. Auth: ${authCode}.`,
      user: currentProfile.userName,
      role: activeRole,
      metadata: {
        chargeId,
        authCode,
        amount: target.amount,
        cardLast4: '4242',
      },
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            status: 'paid',
            paymentInfo: {
              method: 'stripe_test_cc',
              status: 'succeeded',
              transactionRef: chargeId,
              authCode,
              paidAt,
              cardLast4: '4242',
            },
            auditTrail: [...inv.auditTrail, successAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Payment Succeeded via Stripe Test CC',
      `${target.invoiceNumber} ($${target.amount.toLocaleString()}) charged to •••• 4242 (${chargeId})`,
      'payment',
      'success',
      invoiceId
    );

    return {
      success: true,
      message: `Payment authorized and settled! Transaction Ref: ${chargeId}`,
      chargeId,
    };
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
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return;

    const v = vendors.find((vend) => vend.id === vendorId);
    const p = properties.find((prop) => prop.id === propertyId);
    if (!v || !p) return;

    const evaluation = evaluatePolicyForInvoice(target.amount, propertyId, 95);

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'MATCH_CONFIRMED',
      description: `Payee "${v.name}" matched to Payer "${p.name}" by ${currentProfile.userName}. Policy evaluated: ${evaluation.reason}`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            vendorId,
            vendorName: v.name,
            propertyId,
            propertyName: p.name,
            confidenceScore: 98,
            status: evaluation.isAutoApproved ? 'approved' : 'pending_approval',
            approvalTier: evaluation.tier,
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'Match Confirmed & Policy Checked',
      `${v.name} ➔ ${p.name}: ${evaluation.reason}`,
      'match',
      'success',
      invoiceId
    );
  };

  const rerunExtraction = (invoiceId: string) => {
    const target = invoices.find((inv) => inv.id === invoiceId);
    if (!target) return;

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      eventType: 'AI_EXTRACTION_RERUN',
      description: `Re-ran AI OCR extraction. All line items re-indexed with updated confidence scoring.`,
      user: currentProfile.userName,
      role: activeRole,
    };

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            confidenceScore: 97,
            auditTrail: [...inv.auditTrail, newAudit],
          };
        }
        return inv;
      })
    );

    addActivity(
      'AI Extraction Refreshed',
      `Re-parsed document ${target.invoiceNumber}. Confidence updated to 97%`,
      'extraction',
      'info',
      invoiceId
    );
  };

  const updateExtractedInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const updated = { ...inv, ...updates };
          if (updates.subtotal !== undefined || updates.tax !== undefined) {
            const sub = updates.subtotal !== undefined ? updates.subtotal : inv.subtotal;
            const tax = updates.tax !== undefined ? updates.tax : inv.tax;
            updated.amount = Number((sub + tax).toFixed(2));
          }
          return updated;
        }
        return inv;
      })
    );
  };

  const addNewInvoice = (data: Partial<Invoice>): string => {
    const newId = `inv-${Date.now()}`;
    const invoiceNumber = data.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const vendor = vendors.find((v) => v.id === data.vendorId) || vendors[0];
    const property = properties.find((p) => p.id === data.propertyId) || properties[0];
    const amount = data.amount || 850.00;

    const evaluation = evaluatePolicyForInvoice(amount, property.id, 92);

    const newInv: Invoice = {
      id: newId,
      invoiceNumber,
      accountNumber: data.accountNumber || vendor.accountNumber,
      vendorId: vendor.id,
      vendorName: vendor.name,
      propertyId: property.id,
      propertyName: property.name,
      issueDate: data.issueDate || new Date().toISOString().substring(0, 10),
      dueDate: data.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
      subtotal: Number((amount * 0.92).toFixed(2)),
      tax: Number((amount * 0.08).toFixed(2)),
      amount,
      status: 'extracted',
      confidenceScore: 92,
      approvalTier: evaluation.tier,
      intakeMethod: data.intakeMethod || 'pdf_upload',
      documentType: data.documentType || 'maintenance',
      notes: data.notes || 'Newly ingested commercial invoice.',
      lineItems: data.lineItems || [
        { id: 'li-new-1', description: 'General commercial property maintenance & service', quantity: 1, unitRate: amount, amount },
      ],
      paymentInfo: {
        method: vendor.defaultPaymentMethod,
        status: 'unpaid',
      },
      auditTrail: [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          eventType: 'INTAKE_UPLOADED',
          description: `Uploaded and extracted by ${currentProfile.userName} via intake workspace.`,
          user: currentProfile.userName,
          role: activeRole,
        },
      ],
    };

    setInvoices((prev) => [newInv, ...prev]);
    setSelectedInvoiceId(newId);
    setActiveTab('intake');

    addActivity(
      'New Invoice Ingested',
      `${invoiceNumber} ($${amount.toLocaleString()}) parsed and ready for verification`,
      'intake',
      'info',
      newId
    );

    return newId;
  };

  return (
    <InvoiceContext.Provider
      value={{
        activeRole,
        currentProfile,
        setActiveRole,
        activeTab,
        setActiveTab,
        invoices,
        selectedInvoiceId,
        setSelectedInvoiceId,
        selectedInvoice,
        properties,
        vendors,
        companyPolicy,
        activities,
        searchQuery,
        setSearchQuery,
        propertyFilter,
        setPropertyFilter,
        approveInvoice,
        rejectInvoice,
        requestReevaluation,
        dismissDuplicate,
        resolveException,
        updatePropertyPolicy,
        updateCompanyPolicy,
        executeStripePayment,
        batchExecutePayments,
        confirmMatch,
        rerunExtraction,
        updateExtractedInvoice,
        addNewInvoice,
        evaluatePolicyForInvoice,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
};

export const useInvoiceStore = () => {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoiceStore must be used within an InvoiceProvider');
  }
  return context;
};
