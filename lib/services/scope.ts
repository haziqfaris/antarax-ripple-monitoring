import { inScope, type Tx } from "../db";
import { Refused } from "./actor";

/** Find which organisation an application belongs to, then work inside that organisation's scope only. */
export async function orgOfApp(appId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/.test(appId)) throw new Refused("No such application", "not_found");
  const row = await inScope("all", async (tx) => (await tx<{ organisation_id: string }[]>`select organisation_id from applications where id = ${appId}`)[0]);
  if (!row) throw new Refused("No such application", "not_found");
  return row.organisation_id;
}

export async function inAppScope<T>(appId: string, fn: (tx: Tx, orgId: string) => Promise<T>, actorId?: string): Promise<T> {
  const org = await orgOfApp(appId);
  return inScope({ org }, (tx) => fn(tx, org), actorId);
}
