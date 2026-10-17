import Link from "next/link";
import { requireActor } from "@/lib/auth/session";
import { listReports } from "@/lib/services/reports";
import { orgScope } from "@/lib/orgs";
import { momentLabel, monthLabel } from "@/domain/format";
import { OrgPicker } from "../../_components/controls";
import { Notice, PageHead, sp } from "../../_components/ui";

export const metadata = { title: "Reports" };

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActor();
  const q = await searchParams;
  const { options, org } = await orgScope(sp(q.org));
  const list = await listReports(org?.id);
  return (
    <>
      <PageHead title={org ? `Reports · ${org.short_name}` : "Reports"} lead="One a month per application, written by a person from the figures, approved by someone else, then frozen."
        state={`${list.length} report${list.length === 1 ? "" : "s"} · ${list.filter((r) => r.status === "waiting").length} waiting for approval`} actions={<OrgPicker options={options} current={org?.id ?? null} />} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      {list.length ? <section className="card" style={{ padding: 0 }}><div className="table-wrap"><table>
        <thead><tr><th>Report</th>{org ? null : <th>Organisation</th>}<th>Month</th><th>Version</th><th>State</th></tr></thead>
        <tbody>{list.map((r) => <tr key={r.id}><td><Link className="name" href={`/reports/${r.id}`}>{r.app}</Link></td>{org ? null : <td>{r.org_short}</td>}<td>{monthLabel(r.month)}</td><td className="mono">{r.version}</td>
          <td><span className={`pill ${r.status === "approved" ? "ok" : r.status === "waiting" ? "warn" : ""}`}>{r.status === "approved" ? `Approved ${momentLabel(r.approved_at)}` : r.status === "waiting" ? "Waiting for approval" : "Draft"}</span></td></tr>)}</tbody>
      </table></div></section> : <section className="card"><h2>No reports yet</h2><p className="muted">Draft one from an application that is collecting, once a month of figures is in.</p></section>}
    </>
  );
}
