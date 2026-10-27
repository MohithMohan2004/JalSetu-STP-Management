/** Thin wrappers over the Flask endpoints. Same-origin, cookie session. */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  const type = res.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const data = await res.json();
      return data.error || data.message || `Request failed (${res.status})`;
    }
    const text = (await res.text()).trim();
    // Flask returns short plain-text errors for form endpoints.
    if (text && text.length < 300 && !text.startsWith("<")) return text;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError("Login required", 401);
  }
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  return res.json() as Promise<T>;
}

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  if (type.includes("application/json")) {
    const data = await res.json();
    if (data && data.success === false) throw new ApiError(data.error || data.message || "Request failed", res.status);
    return data as T;
  }
  return {} as T;
}

/**
 * The legacy form endpoints answer with a redirect on success and a short
 * text body on failure. fetch() follows the redirect, so `ok` means done.
 */
export async function postForm(url: string, fields: Record<string, string | Blob>): Promise<void> {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const res = await fetch(url, { method: "POST", credentials: "same-origin", body });
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  if (res.redirected && new URL(res.url).pathname === "/login") {
    window.location.href = "/login";
    throw new ApiError("Login required", 401);
  }
}

/** Submit a registration form; Flask answers JSON when it sees the fetch header. */
export async function submitForm<T>(url: string, body: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "X-Requested-With": "fetch", Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new ApiError("Unexpected response from the server. Please try again.", res.status);
  return res.json() as Promise<T>;
}
