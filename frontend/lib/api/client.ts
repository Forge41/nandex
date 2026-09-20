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

/** A stand-in for the network, installed only by the dev screen harness.
 *
 * Three answers: `{ body }` satisfies the call, `"refuse"` fails it with an ApiError
 * the calling screen handles exactly as it would a real one, and `"pass"` sends it to
 * the server after all. `"pass"` is what keeps an armed harness from breaking a real
 * page reached by a client-side navigation -- the interceptor stays installed and
 * declines anything that is not the harness's own session.
 *
 * A seam rather than an import of the harness, so nothing in the app depends on
 * development-only code. */
export type InterceptorAnswer = { body: unknown } | "refuse" | "pass";

export type RequestInterceptor = (path: string, init: RequestInit) => InterceptorAnswer;

let interceptor: RequestInterceptor | null = null;

export function setRequestInterceptor(next: RequestInterceptor | null): void {
  interceptor = next;
}

/** A request that must survive the page, which rules out fetch.
 *
 * Here rather than at the call site so it passes the same interceptor: a beacon fired
 * from a harness screen would otherwise reach the real server, and `pagehide` fires on
 * every navigation away from it.
 */
export function beacon(path: string): void {
  if (interceptor && interceptor(path, { method: "POST" }) !== "pass") return;
  navigator.sendBeacon?.(`/api${path}`);
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
  const answer = interceptor?.(path, init) ?? "pass";
  if (answer === "refuse") {
    throw new ApiError(0, `No server here: ${init.method ?? "GET"} ${path}`);
  }
  if (answer !== "pass") return answer.body as T;

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
