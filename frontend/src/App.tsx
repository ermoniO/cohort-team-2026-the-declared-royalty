import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AppShell from "./layout/AppShell";
import type { AppRoute } from "./types/route";
import WorkspacePage from "./pages/WorkspacePage";
import BillsPage from "./pages/BillsPage";
import PropertiesPage from "./pages/PropertiesPage";
import VendorsPage from "./pages/VendorsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import { navigateTo, replaceTo } from "./app/navigation";
import { redirectToLogin } from "./auth/redirects";
import { getSupabaseClient, getValidatedSession } from "./auth/supabaseClient";
import LoginPage from "./pages/LoginPage";
import {
  TbAlertTriangle,
  TbBlocks,
  TbBuilding,
  TbBuildingStore,
  TbCircleCheck,
  TbCreditCard,
  TbFileInvoice,
  TbHistory,
} from "react-icons/tb";

const routes: AppRoute[] = [
  { label: "Dashboard", path: "/", section: "WORKSPACE", icon: TbBlocks },
  { label: "Bills", path: "/bills", section: "OPERATIONS", icon: TbFileInvoice },
  {
    label: "Properties",
    path: "/properties",
    section: "OPERATIONS",
    icon: TbBuilding,
  },
  {
    label: "Vendors",
    path: "/vendors",
    section: "OPERATIONS",
    icon: TbBuildingStore,
  },
  {
    label: "Approvals",
    path: "/approvals",
    section: "OPERATIONS",
    icon: TbCircleCheck,
  },
  {
    label: "Payments",
    path: "/payments",
    section: "OPERATIONS",
    icon: TbCreditCard,
  },
  {
    label: "Exceptions",
    path: "/exceptions",
    section: "OPERATIONS",
    icon: TbAlertTriangle,
  },
  {
    label: "Activity & Audit Logs",
    path: "/activity",
    section: "OVERSIGHT",
    icon: TbHistory,
  },
];

const normalizePath = (path: string) =>
  path === "/" ? path : path.replace(/\/$/, "");

const readLocation = () => ({
  path: normalizePath(window.location.pathname),
  search: window.location.search,
});

export default function App() {
  const [location, setLocation] = useState(readLocation);
  const [auth, setAuth] = useState<{
    session: Session | null;
    loading: boolean;
    error: string | null;
  }>({ session: null, loading: true, error: null });

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let unsubscribe: (() => void) | undefined;

    void Promise.resolve()
      .then(() => {
        if (!active) return;
        const client = getSupabaseClient();
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          authEventReceived = true;
          if (active) setAuth({ session, loading: false, error: null });
        });
        unsubscribe = () => data.subscription.unsubscribe();
        return getValidatedSession();
      })
      .then((session) => {
        if (session !== undefined && active && !authEventReceived) {
          setAuth({ session, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active && !authEventReceived) {
          setAuth({
            session: null,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to initialize authentication.",
          });
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const isLoginPage = location.path === "/login";

  useEffect(() => {
    if (auth.loading || auth.error) return;

    if (isLoginPage && auth.session) {
      replaceTo("/");
    } else if (!isLoginPage && !auth.session) {
      redirectToLogin();
    }
  }, [
    auth.error,
    auth.loading,
    auth.session,
    isLoginPage,
    location.path,
  ]);

  const currentRoute =
    routes.find((route) => route.path === location.path) ?? routes[0];

  if (auth.loading) {
    return <main className="p-8 text-sm text-[#68766f]" role="status">Checking your session…</main>;
  }

  if (auth.error) {
    return (
      <main className="p-8 text-sm text-[#b42318]" role="alert">
        Authentication could not be initialized: {auth.error}
      </main>
    );
  }

  if (isLoginPage) {
    return auth.session ? (
      <main className="p-8 text-sm text-[#68766f]" role="status">Redirecting…</main>
    ) : (
      <LoginPage
        onAuthenticated={(session) =>
          setAuth({ session, loading: false, error: null })
        }
      />
    );
  }

  if (!auth.session) {
    return <main className="p-8 text-sm text-[#68766f]" role="status">Redirecting to sign in…</main>;
  }

  return (
    <AppShell currentRoute={currentRoute} onNavigate={navigateTo} routes={routes}>
      {currentRoute.path === "/bills" ? (
        <BillsPage />
      ) : currentRoute.path === "/properties" ? (
        <PropertiesPage />
      ) : currentRoute.path === "/vendors" ? (
        <VendorsPage />
      ) : currentRoute.path === "/activity" ? (
        <AuditLogsPage
          invoiceUuid={new URLSearchParams(location.search).get("invoice")}
        />
      ) : (
        <WorkspacePage title={currentRoute.label} />
      )}
    </AppShell>
  );
}
