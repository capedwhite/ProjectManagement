const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function request<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers ?? {});

  if (!(body instanceof FormData) && method !== "GET" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "include",
    body:
      body !== undefined && method !== "GET" && !(body instanceof FormData)
        ? JSON.stringify(body)
        : body instanceof FormData
          ? body
          : undefined,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMsg =
      typeof payload === "object" && payload
        ? (payload as { error?: string; message?: string }).error ||
          (payload as { error?: string; message?: string }).message ||
          "Request failed"
        : typeof payload === "string" && payload
          ? payload
          : "Request failed";

    throw new Error(String(errorMsg));
  }

  return payload as T;
}

const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, "GET", undefined, options),
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, "POST", body, options),
  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, "PUT", body, options),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, "PATCH", body, options),
  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, "DELETE", undefined, options),
};

export default api;
