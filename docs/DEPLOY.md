# Deploying AXLE · Outcomes (version 1)

How to put the console on Vercel with its database on Supabase (V-02). Each step needs an account or a decision this repository can't hold. Allow about an hour the first time.

## 0 Before you start

- **A Vercel Pro team.** The health check runs hourly, and Hobby allows scheduled jobs at most once a day; a Hobby deployment with `vercel.json` as it is fails. Hobby is also for non-commercial use.
- **A Supabase organisation on Pro.** The free plan has no daily backups and pauses quiet projects.
- **On your machine:** Node 22, this repository with `npm ci` run, `openssl`, and `psql` and `pg_dump` of the same major version as the Supabase project (step 9).
- **A password manager** for the secrets below. Never paste them into chat, an issue or a commit.
- **The code on the branch Vercel deploys.** Version 1 is on `claude/practical-thompson-qsu01b`; merge it to `main` first, or point Vercel's production branch at it.

## 1 Create the Supabase project

1. New project, region **Southeast Asia (Singapore)** (PRD §14, D5). Use a long generated database password and keep it: it is the owner's password.
2. **Turn the Data API off** (Project Settings, Data API). The console never uses it, and its public `anon` key must reach nothing. Migration 0002 also revokes everything from `anon` and `authenticated`, so this is the second lock, not the only one.
3. **Enforce SSL** (Database settings, SSL configuration).

## 2 Run the migrations as the owner

1. Open **Connect** and copy the **Session pooler** string (port 5432). Not the transaction pooler (6543): the console runs each page in one transaction with its scope set. Not the direct connection: it is IPv6 only and Vercel can't reach it.
2. Put the owner's password in it and add `?sslmode=require` at the end:
   ```sh
   export MIGRATE_DATABASE_URL='postgresql://postgres.<project-ref>:<owner password>@<pooler host>:5432/postgres?sslmode=require'
   npm run db:migrate
   ```
   You should see `applied 0001_init.sql` and `applied 0002_close_data_api.sql`. Running it again prints `nothing to apply`.

## 3 Create the console's own login

The console must not connect as `postgres`, which bypasses row-level security; it refuses to start if it does (`lib/db.ts`).

1. Make a password with letters and digits only, so it needs no escaping in a URL: `openssl rand -hex 24`.
2. In the SQL editor:
   ```sql
   create role outcomes_web login password '<that password>' in role outcomes_app;
   select rolsuper, rolbypassrls from pg_roles where rolname = 'outcomes_web';  -- both false
   ```
3. Its connection string is the session pooler string with the user changed to `outcomes_web.<project-ref>`:
   ```sh
   export DATABASE_URL='postgresql://outcomes_web.<project-ref>:<that password>@<pooler host>:5432/postgres?sslmode=require'
   psql "$DATABASE_URL" -c 'select current_user'   # outcomes_web
   ```
   "Tenant or user not found" means the `.<project-ref>` part is missing.

## 4 Create the Vercel project

1. **Add New, Project**, import `haziqfaris/antarax-ripple-monitoring`. Vercel detects Next.js; leave the build settings alone. Node 22 comes from `package.json`.
2. Before the first deploy, add these variables for **Production only**. Leave Preview and Development empty, so a preview deployment can never reach the production database.

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `outcomes_web`'s string from step 3 |
   | `SEAL_KEY` | `openssl rand -base64 32`. Seals measurement keys and two-step secrets. **Keep a copy in the password manager**: losing it means re-issuing every key and every two-step setup |
   | `CRON_SECRET` | `openssl rand -hex 24`. Vercel sends it to the scheduled jobs |
   | `APP_URL` | The console's public address, for example `https://outcomes.reka.re`. Use the `.vercel.app` address until the domain is set |
   | `ALERT_TO` | Who is e-mailed when a link stops answering, comma separated |
   | `RESEND_API_KEY`, `MAIL_FROM` | Optional, step 8. Without them e-mail waits in the outbox on the Jobs page |

   **Never** set `ALLOW_LOCAL_HTTP_LINKS` or `ALLOW_OWNER_CONNECTION`: they exist for tests and scripts.
3. **Deploy.** `vercel.json` puts the functions in `sin1`, next to the database, and registers the two jobs: collection at 22:00 UTC (06:00 MYT) and the health check at quarter past every hour.
4. **Deployment Protection:** keep Vercel Authentication on for previews.

A change to a variable only takes effect after a redeploy.

## 5 The domain

Add the domain under **Settings, Domains**, set the DNS record Vercel shows, then change `APP_URL` to it and redeploy. Developer links and e-mails use `APP_URL`.

## 6 Add the first people

Staff are added from your machine, through `outcomes_web` like the console:

```sh
vercel link
vercel env pull .env.production.local --environment=production
set -a; . ./.env.production.local; set +a
STAFF_PASSWORD='<at least 12 characters>' npm run staff:add -- --email you@reka.re --name "Your Name" --role operator
rm .env.production.local
```

Add at least **two approvers** as well: whoever proposed or edited a baseline or report can't approve it. Give each person their password by a separate channel. They set up two-step with an authenticator app at first sign-in.

## 7 Check it works

1. Sign in, set up two-step, and open every page in the menu, including on a phone.
2. **Settings, Cron Jobs:** run the health check by hand, then look at the Jobs page for the run.
3. Confirm a job refuses a stranger. This should print `404`:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' https://<your domain>/api/cron/health
   ```
4. **Logs:** no `Environment:` or `DATABASE_URL connects as a role that bypasses` errors.

## 8 E-mail (optional)

In Resend, verify the sending domain and make an API key that can only send. Set `RESEND_API_KEY` and `MAIL_FROM` (for example `Outcomes <outcomes@reka.re>`, on the verified domain), and redeploy. Anything already in the outbox goes on the next scheduled run; the Jobs page shows each message as sent or with its error.

## 9 Backups

- Supabase Pro keeps daily backups. They are a second copy, not the only one.
- `npm run backup` writes a `pg_dump` in custom format using `MIGRATE_DATABASE_URL`. Run it daily from a scheduled job on a machine you control, copy it to R2, and keep 35 days. `pg_dump` must be the same major version as the server, or newer: check with `select version()`.
- Do the restore drill in `scripts/backup.sh` once a quarter, into a scratch database, never into production.

## 10 Before the first pilot (the plan's section 2)

- **D9:** name the two pilot applications.
- **D3, D4:** sign off the Measurement Link (antarax-api decision 0013) and make the `ax_msr_` key kind active in the registry.
- **D1:** confirm the product id `outcomes` (registry entry on antarax-api's `claude/practical-thompson-qsu01b`).

## When something goes wrong

| What you see | Why |
|---|---|
| The deploy fails on a cron schedule | The project is on Hobby; move it to the Pro team |
| `Environment: …` in the logs | A variable is missing or malformed; the message names it. Redeploy after fixing |
| `DATABASE_URL connects as a role that bypasses row-level security` | `DATABASE_URL` uses `postgres`; use `outcomes_web.<project-ref>` |
| `Tenant or user not found` | The user in the string lacks `.<project-ref>` |
| `prepared statement … does not exist` or a scope that seems lost | The string uses the transaction pooler (6543); use the session pooler (5432) |
| Scheduled jobs return 404 | `CRON_SECRET` was added or changed without a redeploy |
| Everyone's two-step and keys stop working | `SEAL_KEY` changed. Put the old value back |
