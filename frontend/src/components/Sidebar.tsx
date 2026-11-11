import React, { useState } from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { NavTab } from '../types';
import { UserSwitcherModal } from './UserSwitcherModal';
import {
  LayoutDashboard,
  FileScan,
  GitCompare,
  SlidersHorizontal,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  History,
  Shield,
  Building,
  UserCheck
} from 'lucide-react';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    invoices,
    currentUser,
    currentProfile,
    scopedProperties,
    properties,
    vendors
  } = useInvoiceStore();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  const extractedCount = invoices.filter((inv) => inv.status === 'extracted').length;
  const pendingCount = invoices.filter((inv) => inv.status === 'pending_approval').length;
  const readyPaymentCount = invoices.filter((inv) => inv.status === 'approved' && inv.paymentInfo?.status === 'unpaid').length;
  const exceptionCount = invoices.filter((inv) => inv.status === 'exception').length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'intake', label: 'Bill Intake & Extraction', icon: FileScan, badge: extractedCount > 0 ? extractedCount : undefined },
    { id: 'matching', label: 'Property & Vendor Matching', icon: GitCompare },
    { id: 'policy', label: 'Payer Policy & Thresholds', icon: SlidersHorizontal },
    { id: 'approvals', label: 'Approvals Queue', icon: CheckCircle2, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'payments', label: 'Payment Hub', icon: CreditCard, badge: readyPaymentCount > 0 ? readyPaymentCount : undefined },
    { id: 'exceptions', label: 'Exception Inbox', icon: AlertTriangle, badge: exceptionCount > 0 ? exceptionCount : undefined, badgeColor: 'text-amber-700 bg-amber-50 border-amber-200' },
    { id: 'audit', label: 'Audit & History Log', icon: History },
  ];

  return (
    <>
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
        <div className="p-4">
          {/* Workspace Identifier */}
          <div className="px-3 py-2.5 mb-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Building className="w-4 h-4 text-slate-400" />
              <span>Commercial Real Estate AP</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {scopedProperties.length} Properties · {vendors.length} Vendors Active
            </div>
          </div>

          {/* Navigation Section */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-xs font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.2 rounded font-medium border ${
                        item.badgeColor || (isActive ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-800 text-slate-400 border-slate-700')
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role & Privilege Footer with Persona Switcher Trigger */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {currentUser.title}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                  Auth:{' '}
                  {currentProfile.approvalLimit === Infinity
                    ? 'Unlimited'
                    : currentProfile.approvalLimit === 0
                    ? 'Auditor (Read-Only)'
                    : `$${currentProfile.approvalLimit.toLocaleString()}`}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsSwitcherOpen(true)}
              title="Switch user persona"
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <UserSwitcherModal isOpen={isSwitcherOpen} onClose={() => setIsSwitcherOpen(false)} />
    </>
  );
};
