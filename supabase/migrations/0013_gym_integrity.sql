-- 0013: gym XP integrity (polish phase 7). Mirrors js/core/xp-rules.js; the
-- rules are written out for people in docs/XP.md.
--
-- Two honest paths earn XP:
--   - Strava proof (strava_activity_id, or imported from Strava): any sport,
--     plus a 10% bonus for being verified.
--   - A gym session logged set by set in the app: it counts only when the log
--     looks like a real session (gym_reason is null), for the minutes the log
--     supports, and app-logged gym XP is capped at 150 per day.
-- Gym sessions dated before 2026-10-16 keep the old rule, so nobody loses XP
-- they already had.

-- Ticked working sets of a session: how many, how many carry a time, and the
-- seconds from the first tick to the last.
create or replace function public.gym_stats(w public.workouts)
returns table (n int, n_ts int, span numeric)
language sql stable set search_path = public as $$
  with s as (
    select st ->> 'doneAt' as at_txt
    from jsonb_array_elements(case when jsonb_typeof(w.exercises) = 'array' then w.exercises else '[]'::jsonb end) ex,
         jsonb_array_elements(case when jsonb_typeof(ex -> 'sets') = 'array' then ex -> 'sets' else '[]'::jsonb end) st
    where coalesce(st ->> 'done', 'false') = 'true'
      and coalesce(st ->> 'kind', 'work') <> 'warmup'
  ), t as (
    select case when at_txt ~ '^\d{4}-\d{2}-\d{2}T' then at_txt::timestamptz end as at from s
  )
  select count(*)::int, count(at)::int, coalesce(extract(epoch from max(at) - min(at)), 0)::numeric from t;
$$;

-- Which path a session is on: 'strava', 'app' (a gym log) or null.
create or replace function public.proof_of(w public.workouts)
returns text language sql immutable set search_path = public as $$
  select case
    when w.strava_activity_id is not null or w.source = 'strava' then 'strava'
    when w.type = 'gym' and coalesce(w.extra, '{}'::jsonb) ? 'gymLoggedAt' then 'app'
  end;
$$;

-- Why an app-logged gym session doesn't count (null when it does, or when the
-- rule doesn't apply): sets | timestamps | tooFast | tooLong | short.
create or replace function public.gym_reason(w public.workouts)
returns text language sql stable set search_path = public as $$
  select case
    when public.proof_of(w) is distinct from 'app' then null
    when w.date < date '2026-10-16' then null
    when g.n < 3 then 'sets'
    when g.n_ts < g.n then 'timestamps'
    when g.span < greatest(300, (g.n - 1) * 20) then 'tooFast'
    when g.span > 4 * 3600 then 'tooLong'
    when least(coalesce(nullif(w.duration_min, 0), 100000), ceil(g.span / 60) + 20, 180) < 10 then 'short'
  end
  from public.gym_stats(w) g;
$$;

-- Does a session earn XP at all?
create or replace function public.earns(w public.workouts)
returns boolean language sql stable set search_path = public as $$
  select coalesce(w.completed, false)
     and public.proof_of(w) is not null
     and public.gym_reason(w) is null;
$$;

-- The XP a session is worth on its own (before the daily gym cap). Same
-- formula as xpForWorkout(): an app-logged gym session counts for the minutes
-- its log supports (at most 180), Strava proof adds 10%.
create or replace function public.session_xp(w public.workouts)
returns numeric language sql stable set search_path = public as $$
  select case when not public.earns(w) then 0 else round((
      (case when public.proof_of(w) = 'app' and w.date >= date '2026-10-16'
            then least(coalesce(nullif(w.duration_min, 0), 100000), ceil(g.span / 60) + 20, 180)
            else greatest(coalesce(w.duration_min, 0), 0) end)
      * case w.type when 'run' then 1.1 when 'swim' then 1.2 when 'brick' then 1.35
                    when 'mobility' then 0.6 else 1.0 end
      * case w.intensity when 'steady' then 1.1 when 'moderate' then 1.15
                         when 'threshold' then 1.3 when 'quality' then 1.35
                         when 'vo2' then 1.45 when 'race' then 1.6 else 1.0 end
      + greatest(coalesce(w.distance_km, 0), 0) * 1.5
    ) * case when public.proof_of(w) = 'strava' then 1.1 else 1.0 end) end
  from public.gym_stats(w) g;
$$;

create or replace function public.leaderboard(p_since timestamptz default null)
returns table (user_id uuid, display_name text, xp bigint, sports text[], avatar text)
language sql security definer set search_path = public stable as $$
  with e as (
    select w.user_id, w.date, w.type, public.proof_of(w) = 'app' as capped, public.session_xp(w) as x
    from public.workouts w
    where public.earns(w)
      and (p_since is null or w.completed_at >= p_since)
  ),
  d as (  -- app-logged gym XP is capped per day
    select e.user_id, case when e.capped then least(sum(e.x), 150) else sum(e.x) end as x
    from e group by e.user_id, e.date, e.capped
  ),
  w as (
    select d.user_id, sum(d.x)::bigint as xp from d group by d.user_id
  ),
  s as (
    select e.user_id,
           array_remove(array_agg(distinct case when e.type in ('bike','run','swim','gym') then e.type end), null) as sports
    from e group by e.user_id
  ),
  q as (
    select qc.user_id, sum(qc.xp)::bigint as xp
    from public.quest_completions qc
    where p_since is null or qc.day >= (p_since at time zone 'utc')::date
    group by qc.user_id
  ),
  u as (
    -- every account, even with no XP yet, so new athletes show up and can be added
    select p.id as user_id,
           coalesce(w.xp, 0) + coalesce(q.xp, 0) as xp,
           coalesce(s.sports, array[]::text[]) as sports
    from public.profiles p
    left join w on w.user_id = p.id
    left join s on s.user_id = p.id
    left join q on q.user_id = p.id
  )
  select u.user_id,
         coalesce(p.display_name, 'Athlete') as display_name,
         u.xp::bigint,
         u.sports,
         (p.settings ->> 'avatar') as avatar
  from u
  join public.profiles p on p.id = u.user_id
  order by u.xp desc, p.created_at asc
  limit 200;
$$;
grant execute on function public.leaderboard(timestamptz) to authenticated, anon;

-- The proof tier on the leaderboard: what share of each athlete's session XP
-- is verified by Strava (quests aside). The app shows it as a check mark.
create or replace function public.leaderboard_proof(p_since timestamptz default null)
returns table (user_id uuid, verified_pct int)
language sql security definer set search_path = public stable as $$
  with e as (
    select w.user_id, w.date, public.proof_of(w) as proof, public.session_xp(w) as x
    from public.workouts w
    where public.earns(w)
      and (p_since is null or w.completed_at >= p_since)
  ),
  d as (
    select e.user_id, e.proof, case when e.proof = 'app' then least(sum(e.x), 150) else sum(e.x) end as x
    from e group by e.user_id, e.date, e.proof
  )
  select d.user_id,
         round(100 * coalesce(sum(d.x) filter (where d.proof = 'strava'), 0) / nullif(sum(d.x), 0))::int
  from d group by d.user_id
  having sum(d.x) > 0;
$$;
grant execute on function public.leaderboard_proof(timestamptz) to authenticated, anon;

-- Another athlete's profile: per-sport XP under the same rules.
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
                             from public.workouts where user_id = p_user and completed group by date) d), '[]'::json),
    'sport_xp',     (select json_build_object(
                       'bike', coalesce(sum(x) filter (where type = 'bike'), 0),
                       'run',  coalesce(sum(x) filter (where type = 'run'), 0),
                       'swim', coalesce(sum(x) filter (where type = 'swim'), 0),
                       'gym',  coalesce(sum(x) filter (where type = 'gym'), 0))
                     from (select e.type, case when e.capped then least(sum(e.x), 150) else sum(e.x) end::bigint as x
                           from (select w.type, w.date, public.proof_of(w) = 'app' as capped, public.session_xp(w) as x
                                 from public.workouts w
                                 where w.user_id = p_user and public.earns(w)) e
                           group by e.type, e.date, e.capped) s)
  );
$$;
grant execute on function public.public_profile(uuid) to authenticated, anon;

create or replace function public.claim_quest(p_day date, p_quest_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  v_xp     integer := public.quest_xp(p_quest_id);
  v_since  constant date := date '2026-10-05';
  v_count  integer;
  v_ok     boolean;
  v_rows   integer;
  v_reason text;
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
      and public.earns(w)
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
                                    and public.earns(y))
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
    -- say why when it's a gym log that didn't count (the app shows the same reason)
    select public.gym_reason(g) into v_reason
      from public.workouts g
     where g.user_id = uid and g.date = p_day and g.completed and public.gym_reason(g) is not null
     limit 1;
    if v_reason is not null then
      raise exception 'gym session on % not counted: %', p_day, v_reason using errcode = '22023';
    end if;
    raise exception 'quest % not complete on %', p_quest_id, p_day using errcode = '22023';
  end if;

  insert into public.quest_completions (user_id, day, quest_id, xp)
  values (uid, p_day, p_quest_id, v_xp)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  return json_build_object('claimed', v_rows > 0, 'already', v_rows = 0, 'xp', v_xp);
end;
$$;
