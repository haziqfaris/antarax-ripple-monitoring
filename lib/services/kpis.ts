// Proposing KPIs and baselines (V-16, V-17, V-20). Both go to a second person; nothing counts until approved.
import { inScope, type Tx } from "../db";
import { audit } from "../audit";
import { checkFormula, standardKpis, type Formula } from "../../domain/kpi";
import { need, Refused, type StaffActor } from "./actor";
import { inAppScope } from "./scope";
import { setStep } from "./applications";
import { nf } from "../../domain/format";

export interface CustomKpi { name: string; formula: Formula; unit: string; better: "up" | "down" }

async function openApproval(tx: Tx, org: string, appId: string, subject: "kpi_set" | "baseline", subjectId: string | null, title: string, summary: string, actor: StaffActor) {
  const [waiting] = await tx<{ id: string }[]>`select id from approvals where application_id = ${appId} and subject = ${subject} and status = 'waiting'`;
  if (waiting) await tx`update approvals set subject_id = ${subjectId}, title = ${title}, summary = ${summary}, proposed_by = ${actor.id}, proposed_at = now() where id = ${waiting.id}`;
  else await tx`insert into approvals (organisation_id, application_id, subject, subject_id, title, summary, proposed_by) values (${org}, ${appId}, ${subject}, ${subjectId}, ${title}, ${summary}, ${actor.id})`;
}

async function markWaiting(tx: Tx, appId: string) {
  const [r] = await tx<{ k: number; b: number }[]>`select (select count(*)::int from kpis where application_id = ${appId} and status in ('waiting', 'approved')) as k,
    (select count(*)::int from baselines where application_id = ${appId} and status in ('waiting', 'approved')) as b`;
  if (r && r.k && r.b) await tx`update applications set stage = 'waiting', setup_step = 6 where id = ${appId} and stage = 'set_up'`;
}

export async function proposeKpiSet(actor: StaffActor, appId: string, custom: CustomKpi[] = []) {
  need(actor, "operator");
  return inAppScope(appId, async (tx, org) => {
    const [app] = await tx<{ name: string; unit_plural: string; volume_metric: string | null; corrections_metric: string | null; machine_metric: string | null }[]>`
      select name, unit_plural, volume_metric, corrections_metric, machine_metric from applications where id = ${appId}`;
    if (!app?.volume_metric) throw new Refused("Choose which figure counts the work handled first.");
    const catalog = new Map((await tx<{ key: string; type: string }[]>`select key, type from metrics where application_id = ${appId} and state = 'active'`).map((r) => [r.key, { type: r.type }]));
    const set = [...standardKpis({ volume: app.volume_metric, corrections: app.corrections_metric, machine: app.machine_metric, unitPlural: app.unit_plural }),
      ...custom.map((c, i) => ({ code: `custom_${i + 1}`, name: c.name.trim(), formula: c.formula, unit: c.unit, better: c.better }))];
    if (custom.length > 2) throw new Refused("At most two of the application's own KPIs in version 1.");
    for (const k of set) {
      if (!k.name) throw new Refused("Every KPI needs a name.");
      const p = checkFormula(k.formula, catalog);
      if (p.length) throw new Refused(`${k.name}: ${p[0]}`);
    }
    await tx`update kpis set status = 'retired' where application_id = ${appId} and status in ('draft', 'waiting')`;
    for (const k of set) {
      const [v] = await tx<{ v: number }[]>`select coalesce(max(version), 0) + 1 as v from kpis where application_id = ${appId} and code = ${k.code}`;
      await tx`insert into kpis (organisation_id, application_id, code, name, formula, unit, better, version, status, created_by)
        values (${org}, ${appId}, ${k.code}, ${k.name}, ${tx.json(k.formula as never)}, ${k.unit}, ${k.better}, ${v!.v}, 'waiting', ${actor.id})`;
    }
    await openApproval(tx, org, appId, "kpi_set", null, `KPIs for ${app.name}`, set.map((k) => k.name).join(" · "), actor);
    await setStep(tx, appId, 6);
    await markWaiting(tx, appId);
    await audit(tx, { actor, org, action: "Proposed KPIs", subject: app.name, after: set.map((k) => ({ name: k.name, formula: k.formula })) });
  }, actor.id);
}

export interface BaselineInput {
  minutesLow: number; minutesMid: number; minutesHigh: number; reviewLow: number; reviewMid: number; reviewHigh: number;
  method: "timed_sample" | "historical_records" | "client_estimate"; sampleSize: number | null; evidence: string;
  measuredFrom: string | null; measuredTo: string | null; appliesFrom: string;
}

export const METHOD_WORDS: Record<BaselineInput["method"], string> = { timed_sample: "Timed sample", historical_records: "Past records", client_estimate: "The organisation's estimate" };

export function checkBaseline(b: BaselineInput): string[] {
  const p: string[] = [];
  if (!(b.minutesLow > 0 && b.minutesLow <= b.minutesMid && b.minutesMid <= b.minutesHigh)) p.push("By hand: fastest, usual, slowest, in that order, above zero.");
  if (!(b.reviewLow >= 0 && b.reviewLow <= b.reviewMid && b.reviewMid <= b.reviewHigh)) p.push("Review: fastest, usual, slowest, in that order.");
  if (b.reviewMid >= b.minutesMid) p.push("Review takes as long as doing it by hand, so nothing would be saved. Check the minutes.");
  if (b.method === "timed_sample" && !(b.sampleSize && b.sampleSize >= 5)) p.push("A timed sample needs at least five timed items.");
  if (b.evidence.trim().length < 10) p.push("Say where the figures come from, in a sentence.");
  if (b.measuredFrom && b.measuredTo && b.measuredFrom > b.measuredTo) p.push("The sample's first day is after its last.");
  if (b.minutesHigh > 24 * 60) p.push("More than a day by hand for one item: check the unit.");
  return p;
}

export async function proposeBaseline(actor: StaffActor, appId: string, b: BaselineInput) {
  need(actor, "operator");
  const p = checkBaseline(b);
  if (p.length) throw new Refused(p.join(" "));
  return inAppScope(appId, async (tx, org) => {
    const [app] = await tx<{ name: string; unit_singular: string }[]>`select name, unit_singular from applications where id = ${appId}`;
    await tx`update baselines set status = 'retired' where application_id = ${appId} and status in ('draft', 'waiting')`;
    const [v] = await tx<{ v: number }[]>`select coalesce(max(version), 0) + 1 as v from baselines where application_id = ${appId}`;
    const [row] = await tx<{ id: string }[]>`insert into baselines (organisation_id, application_id, version, status, minutes_low, minutes_mid, minutes_high, review_low, review_mid, review_high,
        method, sample_size, evidence, measured_from, measured_to, applies_from, created_by)
      values (${org}, ${appId}, ${v!.v}, 'waiting', ${b.minutesLow}, ${b.minutesMid}, ${b.minutesHigh}, ${b.reviewLow}, ${b.reviewMid}, ${b.reviewHigh},
        ${b.method}, ${b.sampleSize}, ${b.evidence.trim()}, ${b.measuredFrom}, ${b.measuredTo}, ${b.appliesFrom}, ${actor.id}) returning id`;
    const summary = `${nf(b.minutesMid, 1)} min by hand per ${app!.unit_singular} (${nf(b.minutesLow, 1)} to ${nf(b.minutesHigh, 1)}), ${nf(b.reviewMid, 1)} min review · ${METHOD_WORDS[b.method]}`;
    await openApproval(tx, org, appId, "baseline", row!.id, `Baseline for ${app!.name}, version ${v!.v}`, summary, actor);
    await setStep(tx, appId, 6);
    await markWaiting(tx, appId);
    await audit(tx, { actor, org, action: "Proposed a baseline", subject: app!.name, after: b });
  }, actor.id);
}

export async function kpiHistory(appId: string) {
  return inAppScope(appId, (tx) => tx<{ code: string; name: string; version: number; status: string; approved_at: Date | null }[]>`select code, name, version, status, approved_at from kpis where application_id = ${appId} order by code, version desc`);
}
export { inScope };
