import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { TbChevronDown } from "react-icons/tb";
import Icon from "./Icon";

export type ActionMenuItem<Id extends string = string> = {
  id: Id;
  label: string;
  icon: IconType;
  // "danger" for destructive choices like Reject
  tone?: "default" | "success" | "danger";
};

type ActionMenuProps<Id extends string> = {
  // Accessible name for the button, e.g. "Actions for Gasco, $230.00"
  label: string;
  items: readonly ActionMenuItem<Id>[];
  onSelect: (id: Id) => void;
  disabled?: boolean;
  // Style of the button; "primary" is the filled green one
  variant?: "outline" | "primary";
};

const MENU_WIDTH = 208;
const GAP = 6;

const TONE_CLASS: Record<NonNullable<ActionMenuItem["tone"]>, string> = {
  default: "text-[#25362f]",
  success: "text-[#16834a]",
  danger: "text-[#b42318]",
};

// A menu button ("Action ▾"). The menu is fixed to the viewport so it isn't clipped by a
// scrolling table; it opens below the button, or above when there's no room.
export default function ActionMenu<Id extends string>({ label, items, onSelect, disabled = false, variant = "outline" }: ActionMenuProps<Id>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setPosition(null);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Measure before paint so the menu never flashes in the wrong place
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const height = menuRef.current.offsetHeight;
    const below = button.bottom + GAP;
    const top = below + height > window.innerHeight && button.top - GAP - height > 0 ? button.top - GAP - height : below;
    const left = Math.min(Math.max(8, button.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (open && position) menuItems()[0]?.focus();
  }, [open, position]);

  // Outside clicks, scrolling and resizing close it (the fixed position would go stale)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close(false);
    };
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const onButtonKeyDown = (event: KeyboardEvent) => {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const all = menuItems();
    const index = all.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => all[(i + all.length) % all.length]?.focus();

    if (event.key === "ArrowDown") focusAt(index + 1);
    else if (event.key === "ArrowUp") focusAt(index - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(all.length - 1);
    else if (event.key === "Escape") close(true);
    else if (event.key === "Tab") close(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
    // Esc inside a <dialog> would otherwise also close the dialog
    if (event.key === "Escape") event.stopPropagation();
  };

  const buttonClass =
    variant === "primary"
      ? "bg-[#16834a] text-white hover:bg-[#13723f] border-transparent font-inter-semibold"
      : "bg-white text-[#25362f] hover:bg-[#f8faf9] border-[#e6ebe8] font-inter-medium";

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] border px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass}`}
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        Action
        <Icon className={`transition-transform ${open ? "rotate-180" : ""}`} icon={TbChevronDown} size={14} />
      </button>

      {open && (
        <div
          aria-label={label}
          className="fixed z-50 rounded-[10px] border border-[#e6ebe8] bg-white p-1.5 shadow-[0_8px_24px_rgba(37,54,47,0.14)]"
          id={menuId}
          onKeyDown={onMenuKeyDown}
          ref={menuRef}
          role="menu"
          // Hidden until measured, then placed
          style={{ width: MENU_WIDTH, top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
        >
          {items.map((item) => (
            <button
              className={`font-inter-medium flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] outline-none hover:bg-[#f8faf9] focus:bg-[#f1f4f2] ${TONE_CLASS[item.tone ?? "default"]}`}
              key={item.id}
              onClick={() => {
                close(true);
                onSelect(item.id);
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              <Icon icon={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
