// The outbox with the AntaraX email switch (V-27, antarax-api docs/15): off, Resend sends it as before; on, each
// alert goes to the service on system.action_required.v1 with its row id as the key, is marked sent only when the
// service says so, waits for the next run when the service asks to be tried again, and records a refusal.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { freshDb } from "./helpers";
import { inScope } from "@/lib/db";
import { resetEnv } from "@/lib/env";
import { flushOutbox, queueAlert } from "@/lib/services/mail";

const KEY = "ax_svc_gauge_" + "Zx9".repeat(10) + "Qw";
let db: Awaited<ReturnType<typeof freshDb>>;

interface Call { url: string; headers: Record<string, string>; json: Record<string, unknown> }
function recorder(answer: (c: Call) => Response) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const c = { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, json: JSON.parse(String(init?.body ?? "{}")) };
    calls.push(c);
    return answer(c);
  }) as typeof fetch;
  return { calls, fetcher };
}
const rows = () => inScope("all", (tx) => tx<{ id: string; sent_at: Date | null; error: string | null }[]>`select id, sent_at, error from outbox order by created_at`);
const setMail = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  resetEnv();
};

beforeAll(async () => { db = await freshDb(); });
afterAll(async () => { setMail({ RESEND_API_KEY: undefined, ANTARAX_EMAIL_URL: undefined, AX_SVC_KEY: undefined }); await db.drop(); });
beforeEach(async () => {
  setMail({ APP_URL: "https://gauge.antarax.ai", ALERT_TO: "ops@reka.example" });
  await inScope("all", async (tx) => { await tx`delete from outbox`; await queueAlert(tx, null, "Claims helper: not answering", "Claims helper is not answering. It refused the key."); });
});

describe("flushing the outbox", () => {
  it("leaves it in the outbox with neither Resend nor the switch", async () => {
    setMail({ RESEND_API_KEY: undefined, ANTARAX_EMAIL_URL: undefined, AX_SVC_KEY: undefined });
    const { calls, fetcher } = recorder(() => new Response(null, { status: 500 }));
    expect(await flushOutbox(fetcher)).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(calls).toHaveLength(0);
  });

  it("sends through Resend, as before, while the switch is off", async () => {
    setMail({ RESEND_API_KEY: "re_test_only", ANTARAX_EMAIL_URL: "https://email-staging.antarax.ai", AX_SVC_KEY: undefined });
    const { calls, fetcher } = recorder(() => Response.json({ id: "re_1" }));
    expect(await flushOutbox(fetcher)).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.json).toMatchObject({ to: ["ops@reka.example"], subject: "Outcomes: Claims helper: not answering" });
    expect((await rows())[0]!.sent_at).not.toBeNull();
  });

  it("sends through AntaraX email when the switch is on, keyed by the row, and marks it sent", async () => {
    setMail({ RESEND_API_KEY: "re_test_only", ANTARAX_EMAIL_URL: "https://email-staging.antarax.ai", AX_SVC_KEY: KEY });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { calls, fetcher } = recorder(() => Response.json({ id: "em_1", object: "email", status: "sent" }, { status: 201 }));
    expect(await flushOutbox(fetcher)).toEqual({ sent: 1, failed: 0, skipped: 0 });
    const [row] = await rows();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://email-staging.antarax.ai/v1/emails");
    expect(calls[0]!.headers["Idempotency-Key"]).toBe(`outbox:${row!.id}`);
    expect(calls[0]!.json).toMatchObject({ template: "system.action_required.v1", to: { email: "ops@reka.example" }, variables: { subject: "Claims helper: not answering", action_url: "https://gauge.antarax.ai/jobs" } });
    expect(row!.sent_at).not.toBeNull();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("tries again on the next run, with the same key, when the service is unavailable", async () => {
    setMail({ ANTARAX_EMAIL_URL: "https://email-staging.antarax.ai", AX_SVC_KEY: KEY });
    const down = recorder(() => Response.json({ error: { code: "unavailable" } }, { status: 503 }));
    expect(await flushOutbox(down.fetcher)).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect((await rows())[0]).toMatchObject({ sent_at: null, error: null });
    const up = recorder(() => Response.json({ id: "em_1", object: "email", status: "sent" }, { status: 201 }));
    expect(await flushOutbox(up.fetcher)).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(up.calls[0]!.headers["Idempotency-Key"]).toBe(down.calls[0]!.headers["Idempotency-Key"]);
  });

  it("records a refusal on the row, without the address", async () => {
    setMail({ ANTARAX_EMAIL_URL: "https://email-staging.antarax.ai", AX_SVC_KEY: KEY });
    const { fetcher } = recorder(() => Response.json({ id: "em_2", object: "email", status: "suppressed", to: "o***@reka.example" }, { status: 201 }));
    expect(await flushOutbox(fetcher)).toEqual({ sent: 0, failed: 1, skipped: 0 });
    const [row] = await rows();
    expect(row!.error).toBe("AntaraX email: suppressed");
    expect(row!.sent_at).toBeNull();
  });
});
