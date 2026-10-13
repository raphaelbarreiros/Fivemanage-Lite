export const IS_DEV = import.meta.env.DEV;

type ApiResponse<T> = {
  status: string;
  data: T;
};

export class ApiError extends Error {
  constructor(error: string, errorMessage: string) {
    super(error);

    this.message = errorMessage;
  }
}

export async function fetchApi<T = unknown>(
  input: string | URL,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const fallback = `Request failed (${res.status})`;
    const errorResponse = await res.json().catch(() => null);
    const message =
      errorResponse?.data?.message ??
      errorResponse?.message?.data?.message ??
      errorResponse?.message ??
      errorResponse?.error;
    throw new ApiError(String(res.status), typeof message === "string" ? message : fallback);
  }

  if (res.status === 204 || res.status === 205) return undefined as T;
  const body = await res.text();
  if (!body.trim()) return undefined as T;
  const response = JSON.parse(body) as ApiResponse<T>;
  return response.data;
}
