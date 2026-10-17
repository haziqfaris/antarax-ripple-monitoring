import Link from "next/link";
import { requireActor } from "@/lib/auth/session";
import { listApprovals, decide, type Decision } from "@/lib/services/approvals";
import { canDecide } from "@/lib/auth/roles";
import { orgScope } from "@/lib/orgs";
import { act, str } from "@/lib/act";
import { Refused } from "@/lib/services/actor";
import { momentLabel } from "@/domain/format";
import { OrgPicker, Submit } from "../../_components/controls";
import { Notice, PageHead, sp } from "../../_components/ui";

export const metadata = { title: "Approvals" };
const STATUS: Record<string, [string, string]> = { waiting: ["warn", "Waiting"], approved: ["ok", "Approved"], changes: ["info", "Changes asked"], declined: ["", "Declined"] };
const SUBJECT: Record<string, string> = { kpi_set: "KPIs", baseline: "Baseline", report: "Report" };

async function decideAction(form: FormData) {
  "use server";
  const actor = await requireActor("approver");
  const back = `/approvals?id=${str(form, "id")}${str(form, "org") ? `&org=${str(form, "org")}` : ""}`;
  await act(back, async () => {
    const d = str(form, "decision") as Decision;
    if (!["approved", "changes", "declined"].includes(d)) throw new Refused("Choose a decision.");
    await decide(actor, str(form, "id"), d, str(form, "reason"));
    return { to: `/approvals${str(form, "org") ? `?org=${str(form, "org")}` : ""}`, ok: d === "approved" ? "Approved." : d === "changes" ? "Changes asked for." : "Declined." };
  });
}

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const q = await searchParams;
  const { options, org } = await orgScope(sp(q.org));
  const list = await listApprovals(org?.id);
  const sel = list.find((p) => p.id === sp(q.id)) ?? list.find((p) => p.status === "waiting") ?? list[0];
  const may = sel ? canDecide(actor.role, actor.id, { proposedBy: sel.proposed_by, editedBy: sel.edited_by }) : null;
  return (
    <>
      <PageHead title={org ? `Approvals · ${org.short_name}` : "Approvals"} lead="Nothing counts, and no report goes out, until someone other than the proposer approves it."
        state={`${list.filter((p) => p.status === "waiting").length} waiting`} actions={<OrgPicker options={options} current={org?.id ?? null} />} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      {list.length ? (
        <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.3fr)", alignItems: "start" }}>
          <section className="card" style={{ gap: 6 }} aria-label="Queue">
            {list.map((p) => <Link key={p.id} href={`/approvals?id=${p.id}${org ? `&org=${org.id}` : ""}`} className="card flat" style={{ textDecoration: "none", gap: 4, ...(p.id === sel?.id ? { borderColor: "var(--axle-orange)", background: "var(--axle-selected-row)" } : {}) }} aria-current={p.id === sel?.id ? "true" : undefined}>
              <span className="row" style={{ gap: 6 }}><span className={`pill ${STATUS[p.status]![0]}`}>{STATUS[p.status]![1]}</span><span className="pill">{SUBJECT[p.subject]}</span></span>
              <span className="name">{p.title}</span><span className="small muted">{org ? "" : `${p.org_short} · `}{momentLabel(p.proposed_at)}</span>
            </Link>)}
          </section>
          {sel ? (
            <section className="card" aria-labelledby="ap-h">
              <span className="row" style={{ gap: 6 }}><span className={`pill ${STATUS[sel.status]![0]}`}>{STATUS[sel.status]![1]}</span><span className="pill">{SUBJECT[sel.subject]}</span></span>
              <h2 id="ap-h">{sel.title}</h2>
              <p>{sel.summary}</p>
              <table><tbody>
                <tr><th>Organisation</th><td>{sel.org_short}</td></tr>
                <tr><th>Application</th><td><Link href={`/applications/${sel.application_id}`}>{sel.app_name}</Link></td></tr>
                <tr><th>Proposed by</th><td>{sel.proposer_name}, {momentLabel(sel.proposed_at)}</td></tr>
                {sel.decided_at ? <tr><th>Decided by</th><td>{sel.decider_name}, {momentLabel(sel.decided_at)}: “{sel.reason}”</td></tr> : null}
              </tbody></table>
              {sel.subject === "report" && sel.subject_id ? <Link className="btn sm" href={`/reports/${sel.subject_id}`} style={{ justifySelf: "start" }}>Read the report</Link>
                : <Link className="btn sm" href={`/applications/${sel.application_id}#${sel.subject === "baseline" ? "baseline" : "kpis"}`} style={{ justifySelf: "start" }}>See it with its figures</Link>}
              {sel.status === "waiting" ? (
                <form action={decideAction} className="form" style={{ borderTop: "1px solid var(--axle-card-line)", paddingTop: 14 }}>
                  <input type="hidden" name="id" value={sel.id} />{org ? <input type="hidden" name="org" value={org.id} /> : null}
                  <div className="field"><label htmlFor="reason">Your reason</label><textarea className="input" id="reason" name="reason" required minLength={3} disabled={!may?.ok} placeholder="Why you’re approving or asking for changes. It’s kept in the audit trail." /></div>
                  {may?.ok ? <div className="actions"><Submit primary name="decision" value="approved">Approve</Submit><Submit name="decision" value="changes">Ask for changes</Submit><Submit name="decision" value="declined">Decline</Submit></div>
                    : <p className="needs-role">{may?.why}</p>}
                </form>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : <section className="card"><h2>Nothing to approve</h2><p className="muted">KPIs, baselines and reports come here for a second person to check.</p></section>}
    </>
  );
}
