// Collection (V-10 to V-14), built on the vendored kit: every call signed, every answer checked against the
// contract before anything is stored. Each integration runs on its own, so one failure never stops the rest.
import {
  checkHealth, checkManifest, checkMeasureLink, checkObservation, catalogMap, dimensionKey, signMeasureCall, isMeasureKey,
  MAX_OBSERVATION_DAYS, MEASURE_BASE, type Manifest, type MetricDefinition, type MeasureHealth, type Observation, type CheckReport,
} from "../../vendor/lapisan/measure/index";
import { inScope, type Tx } from "../db";
import { unseal, seal } from "../seal";
import { audit, SYSTEM, type Actor } from "../audit";
import { linkState, STATE_WORD, type LinkState } from "../../domain/link-state";
import { addDays, localDay } from "../../domain/format";
import { setStep } from "./applications";
import { queueAlert } from "./mail";
import { Refused, need, type StaffActor } from "./actor";
import { inAppScope } from "./scope";

export type Fetcher = (request: Request) => Promise<Response>;
export interface Deps { fetch?: Fetcher; now?: number }

const TIMEOUT_MS = 20_000;
const REREAD_DAYS = 7;
const FIRST_HISTORY_DAYS = 92;

/** A base address is https (http only for this machine, outside production), and ends at /internal/measure/v1. */
export function checkBaseUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Refused("That isn't a web address."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  // Plain http only for this machine, and in a production build only when the end-to-end test asks (ALLOW_LOCAL_HTTP_LINKS=1).
  const localHttp = u.protocol === "http:" && local && (process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_HTTP_LINKS === "1");
  if (u.protocol !== "https:" && !localHttp) throw new Refused("The address must start with https://.");
  if (u.username || u.password || u.search || u.hash) throw new Refused("The address can't carry a user name, a query or a fragment.");
  const path = u.pathname.replace(/\/+$/, "");
  if (!path.endsWith(MEASURE_BASE)) throw new Refused(`The address ends with ${MEASURE_BASE}.`);
  return `${u.origin}${path}`;
}

class CallFailed extends Error { constructor(message: string, public status?: number) { super(message); } }

async function call<T>(base: string, key: string, path: string, query: Record<string, string>, d: Deps): Promise<T> {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers = await signMeasureCall(key, "GET", url, Math.floor((d.now ?? Date.now()) / 1000));
  const req = new Request(url, { headers: { ...headers, accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    try { res = await (d.fetch ?? fetch)(req.clone()); } catch (e) { throw new CallFailed(`No answer from ${url.host}: ${e instanceof Error ? e.message : "network error"}`); }
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      const wait = Math.min(Number(res.headers.get("retry-after") ?? 5), 30);
      await new Promise((r) => setTimeout(r, (d.fetch ? 0 : wait) * 1000));
      continue;
    }
    break;
  }
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new CallFailed(`${path} answered ${res.status} without JSON`, res.status); }
  if (!res.ok) {
    const code = (body as { error?: { code?: string } })?.error?.code ?? `status ${res.status}`;
    throw new CallFailed(`${path} answered ${res.status} ${code}`, res.status);
  }
  return body as T;
}

interface Ctx { tx: Tx; org: string; appId: string; base: string; key: string; d: Deps }

async function loadCtx(tx: Tx, appId: string, d: Deps): Promise<Omit<Ctx, "org"> & { org: string; integrationId: string; stage: string; appName: string; catalog: string | null; hasMetrics: boolean }> {
  const [r] = await tx<{ id: string; organisation_id: string; base_url: string | null; key_sealed: string; stage: string; name: string; catalog_version: string | null }[]>`
    select i.id, i.organisation_id, i.base_url, i.key_sealed, a.stage, a.name, i.catalog_version from integrations i join applications a on a.id = i.application_id where i.application_id = ${appId}`;
  if (!r) throw new Refused("No such application", "not_found");
  if (!r.base_url) throw new Refused("No address yet. Paste the application's base address first.");
  const n = (await tx<{ n: number }[]>`select count(*)::int as n from metrics where application_id = ${appId}`)[0]?.n ?? 0;
  return { tx, org: r.organisation_id, appId, base: r.base_url, key: await unseal(r.key_sealed), d, integrationId: r.id, stage: r.stage, appName: r.name, catalog: r.catalog_version, hasMetrics: n > 0 };
}

/**
 * Store the catalog. On first connection every metric is active. Afterwards a new or changed metric is held for an
 * operator (V-14) and never silently counted; a dropped one is marked dropped, its history kept.
 */
async function storeCatalog(c: Ctx & { hasMetrics: boolean }, m: Manifest): Promise<{ held: string[] }> {
  const existing = new Map((await c.tx<{ key: string; type: string; unit: string; numerator: string | null; denominator: string | null; state: string }[]>`
    select key, type, unit, numerator, denominator, state from metrics where application_id = ${c.appId}`).map((r) => [r.key, r]));
  const held: string[] = [];
  for (const x of m.metrics) {
    const was = existing.get(x.key);
    const changed = was && (was.type !== x.type || was.unit !== x.unit || (was.numerator ?? null) !== (x.numerator ?? null) || (was.denominator ?? null) !== (x.denominator ?? null));
    const state = !c.hasMetrics ? "active" : !was ? "held" : changed ? "held" : was.state === "dropped" ? "held" : was.state;
    const why = state === "held" ? (!was ? "New in the catalog" : changed ? "Changed in the catalog" : "Back in the catalog") : null;
    if (state === "held" && was?.state !== "held") held.push(x.key);
    await c.tx`insert into metrics (organisation_id, application_id, key, type, unit, label, description, aggregation, numerator, denominator, dimensions, since, catalog_version, state, held_why)
      values (${c.org}, ${c.appId}, ${x.key}, ${x.type}, ${x.unit}, ${x.label ?? null}, ${x.description}, ${x.aggregation ?? null}, ${x.numerator ?? null}, ${x.denominator ?? null},
        ${x.dimensions ?? []}, ${x.since ?? null}, ${m.metric_catalog_version}, ${state}, ${why})
      on conflict (application_id, key) do update set label = excluded.label, description = excluded.description, aggregation = excluded.aggregation,
        dimensions = excluded.dimensions, since = excluded.since, catalog_version = excluded.catalog_version,
        type = excluded.type, unit = excluded.unit, numerator = excluded.numerator, denominator = excluded.denominator,
        state = ${state}, held_why = ${why}`;
  }
  const keys = new Set(m.metrics.map((x) => x.key));
  for (const [k, r] of existing) if (!keys.has(k) && r.state !== "dropped") await c.tx`update metrics set state = 'dropped', held_why = 'No longer in the catalog' where application_id = ${c.appId} and key = ${k}`;
  await c.tx`update integrations set solution_id = ${m.solution_id}, time_zone = ${m.time_zone}, catalog_version = ${m.metric_catalog_version} where application_id = ${c.appId}`;
  return { held };
}

/** Read observations for [from, to] in windows of at most 92 days, every page; keep those that pass the contract. */
async function readObservations(c: Ctx, m: Manifest, from: string, to: string): Promise<{ stored: number; rejected: number; days: Set<string>; problems: string[] }> {
  const active = new Set((await c.tx<{ key: string }[]>`select key from metrics where application_id = ${c.appId} and state = 'active'`).map((r) => r.key));
  const ctx = { metrics: catalogMap(m.metrics), timeZone: m.time_zone };
  let stored = 0, rejected = 0;
  const days = new Set<string>(), problems: string[] = [];
  for (let start = from; start <= to; start = addDays(start, MAX_OBSERVATION_DAYS)) {
    const end = [addDays(start, MAX_OBSERVATION_DAYS - 1), to].sort()[0]!;
    let cursor: string | null = null;
    for (let page = 0; page < 500; page++) {
      const q: Record<string, string> = { from: start, to: end, limit: "100" };
      if (cursor) q.cursor = cursor;
      const list = await call<{ data: unknown[]; next: string | null }>(c.base, c.key, "/observations", q, c.d);
      for (const raw of list.data ?? []) {
        const p = checkObservation(raw, ctx);
        if (p.length) { rejected++; if (problems.length < 5) problems.push(`${p[0]!.at}: ${p[0]!.message}`); continue; }
        const o = raw as Observation;
        if (!active.has(o.metric_key)) continue;
        const money = typeof o.value === "string" ? o.value : null;
        await c.tx`insert into observations (organisation_id, application_id, metric_key, local_period, dim_key, dimensions, value, money, count, sum, quality, source)
          values (${c.org}, ${c.appId}, ${o.metric_key}, ${o.local_period}, ${dimensionKey(o.dimensions)}, ${c.tx.json(o.dimensions)}, ${money === null ? (o.value as number) : null}, ${money},
            ${o.count ?? null}, ${o.sum ?? null}, ${o.quality}, ${o.source})
          on conflict (application_id, metric_key, local_period, dim_key) do update set value = excluded.value, money = excluded.money, count = excluded.count,
            sum = excluded.sum, quality = excluded.quality, source = excluded.source, dimensions = excluded.dimensions, collected_at = now()`;
        stored++;
        days.add(o.local_period);
      }
      cursor = list.next;
      if (!cursor) break;
    }
  }
  return { stored, rejected, days, problems };
}

async function setState(c: Ctx, appName: string, next: { state: LinkState; why: string }, extra: { success?: boolean; health?: boolean; attempt?: boolean } = {}): Promise<void> {
  const [cur] = await c.tx<{ state: LinkState }[]>`select state from integrations where application_id = ${c.appId}`;
  const now = new Date(c.d.now ?? Date.now());
  await c.tx`update integrations set state = ${next.state}, state_why = ${next.why},
    state_since = case when state = ${next.state} then state_since else ${now} end,
    last_success_at = case when ${!!extra.success} then ${now} else last_success_at end,
    last_health_at = case when ${!!extra.health} then ${now} else last_health_at end,
    last_attempt_at = case when ${!!extra.attempt} then ${now} else last_attempt_at end
    where application_id = ${c.appId}`;
  if (cur && cur.state !== next.state && (next.state === "late" || next.state === "not_answering")) {
    await queueAlert(c.tx, c.org, `${appName}: ${STATE_WORD[next.state].toLowerCase()}`, `${appName} is ${STATE_WORD[next.state].toLowerCase()}. ${next.why}.\n\nIts figures stay as they were; missing days show as gaps, never as zeros.`);
  }
}

async function lastDay(tx: Tx, appId: string, volume?: string | null): Promise<string | null> {
  const [r] = await tx<{ d: string | null }[]>`select max(local_period)::text as d from observations where application_id = ${appId} and dim_key = '' and (${volume ?? null}::text is null or metric_key = ${volume ?? null})`;
  return r?.d ?? null;
}

async function startRun(tx: Tx, org: string, appId: string, kind: string): Promise<string> {
  const [r] = await tx<{ id: string }[]>`insert into collection_runs (organisation_id, application_id, kind) values (${org}, ${appId}, ${kind}) returning id`;
  return r!.id;
}
async function endRun(tx: Tx, id: string, r: { status: "ok" | "failed" | "partial"; days?: number; read?: number; rejected?: number; error?: string | null; detail?: unknown }): Promise<void> {
  await tx`update collection_runs set finished_at = now(), status = ${r.status}, days_read = ${r.days ?? 0}, observations_read = ${r.read ?? 0}, rejected = ${r.rejected ?? 0},
    error = ${r.error ?? null}, detail = ${tx.json((r.detail ?? {}) as never)} where id = ${id}`;
}

/** V-12: the nightly collection for one application. Re-reads the last seven days; on first connection fills in history. */
export async function collectApp(appId: string, d: Deps = {}, kind: "nightly" | "backfill" = "nightly", range?: { from: string; to: string }): Promise<{ status: string; stored: number; rejected: number; held: string[]; error?: string }> {
  return inAppScope(appId, async (tx) => {
    const c = await loadCtx(tx, appId, d);
    const run = await startRun(tx, c.org, appId, kind);
    try {
      const m = await call<Manifest>(c.base, c.key, "/manifest", {}, d);
      const mp = checkManifest(m);
      if (mp.length) throw new CallFailed(`The manifest breaks the contract: ${mp[0]!.at}: ${mp[0]!.message}`);
      const { held } = await storeCatalog(c, m);
      const yesterday = addDays(localDay(d.now ?? Date.now(), m.time_zone), -1);
      const last = await lastDay(tx, appId);
      const from = range?.from ?? (last ? addDays(last, -(REREAD_DAYS - 1)) : addDays(yesterday, -(FIRST_HISTORY_DAYS - 1)));
      const to = range?.to ?? yesterday;
      const r = from <= to ? await readObservations(c, m, from, to) : { stored: 0, rejected: 0, days: new Set<string>(), problems: [] as string[] };
      const [app] = await tx<{ volume_metric: string | null }[]>`select volume_metric from applications where id = ${appId}`;
      const health = await call<MeasureHealth>(c.base, c.key, "/health", {}, d).catch(() => null);
      const hp = health ? checkHealth(health, new Set(m.metrics.map((x) => x.key))) : [];
      const st = linkState({ connected: true, health: health && !hp.length ? health.status : health ? "degraded" : null, lastDay: await lastDay(tx, appId, app?.volume_metric), yesterday, problems: health?.problems });
      await setState(c, c.appName, st, { success: true, attempt: true, health: !!health });
      const status = r.rejected ? "partial" : "ok";
      await endRun(tx, run, { status, days: r.days.size, read: r.stored, rejected: r.rejected, detail: { from, to, held, problems: r.problems } });
      if (held.length) await audit(tx, { actor: SYSTEM, org: c.org, action: "Held new or changed figures for an operator", subject: c.appName, after: { held } });
      return { status, stored: r.stored, rejected: r.rejected, held };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const st = e instanceof CallFailed && e.status === 401
        ? { state: "not_answering" as const, why: "It refused the key (401). Check AX_MEASURE_KEY on the application" }
        : { state: "not_answering" as const, why: msg };
      await setState(c, c.appName, st, { attempt: true });
      await endRun(tx, run, { status: "failed", error: msg });
      return { status: "failed", stored: 0, rejected: 0, held: [], error: msg };
    }
  });
}

/** V-13: the hourly health check. Never changes figures; only the state and why. */
export async function healthApp(appId: string, d: Deps = {}): Promise<{ state: LinkState; why: string }> {
  return inAppScope(appId, async (tx) => {
    const c = await loadCtx(tx, appId, d);
    const [i] = await tx<{ time_zone: string | null }[]>`select time_zone from integrations where application_id = ${appId}`;
    const [app] = await tx<{ volume_metric: string | null }[]>`select volume_metric from applications where id = ${appId}`;
    const tz = i?.time_zone ?? "Asia/Kuala_Lumpur";
    const yesterday = addDays(localDay(d.now ?? Date.now(), tz), -1);
    const health = await call<MeasureHealth>(c.base, c.key, "/health", {}, d).catch(() => null);
    const hp = health ? checkHealth(health) : [];
    const st = linkState({ connected: c.hasMetrics, health: health && !hp.length ? health.status : health ? "degraded" : null, lastDay: await lastDay(tx, appId, app?.volume_metric), yesterday, problems: health?.problems });
    await setState(c, c.appName, st, { health: true });
    return st;
  });
}

/** V-11: the connection test, the kit's own checks, then a first collection with history. */
export async function testConnection(actor: StaffActor | null, appId: string, baseUrl: string, d: Deps = {}): Promise<{ report: CheckReport; collected?: Awaited<ReturnType<typeof collectApp>> }> {
  if (actor) need(actor, "operator");
  const base = checkBaseUrl(baseUrl);
  const key = await inAppScope(appId, async (tx, org) => {
    const [r] = await tx<{ key_sealed: string; base_url: string | null }[]>`select key_sealed, base_url from integrations where application_id = ${appId}`;
    if (r!.base_url !== base) {
      await tx`update integrations set base_url = ${base} where application_id = ${appId}`;
      await audit(tx, { actor: actor ?? { id: null, label: "Developer link" }, org, action: "Set the application's address", subject: appId, before: r!.base_url, after: base });
    }
    return unseal(r!.key_sealed);
  });
  const report = await checkMeasureLink({ base, key, fetch: d.fetch, now: d.now, days: 7 });
  await inAppScope(appId, async (tx, org) => {
    await tx`update integrations set last_test = ${tx.json({ ok: report.ok, at: report.checked_at, results: report.results.map((r) => ({ title: r.title, status: r.status, detail: r.detail.slice(0, 4) })) } as never)} where application_id = ${appId}`;
    const run = await startRun(tx, org, appId, "test");
    await endRun(tx, run, { status: report.ok ? "ok" : "failed", error: report.ok ? null : report.results.filter((r) => r.status === "fail").map((r) => r.title).join("; "), detail: { checks: report.results.length } });
  });
  if (!report.ok) return { report };
  const collected = await collectApp(appId, d);
  await inAppScope(appId, (tx) => setStep(tx, appId, 4));
  return { report, collected };
}

/** Apply or drop a held metric (V-14). */
export async function decideHeldMetric(actor: StaffActor, appId: string, key: string, accept: boolean, reason: string) {
  need(actor, "operator");
  if (reason.trim().length < 3) throw new Refused("Give a reason. It goes in the audit trail.");
  return inAppScope(appId, async (tx, org) => {
    const [m] = await tx<{ state: string }[]>`select state from metrics where application_id = ${appId} and key = ${key}`;
    if (!m || m.state !== "held") throw new Refused("That figure isn't waiting for a decision.");
    await tx`update metrics set state = ${accept ? "active" : "dropped"}, held_why = ${accept ? null : "Not used: " + reason} where application_id = ${appId} and key = ${key}`;
    await audit(tx, { actor, org, action: accept ? "Started counting a new figure" : "Left a figure out", subject: key, reason });
  }, actor.id);
}

/** Every application that should be collected, each on its own (V-12). */
export async function runAll(kind: "nightly" | "health", d: Deps = {}): Promise<{ app: string; ok: boolean; note: string }[]> {
  const apps = await inScope("all", (tx) => tx<{ id: string; name: string }[]>`
    select a.id, a.name from applications a join integrations i on i.application_id = a.id
    where a.stage <> 'paused' and a.source = 'link' and i.base_url is not null and (${kind} = 'nightly' or i.last_success_at is not null)`);
  const out: { app: string; ok: boolean; note: string }[] = [];
  for (const a of apps) {
    try {
      if (kind === "nightly") { const r = await collectApp(a.id, d); out.push({ app: a.name, ok: r.status !== "failed", note: r.error ?? `${r.stored} figures` }); }
      else { const r = await healthApp(a.id, d); out.push({ app: a.name, ok: r.state !== "not_answering", note: r.why }); }
    } catch (e) { out.push({ app: a.name, ok: false, note: e instanceof Error ? e.message : "failed" }); }
  }
  return out;
}

// ---------------------------------------------------------------- keys (V-10)
export async function startKeyRotation(actor: StaffActor, appId: string): Promise<string> {
  need(actor, "operator");
  const { newMeasureKey } = await import("../../vendor/lapisan/measure/index");
  const next = newMeasureKey();
  await inAppScope(appId, async (tx, org) => {
    await tx`update integrations set next_key_sealed = ${await seal(next)} where application_id = ${appId}`;
    await audit(tx, { actor, org, action: "Started a key rotation", subject: appId });
  }, actor.id);
  return next;
}

export async function finishKeyRotation(actor: StaffActor, appId: string, d: Deps = {}): Promise<void> {
  need(actor, "operator");
  await inAppScope(appId, async (tx, org) => {
    const [r] = await tx<{ next_key_sealed: string | null; base_url: string | null }[]>`select next_key_sealed, base_url from integrations where application_id = ${appId}`;
    if (!r?.next_key_sealed) throw new Refused("No rotation in progress.");
    const next = await unseal(r.next_key_sealed);
    if (!isMeasureKey(next)) throw new Refused("The next key is damaged. Start the rotation again.");
    if (r.base_url) await call(r.base_url, next, "/health", {}, d).catch(() => { throw new Refused("The application doesn't accept the new key yet. Ask the developer to set AX_MEASURE_KEY_NEXT."); });
    const { keyHint } = await import("./applications");
    await tx`update integrations set key_sealed = next_key_sealed, next_key_sealed = null, key_hint = ${keyHint(next)} where application_id = ${appId}`;
    await audit(tx, { actor, org, action: "Switched to the new key", subject: appId });
  }, actor.id);
}

export async function revokeKey(actor: StaffActor, appId: string, reason: string): Promise<void> {
  need(actor, "operator");
  if (reason.trim().length < 3) throw new Refused("Give a reason. It goes in the audit trail.");
  const { newMeasureKey } = await import("../../vendor/lapisan/measure/index");
  const fresh = newMeasureKey();
  await inAppScope(appId, async (tx, org) => {
    await tx`update integrations set key_sealed = ${await seal(fresh)}, next_key_sealed = null, key_hint = ${"revoked"}, base_url = null, state = 'not_connected', state_why = 'Key revoked', state_since = now() where application_id = ${appId}`;
    await audit(tx, { actor, org, action: "Revoked the measurement key", subject: appId, reason });
  }, actor.id);
}

export type { Actor };
