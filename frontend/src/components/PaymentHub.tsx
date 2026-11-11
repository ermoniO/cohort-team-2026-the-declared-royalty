import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Invoice, PaymentMethod } from '../types';
import {
  CreditCard,
  Building2,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Send,
  Zap,
  ArrowRight,
  X
} from 'lucide-react';

export const PaymentHub: React.FC = () => {
  const {
    invoices,
    executeStripePayment,
    batchExecutePayments,
    currentProfile,
    activeRole,
    setSelectedInvoiceId,
    setActiveTab
  } = useInvoiceStore();

  const [activeRail, setActiveRail] = useState<PaymentMethod>('CREDIT_CARD');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [selectedInvoicesForBatch, setSelectedInvoicesForBatch] = useState<string[]>([]);

  // Stripe card entry simulation form
  const [testCardNumber, setTestCardNumber] = useState('4242 4242 4242 4242');
  const [testExp, setTestExp] = useState('12/28');
  const [testCvc, setTestCvc] = useState('123');
  const [testPostal, setTestPostal] = useState('90210');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionResult, setTransactionResult] = useState<{
    success?: boolean;
    message?: string;
    chargeId?: string;
  } | null>(null);

  // Filter approved invoices ready for payment
  const readyInvoices = invoices.filter(
    (inv) => inv.status === 'approved' && inv.paymentInfo?.status === 'unpaid'
  );

  const settledInvoices = invoices.filter(
    (inv) => inv.status === 'paid'
  );

  const handleOpenStripeModal = (inv: Invoice) => {
    setPayingInvoice(inv);
    setTransactionResult(null);
    setTestCardNumber('4242 4242 4242 4242');
  };

  const handleExecutePayment = async (cardType: 'success' | 'decline' | 'insufficient') => {
    if (!payingInvoice) return;
    setIsProcessing(true);
    setTransactionResult(null);

    const res = await executeStripePayment(payingInvoice.id, cardType);
    setIsProcessing(false);
    setTransactionResult(res);
  };

  const handleBatchRelease = async () => {
    if (selectedInvoicesForBatch.length === 0) return;
    setIsProcessing(true);
    await batchExecutePayments(selectedInvoicesForBatch);
    setIsProcessing(false);
    setSelectedInvoicesForBatch([]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Disbursement Hub & Stripe Test Execution
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated multi-rail payment router · Stripe Test Credit Card simulation · Real-time ledger settlement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-md">
            Ready to Disburse: <span className="font-bold text-slate-900">${readyInvoices.reduce((s, i) => s + i.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> ({readyInvoices.length} bills)
          </div>
        </div>
      </div>

      {/* Payment Rails Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'CREDIT_CARD', label: 'Credit Card (Stripe TEST)', desc: 'Direct instant test card charge' },
          { id: 'ACH', label: 'ACH Direct Debit', desc: 'NACHA standard bank transfer' },
          { id: 'CHECK', label: 'Check Print', desc: 'Physical lockbox check checkrun' },
        ].map((rail) => {
          const isSelected = activeRail === rail.id;
          return (
            <button
              key={rail.id}
              onClick={() => setActiveRail(rail.id as PaymentMethod)}
              className={`p-3.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="text-xs font-bold">{rail.label}</div>
              <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                {rail.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Payment Execution Queue Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Approved Invoices Awaiting Disbursement ({readyInvoices.length})
            </h3>
            <p className="text-xs text-slate-500">
              Invoices approved by policy rule or authorized human manager
            </p>
          </div>

          {readyInvoices.length > 0 && (
            <button
              onClick={() => {
                if (selectedInvoicesForBatch.length === readyInvoices.length) {
                  setSelectedInvoicesForBatch([]);
                } else {
                  setSelectedInvoicesForBatch(readyInvoices.map((i) => i.id));
                }
              }}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              {selectedInvoicesForBatch.length === readyInvoices.length ? 'Deselect All' : 'Select All Ready'}
            </button>
          )}
        </div>

        {readyInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No invoices currently awaiting disbursement. All approved bills have been settled.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedInvoicesForBatch.length === readyInvoices.length && readyInvoices.length > 0}
                      onChange={() => {
                        if (selectedInvoicesForBatch.length === readyInvoices.length) setSelectedInvoicesForBatch([]);
                        else setSelectedInvoicesForBatch(readyInvoices.map((i) => i.id));
                      }}
                      className="rounded text-slate-900 accent-slate-900"
                    />
                  </th>
                  <th className="px-4 py-3">Invoice Details</th>
                  <th className="px-4 py-3">Payer Property</th>
                  <th className="px-4 py-3 text-right">Amount Due</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Approval Reference</th>
                  <th className="px-4 py-3 text-right">Execute</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {readyInvoices.map((inv) => {
                  const isSelected = selectedInvoicesForBatch.includes(inv.id);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedInvoicesForBatch((prev) =>
                              prev.includes(inv.id) ? prev.filter((i) => i !== inv.id) : [...prev, inv.id]
                            );
                          }}
                          className="rounded text-slate-900 accent-slate-900"
                        />
                      </td>

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
                        <span className="font-mono text-[11px] text-slate-600 uppercase">
                          {inv.paymentInfo?.method.replace('_', ' ') || 'STRIPE TEST CC'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        <span className="font-semibold text-emerald-700">Policy Approved</span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenStripeModal(inv)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pay with Stripe</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Batch Action Strip */}
        {selectedInvoicesForBatch.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">
              {selectedInvoicesForBatch.length} invoice(s) selected for disbursement
            </span>
            <button
              onClick={handleBatchRelease}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Release Batch Payments (${readyInvoices.filter(i => selectedInvoicesForBatch.includes(i.id)).reduce((s, i) => s + i.amount, 0).toLocaleString()})</span>
            </button>
          </div>
        )}
      </div>

      {/* Settled Disbursements Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Recent Settled Disbursements ({settledInvoices.length})
            </h3>
            <p className="text-xs text-slate-500">
              Completed transactions with Stripe charge IDs and bank authorization codes
            </p>
          </div>
          <button
            onClick={() => setActiveTab('audit')}
            className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
          >
            Full Audit Ledger <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Payee Vendor</th>
                <th className="px-4 py-3">Payer Property</th>
                <th className="px-4 py-3 text-right">Settled Amount</th>
                <th className="px-4 py-3">Stripe Charge Ref</th>
                <th className="px-4 py-3">Settlement Date</th>
                <th className="px-4 py-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {settledInvoices.map((inv) => (
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
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-right tabular-nums">
                    ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                    {inv.paymentInfo?.transactionRef || 'ch_3M9qX2...'}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                    {inv.paymentInfo?.paidAt || '2026-11-03 10:22'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedInvoiceId(inv.id);
                        setActiveTab('audit');
                      }}
                      className="text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      Audit Trail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe TEST CC Modal Component */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  Stripe TEST Credit Card Terminal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paying {payingInvoice.invoiceNumber} · ${payingInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <button
                onClick={() => setPayingInvoice(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Presets selector */}
              <div>
                <label className="block font-semibold text-slate-600 uppercase tracking-wider text-[10px] mb-2">
                  Quick Fill Stripe Test Cards
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTestCardNumber('4242 4242 4242 4242')}
                    className={`p-2 rounded border text-left transition-colors ${
                      testCardNumber.startsWith('4242')
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Success Card</div>
                    <div className="text-[10px] text-slate-500 font-mono">4242...</div>
                  </button>

                  <button
                    onClick={() => setTestCardNumber('4000 0000 0000 0002')}
                    className={`p-2 rounded border text-left transition-colors ${
                      testCardNumber.endsWith('0002')
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Decline Card</div>
                    <div className="text-[10px] text-slate-500 font-mono">...0002</div>
                  </button>

                  <button
                    onClick={() => setTestCardNumber('4000 0000 0000 9995')}
                    className={`p-2 rounded border text-left transition-colors ${
                      testCardNumber.endsWith('9995')
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold text-[11px]">Insufficient</div>
                    <div className="text-[10px] text-slate-500 font-mono">...9995</div>
                  </button>
                </div>
              </div>

              {/* Card Form */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={testCardNumber}
                    onChange={(e) => setTestCardNumber(e.target.value)}
                    className="w-full font-mono text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Expires
                    </label>
                    <input
                      type="text"
                      value={testExp}
                      onChange={(e) => setTestExp(e.target.value)}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      value={testCvc}
                      onChange={(e) => setTestCvc(e.target.value)}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ZIP
                    </label>
                    <input
                      type="text"
                      value={testPostal}
                      onChange={(e) => setTestPostal(e.target.value)}
                      className="w-full font-mono text-xs px-3 py-2 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Transaction Result Feedback */}
              {transactionResult && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    transactionResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {transactionResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{transactionResult.message}</span>
                  </div>
                  {transactionResult.chargeId && (
                    <div className="text-[10px] font-mono mt-1 text-emerald-700">
                      Charge ID: {transactionResult.chargeId}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Close
              </button>

              <button
                disabled={isProcessing}
                onClick={() =>
                  handleExecutePayment(
                    testCardNumber.endsWith('0002')
                      ? 'decline'
                      : testCardNumber.endsWith('9995')
                      ? 'insufficient'
                      : 'success'
                  )
                }
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing with Stripe...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Charge ${payingInvoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
