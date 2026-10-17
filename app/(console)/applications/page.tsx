import Link from "next/link";
import { requireActor } from "@/lib/auth/session";
import { listApplications } from "@/lib/services/applications";
import { needsAPerson } from "@/lib/services/needs";
import { inAppScope } from "@/lib/services/scope";
import { appResults } from "@/lib/services/results";
import { orgScope } from "@/lib/orgs";
import { addDays, localDay, momentLabel, nf } from "@/domain/format";
import { OrgPicker } from "../../_components/controls";
import { NeedsList, Notice, PageHead, StagePill, StatePill, sp } from "../../_components/ui";

export const metadata = { title: "Applications" };

export default async function Applications({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const q = await searchParams;
  const { options, org } = await orgScope(sp(q.org));
  const [apps, needs] = await Promise.all([listApplications(org?.id), needsAPerson(org?.id)]);
  const to = addDays(localDay(Date.now()), -1), from = addDays(to, -29);
  const hours = new Map<string, number | null>();
  for (const a of apps.filter((x) => x.stage === "collecting")) {
    const r = await inAppScope(a.id, (tx) => appResults(tx, a.id, from, to));
    hours.set(a.id, r.kpis.find((k) => k.kpi.code === "hours" && k.kpi.approved)?.result.value ?? null);
  }
  const track = actor.role !== "viewer" ? <Link className="btn primary" href={`/applications/new${org ? `?org=${org.id}` : ""}`}>+ Track an application{org ? ` for ${org.short_name}` : ""}</Link> : null;
  return (
    <>
      <PageHead title={org ? `Applications · ${org.short_name}` : "Applications"} lead={org ? `The applications REKA tracks for ${org.short_name}.` : "Every application REKA tracks for its organisations. Track a new one, or pick up one being set up."}
        state={`${apps.length} application${apps.length === 1 ? "" : "s"}${apps.filter((a) => a.stage === "set_up").length ? ` · ${apps.filter((a) => a.stage === "set_up").length} being set up` : ""}`}
        actions={<><OrgPicker options={options} current={org?.id ?? null} />{track}</>} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      <section className="card" aria-labelledby="needs-h"><h2 id="needs-h">Needs a person{org ? ` at ${org.short_name}` : ""}</h2><NeedsList needs={needs} empty="Nothing needs a person. Every link answered and every report is drafted." /></section>
      {apps.length ? (
        <section className="card" style={{ padding: 0 }}>
          <div className="table-wrap"><table>
            <thead><tr><th>Application</th>{org ? null : <th>Organisation</th>}<th>Stage</th><th>Its link</th><th>Last figures</th><th className="num">Hours saved, 30 days</th></tr></thead>
            <tbody>{apps.map((a) => (
              <tr key={a.id}>
                <td><Link className="name" href={`/applications/${a.id}`}>{a.name}</Link><span className="cell-sub">{a.project_name}</span></td>
                {org ? null : <td><Link href={`/organisations/${a.organisation_id}`}>{a.org_short}</Link></td>}
                <td><StagePill stage={a.stage} step={a.setup_step} /></td>
                <td>{a.source === "sheet" && a.state === "not_connected" ? <span className="pill">Spreadsheet</span> : <StatePill state={a.state} />}</td>
                <td className="small mono">{momentLabel(a.last_success_at)}</td>
                <td className="num mono">{hours.has(a.id) && hours.get(a.id) !== null ? `${nf(hours.get(a.id)!)} h` : <span className="dashv" title="No approved figure yet">–</span>}</td>
              </tr>))}
            </tbody>
          </table></div>
        </section>
      ) : (
        <section className="card"><h2>{org ? `No applications for ${org.short_name} yet` : "Track your first application"}</h2>
          <p className="muted">Pick the organisation, name the application, send the developer a prompt (or use a spreadsheet), and Outcomes connects to it.</p>
          <div className="actions">{track}</div></section>
      )}
    </>
  );
}
