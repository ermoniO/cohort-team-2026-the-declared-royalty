import React from 'react';
import { InvoiceProvider, useInvoiceStore } from './context/InvoiceContext';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InvoicesView } from './components/InvoicesView';
import { ActionRequiredPage } from './components/ActionRequiredPage';
import { PaymentHub } from './components/PaymentHub';
import { MasterDataHubPage } from './components/MasterDataHubPage';
import { PayerPolicyRules } from './components/PayerPolicyRules';
import { AuditHistoryLog } from './components/AuditHistoryLog';
import { NewBillModal } from './components/NewBillModal';

const AppContent: React.FC = () => {
  const { activeTab, isNewBillOpen, setIsNewBillOpen } = useInvoiceStore();

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col text-[#25362f] font-sans selection:bg-[#16834a] selection:text-white antialiased">
      {/* Top Header */}
      <TopBar />

      {/* Main Workspace: Option A Inline Collapsible Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-[#f8faf9] min-h-[calc(100vh-4rem)]">
          {activeTab === 'overview' && <Dashboard />}
          {activeTab === 'invoices' && <InvoicesView />}
          {activeTab === 'action_required' && <ActionRequiredPage />}
          {activeTab === 'disbursements' && <PaymentHub />}
          {activeTab === 'master_data' && <MasterDataHubPage />}
          {activeTab === 'policies' && <PayerPolicyRules />}
          {activeTab === 'audit_ledger' && <AuditHistoryLog />}
        </main>
      </div>

      {/* Standardized New Bill Upload Modal */}
      <NewBillModal
        isOpen={isNewBillOpen}
        onClose={() => setIsNewBillOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <InvoiceProvider>
      <AppContent />
    </InvoiceProvider>
  );
}

export default App;
