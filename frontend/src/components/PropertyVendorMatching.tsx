import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice, Property, Vendor } from '../types';
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Building2,
  Truck,
  ArrowRight,
  ShieldCheck,
  Search,
  Check,
  X
} from 'lucide-react';

export const PropertyVendorMatching: React.FC = () => {
  const {
    invoices,
    properties,
    vendors,
    confirmMatch,
    setSelectedInvoiceId,
    setActiveTab,
    currentProfile
  } = useInvoiceStore();

  const [filterMode, setFilterMode] = useState<'all' | 'high' | 'ambiguous' | 'unmatched'>('all');
  const [resolvingInvoice, setResolvingInvoice] = useState<Invoice | null>(null);
  const [selectedCandidateVendorId, setSelectedCandidateVendorId] = useState<string>('');
  const [selectedCandidatePropertyId, setSelectedCandidatePropertyId] = useState<string>('');

  const filteredInvoices = invoices.filter((inv) => {
    if (filterMode === 'high') return inv.confidenceScore >= 90;
    if (filterMode === 'ambiguous') return inv.confidenceScore >= 60 && inv.confidenceScore < 90;
    if (filterMode === 'unmatched') return inv.confidenceScore < 60;
    return true;
  });

  const openResolver = (inv: Invoice) => {
    setResolvingInvoice(inv);
    setSelectedCandidateVendorId(inv.vendorId || vendors[0].id);
    setSelectedCandidatePropertyId(inv.propertyId || properties[0].id);
  };

  const handleApplyResolution = () => {
    if (!resolvingInvoice) return;
    confirmMatch(resolvingInvoice.id, selectedCandidateVendorId, selectedCandidatePropertyId);
    setResolvingInvoice(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Property & Vendor Matching Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated Payee (Vendor) to Payer (Commercial Entity) entity resolution and confidence scoring
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Matches ({invoices.length})
          </button>
          <button
            onClick={() => setFilterMode('high')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'high' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            High Confidence (≥90%)
          </button>
          <button
            onClick={() => setFilterMode('ambiguous')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'ambiguous' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ambiguous (60–89%)
          </button>
          <button
            onClick={() => setFilterMode('unmatched')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterMode === 'unmatched' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Unmatched (&lt;60%)
          </button>
        </div>
      </div>

      {/* Matching Rules Info Banner */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-800">High Confidence (≥90%)</span>
            <span className="text-slate-400">· Passes directly to Payer Policy engine</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="font-medium text-slate-800">Ambiguous (60–89%)</span>
            <span className="text-slate-400">· Multiple candidate matches found</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-medium text-slate-800">Unmatched (&lt;60%)</span>
            <span className="text-slate-400">· Human triage required</span>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('policy')}
          className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
        >
          View Payer Dollar Thresholds <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Matching Matrix Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Extracted Payee (Vendor)</th>
                <th className="px-4 py-3">Payer Property Match</th>
                <th className="px-4 py-3 text-right">Invoice Amount</th>
                <th className="px-4 py-3 text-center">Confidence Score</th>
                <th className="px-4 py-3">Matching Logic / Indicators</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredInvoices.map((inv) => {
                const confidence = inv.confidenceScore;
                const isHigh = confidence >= 90;
                const isAmbiguous = confidence >= 60 && confidence < 90;
                const isUnmatched = confidence < 60;

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Invoice ID */}
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      {inv.invoiceNumber}
                    </td>

                    {/* Payee Vendor */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-900">{inv.vendorName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Acct: {inv.accountNumber}</div>
                        </div>
                      </div>
                    </td>

                    {/* Payer Property */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-medium text-slate-900">{inv.propertyName}</div>
                          <div className="text-[10px] text-slate-400">
                            {properties.find((p) => p.id === inv.propertyId)?.address.split(',')[1] || 'Commercial Facility'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums">
                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Confidence Score Indicator */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-semibold text-xs">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isHigh ? 'bg-emerald-500' : isAmbiguous ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                        <span
                          className={
                            isHigh ? 'text-emerald-700' : isAmbiguous ? 'text-amber-700' : 'text-rose-700'
                          }
                        >
                          {confidence}%
                        </span>
                      </div>
                    </td>

                    {/* Match Reasoning */}
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {isHigh && (
                        <span>Account # alignment + 100% address string match</span>
                      )}
                      {isAmbiguous && (
                        <span className="text-amber-800">Fuzzy address match; 2 building candidates</span>
                      )}
                      {isUnmatched && (
                        <span className="text-rose-700">Unknown Remit-To address; missing W-9 file</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {isHigh ? (
                        <button
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setActiveTab('approvals');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Matched</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => openResolver(inv)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors inline-flex items-center gap-1"
                        >
                          <GitCompare className="w-3 h-3" />
                          <span>Resolve Ambiguity</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ambiguity Resolution Modal */}
      {resolvingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-indigo-600" />
                  Resolve Payee-Payer Match Ambiguity
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Invoice {resolvingInvoice.invoiceNumber} (${resolvingInvoice.amount.toLocaleString()}) · Confidence {resolvingInvoice.confidenceScore}%
                </p>
              </div>

              <button
                onClick={() => setResolvingInvoice(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Extracted Raw Strings vs Registry Candidates */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <span className="font-bold">Match Rationale:</span> AI extracted Payee "{resolvingInvoice.vendorName}" and address "{resolvingInvoice.propertyName}". However, confidence score is below 90% threshold. Select the exact master vendor and commercial property to bind this transaction.
              </div>

              {/* Vendor Payee Candidate Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Candidate Master Vendor (Payee)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vendors.map((v) => {
                    const isSelected = selectedCandidateVendorId === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedCandidateVendorId(v.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600 text-indigo-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span>{v.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          Acct: {v.accountNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {v.historicalMatchesCount} settled bills in history
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payer Property Candidate Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Candidate Commercial Property (Payer)
                </label>
                <div className="space-y-2">
                  {properties.map((p) => {
                    const isSelected = selectedCandidatePropertyId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedCandidatePropertyId(p.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600 text-indigo-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{p.address}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-500 block">
                            Auto-Approve Cap: ${p.policy.maxAutoApproveAmount.toLocaleString()}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 inline-block mt-0.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setResolvingInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyResolution}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
              >
                Confirm Match & Evaluate Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
