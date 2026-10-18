// The switch to AntaraX email (antarax-api docs/15): off, the console sends through Resend as before; on, every
// e-mail goes to the service on an approved template, within its limits, with a stable key, and nothing it logs or
// throws carries an address or a sign-in link.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resetEnv } from "@/lib/env";
import { antaraxEmailOn } from "@/lib/mail/antarax-switch";
import { alertRequest, clip, signInRequest } from "@/lib/mail/antarax-requests";
import { sendSignInLink } from "@/lib/services/mail";

const KEY = "ax_svc_gauge_" + "Ab3".repeat(10) + "Cd";
const SERVICE = "https://email-staging.antarax.ai";
const APP = "https://gauge.antarax.ai";
const TO = "nurul@reka.example";
const TOKEN = "T0kenT0kenT0kenT0kenT0kenT0kenT0kenT0ken";
const LINK = `${APP}/sign-in/link?t=${TOKEN}`;
const BASE_ENV = { DATABASE_URL: "postgres://x@localhost/x", SEAL_KEY: Buffer.alloc(32, 7).toString("base64"), CRON_SECRET: "x".repeat(32), APP_URL: APP };
const MAIL_VARS = ["RESEND_API_KEY", "ANTARAX_EMAIL_URL", "AX_SVC_KEY", "MAIL_CAPTURE_FILE"] as const;

interface Call { url: string; init: RequestInit; json: Record<string, unknown> }

/** A stand-in for both Resend and the service: records each call and answers as the service would. */
function recorder(answer: (call: Call) => Response = () => Response.json({ id: "em_1", object: "email", status: "sent" }, { status: 201 })) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {}, json: init?.body ? JSON.parse(String(init.body)) : {} };
    calls.push(call);
    return answer(call);
  }) as typeof fetch;
  return { calls, fetcher };
}

function setEnv(extra: Record<string, string>) {
  for (const k of MAIL_VARS) delete process.env[k];
  Object.assign(process.env, BASE_ENV, extra);
  resetEnv();
}

/** The template limits from antarax-api packages/lapisan-email/src/templates.ts. */
function withinLimits(template: string, v: Record<string, unknown>) {
  const text = (k: string, max: number) => { expect(typeof v[k], k).toBe("string"); expect((v[k] as string).trim().length, k).toBeGreaterThan(0); expect((v[k] as string).length, k).toBeLessThanOrEqual(max); };
  const https = (k: string) => { const u = new URL(v[k] as string); expect(u.origin, k).toBe(APP); expect(u.protocol).toBe("https:"); expect((v[k] as string).length).toBeLessThanOrEqual(2000); };
  if (template === "auth.sign_in.v1") {
    expect(Object.keys(v).sort()).toEqual(["action_url", "expires_in_minutes"]);
    https("action_url");
    expect(Number.isInteger(v.expires_in_minutes) && (v.expires_in_minutes as number) >= 1 && (v.expires_in_minutes as number) <= 10080).toBe(true);
  } else if (template === "system.action_required.v1") {
    expect(Object.keys(v).sort()).toEqual(["action_label", "action_url", "heading", "message", "subject"]);
    text("subject", 120); text("heading", 120); text("message", 600); text("action_label", 40); https("action_url");
  } else throw new Error(`unexpected template ${template}`);
}

let logged: string[];
beforeEach(() => {
  logged = [];
  for (const m of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logged.push(a.map(String).join(" ")); });
});
afterEach(() => { vi.restoreAllMocks(); for (const k of MAIL_VARS) delete process.env[k]; resetEnv(); });

describe("the switch", () => {
  it("is on only when both settings are real", () => {
    expect(antaraxEmailOn({})).toBe(false);
    expect(antaraxEmailOn({ ANTARAX_EMAIL_URL: SERVICE })).toBe(false);
    expect(antaraxEmailOn({ AX_SVC_KEY: KEY })).toBe(false);
    expect(antaraxEmailOn({ ANTARAX_EMAIL_URL: SERVICE, AX_SVC_KEY: KEY })).toBe(true);
    expect(antaraxEmailOn({ ANTARAX_EMAIL_URL: ` ${SERVICE}/ `, AX_SVC_KEY: ` ${KEY} ` })).toBe(true);
  });

  it("counts placeholders as unset", () => {
    for (const key of ["", "ax_svc_gauge_…", "ax_svc_gauge_...", "<ax_svc_gauge key>", "REPLACE_WITH_AX_SVC_KEY", "ax_svc_gauge_" + "x".repeat(31)]) {
      expect(antaraxEmailOn({ ANTARAX_EMAIL_URL: SERVICE, AX_SVC_KEY: key }), key).toBe(false);
    }
    for (const url of ["", "https://…", "https://email.example", "<https://email.antarax.ai>", "http://email.antarax.ai", "email.antarax.ai", "REPLACE_WITH_URL"]) {
      expect(antaraxEmailOn({ ANTARAX_EMAIL_URL: url, AX_SVC_KEY: KEY }), url).toBe(false);
    }
  });

  it("is off with .env.example as it is", () => {
    const example = Object.fromEntries(readFileSync(".env.example", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    expect("ANTARAX_EMAIL_URL" in example && "AX_SVC_KEY" in example).toBe(true);
    expect(antaraxEmailOn(example)).toBe(false);
  });
});

describe("the sign-in link", () => {
  const send = (fetcher: typeof fetch) => sendSignInLink({ to: TO, name: "Nurul Aina", link: LINK, expiresAt: new Date(Date.now() + 15 * 60_000), minutes: 15 }, fetcher);

  it("goes through Resend, as before, while the switch is off", async () => {
    setEnv({ RESEND_API_KEY: "re_test_only", ANTARAX_EMAIL_URL: SERVICE, AX_SVC_KEY: "ax_svc_gauge_…" });
    const { calls, fetcher } = recorder(() => Response.json({ id: "re_1" }));
    await send(fetcher);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.json).toMatchObject({ from: "AXLE · Outcomes <outcomes@antarax.ai>", reply_to: "support@go.antarax.ai", to: [TO], subject: "Your sign-in link for AXLE · Outcomes" });
    expect(String(calls[0]!.json.html)).toContain(LINK);
  });

  it("goes to AntaraX email on auth.sign_in.v1 when the switch is on, and never to Resend", async () => {
    setEnv({ RESEND_API_KEY: "re_test_only", ANTARAX_EMAIL_URL: SERVICE + "/", AX_SVC_KEY: KEY });
    const { calls, fetcher } = recorder();
    await send(fetcher);
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.url).toBe(`${SERVICE}/v1/emails`);
    const h = c.init.headers as Record<string, string>;
    expect(h["AntaraX-Service"]).toBe("gauge");
    expect(h["AntaraX-Service-Signature"]).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(JSON.stringify(h)).not.toContain(KEY);
    expect(Object.keys(c.json).sort()).toEqual(["template", "to", "variables"]);
    expect(c.json.template).toBe("auth.sign_in.v1");
    expect(c.json.to).toEqual({ email: TO, name: "Nurul Aina" });
    expect((c.json.variables as Record<string, unknown>).action_url).toBe(LINK);
    withinLimits("auth.sign_in.v1", c.json.variables as Record<string, unknown>);
    // The key names this link without carrying it, and is the same if the same link is sent again.
    const key = h["Idempotency-Key"]!;
    expect(key).toMatch(/^sign-in:[0-9a-f]{48}$/);
    expect(key).not.toContain(TOKEN);
    expect(signInRequest({ to: TO, link: LINK, minutes: 15 }).key).toBe(key);
    expect(signInRequest({ to: TO, link: LINK + "x", minutes: 15 }).key).not.toBe(key);
    expect(logged.join("\n")).toBe("");
  });

  it("throws without the address or the link when the service refuses it, and logs nothing itself", async () => {
    setEnv({ ANTARAX_EMAIL_URL: SERVICE, AX_SVC_KEY: KEY });
    for (const answer of [
      () => Response.json({ error: { code: "invalid_request", message: `variables.action_url: ${LINK} for ${TO}` } }, { status: 422 }),
      () => Response.json({ id: "em_2", object: "email", status: "suppressed", to: "n***@reka.example" }, { status: 201 }),
      () => Response.json({ error: { code: "unavailable" } }, { status: 503 }),
      () => { throw new Error(`connect failed for ${TO} ${LINK}`); },
    ]) {
      const { fetcher } = recorder(answer);
      const err = await send(fetcher).then(() => null, (e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err!.message).not.toContain(TO);
      expect(err!.message).not.toContain(TOKEN);
    }
    expect(logged.join("\n")).toBe("");
  });

  it("drops a name over the template's limit to its length, and an empty one altogether", () => {
    expect(signInRequest({ to: TO, name: "A".repeat(200), link: LINK, minutes: 15 }).input.to.name).toHaveLength(120);
    expect(signInRequest({ to: TO, name: "  ", link: LINK, minutes: 15 }).input.to.name).toBeUndefined();
  });
});

describe("an alert from the outbox", () => {
  const row = { id: "9d7c6f3e-5a8b-4c2d-9e1f-0a1b2c3d4e5f", organisation_id: "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9", to_addr: "ops@reka.example", subject: "Outcomes: Claims helper: not answering", body: `Claims helper is not answering. It refused the key.\n\nIts figures stay as they were; missing days show as gaps, never as zeros.\n\n${APP}/jobs` };

  it("is system.action_required.v1, keyed by its outbox row, with the button on Jobs", () => {
    const { input, key } = alertRequest(row, APP + "/");
    expect(key).toBe(`outbox:${row.id}`);
    expect(input.template).toBe("system.action_required.v1");
    expect(input.to).toEqual({ email: "ops@reka.example" });
    expect(input.tenant_id).toBe(row.organisation_id);
    expect(input.variables).toEqual({
      subject: "Claims helper: not answering", heading: "Claims helper: not answering",
      message: "Claims helper is not answering. It refused the key. Its figures stay as they were; missing days show as gaps, never as zeros.",
      action_label: "Open Jobs", action_url: `${APP}/jobs`,
    });
    withinLimits("system.action_required.v1", input.variables);
    expect(JSON.stringify(input)).not.toMatch(/"(from|html|reply_to)"/);
  });

  it("stays within the template's limits however long the application's name or reason", () => {
    const long = { ...row, organisation_id: null, subject: "Outcomes: " + "A very long application name ".repeat(10) + ": late", body: "Why ".repeat(400) + `\n\n${APP}/jobs` };
    const { input } = alertRequest(long, APP);
    withinLimits("system.action_required.v1", input.variables);
    expect(input.tenant_id).toBeUndefined();
    expect(clip("abcdef", 4)).toBe("abc…");
  });
});
