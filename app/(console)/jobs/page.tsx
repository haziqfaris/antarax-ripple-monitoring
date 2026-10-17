import Link from "next/link";
import { requireActor } from "@/lib/auth/session";
import { inScope } from "@/lib/db";
import { collectApp } from "@/lib/services/collect";
import { act, str } from "@/lib/act";
import { Refused } from "@/lib/services/actor";
import { momentLabel } from "@/domain/format";
import { STATE_WORD, type LinkState } from "@/domain/link-state";
import { Submit } from "../../_components/controls";
import { Notice, PageHead, StatePill, sp } from "../../_components/ui";

export const metadata = { title: "Jobs" };

async function runAgain(form: FormData) {
  "use server";
  await requireActor("operator");
  await act("/jobs", async () => {
    const r = await collectApp(str(form, "app"));
    if (r.status === "failed") throw new Refused(`Still failing: ${r.error}`);
    return { ok: `Collected ${r.stored} figures.` };
  });
}

export default async function Jobs({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const q = await searchParams;
  const app = sp(q.app);
  const data = await inScope("all", async (tx) => {
    const links = await tx<{ id: string; name: string; org: string; source: string; state: LinkState; state_why: string | null; last_success_at: Date | null; last_attempt_at: Date | null; last_health_at: Date | null; base_url: string | null }[]>`
      select a.id, a.name, o.short_name as org, a.source, i.state, i.state_why, i.last_success_at, i.last_attempt_at, i.last_health_at, i.base_url
      from applications a join integrations i on i.application_id = a.id join organisations o on o.id = a.organisation_id
      order by case i.state when 'not_answering' then 0 when 'late' then 1 when 'not_connected' then 3 else 2 end, a.name`;
    const runs = await tx<{ id: string; app: string; kind: string; started_at: Date; finished_at: Date | null; status: string; days_read: number; observations_read: number; rejected: number; error: string | null }[]>`
      select r.id, a.name as app, r.kind, r.started_at, r.finished_at, r.status, r.days_read, r.observations_read, r.rejected, r.error
      from collection_runs r join applications a on a.id = r.application_id
      where (${app ?? null}::uuid is null or r.application_id = ${app ?? null}::uuid) order by r.started_at desc limit 60`;
    const mail = await tx<{ id: string; created_at: Date; to_addr: string; subject: string; sent_at: Date | null; error: string | null }[]>`select id, created_at, to_addr, subject, sent_at, error from outbox order by created_at desc limit 20`;
    return { links, runs, mail };
  });
  const op = actor.role !== "viewer";
  return (
    <>
      <PageHead title="Jobs" lead="Each application's link: when figures last arrived, the nightly collections, and the e-mails Outcomes sent." state="Collection runs nightly at 06:00 MYT; health every hour" />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      <section className="card" style={{ padding: 0 }}><div className="table-wrap"><table>
        <thead><tr><th>Application</th><th>State</th><th>Last figures</th><th>Last health check</th><th /></tr></thead>
        <tbody>{data.links.map((l) => <tr key={l.id}><td><Link className="name" href={`/applications/${l.id}`}>{l.name}</Link><span className="cell-sub">{l.org}{l.source === "sheet" ? " · spreadsheet" : ""}</span></td>
          <td><StatePill state={l.state} />{l.state !== "on_time" && l.state_why ? <span className="cell-sub">{l.state_why}</span> : null}</td>
          <td className="small mono">{momentLabel(l.last_success_at)}</td><td className="small mono">{momentLabel(l.last_health_at)}</td>
          <td>{op && l.base_url && l.source === "link" ? <form action={runAgain}><input type="hidden" name="app" value={l.id} /><Submit small>Run again</Submit></form> : null}</td></tr>)}</tbody>
      </table></div></section>
      <section className="card"><h2>Recent collections{app ? " for this application" : ""}</h2>
        {data.runs.length ? <div className="table-wrap"><table><thead><tr><th>When</th><th>Application</th><th>Kind</th><th>Result</th><th className="num">Days</th><th className="num">Figures</th><th className="num">Refused</th></tr></thead>
          <tbody>{data.runs.map((r) => <tr key={r.id}><td className="small mono">{momentLabel(r.started_at)}</td><td>{r.app}</td><td className="small">{r.kind}</td>
            <td><span className={`pill ${r.status === "ok" ? "ok" : r.status === "failed" ? "fault" : r.status === "partial" ? "warn" : "info"}`}>{r.status === "ok" ? "Done" : r.status === "failed" ? "Failed" : r.status === "partial" ? "Some refused" : "Running"}</span>{r.error ? <span className="cell-sub">{r.error}</span> : null}</td>
            <td className="num mono">{r.days_read}</td><td className="num mono">{r.observations_read}</td><td className="num mono">{r.rejected || <span className="dashv">0</span>}</td></tr>)}</tbody></table></div>
          : <p className="muted">No collections yet.</p>}
      </section>
      <section className="card"><h2>E-mail</h2>
        {data.mail.length ? <div className="table-wrap"><table><thead><tr><th>When</th><th>To</th><th>Subject</th><th>Sent</th></tr></thead>
          <tbody>{data.mail.map((m) => <tr key={m.id}><td className="small mono">{momentLabel(m.created_at)}</td><td className="small">{m.to_addr}</td><td>{m.subject}</td><td className="small">{m.sent_at ? momentLabel(m.sent_at) : m.error ? <span className="pill fault">{m.error}</span> : <span className="pill">In the outbox</span>}</td></tr>)}</tbody></table></div>
          : <p className="muted">Nothing sent yet. Alerts go to ALERT_TO when a link stops answering or figures are late.</p>}
      </section>
      <p className="small muted">{STATE_WORD.on_time}: figures arrived for every finished day. {STATE_WORD.late}: two days or more without new figures. {STATE_WORD.not_answering}: the link failed or refused its key. A missing day is a gap, never a zero.</p>
    </>
  );
}
