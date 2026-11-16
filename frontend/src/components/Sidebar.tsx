import React from 'react';
import { X } from 'lucide-react';
import {
  NAVIGATION_SECTIONS,
  computeActionRequiredCount,
  computeDisbursementsCount,
} from '@/config/navigation';
import { useInvoiceStore } from '@/context/InvoiceContext';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    invoices,
    scopedProperties,
    vendors,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useInvoiceStore();

  const actionRequiredCount = computeActionRequiredCount(invoices);
  const disbursementsCount = computeDisbursementsCount(invoices);

  const badgeFor = (
    badgeKey?: 'actionRequiredCount' | 'disbursementsCount',
  ): number | undefined => {
    if (badgeKey === 'actionRequiredCount') {
      return actionRequiredCount > 0 ? actionRequiredCount : undefined;
    }
    if (badgeKey === 'disbursementsCount') {
      return disbursementsCount > 0 ? disbursementsCount : undefined;
    }
    return undefined;
  };

  return (
    <aside
      aria-label="Primary sidebar navigation"
      aria-hidden={!isSidebarOpen}
      className={`bg-white shrink-0 select-none overflow-hidden transition-[width,opacity] duration-200 ease-out flex flex-col ${
        isSidebarOpen
          ? 'w-[264px] border-r border-[#e6ebe8] opacity-100'
          : 'w-0 border-r-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="w-[264px] h-full flex flex-col">
        {/* Compact Portfolio Scope Header + Collapse Control */}
        <div className="h-[48px] shrink-0 px-5 flex items-center justify-between gap-3 border-b border-[#e6ebe8] bg-[#f8faf9]/60">
          <div className="text-[11px] font-medium text-[#68766f] truncate">
            {scopedProperties.length} Properties · {vendors.length} Vendors
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Collapse navigation sidebar"
            title="Hide navigation sidebar"
            className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#e6ebe8] bg-white text-[#68766f] hover:bg-[#f8faf9] hover:text-[#14532d] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Two-Tier Navigation Sections: OPERATIONS vs. ADMIN & SETUP */}
        <nav
          aria-label="Primary navigation"
          className="flex-1 overflow-y-auto px-4 py-5 space-y-6"
        >
          {NAVIGATION_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#98a29c]">
                {section.title}
              </p>

              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const badgeValue = badgeFor(item.badgeKey);

                  const badgeClasses =
                    item.badgeKey === 'actionRequiredCount'
                      ? isActive
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                      : isActive
                        ? 'bg-white text-[#14532d] border-[#d7ebdd]'
                        : 'bg-[#e8f7ed] text-[#16834a] border-[#d7ebdd]';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex h-10 w-full items-center justify-between gap-2.5 rounded-[8px] px-3 text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#e8f7ed] text-[#14532d] font-semibold'
                          : 'bg-white text-[#68766f] hover:bg-[#f8faf9] hover:text-[#25362f] font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-[18px] h-[18px] shrink-0 ${
                            isActive ? 'text-[#16834a]' : 'text-[#68766f]'
                          }`}
                        />
                        <span className="truncate text-[13px]">{item.label}</span>
                      </div>

                      {badgeValue !== undefined && (
                        <span
                          className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md font-semibold border leading-none ${badgeClasses}`}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};
