// The version 1 loop end to end, against the kit's example application served in-process:
// connect, collect, choose figures, propose, approve, see the figures, report. Also the failure paths.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { exampleAdapter, measureLink, EXAMPLE_METRICS, type MeasureAdapter } from "@/vendor/lapisan/measure/index";
import { sha256Hex } from "@/vendor/lapisan/crypto";
import { addStaff } from "@/lib/services/staff";
import { createOrganisation } from "@/lib/services/organisations";
import { createApplication, getApplication, setMapping } from "@/lib/services/applications";
import { collectApp, decideHeldMetric, finishKeyRotation, healthApp, startKeyRotation, testConnection } from "@/lib/services/collect";
import { proposeBaseline, proposeKpiSet } from "@/lib/services/kpis";
import { decide, listApprovals } from "@/lib/services/approvals";
import { appResults } from "@/lib/services/results";
import { draftReport, editReport, getReport, submitReport } from "@/lib/services/reports";
import { needsAPerson } from "@/lib/services/needs";
import { uploadSheet, sheetKeys } from "@/lib/services/sheet";
import { inScope } from "@/lib/db";
import type { StaffActor } from "@/lib/services/actor";

const NOW = Date.parse("2026-10-17T08:00:00Z");
const BASE = "http://localhost/internal/measure/v1";
let db: Awaited<ReturnType<typeof freshDb>>;
let op: StaffActor, ap: StaffActor, viewer: StaffActor;
let org: string, app: string, key: string;
let adapter: MeasureAdapter = exampleAdapter({ missing: ["2026-09-10"] });
let keys: { key: string; next?: string } = { key: "" };
const link = () => measureLink({ describe: () => adapter.describe(), observations: (q) => adapter.observations(q), health: (n) => adapter.health(n) }, { key: () => keys.key, nextKey: () => keys.next, now: () => NOW, onRefused: () => {}, onUnknownError: () => {} });
const fetcher = (r: Request) => link()(r);
const d = { fetch: fetcher, now: NOW };

beforeAll(async () => {
  db = await freshDb();
  op = { id: await addStaff("nurul@reka.example", "Nurul Aina", "operator", "operator password 1"), label: "Nurul Aina", role: "operator", email: "nurul@reka.example" };
  ap = { id: await addStaff("aisyah@reka.example", "Aisyah Rahman", "approver", "approver password 1"), label: "Aisyah Rahman", role: "approver", email: "aisyah@reka.example" };
  viewer = { id: await addStaff("v@reka.example", "Vi Ewer", "viewer", "viewer password 11"), label: "Vi Ewer", role: "viewer", email: "v@reka.example" };
});
afterAll(async () => db.drop());

describe("setting up", () => {
  it("refuses an organisation without its data agreement, and a viewer", async () => {
    await expect(createOrganisation(op, { name: "Contoh Logistik", short: "Contoh", industry: "Logistics", timeZone: "Asia/Kuala_Lumpur", agreement: false })).rejects.toThrow(/data agreement/);
    await expect(createOrganisation(viewer, { name: "X", short: "X", industry: "", timeZone: "Asia/Kuala_Lumpur", agreement: true })).rejects.toThrow(/operator/);
    org = await createOrganisation(op, { name: "Contoh Logistik Sdn Bhd", short: "Contoh Logistik", industry: "Logistics", timeZone: "Asia/Kuala_Lumpur", agreement: true });
  });
  it("creates an application with a key shown once", async () => {
    const r = await createApplication(op, { orgId: org, name: "Document workflow", project: "Accounts payable automation", unit: "document", source: "link" });
    app = r.appId; key = r.key; keys = { key };
    expect(key).toMatch(/^ax_msr_/);
    const { integration } = await getApplication(app);
    expect(integration.key_hint).toBe(`ax_msr_…${key.slice(-4)}`);
    expect(JSON.stringify(integration)).not.toContain(key);
  });
  it("refuses an address that isn't https or doesn't end at the link", async () => {
    await expect(testConnection(op, app, "http://example.com/internal/measure/v1", d)).rejects.toThrow(/https/);
    await expect(testConnection(op, app, "https://example.com/api", d)).rejects.toThrow(/ends with/);
  });
  it("passes the connection test and fills in history (V-11, V-12)", async () => {
    const r = await testConnection(op, app, BASE, d);
    expect(r.report.ok).toBe(true);
    expect(r.collected?.status).toBe("ok");
    expect(r.collected!.stored).toBeGreaterThan(500);
    const { integration, metrics } = await getApplication(app);
    expect(integration.state).toBe("on_time");
    expect(metrics.map((m) => m.key).sort()).toEqual(EXAMPLE_METRICS.map((m) => m.key).sort());
  });
  it("chooses figures, proposes KPIs and a baseline", async () => {
    await expect(setMapping(op, app, { volume: "documents.generation_duration", corrections: null, machine: null })).rejects.toThrow(/count/);
    await setMapping(op, app, { volume: "documents.generated", corrections: "documents.returned_for_correction", machine: "documents.generation_duration" });
    await proposeKpiSet(op, app);
    await expect(proposeBaseline(op, app, { minutesLow: 14, minutesMid: 18, minutesHigh: 22, reviewLow: 3, reviewMid: 20, reviewHigh: 30, method: "timed_sample", sampleSize: 40, evidence: "Timed by the AP team", measuredFrom: "2026-05-04", measuredTo: "2026-05-08", appliesFrom: "2026-06-01" })).rejects.toThrow(/Review/);
    await proposeBaseline(op, app, { minutesLow: 14, minutesMid: 18, minutesHigh: 22, reviewLow: 3, reviewMid: 4, reviewHigh: 6, method: "timed_sample", sampleSize: 40, evidence: "40 documents timed by the AP team before go-live", measuredFrom: "2026-05-04", measuredTo: "2026-05-08", appliesFrom: "2026-06-01" });
    expect((await getApplication(app)).app.stage).toBe("waiting");
  });
});

describe("approving (V-09, V-20)", () => {
  it("won't let the proposer or an operator decide", async () => {
    const waiting = (await listApprovals(org)).filter((p) => p.status === "waiting");
    expect(waiting.map((w) => w.subject).sort()).toEqual(["baseline", "kpi_set"]);
    await expect(decide(op, waiting[0]!.id, "approved", "looks right")).rejects.toThrow(/approver/);
    const ownAp = { ...ap, id: waiting[0]!.proposed_by };
    await expect(decide(ownAp, waiting[0]!.id, "approved", "looks right")).rejects.toThrow(/someone else/);
    await expect(decide(ap, waiting[0]!.id, "approved", "")).rejects.toThrow(/reason/);
  });
  it("starts counting once both are approved", async () => {
    for (const p of (await listApprovals(org)).filter((x) => x.status === "waiting")) await decide(ap, p.id, "approved", "Checked against the timed sample");
    expect((await getApplication(app)).app.stage).toBe("collecting");
  });
});

describe("the figures (V-16, V-17, A3, A7)", () => {
  it("computes September with the gap left out, hours as an estimate with a range", async () => {
    const r = await inScope({ org }, (tx) => appResults(tx, app, "2026-09-01", "2026-09-30"));
    const by = Object.fromEntries(r.kpis.map((k) => [k.kpi.code, k]));
    expect(by.volume!.result).toMatchObject({ expected: 30, withData: 29, missing: 1, quality: "measured" });
    expect(by.quality!.result.quality).toBe("derived");
    expect(by.hours!.result.quality).toBe("estimated");
    expect(by.hours!.result.low!).toBeLessThan(by.hours!.result.value!);
    expect(by.hours!.result.high!).toBeGreaterThan(by.hours!.result.value!);
    expect(r.trend.find((p) => p.day === "2026-09-10")!.value).toBeNull();
  });
});

describe("when the application changes or stops (V-13, V-14, V-27)", () => {
  it("holds a new figure instead of counting it", async () => {
    const base = exampleAdapter();
    adapter = { ...base, describe: async () => { const x = await base.describe(); return { ...x, metric_catalog_version: "2026-10-16", metrics: [...x.metrics, { key: "pages.read", type: "counter", unit: "page", description: "Pages read.", privacy: "aggregate" }] }; } };
    const r = await collectApp(app, d);
    expect(r.held).toEqual(["pages.read"]);
    const n = await needsAPerson(org, NOW);
    expect(n.some((x) => /new or changed figure/.test(x.title))).toBe(true);
    const stored = await inScope({ org }, (tx) => tx`select 1 from observations where metric_key = 'pages.read'`);
    expect(stored).toHaveLength(0);
    await decideHeldMetric(op, app, "pages.read", false, "Not needed for the KPIs");
  });
  it("marks a link that refuses its key as not answering and queues an e-mail", async () => {
    keys = { key: "ax_msr_" + "A".repeat(32) };
    const r = await collectApp(app, d);
    expect(r.status).toBe("failed");
    const { integration } = await getApplication(app);
    expect(integration.state).toBe("not_answering");
    expect(integration.state_why).toMatch(/401/);
    const mail = await inScope("all", (tx) => tx<{ subject: string; to_addr: string }[]>`select subject, to_addr from outbox`);
    expect(mail.some((m) => /not answering/.test(m.subject) && m.to_addr === "ops@reka.example")).toBe(true);
    keys = { key };
    expect((await healthApp(app, d)).state).toBe("on_time");
  });
  it("rotates the key without a gap", async () => {
    const next = await startKeyRotation(op, app);
    keys = { key, next };
    await finishKeyRotation(op, app, d);
    keys = { key: next };
    const r = await collectApp(app, d);
    expect(r.status).toBe("ok");
    expect((await getApplication(app)).integration.key_hint).toBe(`ax_msr_…${next.slice(-4)}`);
  });
});

describe("the monthly report (V-26, A6)", () => {
  let id: string;
  it("drafts only finished months, from approved KPIs", async () => {
    await expect(draftReport(op, app, "2026-10-01", "2026-10-17")).rejects.toThrow(/isn't over/);
    id = await draftReport(op, app, "2026-09-01", "2026-10-17");
    const r = await getReport(id);
    expect(r.figures.kpis.map((k) => k.code)).toEqual(["volume", "quality", "hours"]);
    expect(r.figures.kpis[0]!.missing).toBe(1);
  });
  it("needs a summary, and someone other than its writer to approve it", async () => {
    await expect(submitReport(op, id)).rejects.toThrow(/summary/);
    await editReport(ap, id, { summary: "Contoh Logistik's team handled more documents with fewer sent back for correction.", changes: "Credit notes improved.", caveats: "10 Sep is missing and not counted.", next_steps: "Time review again in November." });
    await submitReport(ap, id);
    const p = (await listApprovals(org)).find((x) => x.subject === "report" && x.status === "waiting")!;
    await expect(decide(ap, p.id, "approved", "fine")).rejects.toThrow(/someone else/);
  });
  it("freezes the approved page with its hash", async () => {
    const approver2: StaffActor = { id: await addStaff("lim@reka.example", "Daniel Lim", "approver", "approver password 2"), label: "Daniel Lim", role: "approver", email: "lim@reka.example" };
    const p = (await listApprovals(org)).find((x) => x.subject === "report" && x.status === "waiting")!;
    const { hash } = await decide(approver2, p.id, "approved", "Figures match the console");
    const r = await getReport(id);
    expect(r.status).toBe("approved");
    expect(r.html_sha256).toBe(hash);
    expect(await sha256Hex(r.html!)).toBe(hash);
    expect(r.html).toContain("Run by REKA as part of Managed AI.");
    expect(r.html).toContain("1 of 30 days missing, not counted");
    await expect(editReport(op, id, { summary: "x".repeat(30), changes: "", caveats: "", next_steps: "" })).rejects.toThrow(/frozen/);
  });
});

describe("the spreadsheet route (V-15)", () => {
  it("takes finished days only, with the same checks", async () => {
    const s = await createApplication(op, { orgId: org, name: "Claim reader", project: "Claims", unit: "claim", source: "sheet" });
    const k = sheetKeys("claims");
    const bad = await uploadSheet(op, s.appId, `date,${k.volume}\n2026-10-17,5\n`, NOW);
    expect(bad.problems[0]).toMatch(/isn't finished/);
    const ok = await uploadSheet(op, s.appId, `date,${k.volume},${k.corrections}\n2026-10-15,120,4\n2026-10-16,140,\n`, NOW);
    expect(ok).toEqual({ stored: 3, problems: [] });
    const { integration, app: a } = await getApplication(s.appId);
    expect(integration.state).toBe("on_time");
    expect(a.volume_metric).toBe(k.volume);
  });
});
