import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { getReport, editReport, submitReport, renderReportHtml } from "@/lib/services/reports";
import { listApprovals } from "@/lib/services/approvals";
import { Refused } from "@/lib/services/actor";
import { atLeast } from "@/lib/auth/roles";
import { act, str } from "@/lib/act";
import { monthLabel, momentLabel } from "@/domain/format";
import { Submit } from "../../../_components/controls";
import { Notice, PageHead, sp } from "../../../_components/ui";

export const metadata = { title: "Report" };

async function saveAction(form: FormData) {
  "use server";
  const actor = await requireActor("operator");
  const id = str(form, "id");
  await act(`/reports/${id}`, async () => {
    await editReport(actor, id, { summary: str(form, "summary"), changes: str(form, "changes"), caveats: str(form, "caveats"), next_steps: str(form, "next_steps") });
    if (str(form, "then") === "submit") { await submitReport(actor, id); return { ok: "Sent for approval." }; }
    return { ok: "Saved." };
  });
}

const SECTIONS = [["summary", "Summary", "What changed for the organisation this month, in a few sentences. Numbers only as the table shows them."], ["changes", "What changed", "What moved, and what happened around it. Say what is not proof of cause."], ["caveats", "Caveats", "Missing days, a new baseline, anything the reader should know."], ["next_steps", "Recommended next steps", "What REKA or the organisation should do next."]] as const;

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const q = await searchParams;
  let r: Awaited<ReturnType<typeof getReport>>;
  try { r = await getReport(id); } catch (e) { if (e instanceof Refused) notFound(); throw e; }
  const f = r.figures;
  const approval = (await listApprovals()).find((p) => p.subject === "report" && p.subject_id === id && p.status === "waiting");
  const editable = r.status !== "approved" && atLeast(actor.role, "operator");
  return (
    <>
      <PageHead title={`${f.app}, ${monthLabel(r.month)}`} topTitle={`Report · ${f.app}`} crumbs={<><Link href="/reports">Reports</Link><span>›</span><Link href={`/applications/${r.application_id}`}>{f.app}</Link><span>›</span><span>{monthLabel(r.month)}</span></>}
        lead={`For ${f.org} · version ${r.version}`}
        state={r.status === "approved" ? `Approved ${momentLabel(r.approved_at)} · SHA-256 ${r.html_sha256}` : r.status === "waiting" ? "Waiting for approval" : "Draft"}
        actions={<>{r.status === "approved" ? <a className="btn primary" href={`/reports/${id}/print`} target="_blank" rel="noopener">Open the frozen report to print or save as PDF</a> : null}
          {approval ? <Link className="btn" href={`/approvals?id=${approval.id}`}>Its approval</Link> : null}</>} />
      <Notice e={sp(q.e)} ok={sp(q.ok)} />
      {r.status !== "approved" ? (
        <div className="grid2" style={{ alignItems: "start" }}>
          <form action={saveAction} className="card form" aria-label="Write the report">
            <input type="hidden" name="id" value={id} />
            <p className="sub">The figures are fixed from the console when the draft was made. Write around them; never type a new number.</p>
            {SECTIONS.map(([k, label, hint]) => <div key={k} className="field"><label htmlFor={k}>{label}</label><textarea className="input" id={k} name={k} defaultValue={r[k]} maxLength={4000} disabled={!editable} /><span className="hint">{hint}</span></div>)}
            {editable ? <div className="actions"><Submit>Save</Submit>{r.status === "draft" ? <Submit primary name="then" value="submit">Save and send for approval</Submit> : null}</div> : null}
            {r.status === "waiting" && editable ? <p className="small muted">Editing it now takes it back to a draft and asks for approval again.</p> : null}
          </form>
          <section className="card" aria-label="Preview">
            <h3>Preview</h3>
            <iframe title="Report preview" sandbox="" srcDoc={renderReportHtml(r, new Date())} style={{ width: "100%", height: 720, border: "1px solid var(--axle-card-line)", borderRadius: 12, background: "var(--axle-card)" }} />
          </section>
        </div>
      ) : (
        <section className="card"><iframe title="The approved report" sandbox="" srcDoc={r.html ?? ""} style={{ width: "100%", height: 900, border: 0 }} /></section>
      )}
    </>
  );
}
