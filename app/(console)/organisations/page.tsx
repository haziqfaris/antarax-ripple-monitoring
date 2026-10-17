import Link from "next/link";
import { requireActor } from "@/lib/auth/session";
import { listOrganisations } from "@/lib/services/organisations";
import { PageHead, Notice, sp } from "../../_components/ui";

export const metadata = { title: "Results" };

export default async function Organisations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const q = await searchParams;
  const orgs = await listOrganisations();
  return (
    <>
      <PageHead title="Results" lead="Each organisation's applications and what they delivered." state={`${orgs.length} organisation${orgs.length === 1 ? "" : "s"}`}
        actions={actor.role !== "viewer" ? <Link className="btn" href="/applications/new">Add an organisation</Link> : null} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      {orgs.length ? <section className="card" style={{ padding: 0 }}><div className="table-wrap"><table>
        <thead><tr><th>Organisation</th><th>Industry</th><th className="num">Applications</th><th className="num">Collecting</th><th className="num">Waiting for approval</th><th>Data agreement</th></tr></thead>
        <tbody>{orgs.map((o) => <tr key={o.id}><td><Link className="name" href={`/organisations/${o.id}`}>{o.short_name}</Link><span className="cell-sub">{o.name}</span></td><td className="small">{o.industry}</td>
          <td className="num mono">{o.apps}</td><td className="num mono">{o.collecting}</td><td className="num mono">{o.waiting || <span className="dashv">0</span>}</td>
          <td>{o.agreement_confirmed_at ? <span className="pill ok">Confirmed</span> : <span className="pill warn">Not confirmed</span>}</td></tr>)}</tbody>
      </table></div></section> : <section className="card"><p className="muted">No organisations yet.</p></section>}
    </>
  );
}
