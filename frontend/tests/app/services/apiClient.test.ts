import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthHeader, handleUnauthorized } = vi.hoisted(() => ({
  getAuthHeader: vi.fn(async () => ({
    Authorization: "Bearer test-access-token",
  })),
  handleUnauthorized: vi.fn(async () => {}),
}));

vi.mock("@/auth/supabaseClient", () => ({
  getAuthHeader,
  handleUnauthorized,
}));

import { apiClient, fetchWithAuth } from "@/app/services/apiClient";

describe("authenticated API requests", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    getAuthHeader.mockClear();
    handleUnauthorized.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["GET", () => apiClient.get("/test")],
    ["POST", () => apiClient.post("/test", { value: 1 })],
    ["PUT", () => apiClient.put("/test", { value: 1 })],
    ["PATCH", () => apiClient.patch("/test", { value: 1 })],
    ["DELETE", () => apiClient.delete("/test")],
  ])("sends a bearer token on %s requests", async (_method, makeRequest) => {
    await makeRequest();

    const [, options] = fetchMock.mock.calls[0];
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer test-access-token",
    );
    expect(getAuthHeader).toHaveBeenCalledOnce();
  });

  it("adds the bearer token to multipart requests without setting a content type", async () => {
    const body = new FormData();
    body.append("file", new Blob(["invoice"]));
    await fetchWithAuth("/upload", { method: "POST", body });

    const [, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("clears the session after an unauthorized response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await fetchWithAuth("/test");

    expect(handleUnauthorized).toHaveBeenCalledOnce();
  });
});
