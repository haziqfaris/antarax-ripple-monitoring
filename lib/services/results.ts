// What an application delivered over a window: its KPIs computed by the engine from stored daily totals (V-16, V-17).
import type { Tx } from "../db";
import { compute, dayRange, series, type BaselineFigures, type Days, type Formula, type Result } from "../../domain/kpi";

export interface KpiRow { id: string; code: string; name: string; formula: Formula; unit: string; better: "up" | "down"; version: number; status: string; approved_at: Date | null }
export interface BaselineRow {
  id: string; version: number; status: string; minutes_low: number; minutes_mid: number; minutes_high: number;
  review_low: number; review_mid: number; review_high: number; method: string; sample_size: number | null; evidence: string;
  measured_from: string | null; measured_to: string | null; applies_from: string; approved_at: Date | null; approved_by: string | null; created_by: string | null;
}

export const toFigures = (b: BaselineRow): BaselineFigures => ({ low: b.minutes_low, mid: b.minutes_mid, high: b.minutes_high, reviewLow: b.review_low, reviewMid: b.review_mid, reviewHigh: b.review_high, appliesFrom: b.applies_from });

export async function loadDays(tx: Tx, appId: string, from: string, to: string): Promise<Days> {
  const rows = await tx<{ d: string; metric_key: string; value: number | null; count: number | null; sum: number | null }[]>`
    select local_period::text as d, metric_key, value, count, sum from observations
    where application_id = ${appId} and dim_key = '' and local_period between ${from} and ${to}`;
  const days: Days = new Map();
  for (const r of rows) {
    if (!days.has(r.d)) days.set(r.d, new Map());
    days.get(r.d)!.set(r.metric_key, { value: r.value, count: r.count, sum: r.sum });
  }
  return days;
}

/** The first day the volume figure was counted: days before it are not expected. */
export async function sinceOf(tx: Tx, appId: string, volume: string | null): Promise<string | null> {
  if (!volume) return null;
  const [r] = await tx<{ since: string | null }[]>`select coalesce(
      (select since::text from metrics where application_id = ${appId} and key = ${volume}),
      (select min(local_period)::text from observations where application_id = ${appId} and metric_key = ${volume} and dim_key = '')) as since`;
  return r?.since ?? null;
}

/** The KPIs to show: the latest approved version of each, else the newest proposal, marked as not approved. */
export async function currentKpis(tx: Tx, appId: string): Promise<(KpiRow & { approved: boolean })[]> {
  const rows = await tx<KpiRow[]>`select id, code, name, formula, unit, better, version, status, approved_at from kpis where application_id = ${appId} and status <> 'retired' order by code, version desc`;
  const byCode = new Map<string, KpiRow & { approved: boolean }>();
  for (const r of rows) {
    const cur = byCode.get(r.code);
    if (!cur || (!cur.approved && r.status === "approved")) byCode.set(r.code, { ...r, approved: r.status === "approved" });
  }
  const order = ["volume", "quality", "hours"];
  return [...byCode.values()].sort((a, b) => (order.indexOf(a.code) + 1 || 9) - (order.indexOf(b.code) + 1 || 9) || a.name.localeCompare(b.name));
}

export async function currentBaseline(tx: Tx, appId: string): Promise<(BaselineRow & { approved: boolean }) | null> {
  const rows = await tx<BaselineRow[]>`select * from baselines where application_id = ${appId} and status in ('approved', 'waiting', 'draft') order by (status = 'approved') desc, version desc limit 1`;
  return rows[0] ? { ...rows[0], approved: rows[0].status === "approved" } : null;
}

export interface AppResults {
  window: { from: string; to: string };
  since: string | null;
  kpis: { kpi: KpiRow & { approved: boolean }; result: Result }[];
  baseline: (BaselineRow & { approved: boolean }) | null;
  trend: { day: string; value: number | null; before: boolean }[];
}

export async function appResults(tx: Tx, appId: string, from: string, to: string): Promise<AppResults> {
  const [app] = await tx<{ volume_metric: string | null }[]>`select volume_metric from applications where id = ${appId}`;
  const since = await sinceOf(tx, appId, app?.volume_metric ?? null);
  const days = await loadDays(tx, appId, from, to);
  const window = dayRange(from, to);
  const baseline = await currentBaseline(tx, appId);
  const kpis = (await currentKpis(tx, appId)).map((kpi) => ({ kpi, result: compute(kpi.formula, window, days, { since, baseline: baseline ? toFigures(baseline) : null }) }));
  return { window: { from, to }, since, kpis, baseline, trend: app?.volume_metric ? series(app.volume_metric, window, days, since) : [] };
}
