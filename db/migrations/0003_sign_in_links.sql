-- Sign-in by e-mailed link, then the two-step code (PRD §4.3, §16 step 1). No passwords: a link works once,
-- for 15 minutes, and only its hash is kept.
alter table staff drop column password_hash;

create table sign_in_links (
  token_hash text primary key,
  staff_id uuid not null references staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index sign_in_links_staff on sign_in_links (staff_id, created_at desc);

grant select, insert, update, delete on sign_in_links to outcomes_app;
