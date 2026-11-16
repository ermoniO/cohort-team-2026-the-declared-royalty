import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replaceTo = vi.hoisted(() => vi.fn());
vi.mock("@/app/navigation", () => ({ replaceTo }));

import { redirectToLogin } from "@/auth/redirects";

describe("redirectToLogin", () => {
  beforeEach(() => {
    replaceTo.mockClear();
    vi.stubGlobal("window", { location: { pathname: "/bills" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces a protected route with the login page", () => {
    redirectToLogin();
    expect(replaceTo).toHaveBeenCalledWith("/login");
  });

  it("does not redirect again when already on the login page", () => {
    vi.stubGlobal("window", { location: { pathname: "/login" } });
    redirectToLogin();
    expect(replaceTo).not.toHaveBeenCalled();
  });
});
