// Approvals (V-20): a reason every time; whoever proposed or edited cannot decide (V-09); each decision has effects.
import { inScope } from "../db";
import { audit } from "../audit";
import { canDecide } from "../auth/roles";
import { Refused, type StaffActor } from "./actor";
import { approvedSetup } from "./applications";
import { freezeReport } from "./reports";

export type Decision = "approved" | "changes" | "declined";
export interface ApprovalRow {
  id: string; organisation_id: string; application_id: string; subject: "kpi_set" | "baseline" | "report"; subject_id: string | null; title: string; summary: string;
  status: "waiting" | "approved" | "changes" | "declined"; proposed_by: string; proposed_at: Date; decided_by: string | null; decided_at: Date | null; reason: string | null;
  proposer_name: string; decider_name: string | null; org_short: string; app_name: string; edited_by: string | null;
}

export async function listApprovals(orgId?: string | null) {
  return inScope(orgId ? { org: orgId } : "all", (tx) => tx<ApprovalRow[]>`
    select p.*, s.name as proposer_name, d.name as decider_name, o.short_name as org_short, a.name as app_name,
      (select edited_by from reports r where p.subject = 'report' and r.id = p.subject_id) as edited_by
    from approvals p join staff s on s.id = p.proposed_by left join staff d on d.id = p.decided_by
    join organisations o on o.id = p.organisation_id join applications a on a.id = p.application_id
    order by (p.status = 'waiting') desc, p.proposed_at desc limit 200`);
}

export async function decide(actor: StaffActor, approvalId: string, decision: Decision, reason: string) {
  if (reason.trim().length < 3) throw new Refused("Give a reason. It goes in the audit trail.");
  if (!/^[0-9a-f-]{36}$/.test(approvalId)) throw new Refused("No such approval", "not_found");
  const found = await inScope("all", async (tx) => (await tx<{ organisation_id: string }[]>`select organisation_id from approvals where id = ${approvalId}`)[0]);
  if (!found) throw new Refused("No such approval", "not_found");
  return inScope({ org: found.organisation_id }, async (tx) => {
    const [p] = await tx<(ApprovalRow & { edited_by: string | null })[]>`select p.*, (select edited_by from reports r where p.subject = 'report' and r.id = p.subject_id) as edited_by from approvals p where p.id = ${approvalId} for update`;
    if (!p) throw new Refused("No such approval", "not_found");
    if (p.status !== "waiting") throw new Refused("This has already been decided.", "conflict");
    const may = canDecide(actor.role, actor.id, { proposedBy: p.proposed_by, editedBy: p.edited_by });
    if (!may.ok) throw new Refused(may.why!, "forbidden");
    await tx`update approvals set status = ${decision}, decided_by = ${actor.id}, decided_at = now(), reason = ${reason.trim()} where id = ${approvalId}`;
    const ok = decision === "approved";
    if (p.subject === "kpi_set") {
      if (ok) {
        const codes = await tx<{ code: string }[]>`select code from kpis where application_id = ${p.application_id} and status = 'waiting'`;
        await tx`update kpis set status = 'retired' where application_id = ${p.application_id} and status = 'approved' and code in ${tx(codes.map((c) => c.code).concat("__none__"))}`;
        await tx`update kpis set status = 'approved', approved_at = now(), approved_by = ${actor.id} where application_id = ${p.application_id} and status = 'waiting'`;
      } else await tx`update kpis set status = 'draft' where application_id = ${p.application_id} and status = 'waiting'`;
    }
    if (p.subject === "baseline" && p.subject_id) {
      if (ok) {
        await tx`update baselines set status = 'retired' where application_id = ${p.application_id} and status = 'approved'`;
        await tx`update baselines set status = 'approved', approved_at = now(), approved_by = ${actor.id} where id = ${p.subject_id}`;
      } else await tx`update baselines set status = 'draft' where id = ${p.subject_id}`;
    }
    let hash: string | null = null;
    if (p.subject === "report" && p.subject_id) {
      if (ok) hash = await freezeReport(tx, p.subject_id, actor.id);
      else await tx`update reports set status = 'draft' where id = ${p.subject_id}`;
    }
    if (ok && p.subject !== "report" && (await approvedSetup(tx, p.application_id))) await tx`update applications set stage = 'collecting' where id = ${p.application_id} and stage in ('set_up', 'waiting')`;
    if (!ok && p.subject !== "report") await tx`update applications set stage = 'set_up' where id = ${p.application_id} and stage = 'waiting'`;
    await audit(tx, { actor, org: p.organisation_id, action: ({ approved: "Approved", changes: "Asked for changes to", declined: "Declined" })[decision], subject: p.title, reason, after: hash ? { sha256: hash } : undefined });
    return { hash };
  }, actor.id);
}
