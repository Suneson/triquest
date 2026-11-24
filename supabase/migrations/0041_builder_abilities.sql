-- 0041_builder_abilities.sql: each builder's active ability (js/core/jobs.js ABILITIES, docs/JOBS.md).
--
-- A builder on a job can use their ability once per cooldown: it takes time off running jobs (never past
-- now), as jobs.js useAbility():
--   blue  rush       60 min off his own job                  cooldown 24 h
--   red   overdrive  a quarter of what's left of his job     cooldown 24 h
--   green teamwork   30 min off every builder's job running  cooldown 24 h
--   gold  master     180 min off his own job                 cooldown 48 h
--
--   ability_rules()        the table above, as jsonb
--   builder_ability_uses   one row per use, kept for good (the cooldown is read from the last)
--   use_builder_ability()  checks the builder is hired, on a job, rested; shortens the jobs; logs the use

create or replace function public.ability_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"blue":{"cut":60,"cooldown":24},"red":{"share":0.25,"cooldown":24},"green":{"all":30,"cooldown":24},"gold":{"cut":180,"cooldown":48}}'::jsonb;
$$;

create table if not exists public.builder_ability_uses (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  builder text not null check (builder in ('blue', 'red', 'green', 'gold')),
  used_at timestamptz not null default now()
);
create index if not exists builder_ability_uses_user on public.builder_ability_uses (user_id, builder, used_at desc);
alter table public.builder_ability_uses enable row level security;
drop policy if exists builder_ability_uses_own on public.builder_ability_uses;
create policy builder_ability_uses_own on public.builder_ability_uses for select using (user_id = auth.uid());
grant select on public.builder_ability_uses to authenticated;

create or replace function public.use_builder_ability(p_builder text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  a    jsonb := public.ability_rules() -> p_builder;
  mine public.builder_jobs;
  last timestamptz;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if a is null then raise exception 'gear:not_hired' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if (public.builder_rules() -> 'builders' ->> p_builder)::int > 0
     and not exists (select 1 from public.user_gear g where g.user_id = uid and g.item_id = 'builder-' || p_builder) then
    raise exception 'gear:not_hired' using errcode = '22023';
  end if;
  select * into mine from public.builder_jobs j where j.user_id = uid and j.builder = p_builder and j.finishes_at > now() limit 1;
  if mine.id is null then raise exception 'gear:idle' using errcode = '22023'; end if;
  select max(u.used_at) into last from public.builder_ability_uses u where u.user_id = uid and u.builder = p_builder;
  if last is not null and last + make_interval(hours => (a ->> 'cooldown')::int) > now() then
    raise exception 'gear:cooldown' using errcode = '22023';
  end if;
  if a ? 'all' then
    update public.builder_jobs j set finishes_at = greatest(now(), j.finishes_at - make_interval(mins => (a ->> 'all')::int))
      where j.user_id = uid and j.finishes_at > now();
  elsif a ? 'share' then
    update public.builder_jobs j set finishes_at = greatest(now(), j.finishes_at - (j.finishes_at - now()) * (a ->> 'share')::float8)
      where j.id = mine.id;
  else
    update public.builder_jobs j set finishes_at = greatest(now(), j.finishes_at - make_interval(mins => (a ->> 'cut')::int))
      where j.id = mine.id;
  end if;
  insert into public.builder_ability_uses (user_id, builder) values (uid, p_builder);
  return json_build_object('ok', true);
end;
$$;
revoke all on function public.use_builder_ability(text) from public, anon;
grant execute on function public.use_builder_ability(text) to authenticated;
grant execute on function public.ability_rules() to authenticated, anon;
