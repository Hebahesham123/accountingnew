-- ============================================================================
--  NEW ACCOUNTING SYSTEM — Supabase schema
--  Run this in the Supabase SQL Editor (or `supabase db push`).
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES (1:1 with auth.users) + role
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'user' check (role in ('admin','user')),
  created_at  timestamptz not null default now()
);

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. ENTITIES (companies / branches the user manages)
-- ----------------------------------------------------------------------------
create table if not exists public.entities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  legal_name  text,
  currency    text not null default 'EGP',
  logo_url    text,
  notes       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. ACCOUNTS — the chart of accounts TREE (adjacency list)
--    type:  'category' (top)  ->  'group'  ->  'account' (postable leaf)
--    report_category drives the financial statements:
--      asset | liability | equity | income | expense
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  entity_id       uuid not null references public.entities(id) on delete cascade,
  code            text not null,
  name            text not null,
  type            text not null default 'account' check (type in ('category','group','account')),
  report_category text check (report_category in ('asset','liability','equity','income','expense')),
  group_name      text,
  category_name   text,
  parent_id       uuid references public.accounts(id) on delete set null,
  is_postable     boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (entity_id, code)
);
create index if not exists accounts_entity_idx on public.accounts(entity_id);
create index if not exists accounts_parent_idx on public.accounts(parent_id);

-- ----------------------------------------------------------------------------
-- 4. PROJECTS (cost centers) — belong to an entity, can be tagged on lines
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.entities(id) on delete cascade,
  name        text not null,
  code        text,
  status      text not null default 'active' check (status in ('active','closed')),
  budget      numeric(18,2),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (entity_id, name)
);
create index if not exists projects_entity_idx on public.projects(entity_id);

-- ----------------------------------------------------------------------------
-- 5. JOURNAL ENTRIES + LINES (double-entry)
-- ----------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.entities(id) on delete cascade,
  entry_no    int not null,
  ref_no      text,
  date        date not null,
  description text,
  is_posted   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (entity_id, entry_no)
);
create index if not exists je_entity_date_idx on public.journal_entries(entity_id, date);

create table if not exists public.journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.journal_entries(id) on delete cascade,
  account_id  uuid not null references public.accounts(id),
  project_id  uuid references public.projects(id) on delete set null,
  debit       numeric(18,2) not null default 0,
  credit      numeric(18,2) not null default 0,
  description text,
  line_no     int not null default 0
);
create index if not exists jl_entry_idx  on public.journal_lines(entry_id);
create index if not exists jl_account_idx on public.journal_lines(account_id);
create index if not exists jl_project_idx on public.journal_lines(project_id);

-- Convenience: next entry number for an entity
create or replace function public.next_entry_no(p_entity uuid)
returns int language sql stable as $$
  select coalesce(max(entry_no), 0) + 1 from public.journal_entries where entity_id = p_entity;
$$;

-- ============================================================================
--  REPORTING VIEW — flattens every posting with its classification.
-- ============================================================================
create or replace view public.v_ledger as
  select
    e.id            as entity_id,
    je.id           as entry_id,
    je.entry_no,
    je.date,
    je.description  as entry_description,
    a.id            as account_id,
    a.code          as account_code,
    a.name          as account_name,
    a.report_category,
    a.group_name,
    a.category_name,
    p.id            as project_id,
    p.name          as project_name,
    jl.debit,
    jl.credit,
    (jl.debit - jl.credit) as amount,
    jl.description  as line_description
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.entry_id
  join public.entities e         on e.id = je.entity_id
  join public.accounts a         on a.id = jl.account_id
  left join public.projects p    on p.id = jl.project_id;

-- ============================================================================
--  ROW LEVEL SECURITY
--  Any authenticated user can read/write the shared books; admins additionally
--  manage profiles. (Tighten per-entity ownership later if you need it.)
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.entities        enable row level security;
alter table public.accounts        enable row level security;
alter table public.projects        enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines   enable row level security;

-- profiles
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles self"   on public.profiles;
drop policy if exists "profiles admin"  on public.profiles;
create policy "profiles read"  on public.profiles for select to authenticated using (true);
create policy "profiles self"  on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles admin" on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- helper macro applied to each books table
do $$
declare t text;
begin
  foreach t in array array['entities','accounts','projects','journal_entries','journal_lines']
  loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format('create policy "%s read"  on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s write" on public.%I for all    to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================================
--  STORAGE — bucket for entity logos / images
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('entity-images', 'entity-images', true)
on conflict (id) do nothing;

drop policy if exists "entity images read"  on storage.objects;
drop policy if exists "entity images write" on storage.objects;
create policy "entity images read"  on storage.objects for select using (bucket_id = 'entity-images');
create policy "entity images write" on storage.objects for all to authenticated
  using (bucket_id = 'entity-images') with check (bucket_id = 'entity-images');
