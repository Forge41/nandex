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
  return send<T>(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

/** A file upload.
 *
 * Separate from apiFetch because the Content-Type must be left unset: the
 * browser generates the multipart boundary and writes the header itself, and a
 * hand-written one has no boundary in it, so the server finds no fields. */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return send<T>(path, { method: "POST", body: form });
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "same-origin" });

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
