# Deploying AXLE · Outcomes (version 1)

What has to happen outside this repository to run it (V-02). Everything here needs accounts or decisions this repository can't hold.

## 1 The database (Supabase, Singapore)

1. Create a Supabase project in **Singapore** (PRD §14, D5).
2. Run the migrations as the owner: `MIGRATE_DATABASE_URL=<the postgres connection string> npm run db:migrate`.
3. Create the console's own login, a member of `outcomes_app`, which can't bypass row-level security:
   ```sql
   create role outcomes_web login password '<a long random password>' in role outcomes_app;
   ```
   The console refuses to start on a role that bypasses row-level security (`lib/db.ts`).
4. Use the **session** pooler (or a direct connection) for `DATABASE_URL`; the console sets its scope per transaction.

## 2 The console (Vercel, `sin1`)

`vercel.json` sets the region and the two scheduled jobs: nightly collection at 22:00 UTC (06:00 MYT) and the health check at quarter past every hour.

| Variable | What |
|---|---|
| `DATABASE_URL` | `outcomes_web`'s connection string |
| `SEAL_KEY` | 32 random bytes, base64 (`openssl rand -base64 32`). Seals measurement keys and two-step secrets. Losing it means re-issuing every key and two-step setup |
| `CRON_SECRET` | At least 24 random characters; Vercel Cron sends it |
| `APP_URL` | The console's public address, for the developer link and e-mails |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional: without them, e-mail stays in the outbox (Jobs page) |
| `ALERT_TO` | Who gets "a link stopped answering", comma separated |

Never set `ALLOW_LOCAL_HTTP_LINKS` or `ALLOW_OWNER_CONNECTION` in a deployment: they exist for tests.

## 3 People

Add staff from a machine with the owner's connection: `STAFF_PASSWORD=… npm run staff:add -- --email … --name … --role viewer|operator|approver`. Each sets up two-step at first sign-in. Approving needs two approvers in practice: whoever proposed or edited an item can't approve it.

## 4 Backups

`npm run backup` writes a `pg_dump` (custom format). Run it daily from a scheduled job, copy it to R2, keep 35 days, and do the restore drill in the script's header once a quarter. Supabase's own daily backups are a second copy, not a replacement.

## 5 Before the first pilot (from the plan's section 2)

- **D9:** name the two pilot applications.
- **D3, D4:** sign off the Measurement Link (antarax-api decision 0013) and make the `ax_msr_` key kind active in the registry.
- **D1:** confirm the product id `outcomes` (registry entry added on antarax-api's `claude/practical-thompson-qsu01b`).
