import type { Tx } from "./db";

export interface Actor { id: string | null; label: string }
export const SYSTEM: Actor = { id: null, label: "Collector" };

/** Append to the audit (V-07): who, what, when, why, before and after. The table refuses updates and deletes. */
export async function audit(tx: Tx, a: { actor: Actor; org: string | null; action: string; subject?: string; reason?: string | null; before?: unknown; after?: unknown }): Promise<void> {
  await tx`insert into audit (actor_id, actor_label, organisation_id, action, subject, reason, before, after)
    values (${a.actor.id}, ${a.actor.label}, ${a.org}, ${a.action}, ${a.subject ?? ""}, ${a.reason ?? null},
      ${a.before === undefined ? null : tx.json(a.before as never)}, ${a.after === undefined ? null : tx.json(a.after as never)})`;
}
