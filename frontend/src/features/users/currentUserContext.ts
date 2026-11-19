import { useUserStore } from "@/stores";
import type { CurrentUser } from "./useCurrentUser";

// The signed-in user, from the user store (AppShell starts the load once).
// Kept under its old name so BillsPage, ApprovalsPage and ReviewInvoiceModal don't change.
// TODO: rename to useCurrentUser (and this file) after the demo; it's no longer a context
export function useCurrentUserContext(): CurrentUser {
  // One selector per field: a selector that builds a new object every render loops forever in Zustand 5
  const user = useUserStore((s) => s.currentUser);
  const loading = useUserStore((s) => s.currentUserLoading);
  const error = useUserStore((s) => s.currentUserError);
  const switchUser = useUserStore((s) => s.switchUser);
  return { user, loading, error, switchUser };
}