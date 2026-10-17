// E-mail (V-27). Alerts go to the outbox first, so nothing is lost and tests can read it; with RESEND_API_KEY set,
// flushOutbox sends them, without it they stay in the outbox for staff to see. Sign-in links never touch the outbox.
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Tx } from "../db";
import { inScope } from "../db";
import { env } from "../env";
import type { Mail } from "../mail/sign-in-mail";

export async function queueAlert(tx: Tx, org: string | null, subject: string, body: string): Promise<void> {
  const to = env().ALERT_TO.split(",").map((s) => s.trim()).filter(Boolean);
  for (const addr of to.length ? to : ["(no ALERT_TO set)"]) {
    await tx`insert into outbox (organisation_id, to_addr, subject, body) values (${org}, ${addr}, ${"Outcomes: " + subject}, ${body + `\n\n${env().APP_URL}/jobs`})`;
  }
}

export async function flushOutbox(fetcher: typeof fetch = fetch): Promise<{ sent: number; failed: number; skipped: number }> {
  const e = env();
  return inScope("all", async (tx) => {
    const rows = await tx<{ id: string; to_addr: string; subject: string; body: string }[]>`select id, to_addr, subject, body from outbox where sent_at is null and error is null order by created_at limit 50`;
    let sent = 0, failed = 0, skipped = 0;
    for (const m of rows) {
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
