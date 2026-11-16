import React, { useState } from 'react';
import { useInvoiceStore } from '@/context/InvoiceContext';
import { UserAvatar } from '@/features/users/UserAvatar';
import { UserSwitcherModal } from './UserSwitcherModal';
import { SelectDropdown } from './ui/SelectDropdown';
import {
  Search,
  Building2,
  ChevronDown,
  Menu,
  PanelLeftClose,
  Receipt,
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    currentUser,
    scopedProperties,
    currentProfile,
    searchQuery,
    setSearchQuery,
    propertyFilter,
    setPropertyFilter,
    isSidebarOpen,
    toggleSidebar,
  } = useInvoiceStore();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const isRestrictedManager =
    currentUser.assignedPropertyIds &&
    currentUser.assignedPropertyIds.length > 0;

  const limitSummary =
    currentProfile.approvalLimit === Infinity
      ? 'Unlimited Auth'
      : currentProfile.approvalLimit <= 0
        ? 'Read-Only'
        : `$${currentProfile.approvalLimit.toLocaleString()} Limit`;

  const scopeSummary = isRestrictedManager
    ? `${scopedProperties.length} Prop Scope`
    : 'Portfolio-Wide';

  return (
    <>
      <header className="h-[60px] bg-white border-b border-[#e6ebe8] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30 select-none">
        {/* Left: Sidebar Slide Toggle + App Brand + Global Search & Property Scope */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            aria-label={
              isSidebarOpen
                ? 'Hide navigation menu'
                : 'Open navigation menu'
            }
            title={
              isSidebarOpen ? 'Collapse navigation sidebar' : 'Open navigation sidebar'
            }
            className="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] border border-[#e6ebe8] bg-white text-[#68766f] hover:bg-[#f8faf9] hover:text-[#14532d] shadow-2xs transition-colors cursor-pointer"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>

          <div className="flex items-center gap-2.5 shrink-0 pr-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#16834a] text-white shadow-xs">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-[#14532d] whitespace-nowrap hidden sm:inline">
              Property Bill Automation
            </span>
          </div>

          <div className="flex-1 max-w-2xl flex items-center gap-3 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#98a29c] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Global invoice search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice #, vendor, or property..."
                className="w-full h-[36px] pl-9 pr-4 text-xs bg-[#f8faf9] border border-[#e6ebe8] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] focus:bg-white transition-all text-[#25362f] placeholder-[#98a29c]"
              />
            </div>

            <div className="shrink-0 hidden sm:block min-w-[190px]">
              <SelectDropdown
                ariaLabel="Property scope filter"
                value={propertyFilter}
                onChange={setPropertyFilter}
                icon={<Building2 className="w-3.5 h-3.5 text-[#16834a]" />}
                buttonClassName="h-[36px] bg-[#f8faf9] hover:bg-white"
                menuClassName="min-w-[230px]"
                options={[
                  {
                    value: 'all',
                    label: isRestrictedManager
                      ? `Assigned Properties (${scopedProperties.length})`
                      : `All Properties (${scopedProperties.length})`,
                  },
                  ...scopedProperties.map((prop) => ({
                    value: prop.id,
                    label: prop.name,
                  })),
                ]}
              />
            </div>
          </div>
        </div>

        {/* Right: Single User Identity & Persona Switcher Trigger */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(true)}
            aria-label={`Switch active persona (current: ${currentUser.name})`}
            className="flex items-center gap-2.5 bg-white hover:bg-[#f8faf9] px-2.5 py-1 rounded-[10px] border border-[#e6ebe8] hover:border-[#d7ebdd] transition-colors cursor-pointer"
          >
            <UserAvatar
              userId={currentUser.id}
              name={currentUser.name}
              role={currentUser.role}
              avatarUrl={currentUser.avatarUrl}
              sizeClassName="size-8"
            />
            <div className="hidden md:flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#25362f]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-[#e8f7ed] text-[#16834a]">
                  {String(currentUser.role).replace(/_/g, ' ')}
                </span>
              </div>
              <span className="text-[10px] text-[#68766f]">
                {scopeSummary} · {limitSummary}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#98a29c] shrink-0" />
          </button>
        </div>
      </header>

      <UserSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />
    </>
  );
};
