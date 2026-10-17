// Monthly reports (V-26): drafted from computed figures, written and edited by a person (no AI in version 1),
// approved by someone else, then frozen as HTML with a SHA-256 hash. Printed to PDF from the browser.
import { sha256Hex } from "../../vendor/lapisan/crypto";
import type { Tx } from "../db";
import { audit } from "../audit";
import { appResults } from "./results";
import { need, Refused, type StaffActor } from "./actor";
import { inAppScope } from "./scope";
import { dash, dayLabel, localDay, monthEnd, monthLabel, nf, prevMonth } from "../../domain/format";
import { METHOD_WORDS } from "./kpis";

export interface ReportFigures {
  month: string; org: string; app: string; project: string; unitPlural: string; generatedAt: string;
  kpis: { code: string; name: string; unit: string; better: "up" | "down"; quality: string; value: number | null; low: number | null; high: number | null; prev: number | null; expected: number; missing: number; why: string | null }[];
  baseline: { version: number; minutesMid: number; minutesLow: number; minutesHigh: number; reviewMid: number; reviewLow: number; reviewHigh: number; method: string; sampleSize: number | null; evidence: string; measuredFrom: string | null; measuredTo: string | null; appliesFrom: string } | null;
  machineMinutes: number | null;
}

export interface ReportRow { id: string; application_id: string; month: string; version: number; status: "draft" | "waiting" | "approved"; figures: ReportFigures; summary: string; changes: string; caveats: string; next_steps: string; html: string | null; html_sha256: string | null; edited_by: string | null; approved_at: Date | null; approved_by: string | null; created_at: Date }

async function figuresFor(tx: Tx, appId: string, month: string): Promise<ReportFigures> {
  const [a] = await tx<{ name: string; project_name: string; unit_plural: string; org: string }[]>`select a.name, a.project_name, a.unit_plural, o.name as org from applications a join organisations o on o.id = a.organisation_id where a.id = ${appId}`;
  const cur = await appResults(tx, appId, month, monthEnd(month));
  const pm = prevMonth(month);
  const prev = await appResults(tx, appId, pm, monthEnd(pm));
  const approved = cur.kpis.filter((k) => k.kpi.approved);
  if (!approved.length) throw new Refused("Nothing approved to report yet: the KPIs need approving first.");
  const hours = cur.kpis.find((k) => k.kpi.code === "hours");
  const b = cur.baseline?.approved ? cur.baseline : null;
  return {
    month, org: a!.org, app: a!.name, project: a!.project_name, unitPlural: a!.unit_plural, generatedAt: new Date().toISOString(),
    kpis: approved.map(({ kpi, result }) => ({
      code: kpi.code, name: kpi.name, unit: kpi.unit, better: kpi.better, quality: result.quality, value: result.value, low: result.low ?? null, high: result.high ?? null,
      prev: prev.kpis.find((p) => p.kpi.code === kpi.code && p.kpi.approved)?.result.value ?? null, expected: result.expected, missing: result.missing, why: result.why ?? null,
    })),
    baseline: b ? { version: b.version, minutesMid: b.minutes_mid, minutesLow: b.minutes_low, minutesHigh: b.minutes_high, reviewMid: b.review_mid, reviewLow: b.review_low, reviewHigh: b.review_high, method: b.method, sampleSize: b.sample_size, evidence: b.evidence, measuredFrom: b.measured_from, measuredTo: b.measured_to, appliesFrom: b.applies_from } : null,
    machineMinutes: hours?.result.parts?.machineMinutes ?? null,
  };
}

export async function draftReport(actor: StaffActor, appId: string, month: string, today = localDay(Date.now())) {
  need(actor, "operator");
  if (!/^\d{4}-\d{2}-01$/.test(month)) throw new Refused("Choose a month.");
  if (monthEnd(month) >= today) throw new Refused("That month isn't over yet. Reports cover finished months only.");
  return inAppScope(appId, async (tx, org) => {
    const figures = await figuresFor(tx, appId, month);
    const [v] = await tx<{ v: number }[]>`select coalesce(max(version), 0) + 1 as v from reports where application_id = ${appId} and month = ${month}`;
    const [open] = await tx<{ id: string }[]>`select id from reports where application_id = ${appId} and month = ${month} and status in ('draft', 'waiting')`;
    if (open) throw new Refused("A draft for that month is already open.", "conflict");
    const [r] = await tx<{ id: string }[]>`insert into reports (organisation_id, application_id, month, version, figures, edited_by) values (${org}, ${appId}, ${month}, ${v!.v}, ${tx.json(figures as never)}, ${actor.id}) returning id`;
    await audit(tx, { actor, org, action: "Drafted a report", subject: `${figures.app}, ${monthLabel(month)}` });
    return r!.id;
  }, actor.id);
}

export async function getReport(reportId: string) {
  const app = await appOfReport(reportId);
  return inAppScope(app, async (tx) => (await tx<ReportRow[]>`select id, application_id, month::text as month, version, status, figures, summary, changes, caveats, next_steps, html, html_sha256, edited_by, approved_at, approved_by, created_at from reports where id = ${reportId}`)[0]!);
}

async function appOfReport(reportId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/.test(reportId)) throw new Refused("No such report", "not_found");
  const { inScope } = await import("../db");
  const r = await inScope("all", async (tx) => (await tx<{ application_id: string }[]>`select application_id from reports where id = ${reportId}`)[0]);
  if (!r) throw new Refused("No such report", "not_found");
  return r.application_id;
}

export async function editReport(actor: StaffActor, reportId: string, t: { summary: string; changes: string; caveats: string; next_steps: string }) {
  need(actor, "operator");
  for (const v of Object.values(t)) if (v.length > 4000) throw new Refused("Keep each section under 4,000 characters.");
  const app = await appOfReport(reportId);
  return inAppScope(app, async (tx, org) => {
    const [r] = await tx<{ status: string }[]>`select status from reports where id = ${reportId}`;
    if (r!.status === "approved") throw new Refused("An approved report is frozen. Draft a new version to change it.", "conflict");
    await tx`update reports set summary = ${t.summary}, changes = ${t.changes}, caveats = ${t.caveats}, next_steps = ${t.next_steps}, edited_by = ${actor.id}, status = 'draft' where id = ${reportId}`;
    await tx`update approvals set status = 'changes', reason = 'Edited after it was sent; send it again', decided_at = now() where subject = 'report' and subject_id = ${reportId} and status = 'waiting'`;
    await audit(tx, { actor, org, action: "Edited a report", subject: reportId });
  }, actor.id);
}

export async function submitReport(actor: StaffActor, reportId: string) {
  need(actor, "operator");
  const app = await appOfReport(reportId);
  return inAppScope(app, async (tx, org) => {
    const [r] = await tx<{ status: string; summary: string; figures: ReportFigures; month: string }[]>`select status, summary, figures, month::text as month from reports where id = ${reportId}`;
    if (r!.status !== "draft") throw new Refused("Only a draft can be sent for approval.", "conflict");
    if (r!.summary.trim().length < 20) throw new Refused("Write the summary first: what changed for the organisation this month, in a few sentences.");
    await tx`update reports set status = 'waiting' where id = ${reportId}`;
    await tx`insert into approvals (organisation_id, application_id, subject, subject_id, title, summary, proposed_by) values (${org}, ${app}, 'report', ${reportId}, ${`${r!.figures.app} report, ${monthLabel(r!.month)}`}, ${r!.summary.slice(0, 200)}, ${actor.id})`;
    await audit(tx, { actor, org, action: "Sent a report for approval", subject: reportId });
  }, actor.id);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const paras = (s: string) => s.trim() ? s.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : `<p class="none">${dash}</p>`;
const val = (v: number | null, unit: string) => v === null ? dash : unit === "%" ? `${nf(v, 1)}%` : unit === "h" ? `${nf(v)} h` : nf(v, v % 1 ? 1 : 0);

/** The approved report, frozen: one self-contained page, the light AntaraX layout, every figure with its source. */
export function renderReportHtml(r: Pick<ReportRow, "figures" | "summary" | "changes" | "caveats" | "next_steps" | "version">, approvedAt: Date): string {
  const f = r.figures, notes: string[] = [];
  const rows = f.kpis.map((k) => {
    const note = k.quality === "estimated" ? notes.push(`Estimated from the approved baseline${f.baseline ? `: ${nf(f.baseline.minutesMid, 1)} min by hand per item (${nf(f.baseline.minutesLow, 1)} to ${nf(f.baseline.minutesHigh, 1)}), ${METHOD_WORDS[f.baseline.method as keyof typeof METHOD_WORDS] ?? f.baseline.method}${f.baseline.sampleSize ? `, ${f.baseline.sampleSize} items` : ""}${f.baseline.measuredFrom ? `, ${dayLabel(f.baseline.measuredFrom)} to ${dayLabel(f.baseline.measuredTo ?? f.baseline.measuredFrom)}` : ""}; review ${nf(f.baseline.reviewMid, 1)} min (${nf(f.baseline.reviewLow, 1)} to ${nf(f.baseline.reviewHigh, 1)})${f.machineMinutes !== null ? `; machine time ${nf(f.machineMinutes, 2)} min, measured and never counted as a person's` : ""}. ${esc(f.baseline.evidence)}` : ""}.`)
      : notes.push(k.quality === "derived" ? "Worked out from the totals the application shares, never averaged." : "Counted by the application, each finished day.");
    const range = k.low !== null && k.high !== null ? `<span class="range">likely ${val(k.low, k.unit)} to ${val(k.high, k.unit)}</span>` : "";
    return `<tr><td>${esc(k.name)}<sup>${note}</sup>${k.missing ? `<span class="gap">${k.missing} of ${k.expected} days missing, not counted</span>` : ""}</td><td class="num">${val(k.value, k.unit)}${range}</td><td class="num">${val(k.prev, k.unit)}</td><td>${k.quality === "estimated" ? "Estimate" : k.quality === "derived" ? "Worked out" : k.quality === "measured" ? "Measured" : "Not available"}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(f.app)}, ${monthLabel(f.month)}</title>
<style>
:root{--ink:#071233;--body:#33415C;--muted:#5A6B8C;--line:#DCE3F0;--brand:#0459F7}
*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--body);font:400 14px/1.6 Poppins,ui-sans-serif,system-ui,sans-serif}
main{max-width:780px;margin:0 auto;padding:40px 32px}header{border-bottom:2px solid var(--ink);padding-bottom:16px;margin-bottom:24px}
.eyebrow{font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--brand)}
h1{color:var(--ink);font-size:26px;margin:8px 0 6px}h2{color:var(--ink);font-size:16px;margin:28px 0 8px}.meta{color:var(--muted);font-size:12px;display:flex;gap:16px;flex-wrap:wrap}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:500}
.num{text-align:right;font-family:"JetBrains Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;color:var(--ink)}.range,.gap{display:block;font-size:11px;color:var(--muted);font-family:inherit}
sup{font-size:10px;color:var(--brand);margin-left:2px}.notes{font-size:12px;color:var(--muted)}.notes li{margin:4px 0}.none{color:var(--muted)}
footer{margin-top:40px;padding-top:12px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media print{main{padding:0}@page{size:A4;margin:18mm}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body><main>
<header><div class="eyebrow">Performance report</div><h1>${esc(f.app)}, ${monthLabel(f.month)}</h1>
<div class="meta"><span>Prepared for ${esc(f.org)}</span><span>${esc(f.project)}</span><span>Version ${r.version}</span><span>Approved ${dayLabel(approvedAt.toISOString())}</span></div></header>
<h2>Summary</h2>${paras(r.summary)}
<h2>Outcomes</h2><table><thead><tr><th>Measure</th><th class="num">${monthLabel(f.month)}</th><th class="num">${monthLabel(prevMonth(f.month))}</th><th>Kind</th></tr></thead><tbody>${rows}</tbody></table>
<h2>What changed</h2>${paras(r.changes)}
<h2>Caveats</h2>${paras(r.caveats)}
<h2>Recommended next steps</h2>${paras(r.next_steps)}
<h2>How we measured</h2><ol class="notes">${notes.map((n) => `<li>${n}</li>`).join("")}</ol>
<footer><span>Run by REKA as part of Managed AI.</span><span>REKA Inisiatif Sdn Bhd</span></footer>
</main></body></html>`;
}

/** Called by the approval: freeze the page and its hash. */
export async function freezeReport(tx: Tx, reportId: string, approvedBy: string): Promise<string> {
  const [r] = await tx<ReportRow[]>`select figures, summary, changes, caveats, next_steps, version from reports where id = ${reportId}`;
  const at = new Date();
  const html = renderReportHtml(r!, at);
  const hash = await sha256Hex(html);
  await tx`update reports set status = 'approved', html = ${html}, html_sha256 = ${hash}, approved_at = ${at}, approved_by = ${approvedBy} where id = ${reportId}`;
  return hash;
}

export async function listReports(orgId?: string | null) {
  const { inScope } = await import("../db");
  return inScope(orgId ? { org: orgId } : "all", (tx) => tx<{ id: string; application_id: string; app: string; org_short: string; organisation_id: string; month: string; version: number; status: string; approved_at: Date | null }[]>`
    select r.id, r.application_id, a.name as app, o.short_name as org_short, r.organisation_id, r.month::text as month, r.version, r.status, r.approved_at
    from reports r join applications a on a.id = r.application_id join organisations o on o.id = r.organisation_id
    order by (r.status = 'waiting') desc, r.month desc, a.name, r.version desc`);
}
