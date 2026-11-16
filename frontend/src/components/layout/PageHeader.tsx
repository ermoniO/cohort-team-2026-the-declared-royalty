import React from 'react';

export interface PageHeaderAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  primaryAction?: PageHeaderAction;
  secondaryAction?: PageHeaderAction;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  children,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-[#14532d] tracking-tight truncate">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-[#68766f] mt-0.5">{subtitle}</p>
      </div>

      {(children || secondaryAction || primaryAction) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {children}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#25362f] bg-white border border-[#e6ebe8] hover:bg-[#f8faf9] hover:border-[#d7ebdd] rounded-lg shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          )}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#16834a] hover:bg-[#13723f] rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {primaryAction.icon}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeader;

