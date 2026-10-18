// What the console asks AntaraX email to send, as data: a template id and its variables, never HTML, a From or a
// subject line of its own (antarax-api docs/15 §15.4). Each request carries a stable idempotency key, so sending the
// same event twice never sends two e-mails. Links are built from APP_URL, which in production is
// https://gauge.antarax.ai, the only origin the service accepts for Gauge.
import { createHash } from "node:crypto";
import type { EmailSendInput } from "./antarax-email";

export interface ServiceRequest { input: EmailSendInput; key: string }

/** Keep text within a template's limit, ending with an ellipsis when it had to be cut. */
export function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

const base = (appUrl: string) => appUrl.replace(/\/+$/, "");
const nameOf = (name: string | undefined) => (name?.trim() ? clip(name, 120) : undefined);

/**
 * The sign-in link (auth.sign_in.v1, a security e-mail). There is no e-mailed code: the second step is the code in
 * the person's authenticator app. The key is a hash of the link, so it names this one link without carrying it:
 * the service keeps idempotency keys, and a sign-in link must never sit anywhere but the person's inbox.
 */
export function signInRequest(o: { to: string; name?: string; link: string; minutes: number }): ServiceRequest {
  const key = "sign-in:" + createHash("sha256").update("gauge-sign-in-link\n" + o.link).digest("hex").slice(0, 48);
  return {
    input: { template: "auth.sign_in.v1", to: { email: o.to, name: nameOf(o.name) }, variables: { action_url: o.link, expires_in_minutes: o.minutes } },
    key,
  };
}

/** An outbox row, as flushOutbox reads it. */
export interface OutboxRow { id: string; organisation_id: string | null; to_addr: string; subject: string; body: string }

/**
 * An alert from the outbox (system.action_required.v1): an application's link is late or has stopped answering,
 * and someone should look. The outbox row is the event, so its id is the key. The subject drops the console's own
 * "Outcomes: " prefix (the sender already says Gauge), and the body drops the address queueAlert adds for Resend's
 * plain text: the template draws it as the button instead.
 */
export function alertRequest(row: OutboxRow, appUrl: string): ServiceRequest {
  const jobs = `${base(appUrl)}/jobs`;
  const subject = clip(row.subject.replace(/^Outcomes:\s*/, ""), 120);
  const message = clip(row.body.split(/\n{2,}/).filter((p) => p.trim() && p.trim() !== jobs).join(" "), 600);
  return {
    input: {
      template: "system.action_required.v1",
      to: { email: row.to_addr },
      variables: { subject, heading: subject, message: message || subject, action_label: "Open Jobs", action_url: jobs },
      ...(row.organisation_id ? { tenant_id: row.organisation_id } : {}),
      correlation_id: `outbox:${row.id}`,
    },
    key: `outbox:${row.id}`,
  };
}
