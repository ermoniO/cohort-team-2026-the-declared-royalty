import React from 'react';
import { CheckCircle2, Download, History, ShieldCheck, UserCheck } from 'lucide-react';
import { NAVIGATION_SECTIONS } from '@/config/navigation';
import { useInvoiceStore } from '@/context/InvoiceContext';
import AuditTimeline from '@/features/auditLogs/AuditTimeline';
import { auditLogsToCsv } from '@/features/auditLogs/auditLogDisplay';
import { useAuditHistory } from '@/features/auditLogs/useAuditHistory';
import { PageHeader } from './layout/PageHeader';

export const AuditHistoryLog: React.FC = () => {
  const { openInvoiceWorkspace } = useInvoiceStore();
  const auditHistory = useAuditHistory(undefined);
  const { logs, actorName } = auditHistory;

  const navConfig = NAVIGATION_SECTIONS.flatMap((s) => s.items).find(
    (item) => item.id === 'audit_ledger'
  );

  const humanActionCount = logs.filter((l) =>
    l.actionType.startsWith('USER_')
  ).length;
  const systemActionCount = logs.length - humanActionCount;

  const handleExportCsv = () => {
    const csvContent = auditLogsToCsv(logs, actorName);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'proppay-global-audit-ledger.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={navConfig?.label || 'Audit Ledger'}
        subtitle={
          navConfig?.subtitle ||
          'End-to-end immutable compliance ledger across all portfolio properties, invoices, and actors'
        }
        secondaryAction={{
          label: 'Export CSV',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: handleExportCsv,
          disabled: logs.length === 0,
        }}
      >
        <div className="flex items-center gap-1.5 text-xs font-mono text-[#14532d] bg-[#e8f7ed] border border-[#d7ebdd] px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-[#16834a]" />
          <span>Immutable Trail · 7-Year Compliance</span>
        </div>
      </PageHeader>

      {/* Portfolio Audit Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#e6ebe8] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68766f]">
              Total Ledger Events
            </span>
            <div className="text-2xl font-bold font-mono text-[#14532d] mt-1 tabular-nums">
              {logs.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#e8f7ed] text-[#16834a]">
            <History className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#e6ebe8] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68766f]">
              Human Sign-offs &amp; Edits
            </span>
            <div className="text-2xl font-bold font-mono text-[#14532d] mt-1 tabular-nums">
              {humanActionCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#e8f7ed] text-[#16834a]">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#e6ebe8] p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#68766f]">
              System Automation Events
            </span>
            <div className="text-2xl font-bold font-mono text-[#14532d] mt-1 tabular-nums">
              {systemActionCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#e8f7ed] text-[#16834a]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Global Multi-Invoice Audit Timeline */}
      <AuditTimeline
        targetInvoiceUuid={undefined}
        showInvoice={true}
        auditHistory={auditHistory}
        onSelectInvoice={(uuid) => openInvoiceWorkspace(uuid)}
      />
    </div>
  );
};
