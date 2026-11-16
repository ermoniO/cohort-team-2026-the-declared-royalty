import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseIsoDate(iso: string): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  ariaLabel,
  placeholder = 'Select date...',
  className = '',
  buttonClassName = '',
  allowClear = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const today = useMemo(() => new Date(), []);

  const [viewYear, setViewYear] = useState<number>(
    selectedDate?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    selectedDate?.getMonth() ?? today.getMonth()
  );

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; iso?: string }> = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ day: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, iso: toIsoDate(viewYear, viewMonth, day) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const todayIso = toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

  const formattedDisplay = selectedDate
    ? selectedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs bg-white border border-[#e6ebe8] rounded-lg text-[#25362f] font-medium hover:border-[#b7e2c7] focus:outline-none focus:ring-2 focus:ring-[#16834a]/20 focus:border-[#16834a] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          <Calendar className="w-3.5 h-3.5 text-[#16834a] shrink-0" />
          <span className={`truncate font-mono ${selectedDate ? 'text-[#25362f]' : 'text-[#98a29c]'}`}>
            {formattedDisplay}
          </span>
        </span>
        {allowClear && value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onChange('');
              }
            }}
            className="text-[#98a29c] hover:text-[#14532d] p-0.5 rounded hover:bg-[#e8f7ed]"
          >
            <X className="w-3 h-3" />
          </span>
        ) : null}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel || 'Choose date'}
          className="absolute top-full left-0 mt-1.5 w-[264px] bg-white border border-[#e6ebe8] rounded-xl shadow-lg z-50 p-3 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="p-1 rounded-lg text-[#68766f] hover:text-[#14532d] hover:bg-[#e8f7ed] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-[#14532d]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="p-1 rounded-lg text-[#68766f] hover:text-[#14532d] hover:bg-[#e8f7ed] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[10px] font-semibold text-[#68766f] py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell.day || !cell.iso) {
                return <div key={`empty-${idx}`} className="h-7" />;
              }
              const isSelected = value === cell.iso;
              const isToday = todayIso === cell.iso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso!);
                    setOpen(false);
                  }}
                  className={`h-7 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#16834a] text-white font-bold shadow-xs'
                      : isToday
                        ? 'bg-[#e8f7ed] text-[#14532d] font-semibold border border-[#b7e2c7]'
                        : 'text-[#25362f] hover:bg-[#e8f7ed] hover:text-[#14532d]'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#e6ebe8] flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setOpen(false);
              }}
              className="font-semibold text-[#16834a] hover:underline cursor-pointer"
            >
              Today
            </button>
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="font-medium text-[#68766f] hover:text-[#14532d] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

