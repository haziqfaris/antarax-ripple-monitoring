import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { freshDb } from "./helpers";
import { inScope, sql } from "@/lib/db";

let db: Awaited<ReturnType<typeof freshDb>>;
let a: string, b: string;

beforeAll(async () => {
  db = await freshDb();
  const owner = postgres(db.ownerUrl, { max: 1 });
  [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
  for (const [id, n] of [[a, "Alpha"], [b, "Beta"]] as const) {
    await owner`insert into organisations (id, name, short_name, agreement_confirmed_at) values (${id}, ${n}, ${n}, now())`;
    await owner`insert into applications (organisation_id, name, project_name) values (${id}, ${n + " app"}, ${n + " project"})`;
  }
  await owner`insert into audit (actor_label, organisation_id, action) values ('test', ${a}, 'seeded')`;
  await owner.end();
});
afterAll(async () => db.drop());

describe("separation between organisations (V-06)", () => {
  it("shows nothing without a scope", async () => {
    const rows = await sql()`select count(*)::int as n from applications`;
    expect(rows[0]!.n).toBe(0);
  });
  it("shows one organisation's rows only in its scope", async () => {
    const names = await inScope({ org: a }, (tx) => tx<{ name: string }[]>`select name from applications`);
    expect(names.map((r) => r.name)).toEqual(["Alpha app"]);
    const orgs = await inScope({ org: a }, (tx) => tx`select id from organisations`);
    expect(orgs).toHaveLength(1);
  });
  it("can't write into another organisation from a scope", async () => {
    await expect(inScope({ org: a }, (tx) => tx`insert into applications (organisation_id, name, project_name) values (${b}, 'Sneaky', 'x')`)).rejects.toThrow(/row-level security/);
    await expect(inScope({ org: a }, (tx) => tx`update applications set name = 'Renamed' where organisation_id = ${b}`)).resolves.toHaveLength(0);
  });
  it("lists every organisation only when asked for all", async () => {
    expect(await inScope("all", (tx) => tx`select id from organisations`)).toHaveLength(2);
  });
  it("refuses a scope that isn't an organisation id", async () => {
    await expect(inScope({ org: "all' or 1=1" }, async () => 1)).rejects.toThrow(/organisation id/);
  });
});

describe("the audit (V-07)", () => {
  it("can be added to but never changed or deleted", async () => {
    await expect(inScope({ org: a }, (tx) => tx`update audit set action = 'changed'`)).rejects.toThrow();
    await expect(inScope({ org: a }, (tx) => tx`delete from audit`)).rejects.toThrow();
    const owner = postgres(db.ownerUrl, { max: 1 });
    await expect(owner`update audit set action = 'changed'`).rejects.toThrow(/append-only/);
    await owner.end();
  });
  it("shows an organisation's entries only in its scope", async () => {
    expect(await inScope({ org: b }, (tx) => tx`select id from audit`)).toHaveLength(0);
    expect(await inScope({ org: a }, (tx) => tx`select id from audit`)).toHaveLength(1);
  });
});
