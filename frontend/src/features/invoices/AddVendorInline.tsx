import { type KeyboardEvent, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { HttpError } from "@/app/services/apiClient";
import { createVendor } from "@/features/vendors/vendorService";
import type { VendorResponse } from "@/types/vendor";

type AddVendorInlineProps = {
  // The vendor name the AI read from the bill, used to prefill the form
  suggestedName: string;
  disabled: boolean;
  onAdded: (vendor: VendorResponse) => void;
};

const inputClass =
  "font-inter-regular h-9 w-full rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-sm text-[#25362f] outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20 disabled:bg-[#f8faf9]";
const buttonClass =
  "font-inter-medium h-8 rounded-[7px] border border-[#e6ebe8] bg-white px-3 text-[13px] text-[#25362f] hover:bg-[#f8faf9] disabled:opacity-50";

// Adds a vendor from inside the review modal, so a vendor that isn't on file doesn't block the review.
// Not a <form>: it sits inside the review modal's form, and forms can't be nested.
export default function AddVendorInline({ suggestedName, disabled, onAdded }: AddVendorInlineProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        className="font-inter-medium mt-1.5 flex items-center gap-1 text-xs text-[#16834a] hover:underline disabled:opacity-50"
        disabled={disabled}
        onClick={() => {
          setName(suggestedName);
          setPhone("");
          setError(null);
          setOpen(true);
        }}
        type="button"
      >
        <FiPlus aria-hidden="true" size={12} /> Add a new vendor
      </button>
    );
  }

  const add = async () => {
    if (!name.trim()) {
      setError("Enter the vendor's name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // TODO(auth): createVendor passes withAuth=false like the rest of vendorService
      const vendor = await createVendor({ name: name.trim(), phoneNumber: phone.trim() || undefined });
      setOpen(false);
      onAdded(vendor);
    } catch (addError) {
      setError(
        addError instanceof HttpError && addError.status === 409
          ? "A vendor with that name already exists. Pick it from the list."
          : "Couldn't add the vendor. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Enter adds the vendor instead of confirming the field or submitting the review; Esc closes only this form
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

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-[#e6ebe8] bg-white p-3" onKeyDown={onKeyDown}>
      <p className="font-inter-medium text-[13px] text-[#25362f]">New vendor</p>
      <label className="font-inter-regular flex flex-col gap-1 text-xs text-[#68766f]">
        Name
        <input
          autoFocus
          className={inputClass}
          disabled={saving}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <label className="font-inter-regular flex flex-col gap-1 text-xs text-[#68766f]">
        Billing phone (optional)
        <input
          className={inputClass}
          disabled={saving}
          maxLength={255}
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
          value={phone}
        />
      </label>
      <p className="font-inter-regular text-xs text-[#98a29c]">
        Payment method defaults to ACH; you can change it later on the Vendors page.
      </p>
      {error && (
        <p className="font-inter-regular text-xs text-[#b42318]" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button className={buttonClass} disabled={saving} onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
        <button
          className="font-inter-semibold h-8 rounded-[7px] bg-[#16834a] px-3 text-[13px] text-white hover:bg-[#13723f] disabled:opacity-50"
          disabled={saving}
          onClick={() => void add()}
          type="button"
        >
          {saving ? "Adding…" : "Add vendor"}
        </button>
      </div>
    </div>
  );
}