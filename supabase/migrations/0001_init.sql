-- TriQuest schema — profiles, workouts, strava_accounts — with Row-Level
-- Security so a signed-in user can only ever touch their own rows.
--
-- Apply with the Supabase CLI:  supabase db push
-- or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (display name + synced settings blob)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are self-only" on public.profiles;
create policy "profiles are self-only" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- workouts: the synced training sessions (plan | custom | strava)
-- updated_at is client-supplied for last-write-wins; never auto-overwritten.
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  -- text (not uuid): the app supplies its own ids, e.g. 'seed-2026-07-06-0'.
  id                 text primary key default gen_random_uuid()::text,
  user_id            uuid not null references auth.users (id) on delete cascade,
  date               date not null,
  type               text not null,
  title              text,
  intensity          text,
  duration_min       integer,
  distance_km        numeric,
  completed          boolean not null default false,
  completed_at       timestamptz,
  phase              text,
  deload             boolean not null default false,
  segments           jsonb not null default '[]'::jsonb,
  exercises          jsonb not null default '[]'::jsonb,
  packing            jsonb not null default '[]'::jsonb,
  notes              text,
  actual             jsonb,
  strava_activity_id bigint,
  source             text not null default 'custom'
                       check (source in ('plan', 'custom', 'strava')),
  extra              jsonb not null default '{}'::jsonb, -- app-only display flags
  updated_at         timestamptz not null default now()
);

-- Dedupe Strava imports per user (NULLs allowed for non-Strava rows).
create unique index if not exists workouts_user_strava_uniq
  on public.workouts (user_id, strava_activity_id)
  where strava_activity_id is not null;

create index if not exists workouts_user_date_idx on public.workouts (user_id, date);

alter table public.workouts enable row level security;

drop policy if exists "workouts are self-only" on public.workouts;
create policy "workouts are self-only" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- strava_accounts: OAuth tokens. RLS denies all client access (no policies);
-- only the service-role key (used by Edge Functions) bypasses RLS.
-- Connection status is exposed to the client via strava_status() below.
-- ---------------------------------------------------------------------------
create table if not exists public.strava_accounts (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  athlete_id    bigint,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.strava_accounts enable row level security;
-- No SELECT/INSERT/UPDATE policies: clients cannot read or write tokens
-- (only the service-role Edge Functions can). A user may delete their own row
-- to disconnect — DELETE returns no column data, so tokens stay unreadable.
drop policy if exists "disconnect own strava" on public.strava_accounts;
create policy "disconnect own strava" on public.strava_accounts
  for delete using (auth.uid() = user_id);

-- Safe, token-free connection status for the signed-in user.
create or replace function public.strava_status()
returns table (connected boolean, athlete_id bigint, scope text)
language sql
security definer set search_path = public
as $$
  select true, sa.athlete_id, sa.scope
  from public.strava_accounts sa
  where sa.user_id = auth.uid()
  union all
  select false, null::bigint, null::text
  where not exists (select 1 from public.strava_accounts where user_id = auth.uid())
  limit 1;
$$;

grant execute on function public.strava_status() to authenticated;

-- Lock down SECURITY DEFINER functions so they aren't callable as public RPCs.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.strava_status() from public, anon;

-- Enable realtime for cross-device live updates (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workouts'
  ) then
    alter publication supabase_realtime add table public.workouts;
  end if;
end $$;
