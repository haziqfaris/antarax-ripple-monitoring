// The switch to AntaraX email (antarax-api docs/15, rule 17). When ANTARAX_EMAIL_URL and AX_SVC_KEY are both set,
// every e-mail goes through the service as Gauge <gauge@mail.antarax.ai>, on an approved template; otherwise the
// console's own Resend sending carries on as before. A placeholder (the "…" in .env.example, "<key>", "REPLACE_…")
// counts as unset, so a half-filled environment never switches over by accident.
import { antaraxEmail, type EmailClient } from "./antarax-email";

const KEY = /^ax_svc_[a-z]+_[A-Za-z0-9]{32}$/;
const PLACEHOLDER = /\.\.\.|…|[<>{}]|replace|change.?me|placeholder|example/i;

/** The service's address, or undefined when it is missing, not https or a placeholder. */
export function serviceUrl(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v || PLACEHOLDER.test(v)) return undefined;
  try {
    return new URL(v).protocol === "https:" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The service key, or undefined when it is missing or isn't an ax_svc_ key (a placeholder never is). */
export function serviceKey(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && KEY.test(v) ? v : undefined;
}

/** Whether the switch is on. Says nothing about the values themselves. */
export function antaraxEmailOn(source: { ANTARAX_EMAIL_URL?: string; AX_SVC_KEY?: string }): boolean {
  return !!serviceUrl(source.ANTARAX_EMAIL_URL) && !!serviceKey(source.AX_SVC_KEY);
}

/** The client when the switch is on, else null (and the caller sends as before). */
export function antaraxEmailClient(source: { ANTARAX_EMAIL_URL?: string; AX_SVC_KEY?: string }, fetcher?: typeof fetch): EmailClient | null {
  if (!antaraxEmailOn(source)) return null;
  return antaraxEmail({ url: serviceUrl(source.ANTARAX_EMAIL_URL), serviceKey: serviceKey(source.AX_SVC_KEY), fetch: fetcher });
}
