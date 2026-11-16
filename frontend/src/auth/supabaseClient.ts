import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { redirectToLogin } from "./redirects";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseClient: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      "Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabaseClient;
}

export async function getValidatedSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;

  const { data: userData, error: userError } = await client.auth.getUser(
    data.session.access_token,
  );
  if (userError) {
    if (userError.status !== 401) throw userError;
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
    return null;
  }

  if (!userData.user) {
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
    return null;
  }
  return data.session;
}

export async function getAuthHeader(): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    redirectToLogin();
    throw new Error("A signed-in session is required to call the API.");
  }

  return { Authorization: `Bearer ${token}` };
}

export async function handleUnauthorized(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
  redirectToLogin();
  if (error) throw error;
}

export type AuthenticatedSession = Session;
