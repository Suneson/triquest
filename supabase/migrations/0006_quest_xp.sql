-- 0006_quest_xp.sql — daily-quest XP on the server, so it counts in Ranks.
--
-- The app derives quests from workouts (js/core/quests.js). When one completes
-- it calls claim_quest(day, quest_id). The server re-checks the claim against
-- the athlete's own Strava-verified workouts and takes the XP from its own list,
-- never from the client. Rows can only be written through that function.
--
-- Applied 2026-10-07 through the Supabase connector as seven parts
-- (0006a…0006g in the migration history): the connector holds anything it
-- reads as destructive (DROP, here) for a confirmation that timed out, so the
-- `drop policy if exists` was skipped (the policy didn't exist yet).

-- ---- table ---------------------------------------------------------------------

create table if not exists public.quest_completions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  quest_id   text not null,
  xp         integer not null check (xp between 0 and 500),
  created_at timestamptz not null default now(),
  primary key (user_id, day, quest_id)
);

alter table public.quest_completions enable row level security;

drop policy if exists "quest_completions: read own" on public.quest_completions;
create policy "quest_completions: read own" on public.quest_completions
  for select using (auth.uid() = user_id);
-- No insert / update / delete policies: direct writes are refused for every
-- client role. claim_quest() (security definer) is the only way in.

-- ---- the server's quest list (mirrors QUEST_POOL in js/core/quests.js) ----------

create or replace function public.quest_xp(p_quest_id text)
returns integer language sql immutable set search_path = public as $$
  select case p_quest_id
    when 'plan-done' then 40
    when 'min-45'    then 30
    when 'two-disc'  then 50
    when 'streak'    then 30
    when 'km-10'     then 30
    when 'brick'     then 50
    when 'pack-bag'  then 10
    else null
  end;
$$;
revoke all on function public.quest_xp(text) from public, anon, authenticated;

-- ---- claim -------------------------------------------------------------------------

-- Verified = completed AND linked to a Strava activity (same rule as the app).
create or replace function public.claim_quest(p_day date, p_quest_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  v_xp     integer := public.quest_xp(p_quest_id);
  v_since  constant date := date '2026-10-05';         -- QUESTS_SINCE
  v_count  integer;
  v_ok     boolean;
  v_rows   integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if v_xp is null then
    raise exception 'unknown quest %', p_quest_id using errcode = '22023';
  end if;
  -- the athlete's local date can run up to a day ahead of UTC
  if p_day > (now() at time zone 'utc')::date + 1 then
    raise exception 'quest day % is in the future', p_day using errcode = '22023';
  end if;
  if p_day < v_since then
    raise exception 'quests start on %', v_since using errcode = '22023';
  end if;

  -- already claimed: idempotent success, no double XP
  if exists (select 1 from public.quest_completions
             where user_id = uid and day = p_day and quest_id = p_quest_id) then
    return json_build_object('claimed', false, 'already', true, 'xp', v_xp);
  end if;

  select count(*) into v_count from public.quest_completions where user_id = uid and day = p_day;
  if v_count >= 3 then
    raise exception 'daily quest cap reached for %', p_day using errcode = '22023';
  end if;

  -- each quest's own rule, against that day's verified sessions
  with v as (
    select w.type, w.source,
           coalesce((w.actual ->> 'durationMin')::numeric, w.duration_min, 0) as min,
           coalesce((w.actual ->> 'distanceKm')::numeric, w.distance_km, 0) as km
    from public.workouts w
    where w.user_id = uid and w.date = p_day and w.completed
      and (w.strava_activity_id is not null or w.source = 'strava')
  )
  select case p_quest_id
    when 'plan-done' then exists (select 1 from v where source is distinct from 'strava')
    when 'min-45'    then coalesce((select sum(min) from v), 0) >= 45
    when 'two-disc'  then (select count(distinct type) from v) >= 2
    when 'km-10'     then coalesce((select sum(km) from v), 0) >= 10
    when 'brick'     then exists (select 1 from v where type = 'brick')
    when 'streak'    then exists (select 1 from v)
                      and exists (select 1 from public.workouts y
                                  where y.user_id = uid and y.date = p_day - 1 and y.completed
                                    and (y.strava_activity_id is not null or y.source = 'strava'))
    -- app quest: tomorrow's sessions have their bag ticked
    when 'pack-bag'  then exists (select 1 from public.workouts t
                                  where t.user_id = uid and t.date = p_day + 1
                                    and jsonb_typeof(t.extra -> 'packed') = 'array'
                                    and jsonb_array_length(t.extra -> 'packed') > 0)
    else false
  end into v_ok;

  if not coalesce(v_ok, false) then
    raise exception 'quest % not complete on %', p_quest_id, p_day using errcode = '22023';
  end if;

  insert into public.quest_completions (user_id, day, quest_id, xp)
  values (uid, p_day, p_quest_id, v_xp)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return json_build_object('claimed', v_rows > 0, 'already', v_rows = 0, 'xp', v_xp);
end;
$$;
revoke all on function public.claim_quest(date, text) from public, anon;
grant execute on function public.claim_quest(date, text) to authenticated;

-- ---- leaderboard: training XP + quest XP, same season window --------------------

create or replace function public.leaderboard(p_since timestamptz default null)
returns table (user_id uuid, display_name text, xp bigint, sports text[], avatar text)
language sql security definer set search_path = public stable as $$
  with w as (
    select w.user_id,
           sum(round(
             greatest(coalesce(w.duration_min, 0), 0)
             * case w.type when 'run' then 1.1 when 'swim' then 1.2 when 'brick' then 1.35
                           when 'mobility' then 0.6 else 1.0 end
             * case w.intensity when 'steady' then 1.1 when 'moderate' then 1.15
                                when 'threshold' then 1.3 when 'quality' then 1.35
                                when 'vo2' then 1.45 when 'race' then 1.6 else 1.0 end
             + coalesce(w.distance_km, 0) * 1.5
           ))::bigint as xp,
           array_remove(array_agg(distinct case when w.type in ('bike','run','swim') then w.type end), null) as sports
    from public.workouts w
    where w.completed and (p_since is null or w.completed_at >= p_since)
    group by w.user_id
  ),
  q as (
    select qc.user_id, sum(qc.xp)::bigint as xp
    from public.quest_completions qc
    where p_since is null or qc.day >= (p_since at time zone 'utc')::date
    group by qc.user_id
  ),
  u as (
    select coalesce(w.user_id, q.user_id) as user_id,
           coalesce(w.xp, 0) + coalesce(q.xp, 0) as xp,
           coalesce(w.sports, array[]::text[]) as sports
    from w full join q on q.user_id = w.user_id
  )
  select u.user_id,
         coalesce(p.display_name, 'Athlete') as display_name,
         u.xp,
         u.sports,
         (p.settings ->> 'avatar') as avatar
  from u
  left join public.profiles p on p.id = u.user_id
  order by u.xp desc
  limit 100;
$$;
grant execute on function public.leaderboard(timestamptz) to authenticated, anon;

-- ---- public profile: adds lifetime quest XP ----------------------------------------

create or replace function public.public_profile(p_user uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'display_name', coalesce((select display_name from public.profiles where id = p_user), 'Athlete'),
    'completed',    (select count(*) from public.workouts where user_id = p_user and completed),
    'total_km',     coalesce((select sum(distance_km) from public.workouts where user_id = p_user and completed), 0),
    'total_min',    coalesce((select sum(duration_min) from public.workouts where user_id = p_user and completed), 0),
    'quest_xp',     coalesce((select sum(xp) from public.quest_completions where user_id = p_user), 0),
    'dates',        coalesce((select array_agg(distinct to_char(date, 'YYYY-MM-DD')) from public.workouts where user_id = p_user and completed), array[]::text[]),
    'days',         coalesce((select json_agg(json_build_object('date', to_char(d.date, 'YYYY-MM-DD'), 'n', d.n, 'min', d.min) order by d.date)
                       from (select date, count(*)::int as n, sum(coalesce(duration_min, 0))::int as min
                             from public.workouts where user_id = p_user and completed group by date) d), '[]'::json)
  );
$$;
grant execute on function public.public_profile(uuid) to authenticated, anon;
