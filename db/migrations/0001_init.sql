-- Outcomes, lean version 1 (docs/GO_LIVE_ENGINEERING.md, V-05 to V-07).
-- Every table that holds an organisation's data carries organisation_id and row-level security:
-- a transaction sees nothing until it sets outcomes.scope to 'all' or to one organisation's id.
-- The console connects as a member of outcomes_app, which owns nothing and cannot bypass the policies.

create extension if not exists citext;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'outcomes_app') then
    create role outcomes_app nologin;
  end if;
end $$;

create function outcomes_scope_allows(org uuid) returns boolean
language sql stable as $$
  select coalesce(current_setting('outcomes.scope', true), '') = 'all'
      or coalesce(current_setting('outcomes.scope', true), '') = org::text
$$;

-- ---------------------------------------------------------------- staff and sign-in (not organisation data)
create table staff (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null check (length(name) between 1 and 120),
  role text not null check (role in ('viewer', 'operator', 'approver')),
  password_hash text not null,
  totp_secret_sealed text,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash text primary key,
  staff_id uuid not null references staff (id) on delete cascade,
  two_step_done boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index sessions_staff on sessions (staff_id);

create table sign_in_attempts (
  id bigserial primary key,
  email citext not null,
  ok boolean not null,
  at timestamptz not null default now()
);
create index sign_in_attempts_email_at on sign_in_attempts (email, at desc);

create table rate_hits (
  bucket text not null,
  at timestamptz not null default now()
);
create index rate_hits_bucket_at on rate_hits (bucket, at desc);

-- ---------------------------------------------------------------- organisations and applications
create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  short_name text not null check (length(short_name) between 1 and 60),
  industry text not null default 'Other',
  time_zone text not null default 'Asia/Kuala_Lumpur',
  agreement_confirmed_at timestamptz,
  agreement_confirmed_by uuid references staff (id),
  created_at timestamptz not null default now(),
  created_by uuid references staff (id)
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  project_name text not null check (length(project_name) between 1 and 160),
  objective text not null default '',
  unit_singular text not null default 'item',
  unit_plural text not null default 'items',
  source text not null default 'link' check (source in ('link', 'sheet')),
  -- set_up: being set up; waiting: sent for approval; collecting: approved and counting; paused
  stage text not null default 'set_up' check (stage in ('set_up', 'waiting', 'collecting', 'paused')),
  setup_step int not null default 3 check (setup_step between 1 and 6),
  -- which shared figures feed the standard KPIs
  volume_metric text,
  corrections_metric text,
  machine_metric text,
  paused_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references staff (id)
);
create index applications_org on applications (organisation_id);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null unique references applications (id) on delete cascade,
  base_url text,
  key_sealed text not null,
  next_key_sealed text,
  key_hint text not null,
  dev_token_hash text,
  dev_token_expires_at timestamptz,
  -- not_connected, on_time, late, not_answering
  state text not null default 'not_connected' check (state in ('not_connected', 'on_time', 'late', 'not_answering')),
  state_since timestamptz not null default now(),
  state_why text,
  solution_id text,
  time_zone text,
  catalog_version text,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_health_at timestamptz,
  last_test jsonb,
  created_at timestamptz not null default now()
);
create index integrations_org on integrations (organisation_id);

create table metrics (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  key text not null,
  type text not null,
  unit text not null,
  label text,
  description text not null default '',
  aggregation text,
  numerator text,
  denominator text,
  dimensions text[] not null default '{}',
  since date,
  catalog_version text,
  -- active: counted; held: new or changed in the catalog, waiting for an operator (V-14); dropped
  state text not null default 'active' check (state in ('active', 'held', 'dropped')),
  held_why text,
  first_seen_at timestamptz not null default now(),
  unique (application_id, key)
);

create table observations (
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  metric_key text not null,
  local_period date not null,
  dim_key text not null default '',
  dimensions jsonb not null default '{}',
  value numeric,
  money text,
  count numeric,
  sum numeric,
  quality text not null default 'measured' check (quality in ('measured', 'derived')),
  source text not null default 'application_aggregate',
  collected_at timestamptz not null default now(),
  primary key (application_id, metric_key, local_period, dim_key)
);
create index observations_org_day on observations (organisation_id, local_period);

create table collection_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  kind text not null check (kind in ('nightly', 'health', 'test', 'backfill', 'upload')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'failed', 'partial')),
  days_read int not null default 0,
  observations_read int not null default 0,
  rejected int not null default 0,
  error text,
  detail jsonb not null default '{}'
);
create index collection_runs_app on collection_runs (application_id, started_at desc);

-- ---------------------------------------------------------------- KPIs, baselines, approvals, reports
create table kpis (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  code text not null,
  name text not null,
  formula jsonb not null,
  unit text not null default '',
  better text not null default 'up' check (better in ('up', 'down')),
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'waiting', 'approved', 'retired')),
  approved_at timestamptz,
  approved_by uuid references staff (id),
  created_by uuid references staff (id),
  created_at timestamptz not null default now(),
  unique (application_id, code, version)
);

create table baselines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'waiting', 'approved', 'retired')),
  minutes_low numeric not null check (minutes_low > 0),
  minutes_mid numeric not null check (minutes_mid >= minutes_low),
  minutes_high numeric not null check (minutes_high >= minutes_mid),
  review_low numeric not null default 0 check (review_low >= 0),
  review_mid numeric not null default 0 check (review_mid >= review_low),
  review_high numeric not null default 0 check (review_high >= review_mid),
  method text not null check (method in ('timed_sample', 'historical_records', 'client_estimate')),
  sample_size int,
  evidence text not null check (length(evidence) between 3 and 2000),
  measured_from date,
  measured_to date,
  applies_from date not null,
  approved_at timestamptz,
  approved_by uuid references staff (id),
  created_by uuid references staff (id),
  created_at timestamptz not null default now(),
  unique (application_id, version)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'waiting', 'approved')),
  figures jsonb not null,
  summary text not null default '',
  changes text not null default '',
  caveats text not null default '',
  next_steps text not null default '',
  html text,
  html_sha256 text,
  edited_by uuid references staff (id),
  approved_at timestamptz,
  approved_by uuid references staff (id),
  created_at timestamptz not null default now(),
  unique (application_id, month, version)
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  application_id uuid not null references applications (id) on delete cascade,
  subject text not null check (subject in ('kpi_set', 'baseline', 'report')),
  subject_id uuid,
  title text not null,
  summary text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'changes', 'declined')),
  proposed_by uuid not null references staff (id),
  proposed_at timestamptz not null default now(),
  decided_by uuid references staff (id),
  decided_at timestamptz,
  reason text
);
create index approvals_org_status on approvals (organisation_id, status);

-- ---------------------------------------------------------------- audit and outbox
create table audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid references staff (id),
  actor_label text not null,
  organisation_id uuid references organisations (id) on delete set null,
  action text not null,
  subject text not null default '',
  reason text,
  before jsonb,
  after jsonb
);
create index audit_org_at on audit (organisation_id, at desc);

create function audit_is_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit is append-only';
end $$;
create trigger audit_no_update before update or delete on audit for each row execute function audit_is_append_only();

create table outbox (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations (id) on delete cascade,
  created_at timestamptz not null default now(),
  to_addr text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  error text
);

-- ---------------------------------------------------------------- row-level security
do $$
declare t text;
begin
  foreach t in array array['organisations', 'applications', 'integrations', 'metrics', 'observations', 'collection_runs', 'kpis', 'baselines', 'reports', 'approvals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy scope_%1$s on %1$I using (outcomes_scope_allows(%2$s)) with check (outcomes_scope_allows(%2$s))', t, case when t = 'organisations' then 'id' else 'organisation_id' end);
  end loop;
end $$;

alter table audit enable row level security;
create policy audit_read on audit for select using (organisation_id is null and current_setting('outcomes.scope', true) = 'all' or organisation_id is not null and outcomes_scope_allows(organisation_id));
create policy audit_write on audit for insert with check (organisation_id is null or outcomes_scope_allows(organisation_id));

alter table outbox enable row level security;
create policy outbox_scope on outbox using (organisation_id is null and current_setting('outcomes.scope', true) = 'all' or organisation_id is not null and outcomes_scope_allows(organisation_id));

-- ---------------------------------------------------------------- what the console's role may do
grant usage on schema public to outcomes_app;
grant select, insert, update, delete on organisations, applications, integrations, metrics, observations, collection_runs, kpis, baselines, reports, approvals, outbox, sessions, sign_in_attempts, rate_hits to outcomes_app;
grant select, insert, update on staff to outcomes_app;
grant select, insert on audit to outcomes_app;
grant usage on all sequences in schema public to outcomes_app;
grant execute on function outcomes_scope_allows(uuid) to outcomes_app;
