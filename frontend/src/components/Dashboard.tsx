import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  DollarSign,
  TrendingUp,
  Sparkles,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { InvoiceStatus } from '../types';

export const Dashboard: React.FC = () => {
  const {
    invoices,
    activities,
    setActiveTab,
    setSelectedInvoiceId,
    addNewInvoice,
    propertyFilter,
    properties,
    currentProfile
  } = useInvoiceStore();

  const [dragOver, setDragOver] = useState(false);

  // Filter invoices if property is selected
  const filteredInvoices = invoices.filter((inv) =>
    propertyFilter === 'all' ? true : inv.propertyId === propertyFilter
  );

  // Financial aggregates
  const totalInvoicesCount = filteredInvoices.length;
  const totalInvoicesAmount = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const pendingApprovals = filteredInvoices.filter((inv) => inv.status === 'pending_approval');
  const pendingAmount = pendingApprovals.reduce((sum, inv) => sum + inv.amount, 0);

  const activeExceptions = filteredInvoices.filter((inv) => inv.status === 'exception');
  const exceptionsAmount = activeExceptions.reduce((sum, inv) => sum + inv.amount, 0);

  const paidInvoices = filteredInvoices.filter((inv) => inv.status === 'paid');
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Pipeline stage counts
  const pipelineStages: { id: InvoiceStatus; label: string; count: number; color: string }[] = [
    { id: 'intake', label: '1. Intake', count: filteredInvoices.filter((i) => i.status === 'intake').length, color: 'bg-slate-400' },
    { id: 'extracted', label: '2. Extracted', count: filteredInvoices.filter((i) => i.status === 'extracted').length, color: 'bg-blue-500' },
    { id: 'matched', label: '3. Matched', count: filteredInvoices.filter((i) => i.status === 'matched').length, color: 'bg-indigo-500' },
    { id: 'pending_approval', label: '4. Pending Approval', count: pendingApprovals.length, color: 'bg-amber-500' },
    { id: 'approved', label: '5. Approved', count: filteredInvoices.filter((i) => i.status === 'approved').length, color: 'bg-teal-500' },
    { id: 'paid', label: '6. Paid Out', count: paidInvoices.length, color: 'bg-emerald-600' },
    { id: 'exception', label: '7. Exceptions', count: activeExceptions.length, color: 'bg-rose-500' },
  ];

  const handleSimulateQuickDrop = (preset: 'utility' | 'maintenance' | 'capital') => {
    if (preset === 'utility') {
      addNewInvoice({
        invoiceNumber: `INV-${Math.floor(2000 + Math.random() * 8000)}`,
        vendorId: 'ven-pacific-water',
        propertyId: 'prop-grandview',
        amount: 320.40,
        intakeMethod: 'pdf_upload',
        documentType: 'utility',
        notes: 'Chilled water loop submetering intake.',
      });
    } else if (preset === 'maintenance') {
      addNewInvoice({
        invoiceNumber: `INV-${Math.floor(2000 + Math.random() * 8000)}`,
        vendorId: 'ven-apex-hvac',
        propertyId: 'prop-harborfront',
        amount: 1850.00,
        intakeMethod: 'pdf_upload',
        documentType: 'maintenance',
        notes: 'Belt replacement & fan motor greasing on air handler AHU-3.',
      });
    } else {
      addNewInvoice({
        invoiceNumber: `INV-${Math.floor(2000 + Math.random() * 8000)}`,
        vendorId: 'ven-vanguard-roofing',
        propertyId: 'prop-metropolitan',
        amount: 14200.00,
        intakeMethod: 'pdf_upload',
        documentType: 'capital_expenditure',
        notes: 'Flashing repair and gutter guard installation.',
      });
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Title & Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Accounts Payable Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-property invoice pipeline · AI OCR extraction · Payer policy automation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-md font-mono">
            Active Policy Target: <span className="font-semibold text-slate-900">{propertyFilter === 'all' ? 'All Portfolios' : properties.find(p => p.id === propertyFilter)?.name}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monthly Invoices */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Total Bills Ingested</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ${totalInvoicesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span className="font-semibold text-slate-700 font-mono">{totalInvoicesCount}</span> invoices across portfolio
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-amber-700 mb-2">
            <span>Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>
              <span className="font-semibold text-amber-700 font-mono">{pendingApprovals.length}</span> awaiting review
            </span>
            <button
              onClick={() => setActiveTab('approvals')}
              className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              Review Queue <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Active Exceptions */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-rose-700 mb-2">
            <span>Active Exceptions</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ${exceptionsAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>
              <span className="font-semibold text-rose-700 font-mono">{activeExceptions.length}</span> require triage
            </span>
            <button
              onClick={() => setActiveTab('exceptions')}
              className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              Resolve <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Paid Out MTD */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-700 mb-2">
            <span>Settled & Paid Out</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>
              <span className="font-semibold text-slate-700 font-mono">{paidInvoices.length}</span> disbursements
            </span>
            <button
              onClick={() => setActiveTab('payments')}
              className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              Payment Hub <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Bill Processing Pipeline Bar Chart Widget */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Bill Processing Automation Pipeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status progression from document ingestion through policy evaluation to payment settlement
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Updated in real-time
          </div>
        </div>

        {/* Visual Pipeline Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {pipelineStages.map((stage) => {
            return (
              <div
                key={stage.id}
                onClick={() => {
                  if (stage.id === 'intake' || stage.id === 'extracted') setActiveTab('intake');
                  else if (stage.id === 'matched') setActiveTab('matching');
                  else if (stage.id === 'pending_approval') setActiveTab('approvals');
                  else if (stage.id === 'approved' || stage.id === 'paid') setActiveTab('payments');
                  else if (stage.id === 'exception') setActiveTab('exceptions');
                }}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-md transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
                  <span className="truncate group-hover:text-slate-900">{stage.label}</span>
                  <span className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                    {stage.count}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(100, Math.max(10, (stage.count / (totalInvoicesCount || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2-Column Split: Dropzone & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quick Upload Dropzone & Sample Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleSimulateQuickDrop('maintenance');
            }}
            className={`p-6 rounded-lg border-2 border-dashed transition-all bg-white flex flex-col items-center justify-center text-center ${
              dragOver
                ? 'border-indigo-600 bg-indigo-50/50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Drag & Drop Invoice File
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
              Upload PDF or TIFF document for instant OCR line-item extraction and payee-payer matching.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => handleSimulateQuickDrop('utility')}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
              >
                + Utility ($320)
              </button>
              <button
                onClick={() => handleSimulateQuickDrop('maintenance')}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
              >
                + Maintenance ($1.8k)
              </button>
              <button
                onClick={() => handleSimulateQuickDrop('capital')}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
              >
                + Capital ($14.2k)
              </button>
            </div>
          </div>

          {/* Quick Payer Policy Callout */}
          <div className="p-4 bg-slate-900 text-white rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Payer Automation Policy Active
                </span>
              </div>
              <button
                onClick={() => setActiveTab('policy')}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                Configure <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Default Auto-Approve Cap: <span className="font-mono font-bold text-white">$1,500.00</span>. Invoices above threshold or with confidence &lt;85% automatically escalate to Property Manager or VP Finance.
            </p>
          </div>
        </div>

        {/* Right Column: Real-Time Live Activity Feed (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">
                Live System Activity Stream
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {activities.length} recent events
              </span>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {activities.map((act) => {
                return (
                  <div
                    key={act.id}
                    onClick={() => {
                      if (act.invoiceId) {
                        setSelectedInvoiceId(act.invoiceId);
                        if (act.type === 'intake' || act.type === 'extraction') setActiveTab('intake');
                        else if (act.type === 'match') setActiveTab('matching');
                        else if (act.type === 'approval') setActiveTab('approvals');
                        else if (act.type === 'payment') setActiveTab('payments');
                        else if (act.type === 'exception') setActiveTab('exceptions');
                      }
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 flex items-start gap-3 transition-colors cursor-pointer"
                  >
                    <div className="mt-0.5 shrink-0">
                      {act.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                      {act.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                      {act.status === 'error' && <ShieldAlert className="w-4 h-4 text-rose-600" />}
                      {act.status === 'info' && <FileCheck2 className="w-4 h-4 text-blue-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {act.title}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                          {act.timestamp}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-0.5">
                        {act.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Real-time status updates broadcasted to all logged-in roles.</span>
            <button
              onClick={() => setActiveTab('audit')}
              className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1"
            >
              Full Audit Log <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Recent Invoices Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Active Invoice Pipeline
            </h3>
            <p className="text-xs text-slate-500">
              Showing {filteredInvoices.length} invoices across active commercial properties
            </p>
          </div>

          <button
            onClick={() => setActiveTab('approvals')}
            className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
          >
            Go to Approvals <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Payee (Vendor)</th>
                <th className="px-4 py-3">Payer (Property)</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Confidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredInvoices.map((inv) => {
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {inv.vendorName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {inv.propertyName}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {inv.dueDate}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums">
                      ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          inv.confidenceScore >= 90
                            ? 'text-emerald-700'
                            : inv.confidenceScore >= 60
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {inv.confidenceScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs font-medium text-slate-700">
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedInvoiceId(inv.id);
                          if (inv.status === 'intake' || inv.status === 'extracted') setActiveTab('intake');
                          else if (inv.status === 'matched') setActiveTab('matching');
                          else if (inv.status === 'pending_approval') setActiveTab('approvals');
                          else if (inv.status === 'paid') setActiveTab('audit');
                          else if (inv.status === 'exception') setActiveTab('exceptions');
                          else setActiveTab('payments');
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                      >
                        Open Workspace
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
  );
};
