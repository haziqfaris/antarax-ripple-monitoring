// E-mail (V-27): every message goes to the outbox first, so nothing is lost and tests can read it.
// With RESEND_API_KEY set, flushOutbox sends it; without, it stays in the outbox for staff to see.
import type { Tx } from "../db";
import { inScope } from "../db";
import { env } from "../env";

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
