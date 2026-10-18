# Deploying AXLE · Outcomes (version 1)

How to put the console on Vercel with its database on Supabase (V-02). The console is named **Gauge** (Ripple Gauge in full; owner, 18 Oct 2026) and will live at `https://gauge.antarax.ai`; the screens still say AXLE · Outcomes until they are renamed. Each step needs an account or a decision this repository can't hold. Allow about an hour the first time.

## 0 Before you start

- **A Vercel Pro team.** The health check runs hourly, and Hobby allows scheduled jobs at most once a day; a Hobby deployment with `vercel.json` as it is fails. Hobby is also for non-commercial use.
- **A Supabase organisation on Pro.** The free plan has no daily backups and pauses quiet projects.
- **A service key for AntaraX email** (`ax_svc_gauge_…`), one for staging and one for production, from whoever runs the service (step 4). Sign-in is by e-mailed link, so without e-mail nobody can sign in. Until the key arrives, the AntaraX Resend account is the fallback.
- **On your machine:** Node 22, this repository with `npm ci` run, `openssl`, and `psql` and `pg_dump` of the same major version as the Supabase project (step 9).
- **A password manager** for the secrets below. Never paste them into chat, an issue or a commit.
- **The code on the branch Vercel deploys**, normally `main`, and `main` set as the repository's default branch on GitHub.

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
   You should see `applied` for `0001_init.sql`, `0002_close_data_api.sql` and `0003_sign_in_links.sql`. Running it again prints `nothing to apply`.

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

## 4 Set up e-mail

Gauge sends its e-mail through **AntaraX email** (antarax-api `docs/15-email.md`), the one service every AntaraX product uses. It sends as `Gauge <gauge@mail.antarax.ai>`, replies go to `support@go.antarax.ai`, and the service draws every e-mail from its own approved templates: the console sends a template id and its values, never a From, a subject or HTML. The sender `gauge` is registered there with the origin `https://gauge.antarax.ai`, so every link in an e-mail must be on that host: `APP_URL` (step 5) is where the links come from.

| E-mail | When | Template |
|---|---|---|
| Sign-in link | Someone asks for one on the sign-in page. Sent at once, never through the outbox | `auth.sign_in.v1` (a security e-mail: an opt-out never stops it) |
| A link is late or not answering | The scheduled jobs see an application's link change state; it waits in the outbox and leaves on the next run | `system.action_required.v1`, with an "Open Jobs" button |

There is no e-mailed code: the second step is the code in the person's authenticator app. Approvals and reports send no e-mail today.

**The switch.** With `ANTARAX_EMAIL_URL` and `AX_SVC_KEY` both set to real values, every e-mail goes through the service. With either one empty or a placeholder, the console sends through Resend as before (below). Each e-mail carries an idempotency key (`sign-in:` and a hash of the link; `outbox:` and the row id), so sending again never sends twice; an alert the service could not take stays in the outbox and goes on the next run with the same key.

1. **Staging first.** Ask the service's owner for Gauge's **staging** key and set it on a staging deployment, with its own database (never the production one, and never on Production at this point):

   | Variable | Value |
   |---|---|
   | `ANTARAX_EMAIL_URL` | `https://email-staging.antarax.ai` (it delivers only to the team's addresses) |
   | `AX_SVC_KEY` | Gauge's staging key, `ax_svc_gauge_` and 32 letters and digits. A secret: keep it in the password manager, never in chat, an issue or a commit |

   The staging host must be on the staging service's allowed origins (`EXTRA_ORIGINS`, set by the service's owner) and `APP_URL` must be that host. Ask for a sign-in link with a team address and set off an alert (step 8); both should arrive from Gauge, and AXLE's Watch, Email shows them.
2. **Then production.** Set, for **Production only**: `ANTARAX_EMAIL_URL` = `https://email.antarax.ai` and `AX_SVC_KEY` = Gauge's production key. `APP_URL` must be `https://gauge.antarax.ai`, or the service refuses every link. Redeploy.
3. **Keep Resend as the fallback** until a week has passed with nothing sent on it, then remove `RESEND_API_KEY` and `MAIL_FROM`. Turning the switch off (removing either AntaraX variable and redeploying) brings Resend back at once.

**The fallback: Resend.** Product e-mail from the console's own sending comes from `antarax.ai` through the AntaraX Resend account (brand kit 13 §2), where that domain is already verified. Make an API key with **sending access** only. Set `MAIL_FROM` to `AXLE · Outcomes <outcomes@antarax.ai>`. Replies go to `support@go.antarax.ai` (`MAIL_REPLY_TO`, the default), because `antarax.ai` doesn't receive mail. Its sign-in e-mail uses the shared product template in AXLE's look (`lib/mail/sign-in-mail.ts`); its colours come from `app/axle-tokens.css`: after syncing tokens from the brand kit, run `npm run mail:colours`.

Sign-in links are sent at once and never kept in the outbox; alerts go through the outbox and leave on the next scheduled run. The console refuses to start in production without either the switch on or `RESEND_API_KEY`.

`lib/mail/antarax-email.ts` is a verbatim copy of antarax-api's `packages/lapisan-email/src/client.ts`. Never edit it here: change it there and copy it again.

## 5 Create the Vercel project

1. **Add New, Project**, import `haziqfaris/antarax-ripple-monitoring`. Vercel detects Next.js; leave the build settings alone. It runs `vercel-build` from `package.json`: the typecheck and unit tests, then the build, so a failing test stops the deployment. Node 22 comes from `package.json`. There is no GitHub Actions: run `npm run check` and `bash scripts/e2e.sh` before pushing.
2. Before the first deploy, add these variables for **Production only**. Leave Preview and Development empty, so a preview deployment can never reach the production database.

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `outcomes_web`'s string from step 3 |
   | `SEAL_KEY` | `openssl rand -base64 32`. Seals measurement keys and two-step secrets. **Keep a copy in the password manager**: losing it means re-issuing every key and every two-step setup |
   | `CRON_SECRET` | `openssl rand -hex 24`. Vercel sends it to the scheduled jobs |
   | `APP_URL` | The console's public address: `https://gauge.antarax.ai`. Use the `.vercel.app` address until the domain is set (AntaraX email refuses links on any other host, so leave its switch off until then) |
   | `ALERT_TO` | Who is e-mailed when a link stops answering, comma separated |
   | `ANTARAX_EMAIL_URL`, `AX_SVC_KEY` | From step 4, once staging has worked. Needed, or the Resend pair below: sign-in links go by e-mail |
   | `RESEND_API_KEY`, `MAIL_FROM` | The fallback from step 4, until a week passes with nothing sent on it. `MAIL_REPLY_TO` defaults to support |

   **Never** set `ALLOW_LOCAL_HTTP_LINKS`, `ALLOW_OWNER_CONNECTION` or `MAIL_CAPTURE_FILE`: they exist for tests and scripts. `MAIL_CAPTURE_FILE` would write sign-in links to a file instead of sending them.
3. **Deploy.** `vercel.json` puts the functions in `sin1`, next to the database, and registers the two jobs: collection at 22:00 UTC (06:00 MYT) and the health check at quarter past every hour.
4. **Deployment Protection:** keep Vercel Authentication on for previews.

A change to a variable only takes effect after a redeploy.

## 6 The domain

The planned address is `gauge.antarax.ai`. Add it under **Settings, Domains**, set the DNS record Vercel shows, then change `APP_URL` to it and redeploy. Sign-in links, developer links and e-mails use `APP_URL`, so a wrong value sends people to the wrong address.

## 7 Add the first people

Staff are added from your machine, through `outcomes_web` like the console:

```sh
vercel link
vercel env pull .env.production.local --environment=production
set -a; . ./.env.production.local; set +a
npm run staff:add -- --email you@reka.re --name "Your Name" --role operator
rm .env.production.local
```

Add at least **two approvers** as well: whoever proposed or edited a baseline or report can't approve it. There are no passwords to hand out. Each person enters their work e-mail on the sign-in page, opens the link it sends (it works once, for 15 minutes), and sets up two-step with an authenticator app the first time. To stop someone signing in, set `disabled_at` on their `staff` row: their links and sessions stop working at once.

## 8 Check it works

1. Ask for a sign-in link, open it, set up two-step, and open every page in the menu, including on a phone. Open the same link again: it should say it can't be used.
2. **Settings, Cron Jobs:** run the health check by hand, then look at the Jobs page for the run.
3. Confirm a job refuses a stranger. This should print `404`:
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' https://<your domain>/api/cron/health
   ```
4. **Logs:** no `Environment:`, `sign-in e-mail not sent` or `DATABASE_URL connects as a role that bypasses` errors.
5. **E-mail:** with the switch on, the Jobs page lists each alert as sent, and AXLE's Watch, Email shows Gauge's e-mails by template and status.

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
| No sign-in e-mail arrives, and the logs say `sign-in e-mail not sent: Resend answered 403` | The sending domain isn't verified, or `MAIL_FROM` isn't on it |
| `sign-in e-mail not sent: AntaraX email answered 401 (invalid_key)` | `AX_SVC_KEY` isn't the key the service holds for Gauge in that environment (a staging key against production, or the other way round) |
| `AntaraX email answered 422 (invalid_request)` | Usually `APP_URL` isn't `https://gauge.antarax.ai` (or, on staging, a host in the service's `EXTRA_ORIGINS`) |
| `AntaraX email answered 403 (recipient_not_allowed)` | The staging service only delivers to the team's addresses |
| `AntaraX email: suppressed` on an alert in Jobs | That address bounced or reported spam; it is lifted in AXLE, not here |
| No sign-in e-mail, nothing in the logs | The address isn't a staff account, or it was disabled. The page says the same either way, on purpose |
| "This link can't be used" at once | The link was already used or is over 15 minutes old. Ask for a new one |
