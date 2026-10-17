import { inScope } from "../db";
import { audit } from "../audit";
import { need, Refused, type StaffActor } from "./actor";

export interface OrganisationRow { id: string; name: string; short_name: string; industry: string; time_zone: string; agreement_confirmed_at: Date | null; created_at: Date }

export async function listOrganisations() {
  return inScope("all", (tx) => tx<(OrganisationRow & { apps: number; collecting: number; waiting: number })[]>`
    select o.*, (select count(*)::int from applications a where a.organisation_id = o.id) as apps,
      (select count(*)::int from applications a where a.organisation_id = o.id and a.stage = 'collecting') as collecting,
      (select count(*)::int from approvals p where p.organisation_id = o.id and p.status = 'waiting') as waiting
    from organisations o order by o.name`);
}

export async function getOrganisation(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Refused("No such organisation", "not_found");
  const row = await inScope({ org: id }, async (tx) => (await tx<OrganisationRow[]>`select * from organisations where id = ${id}`)[0]);
  if (!row) throw new Refused("No such organisation", "not_found");
  return row;
}

/** Nothing is collected for an organisation until its data agreement is confirmed (PRD §14). */
export async function createOrganisation(actor: StaffActor, input: { name: string; short: string; industry: string; timeZone: string; agreement: boolean }) {
  need(actor, "operator");
  if (!input.agreement) throw new Refused("Confirm the data agreement is signed. Nothing is collected before it.");
  const id = crypto.randomUUID();
  return inScope({ org: id }, async (tx) => {
    await tx`insert into organisations (id, name, short_name, industry, time_zone, agreement_confirmed_at, agreement_confirmed_by, created_by)
      values (${id}, ${input.name.trim()}, ${(input.short || input.name).trim().slice(0, 60)}, ${input.industry.trim() || "Other"}, ${input.timeZone}, now(), ${actor.id}, ${actor.id})`;
    await audit(tx, { actor, org: id, action: "Added an organisation, data agreement confirmed", subject: input.name });
    return id;
  }, actor.id);
}
