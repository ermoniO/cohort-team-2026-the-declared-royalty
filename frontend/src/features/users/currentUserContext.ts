import { createContext, useContext } from "react";
import type { CurrentUser } from "./useCurrentUser";

// The signed-in user, loaded once by AppShell and shared with the pages inside it
export const CurrentUserContext = createContext<CurrentUser | null>(null);

export function useCurrentUserContext(): CurrentUser {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error("useCurrentUserContext must be used inside AppShell");
  return value;
}
