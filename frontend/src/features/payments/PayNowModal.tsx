import { TbCreditCard } from "react-icons/tb";
import { HttpError } from "@/app/services/apiClient";
import FormModal from "@/components/ui/FormModal";
import { formatCurrency } from "@/features/invoices/invoiceFormat";
import { payNow } from "@/features/payments/paymentService";
import type { PaymentResponse } from "@/types/payment";

export type PayNowTarget = {
  id: string;
  vendor: string;
  invoice: string;
  amount: number;
  // Already formatted for display
  dueDate: string;
  failureReason: string | null;
  isRetry: boolean;
};

type PayNowModalProps = {
  target: PayNowTarget;
  onPaid: (payment: PaymentResponse) => void;
  // Reloads the bill after a failure, so the page shows its new FAILED state
  onFailed: () => Promise<void>;
  onClose: () => void;
};

function describePayNowError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 409) return "A payment for this bill already started. Refresh to see its latest status.";
    if (error.status === 400) return "The payment didn't go through. Check the bill's activity for the reason.";
    if (error.status === 404) return "This bill no longer exists.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function PayNowModal({ target, onPaid, onFailed, onClose }: PayNowModalProps) {
  return (
    <FormModal
      describeError={describePayNowError}
      errorPrefix="Couldn't pay this bill."
      initialFocusName=""
      onClose={onClose}
      save={() =>
        payNow(target.id, target.amount).then(onPaid, async (error: unknown) => {
          await onFailed();
          throw error;
        })
      }
      savingLabel="Paying…"
      submitIcon={<TbCreditCard aria-hidden="true" size={16} />}
      submitLabel={`Pay ${formatCurrency(target.amount)}`}
      subtitle={`${target.vendor} · ${target.invoice}`}
      title="Pay now"
      validate={() => true}
    >
      <div className="font-inter-regular flex flex-col gap-3 text-sm text-[#25362f]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-[#68766f]">Amount</dt>
          <dd className="font-inter-semibold tabular-nums">{formatCurrency(target.amount)}</dd>
          <dt className="text-[#68766f]">Due</dt>
          <dd>{target.dueDate}</dd>
        </dl>
        {target.isRetry && target.failureReason && (
          <p className="rounded-lg border border-[#f2c9c6] bg-[#fff7f6] p-3 text-xs text-[#68766f]">
            <span className="font-inter-semibold text-[#b4322c]">Last attempt failed: </span>
            {target.failureReason}
          </p>
        )}
        <p className="text-[13px] text-[#68766f]">
          This charges the payment method on file right away. Auto-pay skips this bill once the
          payment starts, and a failed payment won't be retried automatically.
        </p>
      </div>
    </FormModal>
  );
}