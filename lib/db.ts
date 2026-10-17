import postgres, { type Sql, type TransactionSql } from "postgres";
import { env } from "./env";

/**
 * Every read and write runs inside a scope (V-06). The database shows a transaction nothing until it says
 * which organisation it is working for, or 'all' for pages that list every organisation. A query that
 * forgets a filter can therefore never read another organisation's figures.
 */
export type Scope = "all" | { org: string };
export type Tx = TransactionSql<Record<string, never>>;

let client: Sql | null = null;
let checked = false;

export function sql(): Sql {
  if (!client) {
    client = postgres(env().DATABASE_URL, {
      max: Number(process.env.DB_POOL ?? 5),
      prepare: false,
      onnotice: () => {},
      types: {
        numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
        date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
      },
    });
  }
  return client;
}

/** Refuse to run as a role that skips row-level security (the owner, a superuser). */
async function checkRole(): Promise<void> {
  if (checked) return;
  const [r] = await sql()<{ bypass: boolean }[]>`select (rolsuper or rolbypassrls) as bypass from pg_roles where rolname = current_user`;
  if (r?.bypass && process.env.ALLOW_OWNER_CONNECTION !== "1") throw new Error("DATABASE_URL connects as a role that bypasses row-level security. Use a member of outcomes_app.");
  checked = true;
}

export async function inScope<T>(scope: Scope, fn: (tx: Tx) => Promise<T>, actorId?: string): Promise<T> {
  await checkRole();
  const value = scope === "all" ? "all" : scope.org;
  if (scope !== "all" && !/^[0-9a-f-]{36}$/.test(value)) throw new Error("A scope must be an organisation id.");
  return sql().begin(async (tx) => {
    await tx`select set_config('outcomes.scope', ${value}, true)`;
    if (actorId) await tx`select set_config('outcomes.actor', ${actorId}, true)`;
    return fn(tx as unknown as Tx);
  }) as Promise<T>;
}

/** Tables that hold no organisation's data (staff, sessions, rate limits). */
export async function plain<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await checkRole();
  return sql().begin(async (tx) => fn(tx as unknown as Tx)) as Promise<T>;
}

export async function closeDb(): Promise<void> {
  if (client) { await client.end({ timeout: 5 }); client = null; checked = false; }
}
