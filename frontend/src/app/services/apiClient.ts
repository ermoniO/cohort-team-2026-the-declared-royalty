import createClient, { type Client } from "openapi-fetch";
import type { paths } from "@/types/api.generated";

export const API_BASE_URL: string =
  (import.meta.env?.VITE_API_BASE_URL as string) || "http://localhost:8080";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  withAuth: boolean = true,
): Promise<T> {
  const authHeaders = {};
  if (withAuth) {
    // authHeaders = await getAuthHeader();
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Request failed with status ${response.status}: ${response.statusText}`,
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

type LegacyCompat = {
  get: <T>(url: string, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  post: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  put: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  patch: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  delete: <T>(url: string, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
};

const legacyMethods: LegacyCompat = {
  get: <T>(url: string, headers?: HeadersInit, withAuth?: boolean) =>
    request<T>(url, { method: "GET", headers }, withAuth ?? true),
  post: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) =>
    request<T>(
      url,
      {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
        headers,
      },
      withAuth ?? true,
    ),
  put: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) =>
    request<T>(
      url,
      {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
        headers,
      },
      withAuth ?? true,
    ),
  patch: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) =>
    request<T>(
      url,
      {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
        headers,
      },
      withAuth ?? true,
    ),
  delete: <T>(url: string, headers?: HeadersInit, withAuth?: boolean) =>
    request<T>(url, { method: "DELETE", headers }, withAuth ?? false),
};

const rawClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const apiClient = Object.assign(rawClient, legacyMethods) as Client<paths> & LegacyCompat;
