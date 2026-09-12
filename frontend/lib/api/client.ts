/** Same-origin fetch against the Django backend.
 *
 * next.config.ts rewrites /api/* to the backend, so the session cookie that
 * identifies the candidate travels on its own -- there is no token to manage
 * and no route handler in between. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super(detail);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed with ${response.status}`;
    throw new ApiError(response.status, detail);
  }

  return body as T;
}
