import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Property, PayerPolicy } from '../types';
import {
  SlidersHorizontal,
  Building2,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Edit2,
  Check,
  Calculator,
  ArrowRight,
  Lock,
  X,
  Plus
} from 'lucide-react';
import { CreatePropertyModal } from './CreatePropertyModal';

export const PayerPolicyRules: React.FC = () => {
  const {
    properties,
    isPropertiesLive,
    refreshProperties,
    addNewProperty,
    companyPolicy,
    updateCompanyPolicy,
    updatePropertyPolicy,
    evaluatePolicyForInvoice,
    currentProfile,
    activeRole
  } = useInvoiceStore();

  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingCompanyPolicy, setEditingCompanyPolicy] = useState(false);

  // Form states for company policy
  const [companyAutoApprove, setCompanyAutoApprove] = useState(companyPolicy.maxAutoApproveAmount);
  const [companyAutoPay, setCompanyAutoPay] = useState(companyPolicy.maxAutoPayAmount);
  const [companyMinConfidence, setCompanyMinConfidence] = useState(companyPolicy.minConfidenceScore);

  // Form states for property override
  const [propAutoApprove, setPropAutoApprove] = useState(1500);
  const [propAutoPay, setPropAutoPay] = useState(500);
  const [propMinConfidence, setPropMinConfidence] = useState(85);
  const [propRequiresPo, setPropRequiresPo] = useState(false);
  const [propAutoPayEnabled, setPropAutoPayEnabled] = useState(true);

  // Policy Simulator inputs
  const [simPropertyId, setSimPropertyId] = useState<string>(properties[0].id);
  const [simAmount, setSimAmount] = useState<number>(1250);
  const [simConfidence, setSimConfidence] = useState<number>(95);

  const canEdit = currentProfile.canEditPolicy;

  const handleOpenEditProp = (prop: Property) => {
    setEditingProperty(prop);
    setPropAutoApprove(prop.policy.maxAutoApproveAmount);
    setPropAutoPay(prop.policy.maxAutoPayAmount);
    setPropMinConfidence(prop.policy.minConfidenceScore);
    setPropRequiresPo(prop.policy.requiresPoMatch);
    setPropAutoPayEnabled(prop.policy.autoPayEnabled);
  };

  const handleSavePropertyPolicy = () => {
    if (!editingProperty) return;
    updatePropertyPolicy(editingProperty.id, {
      maxAutoApproveAmount: propAutoApprove,
      maxAutoPayAmount: propAutoPay,
      minConfidenceScore: propMinConfidence,
      requiresPoMatch: propRequiresPo,
      autoPayEnabled: propAutoPayEnabled,
    });
    setEditingProperty(null);
  };

  const handleSaveCompanyPolicy = () => {
    updateCompanyPolicy({
      maxAutoApproveAmount: companyAutoApprove,
      maxAutoPayAmount: companyAutoPay,
      minConfidenceScore: companyMinConfidence,
    });
    setEditingCompanyPolicy(false);
  };

  const simResult = evaluatePolicyForInvoice(simAmount, simPropertyId, simConfidence);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
            Payer Policy & Dollar Threshold Rules
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enforce custom individual transaction dollar limits and AI auto-approval guardrails per commercial property entity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isPropertiesLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="text-slate-600">
              {isPropertiesLive ? 'Backend API Connected' : 'Local Mock Data'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAddPropertyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </button>

          {!canEdit && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Policy edits restricted. Switch to Property Manager or Admin role to modify.</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Company Baseline Policy Card + Live Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Company Default Policy Card (6 cols) */}
        <div className="lg:col-span-6 bg-white p-6 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Portfolio Default Baseline Policy
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Applied to properties without custom policy overrides
                </p>
              </div>

              {canEdit && (
                <button
                  onClick={() => setEditingCompanyPolicy(!editingCompanyPolicy)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{editingCompanyPolicy ? 'Cancel' : 'Edit Baseline'}</span>
                </button>
              )}
            </div>

            {editingCompanyPolicy ? (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Dollar Limit for AI Auto-Approval
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      value={companyAutoApprove}
                      onChange={(e) => setCompanyAutoApprove(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Invoices below this amount pass directly to approved state if confidence passes.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Dollar Limit for AI Auto-Pay Disbursement
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      value={companyAutoPay}
                      onChange={(e) => setCompanyAutoPay(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Direct automated Stripe Test CC execution without secondary human release button.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum AI Confidence Score Required (%)
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={companyMinConfidence}
                    onChange={(e) => setCompanyMinConfidence(Number(e.target.value))}
                    className="w-full accent-slate-900"
                  />
                  <div className="flex justify-between text-xs text-slate-500 font-mono mt-1">
                    <span>50%</span>
                    <span className="font-bold text-slate-900">{companyMinConfidence}%</span>
                    <span>99%</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveCompanyPolicy}
                    className="w-full py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    Save Baseline Policy
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="text-[11px] text-slate-500 block font-medium">Auto-Approve Cap</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    ${companyPolicy.maxAutoApproveAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-emerald-600 block mt-1">Auto routes if matched</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="text-[11px] text-slate-500 block font-medium">Auto-Pay Cap</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    ${companyPolicy.maxAutoPayAmount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Direct card charge</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <span className="text-[11px] text-slate-500 block font-medium">Min Confidence</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {companyPolicy.minConfidenceScore}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-1">Threshold gate</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between mt-4">
            <span>Enforced by AI Rule Engine across all commercial accounts payable transactions.</span>
          </div>
        </div>

        {/* Live Policy Simulator (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900 text-white p-6 rounded-lg border border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">
                Live Transaction Policy Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Test how a hypothetical invoice is routed under active payer policy rules
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">Payer (Property)</label>
                <select
                  value={simPropertyId}
                  onChange={(e) => setSimPropertyId(e.target.value)}
                  className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded py-1.5 px-2 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full text-xs font-mono bg-slate-800 text-white border border-slate-700 rounded py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">Confidence (%)</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={simConfidence}
                  onChange={(e) => setSimConfidence(Number(e.target.value))}
                  className="w-full text-xs font-mono bg-slate-800 text-white border border-slate-700 rounded py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Simulation Result Card */}
            <div className="p-4 bg-slate-800/90 rounded-lg border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Predicted Routing:</span>
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                    simResult.isAutoApproved
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : simResult.tier === 'property_manager'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {simResult.isAutoApproved
                    ? 'AUTO-APPROVED'
                    : simResult.tier === 'property_manager'
                    ? 'PROPERTY MANAGER (>$1K)'
                    : 'VP FINANCE (>$10K)'}
                </span>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed pt-1">
                <span className="font-semibold text-white">Rule Logic:</span> {simResult.reason}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-700">
                <span>Effective Property Cap: ${simResult.effectiveMaxAmount.toLocaleString()}</span>
                <span>Human-in-the-Loop: {simResult.requiresHumanReview ? 'Required' : 'Bypassed'}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Guarantees zero unauthorized automated disbursements above payer thresholds.</span>
          </div>
        </div>
      </div>

      {/* Property-Level Policy Overrides Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Commercial Property (Payer) Policy Configuration
            </h3>
            <p className="text-xs text-slate-500">
              Set customized dollar limits and approval rules for individual commercial properties
            </p>
          </div>

          <div className="text-xs text-slate-500">
            {properties.filter((p) => p.hasCustomPolicy).length} custom policies active
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-3">Property Entity (Payer)</th>
                <th className="px-4 py-3">Property Type</th>
                <th className="px-4 py-3 text-right">Auto-Approve Cap</th>
                <th className="px-4 py-3 text-right">Auto-Pay Cap</th>
                <th className="px-4 py-3 text-center">Min Confidence</th>
                <th className="px-4 py-3">Policy Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {properties.map((prop) => {
                return (
                  <tr key={prop.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{prop.name}</div>
                      {prop.ownerEntity && (
                        <div className="text-[11px] text-indigo-600 font-medium">{prop.ownerEntity}</div>
                      )}
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">{prop.address}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {prop.sqft ? `${prop.sqft.toLocaleString()} sq ft · ` : ''}Manager: {prop.managerName}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">
                      {prop.propertyType.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums">
                      ${prop.policy.maxAutoApproveAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 text-right tabular-nums">
                      ${prop.policy.maxAutoPayAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 text-center">
                      {prop.policy.minConfidenceScore}%
                    </td>
                    <td className="px-4 py-3">
                      {prop.hasCustomPolicy ? (
                        <span className="text-indigo-700 font-medium text-[11px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          Custom Payer Policy
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                          Company Default
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canEdit ? (
                        <button
                          onClick={() => handleOpenEditProp(prop)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Configure</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">View Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Property Policy Edit Modal Drawer */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Configure Payer Policy: {editingProperty.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set property-specific dollar thresholds and automation criteria
                </p>
              </div>

              <button
                onClick={() => setEditingProperty(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Dollar Threshold for AI Auto-Approval ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={propAutoApprove}
                    onChange={(e) => setPropAutoApprove(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-1.5 font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Invoices billing this property under this limit are automatically approved.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Dollar Limit for AI Auto-Pay Disbursement ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    value={propAutoPay}
                    onChange={(e) => setPropAutoPay(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-1.5 font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Minimum AI OCR & Match Confidence Required ({propMinConfidence}%)
                </label>
                <input
                  type="range"
                  min="60"
                  max="99"
                  value={propMinConfidence}
                  onChange={(e) => setPropMinConfidence(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propAutoPayEnabled}
                    onChange={(e) => setPropAutoPayEnabled(e.target.checked)}
                    className="rounded text-slate-900 accent-slate-900"
                  />
                  <span className="font-semibold text-slate-800">Enable Automated Stripe Test CC Payment</span>
                </label>
                <p className="text-[11px] text-slate-500 pl-5">
                  If disabled, all approved invoices require manual execution by the AP specialist.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingProperty(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePropertyPolicy}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
              >
                Save Property Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Property Modal */}
      <CreatePropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onSubmit={addNewProperty}
      />
    </div>
  );
};
