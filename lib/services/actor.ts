import type { Role } from "../auth/roles";
import { atLeast } from "../auth/roles";

export interface StaffActor { id: string; label: string; role: Role; email: string }

export class Refused extends Error {
  constructor(message: string, public readonly code: "forbidden" | "invalid" | "not_found" | "conflict" = "invalid") { super(message); }
}

export function need(actor: StaffActor, role: Role): void {
  if (!atLeast(actor.role, role)) throw new Refused(`Needs the ${role} role`, "forbidden");
}
