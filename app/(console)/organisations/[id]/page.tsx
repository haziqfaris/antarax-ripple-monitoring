import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { getOrganisation } from "@/lib/services/organisations";
import { listApplications } from "@/lib/services/applications";
import { needsAPerson } from "@/lib/services/needs";
import { inAppScope } from "@/lib/services/scope";
import { appResults } from "@/lib/services/results";
import { Refused } from "@/lib/services/actor";
import { organisationHours } from "@/domain/kpi";
import { addDays, dayLabel, localDay, nf } from "@/domain/format";
import { NeedsList, PageHead, StagePill, StatePill, fmtKpi, Notice, sp } from "../../../_components/ui";

export const metadata = { title: "Results" };

export default async function OrganisationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const q = await searchParams;
  let org: Awaited<ReturnType<typeof getOrganisation>>;
  try { org = await getOrganisation(id); } catch (e) { if (e instanceof Refused) notFound(); throw e; }
  const days = Number(sp(q.w) ?? 30) === 90 ? 90 : 30;
  const to = addDays(localDay(Date.now(), org.time_zone), -1), from = addDays(to, -(days - 1));
  const apps = await listApplications(id);
  const needs = await needsAPerson(id);
  const rows = [];
  for (const a of apps) {
    const r = await inAppScope(a.id, (tx) => appResults(tx, a.id, from, to));
    rows.push({ a, r, hours: r.kpis.find((k) => k.kpi.code === "hours" && k.kpi.approved)?.result ?? null, volume: r.kpis.find((k) => k.kpi.code === "volume" && k.kpi.approved)?.result ?? null });
  }
  const total = organisationHours(rows.filter((x) => x.a.stage === "collecting").map((x) => ({ application: x.a.name, result: x.hours })));
  return (
    <>
      <PageHead title={org.short_name} topTitle={`Results · ${org.short_name}`} crumbs={<><Link href="/organisations">Results</Link><span>›</span><span>{org.short_name}</span></>}
        lead={`${org.name} · ${org.industry}`} state={`${dayLabel(from)} to ${dayLabel(to)} · days counted in ${org.time_zone}`}
        actions={<>{[30, 90].map((d) => <Link key={d} className="btn sm" href={`/organisations/${id}?w=${d}`} aria-current={d === days ? "true" : undefined} style={d === days ? { borderColor: "var(--axle-orange)", background: "var(--axle-selected-row)" } : undefined}>{d} days</Link>)}
          {actor.role !== "viewer" ? <Link className="btn primary" href={`/applications/new?org=${id}`}>+ Track an application</Link> : null}</>} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      <div className="grid2">
        <section className="card kpi"><span className="label">Hours saved, all its applications</span>
          <div className="value">{total.value === null ? <span className="dashv">–</span> : <>{nf(total.value)}<small>h</small></>}</div>
          {total.value !== null ? <span className="why">Likely {nf(total.low)} to {nf(total.high)} h · an estimate from approved baselines</span> : <span className="why">No approved hours yet</span>}
          <span className="why">Includes {total.included} of {total.of} collecting application{total.of === 1 ? "" : "s"}{total.left.length ? `; not included: ${total.left.join(", ")}` : ""}. Applications are assumed not to overlap.</span>
        </section>
        <section className="card"><h2>Needs a person at {org.short_name}</h2><NeedsList needs={needs} empty={`Nothing needs a person at ${org.short_name}.`} /></section>
      </div>
      <section className="card" style={{ padding: 0 }}><div className="table-wrap"><table>
        <thead><tr><th>Application</th><th>Stage</th><th>Its link</th><th className="num">Handled</th><th className="num">Hours saved</th></tr></thead>
        <tbody>{rows.length ? rows.map(({ a, hours, volume }) => <tr key={a.id}><td><Link className="name" href={`/applications/${a.id}`}>{a.name}</Link><span className="cell-sub">{a.project_name}</span></td>
          <td><StagePill stage={a.stage} step={a.setup_step} /></td><td><StatePill state={a.state} /></td>
          <td className="num mono">{volume?.value != null ? fmtKpi(volume.value, "") : <span className="dashv">–</span>}{volume && volume.missing ? <span className="cell-sub">{volume.missing} days missing</span> : null}</td>
          <td className="num mono">{hours?.value != null ? `${fmtKpi(hours.value, "h")} h` : <span className="dashv" title={hours?.why ?? "No approved figure yet"}>–</span>}</td></tr>)
          : <tr><td colSpan={5} className="muted">No applications yet.</td></tr>}</tbody>
      </table></div></section>
    </>
  );
}
