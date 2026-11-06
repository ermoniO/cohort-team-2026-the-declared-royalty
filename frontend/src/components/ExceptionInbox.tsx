import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice, ExceptionType } from '../types';
import {
  AlertTriangle,
  Sparkles,
  User,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  FileQuestion,
  HelpCircle,
  X
} from 'lucide-react';

export const ExceptionInbox: React.FC = () => {
  const {
    invoices,
    vendors,
    resolveException,
    currentProfile,
    setSelectedInvoiceId,
    setActiveTab
  } = useInvoiceStore();

  const [activeTabFilter, setActiveTabFilter] = useState<string>('all');
  const [selectedExceptionInvoice, setSelectedExceptionInvoice] = useState<Invoice | null>(null);

  // Resolution drawer inputs
  const [resolutionNote, setResolutionNote] = useState('');
  const [selectedVendorRemit, setSelectedVendorRemit] = useState('');
  const [assignedPerson, setAssignedPerson] = useState(currentProfile.userName);

  const exceptionInvoices = invoices.filter((inv) => inv.status === 'exception');

  const filteredExceptions = exceptionInvoices.filter((inv) => {
    if (activeTabFilter === 'all') return true;
    return inv.exception?.type === activeTabFilter;
  });

  const handleOpenDrawer = (inv: Invoice) => {
    setSelectedExceptionInvoice(inv);
    setResolutionNote('');
    setSelectedVendorRemit(inv.vendorId || vendors[0].id);
    setAssignedPerson(inv.exception?.assignedTo || currentProfile.userName);
  };

  const handleApplyResolution = () => {
    if (!selectedExceptionInvoice || !resolutionNote.trim()) return;
    resolveException(selectedExceptionInvoice.id, resolutionNote.trim(), selectedVendorRemit);
    setSelectedExceptionInvoice(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Exception & Human-in-the-Loop Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active anomaly triage · AI recovery suggestions · Manual intervention with compulsory reason logging
          </p>
        </div>

        <div className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-md">
          {exceptionInvoices.length} Unresolved Exceptions Require Triage
        </div>
      </div>

      {/* Exception Categories Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
        {[
          { id: 'all', label: 'All Exceptions' },
          { id: 'unknown_vendor', label: 'Unknown Vendor / Remit' },
          { id: 'policy_limit_exceeded', label: 'Policy Limit Breach' },
          { id: 'inconsistent_totals', label: 'Inconsistent Totals' },
          { id: 'missing_line_items', label: 'Missing Line Items' },
          { id: 'payment_failed', label: 'Payment Failures' },
        ].map((tab) => {
          const isSelected = activeTabFilter === tab.id;
          const count = exceptionInvoices.filter((i) =>
            tab.id === 'all' ? true : i.exception?.type === tab.id
          ).length;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTabFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono px-1 rounded ${isSelected ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Exception List Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {filteredExceptions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No exceptions currently in this category. System invariants verified.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3">Invoice Details</th>
                  <th className="px-4 py-3">Payer Property</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Exception Category</th>
                  <th className="px-4 py-3">Anomaly Diagnosis</th>
                  <th className="px-4 py-3">Assigned AP Specialist</th>
                  <th className="px-4 py-3 text-right">Triage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredExceptions.map((inv) => {
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-900">{inv.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-500">{inv.vendorName}</div>
                      </td>

                      <td className="px-4 py-3 font-medium text-slate-800">
                        {inv.propertyName}
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums text-sm">
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded capitalize">
                          {inv.exception?.type.replace('_', ' ') || 'Flagged Anomaly'}
                        </span>
                      </td>

                      <td className="px-4 py-3 max-w-xs text-slate-600">
                        <div className="truncate text-xs">{inv.exception?.message}</div>
                        {inv.exception?.aiSuggestion && (
                          <div className="text-[10px] text-indigo-600 flex items-center gap-1 mt-0.5 truncate">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span>{inv.exception.aiSuggestion}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{inv.exception?.assignedTo || currentProfile.userName}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenDrawer(inv)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs"
                        >
                          Triage & Resolve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolution Drawer Modal */}
      {selectedExceptionInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Resolve Exception: #{selectedExceptionInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Billed to {selectedExceptionInvoice.propertyName} · Total: ${selectedExceptionInvoice.amount.toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedExceptionInvoice(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs">
              {/* Diagnosis box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-700 block">Identified Anomaly:</span>
                <p className="text-slate-600 leading-relaxed">
                  {selectedExceptionInvoice.exception?.message}
                </p>
              </div>

              {/* AI Recommendation */}
              {selectedExceptionInvoice.exception?.aiSuggestion && (
                <div className="p-3 bg-indigo-50/70 rounded-lg border border-indigo-200 text-indigo-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI Recovery Recommendation:</span>
                  </div>
                  <p className="leading-relaxed text-indigo-900">
                    {selectedExceptionInvoice.exception.aiSuggestion}
                  </p>
                </div>
              )}

              {/* Assign Master Vendor override */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Remap to Master Vendor (Payee Registry):
                </label>
                <select
                  value={selectedVendorRemit}
                  onChange={(e) => setSelectedVendorRemit(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.accountNumber}) · {v.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resolution Reason */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Compulsory Human Resolution Justification:
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g. Verified vendor DBA alignment and approved manual override based on signed emergency work order..."
                  className="w-full p-2.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedExceptionInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!resolutionNote.trim()}
                onClick={handleApplyResolution}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-xs"
              >
                Apply Override & Re-route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
