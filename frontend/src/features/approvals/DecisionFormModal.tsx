import { useId, useState } from "react";
import { FiAlertCircle, FiInfo } from "react-icons/fi";
import { TbMessageCircle, TbX } from "react-icons/tb";
import FormModal from "@/components/ui/FormModal";
import Icon from "@/components/ui/Icon";
import { formatCurrency } from "@/features/invoices/invoiceFormat";
import {
  type Decision,
  type DecisionErrors,
  NOTE_MAX,
  REJECT_REASONS,
  type RejectReason,
  validateDecision,
} from "./approvalDecision";
import type { ApprovalItem } from "./approvalQueue";
import { billName } from "./approvalStatus";

type DecisionFormModalProps = {
  kind: "reject" | "requestInfo";
  item: ApprovalItem;
  // Saves the decision; throwing shows the error in the form
  onSubmit: (decision: Decision) => Promise<void>;
  describeError: (error: unknown) => string;
  onClose: () => void;
};

const textareaClass = (error?: string) =>
  `font-inter-regular min-h-[112px] w-full resize-y rounded-[7px] border bg-white px-3 py-2 text-sm outline-none placeholder:text-[#b0bab5] focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/20 ${
    error ? "border-[#b42318]" : "border-[#e6ebe8]"
  }`;

function Notice({ tone, children }: { tone: "danger" | "warning"; children: string }) {
  const style = tone === "danger" ? "border-[#fecdca] bg-[#fef3f2] text-[#b42318]" : "border-[#f5e3b3] bg-[#fdf6e3] text-[#7a5200]";
  return (
    <p className={`font-inter-regular mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${style}`}>
      <FiAlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
      <span>{children}</span>
    </p>
  );
}

// Reject bill, or Request information: the two decisions that need a reason
export default function DecisionFormModal({ kind, item, onSubmit, describeError, onClose }: DecisionFormModalProps) {
  const id = useId();
  const [reason, setReason] = useState<RejectReason | "">("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<DecisionErrors>({});
  const reject = kind === "reject";

  const decision = (): Decision =>
    reject ? { kind: "reject", reason: reason as RejectReason, details: text } : { kind: "requestInfo", message: text };

  const textError = reject ? errors.details : errors.message;
  const textName = reject ? "details" : "message";
  const amount = item.invoice.amount === null ? "" : ` · ${formatCurrency(item.invoice.amount)}`;
  const subtitle = `${billName(item)}${item.invoice.propertyName ? ` · ${item.invoice.propertyName}` : ""}${amount}`;

  return (
    <FormModal
      describeError={describeError}
      errorPrefix={reject ? "Couldn't reject the bill." : "Couldn't send the request."}
      initialFocusName={reject ? "reason" : "message"}
      onClose={onClose}
      save={() => onSubmit(decision())}
      savingLabel={reject ? "Rejecting…" : "Sending…"}
      submitIcon={<Icon icon={reject ? TbX : TbMessageCircle} size={16} />}
      submitLabel="Submit"
      subtitle={subtitle}
      title={reject ? "Reject bill" : "Request information"}
      validate={() => {
        const next = validateDecision(decision());
        setErrors(next);
        return Object.keys(next).length === 0;
      }}
    >
      <p className="font-inter-regular mb-4 text-[13px] text-[#68766f]">
        {reject
          ? "Choose a reason so whoever picks this bill up knows what to correct."
          : "Ask for what's missing before making a decision."}
      </p>

      {reject ? (
        <fieldset aria-describedby={errors.reason ? `${id}-reason-error` : undefined} className="mb-4 border-0 p-0">
          <legend className="font-inter-medium mb-2 text-[13px]">Reason</legend>
          <div className="flex flex-col gap-2">
            {REJECT_REASONS.map((option) => (
              <label className="font-inter-regular flex items-center gap-2.5 text-sm" key={option.value}>
                <input
                  checked={reason === option.value}
                  className="size-4 accent-[#16834a]"
                  name="reason"
                  onChange={() => {
                    setReason(option.value);
                    setErrors((current) => ({ ...current, reason: undefined, details: undefined }));
                  }}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </div>
          {errors.reason && (
            <p className="font-inter-regular mt-1.5 text-xs text-[#b42318]" id={`${id}-reason-error`}>
              {errors.reason}
            </p>
          )}
        </fieldset>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {/* The submitter is whoever uploaded the bill's file */}
          <p className="font-inter-regular text-[13px]">
            <span className="font-inter-medium">To: </span>
            {item.invoice.uploadedByName ? (
              <>
                {item.invoice.uploadedByName}
                <span className="text-[#68766f]"> · Bill submitter</span>
              </>
            ) : (
              <span className="text-[#68766f]">No submitter on record</span>
            )}
          </p>
          {/* TODO(notifications): actually notify the submitter once notifications exist */}
          <p className="font-inter-regular flex items-start gap-2 rounded-lg border border-[#e6ebe8] bg-[#f8faf9] px-3 py-2.5 text-[13px] text-[#4f5d56]">
            <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" size={15} />
            <span>They aren't notified yet. The message is saved in the bill's history.</span>
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="font-inter-medium text-[13px]" htmlFor={`${id}-text`}>
          {reject ? "Tell us more" : "Message"}
          {reject && reason !== "other" && <span className="font-inter-regular text-[#98a29c]"> (optional)</span>}
        </label>
        <textarea
          aria-describedby={textError ? `${id}-text-error` : undefined}
          aria-invalid={textError ? true : undefined}
          className={textareaClass(textError)}
          id={`${id}-text`}
          maxLength={NOTE_MAX}
          name={textName}
          onChange={(event) => {
            setText(event.target.value);
            if (textError) setErrors((current) => ({ ...current, [textName]: undefined }));
          }}
          placeholder={reject ? "What's wrong with this bill?" : "What information is missing?"}
          value={text}
        />
        {textError && (
          <p className="font-inter-regular text-xs text-[#b42318]" id={`${id}-text-error`}>
            {textError}
          </p>
        )}
      </div>

      {reject ? (
        <Notice tone="danger">The status changes to Rejected. The reason is saved in the audit log.</Notice>
      ) : (
        <Notice tone="warning">The status changes to Information requested and the bill goes back for review. Approval pauses until it's resubmitted.</Notice>
      )}
    </FormModal>
  );
}
