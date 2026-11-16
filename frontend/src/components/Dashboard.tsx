import React from 'react';
import { useInvoiceStore } from '@/context/InvoiceContext';
import {
  computeActionRequiredBreakdown,
  computeDisbursementsCount,
} from '@/config/navigation';
import { resolveBackendStatus } from './InvoiceStateStepper';
import { PageHeader } from './layout/PageHeader';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  FileCheck2,
  Sparkles,
  ShieldAlert,
  Plus,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    invoices,
    activities,
    setActiveTab,
    openActionRequired,
    openInvoiceWorkspace,
    setIsNewBillOpen,
    propertyFilter,
    properties,
    vendors,
  } = useInvoiceStore();

  // Filter invoices by active global property scope
  const filteredInvoices = invoices.filter((inv) =>
    propertyFilter === 'all' ? true : inv.propertyId === propertyFilter,
  );

  // Action-required breakdown & financial aggregates
  const breakdown = computeActionRequiredBreakdown(filteredInvoices);
  const readyDisbursementCount = computeDisbursementsCount(filteredInvoices);

  const totalInvoicesCount = filteredInvoices.length;
  const totalInvoicesAmount = filteredInvoices.reduce(
    (sum, inv) => sum + inv.amount,
    0,
  );

  const pendingAmount = breakdown.pendingApproval.reduce(
    (sum, inv) => sum + inv.amount,
    0,
  );
  const exceptionsAmount = breakdown.exceptionsAndDuplicates.reduce(
    (sum, inv) => sum + inv.amount,
    0,
  );

  const paidInvoices = filteredInvoices.filter(
    (inv) => resolveBackendStatus(inv) === 'PAID',
  );
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Clean 6-stage operational pipeline mapped to canonical destinations
  const pipelineStages: {
    key: string;
    label: string;
    count: number;
    barClass: string;
    onClick: () => void;
  }[] = [
    {
      key: 'INGESTED',
      label: '1. Ingested',
      count: filteredInvoices.filter(
        (i) => resolveBackendStatus(i) === 'INGESTED',
      ).length,
      barClass: 'bg-slate-400',
      onClick: () => setActiveTab('invoices'),
    },
    {
      key: 'PENDING_MAPPING',
      label: '2. Needs Matching',
      count: breakdown.needsMatching.length,
      barClass: 'bg-sky-500',
      onClick: () => setActiveTab('action_required'),
    },
    {
      key: 'PENDING_APPROVAL',
      label: '3. Pending Approval',
      count: breakdown.pendingApproval.length,
      barClass: 'bg-amber-500',
      onClick: () => setActiveTab('action_required'),
    },
    {
      key: 'APPROVED',
      label: '4. Ready to Pay',
      count: readyDisbursementCount,
      barClass: 'bg-teal-500',
      onClick: () => setActiveTab('disbursements'),
    },
    {
      key: 'PAID',
      label: '5. Settled',
      count: paidInvoices.length,
      barClass: 'bg-[#16834a]',
      onClick: () => setActiveTab('disbursements'),
    },
    {
      key: 'FAILED',
      label: '6. Exceptions / Dup',
      count: breakdown.exceptionsAndDuplicates.length,
      barClass: 'bg-rose-500',
      onClick: () => setActiveTab('action_required'),
    },
  ];

  const activeScopeName =
    propertyFilter === 'all'
      ? 'All Portfolios'
      : properties.find((p) => p.id === propertyFilter)?.name || 'Scoped Asset';

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Overview"
        subtitle="Real-time multi-property invoice pipeline, AI extraction metrics, and live activity stream"
        primaryAction={{
          label: 'Upload Invoice',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setIsNewBillOpen(true),
        }}
      >
        <div className="text-xs text-[#68766f] bg-white border border-[#e6ebe8] px-3 py-2 rounded-lg font-mono">
          Scope: <span className="font-semibold text-[#14532d]">{activeScopeName}</span>
        </div>
      </PageHeader>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[#e6ebe8] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#68766f] mb-2">
            <span>Total Invoices Ingested</span>
            <FileText className="w-4 h-4 text-[#98a29c]" />
          </div>
          <div className="text-2xl font-bold text-[#25362f] font-mono tabular-nums">
            ${totalInvoicesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#68766f] mt-1.5 flex items-center justify-between">
            <span>
              <span className="font-semibold text-[#25362f] font-mono">
                {totalInvoicesCount}
              </span>{' '}
              total invoices
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className="text-xs text-[#16834a] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              All Invoices <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#e6ebe8] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-amber-700 mb-2">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-[#25362f] font-mono tabular-nums">
            ${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#68766f] mt-1.5 flex items-center justify-between">
            <span>
              <span className="font-semibold text-amber-700 font-mono">
                {breakdown.pendingApproval.length}
              </span>{' '}
              awaiting sign-off
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('action_required')}
              className="text-xs text-[#16834a] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Action Queue <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#e6ebe8] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-rose-700 mb-2">
            <span>Exceptions &amp; Duplicates</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-[#25362f] font-mono tabular-nums">
            ${exceptionsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#68766f] mt-1.5 flex items-center justify-between">
            <span>
              <span className="font-semibold text-rose-700 font-mono">
                {breakdown.exceptionsAndDuplicates.length}
              </span>{' '}
              require triage
            </span>
            <button
              type="button"
              onClick={() => openActionRequired('exceptions')}
              className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Resolve <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#e6ebe8] shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[#16834a] mb-2">
            <span>Settled &amp; Paid Out</span>
            <CheckCircle className="w-4 h-4 text-[#16834a]" />
          </div>
          <div className="text-2xl font-bold text-[#14532d] font-mono tabular-nums">
            ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#68766f] mt-1.5 flex items-center justify-between">
            <span>
              <span className="font-semibold text-[#25362f] font-mono">
                {paidInvoices.length}
              </span>{' '}
              settled ·{' '}
              <span className="font-mono font-semibold text-[#16834a]">
                {readyDisbursementCount}
              </span>{' '}
              ready
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('disbursements')}
              className="text-xs text-[#16834a] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Disbursements <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Processing Pipeline Bar Chart Widget */}
      <div className="bg-white p-6 rounded-xl border border-[#e6ebe8] shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#14532d]">
              Invoice Processing Automation Pipeline
            </h2>
            <p className="text-xs text-[#68766f] mt-0.5">
              Live status distribution from document ingestion through policy evaluation to payment settlement
            </p>
          </div>
          <span className="text-xs text-[#98a29c] font-mono">
            {totalInvoicesCount} active invoices
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {pipelineStages.map((stage) => (
            <button
              key={stage.key}
              type="button"
              onClick={stage.onClick}
              className="p-3.5 text-left bg-[#f8faf9] hover:bg-[#e8f7ed]/60 border border-[#e6ebe8] hover:border-[#d7ebdd] rounded-lg transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#68766f] mb-2">
                <span className="truncate group-hover:text-[#14532d]">
                  {stage.label}
                </span>
                <span className="font-mono text-[#14532d] bg-white px-1.5 py-0.5 rounded border border-[#e6ebe8] text-[11px]">
                  {stage.count}
                </span>
              </div>
              <div className="w-full bg-[#e6ebe8] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stage.barClass} rounded-full transition-all duration-500`}
                  style={{
                    width: `${Math.min(
                      100,
                      stage.count === 0
                        ? 0
                        : Math.max(12, (stage.count / (totalInvoicesCount || 1)) * 100),
                    )}%`,
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 12-Column Operational Stream + Automation Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-[#e6ebe8] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#14532d]">
                  Live System Activity Stream
                </h2>
                <p className="text-xs text-[#68766f] mt-0.5">
                  Click any invoice event below to open its unified dual-pane workspace
                </p>
              </div>
              <span className="text-xs text-[#98a29c] font-mono">
                {activities.length} recent events
              </span>
            </div>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {activities.map((act) => (
                <div
                  key={act.id}
                  onClick={() => {
                    if (act.invoiceId) {
                      openInvoiceWorkspace(act.invoiceId);
                    }
                  }}
                  className={`p-3 bg-[#f8faf9] rounded-lg border border-[#e6ebe8] flex items-start gap-3 transition-colors ${
                    act.invoiceId
                      ? 'hover:bg-[#e8f7ed]/50 hover:border-[#d7ebdd] cursor-pointer'
                      : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {act.status === 'success' && (
                      <CheckCircle className="w-4 h-4 text-[#16834a]" />
                    )}
                    {act.status === 'warning' && (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    {act.status === 'error' && (
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                    )}
                    {act.status === 'info' && (
                      <FileCheck2 className="w-4 h-4 text-sky-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#25362f] truncate">
                        {act.title}
                      </span>
                      <span className="text-[11px] text-[#98a29c] shrink-0 font-mono">
                        {act.timestamp}
                      </span>
                    </div>
                    <div className="text-xs text-[#68766f] truncate mt-0.5">
                      {act.subtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#e6ebe8] mt-4 flex items-center justify-between text-xs text-[#68766f]">
            <span>Real-time status updates across extraction, matching, and approvals.</span>
            <button
              type="button"
              onClick={() => setActiveTab('audit_ledger')}
              className="text-xs font-semibold text-[#16834a] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Audit Ledger <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right 4 cols: Policy & Master Data Snapshot */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 bg-[#14532d] text-white rounded-xl border border-[#16834a]/40 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#e8f7ed]" />
                <span className="text-xs font-semibold text-[#e8f7ed]">
                  Approval Policy Engine Live
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('policies')}
                className="text-[11px] text-[#e8f7ed] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Policies <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-[#d7ebdd] leading-relaxed">
              Per-property Steps 0–5 routing is enforced by the backend policy engine. Low-risk invoices within Step 0 caps auto-approve; higher-tier invoices route to assigned Property Manager, Regional Director, or VP seats.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('action_required')}
              className="w-full py-2 px-3 rounded-lg bg-[#16834a] hover:bg-[#13723f] text-white text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer"
            >
              <span>Review Action Required ({breakdown.totalUnique})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 bg-white rounded-xl border border-[#e6ebe8] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#14532d] uppercase tracking-wider">
                Portfolio Master Directory
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('master_data')}
                className="text-xs font-semibold text-[#16834a] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#f8faf9] border border-[#e6ebe8]">
                <div className="text-[11px] text-[#68766f]">Properties</div>
                <div className="text-lg font-bold font-mono text-[#14532d]">
                  {properties.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#f8faf9] border border-[#e6ebe8]">
                <div className="text-[11px] text-[#68766f]">Vendors</div>
                <div className="text-lg font-bold font-mono text-[#14532d]">
                  {vendors.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
