create extension if not exists "pgcrypto";
--> statement-breakpoint

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'eif' check (role in ('eif', 'admin')),
  is_active boolean not null default true,
  consent_acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
--> statement-breakpoint

create table if not exists advisors (
  id text primary key,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
--> statement-breakpoint

insert into advisors (id, name, description)
values
  ('data-dashboard', 'Data Dashboard Advisor', 'Dashboard analysis support'),
  ('ssot-memo', 'SSOT Memo Advisor', 'Single source of truth memo support'),
  ('advisor-3', 'Advisor 3', 'Configurable advisor slot')
on conflict (id) do nothing;
--> statement-breakpoint

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  advisor_id text not null references advisors(id),
  title text not null default 'Untitled conversation',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
--> statement-breakpoint

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id),
  user_id uuid not null references users(id),
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  provider text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_usd numeric,
  latency_ms integer,
  status text not null default 'ok',
  block_reason text,
  prompt_doc_revision text,
  dna_digest_version text,
  created_at timestamptz not null default now()
);
--> statement-breakpoint

create table if not exists usage_counters (
  user_id uuid not null references users(id),
  day_ph date not null,
  messages_today integer not null default 0,
  tokens_today integer not null default 0,
  estimated_spend_today_usd numeric not null default 0,
  primary key (user_id, day_ph)
);
--> statement-breakpoint

create table if not exists model_config (
  advisor_id text primary key references advisors(id),
  provider text not null,
  model text not null,
  is_enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
--> statement-breakpoint

create table if not exists prompt_cache (
  key text primary key,
  value_hash text not null,
  doc_revision text,
  dna_digest_version text,
  last_good_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
--> statement-breakpoint

create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  actor_id uuid,
  severity text not null default 'info',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
--> statement-breakpoint

alter table users enable row level security;
--> statement-breakpoint
alter table conversations enable row level security;
--> statement-breakpoint
alter table messages enable row level security;
--> statement-breakpoint

create policy users_self_or_admin_select on users
  for select using (
    id::text = current_setting('request.jwt.claim.sub', true)
    or current_setting('request.jwt.claim.role', true) = 'admin'
  );
--> statement-breakpoint

create policy conversations_owner_or_admin_select on conversations
  for select using (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or current_setting('request.jwt.claim.role', true) = 'admin'
  );
--> statement-breakpoint

create policy messages_owner_or_admin_select on messages
  for select using (
    user_id::text = current_setting('request.jwt.claim.sub', true)
    or current_setting('request.jwt.claim.role', true) = 'admin'
  );
