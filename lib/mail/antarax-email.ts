// VERBATIM COPY of antarax-api packages/lapisan-email/src/client.ts (AntaraX email, antarax-api docs/15).
// Never edit this file here: change it in antarax-api, then copy it again, whole, over this one.
// Everything below this header is that file, unchanged.

/**
 * The AntaraX email client: what a product calls to send an email through
 * email.antarax.ai (docs/15). One file with no imports, Web Crypto only, so a
 * product that does not vendor Lapisan copies just this file, and it runs on
 * Node, Vercel, Cloudflare Workers, Appwrite functions and Deno.
 *
 *   const email = antaraxEmail({ url: env.ANTARAX_EMAIL_URL, serviceKey: env.AX_SVC_KEY });
 *   if (email) await email.send({ template: "auth.password_reset.v1", to: { email }, variables: {...} }, `reset:${userId}:${tokenId}`);
 *
 * It signs each call with the product's own service key (ax_svc_<product>_...),
 * as AXLE Link does (packages/lapisan-core/src/service-auth.ts). The key stays
 * on the server: never put it, or this client, in a browser bundle.
 *
 * antaraxEmail() answers null when either setting is missing, so a product
 * keeps its own sending until both are set: the switch is the setting.
 */

export interface EmailClientOptions {
  /** https://email.antarax.ai (or a staging Worker). */
  url: string | undefined;
  /** The product's service key, ax_svc_<product>_<32 characters>. */
  serviceKey: string | undefined;
  /** Give up after this many milliseconds. Default 10 seconds. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface EmailSendInput {
  template: string;
  to: { email: string; name?: string };
  variables: Record<string, unknown>;
  locale?: "en-GB" | "en-MY";
  tenant_id?: string;
  correlation_id?: string;
  unsubscribe_url?: string;
  dry_run?: boolean;
}

export interface EmailSendResult {
  ok: boolean;
  /** HTTP status; 0 when the service could not be reached. */
  status: number;
  /** The email (id, status, ...) on success; the preview on a dry run. */
  body: Record<string, unknown> | null;
  /** The contract's error code, when it failed: invalid_request, recipient_suppressed, cap_reached, unavailable... */
  error: string | null;
  /** Worth sending again with the same idempotency key (503, 429 rate_limited, 5xx, network). */
  retry: boolean;
}

const encoder = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

async function hmac(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, encoder.encode(text)));
}

/** The three AntaraX service headers for one call (the same signature as AXLE Link). */
export async function signServiceCall(serviceKey: string, method: string, path: string, body: string, now = Math.floor(Date.now() / 1000)): Promise<Record<string, string>> {
  const key = serviceKey.trim();
  const product = /^ax_svc_([a-z]+)_[A-Za-z0-9]{32}$/.exec(key)?.[1];
  if (!product) throw new Error("AntaraX email: AX_SVC_KEY is not an ax_svc_ key.");
  const canonical = `${now}\n${method.toUpperCase()}\n${path}\n${await sha256(body)}`;
  return {
    "AntaraX-Service": product,
    "AntaraX-Timestamp": String(now),
    "AntaraX-Service-Signature": `v1=${await hmac(key, canonical)}`,
  };
}

export interface EmailClient {
  /** Send one email. The idempotency key makes a retry safe: the same key never sends twice. */
  send(input: EmailSendInput, idempotencyKey: string): Promise<EmailSendResult>;
  /** Where an email is now. */
  get(id: string): Promise<EmailSendResult>;
}

export function antaraxEmail(options: EmailClientOptions): EmailClient | null {
  const base = options.url?.trim().replace(/\/+$/, "");
  const key = options.serviceKey?.trim();
  if (!base || !key) return null;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function call(method: "GET" | "POST", path: string, body: string, extra: Record<string, string> = {}): Promise<EmailSendResult> {
    try {
      const headers = { ...(await signServiceCall(key!, method, path, body)), ...extra };
      if (method === "POST") headers["Content-Type"] = "application/json";
      const res = await doFetch(`${base}${path}`, { method, headers, body: method === "POST" ? body : undefined, signal: AbortSignal.timeout(timeoutMs) });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const error = (json?.error as { code?: string } | undefined)?.code ?? null;
      const retry = res.status >= 500 || (res.status === 429 && error === "rate_limited") || (res.status === 409 && error === "idempotency_in_progress");
      return { ok: res.ok, status: res.status, body: res.ok ? json : null, error: res.ok ? null : error ?? `http_${res.status}`, retry };
    } catch {
      return { ok: false, status: 0, body: null, error: "unreachable", retry: true };
    }
  }

  return {
    send(input, idempotencyKey) {
      if (!idempotencyKey || idempotencyKey.length > 120) throw new Error("AntaraX email: an idempotency key of 1 to 120 characters is required.");
      return call("POST", "/v1/emails", JSON.stringify(input), { "Idempotency-Key": idempotencyKey });
    },
    get(id) {
      return call("GET", `/v1/emails/${encodeURIComponent(id)}`, "");
    },
  };
}
