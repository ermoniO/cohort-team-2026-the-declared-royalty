import React, { useEffect, useMemo, useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice } from '../types';
import type { ApprovalQueueStepResponse } from '@/types/api';
import { getApprovalQueue } from '@/app/services/approvalMatrixService';
import { useAuditHistory } from '@/features/auditLogs/useAuditHistory';
import { getInvoiceCostType, UUID_REGEX } from '@/features/invoices/invoiceFormat';
import { resolveKnownUserId } from '@/features/users/userDisplay';
import { InvoiceStateStepper } from './InvoiceStateStepper';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Copy,
  Building2,
  X,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface InvoiceClearingSummary {
  clearingStep: ApprovalQueueStepResponse | null;
  requiredSeatSlug: string | null;
  requiredSeatLabel: string | null;
  assignedApproverUuid: string | null;
  assignedApproverName: string;
  isProxy: boolean;
  isVacant: boolean;
  thresholdSlug: string | null;
  effectiveStepLimit: number;
  canCurrentUserApprove: boolean;
}

function stepEffectiveLimit(
  step: ApprovalQueueStepResponse,
  costType: 'FIXED_MONTHLY' | 'VARIABLE'
): number {
  if (step.thresholdSlug === 'LIMIT_UNLIMITED') return Infinity;
  if (step.thresholdSlug === 'LIMIT_NONE') return 0;
  return costType === 'FIXED_MONTHLY' ? step.fixedAutoMax : step.variableMax;
}

/**
 * Resolves the required property-matrix clearing seat, assigned/proxy occupant,
 * and whether the active user holds sufficient signing authority for this invoice.
 */
export function resolveInvoiceClearingSummary(
  steps: ApprovalQueueStepResponse[],
  currentUserId: string,
  roleLimit: number,
  invoiceAmount: number,
  costType: 'FIXED_MONTHLY' | 'VARIABLE' = 'VARIABLE'
): InvoiceClearingSummary {
  const roleCoversAmount =
    roleLimit === Infinity || (roleLimit > 0 && invoiceAmount <= roleLimit);

  if (!steps || steps.length === 0) {
    return {
      clearingStep: null,
      requiredSeatSlug: null,
      requiredSeatLabel: null,
      assignedApproverUuid: null,
      assignedApproverName: 'Unassigned',
      isProxy: false,
      isVacant: false,
      thresholdSlug: null,
      effectiveStepLimit: roleLimit,
      canCurrentUserApprove: roleCoversAmount,
    };
  }

  const clearingStep = steps[steps.length - 1];
  const effectiveStepLimit = stepEffectiveLimit(clearingStep, costType);

  const humanSteps = steps.filter((s) => s.sequence > 0);
  const matchingHumanSteps = humanSteps.filter(
    (s) => Boolean(s.userUuid) && s.userUuid === currentUserId
  );
  const userInHumanQueue = matchingHumanSteps.length > 0;
  const matchesAuthoritativeSeat = matchingHumanSteps.some(
    (s) => stepEffectiveLimit(s, costType) >= invoiceAmount
  );

  const canCurrentUserApprove = !roleCoversAmount
    ? false
    : userInHumanQueue
    ? matchesAuthoritativeSeat
    : true;

  return {
    clearingStep,
    requiredSeatSlug: clearingStep.seatSlug,
    requiredSeatLabel: clearingStep.seatDisplayName,
    assignedApproverUuid: clearingStep.userUuid ?? null,
    assignedApproverName: clearingStep.userName || 'Unassigned',
    isProxy: Boolean(clearingStep.isProxy),
    isVacant: Boolean(clearingStep.isVacant),
    thresholdSlug: clearingStep.thresholdSlug,
    effectiveStepLimit,
    canCurrentUserApprove,
  };
}

/**
 * Resolves the display identity (UUID when live, name, and seat/role) of the
 * approver responsible for clearing this invoice next.
 */
export function resolveExpectedApprover(
  invoice: Invoice,
  clearing: InvoiceClearingSummary
): {
  id?: string;
  name: string;
  role: string;
} {
  const name =
    clearing.clearingStep?.userName ||
    (invoice.approvalTier === 'vp_finance'
      ? 'Victoria Chen'
      : invoice.approvalTier === 'property_manager'
        ? 'Marcus Vance'
        : 'Elena Rostova');
  const role =
    clearing.requiredSeatLabel ||
    (invoice.approvalTier === 'vp_finance'
      ? 'VP Finance'
      : invoice.approvalTier === 'property_manager'
        ? 'Property Manager'
        : 'Corporate Accountant');
  return {
    id: clearing.assignedApproverUuid ?? resolveKnownUserId(name),
    name,
    role,
  };
}

const ApprovalsStepperRow: React.FC<{
  invoice: Invoice;
  onOpenAudit: () => void;
}> = ({ invoice, onOpenAudit }) => {
  const isUuid = UUID_REGEX.test(invoice.id);
  const { logs, actorFor } = useAuditHistory(isUuid ? invoice.id : undefined);
  const invoiceLogs = isUuid ? logs.filter((l) => l.invoice === invoice.id) : [];

  return (
    <tr className="bg-slate-50/90">
      <td colSpan={7} className="px-4 py-3 border-t border-slate-200">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800">
              Live State Stepper · {invoice.invoiceNumber}
            </span>
            <button
              type="button"
              onClick={onOpenAudit}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Open Full Audit Ledger →
            </button>
          </div>
          <InvoiceStateStepper
            invoice={invoice}
            auditLogs={invoiceLogs}
            actorFor={actorFor}
            compact
          />
        </div>
      </td>
    </tr>
  );
};

export const ApprovalsQueue: React.FC = () => {
  const {
    invoices,
    properties,
    mappings,
    approveInvoice,
    bulkApproveInvoices,
    rejectInvoice,
    requestReevaluation,
    dismissDuplicate,
    currentUser,
    currentProfile,
    setSelectedInvoiceId,
    setActiveTab,
  } = useInvoiceStore();

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<
    'all' | 'auto_approved' | 'property_manager' | 'vp_finance'
  >('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [routingByInvoiceId, setRoutingByInvoiceId] = useState<
    Record<string, ApprovalQueueStepResponse[]>
  >({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const [comparingDuplicateInvoice, setComparingDuplicateInvoice] =
    useState<Invoice | null>(null);
  const [rejectingInvoice, setRejectingInvoice] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [dismissReason, setDismissReason] = useState('');

  // Pending / approved invoices visible in Approvals Queue
  const pendingInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) => inv.status === 'pending_approval' || inv.status === 'approved'
      ),
    [invoices]
  );

  // Cost type lookup by invoice mapping
  const costTypeForInvoice = (inv: Invoice): 'FIXED_MONTHLY' | 'VARIABLE' => {
    const mapping =
      mappings.find((m) => inv.mappingId && m.id === inv.mappingId) ||
      mappings.find(
        (m) => m.propertyId === inv.propertyId && m.vendorId === inv.vendorId
      );
    return mapping?.costType === 'FIXED_MONTHLY' ? 'FIXED_MONTHLY' : 'VARIABLE';
  };

  // Fetch live per-property routing chains for pending UUID-backed invoices
  useEffect(() => {
    let cancelled = false;
    const targets = pendingInvoices.filter(
      (inv) => inv.propertyId && UUID_REGEX.test(inv.propertyId)
    );
    if (targets.length === 0) return;

    Promise.allSettled(
      targets.map(async (inv) => {
        const ct = costTypeForInvoice(inv);
        const queue = await getApprovalQueue(inv.propertyId, inv.amount, ct);
        return { invoiceId: inv.id, steps: queue.steps ?? [] };
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, ApprovalQueueStepResponse[]> = {};
      for (const res of results) {
        if (res.status === 'fulfilled') {
          next[res.value.invoiceId] = res.value.steps;
        }
      }
      setRoutingByInvoiceId((prev) => ({ ...prev, ...next }));
    });

    return () => {
      cancelled = true;
    };
  }, [pendingInvoices, mappings]);

  // Available properties in the queue for the property filter dropdown
  const propertyFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of properties) {
      map.set(p.id, p.name);
    }
    for (const inv of pendingInvoices) {
      if (inv.propertyId && inv.propertyName && !map.has(inv.propertyId)) {
        map.set(inv.propertyId, inv.propertyName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [properties, pendingInvoices]);

  const filteredInvoices = useMemo(
    () =>
      pendingInvoices.filter((inv) => {
        if (tierFilter !== 'all' && inv.approvalTier !== tierFilter) return false;
        if (
          selectedPropertyId !== 'all' &&
          inv.propertyId !== selectedPropertyId
        ) {
          return false;
        }
        return true;
      }),
    [pendingInvoices, tierFilter, selectedPropertyId]
  );

  // Flagged duplicate invoices
  const duplicateInvoices = invoices.filter(
    (inv) =>
      inv.duplicateMatch &&
      inv.duplicateMatch.isDuplicate &&
      !inv.duplicateMatch.dismissed
  );

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const showBanner = (
    type: 'success' | 'warning' | 'info',
    message: string
  ) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const handleApproveSingle = async (inv: Invoice) => {
    setIsSubmitting(true);
    try {
      const ok = await approveInvoice(inv.id);
      if (ok) {
        showBanner(
          'success',
          `${inv.invoiceNumber} ($${inv.amount.toLocaleString()}) approved by ${currentUser.name}.`
        );
      } else {
        showBanner(
          'warning',
          `Approval blocked for ${inv.invoiceNumber}: insufficient seat clearance or signing limit (${currentProfile.title}).`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedInvoices.length === 0) return;
    setIsSubmitting(true);
    try {
      const { approvedCount, skippedCount } = await bulkApproveInvoices(
        selectedInvoices,
        'Bulk approval via approvals queue'
      );
      setSelectedInvoices([]);
      if (approvedCount > 0 && skippedCount === 0) {
        showBanner(
          'success',
          `Authorized ${approvedCount} invoice${approvedCount === 1 ? '' : 's'} under ${currentUser.name}'s seat.`
        );
      } else if (approvedCount > 0) {
        showBanner(
          'info',
          `Authorized ${approvedCount} invoice${approvedCount === 1 ? '' : 's'}; ${skippedCount} skipped due to threshold limits.`
        );
      } else {
        showBanner(
          'warning',
          `No selected invoices could be approved under ${currentProfile.title}'s signing limit.`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingInvoice || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      await rejectInvoice(rejectingInvoice.id, rejectReason.trim());
      showBanner(
        'info',
        `${rejectingInvoice.invoiceNumber} rejected and routed to Exceptions.`
      );
      setRejectingInvoice(null);
      setRejectReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReevaluation = async (inv: Invoice) => {
    setIsSubmitting(true);
    try {
      await requestReevaluation(
        inv.id,
        'AP specialist requested mapping & field re-evaluation'
      );
      showBanner(
        'info',
        `${inv.invoiceNumber} returned to PENDING_MAPPING for re-evaluation.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDismissDuplicate = () => {
    if (!comparingDuplicateInvoice || !dismissReason.trim()) return;
    dismissDuplicate(comparingDuplicateInvoice.id, dismissReason.trim());
    setComparingDuplicateInvoice(null);
    setDismissReason('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Privilege Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            Duplicate Protection & Approvals Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tiered per-property approval matrix routing · Active signing authority:{' '}
            <span className="font-semibold text-slate-800">
              {currentUser.name} ({currentProfile.title})
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500">Signing Limit:</span>
          <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded">
            {currentProfile.approvalLimit === Infinity
              ? 'UNLIMITED'
              : currentProfile.approvalLimit === 0
              ? 'AUDIT ONLY'
              : `≤ $${currentProfile.approvalLimit.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {banner && (
        <div
          className={`px-4 py-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : banner.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}
        >
          <span>{banner.message}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-current/70 hover:text-current"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Duplicate Alert Card Banner (if duplicate exists) */}
      {duplicateInvoices.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Duplicate Protection Warning: {duplicateInvoices.length}{' '}
                  Suspicious Invoice Flagged
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Automated duplicate guard detected an invoice matching a
                  previously settled bill (identical vendor, scope, and dollar
                  amount within 30-day billing window).
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {duplicateInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => setComparingDuplicateInvoice(inv)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 text-amber-900 rounded-md hover:bg-amber-100/80 transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        Compare {inv.invoiceNumber} vs Settled Bill
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded">
              High Risk
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs, Property Selector & Bulk Actions Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tier Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tierFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Pending ({pendingInvoices.length})
            </button>
            <button
              onClick={() => setTierFilter('auto_approved')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tierFilter === 'auto_approved'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Auto-Approved (Under Policy)
            </button>
            <button
              onClick={() => setTierFilter('property_manager')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tierFilter === 'property_manager'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Requires Property Mgr (&gt;$1k)
            </button>
            <button
              onClick={() => setTierFilter('vp_finance')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                tierFilter === 'vp_finance'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Requires VP Finance (&gt;$10k)
            </button>
          </div>

          {/* Per-Property Matrix Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              aria-label="Filter by Property"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Properties</option>
              {propertyFilterOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedInvoices.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">
              {selectedInvoices.length} selected
            </span>
            <button
              disabled={isSubmitting}
              onClick={handleBulkApprove}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Authorizing...' : 'Authorize Selected'}
            </button>
          </div>
        )}
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selectedInvoices.length === filteredInvoices.length &&
                      filteredInvoices.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="rounded text-slate-900 accent-slate-900"
                  />
                </th>
                <th className="px-4 py-3">Invoice Details</th>
                <th className="px-4 py-3">Payer Property</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Matrix Seat &amp; Routing</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No invoices match the selected property or approval tier
                    filter.
                  </td>
                </tr>
              )}

              {filteredInvoices.map((inv) => {
                const isSelected = selectedInvoices.includes(inv.id);
                const isDuplicate =
                  inv.duplicateMatch &&
                  inv.duplicateMatch.isDuplicate &&
                  !inv.duplicateMatch.dismissed;
                const costType = costTypeForInvoice(inv);
                const steps = routingByInvoiceId[inv.id] ?? [];
                const clearing = resolveInvoiceClearingSummary(
                  steps,
                  currentUser.id,
                  currentProfile.approvalLimit,
                  inv.amount,
                  costType
                );
                const canApprove = clearing.canCurrentUserApprove;
                const isExpanded = expandedInvoiceId === inv.id;

                return (
                  <React.Fragment key={inv.id}>
                    <tr
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(inv.id)}
                          className="rounded text-slate-900 accent-slate-900"
                        />
                      </td>

                      {/* Invoice Details */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-900 flex items-center gap-1.5">
                          <span>{inv.invoiceNumber}</span>
                          {isDuplicate && (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.2 rounded">
                              DUPLICATE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {inv.vendorName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Due: {inv.dueDate || 'TBD'}
                        </div>
                      </td>

                      {/* Property */}
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div>{inv.propertyName}</div>
                        <div className="text-[10px] text-slate-400">
                          {costType === 'FIXED_MONTHLY'
                            ? 'Fixed Monthly Contract'
                            : 'Variable Cost'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-mono font-bold text-slate-900 tabular-nums text-sm">
                          $
                          {inv.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="mt-1">
                          {inv.approvalTier === 'auto_approved' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ⚡ Auto-Approved (Step 0 · Conf:{' '}
                              {inv.confidenceScore || 96}%)
                            </span>
                          ) : inv.approvalTier === 'property_manager' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⏳ Requires Manager Sign-off
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ⏳ Escalated to Executive Seat
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Live Matrix Seat & Routing */}
                      <td className="px-4 py-3 space-y-1">
                        {clearing.clearingStep ? (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                                  clearing.isVacant
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                }`}
                              >
                                <UserCheck className="w-3 h-3" />
                                Step {clearing.clearingStep.sequence}:{' '}
                                {clearing.requiredSeatLabel}
                              </span>
                              {clearing.isProxy && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Proxy
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1.5">
                              <span className="font-medium text-slate-800">
                                {clearing.assignedApproverName}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {clearing.thresholdSlug}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {inv.approvalTier === 'auto_approved' && (
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Auto-Approved (&lt; Step 0 Cap)
                              </span>
                            )}
                            {inv.approvalTier === 'property_manager' && (
                              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Property Manager ($1k–$10k)
                              </span>
                            )}
                            {inv.approvalTier === 'vp_finance' && (
                              <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-rose-600" />
                                VP Finance (&gt;$10k Capital)
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className="capitalize font-semibold text-xs text-slate-700">
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedInvoiceId(isExpanded ? null : inv.id)
                            }
                            title="Toggle state progress stepper"
                            className="px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors inline-flex items-center gap-1"
                          >
                            <span>Timeline</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          {inv.status === 'approved' ? (
                            <button
                              onClick={() => {
                                setSelectedInvoiceId(inv.id);
                                setActiveTab('disbursements');
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 rounded border border-emerald-200"
                            >
                              Ready to Pay
                            </button>
                          ) : (
                            <>
                              <button
                                disabled={!canApprove || isSubmitting}
                                onClick={() => handleApproveSingle(inv)}
                                title={
                                  !canApprove
                                    ? `🔒 Signing authority insufficient: invoice amount ($${inv.amount.toLocaleString()}) exceeds your seat threshold. Requires ${
                                        clearing.requiredSeatLabel ||
                                        (inv.approvalTier === 'vp_finance'
                                          ? 'VP Finance'
                                          : 'Senior Property Manager')
                                      } clearance.`
                                    : 'Authorize invoice payment'
                                }
                                className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors inline-flex items-center gap-1 ${
                                  canApprove
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                }`}
                              >
                                {!canApprove ? (
                                  <>
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    <span>
                                      Locked (
                                      {clearing.requiredSeatLabel ||
                                        (inv.approvalTier === 'vp_finance'
                                          ? 'VP Finance'
                                          : 'Senior PM')}
                                      )
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    <span>Approve</span>
                                  </>
                                )}
                              </button>

                              <button
                                disabled={isSubmitting}
                                onClick={() => setRejectingInvoice(inv)}
                                title="Reject invoice with reason"
                                className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
                              >
                                Reject
                              </button>

                              <button
                                disabled={isSubmitting}
                                onClick={() => handleRequestReevaluation(inv)}
                                title="Send back to matching & validation"
                                className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                              >
                                Re-eval
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <ApprovalsStepperRow
                        invoice={inv}
                        onOpenAudit={() => {
                          setSelectedInvoiceId(inv.id);
                          setActiveTab('audit_ledger');
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Duplicate Comparison Modal */}
      {comparingDuplicateInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-amber-50">
              <div>
                <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  Duplicate Protection: Side-by-Side Verification
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Comparing current invoice #{comparingDuplicateInvoice.invoiceNumber} with historical settled record
                </p>
              </div>

              <button
                onClick={() => setComparingDuplicateInvoice(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-amber-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comparison Panes */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Left Pane: Current Flagged Invoice */}
              <div className="p-4 bg-slate-50 border-2 border-amber-400 rounded-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900">Current Incoming Invoice</span>
                  <span className="font-mono text-amber-700 font-bold">FLAGGED DUPLICATE</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{comparingDuplicateInvoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payee Vendor:</span>
                  <span className="font-semibold text-slate-900">{comparingDuplicateInvoice.vendorName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payer Property:</span>
                  <span className="font-semibold text-slate-900">{comparingDuplicateInvoice.propertyName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Issue Date:</span>
                  <span className="font-mono text-slate-900">{comparingDuplicateInvoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Amount:</span>
                  <span className="font-mono font-bold text-rose-700 text-base">
                    ${comparingDuplicateInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Line Item Description:</span>
                  <span className="text-slate-700">{comparingDuplicateInvoice.lineItems[0]?.description}</span>
                </div>
              </div>

              {/* Right Pane: Historical Settled Invoice */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900">Historical Settled Record</span>
                  <span className="font-mono text-emerald-700 font-bold">PAID 14 DAYS AGO</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {comparingDuplicateInvoice.duplicateMatch?.matchedInvoiceNumber || 'INV-8750'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payee Vendor:</span>
                  <span className="font-semibold text-slate-900">{comparingDuplicateInvoice.vendorName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Payer Property:</span>
                  <span className="font-semibold text-slate-900">{comparingDuplicateInvoice.propertyName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Settled Issue Date:</span>
                  <span className="font-mono text-slate-900">
                    {comparingDuplicateInvoice.duplicateMatch?.matchedDate || '2026-10-17'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Settled Amount:</span>
                  <span className="font-mono font-bold text-slate-900 text-base">
                    ${(comparingDuplicateInvoice.duplicateMatch?.matchedAmount || comparingDuplicateInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Settled Line Items:</span>
                  <span className="text-slate-700">Identical monthly recurring routine janitorial service billing.</span>
                </div>
              </div>
            </div>

            {/* Override Comment Input */}
            <div className="px-6 pb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Override Comment (Required to dismiss duplicate flag):
              </label>
              <input
                type="text"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g., Verified separate service billing for Phase II emergency spill cleanup..."
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  rejectInvoice(comparingDuplicateInvoice.id, 'Duplicate invoice identified and rejected by reviewer');
                  setComparingDuplicateInvoice(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors"
              >
                Confirm Duplicate & Reject Invoice
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setComparingDuplicateInvoice(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!dismissReason.trim()}
                  onClick={handleConfirmDismissDuplicate}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-xs"
                >
                  Dismiss Flag with Reason
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Reject Invoice #{rejectingInvoice.invoiceNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Please enter the audit justification for rejecting this invoice (${rejectingInvoice.amount.toLocaleString()}).
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Scope of work not verified by onsite property engineer..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingInvoice(null)}
                className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim()}
                onClick={handleConfirmReject}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                Reject Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
