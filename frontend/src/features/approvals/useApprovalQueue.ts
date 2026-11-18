import { useEffect, useMemo, useState } from "react";
import { type ApprovalItem, buildQueue } from "./approvalQueue";
import { loadQueueData, type QueueData } from "./approvalService";

export type ApprovalQueueState =
  | { status: "loading"; previous?: ApprovalItem[] }
  | { status: "error"; message: string; previous?: ApprovalItem[] }
  | { status: "loaded"; items: ApprovalItem[]; truncated: boolean };

// Loads the queue; refetches when reloadKey changes (e.g. after a decision). The previous
// items stay available while reloading so the table doesn't flash empty.
export function useApprovalQueue(reloadKey: number): ApprovalQueueState {
  const [result, setResult] = useState<{ key: number; data?: QueueData; error?: string } | null>(null);

  useEffect(() => {
    let active = true;
    loadQueueData()
      .then((data) => {
        if (active) setResult({ key: reloadKey, data });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to load the approval queue.";
        if (active) setResult((current) => ({ key: reloadKey, data: current?.data, error: message }));
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const data = result?.data;
  const items = useMemo(() => (data ? buildQueue(data.invoices, data.decisions, data.extras) : undefined), [data]);

  if (result?.key !== reloadKey) return { status: "loading", previous: items };
  if (result.error !== undefined) return { status: "error", message: result.error, previous: items };
  return { status: "loaded", items: items ?? [], truncated: data?.truncated ?? false };
}
