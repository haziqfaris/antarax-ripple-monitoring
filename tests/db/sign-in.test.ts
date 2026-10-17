// Sign-in by e-mailed link, then the two-step code: a link works once, for 15 minutes, only for an active account,
// and is kept as a hash. A link alone never makes a signed-in person.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { freshDb } from "./helpers";
import { addStaff, requestLink, linkFor, redeemLink, actorFor, pendingFor, completeTwoStep, proposeSecret } from "@/lib/services/staff";
import { totpAt } from "@/lib/auth/totp";

let db: Awaited<ReturnType<typeof freshDb>>;
let owner: postgres.Sql;

beforeAll(async () => {
  db = await freshDb();
  owner = postgres(db.ownerUrl, { max: 1, onnotice: () => {} });
  await addStaff("Nurul@reka.example", "Nurul Aina", "operator");
  await addStaff("gone@reka.example", "Left Already", "viewer");
  await owner`update staff set disabled_at = now() where email = 'gone@reka.example'`;
});
afterAll(async () => { await owner.end(); await db.drop(); });

describe("sign-in links", () => {
  it("gives a link only to an active staff member", async () => {
    expect(await requestLink("stranger@reka.example")).toBeNull();
    expect(await requestLink("gone@reka.example")).toBeNull();
    expect(await requestLink("not an address")).toBeNull();
    const l = await requestLink("  NURUL@reka.example ");
    expect(l?.email).toBe("nurul@reka.example");
    expect(l?.token).toMatch(/^[A-Za-z0-9]{40}$/);
  });

  it("keeps only the link's hash", async () => {
    const l = (await requestLink("nurul@reka.example"))!;
    const rows = await owner<{ token_hash: string }[]>`select token_hash from sign_in_links`;
    expect(rows.some((r) => r.token_hash.includes(l.token))).toBe(false);
  });

  it("can be looked at without being used, then works once", async () => {
    const l = (await requestLink("nurul@reka.example"))!;
    expect(await linkFor(l.token)).toEqual({ email: "nurul@reka.example" });
    expect(await linkFor(l.token)).toEqual({ email: "nurul@reka.example" });
    const r = await redeemLink(l.token);
    expect("token" in r && r.needsSetup).toBe(true);
    expect(await redeemLink(l.token)).toEqual({ error: expect.stringMatching(/expired or has already been used/) });
    expect(await linkFor(l.token)).toBeNull();
  });

  it("refuses an expired link, a made-up one, and one for an account disabled since", async () => {
    const old = (await requestLink("nurul@reka.example"))!;
    await owner`update sign_in_links set expires_at = now() - interval '1 second' where used_at is null`;
    expect("error" in (await redeemLink(old.token))).toBe(true);
    expect("error" in (await redeemLink("A".repeat(40)))).toBe(true);
    expect("error" in (await redeemLink(""))).toBe(true);

    await addStaff("soon@reka.example", "Soon Gone", "viewer");
    const l = (await requestLink("soon@reka.example"))!;
    await owner`update staff set disabled_at = now() where email = 'soon@reka.example'`;
    expect(await linkFor(l.token)).toBeNull();
    expect("error" in (await redeemLink(l.token))).toBe(true);
  });

  it("signs in only once the two-step code is done", async () => {
    const r = await redeemLink((await requestLink("nurul@reka.example"))!.token);
    if (!("token" in r)) throw new Error(r.error);
    expect(await actorFor(r.token)).toBeNull();
    expect(await pendingFor(r.token)).toEqual({ email: "nurul@reka.example", hasSecret: false });
    const secret = proposeSecret();
    expect(await completeTwoStep(r.token, "000000", secret)).toEqual({ error: expect.any(String) });
    expect(await completeTwoStep(r.token, await totpAt(secret, Math.floor(Date.now() / 1000)), secret)).toEqual({ ok: true });
    expect((await actorFor(r.token))?.role).toBe("operator");

    // The next sign-in uses the saved secret: no setup again.
    const again = await redeemLink((await requestLink("nurul@reka.example"))!.token);
    expect("token" in again && again.needsSetup).toBe(false);
  });
});
