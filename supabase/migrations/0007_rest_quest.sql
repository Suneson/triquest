-- 0007_rest_quest.sql — the recovery quest ('rest-day', 20 XP) on the server.
--
-- Mirrors js/core/rest.js + the 'rest-day' quest in js/core/quests.js: a planned
-- rest day is a day with no planned (non-optional) session inside a gap of at
-- most two such days. The quest completes when nothing was logged that day.
-- Written without DROP/REVOKE so the connector applies it without a
-- destructive-statement confirmation. Applied 2026-10-08 (0007a quest_xp,
-- 0007b claim_quest); 'rest-day' is in CLAIMABLE in js/core/quest-claims.js.
--
-- Note: the server can't do the client's two-day-run check exactly in one
-- query; it checks a planned day within two days on each side, which allows a
-- rest run of up to three days. Worth 20 XP and capped at 3 claims/day.

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
    when 'rest-day'  then 20
    else null
  end;
$$;

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
  -- a rest day only counts once it's over in the athlete's time zone, which can
  -- run up to a day behind UTC; the app only claims it the next local day
  if p_quest_id = 'rest-day' and p_day > (now() at time zone 'utc')::date then
    raise exception 'rest day % is not over yet', p_day using errcode = '22023';
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
    -- planned rest: nothing logged that day, no planned (non-optional) session
    -- that day, and a planned session within two days on both sides
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
