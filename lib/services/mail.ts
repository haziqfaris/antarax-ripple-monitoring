// E-mail (V-27). Alerts go to the outbox first, so nothing is lost and tests can read it; with RESEND_API_KEY set,
// flushOutbox sends them, without it they stay in the outbox for staff to see. Sign-in links never touch the outbox.
// With ANTARAX_EMAIL_URL and AX_SVC_KEY both set, both go through AntaraX email instead (lib/mail/antarax-switch.ts),
// on its templates; otherwise the Resend path below runs exactly as before.
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tx } from "../db";
import { inScope } from "../db";
import { env } from "../env";
import { signInMail, type Mail } from "../mail/sign-in-mail";
import { antaraxEmailClient } from "../mail/antarax-switch";
import { alertRequest, signInRequest, type OutboxRow } from "../mail/antarax-requests";
import type { EmailClient } from "../mail/antarax-email";

export async function queueAlert(tx: Tx, org: string | null, subject: string, body: string): Promise<void> {
  const to = env().ALERT_TO.split(",").map((s) => s.trim()).filter(Boolean);
  for (const addr of to.length ? to : ["(no ALERT_TO set)"]) {
    await tx`insert into outbox (organisation_id, to_addr, subject, body) values (${org}, ${addr}, ${"Outcomes: " + subject}, ${body + `\n\n${env().APP_URL}/jobs`})`;
  }
}

export async function flushOutbox(fetcher: typeof fetch = fetch): Promise<{ sent: number; failed: number; skipped: number }> {
  const e = env();
  return inScope("all", async (tx) => {
    const rows = await tx<OutboxRow[]>`select id, organisation_id, to_addr, subject, body from outbox where sent_at is null and error is null order by created_at limit 50`;
    let sent = 0, failed = 0, skipped = 0;
    const service = antaraxEmailClient(e, fetcher);
    for (const m of rows) {
      if (service) {
        if (!m.to_addr.includes("@")) { skipped++; continue; }
        const outcome = await sendAlertThroughService(service, m, e.APP_URL);
        if (outcome === "sent") { await tx`update outbox set sent_at = now() where id = ${m.id}`; sent++; }
        else if (outcome === "again") failed++; // left as it is: the next run sends it again with the same key
        else { await tx`update outbox set error = ${outcome.error} where id = ${m.id}`; failed++; }
        continue;
      }
      if (!e.RESEND_API_KEY || !m.to_addr.includes("@")) { skipped++; continue; }
      try {
        const res = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: e.MAIL_FROM, to: [m.to_addr], subject: m.subject, text: m.body }), signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`Resend answered ${res.status}`);
        await tx`update outbox set sent_at = now() where id = ${m.id}`; sent++;
      } catch (err) { await tx`update outbox set error = ${err instanceof Error ? err.message : "failed"} where id = ${m.id}`; failed++; }
    }
    return { sent, failed, skipped };
  });
}

/**
 * Sent at once, never through the outbox: a sign-in link must not sit where other staff can read it (the Jobs page
 * shows the outbox). Without Resend, tests write to MAIL_CAPTURE_FILE and development prints to the server's console.
 */
export async function sendNow(to: string, mail: Mail, fetcher: typeof fetch = fetch): Promise<void> {
  const { subject, text, html } = mail;
  const e = env();
  if (e.RESEND_API_KEY) {
    const res = await fetcher("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: e.MAIL_FROM, reply_to: e.MAIL_REPLY_TO, to: [to], subject, text, html }), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  } else if (e.MAIL_CAPTURE_FILE) {
    await mkdir(dirname(e.MAIL_CAPTURE_FILE), { recursive: true });
    await appendFile(e.MAIL_CAPTURE_FILE, JSON.stringify({ to, subject, text, html, at: new Date().toISOString() }) + "\n");
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[e-mail to ${to}] ${subject}\n${text}`);
  } else {
    throw new Error("E-mail is not set up: set RESEND_API_KEY.");
  }
}

/** What became of one e-mail sent through AntaraX email: never the address, the link or anything typed into it. */
type Outcome = "sent" | "again" | { error: string };

const DONE = new Set(["accepted", "sent", "delivered", "delayed"]);

async function throughService(service: EmailClient, input: Parameters<EmailClient["send"]>[0], key: string): Promise<Outcome> {
  const r = await service.send(input, key);
  if (!r.ok) return r.retry ? "again" : { error: `AntaraX email answered ${r.status}${r.error ? ` (${r.error})` : ""}` };
  const status = String(r.body?.status ?? "");
  if (DONE.has(status)) return "sent";
  if (status === "retryable") return "again";
  const code = typeof r.body?.error_code === "string" ? ` (${r.body.error_code})` : "";
  return { error: `AntaraX email: ${status || "unknown"}${code}` };
}

function sendAlertThroughService(service: EmailClient, row: OutboxRow, appUrl: string): Promise<Outcome> {
  const { input, key } = alertRequest(row, appUrl);
  return throughService(service, input, key);
}

/**
 * The sign-in link. With the switch on it goes through AntaraX email (auth.sign_in.v1); otherwise it is the console's
 * own sign-in e-mail, sent by sendNow exactly as before. Either way it is sent at once and never kept in the outbox.
 * A failure throws a message with no address and no link in it, for the caller to log.
 */
export async function sendSignInLink(o: { to: string; name: string; link: string; expiresAt: Date; minutes: number }, fetcher: typeof fetch = fetch): Promise<void> {
  const e = env();
  const service = antaraxEmailClient(e, fetcher);
  if (!service) return sendNow(o.to, signInMail({ ...o, appUrl: e.APP_URL }), fetcher);
  const { input, key } = signInRequest(o);
  const outcome = await throughService(service, input, key);
  if (outcome === "again") throw new Error("AntaraX email could not be reached or was busy; ask for a new link");
  if (outcome !== "sent") throw new Error(outcome.error);
}
