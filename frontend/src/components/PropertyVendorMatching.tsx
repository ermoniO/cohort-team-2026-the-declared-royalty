import React, { useState, useEffect } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice, Property, Vendor, PropertyVendorRelationship } from '../types';
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
  UserPlus,
  Sliders,
  Tag,
  Settings2
} from 'lucide-react';
import { CreateVendorModal } from './CreateVendorModal';
import { InvoiceStateStepper } from './InvoiceStateStepper';
import { getPropertyGlAccounts } from '../app/services/propertyService';
import type { PropertyGlAccountResponse } from '@/types/api';

export const PropertyVendorMatching: React.FC = () => {
  const {
    invoices,
    scopedProperties,
    properties,
    vendors,
    isVendorsLive,
    addNewVendor,
    mappings,
    addMapping,
    toggleAutoApproval,
    updateMappingTerms,
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
  const [triageAccountNumber, setTriageAccountNumber] = useState<string>('');
  const [triageCostType, setTriageCostType] = useState<'FIXED_MONTHLY' | 'VARIABLE'>('VARIABLE');
  const [triageGlCode, setTriageGlCode] = useState<string>('');
  const [triageAutoApproval, setTriageAutoApproval] = useState<boolean>(false);
  const [triageStatus, setTriageStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [triageGlAccounts, setTriageGlAccounts] = useState<PropertyGlAccountResponse[]>([]);
  const [isLoadingTriageGl, setIsLoadingTriageGl] = useState(false);
  const [isApplyingResolution, setIsApplyingResolution] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);

  // Create Mapping Modal state
  const [isNewMappingOpen, setIsNewMappingOpen] = useState(false);
  const [newMapPropertyId, setNewMapPropertyId] = useState<string>('');
  const [newMapVendorId, setNewMapVendorId] = useState<string>('');
  const [newMapAccountNumber, setNewMapAccountNumber] = useState<string>('');
  const [newMapCostType, setNewMapCostType] = useState<'FIXED_MONTHLY' | 'VARIABLE'>('VARIABLE');
  const [newMapGlCode, setNewMapGlCode] = useState<string>('');
  const [newMapAutoApproval, setNewMapAutoApproval] = useState<boolean>(false);
  const [newMapStatus, setNewMapStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [newMapGlAccounts, setNewMapGlAccounts] = useState<PropertyGlAccountResponse[]>([]);
  const [isCreatingMapping, setIsCreatingMapping] = useState(false);

  // Editing terms modal state
  const [editingMapping, setEditingMapping] = useState<PropertyVendorRelationship | null>(null);
  const [glAccounts, setGlAccounts] = useState<PropertyGlAccountResponse[]>([]);
  const [selectedCostType, setSelectedCostType] = useState<'FIXED_MONTHLY' | 'VARIABLE'>('VARIABLE');
  const [selectedGlCode, setSelectedGlCode] = useState<string>('');
  const [isLoadingGlAccounts, setIsLoadingGlAccounts] = useState(false);

  const openEditTerms = async (mapping: PropertyVendorRelationship) => {
    setEditingMapping(mapping);
    setSelectedCostType(mapping.costType || 'VARIABLE');
    setSelectedGlCode(mapping.defaultGlCode || '');
    setIsLoadingGlAccounts(true);

    try {
      const accounts = await getPropertyGlAccounts(mapping.propertyId);
      setGlAccounts(accounts);
    } catch {
      setGlAccounts([]);
    } finally {
      setIsLoadingGlAccounts(false);
    }
  };

  const handleSaveTerms = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMapping) return;

    updateMappingTerms(editingMapping.id, {
      costType: selectedCostType,
      defaultGlCode: selectedGlCode || undefined,
    });
    setEditingMapping(null);
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filterMode === 'high') return inv.confidenceScore >= 90;
    if (filterMode === 'ambiguous') return inv.confidenceScore >= 60 && inv.confidenceScore < 90;
    if (filterMode === 'unmatched') return inv.confidenceScore < 60;
    return true;
  });

  const existingTriageMapping = mappings.find(
    (m) =>
      m.propertyId === selectedCandidatePropertyId &&
      m.vendorId === selectedCandidateVendorId &&
      m.status === 'ACTIVE'
  );

  useEffect(() => {
    if (!resolvingInvoice || !selectedCandidatePropertyId) {
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

  useEffect(() => {
    if (!isNewMappingOpen || !newMapPropertyId) {
      setNewMapGlAccounts([]);
      return;
    }
    let cancelled = false;
    getPropertyGlAccounts(newMapPropertyId)
      .then((accounts) => {
        if (!cancelled) setNewMapGlAccounts(accounts);
      })
      .catch(() => {
        if (!cancelled) setNewMapGlAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isNewMappingOpen, newMapPropertyId]);

  const handleOpenNewMapping = () => {
    setNewMapPropertyId(scopedProperties[0]?.id ?? properties[0]?.id ?? '');
    setNewMapVendorId(vendors[0]?.id ?? '');
    setNewMapAccountNumber('');
    setNewMapCostType('VARIABLE');
    setNewMapGlCode('');
    setNewMapAutoApproval(false);
    setNewMapStatus('ACTIVE');
    setIsNewMappingOpen(true);
  };

  const handleCreateMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMapPropertyId || !newMapVendorId || !newMapAccountNumber.trim()) return;
    setIsCreatingMapping(true);
    try {
      await addMapping({
        propertyId: newMapPropertyId,
        vendorId: newMapVendorId,
        vendorAccountNumber: newMapAccountNumber.trim(),
        costType: newMapCostType,
        defaultGlCode: newMapGlCode || undefined,
        autoApprovalEnabled: newMapAutoApproval,
        status: newMapStatus,
      });
      setIsNewMappingOpen(false);
    } finally {
      setIsCreatingMapping(false);
    }
  };

  const handleOpenTriage = (invoice: Invoice) => {
    setResolvingInvoice(invoice);
    setSelectedCandidateVendorId(invoice.vendorId || (vendors[0]?.id ?? ''));
    setSelectedCandidatePropertyId(invoice.propertyId || (scopedProperties[0]?.id ?? properties[0]?.id ?? ''));
    setTriageAccountNumber(invoice.accountNumber || `ACT-${Date.now().toString().slice(-6)}`);
    setTriageCostType('VARIABLE');
    setTriageGlCode('');
    setTriageAutoApproval(false);
    setTriageStatus('ACTIVE');
    setTriageError(null);
  };

  const handleApplyResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingInvoice || !selectedCandidateVendorId || !selectedCandidatePropertyId) return;
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
          status: triageStatus,
        });
        mappingId = created.id;
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
      setResolvingInvoice(null);
    } finally {
      setIsApplyingResolution(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-600" />
            Property-Vendor Relationship & Intake Matching
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage contract cost types, default GL assignment pointers, and resolve confidence matching.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-Tabs Control */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveSubTab('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeSubTab === 'directory'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Junction Directory ({mappings.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('triage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeSubTab === 'triage'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Invoice Match Triage ({invoices.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenNewMapping}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-medium shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>New Mapping</span>
          </button>

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
              <span>Vendors mapped to properties with contract cost types, default GL assignment pointers, and auto-approval rules.</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {mappings.filter((m) => m.costType === 'FIXED_MONTHLY').length} Fixed Contracts
              </span>
              <span className="text-slate-500">
                {mappings.filter((m) => m.autoApprovalEnabled).length} Auto-Approve Enabled
              </span>
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
                    <th className="px-4 py-3">Contract Cost Type</th>
                    <th className="px-4 py-3">Default GL Account</th>
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
                      <td className="px-4 py-3">
                        {mapping.costType === 'FIXED_MONTHLY' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Fixed Monthly
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Variable (T&M)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {mapping.defaultGlCode ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Tag className="w-3 h-3 text-indigo-500" />
                            GL: {mapping.defaultGlCode}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditTerms(mapping)}
                            className="px-2 py-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors flex items-center gap-1"
                            title="Configure Contract Cost Type & Default GL Code"
                          >
                            <Settings2 className="w-3 h-3" />
                            <span>Terms</span>
                          </button>
                          <button
                            onClick={() => toggleAutoApproval(mapping.id)}
                            className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors"
                          >
                            Toggle
                          </button>
                        </div>
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
                  filterMode === 'high' ? 'bg-white text-emerald-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Auto-Matched (≥90%)
              </button>
              <button
                onClick={() => setFilterMode('ambiguous')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filterMode === 'ambiguous' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Review Needed (60-89%)
              </button>
              <button
                onClick={() => setFilterMode('unmatched')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filterMode === 'unmatched' ? 'bg-white text-rose-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unmatched (&lt;60%)
              </button>
            </div>
          </div>

          {/* Triage Invoices Table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="px-4 py-3">Invoice Details</th>
                    <th className="px-4 py-3">Extracted Vendor & Property</th>
                    <th className="px-4 py-3 font-mono text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Confidence</th>
                    <th className="px-4 py-3">Resolution Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 font-mono">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-400">Due: {inv.dueDate}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{inv.vendorName}</div>
                        <div className="text-[11px] text-slate-500">{inv.propertyName}</div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 text-right">
                        ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                            inv.confidenceScore >= 90
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.confidenceScore >= 60
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {inv.confidenceScore}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.confidenceScore >= 90 ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> High-Confidence Match
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 font-medium text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Ambiguous Payee/Payer
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenTriage(inv)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                        >
                          Triage & Link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mapping Terms Modal */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Configure Contract Terms</h3>
                  <p className="text-xs text-slate-500">
                    {editingMapping.vendorName} → {editingMapping.propertyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMapping(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTerms} className="p-6 space-y-4">
              {/* Cost Type Radio */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Contract Cost Structure
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCostType === 'FIXED_MONTHLY'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="costType"
                      value="FIXED_MONTHLY"
                      checked={selectedCostType === 'FIXED_MONTHLY'}
                      onChange={() => setSelectedCostType('FIXED_MONTHLY')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Fixed Monthly Contract</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Predictable flat fees eligible for automated bypass of manual manager review when within policy limit.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCostType === 'VARIABLE'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="costType"
                      value="VARIABLE"
                      checked={selectedCostType === 'VARIABLE'}
                      onChange={() => setSelectedCostType('VARIABLE')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Variable / Time & Materials</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Fluctuating or emergency service charges that always route to a Property Manager for manual verification.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Default GL Account Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default GL Account (Assignment Pointer)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Scoped to building: {editingMapping.propertyName}
                </p>
                <select
                  value={selectedGlCode}
                  onChange={(e) => setSelectedGlCode(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                >
                  <option value="">No Default GL Code</option>
                  {isLoadingGlAccounts ? (
                    <option disabled value="">Loading property chart of accounts...</option>
                  ) : glAccounts.length > 0 ? (
                    glAccounts.map((ga) => (
                      <option key={ga.glCode} value={ga.glCode}>
                        {ga.glCode} - {ga.glAccountName}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="5100">5100 - Janitorial & Cleaning</option>
                      <option value="5200">5200 - HVAC Maintenance</option>
                      <option value="5300">5300 - Utilities & Electric</option>
                      <option value="5400">5400 - Security & Access Control</option>
                      <option value="5500">5500 - Landscaping & Grounds</option>
                    </>
                  )}
                </select>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingMapping(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                >
                  Save Contract Terms
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Property-Vendor Mapping Modal */}
      {isNewMappingOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Create Property-Vendor Mapping
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewMappingOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMappingSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Property Entity (Payer) *</label>
                <select
                  required
                  value={newMapPropertyId}
                  onChange={(e) => setNewMapPropertyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vendor (Payee) *</label>
                <select
                  required
                  value={newMapVendorId}
                  onChange={(e) => setNewMapVendorId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vendor Account Number *</label>
                  <input
                    type="text"
                    required
                    value={newMapAccountNumber}
                    onChange={(e) => setNewMapAccountNumber(e.target.value)}
                    placeholder="e.g. 2000456705"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cost Type *</label>
                  <select
                    value={newMapCostType}
                    onChange={(e) => setNewMapCostType(e.target.value as 'FIXED_MONTHLY' | 'VARIABLE')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                  >
                    <option value="FIXED_MONTHLY">FIXED_MONTHLY</option>
                    <option value="VARIABLE">VARIABLE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Default GL Code</label>
                  <select
                    value={newMapGlCode}
                    onChange={(e) => setNewMapGlCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                  >
                    <option value="">No Default GL Code</option>
                    {newMapGlAccounts.length > 0 ? (
                      newMapGlAccounts.map((ga) => (
                        <option key={ga.glCode} value={ga.glCode}>
                          {ga.glCode} - {ga.glAccountName}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="5100">5100 - Janitorial &amp; Cleaning</option>
                        <option value="5200">5200 - HVAC / Maintenance</option>
                        <option value="5300">5300 - Utilities</option>
                        <option value="5400">5400 - Security &amp; Access Control</option>
                        <option value="5500">5500 - Landscaping &amp; Grounds</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mapping Status *</label>
                  <select
                    value={newMapStatus}
                    onChange={(e) => setNewMapStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMapAutoApproval}
                  onChange={(e) => setNewMapAutoApproval(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-slate-800">
                  Enable straight-through auto-approval for invoices on this mapping
                </span>
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewMappingOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMapping}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md shadow-xs transition-colors"
                >
                  {isCreatingMapping ? 'Saving...' : 'Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Triage Link Modal */}
      {resolvingInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                  <GitCompare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Resolve Invoice Relationship: {resolvingInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResolvingInvoice(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyResolution}>
              <div className="p-6 space-y-4 text-xs">
                <InvoiceStateStepper
                  invoice={resolvingInvoice}
                  isTransitioning={isApplyingResolution}
                  compact
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Select Verified Vendor (Payee)</label>
                    <select
                      value={selectedCandidateVendorId}
                      onChange={(e) => setSelectedCandidateVendorId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                    >
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Select Property Entity (Payer)</label>
                    <select
                      value={selectedCandidatePropertyId}
                      onChange={(e) => setSelectedCandidatePropertyId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                    >
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.address}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {existingTriageMapping ? (
                  <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/70 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Existing Active Mapping Found</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Account <span className="font-mono font-semibold">{existingTriageMapping.vendorAccountNumber}</span> · Cost Type{' '}
                      <span className="font-mono font-semibold">{existingTriageMapping.costType || 'VARIABLE'}</span> · GL{' '}
                      <span className="font-mono font-semibold">{existingTriageMapping.defaultGlCode || 'Unassigned'}</span> · Auto-Approve{' '}
                      <span className="font-semibold">{existingTriageMapping.autoApprovalEnabled ? 'Enabled' : 'Disabled'}</span>
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-900">
                        On-the-Fly Property-Vendor Mapping Setup
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
                        No Active Pair Found
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Vendor Account Number *</label>
                        <input
                          type="text"
                          required
                          value={triageAccountNumber}
                          onChange={(e) => setTriageAccountNumber(e.target.value)}
                          placeholder="e.g. 2000456705"
                          className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Cost Type *</label>
                        <select
                          value={triageCostType}
                          onChange={(e) => setTriageCostType(e.target.value as 'FIXED_MONTHLY' | 'VARIABLE')}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                        >
                          <option value="FIXED_MONTHLY">FIXED_MONTHLY</option>
                          <option value="VARIABLE">VARIABLE</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Default GL Code (Optional)</label>
                        <select
                          value={triageGlCode}
                          onChange={(e) => setTriageGlCode(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                        >
                          <option value="">No Default GL Code</option>
                          {isLoadingTriageGl ? (
                            <option disabled value="">Loading GL accounts...</option>
                          ) : triageGlAccounts.length > 0 ? (
                            triageGlAccounts.map((ga) => (
                              <option key={ga.glCode} value={ga.glCode}>
                                {ga.glCode} - {ga.glAccountName}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="5100">5100 - Janitorial &amp; Cleaning</option>
                              <option value="5200">5200 - HVAC / Maintenance</option>
                              <option value="5300">5300 - Utilities</option>
                              <option value="5400">5400 - Security &amp; Access Control</option>
                              <option value="5500">5500 - Landscaping &amp; Grounds</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Status *</label>
                        <select
                          value={triageStatus}
                          onChange={(e) => setTriageStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                      <input
                        type="checkbox"
                        checked={triageAutoApproval}
                        onChange={(e) => setTriageAutoApproval(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium">
                        Enable Auto-Approval for recurring bills under this mapping
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

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingInvoice(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isApplyingResolution}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md shadow-xs transition-colors"
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

      {/* Onboard Vendor Modal */}
      <CreateVendorModal
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        onSubmit={addNewVendor}
      />
    </div>
  );
};
