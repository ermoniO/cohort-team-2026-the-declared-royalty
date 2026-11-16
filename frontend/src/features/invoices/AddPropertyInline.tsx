import { type KeyboardEvent, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { HttpError } from "@/app/services/apiClient";
import { createProperty } from "@/features/properties/propertyService";
import type { PropertyCreateRequest, PropertyResponse } from "@/types/property";

type AddPropertyInlineProps = {
  // What the AI read from the bill, used to prefill the form
  suggestedName: string;
  suggestedAddress: string;
  disabled: boolean;
  onAdded: (property: PropertyResponse) => void;
};

const inputClass =
  "font-inter-regular h-9 w-full rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-sm text-[#25362f] outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20 disabled:bg-[#f8faf9]";
const labelClass = "font-inter-regular flex flex-col gap-1 text-xs text-[#68766f]";

const EMPTY: PropertyCreateRequest = { name: "", streetAddress: "", city: "", state: "", zipCode: "" };

// Splits "125 Industrial Way, Springfield, IL 62701" into its parts; anything it can't read stays blank
function parseAddress(address: string): Omit<PropertyCreateRequest, "name"> {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stateZip = parts.length >= 3 ? parts[parts.length - 1].match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/) : null;
  if (!stateZip) return { streetAddress: parts[0] ?? "", city: parts[1] ?? "", state: "", zipCode: "" };
  return {
    streetAddress: parts.slice(0, -2).join(", "),
    city: parts[parts.length - 2],
    state: stateZip[1].toUpperCase(),
    zipCode: stateZip[2],
  };
}

// Adds a property from inside the review modal, so a property that isn't on file doesn't block the review.
// Not a <form>: it sits inside the review modal's form, and forms can't be nested.
export default function AddPropertyInline({ suggestedName, suggestedAddress, disabled, onAdded }: AddPropertyInlineProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PropertyCreateRequest>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        className="font-inter-medium mt-1.5 flex items-center gap-1 text-xs text-[#16834a] hover:underline disabled:opacity-50"
        disabled={disabled}
        onClick={() => {
          const address = parseAddress(suggestedAddress);
          setForm({ ...address, name: suggestedName || address.streetAddress });
          setError(null);
          setOpen(true);
        }}
        type="button"
      >
        <FiPlus aria-hidden="true" size={12} /> Add a new property
      </button>
    );
  }

  const set = (field: keyof PropertyCreateRequest) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const add = async () => {
    const request: PropertyCreateRequest = {
      name: form.name.trim(),
      streetAddress: form.streetAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zipCode: form.zipCode.trim(),
    };
    if (Object.values(request).some((value) => !value)) {
      setError("Fill in every field to add the property");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // TODO(auth): createProperty passes withAuth=false like the rest of propertyService
      const property = await createProperty(request);
      setOpen(false);
      onAdded(property);
    } catch (addError) {
      setError(
        addError instanceof HttpError && addError.status === 409
          ? "A property at that address already exists. Pick it from the list."
          : "Couldn't add the property. Check the fields and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Enter adds the property instead of confirming the field or submitting the review; Esc closes only this form
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void add();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  const field = (label: string, key: keyof PropertyCreateRequest, extra: { maxLength?: number; autoFocus?: boolean } = {}) => (
    <label className={labelClass}>
      {label}
      <input
        autoFocus={extra.autoFocus}
        className={inputClass}
        disabled={saving}
        maxLength={extra.maxLength ?? 255}
        onChange={(event) => set(key)(event.target.value)}
        value={form[key]}
      />
    </label>
  );

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#e6ebe8] bg-white p-3" onKeyDown={onKeyDown}>
      <p className="font-inter-medium text-[13px] text-[#25362f]">New property</p>
      {field("Name", "name", { autoFocus: true })}
      {field("Street address", "streetAddress")}
      <div className="grid grid-cols-[1fr_80px_110px] gap-2">
        {field("City", "city", { maxLength: 100 })}
        {field("State", "state", { maxLength: 50 })}
        {field("ZIP", "zipCode", { maxLength: 20 })}
      </div>
      {error && (
        <p className="font-inter-regular text-xs text-[#b42318]" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          className="font-inter-medium h-8 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] hover:bg-[#f8faf9] disabled:opacity-50"
          disabled={saving}
          onClick={() => setOpen(false)}
          type="button"
        >
          Cancel
        </button>
        <button
          className="font-inter-semibold h-8 rounded-[7px] bg-[#16834a] px-3 text-[13px] text-white hover:bg-[#13723f] disabled:opacity-50"
          disabled={saving}
          onClick={() => void add()}
          type="button"
        >
          {saving ? "Adding…" : "Add property"}
        </button>
      </div>
    </div>
  );
}