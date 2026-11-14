import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { FiAlertCircle, FiCheck, FiExternalLink, FiFileText, FiLoader, FiRefreshCw, FiX } from "react-icons/fi";
import { getProperties } from "@/features/properties/propertyService";
import { getVendors } from "@/features/vendors/vendorService";
import type {
  ConfidenceLevel,
  ExtractedField,
  InvoiceExtractionResponse,
  InvoiceResponse,
  InvoiceVerifyRequest,
} from "@/types/invoice";
import type { PropertyResponse } from "@/types/property";
import type { VendorResponse } from "@/types/vendor";
import { extractInvoice, fetchInvoiceFile, invoiceFileUrl, verifyInvoice } from "./invoiceService";
import { ApiError } from "./invoiceUploadService";

type FieldKey =
  | "vendor"
  | "invoiceNumber"
  | "accountNumber"
  | "property"
  | "dueDate"
  | "servicePeriod"
  | "amount"
  | "invoiceDate";

const FIELD_ORDER: FieldKey[] = [
  "vendor",
  "invoiceNumber",
  "accountNumber",
  "property",
  "dueDate",
  "servicePeriod",
  "amount",
  "invoiceDate",
];

const LABELS: Record<FieldKey, string> = {
  vendor: "Vendor",
  invoiceNumber: "Invoice number",
  accountNumber: "Account number",
  property: "Property",
  dueDate: "Due date",
  servicePeriod: "Service period",
  amount: "Total amount",
  invoiceDate: "Invoice date",
};

const OPTIONAL: FieldKey[] = ["invoiceNumber", "servicePeriod", "invoiceDate"];

// Lower rank = needs more attention; used to combine the two service-period dates
const LEVEL_RANK: Record<ConfidenceLevel, number> = { NOT_FOUND: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT = /^-?\d{1,8}(\.\d{1,2})?$/;

type Values = {
  vendorUuid: string;
  invoiceNumber: string;
  accountNumber: string;
  propertyUuid: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  invoiceDate: string;
};

type FieldState = {
  level: ConfidenceLevel | null; // null: no AI result, entered by hand
  confidence: number | null; // AI readability score, 0–1; null when nothing was read
  reason: string | null; // why the backend gave this level
  aiText: string | null; // what the AI read, shown when it couldn't be used as-is
  confirmed: boolean;
  error?: string;
};

type Extraction =
  | { status: "loading" }
  | { status: "done"; data: InvoiceExtractionResponse | null; error: string | null };

const EMPTY_VALUES: Values = {
  vendorUuid: "",
  invoiceNumber: "",
  accountNumber: "",
  propertyUuid: "",
  dueDate: "",
  periodStart: "",
  periodEnd: "",
  amount: "",
  invoiceDate: "",
};

const cleanAmount = (value: string) => value.replace(/[$,\s]/g, "");
const asText = (field: ExtractedField) => field.value?.trim() ?? "";
const asDate = (field: ExtractedField) => (ISO_DATE.test(asText(field)) ? asText(field) : "");
const asAmount = (field: ExtractedField) => {
  const value = cleanAmount(asText(field));
  return AMOUNT.test(value) ? Number(value).toFixed(2) : "";
};

function initialState(data: InvoiceExtractionResponse | null): { values: Values; fields: Record<FieldKey, FieldState> } {
  if (!data) {
    const blank: FieldState = { level: null, confidence: null, reason: null, aiText: null, confirmed: false };    return {
      values: EMPTY_VALUES,
      fields: Object.fromEntries(FIELD_ORDER.map((key) => [key, blank])) as Record<FieldKey, FieldState>,
    };
  }

  const f = data.fields;
  const values: Values = {
    vendorUuid: data.suggestedVendorUuid ?? "",
    invoiceNumber: asText(f.vendorSuppliedInvoiceId),
    accountNumber: asText(f.vendorAccountNumber),
    propertyUuid: data.suggestedPropertyUuid ?? "",
    dueDate: asDate(f.dueDate),
    periodStart: asDate(f.billingPeriodStart),
    periodEnd: asDate(f.billingPeriodEnd),
    amount: asAmount(f.amount),
    invoiceDate: asDate(f.invoiceCreationDate),
  };

  // Only HIGH starts confirmed, and only when the value could be put in the form as-is
  const state = (field: ExtractedField, usable: boolean): FieldState => ({
    level: field.level,
    confidence: field.value ? field.confidence : null,
    reason: field.reason,
    aiText: field.value && !usable ? field.value : null,
    confirmed: usable && field.level === "HIGH",
  });

  const start = f.billingPeriodStart;
  const end = f.billingPeriodEnd;
  const worse = LEVEL_RANK[start.level] <= LEVEL_RANK[end.level] ? start : end;
  const periodUsable = (!start.value || values.periodStart !== "") && (!end.value || values.periodEnd !== "");
  const periodConfidence = [start, end].filter((x) => x.value).map((x) => x.confidence);


  return {
    values,
    fields: {
      vendor: state(f.vendorName, values.vendorUuid !== ""),
      invoiceNumber: state(f.vendorSuppliedInvoiceId, true),
      accountNumber: state(f.vendorAccountNumber, true),
      // The address decides; the name only lowers it when it points to a different property.
      // Bills usually print the customer's business name, not the property's name.
      property: (() => {
        const addr = f.propertyAddress;
        const name = f.propertyName;
        const main = addr.level !== "NOT_FOUND" ? addr : name;
        const nameConflict = addr.level !== "NOT_FOUND" && name.level === "LOW";
        return {
          level: nameConflict ? "LOW" : main.level,
          confidence: main.value ? main.confidence : null,
          reason: nameConflict ? `${addr.reason} · Name: ${name.reason}` : main.reason,
          aiText: values.propertyUuid
            ? null
            : [name.value, addr.value].filter(Boolean).join(" · ") || null,
          confirmed: values.propertyUuid !== "" && !nameConflict && main.level === "HIGH",
        } satisfies FieldState;
      })(),
      dueDate: state(f.dueDate, values.dueDate !== ""),
      servicePeriod: {
        level: worse.level,
        confidence: periodConfidence.length ? Math.min(...periodConfidence) : null,
        reason:
          start.reason === end.reason
            ? start.reason
            : [start.reason && `Start: ${start.reason}`, end.reason && `End: ${end.reason}`].filter(Boolean).join(" · "),
        aiText: periodUsable ? null : `${start.value ?? "?"} to ${end.value ?? "?"}`,
        confirmed: periodUsable && start.level === "HIGH" && end.level === "HIGH",
      },
      amount: state(f.amount, values.amount !== ""),
      invoiceDate: state(f.invoiceCreationDate, values.invoiceDate !== ""),
    },
  };
}

function validateField(key: FieldKey, v: Values): string | undefined {
  switch (key) {
    case "vendor":
      return v.vendorUuid ? undefined : "Choose the vendor";
    case "property":
      return v.propertyUuid ? undefined : "Choose the property";
    case "accountNumber":
      return v.accountNumber.trim() ? undefined : "Enter the account number";
    case "amount":
      if (!v.amount.trim()) return "Enter the total amount due";
      return AMOUNT.test(cleanAmount(v.amount)) ? undefined : "Use a number like 412.80";
    case "dueDate":
      return ISO_DATE.test(v.dueDate) ? undefined : "Enter the due date";
    case "servicePeriod":
      if (!!v.periodStart !== !!v.periodEnd) return "Enter both dates, or neither";
      if (v.periodStart && v.periodEnd && v.periodStart > v.periodEnd) return "Start must be on or before end";
      return undefined;
    default:
      return undefined;
  }
}

const VALUE_LABELS: Record<keyof Values, string> = {
  vendorUuid: "Vendor",
  invoiceNumber: "Invoice number",
  accountNumber: "Account number",
  propertyUuid: "Property",
  dueDate: "Due date",
  periodStart: "Billing period start",
  periodEnd: "Billing period end",
  amount: "Total amount",
  invoiceDate: "Invoice date",
};

const FIELD_VALUES: Record<FieldKey, (keyof Values)[]> = {
  vendor: ["vendorUuid"],
  invoiceNumber: ["invoiceNumber"],
  accountNumber: ["accountNumber"],
  property: ["propertyUuid"],
  dueDate: ["dueDate"],
  servicePeriod: ["periodStart", "periodEnd"],
  amount: ["amount"],
  invoiceDate: ["invoiceDate"],
};

// Audit note for the verify step, in words: what the reviewer changed, and which flagged fields they accepted
function describeReview(
  data: InvoiceExtractionResponse | null,
  values: Values,
  fields: Record<FieldKey, FieldState>,
  nameOf: (key: keyof Values, value: string) => string,
): { notes: string; changed: boolean } {
  if (!data) return { notes: "Entered by hand: AI extraction was unavailable.", changed: true };

  const ai = initialState(data).values;
  const changes = (Object.keys(values) as (keyof Values)[])
    .filter((key) => ai[key] !== values[key])
    .map((key) => `• ${VALUE_LABELS[key]}: ${nameOf(key, ai[key]) || "(blank)"} → ${nameOf(key, values[key]) || "(blank)"}`);

  const acceptedFlags = FIELD_ORDER.filter(
    (key) =>
      fields[key].level !== null &&
      fields[key].level !== "HIGH" &&
      FIELD_VALUES[key].every((v) => ai[v] === values[v]),
  ).map((key) => LABELS[key]);

  const parts: string[] = [];
  if (changes.length) parts.push(["Changed from what the AI read:", ...changes].join("\n"));
  else parts.push("Confirmed the AI's values without changes.");
  if (acceptedFlags.length) parts.push(`Confirmed as read (were flagged): ${acceptedFlags.join(", ")}`);

  return { notes: parts.join("\n\n").slice(0, 2000), changed: changes.length > 0 };
}

const inputClass = (error?: string) =>
  `font-inter-regular h-9 w-full rounded-[7px] border bg-white px-3 text-sm outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20 disabled:bg-[#f8faf9] ${
    error ? "border-[#b42318]" : "border-[#e6ebe8]"
  }`;
const secondaryButton =
  "font-inter-medium flex h-9 items-center gap-2 rounded-[7px] border border-[#e6ebe8] bg-white px-4 text-sm text-[#25362f] hover:bg-[#f8faf9] disabled:opacity-50";
const primaryButton =
  "font-inter-semibold flex h-9 items-center gap-2 rounded-[7px] bg-[#16834a] px-4 text-sm text-white hover:bg-[#13723f] disabled:cursor-not-allowed disabled:bg-[#c9d3ce]";

type ReviewInvoiceModalProps = {
  invoice: InvoiceResponse;
  // Called on close, whether or not the invoice was verified (extraction also changes its status)
  onClose: () => void;
};

export default function ReviewInvoiceModal({ invoice, onClose }: ReviewInvoiceModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const runId = useRef(0);
  const titleId = useId();

  const [extraction, setExtraction] = useState<Extraction>({ status: "loading" });
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [fields, setFields] = useState(() => initialState(null).fields);
  const [vendors, setVendors] = useState<VendorResponse[]>([]);
  const [properties, setProperties] = useState<PropertyResponse[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [file, setFile] = useState<{ url: string } | { error: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const extracting = extraction.status === "loading";
  const busy = saving || extracting;
  const data = extraction.status === "done" ? extraction.data : null;
  const remaining = FIELD_ORDER.filter((key) => !fields[key].confirmed);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVendors(), getProperties()])
      .then(([v, p]) => {
        if (cancelled) return;
        setVendors(v);
        setProperties(p);
      })
      .catch(() => {
        if (!cancelled) setListError("Couldn't load vendors and properties. Close and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    fetchInvoiceFile(invoice.invoiceUuid)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ url });
      })
      .catch(() => {
        if (!cancelled) setFile({ error: "Couldn't load the file." });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice.invoiceUuid]);

  const runExtraction = useCallback(async () => {
    const id = ++runId.current;
    setExtraction({ status: "loading" });
    setSaveError(null);
    let result: InvoiceExtractionResponse | null = null;
    let error: string | null = null;
    try {
      result = await extractInvoice(invoice.invoiceUuid);
      error = result.error;
    } catch (extractError) {
      error = extractError instanceof ApiError ? extractError.message : "AI extraction failed.";
    }
    if (id !== runId.current) return; // closed, or a newer run started
    const initial = initialState(result);
    setValues(initial.values);
    setFields(initial.fields);
    setExtraction({ status: "done", data: result, error });
  }, [invoice.invoiceUuid]);

  // Run the AI once per opening. React StrictMode mounts effects twice in development, which
  // fired two AI calls and wrote two audit entries; a ref survives that remount.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runExtraction();
  }, [runExtraction]);

  const focusField = (key: FieldKey) =>
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`[data-field="${key}"] :is(input, select)`)?.focus(),
    );

  // Typing or picking a value is the reviewer's own entry, so it counts as confirmed
  const update = (key: FieldKey, patch: Partial<Values>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], confirmed: true, error: undefined } }));
    setSaveError(null);
  };

  const confirm = (key: FieldKey) => {
    const error = validateField(key, values);
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], confirmed: !error, error } }));
    if (!error) {
      const next = FIELD_ORDER[FIELD_ORDER.indexOf(key) + 1];
      if (next) focusField(next);
    }
  };

  // Enter confirms the field it's in; once everything is confirmed, Enter submits
  const onFieldKeyDown = (key: FieldKey) => (event: ReactKeyboardEvent) => {
    if (event.key !== "Enter" || fields[key].confirmed) return;
    event.preventDefault();
    confirm(key);
  };

  // Names instead of UUIDs in the audit note
  const nameOf = (key: keyof Values, value: string) => {
    if (!value) return "";
    if (key === "vendorUuid") return vendors.find((v) => v.vendorUuid === value)?.name ?? value;
    if (key === "propertyUuid") return properties.find((p) => p.propertyId === value)?.name ?? value;
    return value;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (remaining.length > 0) {
      focusField(remaining[0]);
      return;
    }

    const errors = FIELD_ORDER.flatMap((key) => {
      const error = validateField(key, values);
      return error ? [{ key, error }] : [];
    });
    if (errors.length > 0) {
      setFields((prev) => {
        const next = { ...prev };
        for (const { key, error } of errors) next[key] = { ...next[key], confirmed: false, error };
        return next;
      });
      focusField(errors[0].key);
      return;
    }

    const review = describeReview(data, values, fields, nameOf);
    
    const request: InvoiceVerifyRequest = {
      vendorUuid: values.vendorUuid,
      propertyUuid: values.propertyUuid,
      vendorAccountNumber: values.accountNumber.trim(),
      vendorSuppliedInvoiceId: values.invoiceNumber.trim() || undefined,
      amount: Number(cleanAmount(values.amount)),
      dueDate: values.dueDate,
      billingPeriodStart: values.periodStart || undefined,
      billingPeriodEnd: values.periodEnd || undefined,
      invoiceCreationDate: values.invoiceDate || undefined,
      notes: review.notes,
      aiValuesChanged: review.changed,
    };

    setSaving(true);
    setSaveError(null);
    try {
      await verifyInvoice(invoice.invoiceUuid, request);
      dialogRef.current?.close();
    } catch (verifyError) {
      setSaveError(verifyError instanceof ApiError ? verifyError.message : "Something went wrong. Try again.");
      setSaving(false);
    }
  };

  const fieldProps = (key: FieldKey) => ({
    fieldKey: key,
    state: fields[key],
    onConfirm: () => confirm(key),
    onKeyDown: onFieldKeyDown(key),
  });

  const fileName = invoice.originalFilename ?? "Invoice file";

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto h-[92dvh] w-[calc(100vw-2rem)] max-w-[1120px] overflow-hidden rounded-xl border-0 bg-white p-0 text-[#25362f] shadow-xl backdrop:bg-black/30"
      onCancel={(event) => {
        if (saving) event.preventDefault();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <form className="flex h-full flex-col" noValidate onSubmit={(event) => void onSubmit(event)} ref={formRef}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e6ebe8] px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-inter-semibold text-xl text-[#14532d]" id={titleId}>
              Invoice mapping
            </h2>
            <p className="font-inter-regular mt-1 text-sm text-[#68766f]">
              Review extracted fields before confirming this invoice.
            </p>
          </div>
          <button
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#e6ebe8] text-[#68766f] hover:bg-[#f8faf9] disabled:opacity-40"
            disabled={saving}
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body: file on the left, fields on the right */}
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 lg:grid-cols-2 lg:overflow-hidden">
          <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-[#e6ebe8] bg-[#f1f4f2] lg:min-h-0">
            <div className="flex items-center gap-2 border-b border-[#e6ebe8] bg-white px-4 py-2.5">
              <FiFileText aria-hidden="true" className="shrink-0 text-[#68766f]" size={15} />
              <span className="font-inter-medium truncate text-sm" title={fileName}>
                {fileName}
              </span>
              <a
                className="font-inter-medium ml-auto flex shrink-0 items-center gap-1 text-xs text-[#16834a] hover:underline"
                href={invoiceFileUrl(invoice.invoiceUuid)}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open in new tab <FiExternalLink aria-hidden="true" size={12} />
              </a>
            </div>
            {file === null ? (
              <p className="font-inter-regular m-auto flex items-center gap-2 text-sm text-[#68766f]" role="status">
                <FiLoader className="animate-spin" size={14} /> Loading file…
              </p>
            ) : "error" in file ? (
              <p className="font-inter-regular m-auto text-sm text-[#b42318]" role="alert">
                {file.error}
              </p>
            ) : (
              <iframe className="w-full flex-1 bg-white" src={file.url} title={`Invoice file: ${fileName}`} />
            )}
          </section>

          <section className="relative flex flex-col gap-4 rounded-lg border border-[#e6ebe8] p-4 lg:min-h-0 lg:overflow-y-auto">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-inter-semibold text-base">Extracted fields</h3>
              <span className="font-inter-regular text-xs text-[#98a29c]">Checked against your vendors, properties and past bills</span>
            </div>

            {extracting && (
              <p
                className="font-inter-regular flex items-center gap-2 rounded-lg bg-[#eaf1fb] px-3 py-2.5 text-sm text-[#2f5ea8]"
                role="status"
              >
                <FiLoader className="animate-spin" size={14} />
                Reading the invoice with AI… this can take up to 30 seconds.
              </p>
            )}
            {extraction.status === "done" && extraction.error && (
              <p
                className={`font-inter-regular flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                  data ? "bg-[#fdf6e3] text-[#946200]" : "bg-[#fef3f2] text-[#b42318]"
                }`}
                role="alert"
              >
                <FiAlertCircle className="mt-0.5 shrink-0" size={15} />
                <span>
                  {data ? `AI note: ${extraction.error}` : `${extraction.error} Fill in the fields from the file.`}
                </span>
              </p>
            )}
            {listError && (
              <p className="font-inter-regular text-sm text-[#b42318]" role="alert">
                {listError}
              </p>
            )}

            <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0" disabled={busy}>
              <FieldCard {...fieldProps("vendor")}>
                <select
                  className={inputClass(fields.vendor.error)}
                  id="review-vendor"
                  onChange={(event) => update("vendor", { vendorUuid: event.target.value })}
                  value={values.vendorUuid}
                >
                  <option value="">Select a vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.vendorUuid} value={vendor.vendorUuid}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </FieldCard>

              <FieldCard {...fieldProps("invoiceNumber")}>
                <input
                  autoComplete="off"
                  className={inputClass(fields.invoiceNumber.error)}
                  id="review-invoiceNumber"
                  maxLength={100}
                  onChange={(event) => update("invoiceNumber", { invoiceNumber: event.target.value })}
                  value={values.invoiceNumber}
                />
              </FieldCard>

              <FieldCard {...fieldProps("accountNumber")}>
                <input
                  autoComplete="off"
                  className={inputClass(fields.accountNumber.error)}
                  id="review-accountNumber"
                  maxLength={100}
                  onChange={(event) => update("accountNumber", { accountNumber: event.target.value })}
                  value={values.accountNumber}
                />
              </FieldCard>

              <FieldCard {...fieldProps("property")}>
                <select
                  className={inputClass(fields.property.error)}
                  id="review-property"
                  onChange={(event) => update("property", { propertyUuid: event.target.value })}
                  value={values.propertyUuid}
                >
                  <option value="">Select a property</option>
                  {properties.map((property) => (
                    <option key={property.propertyId} value={property.propertyId}>
                      {property.name} · {property.streetAddress}
                    </option>
                  ))}
                </select>
              </FieldCard>

              <FieldCard {...fieldProps("dueDate")}>
                <input
                  className={inputClass(fields.dueDate.error)}
                  id="review-dueDate"
                  onChange={(event) => update("dueDate", { dueDate: event.target.value })}
                  type="date"
                  value={values.dueDate}
                />
              </FieldCard>

              <FieldCard {...fieldProps("servicePeriod")}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="font-inter-regular flex flex-col gap-1 text-xs text-[#68766f]">
                    Start
                    <input
                      className={inputClass(fields.servicePeriod.error)}
                      id="review-servicePeriod"
                      onChange={(event) => update("servicePeriod", { periodStart: event.target.value })}
                      type="date"
                      value={values.periodStart}
                    />
                  </label>
                  <label className="font-inter-regular flex flex-col gap-1 text-xs text-[#68766f]">
                    End
                    <input
                      className={inputClass(fields.servicePeriod.error)}
                      onChange={(event) => update("servicePeriod", { periodEnd: event.target.value })}
                      type="date"
                      value={values.periodEnd}
                    />
                  </label>
                </div>
              </FieldCard>

              <FieldCard {...fieldProps("amount")}>
                <input
                  autoComplete="off"
                  className={inputClass(fields.amount.error)}
                  id="review-amount"
                  inputMode="decimal"
                  onChange={(event) => update("amount", { amount: event.target.value })}
                  placeholder="0.00"
                  value={values.amount}
                />
              </FieldCard>

              <FieldCard {...fieldProps("invoiceDate")}>
                <input
                  className={inputClass(fields.invoiceDate.error)}
                  id="review-invoiceDate"
                  onChange={(event) => update("invoiceDate", { invoiceDate: event.target.value })}
                  type="date"
                  value={values.invoiceDate}
                />
              </FieldCard>
            </fieldset>

            {saveError && (
              <p className="flex items-start gap-2 text-sm text-[#b42318]" role="alert">
                <FiAlertCircle className="mt-0.5 shrink-0" size={16} />
                <span>Couldn't confirm this invoice. {saveError}</span>
              </p>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6ebe8] px-6 py-4">
          <p className="font-inter-regular text-xs text-[#68766f]">
            Tab to next field · Enter to confirm · Changes and confirmations are recorded in the audit trail.
          </p>
          <div className="flex gap-2">
            <button
              className={secondaryButton}
              disabled={busy}
              onClick={() => void runExtraction()}
              title="Runs the AI again and discards your edits"
              type="button"
            >
              <FiRefreshCw aria-hidden="true" size={14} />
              Re-extract
            </button>
            <button className={primaryButton} disabled={busy || remaining.length > 0} type="submit">
              {saving
                ? "Saving…"
                : remaining.length > 0
                  ? `Confirm all & continue (${remaining.length} remaining)`
                  : "Confirm & send for approval"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

type FieldCardProps = {
  fieldKey: FieldKey;
  state: FieldState;
  onConfirm: () => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
  children: ReactNode;
};

// One field: label, level, the control, the reason and (until confirmed) a Confirm button.
// Unconfirmed fields are tinted by level, like the mockup's "active" card.
function FieldCard({ fieldKey, state, onConfirm, onKeyDown, children }: FieldCardProps) {
  const low = state.level === null || state.level === "LOW" || state.level === "NOT_FOUND";
  const tone = state.confirmed
    ? ""
    : low
      ? "rounded-lg border border-[#f3c7c3] bg-[#fef3f2] p-3"
      : "rounded-lg border border-[#f3dca4] bg-[#fdf9ee] p-3";
  const labelId = `review-${fieldKey}-label`;

  return (
    <div aria-labelledby={labelId} className={`flex flex-col gap-1.5 ${tone}`} data-field={fieldKey} onKeyDown={onKeyDown} role="group">
      <div className="flex items-center justify-between gap-2">
        <label
          className={`font-inter-medium text-[13px] ${!state.confirmed && low ? "text-[#b42318]" : ""}`}
          htmlFor={`review-${fieldKey}`}
          id={labelId}
        >
          {LABELS[fieldKey]}
          {OPTIONAL.includes(fieldKey) && <span className="font-inter-regular text-[#98a29c]"> (optional)</span>}
        </label>
        <span className="flex items-center gap-2">
          {state.confirmed && (
            <span className="font-inter-medium flex items-center gap-1 text-xs text-[#16834a]">
              <FiCheck aria-hidden="true" size={12} /> Confirmed
            </span>
          )}
          <LevelBadge level={state.level} />
          {state.confidence !== null && (
            <span className="font-inter-regular text-xs text-[#98a29c]" title="How clearly the AI could read it">
              Read {Math.round(state.confidence * 100)}%
            </span>
          )}
        </span>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {!state.confirmed && (
          <button className={`${secondaryButton} shrink-0`} onClick={onConfirm} type="button">
            Confirm
          </button>
        )}
      </div>
      {state.reason && <p className="font-inter-regular text-xs text-[#68766f]">{state.reason}</p>}
      {state.aiText && (
        <p className="font-inter-regular text-xs text-[#68766f]">
          On the bill: “{state.aiText}”
        </p>
      )}
      {state.error && (
        <p className="font-inter-regular text-xs text-[#b42318]" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

const BADGES: Record<ConfidenceLevel, { label: string; className: string }> = {
  HIGH: { label: "High", className: "bg-[#e8f7ed] text-[#16834a]" },
  MEDIUM: { label: "Medium", className: "bg-[#fdf6e3] text-[#946200]" },
  LOW: { label: "Low", className: "bg-[#fdeeee] text-[#b4322c]" },
  NOT_FOUND: { label: "Not found", className: "bg-[#fdeeee] text-[#b4322c]" },
};

function LevelBadge({ level }: { level: ConfidenceLevel | null }) {
  if (!level) return null; // entered by hand: nothing to grade
  const badge = BADGES[level];
  return (
    <span className={`font-inter-medium whitespace-nowrap rounded-md px-2 py-0.5 text-xs ${badge.className}`}>
      {badge.label}
    </span>
  );
}