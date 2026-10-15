-- 0011: the leaderboard lists every account, including athletes with 0 XP,
-- so new people show up (and can be added as friends) before their first
-- verified session. Same XP rule and formula as 0008.

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
    -- every account, even with no XP yet, so new athletes show up and can be added
    select p.id as user_id,
           coalesce(w.xp, 0) + coalesce(q.xp, 0) as xp,
           coalesce(w.sports, array[]::text[]) as sports
    from public.profiles p
    left join w on w.user_id = p.id
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
