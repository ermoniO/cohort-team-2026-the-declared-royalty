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
  X,
  Plus,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  UserPlus
} from 'lucide-react';
import { CreateVendorModal } from './CreateVendorModal';

export const PropertyVendorMatching: React.FC = () => {
  const {
    invoices,
    scopedProperties,
    properties,
    vendors,
    isVendorsLive,
    addNewVendor,
    mappings,
    toggleAutoApproval,
    confirmMatch,
    setSelectedInvoiceId,
    setActiveTab,
    currentProfile
  } = useInvoiceStore();

  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'triage'>('directory');
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
      {/* Module Title & Sub-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-600" />
            Property & Vendor Matching Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage established Payee-Payer relationship master data and AI bill matching confidence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isVendorsLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-600">
              {isVendorsLive ? 'Vendors API Connected' : 'Local Mock Vendors'}
            </span>
          </div>

          {/* Top-Level Sub-Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveSubTab('directory')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeSubTab === 'directory'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Active Mappings Directory ({mappings.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('triage')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeSubTab === 'triage'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
              <span>Invoice Match Triage ({invoices.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddVendorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Onboard Vendor</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'directory' ? (
        /* ==================== SUB-TAB 1: STANDALONE MAPPINGS DIRECTORY ==================== */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <div>
              <span className="font-bold text-slate-900">Pre-established Payee-Payer Relationships:</span>{' '}
              <span>Vendors mapped to properties with dedicated account numbers and auto-approval policies.</span>
            </div>
            <div className="text-xs font-mono text-slate-500">
              {mappings.filter((m) => m.autoApprovalEnabled).length} Auto-Approve Enabled
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-4 py-3">Property Entity (Payer)</th>
                    <th className="px-4 py-3">Vendor (Payee)</th>
                    <th className="px-4 py-3 font-mono">Vendor Account #</th>
                    <th className="px-4 py-3 text-center">Auto-Approval</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{mapping.propertyName}</div>
                        <div className="text-[10px] text-slate-400">ID: {mapping.propertyId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{mapping.vendorName}</div>
                        <div className="text-[10px] text-slate-400">ID: {mapping.vendorId}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                        {mapping.vendorAccountNumber}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleAutoApproval(mapping.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium focus:outline-none"
                        >
                          {mapping.autoApprovalEnabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3 stroke-[3]" /> Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Disabled
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {mapping.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleAutoApproval(mapping.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                        >
                          Toggle Rule
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== SUB-TAB 2: INVOICE MATCH TRIAGE ==================== */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Matching Filter Segmented Control */}
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

            <button
              onClick={() => setActiveTab('policy')}
              className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
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
                    <th className="px-4 py-3 text-center">Confidence</th>
                    <th className="px-4 py-3">Policy Route</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredInvoices.map((inv) => {
                    const isHigh = inv.confidenceScore >= 90;
                    const isAmbiguous = inv.confidenceScore >= 60 && inv.confidenceScore < 90;
                    const isUnmatched = inv.confidenceScore < 60;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setActiveTab('intake');
                            }}
                            className="font-mono font-bold text-slate-900 hover:text-indigo-600 hover:underline"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Acct: {inv.accountNumber}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-900">{inv.vendorName}</div>
                              <div className="text-[10px] text-slate-400">ID: {inv.vendorId}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-900">{inv.propertyName}</div>
                              <div className="text-[10px] text-slate-400">
                                {properties.find((p) => p.id === inv.propertyId)?.address || 'Commercial Facility'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5 font-mono font-bold">
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
                              {inv.confidenceScore}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {isHigh && (
                            <span className="text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Auto-Eligible
                            </span>
                          )}
                          {isAmbiguous && (
                            <span className="text-amber-700 font-medium text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Requires Triage
                            </span>
                          )}
                          {isUnmatched && (
                            <span className="text-rose-700 font-medium text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Unresolved Match
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openResolver(inv)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                          >
                            Resolve / Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ambiguity Resolution Modal */}
      {resolvingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Resolve Entity Match: {resolvingInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm or override the AI suggested payee-payer pair
                </p>
              </div>
              <button
                onClick={() => setResolvingInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Payee (Vendor)
                </label>
                <select
                  value={selectedCandidateVendorId}
                  onChange={(e) => setSelectedCandidateVendorId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Payer (Property Entity)
                </label>
                <select
                  value={selectedCandidatePropertyId}
                  onChange={(e) => setSelectedCandidatePropertyId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-md p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setResolvingInvoice(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyResolution}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors"
              >
                Confirm Match Pair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard Vendor Modal */}
      <CreateVendorModal
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        onSubmit={addNewVendor}
      />
    </div>
  );
};
