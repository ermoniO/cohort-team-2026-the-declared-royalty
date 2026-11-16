import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitCompare,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { getApprovalQueue } from '@/app/services/approvalMatrixService';
import { getPropertyGlAccounts } from '@/app/services/propertyService';
import {
  computeActionRequiredBreakdown,
  NAVIGATION_SECTIONS,
} from '@/config/navigation';
import { useInvoiceStore } from '@/context/InvoiceContext';
import { useAuditHistory } from '@/features/auditLogs/useAuditHistory';
import {
  DEFAULT_GL_OPTIONS,
  getInvoiceCostType,
  UUID_REGEX,
} from '@/features/invoices/invoiceFormat';
import { UserAvatar } from '@/features/users/UserAvatar';
import { resolveKnownUserId } from '@/features/users/userDisplay';
import type { ApprovalQueueStepResponse, PropertyGlAccountResponse } from '@/types/api';
import type { Invoice } from '@/types';
import {
  resolveExpectedApprover,
  resolveInvoiceClearingSummary,
} from './ApprovalsQueue';
import { InvoiceStateStepper } from './InvoiceStateStepper';
import { PageHeader } from './layout/PageHeader';
import { SelectDropdown } from './ui/SelectDropdown';

export type ActionRequiredFilter = 'all' | 'matching' | 'approvals' | 'exceptions';

const ActionStepperRow: React.FC<{
  invoice: Invoice;
  expectedApprover: { id?: string; name: string; role: string; avatarUrl?: string };
  onOpenWorkspace: () => void;
}> = ({ invoice, expectedApprover, onOpenWorkspace }) => {
  const isUuid = UUID_REGEX.test(invoice.id);
  const { logs, actorFor } = useAuditHistory(isUuid ? invoice.id : undefined);
  const invoiceLogs = isUuid ? logs.filter((l) => l.invoice === invoice.id) : [];

  return (
    <tr className="bg-[#f8faf9]">
      <td colSpan={7} className="px-4 py-3 border-t border-[#e6ebe8]">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-[#68766f]">
            <span className="font-semibold text-[#14532d]">
              Lifecycle Progress · {invoice.invoiceNumber}
            </span>
            <button
              type="button"
              onClick={onOpenWorkspace}
              className="text-[#16834a] hover:text-[#13723f] font-semibold cursor-pointer"
            >
              Open Full Workspace →
            </button>
          </div>
          <InvoiceStateStepper
            invoice={invoice}
            auditLogs={invoiceLogs}
            actorFor={actorFor}
            expectedApprover={expectedApprover}
            compact
          />
        </div>
      </td>
    </tr>
  );
};

export const ActionRequiredPage: React.FC<{
  initialFilter?: ActionRequiredFilter;
}> = ({ initialFilter = 'all' }) => {
  const {
    invoices,
    properties,
    scopedProperties,
    vendors,
    mappings,
    currentUser,
    availableUsers = [],
    currentProfile,
    approveInvoice,
    bulkApproveInvoices,
    rejectInvoice,
    requestReevaluation,
    dismissDuplicate,
    resolveException,
    confirmMatch,
    addMapping,
    openInvoiceWorkspace,
    actionRequiredFilter,
  } = useInvoiceStore();

  const navConfig = NAVIGATION_SECTIONS.flatMap((s) => s.items).find(
    (item) => item.id === 'action_required'
  );

  const [activeFilter, setActiveFilter] = useState<ActionRequiredFilter>(
    actionRequiredFilter || initialFilter
  );

  useEffect(() => {
    if (actionRequiredFilter) {
      setActiveFilter(actionRequiredFilter);
    }
  }, [actionRequiredFilter]);
  const [tierFilter, setTierFilter] = useState<
    'all' | 'auto_approved' | 'property_manager' | 'vp_finance'
  >('all');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [routingByInvoiceId, setRoutingByInvoiceId] = useState<
    Record<string, ApprovalQueueStepResponse[]>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Duplicate Compare modal state
  const [comparingDuplicateInvoice, setComparingDuplicateInvoice] =
    useState<Invoice | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  // Reject modal state
  const [rejectingInvoice, setRejectingInvoice] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Exception Resolution modal state
  const [selectedExceptionInvoice, setSelectedExceptionInvoice] =
    useState<Invoice | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [selectedVendorRemit, setSelectedVendorRemit] = useState('');

  // Resolve Invoice Match triage modal state
  const [resolvingInvoice, setResolvingInvoice] = useState<Invoice | null>(null);
  const [selectedCandidateVendorId, setSelectedCandidateVendorId] = useState('');
  const [selectedCandidatePropertyId, setSelectedCandidatePropertyId] = useState('');
  const [triageAccountNumber, setTriageAccountNumber] = useState('');
  const [triageCostType, setTriageCostType] = useState<'FIXED_MONTHLY' | 'VARIABLE'>(
    'VARIABLE'
  );
  const [triageGlCode, setTriageGlCode] = useState('');
  const [triageAutoApproval, setTriageAutoApproval] = useState(false);
  const [triageGlAccounts, setTriageGlAccounts] = useState<PropertyGlAccountResponse[]>(
    []
  );
  const [isLoadingTriageGl, setIsLoadingTriageGl] = useState(false);
  const [isApplyingResolution, setIsApplyingResolution] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  const breakdown = useMemo(
    () => computeActionRequiredBreakdown(invoices),
    [invoices]
  );

  const duplicateInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          Boolean(inv.duplicateMatch?.isDuplicate) &&
          !inv.duplicateMatch?.dismissed
      ),
    [invoices]
  );

  const costTypeForInvoice = (inv: Invoice) => getInvoiceCostType(inv, mappings);

  useEffect(() => {
    let cancelled = false;
    const targets = breakdown.pendingApproval.filter(
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
  }, [breakdown.pendingApproval, mappings]);

  useEffect(() => {
    if (!resolvingInvoice || !selectedCandidatePropertyId) {
      setTriageGlAccounts([]);
      return;
    }
    if (!UUID_REGEX.test(selectedCandidatePropertyId)) {
      setTriageGlAccounts([]);
      return;
    }
    let cancelled = false;
    setIsLoadingTriageGl(true);
    getPropertyGlAccounts(selectedCandidatePropertyId)
      .then((accounts) => {
        if (!cancelled) setTriageGlAccounts(accounts);
      })
      .catch(() => {
        if (!cancelled) setTriageGlAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTriageGl(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvingInvoice, selectedCandidatePropertyId]);

  const existingTriageMapping = mappings.find(
    (m) =>
      m.propertyId === selectedCandidatePropertyId &&
      m.vendorId === selectedCandidateVendorId &&
      m.status === 'ACTIVE'
  );

  const filteredApprovals = useMemo(
    () =>
      breakdown.pendingApproval.filter((inv) => {
        if (tierFilter !== 'all' && inv.approvalTier !== tierFilter) return false;
        if (selectedPropertyId !== 'all' && inv.propertyId !== selectedPropertyId) {
          return false;
        }
        return true;
      }),
    [breakdown.pendingApproval, tierFilter, selectedPropertyId]
  );

  const propertyFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of properties) map.set(p.id, p.name);
    for (const inv of breakdown.pendingApproval) {
      if (inv.propertyId && inv.propertyName && !map.has(inv.propertyId)) {
        map.set(inv.propertyId, inv.propertyName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [properties, breakdown.pendingApproval]);

  const showBanner = (
    type: 'success' | 'warning' | 'info',
    message: string
  ) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const handleOpenTriage = (invoice: Invoice) => {
    setResolvingInvoice(invoice);
    setSelectedCandidateVendorId(invoice.vendorId || vendors[0]?.id || '');
    setSelectedCandidatePropertyId(
      invoice.propertyId || scopedProperties[0]?.id || properties[0]?.id || ''
    );
    setTriageAccountNumber(
      invoice.accountNumber || `ACT-${Date.now().toString().slice(-6)}`
    );
    setTriageCostType('VARIABLE');
    setTriageGlCode('');
    setTriageAutoApproval(false);
    setTriageError(null);
  };

  const handleApplyMatchResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingInvoice || !selectedCandidateVendorId || !selectedCandidatePropertyId) {
      return;
    }
    setTriageError(null);

    let mappingId = existingTriageMapping?.id;
    if (!mappingId) {
      const accountNum = triageAccountNumber.trim();
      if (!accountNum) {
        setTriageError('Vendor Account Number is required to create a mapping.');
        return;
      }
      setIsApplyingResolution(true);
      try {
        const created = await addMapping({
          propertyId: selectedCandidatePropertyId,
          vendorId: selectedCandidateVendorId,
          vendorAccountNumber: accountNum,
          costType: triageCostType,
          defaultGlCode: triageGlCode || undefined,
          autoApprovalEnabled: triageAutoApproval,
          status: 'ACTIVE',
        });
        mappingId = created.id;
      } catch (err) {
        setTriageError(
          err instanceof Error ? err.message : 'Unable to create mapping.'
        );
        return;
      } finally {
        setIsApplyingResolution(false);
      }
    }

    setIsApplyingResolution(true);
    try {
      await confirmMatch(
        resolvingInvoice.id,
        selectedCandidateVendorId,
        selectedCandidatePropertyId,
        mappingId
      );
      showBanner(
        'success',
        `${resolvingInvoice.invoiceNumber} matched and routed to approval.`
      );
      setResolvingInvoice(null);
    } catch (err) {
      setTriageError(
        err instanceof Error ? err.message : 'Unable to confirm invoice match.'
      );
    } finally {
      setIsApplyingResolution(false);
    }
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
          `Approval blocked for ${inv.invoiceNumber}: insufficient seat clearance (${currentProfile.title}).`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const { approvedCount, skippedCount } = await bulkApproveInvoices(
        selectedInvoiceIds,
        'Bulk approval via Action Required'
      );
      setSelectedInvoiceIds([]);
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
        `${rejectingInvoice.invoiceNumber} rejected and moved to Exceptions.`
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
        `${inv.invoiceNumber} returned to Needs Matching for re-evaluation.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDismissDuplicate = () => {
    if (!comparingDuplicateInvoice || !dismissReason.trim()) return;
    dismissDuplicate(comparingDuplicateInvoice.id, dismissReason.trim());
    showBanner(
      'info',
      `Duplicate warning dismissed on ${comparingDuplicateInvoice.invoiceNumber}.`
    );
    setComparingDuplicateInvoice(null);
    setDismissReason('');
  };

  const handleOpenExceptionDrawer = (inv: Invoice) => {
    setSelectedExceptionInvoice(inv);
    setResolutionNote('');
    setSelectedVendorRemit(inv.vendorId || vendors[0]?.id || '');
  };

  const handleApplyExceptionResolution = () => {
    if (!selectedExceptionInvoice || !resolutionNote.trim()) return;
    resolveException(
      selectedExceptionInvoice.id,
      resolutionNote.trim(),
      selectedVendorRemit
    );
    showBanner(
      'success',
      `Exception resolved on ${selectedExceptionInvoice.invoiceNumber} and invoice re-routed.`
    );
    setSelectedExceptionInvoice(null);
  };

  const toggleSelectAllApprovals = () => {
    if (selectedInvoiceIds.length === filteredApprovals.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filteredApprovals.map((i) => i.id));
    }
  };

  const toggleSelectOneApproval = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const showMatchingSection =
    activeFilter === 'matching' ||
    (activeFilter === 'all' && breakdown.needsMatching.length > 0);
  const showApprovalsSection =
    activeFilter === 'approvals' ||
    (activeFilter === 'all' && breakdown.pendingApproval.length > 0);
  const showExceptionsSection =
    activeFilter === 'exceptions' ||
    (activeFilter === 'all' && breakdown.exceptionsAndDuplicates.length > 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={navConfig?.label || 'Action Required'}
        subtitle={
          navConfig?.subtitle ||
          'Single human-in-the-loop task queue for ambiguity matching, policy approvals, duplicate verification, and exception recovery'
        }
      />

      {banner && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-[#e8f7ed] border-[#b7e2c7] text-[#14532d]'
              : banner.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <span>{banner.message}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-current/70 hover:text-current cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Duplicate Protection Banner */}
      {duplicateInvoices.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Duplicate Protection Alert ({duplicateInvoices.length} Flagged)
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Invoice{' '}
                <span className="font-mono font-bold">
                  {duplicateInvoices[0].invoiceNumber}
                </span>{' '}
                ($
                {duplicateInvoices[0].amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
                ) matches historical invoice{' '}
                <span className="font-mono font-semibold">
                  {duplicateInvoices[0].duplicateMatch?.matchedInvoiceNumber ||
                    'INV-8750'}
                </span>
                . Compare records before approving disbursement.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setComparingDuplicateInvoice(duplicateInvoices[0]);
              setDismissReason('');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Compare Duplicate</span>
          </button>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#e6ebe8] shadow-2xs">
          {[
            {
              id: 'all' as ActionRequiredFilter,
              label: 'All Tasks',
              count: breakdown.totalUnique,
            },
            {
              id: 'matching' as ActionRequiredFilter,
              label: 'Needs Matching',
              count: breakdown.needsMatching.length,
            },
            {
              id: 'approvals' as ActionRequiredFilter,
              label: 'Pending Approval',
              count: breakdown.pendingApproval.length,
            },
            {
              id: 'exceptions' as ActionRequiredFilter,
              label: 'Exceptions & Duplicates',
              count: breakdown.exceptionsAndDuplicates.length,
            },
          ].map((pill) => {
            const selected = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setActiveFilter(pill.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#16834a] text-white shadow-2xs'
                    : 'text-[#68766f] hover:text-[#14532d] hover:bg-[#f8faf9]'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    selected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#f8faf9] text-[#25362f] border border-[#e6ebe8]'
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {(activeFilter === 'all' || activeFilter === 'approvals') &&
          selectedInvoiceIds.length > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleBulkApprove}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Bulk Approve Selected ({selectedInvoiceIds.length})</span>
            </button>
          )}
      </div>

      {/* Empty queue across everything */}
      {activeFilter === 'all' && breakdown.totalUnique === 0 && (
        <div className="bg-white rounded-xl border border-[#e6ebe8] p-12 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-[#16834a] mx-auto" />
          <h3 className="text-sm font-bold text-[#14532d]">Inbox Cleared</h3>
          <p className="text-xs text-[#68766f]">
            All incoming invoices are matched, approved, or settled without pending exceptions.
          </p>
        </div>
      )}

      {/* SECTION 1: NEEDS MATCHING */}
      {showMatchingSection && (
        <section className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#16834a]" />
              <h2 className="text-sm font-bold text-[#14532d]">
                Needs Matching ({breakdown.needsMatching.length})
              </h2>
            </div>
            <span className="text-[11px] text-[#68766f]">
              Verify vendor/property pair and create on-the-fly contract mappings
            </span>
          </div>

          {breakdown.needsMatching.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#68766f]">
              No invoices currently need vendor/property matching.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Vendor / Account</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3 text-right">Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ebe8]">
                  {breakdown.needsMatching.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#f6fbf8] transition-colors">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openInvoiceWorkspace(inv.id)}
                          className="font-mono font-semibold text-[#16834a] hover:underline cursor-pointer"
                        >
                          {inv.invoiceNumber}
                        </button>
                        <div className="text-[11px] text-[#68766f]">
                          Issued {inv.issueDate}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#25362f]">
                          {inv.vendorName || 'Unresolved Vendor'}
                        </div>
                        <div className="text-[11px] font-mono text-[#68766f]">
                          Acct: {inv.accountNumber || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#25362f]">
                        {inv.propertyName || 'Unassigned Property'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#14532d] tabular-nums">
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            inv.confidenceScore < 60
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {inv.confidenceScore}% Confidence
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenTriage(inv)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          Resolve Match
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: PENDING APPROVAL */}
      {showApprovalsSection && (
        <section className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e6ebe8] bg-[#f8faf9] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#16834a]" />
              <h2 className="text-sm font-bold text-[#14532d]">
                Pending Approval ({filteredApprovals.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#e6ebe8]">
                {[
                  { id: 'all' as const, label: 'All Tiers' },
                  { id: 'auto_approved' as const, label: 'Step 0' },
                  { id: 'property_manager' as const, label: 'PM Tier' },
                  { id: 'vp_finance' as const, label: 'VP Finance' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTierFilter(tab.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                      tierFilter === tab.id
                        ? 'bg-[#e8f7ed] text-[#14532d]'
                        : 'text-[#68766f] hover:text-[#14532d]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <SelectDropdown
                value={selectedPropertyId}
                onChange={setSelectedPropertyId}
                ariaLabel="Filter pending approvals by property"
                className="min-w-[180px]"
                buttonClassName="px-2.5 py-1.5"
                options={[
                  { value: 'all', label: 'All Properties' },
                  ...propertyFilterOptions.map((opt) => ({
                    value: opt.id,
                    label: opt.name,
                  })),
                ]}
              />
            </div>
          </div>

          {filteredApprovals.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#68766f]">
              No pending approvals match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all pending approval invoices"
                        checked={
                          filteredApprovals.length > 0 &&
                          selectedInvoiceIds.length === filteredApprovals.length
                        }
                        onChange={toggleSelectAllApprovals}
                        className="rounded border-[#e6ebe8] text-[#16834a] focus:ring-[#16834a]"
                      />
                    </th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Vendor &amp; Property</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Expected Approver &amp; Seat</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ebe8]">
                  {filteredApprovals.map((inv) => {
                    const isSelected = selectedInvoiceIds.includes(inv.id);
                    const isDuplicate = Boolean(
                      inv.duplicateMatch?.isDuplicate && !inv.duplicateMatch.dismissed
                    );
                    const isExpanded = expandedInvoiceId === inv.id;
                    const ct = costTypeForInvoice(inv);
                    const liveSteps = routingByInvoiceId[inv.id] ?? [];
                    const clearing = resolveInvoiceClearingSummary(
                      liveSteps,
                      currentUser.id,
                      currentProfile.approvalLimit,
                      inv.amount,
                      ct
                    );
                    const expectedApprover = resolveExpectedApprover(inv, clearing);
                    const canApprove =
                      clearing.canCurrentUserApprove && !isDuplicate;

                    return (
                      <React.Fragment key={inv.id}>
                        <tr
                          className={`hover:bg-[#f6fbf8] transition-colors ${
                            isDuplicate ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOneApproval(inv.id)}
                              className="rounded border-[#e6ebe8] text-[#16834a] focus:ring-[#16834a]"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openInvoiceWorkspace(inv.id)}
                              className="font-mono font-semibold text-[#16834a] hover:underline cursor-pointer"
                            >
                              {inv.invoiceNumber}
                            </button>
                            {isDuplicate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setComparingDuplicateInvoice(inv);
                                  setDismissReason('');
                                }}
                                className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 rounded border border-amber-300 cursor-pointer"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Duplicate Match</span>
                              </button>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-[#25362f]">
                              {inv.vendorName}
                            </div>
                            <div className="text-[11px] text-[#68766f]">
                              {inv.propertyName}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-[#14532d] tabular-nums text-sm">
                            ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                userId={expectedApprover.id}
                                name={expectedApprover.name}
                                role={expectedApprover.role}
                                avatarUrl={
                                  clearing.clearingStep?.userAvatarUrl ??
                                  availableUsers.find(
                                    (u) =>
                                      u.id === expectedApprover.id ||
                                      u.name === expectedApprover.name
                                  )?.avatarUrl
                                }
                                sizeClassName="size-7"
                                highlightRing
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#14532d] truncate flex items-center gap-1.5">
                                  <span>{expectedApprover.name}</span>
                                  {clearing.isProxy && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      Proxy
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#68766f] inline-flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-[#16834a]" />
                                  <span>
                                    {clearing.clearingStep
                                      ? `Step ${clearing.clearingStep.sequence}: ${expectedApprover.role}`
                                      : expectedApprover.role}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              Pending Approval
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedInvoiceId(isExpanded ? null : inv.id)
                                }
                                className="px-2 py-1 text-xs font-medium text-[#14532d] hover:bg-[#e8f7ed] rounded border border-[#d7ebdd] transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Timeline</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={!canApprove || isSubmitting}
                                onClick={() => handleApproveSingle(inv)}
                                title={
                                  !canApprove
                                    ? isDuplicate
                                      ? 'Dismiss duplicate warning before approving'
                                      : `Signing authority insufficient for $${inv.amount.toLocaleString()} (requires ${expectedApprover.role})`
                                    : 'Authorize invoice payment'
                                }
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1 ${
                                  canApprove
                                    ? 'bg-[#16834a] hover:bg-[#13723f] text-white shadow-2xs cursor-pointer'
                                    : 'bg-[#f8faf9] text-[#98a29c] border border-[#e6ebe8] cursor-not-allowed'
                                }`}
                              >
                                {!canApprove ? (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    <span>Locked</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Approve</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setRejectingInvoice(inv)}
                                className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-md border border-rose-200 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleRequestReevaluation(inv)}
                                className="px-2 py-1 text-xs font-semibold text-[#68766f] hover:bg-[#f8faf9] rounded-md border border-[#e6ebe8] transition-colors cursor-pointer"
                              >
                                Re-eval
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <ActionStepperRow
                            invoice={inv}
                            expectedApprover={{
                              ...expectedApprover,
                              avatarUrl:
                                clearing.clearingStep?.userAvatarUrl ??
                                availableUsers.find(
                                  (u) =>
                                    u.id === expectedApprover.id ||
                                    u.name === expectedApprover.name
                                )?.avatarUrl,
                            }}
                            onOpenWorkspace={() => openInvoiceWorkspace(inv.id)}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* SECTION 3: EXCEPTIONS & DUPLICATES */}
      {showExceptionsSection && (
        <section className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h2 className="text-sm font-bold text-[#14532d]">
                Exceptions &amp; Duplicate Flags ({breakdown.exceptionsAndDuplicates.length})
              </h2>
            </div>
            <span className="text-[11px] text-[#68766f]">
              Human recovery overrides and duplicate side-by-side resolution
            </span>
          </div>

          {breakdown.exceptionsAndDuplicates.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#68766f]">
              No active exceptions or duplicate flags detected.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Payer Property</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Issue Category</th>
                    <th className="px-4 py-3">Diagnosis &amp; AI Suggestion</th>
                    <th className="px-4 py-3">Assigned Handler</th>
                    <th className="px-4 py-3 text-right">Triage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6ebe8]">
                  {breakdown.exceptionsAndDuplicates.map((inv) => {
                    const isDup =
                      Boolean(inv.duplicateMatch?.isDuplicate) &&
                      !inv.duplicateMatch?.dismissed;
                    const assigneeName = inv.exception?.assignedTo || currentUser.name;

                    return (
                      <tr key={inv.id} className="hover:bg-[#f6fbf8] transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openInvoiceWorkspace(inv.id)}
                            className="font-mono font-semibold text-[#16834a] hover:underline cursor-pointer"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <div className="text-[11px] text-[#68766f]">
                            {inv.vendorName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#25362f] font-medium">
                          {inv.propertyName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#14532d] tabular-nums">
                          ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          {inv.status === 'exception' ? (
                            <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded capitalize">
                              {inv.exception?.type.replace('_', ' ') || 'Flagged Anomaly'}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              Potential Duplicate
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="truncate text-xs text-[#25362f]">
                            {inv.exception?.message ||
                              (isDup
                                ? `Matches settled invoice ${inv.duplicateMatch?.matchedInvoiceNumber || 'record'}`
                                : 'Manual intervention required')}
                          </div>
                          {inv.exception?.aiSuggestion && (
                            <div className="text-[10px] text-[#16834a] flex items-center gap-1 mt-0.5 truncate">
                              <Sparkles className="w-3 h-3 shrink-0" />
                              <span>{inv.exception.aiSuggestion}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              userId={resolveKnownUserId(assigneeName)}
                              name={assigneeName}
                              role="AP Specialist"
                              avatarUrl={
                                availableUsers.find(
                                  (u) =>
                                    u.name.toLowerCase() === assigneeName.toLowerCase()
                                )?.avatarUrl
                              }
                              sizeClassName="size-6"
                            />
                            <span className="text-xs text-[#25362f]">{assigneeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.status === 'exception' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenExceptionDrawer(inv)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              Triage &amp; Resolve
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setComparingDuplicateInvoice(inv);
                                setDismissReason('');
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                            >
                              Compare Duplicate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Side-by-Side Duplicate Comparison Modal */}
      {comparingDuplicateInvoice && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#e6ebe8] flex items-center justify-between bg-amber-50">
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
                type="button"
                onClick={() => setComparingDuplicateInvoice(null)}
                className="p-1 rounded text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-4 bg-[#f8faf9] border-2 border-amber-400 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#e6ebe8] pb-2">
                  <span className="font-bold text-[#14532d]">Current Incoming Invoice</span>
                  <span className="font-mono text-amber-700 font-bold">FLAGGED DUPLICATE</span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Invoice Number:</span>
                  <span className="font-mono font-bold text-[#14532d] text-sm">
                    {comparingDuplicateInvoice.invoiceNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Payee Vendor:</span>
                  <span className="font-semibold text-[#25362f]">
                    {comparingDuplicateInvoice.vendorName}
                  </span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Payer Property:</span>
                  <span className="font-semibold text-[#25362f]">
                    {comparingDuplicateInvoice.propertyName}
                  </span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Amount:</span>
                  <span className="font-mono font-bold text-rose-700 text-base">
                    $
                    {comparingDuplicateInvoice.amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#f8faf9] border border-[#e6ebe8] rounded-lg space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#e6ebe8] pb-2">
                  <span className="font-bold text-[#14532d]">Historical Settled Record</span>
                  <span className="font-mono text-[#16834a] font-bold">PRIOR SETTLEMENT</span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Invoice Number:</span>
                  <span className="font-mono font-bold text-[#14532d] text-sm">
                    {comparingDuplicateInvoice.duplicateMatch?.matchedInvoiceNumber ||
                      'INV-8750'}
                  </span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Settled Issue Date:</span>
                  <span className="font-mono text-[#25362f]">
                    {comparingDuplicateInvoice.duplicateMatch?.matchedDate || '2026-10-17'}
                  </span>
                </div>
                <div>
                  <span className="text-[#68766f] block">Settled Amount:</span>
                  <span className="font-mono font-bold text-[#14532d] text-base">
                    $
                    {(
                      comparingDuplicateInvoice.duplicateMatch?.matchedAmount ||
                      comparingDuplicateInvoice.amount
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-4">
              <label className="block text-xs font-semibold text-[#25362f] mb-1">
                Mandatory Override Comment (Required to dismiss duplicate flag):
              </label>
              <input
                type="text"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g., Verified separate billing period or emergency work order..."
                className="w-full text-xs p-2.5 border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
              />
            </div>

            <div className="p-4 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  rejectInvoice(
                    comparingDuplicateInvoice.id,
                    'Duplicate invoice identified and rejected by reviewer'
                  );
                  setComparingDuplicateInvoice(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                Confirm Duplicate &amp; Reject Invoice
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComparingDuplicateInvoice(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#68766f] hover:text-[#14532d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!dismissReason.trim()}
                  onClick={handleConfirmDismissDuplicate}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  Dismiss Flag with Reason
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standardized 540px Reject Reason Modal */}
      {rejectingInvoice && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-[540px] w-full rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
              <h3 className="text-sm font-bold text-[#14532d]">
                Reject Invoice #{rejectingInvoice.invoiceNumber}
              </h3>
              <button
                type="button"
                onClick={() => setRejectingInvoice(null)}
                className="text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <p className="text-[#68766f]">
                Enter audit justification for rejecting $
                {rejectingInvoice.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
                .
              </p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Scope of work not verified by onsite property engineer..."
                className="w-full text-xs p-2.5 border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
              />
            </div>
            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRejectingInvoice(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || isSubmitting}
                onClick={handleConfirmReject}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Reject Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardized 540px Exception Resolution Modal */}
      {selectedExceptionInvoice && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-[540px] w-full rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-rose-50/70">
              <div>
                <h3 className="text-sm font-bold text-[#14532d] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Resolve Exception: #{selectedExceptionInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-[#68766f] mt-0.5">
                  {selectedExceptionInvoice.propertyName} · $
                  {selectedExceptionInvoice.amount.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExceptionInvoice(null)}
                className="p-1 rounded text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-[#f8faf9] rounded-lg border border-[#e6ebe8] space-y-1">
                <span className="font-semibold text-[#14532d] block">
                  Identified Anomaly:
                </span>
                <p className="text-[#25362f] leading-relaxed">
                  {selectedExceptionInvoice.exception?.message}
                </p>
              </div>

              {selectedExceptionInvoice.exception?.aiSuggestion && (
                <div className="p-3 bg-[#e8f7ed]/70 rounded-lg border border-[#d7ebdd] text-[#14532d] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-[#16834a]" />
                    <span>AI Recovery Recommendation:</span>
                  </div>
                  <p className="leading-relaxed">
                    {selectedExceptionInvoice.exception.aiSuggestion}
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#25362f] mb-1">
                  Remap to Master Vendor (Payee Registry):
                </label>
                <SelectDropdown
                  ariaLabel="Remap to Master Vendor"
                  value={selectedVendorRemit}
                  onChange={setSelectedVendorRemit}
                  options={vendors.map((v) => ({
                    value: v.id,
                    label: `${v.name} (${v.accountNumber}) · ${v.category}`,
                  }))}
                />
              </div>

              <div>
                <label className="block font-semibold text-[#25362f] mb-1">
                  Compulsory Human Resolution Justification:
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g. Verified vendor DBA alignment and approved manual override..."
                  className="w-full p-2.5 border border-[#e6ebe8] rounded-lg focus:outline-none focus:border-[#16834a]"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedExceptionInvoice(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolutionNote.trim()}
                onClick={handleApplyExceptionResolution}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              >
                Apply Override &amp; Re-route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardized 540px Resolve Invoice Relationship Modal */}
      {resolvingInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#e6ebe8] max-w-[540px] w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#e8f7ed] text-[#16834a] rounded-md">
                  <GitCompare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#14532d]">
                  Resolve Match: {resolvingInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingInvoice(null)}
                className="text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyMatchResolution}>
              <div className="p-6 space-y-4 text-xs">
                <InvoiceStateStepper
                  invoice={resolvingInvoice}
                  isTransitioning={isApplyingResolution}
                  compact
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#25362f] font-semibold mb-1">
                      Verified Vendor (Payee)
                    </label>
                    <SelectDropdown
                      ariaLabel="Verified Vendor (Payee)"
                      value={selectedCandidateVendorId}
                      onChange={setSelectedCandidateVendorId}
                      options={vendors.map((v) => ({
                        value: v.id,
                        label: `${v.name} (${v.category})`,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[#25362f] font-semibold mb-1">
                      Property Entity (Payer)
                    </label>
                    <SelectDropdown
                      ariaLabel="Property Entity (Payer)"
                      value={selectedCandidatePropertyId}
                      onChange={setSelectedCandidatePropertyId}
                      options={properties.map((p) => ({
                        value: p.id,
                        label: p.name,
                      }))}
                    />
                  </div>
                </div>

                {existingTriageMapping ? (
                  <div className="p-3.5 rounded-lg border border-[#d7ebdd] bg-[#e8f7ed]/70 space-y-1">
                    <div className="flex items-center gap-1.5 text-[#14532d] font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-[#16834a]" />
                      <span>Existing Active Mapping Found</span>
                    </div>
                    <p className="text-[11px] text-[#25362f]">
                      Acct{' '}
                      <span className="font-mono font-semibold">
                        {existingTriageMapping.vendorAccountNumber}
                      </span>{' '}
                      · Cost Type{' '}
                      <span className="font-mono font-semibold">
                        {existingTriageMapping.costType || 'VARIABLE'}
                      </span>{' '}
                      · GL{' '}
                      <span className="font-mono font-semibold">
                        {existingTriageMapping.defaultGlCode || 'Unassigned'}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-[#d7ebdd] bg-[#f6fbf8] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#14532d]">
                        On-the-Fly Mapping Setup
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#e8f7ed] text-[#14532d] font-semibold">
                        New Pair
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#25362f] font-semibold mb-1">
                          Vendor Account Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={triageAccountNumber}
                          onChange={(e) => setTriageAccountNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-[#e6ebe8] rounded-lg bg-white text-[#25362f] font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[#25362f] font-semibold mb-1">
                          Cost Type *
                        </label>
                        <SelectDropdown
                          ariaLabel="Cost Type"
                          value={triageCostType}
                          onChange={(val) =>
                            setTriageCostType(val as 'FIXED_MONTHLY' | 'VARIABLE')
                          }
                          options={[
                            { value: 'FIXED_MONTHLY', label: 'FIXED_MONTHLY' },
                            { value: 'VARIABLE', label: 'VARIABLE' },
                          ]}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[#25362f] font-semibold mb-1">
                          Default GL Code (Optional)
                        </label>
                        <SelectDropdown
                          ariaLabel="Default GL Code"
                          value={triageGlCode}
                          onChange={setTriageGlCode}
                          disabled={isLoadingTriageGl}
                          options={[
                            {
                              value: '',
                              label: isLoadingTriageGl
                                ? 'Loading GL accounts...'
                                : 'No Default GL Code',
                            },
                            ...(triageGlAccounts.length > 0
                              ? triageGlAccounts
                              : DEFAULT_GL_OPTIONS
                            ).map((ga) => ({
                              value: ga.glCode,
                              label: `${ga.glCode} - ${ga.glAccountName}`,
                            })),
                          ]}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-[#25362f]">
                      <input
                        type="checkbox"
                        checked={triageAutoApproval}
                        onChange={(e) => setTriageAutoApproval(e.target.checked)}
                        className="rounded text-[#16834a] focus:ring-[#16834a]"
                      />
                      <span className="font-medium">
                        Enable straight-through auto-approval under this mapping
                      </span>
                    </label>
                  </div>
                )}

                {triageError && (
                  <div className="p-2.5 rounded border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-medium">
                    {triageError}
                  </div>
                )}
              </div>

              <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setResolvingInvoice(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#68766f] hover:text-[#14532d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApplyingResolution}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isApplyingResolution
                    ? 'Linking Invoice...'
                    : existingTriageMapping
                      ? 'Confirm Match Pair'
                      : 'Create Mapping & Link Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

