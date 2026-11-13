import { useCallback, useMemo } from "react";
import { useAuditLogStore } from "@/stores";
import { getDisplayName } from "@/features/users/userDisplay";
import { titleCase, filterAuditLogs } from "./auditLogDisplay";

export type Actor = { name: string; role: string | null };

export function useAuditHistory() {
  const logs = useAuditLogStore((s) => s.logs);
  const users = useAuditLogStore((s) => s.users);
  const invoices = useAuditLogStore((s) => s.invoices);
  const view = useAuditLogStore((s) => s.view);

  const actorFor = useCallback(
    (userUuid: string): Actor => {
      const user = users[userUuid];
      if (!user) return { name: `User ${userUuid.slice(0, 8)}`, role: null };
      return { name: getDisplayName(user), role: user.role ? titleCase(user.role) : null };
    },
    [users],
  );

  const actorName = useCallback((userUuid: string) => actorFor(userUuid).name, [actorFor]);

  // "Gasco · Oak Street Lofts", or the uploaded filename until the bill is matched
  const invoiceLabel = useCallback(
    (invoiceUuid: string): string => {
      const invoice = invoices[invoiceUuid];
      if (!invoice) return `Invoice ${invoiceUuid.slice(0, 8)}`;
      if (invoice.vendorName) {
        return invoice.propertyName ? `${invoice.vendorName} · ${invoice.propertyName}` : invoice.vendorName;
      }
      return invoice.originalFilename ?? "Unmatched invoice";
    },
    [invoices],
  );

  // Only people who appear in this history, for the actor filter
  const actorOptions = useMemo(() => {
    const ids = [...new Set(logs.map((log) => log.user))];
    return ids
      .map((id) => ({ value: id, label: actorName(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [logs, actorName]);

  const filtered = useMemo(() => filterAuditLogs(logs, view, actorName), [logs, view, actorName]);

  return { logs, filtered, view, actorFor, actorName, invoiceLabel, actorOptions };
}