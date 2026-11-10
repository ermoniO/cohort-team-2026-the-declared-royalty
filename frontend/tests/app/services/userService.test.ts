import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createUser,
  deactivateUserByUserId,
  getUserByUserId,
  getUsers,
  updateUserByUserId,
} from "../../../src/app/services/userService";
import type { UserResponse } from "../../../src/types/user";

const BASE_URL = "http://localhost:8080/api/v1/users";
const USER_ID = "6aabd049-1200-4b71-b72f-1e24907045d7";

const user: UserResponse = {
  userId: USER_ID,
  username: "fetch-test",
  email: "fetch-test@example.com",
  status: "ACTIVE",
  createdAt: "2026-11-06T00:16:27.190079Z",
  updatedAt: "2026-11-06T00:16:27.190087Z",
};

let lastCallUrl: string | undefined;
let lastCallInit: RequestInit | undefined;
let mockResponse: { status: number; body?: unknown } | null = null;

const originalFetch = globalThis.fetch;

function respondWith(status: number, body?: unknown) {
  mockResponse = { status, body };
}

beforeEach(() => {
  lastCallUrl = undefined;
  lastCallInit = undefined;
  mockResponse = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    lastCallUrl = input.toString();
    lastCallInit = init;
    const resp = mockResponse ?? { status: 200, body: null };
    return new Response(resp.body === undefined || resp.body === null ? null : JSON.stringify(resp.body), {
      status: resp.status,
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getUsers", () => {
  it("GETs the users list and returns it", async () => {
    respondWith(200, [user]);

    const res = await getUsers();
    assert.deepEqual(res, [user]);

    assert.equal(lastCallUrl, BASE_URL);
    assert.equal(lastCallInit?.method, "GET");
  });

  it("returns an empty array when there are no users", async () => {
    respondWith(200, []);

    const res = await getUsers();
    assert.deepEqual(res, []);
  });
});

describe("getUserByUserId", () => {
  it("GETs the user by id", async () => {
    respondWith(200, user);

    const res = await getUserByUserId(USER_ID);
    assert.deepEqual(res, user);

    assert.equal(lastCallUrl, `${BASE_URL}/${USER_ID}`);
    assert.equal(lastCallInit?.method, "GET");
  });

  it("rejects when the user is not found", async () => {
    respondWith(404, { status: 404, error: "Not Found" });

    await assert.rejects(async () => getUserByUserId(USER_ID), /404/);
  });
});

describe("createUser", () => {
  it("POSTs the request as JSON and returns the created user", async () => {
    respondWith(201, user);
    const request = { username: "fetch-test", email: "fetch-test@example.com" };

    const res = await createUser(request);
    assert.deepEqual(res, user);

    assert.equal(lastCallUrl, BASE_URL);
    assert.equal(lastCallInit?.method, "POST");
    assert.equal(lastCallInit?.body, JSON.stringify(request));
    assert.equal((lastCallInit?.headers as Record<string, string>)?.["Content-Type"], "application/json");
  });

  it("rejects when the backend returns a validation error", async () => {
    respondWith(400, { status: 400, message: "email: must not be null" });

    await assert.rejects(async () => createUser({ username: "x", email: "" }), /400/);
  });
});

describe("updateUserByUserId", () => {
  it("PUTs only the fields provided and returns the updated user", async () => {
    const updated = { ...user, status: "INACTIVE" };
    respondWith(200, updated);

    const res = await updateUserByUserId(USER_ID, { status: "INACTIVE" });
    assert.deepEqual(res, updated);

    assert.equal(lastCallUrl, `${BASE_URL}/${USER_ID}`);
    assert.equal(lastCallInit?.method, "PUT");
    assert.equal(lastCallInit?.body, JSON.stringify({ status: "INACTIVE" }));
  });

  it("rejects when the user is not found", async () => {
    respondWith(404);

    await assert.rejects(async () => updateUserByUserId(USER_ID, { status: "ACTIVE" }), /404/);
  });
});

describe("deactivateUserByUserId", () => {
  it("DELETEs the user and resolves with no value on 204", async () => {
    respondWith(204);

    const res = await deactivateUserByUserId(USER_ID);
    assert.equal(res, undefined);

    assert.equal(lastCallUrl, `${BASE_URL}/${USER_ID}`);
    assert.equal(lastCallInit?.method, "DELETE");
  });

  it("rejects when the user is not found", async () => {
    respondWith(404);

    await assert.rejects(async () => deactivateUserByUserId(USER_ID), /404/);
  });
});
