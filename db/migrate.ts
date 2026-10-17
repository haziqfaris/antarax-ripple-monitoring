// Applies db/migrations/*.sql in order, once each, as the database owner (MIGRATE_DATABASE_URL, else DATABASE_URL).
// The console itself never connects as the owner: see lib/db.ts.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import postgres from "postgres";

export async function migrate(url: string, log: (line: string) => void = console.log): Promise<string[]> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const text = await readFile(join(dir, f), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into schema_migrations (name) values (${f})`;
      });
      applied.push(f);
      log(`applied ${f}`);
    }
    if (!applied.length) log("nothing to apply");
    return applied;
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) { console.error("Set MIGRATE_DATABASE_URL (the owner) or DATABASE_URL."); process.exit(1); }
  migrate(url).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
