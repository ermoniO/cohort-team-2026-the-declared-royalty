import { useEffect, useState } from "react";
import AppShell from "./layout/AppShell";
import type { AppRoute } from "./types/route";
import WorkspacePage from "./pages/WorkspacePage";
import DashboardPage from "./pages/DashboardPage";
import BillsPage from "./pages/BillsPage";
import PropertiesPage from "./pages/PropertiesPage";
import VendorsPage from "./pages/VendorsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import PaymentsPage from "./pages/PaymentsPage";
import { navigateTo } from "./app/navigation";
import {
  TbBlocks,
  TbBuilding,
  TbBuildingStore,
  TbCircleCheck,
  TbCreditCard,
  TbFileInvoice,
  TbHistory,
} from "react-icons/tb";

const routes: AppRoute[] = [
  {
    label: "Dashboard",
    path: "/",
    section: "WORKSPACE",
    icon: TbBlocks
  },
  {
    label: "Bills",
    path: "/bills",
    section: "OPERATIONS",
    icon: TbFileInvoice
  },
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

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const currentRoute =
    routes.find((route) => route.path === location.path) ?? routes[0];

  // TODO(auth): add a sign-in page (e.g. /login, outside AppShell) and guard the
  // routes below: while the session is loading show a loader, and when there's no
  // session send the user to /login, then back to the page they asked for.
  return (
    <AppShell currentRoute={currentRoute} onNavigate={navigateTo} routes={routes}>
      {
        currentRoute.path === "/" ? (
          <DashboardPage />
        ) : currentRoute.path === "/bills" ? (
          <BillsPage />
        ) : currentRoute.path === "/properties" ? (
          <PropertiesPage />
        ) : currentRoute.path === "/vendors" ? (
          <VendorsPage />
        ) : currentRoute.path === "/approvals" ? (
          <ApprovalsPage />
        ) : currentRoute.path === "/activity" ? (
          <AuditLogsPage
            invoiceUuid={new URLSearchParams(location.search).get("invoice")}
          />
        ) : currentRoute.path === "/payments" ? (
          <PaymentsPage />
        ) : (
          <WorkspacePage title={currentRoute.label} />
        )
      }
    </AppShell>
  );
}
