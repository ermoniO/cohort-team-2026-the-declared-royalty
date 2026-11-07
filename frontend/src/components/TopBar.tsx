import React from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { Search, Plus, Building2, ChevronDown, ShieldCheck } from 'lucide-react';

interface TopBarProps {
  onOpenNewBill: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenNewBill }) => {
  const {
    currentUser,
    scopedProperties,
    currentProfile,
    searchQuery,
    setSearchQuery,
    propertyFilter,
    setPropertyFilter,
  } = useInvoiceStore();

  const isRestrictedManager = currentUser.assignedPropertyIds && currentUser.assignedPropertyIds.length > 0;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-6 shrink-0 sticky top-0 z-30 select-none">
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

      {/* Zone 2: Search & Scoped Property Filter */}
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
            <option value="all">
              {isRestrictedManager
                ? `Assigned Properties (${scopedProperties.length})`
                : `All Managed Properties (${scopedProperties.length})`}
            </option>
            {scopedProperties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Zone 3: Authenticated User Status & Action CTA */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Read-Only Authenticated Session Badge */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-200 text-slate-700">
                {currentProfile.title.split(' ')[0]}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              {isRestrictedManager ? `${scopedProperties.length} Properties Scope` : 'Portfolio-Wide Scope'}
            </span>
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
