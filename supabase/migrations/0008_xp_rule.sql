-- 0008: who earns XP.
-- A session earns XP when it is completed AND either has Strava proof, or is
-- a gym session logged in the app (Finish/Save stamps extra.gymLoggedAt).
-- Every other sport still needs a Strava activity. Same rule as
-- js/core/scoring.js earnsXp(); used by the leaderboard, quests and the
-- public profile.

create or replace function public.earns_xp(p_completed boolean, p_type text, p_strava bigint, p_source text, p_extra jsonb)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_completed, false)
     and (p_strava is not null
          or p_source = 'strava'
          or (p_type = 'gym' and coalesce(p_extra, '{}'::jsonb) ? 'gymLoggedAt'));
$$;

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
           array_remove(array_agg(distinct case when w.type in ('bike','run','swim','gym') then w.type end), null) as sports
    from public.workouts w
    where public.earns_xp(w.completed, w.type, w.strava_activity_id, w.source, w.extra)
      and (p_since is null or w.completed_at >= p_since)
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

create or replace function public.claim_quest(p_day date, p_quest_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  v_xp     integer := public.quest_xp(p_quest_id);
  v_since  constant date := date '2026-10-05';
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
  if p_quest_id = 'rest-day' and p_day > (now() at time zone 'utc')::date then
    raise exception 'rest day % is not over yet', p_day using errcode = '22023';
  end if;
  if p_day > (now() at time zone 'utc')::date + 1 then
    raise exception 'quest day % is in the future', p_day using errcode = '22023';
  end if;
  if p_day < v_since then
    raise exception 'quests start on %', v_since using errcode = '22023';
  end if;

  if exists (select 1 from public.quest_completions
             where user_id = uid and day = p_day and quest_id = p_quest_id) then
    return json_build_object('claimed', false, 'already', true, 'xp', v_xp);
  end if;

  select count(*) into v_count from public.quest_completions where user_id = uid and day = p_day;
  if v_count >= 3 then
    raise exception 'daily quest cap reached for %', p_day using errcode = '22023';
  end if;

  with v as (
    select w.type, w.source,
           coalesce((w.actual ->> 'durationMin')::numeric, w.duration_min, 0) as min,
           coalesce((w.actual ->> 'distanceKm')::numeric, w.distance_km, 0) as km
    from public.workouts w
    where w.user_id = uid and w.date = p_day
      and public.earns_xp(w.completed, w.type, w.strava_activity_id, w.source, w.extra)
  )
  select case p_quest_id
    when 'plan-done' then exists (select 1 from v where source is distinct from 'strava')
    when 'min-45'    then coalesce((select sum(min) from v), 0) >= 45
    when 'two-disc'  then (select count(distinct type) from v) >= 2
    when 'km-10'     then coalesce((select sum(km) from v), 0) >= 10
    when 'brick'     then exists (select 1 from v where type = 'brick')
    when 'streak'    then exists (select 1 from v)
                      and exists (select 1 from public.workouts y
                                  where y.user_id = uid and y.date = p_day - 1
                                    and public.earns_xp(y.completed, y.type, y.strava_activity_id, y.source, y.extra))
    when 'rest-day'  then p_day >= date '2026-10-08'
                      and not exists (select 1 from public.workouts r
                                      where r.user_id = uid and r.date = p_day and r.completed)
                      and not exists (select 1 from public.workouts r
                                      where r.user_id = uid and r.date = p_day
                                        and r.source is distinct from 'strava'
                                        and not coalesce((r.extra ->> 'optional')::boolean, false))
                      and exists (select 1 from public.workouts r
                                  where r.user_id = uid and r.date between p_day - 2 and p_day - 1
                                    and r.source is distinct from 'strava'
                                    and not coalesce((r.extra ->> 'optional')::boolean, false))
                      and exists (select 1 from public.workouts r
                                  where r.user_id = uid and r.date between p_day + 1 and p_day + 2
                                    and r.source is distinct from 'strava'
                                    and not coalesce((r.extra ->> 'optional')::boolean, false))
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
