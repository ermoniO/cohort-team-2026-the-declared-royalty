import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuditLogsResponse } from "@/types/auditlogs";
import type { UserResponse } from "@/types/user";
import { getAuditLogs } from "@/app/services/auditLogService";
import { getUsers } from "@/app/services/userService";
import { getDisplayName } from "@/features/users/userDisplay";
import { DEFAULT_VIEW, filterAuditLogs, titleCase, type AuditLogView } from "./auditLogDisplay";

export type Actor = { name: string; role: string | null; avatarUrl?: string | null };

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export function useAuditHistory(targetInvoiceUuid?: string, enabled: boolean = true) {
  const [logs, setLogs] = useState<AuditLogsResponse[]>([]);
  const [users, setUsers] = useState<Record<string, UserResponse>>({});
  const [view, setViewState] = useState<AuditLogView>(DEFAULT_VIEW);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled) {
      setLogs([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedLogs, fetchedUsers] = await Promise.allSettled([
        getAuditLogs(targetInvoiceUuid ? { invoice: targetInvoiceUuid } : {}),
        getUsers(),
      ]);

      if (fetchedLogs.status === "rejected") {
        const msg =
          fetchedLogs.reason instanceof Error
            ? fetchedLogs.reason.message
            : "Failed to load audit logs";
        setError(msg);
        setLogs([]);
      } else {
        setLogs(fetchedLogs.value);
      }

      if (fetchedUsers.status === "fulfilled") {
        const userMap: Record<string, UserResponse> = {};
        for (const u of fetchedUsers.value) {
          userMap[u.userId] = u;
        }
        setUsers(userMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error fetching audit history");
    } finally {
      setIsLoading(false);
    }
  }, [targetInvoiceUuid, enabled]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const setView = useCallback((changes: Partial<AuditLogView>) => {
    setViewState((current) => ({ ...current, ...changes }));
  }, []);

  const resetView = useCallback(() => {
    setViewState(DEFAULT_VIEW);
  }, []);

  const actorFor = useCallback(
    (userUuid: string): Actor => {
      if (userUuid === SYSTEM_USER_ID) {
        return { name: "System", role: "Automated Service" };
      }
      const user = users[userUuid];
      if (!user) return { name: `User ${userUuid.slice(0, 8)}`, role: null, avatarUrl: null };
      return {
        name: getDisplayName(user),
        role: null,
        avatarUrl: user.avatarUrl ?? null,
      };
    },
    [users],
  );

  const actorName = useCallback((userUuid: string) => actorFor(userUuid).name, [actorFor]);

  const invoiceLabel = useCallback(
    (invoiceUuid: string): string => {
      return `Invoice ${invoiceUuid.slice(0, 8)}`;
    },
    [],
  );

  const actorOptions = useMemo(() => {
    const ids = [...new Set(logs.map((log) => log.user))];
    return ids
      .map((id) => ({ value: id, label: actorName(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [logs, actorName]);

  const filtered = useMemo(() => filterAuditLogs(logs, view, actorName), [logs, view, actorName]);

  return {
    logs,
    filtered,
    view,
    setView,
    resetView,
    isLoading,
    error,
    actorFor,
    actorName,
    invoiceLabel,
    actorOptions,
    refresh: fetchHistory,
  };
}

