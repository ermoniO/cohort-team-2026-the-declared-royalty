import React, { useEffect, useMemo, useState } from 'react';
import { useInvoiceStore } from '@/context/InvoiceContext';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Check,
  Edit3,
  Layers,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Lock,
  FileSpreadsheet,
  GitCompare,
  History,
  ShieldCheck,
  FileText,
  Send,
  X,
} from 'lucide-react';
import type { ApprovalQueueStepResponse } from '@/types/api';
import { getApprovalQueue } from '@/app/services/approvalMatrixService';
import AuditTimeline from '@/features/auditLogs/AuditTimeline';
import { DatePicker } from './ui/DatePicker';
import { auditLogsToCsv } from '@/features/auditLogs/auditLogDisplay';
import { useAuditHistory } from '@/features/auditLogs/useAuditHistory';
import { getInvoiceCostType, UUID_REGEX } from '@/features/invoices/invoiceFormat';
import { UserAvatar } from '@/features/users/UserAvatar';
import { resolveKnownUserId } from '@/features/users/userDisplay';
import {
  resolveExpectedApprover,
  resolveInvoiceClearingSummary,
} from './ApprovalsQueue';
import {
  InvoiceStateStepper,
  resolveBackendStatus,
  type MacroStageKey,
} from './InvoiceStateStepper';

export type WorkspaceTab = 'extracted' | 'approval' | 'audit';

export const UnifiedInvoiceWorkspace: React.FC<{
  initialRightTab?: WorkspaceTab;
}> = ({ initialRightTab = 'extracted' }) => {
  const {
    invoices,
    selectedInvoice,
    openInvoiceWorkspace,
    closeInvoiceWorkspace,
    rerunExtraction,
    updateExtractedInvoice,
    confirmMatch,
    approveInvoice,
    rejectInvoice,
    requestReevaluation,
    setActiveTab,
    mappings,
    currentUser,
    availableUsers = [],
    currentProfile,
  } = useInvoiceStore();

  const invoice = selectedInvoice || invoices[0];

  const [rightTab, setRightTab] = useState<WorkspaceTab>(initialRightTab);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalQueueStepResponse[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const isUuid = Boolean(invoice && UUID_REGEX.test(invoice.id));
  const auditHistory = useAuditHistory(isUuid ? invoice?.id : undefined, isUuid);
  const { logs: auditLogs, actorFor, actorName } = auditHistory;

  const costType: 'FIXED_MONTHLY' | 'VARIABLE' = useMemo(
    () => (invoice ? getInvoiceCostType(invoice, mappings) : 'VARIABLE'),
    [invoice, mappings]
  );

  useEffect(() => {
    let cancelled = false;
    if (!invoice || !invoice.propertyId || !UUID_REGEX.test(invoice.propertyId)) {
      setApprovalSteps([]);
      return;
    }

    getApprovalQueue(invoice.propertyId, invoice.amount, costType)
      .then((res) => {
        if (!cancelled) setApprovalSteps(res.steps ?? []);
      })
      .catch(() => {
        if (!cancelled) setApprovalSteps([]);
      });

    return () => {
      cancelled = true;
    };
  }, [invoice?.id, invoice?.propertyId, invoice?.amount, costType]);

  if (!invoice) {
    return (
      <div className="p-8 text-center text-[#68766f] text-xs">
        No invoice selected.
      </div>
    );
  }

  const effectiveStatus = resolveBackendStatus(invoice);
  const clearing = resolveInvoiceClearingSummary(
    approvalSteps,
    currentUser.id,
    currentProfile.approvalLimit,
    invoice.amount,
    costType,
  );

  const { name: expectedApproverName, role: expectedApproverRole, id: expectedApproverUuid } =
    resolveExpectedApprover(invoice, clearing);

  const resolveAvatarUrl = (userId?: string | null, name?: string | null) =>
    availableUsers.find(
      (u) =>
        (userId && u.id === userId) ||
        (name && u.name.toLowerCase() === name.toLowerCase())
    )?.avatarUrl;

  const expectedApproverAvatarUrl =
    clearing.clearingStep?.userAvatarUrl ??
    resolveAvatarUrl(expectedApproverUuid, expectedApproverName);

  const expectedApproverObj =
    effectiveStatus === 'PENDING_APPROVAL'
      ? {
          id: expectedApproverUuid,
          name: expectedApproverName,
          role: expectedApproverRole,
          avatarUrl: expectedApproverAvatarUrl,
        }
      : null;

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => {
      setFeedback((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const handleRerun = async () => {
    setIsReExtracting(true);
    try {
      await Promise.all([
        rerunExtraction(invoice.id),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
      notify('AI extraction re-run complete.');
    } finally {
      setIsReExtracting(false);
    }
  };

  const handleConfirmMatch = async () => {
    setIsSubmitting(true);
    try {
      await confirmMatch(invoice.id, invoice.vendorId, invoice.propertyId, invoice.mappingId);
      setRightTab('approval');
      notify(`Matched ${invoice.invoiceNumber} and routed to Approval Queue.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const ok = await approveInvoice(invoice.id);
      if (ok) {
        notify(`${invoice.invoiceNumber} approved by ${currentUser.name}.`);
      } else {
        notify(
          `Approval blocked: insufficient clearance or signing limit (${currentProfile.title}).`,
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      await rejectInvoice(invoice.id, rejectReason.trim());
      setRejectOpen(false);
      setRejectReason('');
      notify(`${invoice.invoiceNumber} rejected and routed to Exceptions.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReeval = async () => {
    setIsSubmitting(true);
    try {
      await requestReevaluation(
        invoice.id,
        'Returned to matching from invoice workspace',
      );
      setRightTab('extracted');
      notify(`${invoice.invoiceNumber} returned to Needs Matching.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    const csvContent = isUuid
      ? auditLogsToCsv(auditLogs, actorName)
      : [
          'Timestamp,Event Type,Actor,Role,Description',
          ...invoice.auditTrail.map((evt) =>
            [evt.timestamp, evt.eventType, evt.user, evt.role, evt.description]
              .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
              .join(',')
          ),
        ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Trail_${invoice.invoiceNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify(`Exported CSV audit trail for ${invoice.invoiceNumber}.`);
  };

  const handleStepperStageClick = (stageKey: MacroStageKey) => {
    if (stageKey === 'capture' || stageKey === 'validation') setRightTab('extracted');
    else if (stageKey === 'approval') setRightTab('approval');
    else setRightTab('audit');
  };

  const queueInvoices = useMemo(() => {
    const sameStage = invoices.filter(
      (inv) => resolveBackendStatus(inv) === effectiveStatus
    );
    return sameStage.length > 1 ? sameStage : invoices;
  }, [invoices, effectiveStatus]);
  const queueIndex = queueInvoices.findIndex((inv) => inv.id === invoice.id);
  const hasPrev = queueIndex > 0;
  const hasNext = queueIndex >= 0 && queueIndex < queueInvoices.length - 1;

  const statusBadgeClass =
    effectiveStatus === 'PAID' || effectiveStatus === 'APPROVED'
      ? 'bg-[#e8f7ed] text-[#14532d] border-[#d7ebdd]'
      : effectiveStatus === 'FAILED'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb + Title + Next Move Approver Chip + Contextual CTA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-[#e6ebe8] shadow-2xs">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#68766f] flex-wrap">
            <button
              type="button"
              onClick={closeInvoiceWorkspace}
              className="inline-flex items-center gap-1 font-semibold text-[#16834a] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Invoices</span>
            </button>
            <span>/</span>
            <span className="font-mono text-[#25362f]">{invoice.invoiceNumber}</span>

            {queueInvoices.length > 1 && queueIndex >= 0 && (
              <div className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-lg bg-[#f8faf9] border border-[#e6ebe8]">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && openInvoiceWorkspace(queueInvoices[queueIndex - 1].id)}
                  title="Previous invoice in queue"
                  aria-label="Previous invoice in queue"
                  className="p-0.5 rounded hover:bg-[#e8f7ed] text-[#14532d] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-medium text-[#25362f] px-1">
                  {queueIndex + 1} of {queueInvoices.length}
                </span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => hasNext && openInvoiceWorkspace(queueInvoices[queueIndex + 1].id)}
                  title="Next invoice in queue"
                  aria-label="Next invoice in queue"
                  className="p-0.5 rounded hover:bg-[#e8f7ed] text-[#14532d] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-[#14532d] truncate">
              {invoice.invoiceNumber} — {invoice.vendorName}
            </h1>
            <span
              className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}
            >
              {effectiveStatus}
            </span>
          </div>
          <p className="text-xs text-[#68766f]">
            {invoice.propertyName} · Due {invoice.dueDate} · Total{' '}
            <span className="font-mono font-semibold text-[#25362f]">
              ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {expectedApproverObj && (
            <div className="flex items-center gap-2 bg-[#f6fbf8] border border-[#d7ebdd] px-3 py-1.5 rounded-lg">
              <UserAvatar
                userId={expectedApproverObj.id}
                name={expectedApproverObj.name}
                role={expectedApproverObj.role}
                avatarUrl={expectedApproverObj.avatarUrl}
                sizeClassName="size-7"
                highlightRing
              />
              <div className="text-left">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#16834a]">
                  Next Move
                </div>
                <div className="text-xs font-semibold text-[#14532d]">
                  {expectedApproverObj.name}
                </div>
              </div>
            </div>
          )}

          {(effectiveStatus === 'INGESTED' || effectiveStatus === 'PENDING_MAPPING') && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmMatch}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Confirm &amp; Match</span>
            </button>
          )}

          {effectiveStatus === 'PENDING_APPROVAL' && (
            <button
              type="button"
              disabled={!clearing.canCurrentUserApprove || isSubmitting}
              onClick={handleApprove}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                clearing.canCurrentUserApprove
                  ? 'bg-[#16834a] hover:bg-[#13723f] text-white shadow-xs cursor-pointer'
                  : 'bg-[#f8faf9] text-[#98a29c] border border-[#e6ebe8] cursor-not-allowed'
              }`}
            >
              {clearing.canCurrentUserApprove ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve Invoice</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked ({expectedApproverRole})</span>
                </>
              )}
            </button>
          )}

          {effectiveStatus === 'APPROVED' && (
            <button
              type="button"
              onClick={() => setActiveTab('disbursements')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Go to Disbursements</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-[#e8f7ed] border border-[#d7ebdd] text-xs font-semibold text-[#14532d]">
          {feedback}
        </div>
      )}

      {/* Full-Width Interactive State Stepper with Faces & Expected Next Approver */}
      <InvoiceStateStepper
        invoice={invoice}
        auditLogs={isUuid ? auditLogs : []}
        actorFor={actorFor}
        expectedApprover={expectedApproverObj}
        isTransitioning={isReExtracting || isSubmitting}
        onStageClick={handleStepperStageClick}
      />

      {/* Dual-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* LEFT PANE: PDF Viewer */}
        <div className="lg:col-span-6 bg-slate-800 rounded-xl border border-slate-700 flex flex-col overflow-hidden shadow-xs">
          <div className="h-11 bg-slate-900 border-b border-slate-700 px-4 flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-400">PDF Preview</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 font-mono">{zoomLevel}%</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 cursor-pointer ${
                  showBoundingBoxes
                    ? 'bg-[#16834a] text-white'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">OCR Boxes</span>
              </button>
              <div className="h-4 w-px bg-slate-700 mx-1" />
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 20, 60))}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 20, 200))}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Rotate PDF"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-auto bg-slate-900/60 flex items-center justify-center relative">
            <div
              style={{
                transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out',
              }}
              className="w-[440px] min-h-[580px] bg-white text-slate-900 p-8 shadow-2xl rounded relative select-none border border-slate-300 font-sans text-xs"
            >
              <div className="border-b border-slate-300 pb-4 mb-4 flex justify-between items-start">
                <div>
                  <div
                    className={`font-bold text-base text-slate-900 ${
                      showBoundingBoxes
                        ? 'ring-1 ring-[#16834a] bg-[#e8f7ed]/70 p-1 rounded'
                        : ''
                    }`}
                  >
                    {invoice.vendorName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Remittance &amp; Invoicing Dept.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-slate-800">INVOICE</div>
                  <div
                    className={`font-mono text-xs font-semibold text-slate-700 mt-1 ${
                      showBoundingBoxes
                        ? 'ring-1 ring-sky-500 bg-sky-50/50 p-0.5 rounded'
                        : ''
                    }`}
                  >
                    #{invoice.invoiceNumber}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Acct: {invoice.accountNumber}
                  </div>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-4">
                <div
                  className={
                    showBoundingBoxes
                      ? 'ring-1 ring-[#16834a]/70 bg-[#f6fbf8] p-1.5 rounded'
                      : ''
                  }
                >
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    Bill To (Payer):
                  </span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {invoice.propertyName}
                  </div>
                </div>

                <div className="text-right text-[11px] space-y-1">
                  <div>
                    <span className="text-slate-400">Issue Date:</span>{' '}
                    <span className="font-mono font-medium">{invoice.issueDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Due Date:</span>{' '}
                    <span className="font-mono font-medium text-rose-600">
                      {invoice.dueDate}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500">
                      <th className="pb-1.5 font-semibold">Description</th>
                      <th className="pb-1.5 text-center font-semibold">Qty</th>
                      <th className="pb-1.5 text-right font-semibold">Rate</th>
                      <th className="pb-1.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.lineItems.map((li) => (
                      <tr
                        key={li.id}
                        className={
                          showBoundingBoxes
                            ? 'ring-1 ring-amber-400/70 bg-amber-50/30'
                            : ''
                        }
                      >
                        <td className="py-2 pr-2 text-slate-800">{li.description}</td>
                        <td className="py-2 px-1 text-center font-mono text-slate-600">
                          {li.quantity}
                        </td>
                        <td className="py-2 px-1 text-right font-mono text-slate-600">
                          ${li.unitRate.toFixed(2)}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono font-semibold text-slate-900">
                          ${li.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-end">
                <div className="w-48 text-[11px] space-y-1 text-right">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">${invoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax:</span>
                    <span className="font-mono">${invoice.tax.toFixed(2)}</span>
                  </div>
                  <div
                    className={`flex justify-between text-sm font-bold border-t border-slate-300 pt-1.5 text-slate-900 ${
                      showBoundingBoxes
                        ? 'ring-2 ring-[#16834a] bg-[#e8f7ed]/70 p-1 rounded'
                        : ''
                    }`}
                  >
                    <span>Total Due:</span>
                    <span className="font-mono">
                      ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>OCR Bounding Box Engine · V2</span>
                <span>CONFIDENCE: {invoice.confidenceScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: 3 Unified Tabs */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#e6ebe8] shadow-2xs flex flex-col overflow-hidden">
          <div className="border-b border-[#e6ebe8] bg-[#f8faf9] px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {[
                { id: 'extracted' as WorkspaceTab, label: 'Extracted Data', icon: FileText },
                { id: 'approval' as WorkspaceTab, label: 'Policy & Approval', icon: ShieldCheck },
                { id: 'audit' as WorkspaceTab, label: 'Audit Trail', icon: History },
              ].map((t) => {
                const TabIcon = t.icon;
                const active = rightTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRightTab(t.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                      active
                        ? 'border-[#16834a] text-[#14532d]'
                        : 'border-transparent text-[#68766f] hover:text-[#25362f]'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: EXTRACTED DATA */}
          {rightTab === 'extracted' && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="px-5 py-3 border-b border-[#e6ebe8] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#14532d]">
                    Confidence: <span className="font-mono">{invoice.confidenceScore}%</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(!isEditing)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors flex items-center gap-1 cursor-pointer ${
                        isEditing
                          ? 'bg-[#e8f7ed] border-[#16834a] text-[#14532d]'
                          : 'bg-white border-[#e6ebe8] text-[#25362f] hover:bg-[#f8faf9]'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditing ? 'Lock Form' : 'Manual Edit'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRerun}
                      disabled={isReExtracting}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-[#e6ebe8] text-[#25362f] hover:bg-[#f8faf9] transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isReExtracting ? 'animate-spin' : ''}`}
                      />
                      <span>Re-run AI</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4 max-h-[470px] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1">
                        Vendor (Payee)
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={invoice.vendorName}
                        onChange={(e) =>
                          updateExtractedInvoice(invoice.id, {
                            vendorName: e.target.value,
                          })
                        }
                        className="w-full text-xs font-medium px-3 py-1.5 bg-[#f8faf9] border border-[#e6ebe8] rounded text-[#25362f] focus:border-[#16834a] focus:outline-none"
                      />
                      <div className="text-[10px] text-[#16834a] mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> AI Extracted
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1">
                        Commercial Property (Payer)
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={invoice.propertyName}
                        onChange={(e) =>
                          updateExtractedInvoice(invoice.id, {
                            propertyName: e.target.value,
                          })
                        }
                        className="w-full text-xs font-medium px-3 py-1.5 bg-[#f8faf9] border border-[#e6ebe8] rounded text-[#25362f] focus:border-[#16834a] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={invoice.invoiceNumber}
                        onChange={(e) =>
                          updateExtractedInvoice(invoice.id, {
                            invoiceNumber: e.target.value,
                          })
                        }
                        className="w-full text-xs font-mono font-medium px-3 py-1.5 bg-[#f8faf9] border border-[#e6ebe8] rounded text-[#25362f]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1">
                        Account / Ref Number
                      </label>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={invoice.accountNumber}
                        onChange={(e) =>
                          updateExtractedInvoice(invoice.id, {
                            accountNumber: e.target.value,
                          })
                        }
                        className="w-full text-xs font-mono font-medium px-3 py-1.5 bg-[#f8faf9] border border-[#e6ebe8] rounded text-[#25362f]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1">
                        Issue Date
                      </label>
                      <DatePicker
                        ariaLabel="Issue Date"
                        disabled={!isEditing}
                        value={invoice.issueDate}
                        onChange={(val) =>
                          updateExtractedInvoice(invoice.id, {
                            issueDate: val,
                          })
                        }
                        buttonClassName={!isEditing ? 'bg-[#f8faf9]' : ''}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1">
                        Due Date
                      </label>
                      <DatePicker
                        ariaLabel="Due Date"
                        disabled={!isEditing}
                        value={invoice.dueDate}
                        onChange={(val) =>
                          updateExtractedInvoice(invoice.id, {
                            dueDate: val,
                          })
                        }
                        buttonClassName={!isEditing ? 'bg-[#f8faf9]' : ''}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#68766f] uppercase tracking-wider mb-1.5">
                      Line Items ({invoice.lineItems.length})
                    </label>
                    <div className="border border-[#e6ebe8] rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8]">
                          <tr>
                            <th className="px-3 py-2 font-medium">Description</th>
                            <th className="px-3 py-2 font-medium text-center">Qty</th>
                            <th className="px-3 py-2 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e6ebe8]">
                          {invoice.lineItems.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-3 py-4 text-center text-[#98a29c]"
                              >
                                Header-level invoice without line-item breakdown.
                              </td>
                            </tr>
                          ) : (
                            invoice.lineItems.map((li) => (
                              <tr key={li.id}>
                                <td className="px-3 py-2 text-[#25362f] font-medium">
                                  {li.description}
                                  {li.glCode && (
                                    <span className="block text-[10px] text-[#98a29c] font-mono">
                                      GL: {li.glCode}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-[#68766f]">
                                  {li.quantity}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-[#14532d]">
                                  ${li.amount.toFixed(2)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
                <span className="text-xs text-[#68766f]">
                  Total Due:{' '}
                  <span className="font-mono font-bold text-[#14532d]">
                    ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmMatch}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Confirm &amp; Match
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: POLICY & APPROVAL STEPS WITH FACES */}
          {rightTab === 'approval' && (
            <div className="flex-1 flex flex-col justify-between p-5 space-y-5 overflow-y-auto">
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-[#d7ebdd] bg-[#f6fbf8] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      userId={clearing.assignedApproverUuid ?? undefined}
                      name={expectedApproverName}
                      role={expectedApproverRole}
                      avatarUrl={expectedApproverAvatarUrl}
                      sizeClassName="size-10"
                      highlightRing={effectiveStatus === 'PENDING_APPROVAL'}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16834a]">
                        {effectiveStatus === 'APPROVED' || effectiveStatus === 'PAID'
                          ? 'Approval Cleared By'
                          : 'Next Move · Required Approver'}
                      </div>
                      <div className="text-sm font-bold text-[#14532d] truncate">
                        {expectedApproverName}
                      </div>
                      <div className="text-xs text-[#68766f]">
                        {expectedApproverRole} · {costType === 'FIXED_MONTHLY' ? 'Fixed Contract' : 'Variable Spend'}
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-white border border-[#d7ebdd] text-[#14532d] shrink-0">
                    ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Expected Sequential Approval Chain with Faces */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#68766f]">
                    Expected Approval Path
                  </h3>

                  {approvalSteps.length > 0 ? (
                    <div className="space-y-2.5">
                      {approvalSteps.map((step, index) => {
                        const clearingSeq = clearing.clearingStep?.sequence;
                        const isClearingStep =
                          clearingSeq === step.sequence &&
                          effectiveStatus === 'PENDING_APPROVAL';
                        const isCompletedStep =
                          effectiveStatus === 'APPROVED' ||
                          effectiveStatus === 'PAID' ||
                          (effectiveStatus === 'PENDING_APPROVAL' &&
                            clearingSeq !== undefined &&
                            step.sequence < clearingSeq);
                        const occupantName =
                          step.sequence === 0
                            ? 'System Automation'
                            : step.userName || 'Vacant Seat';

                        return (
                          <div
                            key={`${step.sequence}-${step.seatSlug}`}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                              isClearingStep
                                ? 'border-[#16834a] bg-[#e8f7ed]/50 shadow-2xs'
                                : 'border-[#e6ebe8] bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar
                                userId={step.userUuid ?? resolveKnownUserId(occupantName)}
                                name={occupantName}
                                role={step.seatDisplayName}
                                avatarUrl={
                                  step.userAvatarUrl ??
                                  resolveAvatarUrl(step.userUuid, occupantName)
                                }
                                isSystem={step.sequence === 0}
                                sizeClassName="size-9"
                                highlightRing={isClearingStep}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-[#25362f]">
                                    Step {step.sequence}: {step.seatDisplayName}
                                  </span>
                                  {step.isProxy && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                      Proxy Delegate
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#68766f] truncate">
                                  Occupant:{' '}
                                  <span className="font-semibold text-[#14532d]">
                                    {occupantName}
                                  </span>{' '}
                                  · Cap: {step.thresholdSlug}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                                isClearingStep
                                  ? 'bg-[#16834a] text-white border-[#16834a]'
                                  : isCompletedStep
                                    ? 'bg-[#e8f7ed] text-[#14532d] border-[#d7ebdd]'
                                    : 'bg-[#f8faf9] text-[#68766f] border-[#e6ebe8]'
                              }`}
                            >
                              {isClearingStep
                                ? 'Next Move'
                                : isCompletedStep
                                  ? 'Cleared'
                                  : index === approvalSteps.length - 1
                                    ? 'Final Tier'
                                    : 'Queued'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          userId={expectedApproverUuid}
                          name={expectedApproverName}
                          role={expectedApproverRole}
                          avatarUrl={expectedApproverAvatarUrl}
                          sizeClassName="size-9"
                          highlightRing={effectiveStatus === 'PENDING_APPROVAL'}
                        />
                        <div>
                          <div className="text-xs font-bold text-[#25362f]">
                            Assigned Tier: {expectedApproverRole}
                          </div>
                          <div className="text-[11px] text-[#68766f]">
                            Expected Reviewer: {expectedApproverName}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#e8f7ed] text-[#14532d]">
                        {effectiveStatus === 'APPROVED' || effectiveStatus === 'PAID'
                          ? 'Cleared'
                          : 'Next Move'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Decision Controls */}
              <div className="pt-4 border-t border-[#e6ebe8] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setRejectOpen(true)}
                    className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleReeval}
                    className="px-3 py-2 text-xs font-semibold text-[#25362f] bg-white hover:bg-[#f8faf9] rounded-lg border border-[#e6ebe8] transition-colors cursor-pointer"
                  >
                    Request Re-eval
                  </button>
                </div>

                {effectiveStatus === 'PENDING_APPROVAL' && (
                  <button
                    type="button"
                    disabled={!clearing.canCurrentUserApprove || isSubmitting}
                    onClick={handleApprove}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                      clearing.canCurrentUserApprove
                        ? 'bg-[#16834a] hover:bg-[#13723f] text-white shadow-xs cursor-pointer'
                        : 'bg-[#f8faf9] text-[#98a29c] border border-[#e6ebe8] cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve as {currentUser.name}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LIFECYCLE AUDIT TRAIL */}
          {rightTab === 'audit' && (
            <div className="flex-1 flex flex-col justify-between p-5 space-y-4 overflow-y-auto max-h-[590px]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#14532d]">
                  Immutable Audit Trail · {invoice.invoiceNumber}
                </h3>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 text-xs font-semibold text-[#25362f] bg-white hover:bg-[#f8faf9] border border-[#e6ebe8] rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#16834a]" />
                  <span>Download Invoice CSV</span>
                </button>
              </div>

              {isUuid ? (
                <AuditTimeline
                  targetInvoiceUuid={invoice.id}
                  auditHistory={auditHistory}
                  showInvoice={false}
                />
              ) : (
                <div className="space-y-3">
                  {invoice.auditTrail.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-lg border border-[#e6ebe8] bg-[#f8faf9] flex items-start gap-3"
                    >
                      <UserAvatar
                        userId={resolveKnownUserId(evt.user)}
                        name={evt.user}
                        role={evt.role}
                        avatarUrl={resolveAvatarUrl(undefined, evt.user)}
                        sizeClassName="size-7"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#25362f]">
                            {evt.eventType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-[#98a29c]">
                            {evt.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-[#68766f] mt-0.5">
                          {evt.user} · {evt.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[540px] rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
              <h3 className="text-sm font-bold text-[#14532d]">
                Reject Invoice #{invoice.invoiceNumber}
              </h3>
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="text-[#68766f] hover:text-[#14532d] cursor-pointer"
                aria-label="Close reject modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-[#68766f]">
                Provide an audit justification for rejecting this invoice ($
                {invoice.amount.toLocaleString()}).
              </p>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Scope of work not verified..."
                className="w-full text-xs p-2.5 border border-[#e6ebe8] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16834a]"
              />
            </div>
            <div className="px-6 py-3.5 border-t border-[#e6ebe8] bg-[#f8faf9] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#25362f] bg-white border border-[#e6ebe8] rounded-lg hover:bg-[#f8faf9] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim()}
                onClick={handleRejectConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
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
