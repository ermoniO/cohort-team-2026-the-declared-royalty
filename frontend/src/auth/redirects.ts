import { replaceTo } from "@/app/navigation";

export function redirectToLogin(): void {
  if (window.location.pathname === "/login") return;
  replaceTo("/login");
}
