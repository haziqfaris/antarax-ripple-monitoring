"use server";
import { cookies } from "next/headers";
import { requireActor, setOnce } from "@/lib/auth/session";
import { act, str as raw, numOrNull } from "@/lib/act";

/** Optional choices use "none" (an empty key isn't allowed in the drawn dropdowns). */
const str = (f: FormData, k: string) => { const v = raw(f, k); return v === "none" ? "" : v; };
import { Refused } from "@/lib/services/actor";
import { setMapping, pauseApplication, newDeveloperLink } from "@/lib/services/applications";
import { testConnection, collectApp, decideHeldMetric, startKeyRotation, finishKeyRotation, revokeKey } from "@/lib/services/collect";
import { proposeKpiSet, proposeBaseline, type CustomKpi } from "@/lib/services/kpis";
import { draftReport } from "@/lib/services/reports";
import { uploadSheet } from "@/lib/services/sheet";
import type { Formula } from "@/domain/kpi";

const back = (id: string, hash = "") => `/applications/${id}${hash}`;
const isId = (s: string) => /^[0-9a-f-]{36}$/.test(s);

export async function testAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#connect"), async () => {
    if (!isId(id)) throw new Refused("No such application", "not_found");
    const r = await testConnection(actor, id, str(form, "base"));
    return r.report.ok ? { ok: `Connected. ${r.collected?.stored ?? 0} figures collected${r.collected?.held.length ? `; ${r.collected.held.length} held for a decision` : ""}.` } : undefined;
  });
}

export async function collectNowAction(form: FormData) {
  await requireActor("operator");
  const id = str(form, "id");
  await act(back(id, "#run"), async () => {
    const r = await collectApp(id);
    if (r.status === "failed") throw new Refused(`Collection failed: ${r.error}`);
    return { ok: `Collected ${r.stored} figures${r.rejected ? `; ${r.rejected} refused by the contract checks` : ""}.` };
  });
}

export async function mappingAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#figures"), async () => {
    if (!str(form, "volume")) throw new Refused("Choose which figure counts the work handled.");
    await setMapping(actor, id, { volume: str(form, "volume"), corrections: str(form, "corrections") || null, machine: str(form, "machine") || null });
    return { ok: "Figures chosen. Next, the KPIs." };
  });
}

function customFrom(form: FormData, i: number): CustomKpi | null {
  const name = str(form, `c${i}_name`);
  if (!name) return null;
  const op = str(form, `c${i}_op`), a = str(form, `c${i}_a`), b = str(form, `c${i}_b`);
  const formula: Formula = op === "ratio" ? { op: "ratio", numerator: a, denominator: b } : op === "per" ? { op: "per", a, b } : op === "mean_duration" ? { op: "mean_duration", metric: a } : op === "daily_average" ? { op: "daily_average", metric: a } : { op: "sum", metric: a };
  if (!a || ((op === "ratio" || op === "per") && !b)) throw new Refused(`${name}: choose its figures.`);
  return { name, formula, unit: op === "ratio" ? "%" : str(form, `c${i}_unit`).slice(0, 12), better: str(form, `c${i}_better`) === "down" ? "down" : "up" };
}

export async function kpiAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#kpis"), async () => {
    const custom = [customFrom(form, 1), customFrom(form, 2)].filter((x): x is CustomKpi => !!x);
    await proposeKpiSet(actor, id, custom);
    return { ok: "KPIs sent for approval." };
  });
}

export async function baselineAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#baseline"), async () => {
    const n = (k: string) => { const v = numOrNull(form, k); if (v === null || Number.isNaN(v)) throw new Refused("Fill in every minutes field with a number."); return v; };
    const method = str(form, "method") as "timed_sample" | "historical_records" | "client_estimate";
    if (!["timed_sample", "historical_records", "client_estimate"].includes(method)) throw new Refused("Choose how the baseline was found.");
    const sample = numOrNull(form, "sample");
    if (!str(form, "applies")) throw new Refused("Choose the day the baseline applies from.");
    await proposeBaseline(actor, id, { minutesLow: n("low"), minutesMid: n("mid"), minutesHigh: n("high"), reviewLow: n("rlow"), reviewMid: n("rmid"), reviewHigh: n("rhigh"), method, sampleSize: sample === null || Number.isNaN(sample) ? null : Math.round(sample), evidence: str(form, "evidence"), measuredFrom: str(form, "from") || null, measuredTo: str(form, "to") || null, appliesFrom: str(form, "applies") });
    return { ok: "Baseline sent for approval." };
  });
}

export async function heldAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#figures"), async () => { await decideHeldMetric(actor, id, str(form, "key"), str(form, "decision") === "accept", str(form, "reason")); return { ok: "Decision recorded." }; });
}

export async function pauseAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#run"), async () => { await pauseApplication(actor, id, str(form, "reason"), str(form, "pause") === "1"); return { ok: str(form, "pause") === "1" ? "Paused." : "Resumed." }; });
}

export async function devLinkAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#connect"), async () => { const t = await newDeveloperLink(actor, id); await setOnce({ appId: id, devToken: t }); });
}

export async function rotateAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#run"), async () => {
    if (str(form, "step") === "start") { const k = await startKeyRotation(actor, id); await setOnce({ appId: id, nextKey: k }); return; }
    await finishKeyRotation(actor, id);
    return { ok: "Now using the new key. Ask the developer to remove the old one." };
  });
}

export async function revokeAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#run"), async () => { await revokeKey(actor, id, str(form, "reason")); return { ok: "Key revoked. The application is disconnected." }; });
}

export async function forgetOnceAction() {
  (await cookies()).delete("outcomes_once");
}

export async function draftReportAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#reports"), async () => { const r = await draftReport(actor, id, str(form, "month")); return `/reports/${r}`; });
}

export async function uploadAction(form: FormData) {
  const actor = await requireActor("operator"), id = str(form, "id");
  await act(back(id, "#connect"), async () => {
    const f = form.get("file");
    if (!(f instanceof File) || !f.size) throw new Refused("Choose the CSV file.");
    if (!/\.csv$/i.test(f.name)) throw new Refused("Upload the CSV saved from the template.");
    const r = await uploadSheet(actor, id, await f.text());
    if (r.problems.length) throw new Refused(r.problems.slice(0, 3).join(" ") + (r.problems.length > 3 ? ` And ${r.problems.length - 3} more.` : ""));
    return { ok: `${r.stored} figures stored.` };
  });
}
