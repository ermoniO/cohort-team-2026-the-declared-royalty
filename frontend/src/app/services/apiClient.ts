import createClient, { type Client } from "openapi-fetch";
import type { paths } from "@/types/api.generated";

export const API_BASE_URL = "http://localhost:8080";

type LegacyCompat = {
  get: <T>(url: string, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  post: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  put: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  patch: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
  delete: <T>(url: string, headers?: HeadersInit, withAuth?: boolean) => Promise<T>;
};

const rawClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const legacyMethods: LegacyCompat = {
  get: async <T>(url: string): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}${url}`, { method: "GET" });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${res.statusText}`);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  },
  post: async <T, B = unknown>(url: string, body?: B): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${res.statusText}`);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  },
  put: async <T, B = unknown>(url: string, body?: B): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${res.statusText}`);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  },
  patch: async <T, B = unknown>(url: string, body?: B): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${res.statusText}`);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  },
  delete: async <T>(url: string): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}${url}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Request failed with status ${res.status}: ${res.statusText}`);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  },
};

export const apiClient = Object.assign(rawClient, legacyMethods) as Client<paths> & LegacyCompat;
