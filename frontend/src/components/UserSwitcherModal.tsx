import React from 'react';
import { useInvoiceStore } from '@/context/InvoiceContext';
import { UserAvatar } from '@/features/users/UserAvatar';
import { AppUser } from '@/types';
import { UserCheck, Building, X, Check } from 'lucide-react';

interface UserSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, setCurrentUser, availableUsers, properties } =
    useInvoiceStore();

  if (!isOpen) return null;

  const handleSelectUser = (user: AppUser) => {
    setCurrentUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#25362f]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[540px] rounded-xl border border-[#e6ebe8] shadow-2xl overflow-hidden animate-in fade-in duration-150">
        <div className="p-4 border-b border-[#e6ebe8] flex items-center justify-between bg-[#f8faf9]">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#16834a]" />
            <h3 className="text-sm font-bold text-[#14532d]">
              Switch User Persona
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close user switcher"
            className="text-[#68766f] hover:text-[#14532d] p-1 rounded-md hover:bg-[#e8f7ed] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-[#68766f] mb-3">
            Select an authenticated persona to test role-specific approval clearance and property-level data scope.
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
                role="button"
                tabIndex={0}
                onClick={() => handleSelectUser(user)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectUser(user);
                  }
                }}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-[#16834a] bg-[#e8f7ed]/50 shadow-xs ring-1 ring-[#16834a]'
                    : 'border-[#e6ebe8] hover:border-[#d7ebdd] hover:bg-[#f8faf9]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <UserAvatar
                    userId={user.id}
                    name={user.name}
                    role={user.role}
                    avatarUrl={user.avatarUrl}
                    sizeClassName="size-10"
                    highlightRing={isSelected}
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#25362f]">
                        {user.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide bg-[#e8f7ed] text-[#16834a] border border-[#d7ebdd]">
                        {String(user.role).replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#25362f] font-medium truncate">
                      {user.title} ·{' '}
                      <span className="text-[#68766f] font-normal">
                        {user.email}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-[#68766f]">
                      <Building className="w-3 h-3 text-[#98a29c] shrink-0" />
                      <span className="truncate">{assignedProps}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-[#16834a] text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-[#d7ebdd]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-[#f8faf9] border-t border-[#e6ebe8] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-[#25362f] hover:text-[#14532d] bg-white border border-[#e6ebe8] rounded-md shadow-2xs hover:bg-[#f8faf9] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
