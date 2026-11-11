/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InvoiceProvider, useInvoiceStore } from './context/InvoiceContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { BillIntakeExtraction } from './components/BillIntakeExtraction';
import { PropertyVendorMatching } from './components/PropertyVendorMatching';
import { PayerPolicyRules } from './components/PayerPolicyRules';
import { ApprovalsQueue } from './components/ApprovalsQueue';
import { PaymentHub } from './components/PaymentHub';
import { ExceptionInbox } from './components/ExceptionInbox';
import { AuditHistoryLog } from './components/AuditHistoryLog';
import { NewBillModal } from './components/NewBillModal';

const AppContent: React.FC = () => {
  const { activeTab } = useInvoiceStore();
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans selection:bg-slate-900 selection:text-white antialiased">
      {/* Top Header */}
      <TopBar onOpenNewBill={() => setIsNewBillOpen(true)} />

      {/* Main Workspace: Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-slate-50 min-h-[calc(100vh-4rem)]">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'intake' && <BillIntakeExtraction />}
          {activeTab === 'matching' && <PropertyVendorMatching />}
          {activeTab === 'policy' && <PayerPolicyRules />}
          {activeTab === 'approvals' && <ApprovalsQueue />}
          {activeTab === 'payments' && <PaymentHub />}
          {activeTab === 'exceptions' && <ExceptionInbox />}
          {activeTab === 'audit' && <AuditHistoryLog />}
        </main>
      </div>

      {/* New Bill Intake Modal */}
      <NewBillModal isOpen={isNewBillOpen} onClose={() => setIsNewBillOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <InvoiceProvider>
      <AppContent />
    </InvoiceProvider>
  );
}
