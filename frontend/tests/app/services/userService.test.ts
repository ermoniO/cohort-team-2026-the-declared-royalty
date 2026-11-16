import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUser,
  deactivateUserByUserId,
  getUserByUserId,
  getUsers,
  updateUserByUserId,
} from "@/app/services/userService";
import { API_BASE_URL } from "@/app/services/apiClient";
import type { UserResponse } from "@/types/user";

const BASE_URL = `${API_BASE_URL}/api/v1/users`;
const USER_ID = "6aabd049-1200-4b71-b72f-1e24907045d7";

const user: UserResponse = {
  userId: USER_ID,
  username: "fetch-test",
  email: "fetch-test@example.com",
  status: "ACTIVE",
  createdAt: "2026-11-06T00:16:27.190079Z",
  updatedAt: "2026-11-06T00:16:27.190087Z",
};

const fetchMock = vi.fn<typeof fetch>();

function respondWith(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
}

function lastRequest() {
  const [url, init] = fetchMock.mock.lastCall ?? [];
  return { url: String(url), init };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("getUsers", () => {
  it("GETs the users list and returns it", async () => {
    respondWith(200, [user]);

    await expect(getUsers()).resolves.toEqual([user]);

    const { url, init } = lastRequest();
    expect(url).toBe(BASE_URL);
    expect(init?.method).toBe("GET");
  });

  it("returns an empty array when there are no users", async () => {
    respondWith(200, []);

    await expect(getUsers()).resolves.toEqual([]);
  });
});

describe("getUserByUserId", () => {
  it("GETs the user by id", async () => {
    respondWith(200, user);

    await expect(getUserByUserId(USER_ID)).resolves.toEqual(user);

    const { url, init } = lastRequest();
    expect(url).toBe(`${BASE_URL}/${USER_ID}`);
    expect(init?.method).toBe("GET");
  });

  it("rejects when the user is not found", async () => {
    respondWith(404, { status: 404, error: "Not Found" });

    await expect(getUserByUserId(USER_ID)).rejects.toThrow("404");
  });
});

describe("createUser", () => {
  it("POSTs the request as JSON and returns the created user", async () => {
    respondWith(201, user);
    const request = { username: "fetch-test", email: "fetch-test@example.com" };

    await expect(createUser(request)).resolves.toEqual(user);

    const { url, init } = lastRequest();
    expect(url).toBe(BASE_URL);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(request));
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("rejects when the backend returns a validation error", async () => {
    respondWith(400, { status: 400, message: "email: must not be null" });

    await expect(createUser({ username: "x", email: "" })).rejects.toThrow("400");
  });
});

describe("updateUserByUserId", () => {
  it("PUTs only the fields provided and returns the updated user", async () => {
    const updated = { ...user, status: "INACTIVE" };
    respondWith(200, updated);

    await expect(updateUserByUserId(USER_ID, { status: "INACTIVE" })).resolves.toEqual(updated);

    const { url, init } = lastRequest();
    expect(url).toBe(`${BASE_URL}/${USER_ID}`);
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(JSON.stringify({ status: "INACTIVE" }));
  });

  it("rejects when the user is not found", async () => {
    respondWith(404);

    await expect(updateUserByUserId(USER_ID, { status: "ACTIVE" })).rejects.toThrow("404");
  });
});

describe("deactivateUserByUserId", () => {
  it("DELETEs the user and resolves with no value on 204", async () => {
    respondWith(204);

    const res = await deactivateUserByUserId(USER_ID);
    expect(res).toBeUndefined();

    const { url, init } = lastRequest();
    expect(url).toBe(`${BASE_URL}/${USER_ID}`);
    expect(init?.method).toBe("DELETE");
  });

  it("rejects when the user is not found", async () => {
    respondWith(404);

    await expect(deactivateUserByUserId(USER_ID)).rejects.toThrow("404");
  });
});
