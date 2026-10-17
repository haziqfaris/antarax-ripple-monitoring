import "server-only";
import { listOrganisations } from "./services/organisations";
import type { Option } from "../app/_components/controls";

/** The organisation scope from the address, checked against real organisations. */
export async function orgScope(raw: string | undefined): Promise<{ options: Option[]; org: { id: string; short_name: string; name: string } | null }> {
  const orgs = await listOrganisations();
  const org = raw ? orgs.find((o) => o.id === raw) ?? null : null;
  return { options: orgs.map((o) => ({ id: o.id, label: o.short_name })), org };
}
