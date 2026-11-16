import React, { useMemo, useState } from 'react';
import { useInvoiceStore } from '@/context/InvoiceContext';
import {
  filterInvoicesForList,
  type InvoiceListFilter,
} from '@/config/navigation';
import { resolveBackendStatus } from './InvoiceStateStepper';
import { PageHeader } from './layout/PageHeader';
import { UnifiedInvoiceWorkspace } from './UnifiedInvoiceWorkspace';
import { Plus, FileText, ArrowRight } from 'lucide-react';

const STATUS_FILTERS: Array<{ id: InvoiceListFilter; label: string }> = [
  { id: 'all', label: 'All Invoices' },
  { id: 'INGESTED', label: 'Ingested' },
  { id: 'PENDING_MAPPING', label: 'Needs Matching' },
  { id: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'PAID', label: 'Paid' },
  { id: 'FAILED', label: 'Failed' },
];

export const InvoicesView: React.FC = () => {
  const {
    invoices,
    workspaceInvoiceId,
    openInvoiceWorkspace,
    propertyFilter,
    searchQuery,
    setIsNewBillOpen,
  } = useInvoiceStore();

  const [statusFilter, setStatusFilter] = useState<InvoiceListFilter>('all');

  const filteredInvoices = useMemo(
    () =>
      filterInvoicesForList(invoices, statusFilter, propertyFilter, searchQuery),
    [invoices, statusFilter, propertyFilter, searchQuery],
  );

  if (workspaceInvoiceId) {
    return <UnifiedInvoiceWorkspace />;
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Unified portfolio invoice ledger from ingestion and OCR extraction through settlement"
        primaryAction={{
          label: 'Upload Invoice',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setIsNewBillOpen(true),
        }}
      />

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.id;
          const count = filterInvoicesForList(
            invoices,
            f.id,
            propertyFilter,
            searchQuery,
          ).length;

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                active
                  ? 'bg-[#16834a] text-white border-[#16834a]'
                  : 'bg-white text-[#68766f] border-[#e6ebe8] hover:bg-[#f8faf9] hover:text-[#14532d]'
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  active ? 'bg-white/20 text-white' : 'bg-[#f8faf9] text-[#68766f]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Unified Master Bills Table */}
      <div className="bg-white rounded-xl border border-[#e6ebe8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8faf9] text-[#68766f] border-b border-[#e6ebe8] font-medium">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Payee (Vendor)</th>
                <th className="px-4 py-3">Payer (Property)</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Confidence</th>
                <th className="px-4 py-3">Lifecycle Status</th>
                <th className="px-4 py-3 text-right">Workspace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6ebe8] text-[#25362f]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-[#68766f]"
                  >
                    No invoices match the current filter or search query.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const status = resolveBackendStatus(inv);
                  const statusColor =
                    status === 'PAID' || status === 'APPROVED'
                      ? 'bg-[#e8f7ed] text-[#14532d] border-[#d7ebdd]'
                      : status === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200';

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => openInvoiceWorkspace(inv.id)}
                      className="hover:bg-[#f6fbf8] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[#14532d]">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-[#16834a]" />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{inv.vendorName}</td>
                      <td className="px-4 py-3 text-[#68766f]">
                        {inv.propertyName}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#68766f]">
                        Due {inv.dueDate}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-right tabular-nums text-[#25362f]">
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            inv.confidenceScore >= 90
                              ? 'bg-[#e8f7ed] text-[#16834a] border-[#d7ebdd]'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {inv.confidenceScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInvoiceWorkspace(inv.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#16834a] hover:text-white bg-[#e8f7ed] hover:bg-[#16834a] border border-[#d7ebdd] rounded-md transition-colors cursor-pointer"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

