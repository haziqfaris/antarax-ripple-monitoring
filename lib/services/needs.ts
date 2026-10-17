// What needs a person (AXLE §2.1, attention first), worst first. Read in the scope it is asked for.
import { inScope } from "../db";
import { localDay, monthLabel, monthStart, prevMonth } from "../../domain/format";

export interface Need { tone: "fault" | "warn" | "info"; title: string; detail: string; href: string; action: string; org: string }

export async function needsAPerson(orgId?: string | null, now = Date.now()): Promise<Need[]> {
  const lastMonth = prevMonth(monthStart(localDay(now)));
  return inScope(orgId ? { org: orgId } : "all", async (tx) => {
    const out: Need[] = [];
    for (const r of await tx<{ id: string; name: string; org: string; state: string; state_why: string | null }[]>`
      select a.id, a.name, o.short_name as org, i.state, i.state_why from applications a join integrations i on i.application_id = a.id join organisations o on o.id = a.organisation_id
      where a.stage in ('waiting', 'collecting') and i.state in ('late', 'not_answering')`)
      out.push({ tone: r.state === "not_answering" ? "fault" : "warn", title: `${r.name} ${r.state === "not_answering" ? "isn't answering" : "is late"}`, detail: `${r.org} · ${r.state_why ?? ""}`, href: `/applications/${r.id}`, action: "Open", org: r.org });
    for (const r of await tx<{ n: number; org: string; oid: string }[]>`select count(*)::int as n, o.short_name as org, o.id as oid from approvals p join organisations o on o.id = p.organisation_id where p.status = 'waiting' group by o.short_name, o.id`)
      out.push({ tone: "warn", title: `${r.n} waiting for approval`, detail: r.org, href: `/approvals?org=${r.oid}`, action: "Review", org: r.org });
    for (const r of await tx<{ id: string; name: string; org: string; n: number }[]>`select a.id, a.name, o.short_name as org, count(*)::int as n from metrics m join applications a on a.id = m.application_id join organisations o on o.id = a.organisation_id where m.state = 'held' group by a.id, a.name, o.short_name`)
      out.push({ tone: "info", title: `${r.name} shares ${r.n} new or changed figure${r.n === 1 ? "" : "s"}`, detail: `${r.org} · held until an operator decides`, href: `/applications/${r.id}#figures`, action: "Decide", org: r.org });
    for (const r of await tx<{ id: string; name: string; org: string }[]>`
      select a.id, a.name, o.short_name as org from applications a join organisations o on o.id = a.organisation_id
      where a.stage = 'collecting' and a.created_at < ${lastMonth}::date + interval '1 month'
        and not exists (select 1 from reports r where r.application_id = a.id and r.month = ${lastMonth})`)
      out.push({ tone: "info", title: `${monthLabel(lastMonth)} report for ${r.name} not drafted`, detail: r.org, href: `/applications/${r.id}#reports`, action: "Draft", org: r.org });
    for (const r of await tx<{ id: string; name: string; org: string }[]>`select a.id, a.name, o.short_name as org from applications a join organisations o on o.id = a.organisation_id where a.stage = 'set_up' and a.created_at < now() - interval '7 days'`)
      out.push({ tone: "info", title: `${r.name} still being set up`, detail: `${r.org} · started over a week ago`, href: `/applications/${r.id}`, action: "Resume", org: r.org });
    const rank = { fault: 0, warn: 1, info: 2 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  });
}
