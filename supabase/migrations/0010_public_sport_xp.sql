-- 0010: public_profile v4 — per-discipline XP, so another athlete's profile
-- can show their Cycling / Swim / Run / Gym levels like your own Profile tab.
-- Same per-session formula as js/core/scoring.js xpForWorkout() and the same
-- earns_xp() rule as the leaderboard; quest XP is not tied to a sport.

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
                     from (select w.type, round(
                             greatest(coalesce(w.duration_min, 0), 0)
                             * case w.type when 'run' then 1.1 when 'swim' then 1.2 when 'brick' then 1.35
                                           when 'mobility' then 0.6 else 1.0 end
                             * case w.intensity when 'steady' then 1.1 when 'moderate' then 1.15
                                                when 'threshold' then 1.3 when 'quality' then 1.35
                                                when 'vo2' then 1.45 when 'race' then 1.6 else 1.0 end
                             + greatest(coalesce(w.distance_km, 0), 0) * 1.5)::bigint as x
                           from public.workouts w
                           where w.user_id = p_user
                             and public.earns_xp(w.completed, w.type, w.strava_activity_id, w.source, w.extra)) s)
  );
$$;
grant execute on function public.public_profile(uuid) to authenticated, anon;
