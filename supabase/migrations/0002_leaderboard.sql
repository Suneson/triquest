-- Global leaderboard: aggregated cross-user XP (no raw workouts exposed).
-- p_since = null -> all-time; else seasonal (caller passes the season start).
create or replace function public.leaderboard(p_since timestamptz default null)
returns table (user_id uuid, display_name text, xp bigint)
language sql security definer set search_path = public stable as $$
  select w.user_id,
         coalesce(p.display_name, 'Athlete') as display_name,
         sum(round(
           greatest(coalesce(w.duration_min, 0), 0)
           * case w.type when 'run' then 1.1 when 'swim' then 1.2 when 'brick' then 1.35
                         when 'mobility' then 0.6 else 1.0 end
           * case w.intensity when 'steady' then 1.1 when 'moderate' then 1.15
                              when 'threshold' then 1.3 when 'quality' then 1.35
                              when 'vo2' then 1.45 when 'race' then 1.6 else 1.0 end
           + coalesce(w.distance_km, 0) * 1.5
         ))::bigint as xp
  from public.workouts w
  left join public.profiles p on p.id = w.user_id
  where w.completed and (p_since is null or w.completed_at >= p_since)
  group by w.user_id, p.display_name
  order by xp desc
  limit 100;
$$;
grant execute on function public.leaderboard(timestamptz) to authenticated, anon;
