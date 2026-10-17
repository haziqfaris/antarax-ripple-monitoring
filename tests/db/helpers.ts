// Each test file gets its own database, migrated as the owner; the code under test connects as outcomes_web,
// a member of outcomes_app, so row-level security applies exactly as in production.
import postgres from "postgres";
import { migrate } from "@/db/migrate";
import { closeDb } from "@/lib/db";
import { resetEnv } from "@/lib/env";
import { resetSeal } from "@/lib/seal";

const ADMIN = process.env.TEST_ADMIN_URL ?? "postgres://outcomes_owner@localhost:54329/postgres";
const WEB_USER = process.env.TEST_WEB_USER ?? "outcomes_web:local-only";

export async function freshDb(): Promise<{ name: string; ownerUrl: string; drop: () => Promise<void> }> {
  const name = `outcomes_test_${Math.random().toString(36).slice(2, 10)}`;
  const admin = postgres(ADMIN, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const u = new URL(ADMIN); u.pathname = `/${name}`;
  const ownerUrl = u.toString();
  await migrate(ownerUrl, () => {});
  const owner = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  const [user, pass] = WEB_USER.split(":");
  await owner.unsafe(`do $$ begin if not exists (select 1 from pg_roles where rolname = '${user}') then create role ${user} login password '${pass}' in role outcomes_app; end if; end $$`);
  await owner.end();
  const web = new URL(ownerUrl); web.username = user!; web.password = pass!;
  Object.assign(process.env, {
    DATABASE_URL: web.toString(), SEAL_KEY: Buffer.alloc(32, 7).toString("base64"), CRON_SECRET: "x".repeat(32),
    APP_URL: "http://localhost:3200", ALERT_TO: "ops@reka.example",
  });
  resetEnv(); resetSeal(); await closeDb();
  return {
    name, ownerUrl,
    drop: async () => { await closeDb(); await admin.unsafe(`drop database if exists ${name} with (force)`); await admin.end(); },
  };
}
