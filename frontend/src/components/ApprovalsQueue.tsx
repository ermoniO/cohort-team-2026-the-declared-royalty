import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Lock,
  Copy,
  Building2,
  X
} from 'lucide-react';

export const ApprovalsQueue: React.FC = () => {
  const {
    invoices,
    approveInvoice,
    rejectInvoice,
    requestReevaluation,
    dismissDuplicate,
    currentProfile,
    activeRole,
    setSelectedInvoiceId,
    setActiveTab
  } = useInvoiceStore();

  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState<'all' | 'auto_approved' | 'property_manager' | 'vp_finance'>('all');
  const [comparingDuplicateInvoice, setComparingDuplicateInvoice] = useState<Invoice | null>(null);
  const [rejectingInvoice, setRejectingInvoice] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [dismissReason, setDismissReason] = useState('');

  // Pending approval invoices
  const pendingInvoices = invoices.filter((inv) => inv.status === 'pending_approval' || inv.status === 'approved');

  const filteredInvoices = pendingInvoices.filter((inv) => {
    if (tierFilter === 'all') return true;
    return inv.approvalTier === tierFilter;
  });

  // Flagged duplicate invoices
  const duplicateInvoices = invoices.filter(
    (inv) => inv.duplicateMatch && inv.duplicateMatch.isDuplicate && !inv.duplicateMatch.dismissed
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

  const handleBulkApprove = () => {
    let successCount = 0;
    for (const id of selectedInvoices) {
      const res = approveInvoice(id, 'Bulk approval via approvals queue');
      if (res) successCount++;
    }
    setSelectedInvoices([]);
  };

  const handleConfirmReject = () => {
    if (!rejectingInvoice || !rejectReason.trim()) return;
    rejectInvoice(rejectingInvoice.id, rejectReason.trim());
    setRejectingInvoice(null);
    setRejectReason('');
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
            Tiered multi-level routing enforced by payer policy · Active signing authority: <span className="font-semibold text-slate-800">{currentUser.name} ({currentProfile.title})</span>
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

      {/* Duplicate Alert Card Banner (if duplicate exists) */}
      {duplicateInvoices.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">
                  Duplicate Protection Warning: {duplicateInvoices.length} Suspicious Invoice Flagged
                </h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Automated duplicate guard detected an invoice matching a previously settled bill (identical vendor, scope, and dollar amount within 30-day billing window).
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {duplicateInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => setComparingDuplicateInvoice(inv)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 text-amber-900 rounded-md hover:bg-amber-100/80 transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-600" />
                      <span>Compare {inv.invoiceNumber} vs Settled Bill</span>
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

      {/* Filter Tabs & Bulk Actions Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Tier Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setTierFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              tierFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Pending ({pendingInvoices.length})
          </button>
          <button
            onClick={() => setTierFilter('auto_approved')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              tierFilter === 'auto_approved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Auto-Approved (Under Policy)
          </button>
          <button
            onClick={() => setTierFilter('property_manager')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              tierFilter === 'property_manager' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Requires Property Mgr (&gt;$1k)
          </button>
          <button
            onClick={() => setTierFilter('vp_finance')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              tierFilter === 'vp_finance' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Requires VP Finance (&gt;$10k)
          </button>
        </div>

        {/* Bulk Action Controls */}
        {selectedInvoices.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">
              {selectedInvoices.length} selected
            </span>
            <button
              onClick={handleBulkApprove}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
            >
              Authorize Selected
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
                    checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded text-slate-900 accent-slate-900"
                  />
                </th>
                <th className="px-4 py-3">Invoice Details</th>
                <th className="px-4 py-3">Payer Property</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Routing Classification</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredInvoices.map((inv) => {
                const isSelected = selectedInvoices.includes(inv.id);
                const isDuplicate = inv.duplicateMatch && inv.duplicateMatch.isDuplicate && !inv.duplicateMatch.dismissed;
                const canApprove =
                  currentProfile.approvalLimit === Infinity ||
                  (currentProfile.approvalLimit > 0 && inv.amount <= currentProfile.approvalLimit);

                return (
                  <tr
                    key={inv.id}
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
                      <div className="text-[11px] text-slate-500">{inv.vendorName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Due: {inv.dueDate}</div>
                    </td>

                    {/* Property */}
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div>{inv.propertyName}</div>
                      <div className="text-[10px] text-slate-400">Payer Entity</div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums text-sm">
                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Tier Tag */}
                    <td className="px-4 py-3">
                      {inv.approvalTier === 'auto_approved' && (
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Auto-Approved (&lt; Policy Cap)
                        </span>
                      )}
                      {inv.approvalTier === 'property_manager' && (
                        <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          Property Manager ($1k–$10k)
                        </span>
                      )}
                      {inv.approvalTier === 'vp_finance' && (
                        <span className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          VP Finance (&gt;$10k Capital)
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className="capitalize font-semibold text-xs text-slate-700">
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Action Buttons with Privilege Tooltip */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === 'approved' ? (
                          <button
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setActiveTab('payments');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 rounded border border-emerald-200"
                          >
                            Ready to Pay
                          </button>
                        ) : (
                          <>
                            <button
                              disabled={!canApprove}
                              onClick={() => approveInvoice(inv.id)}
                              title={
                                !canApprove
                                  ? `Your signing limit ($${currentProfile.approvalLimit.toLocaleString()}) is below invoice amount.`
                                  : 'Authorize invoice payment'
                              }
                              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                                canApprove
                                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => setRejectingInvoice(inv)}
                              title="Reject invoice with reason"
                              className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
                            >
                              Reject
                            </button>

                            <button
                              onClick={() => requestReevaluation(inv.id, 'AP specialist requested field re-evaluation')}
                              title="Send back for re-indexing"
                              className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                            >
                              Re-eval
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
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
