// Three roles for version 1 (V-08). Each includes the rights of the one before it.
export const ROLES = ["viewer", "operator", "approver"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { viewer: "Viewer", operator: "Operator", approver: "Approver" };
export const ROLE_DOES: Record<Role, string> = {
  viewer: "Reads every page",
  operator: "Connects applications, proposes KPIs and baselines, drafts reports",
  approver: "Everything an operator does, and approves what someone else proposed",
};

export const atLeast = (role: Role, needed: Role): boolean => ROLES.indexOf(role) >= ROLES.indexOf(needed);

/** Separation of duties (V-09): whoever proposed or last edited an item cannot approve it. */
export function canDecide(role: Role, staffId: string, item: { proposedBy: string; editedBy?: string | null }): { ok: boolean; why?: string } {
  if (!atLeast(role, "approver")) return { ok: false, why: "Needs the approver role" };
  if (item.proposedBy === staffId || item.editedBy === staffId) return { ok: false, why: "You proposed or edited this, so someone else approves it" };
  return { ok: true };
}
