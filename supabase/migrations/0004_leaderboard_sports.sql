-- Leaderboard v2: adds each athlete's active disciplines (bike/run/swim) so the
-- UI can render dynamic per-person sport indicators. Return type changes, so
-- the old signature must be dropped first.
drop function if exists public.leaderboard(timestamptz);
create function public.leaderboard(p_since timestamptz default null)
returns table (user_id uuid, display_name text, xp bigint, sports text[])
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
         ))::bigint as xp,
         array_remove(array_agg(distinct case when w.type in ('bike','run','swim') then w.type end), null) as sports
  from public.workouts w
  left join public.profiles p on p.id = w.user_id
  where w.completed and (p_since is null or w.completed_at >= p_since)
  group by w.user_id, p.display_name
  order by xp desc
  limit 100;
$$;
grant execute on function public.leaderboard(timestamptz) to authenticated, anon;
