import React from 'react';
import { useInvoiceStore } from '../context/InvoiceContext';
import { AppUser } from '../types';
import { UserCheck, Shield, Building, X, Check } from 'lucide-react';

interface UserSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser, availableUsers, properties } = useInvoiceStore();

  if (!isOpen) return null;

  const handleSelectUser = (user: AppUser) => {
    setCurrentUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Switch User Persona</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-500 mb-3">
            Select an authenticated persona to test role-specific workflows and property-level data access restrictions.
          </p>

          {availableUsers.map((user) => {
            const isSelected = user.id === currentUser.id;
            const assignedProps =
              user.assignedPropertyIds.length === 0
                ? 'Portfolio-Wide (All Properties)'
                : user.assignedPropertyIds
                    .map((id) => properties.find((p) => p.id === id)?.name || id)
                    .join(', ');

            return (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{user.name}</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold capitalize bg-slate-100 text-slate-700 border border-slate-200">
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 font-medium">
                    {user.title} · <span className="text-slate-400 font-normal">{user.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                    <Building className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{assignedProps}</span>
                  </div>
                </div>

                <div className="shrink-0 mt-0.5">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-300" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md shadow-2xs hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

