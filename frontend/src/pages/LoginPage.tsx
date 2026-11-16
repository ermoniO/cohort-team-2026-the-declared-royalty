import { useState, type FormEvent } from "react";
import type { AuthenticatedSession } from "@/auth/supabaseClient";
import { getSupabaseClient } from "@/auth/supabaseClient";

type LoginPageProps = {
  onAuthenticated: (session: AuthenticatedSession) => void;
};

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Sign-in completed without an active session.");
      onAuthenticated(data.session);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9f8] px-4 py-10">
      <section className="w-full max-w-[420px] rounded-2xl border border-[#e6ebe8] bg-white p-8 shadow-sm">
        <p className="font-inter-semibold text-sm text-[#16834a]">Declared Royalty</p>
        <h1 className="font-inter-semibold mt-3 text-2xl text-[#25362f]">Sign in</h1>
        <p className="font-inter-regular mt-2 text-sm text-[#68766f]">
          Use your account email and password to continue.
        </p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="font-inter-medium mb-1.5 block text-sm text-[#25362f]"
              htmlFor="login-email"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-[#d6dfda] px-3 py-2.5 text-sm text-[#25362f] outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/15"
              id="login-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label
              className="font-inter-medium mb-1.5 block text-sm text-[#25362f]"
              htmlFor="login-password"
            >
              Password
            </label>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#d6dfda] px-3 py-2.5 text-sm text-[#25362f] outline-none focus:border-[#16834a] focus:ring-2 focus:ring-[#16834a]/15"
              id="login-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-[#b42318]" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-[#16834a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#116b3b] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
