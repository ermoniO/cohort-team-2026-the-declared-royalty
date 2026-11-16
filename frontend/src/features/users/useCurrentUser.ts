import { useCallback, useEffect, useState } from "react";
import type { UserResponse } from "@/types/user";
import { getUserByUserId } from "./userService";

// Seeded by backend migration V4; used as a temporary application actor when no
// database user is selected. This is separate from the Supabase auth session.
export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

// Where "Switch user" remembers its choice (development builds only)
const STORAGE_KEY = "dev.currentUserId";

export type CurrentUserState = {
  user: UserResponse | null;
  loading: boolean;
  error: string | null;
};

export type CurrentUser = CurrentUserState & {
  // Dev-only "Switch user"; remembered across reloads
  switchUser: (user: UserResponse) => void;
};

// Users offered by "Switch user"
export function isSelectableUser(user: UserResponse): boolean {
  return user.status === "ACTIVE";
}

// Storage can be missing or blocked (private mode, tests); treat that as "nothing saved"
export function readStoredUserId(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeUserId(userId: string | null): void {
  if (!import.meta.env.DEV) return;
  try {
    if (userId) localStorage.setItem(STORAGE_KEY, userId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not saved; the choice still applies until the page reloads
  }
}

/**
 * Resolves the temporary database actor used by existing UI features. This is
 * not the signed-in Supabase identity; the backend does not yet map JWT subjects
 * to application user records. A deleted or inactive selected actor is skipped.
 */
export async function loadCurrentUser(): Promise<UserResponse> {
  const storedId = readStoredUserId();
  if (storedId) {
    const stored = await getUserByUserId(storedId).catch(() => null);
    if (stored && isSelectableUser(stored)) return stored;
    // Deleted (e.g. the database was reset) or deactivated since it was picked; forget it
    storeUserId(null);
  }

  const configuredId = import.meta.env.VITE_CURRENT_USER_ID;
  if (configuredId && configuredId !== SYSTEM_USER_ID) {
    const configured = await getUserByUserId(configuredId).catch(() => null);
    if (configured && isSelectableUser(configured)) return configured;
  }

  return getUserByUserId(SYSTEM_USER_ID);
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUserState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    loadCurrentUser()
      .then((user) => {
        if (active) setState({ user, loading: false, error: null });
      })
      .catch((requestError: unknown) => {
        if (active) {
          setState({
            user: null,
            loading: false,
            error:
              requestError instanceof Error
                ? requestError.message
                : "Unable to load user.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const switchUser = useCallback((user: UserResponse) => {
    storeUserId(user.userId);
    setState({ user, loading: false, error: null });
  }, []);

  return { ...state, switchUser };
}
