import { getAuthHeader, handleUnauthorized } from "@/auth/supabaseClient";

export const API_BASE_URL: string =
  (import.meta.env?.VITE_API_BASE_URL as string) || "http://localhost:8080";

// Thrown for non-2xx responses. Still an Error (same message as before), plus the
// status so callers can tell e.g. 404, 405 and 409 apart.
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const authHeaders = await getAuthHeader();
  for (const [name, value] of Object.entries(authHeaders)) {
    headers.set(name, value);
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) await handleUnauthorized();
  return response;
}

/**
 * Make a request to the API
 * @param endpoint The endpoint to request
 * @param options The options for the request
 * @returns The response from the API
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Request failed with status ${response.status}: ${response.statusText}`,
    );
  }

  // Update endpoints may return an empty body (204, or 200 with no content).
  // Treat that as a successful call instead of failing while parsing.
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * The API client
 * @returns The API client
 */
export const apiClient = {
  get: <T>(url: string, headers?: HeadersInit) =>
    request<T>(url, { method: "GET", headers }),

  /**
   * Make a POST request to the API
   * @param url The URL to request
   * @param body The body of the request
   * @param headers The headers for the request
   * @returns The response from the API
   */
  post: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit) =>
    request<T>(url, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),

  /**
   * Make a PUT request to the API
   * @param url The URL to request
   * @param body The body of the request
   * @param headers The headers for the request
   * @returns The response from the API
   */
  put: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit) =>
    request<T>(url, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),

  /**
   * Make a PATCH request to the API
   * @param url The URL to request
   * @param body The body of the request
   * @param headers The headers for the request
   * @returns The response from the API
   */
  patch: <T, B = unknown>(url: string, body?: B, headers?: HeadersInit) =>
    request<T>(url, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    }),

  /**
   * Make a DELETE request to the API
   * @param url The URL to request
   * @param headers The headers for the request
   * @returns The response from the API
   */
  delete: <T>(url: string, headers?: HeadersInit) =>
    request<T>(url, { method: "DELETE", headers }),
};
