import React from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { UserRole } from '../types';
import { ROLE_PROFILES } from '../data/mockData';
import { Search, Plus, ShieldCheck, Building2, UserCheck, ChevronDown } from 'lucide-react';

interface TopBarProps {
  onOpenNewBill: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenNewBill }) => {
  const {
    activeRole,
    setActiveRole,
    currentProfile,
    searchQuery,
    setSearchQuery,
    propertyFilter,
    setPropertyFilter,
    properties,
    invoices,
  } = useInvoiceStore();

  const pendingCount = invoices.filter((inv) => inv.status === 'pending_approval').length;
  const exceptionCount = invoices.filter((inv) => inv.status === 'exception').length;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0 sticky top-0 z-30">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-wider">
          PP
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            PropPay Automation
          </span>
          <span className="hidden lg:inline text-xs text-slate-400 ml-2">
            Commercial AP & Policy Engine
          </span>
        </div>
      </div>

      {/* Zone 2: Search & Property Context */}
      <div className="flex-1 max-w-2xl flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice #, vendor, or property..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="relative shrink-0">
          <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 appearance-none cursor-pointer"
          >
            <option value="all">All Managed Properties (5)</option>
            {properties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Zone 3: Live Role Switcher & Action CTA */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Role Switcher Pill Container */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <UserCheck className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-semibold text-slate-700">Role:</span>
          </div>

          <select
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value as UserRole)}
            className="text-xs font-medium bg-white text-slate-900 py-1 px-2.5 rounded-md border border-slate-200 shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
          >
            {(Object.keys(ROLE_PROFILES) as UserRole[]).map((r) => {
              const prof = ROLE_PROFILES[r];
              const limitLabel =
                prof.approvalLimit === Infinity
                  ? 'Unlimited Auth'
                  : prof.approvalLimit === 0
                  ? 'Audit Mode'
                  : `≤ $${prof.approvalLimit.toLocaleString()}`;
              return (
                <option key={r} value={r}>
                  {prof.title} ({limitLabel})
                </option>
              );
            })}
          </select>

          <div className="px-2 text-xs text-slate-500 hidden xl:flex items-center gap-1">
            <span>·</span>
            <span>{currentProfile.userName}</span>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onOpenNewBill}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Bill Intake</span>
        </button>
      </div>
    </header>
  );
};
