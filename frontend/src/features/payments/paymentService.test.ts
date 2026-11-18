import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAutoPaySettings,
  updateAutoPaySettings,
} from "./paymentService";
import { API_BASE_URL } from "@/app/services/apiClient";

const AUTO_PAY_URL = `${API_BASE_URL}/api/v1/payments/auto-pay`;
const fetchMock = vi.fn<typeof fetch>();

function respondWith(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("auto-pay settings", () => {
  it("loads the persisted setting", async () => {
    respondWith(200, { enabled: true });

    await expect(getAutoPaySettings()).resolves.toEqual({ enabled: true });

    expect(fetchMock).toHaveBeenCalledWith(
      AUTO_PAY_URL,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it.each([true, false])("updates auto-pay to %s", async (enabled) => {
    respondWith(200, { enabled });

    await expect(updateAutoPaySettings(enabled)).resolves.toEqual({ enabled });

    expect(fetchMock).toHaveBeenCalledWith(
      AUTO_PAY_URL,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ enabled }),
      }),
    );
  });

  it("surfaces update failures", async () => {
    respondWith(400);

    await expect(updateAutoPaySettings(true)).rejects.toThrow("400");
  });
});
