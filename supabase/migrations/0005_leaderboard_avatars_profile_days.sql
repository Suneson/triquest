-- Leaderboard v3: include each athlete's profile photo (from profiles.settings).
drop function if exists public.leaderboard(timestamptz);
create function public.leaderboard(p_since timestamptz default null)
returns table (user_id uuid, display_name text, xp bigint, sports text[], avatar text)
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
         array_remove(array_agg(distinct case when w.type in ('bike','run','swim') then w.type end), null) as sports,
         (p.settings ->> 'avatar') as avatar
  from public.workouts w
  left join public.profiles p on p.id = w.user_id
  where w.completed and (p_since is null or w.completed_at >= p_since)
  group by w.user_id, p.display_name, (p.settings ->> 'avatar')
  order by xp desc
  limit 100;
$$;
grant execute on function public.leaderboard(timestamptz) to authenticated, anon;

-- public_profile v2: adds per-day session counts + minutes so the public
-- fitness dashboard can render calendar chips, trend and strain for any athlete.
create or replace function public.public_profile(p_user uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'display_name', coalesce((select display_name from public.profiles where id = p_user), 'Athlete'),
    'completed',    (select count(*) from public.workouts where user_id = p_user and completed),
    'total_km',     coalesce((select sum(distance_km) from public.workouts where user_id = p_user and completed), 0),
    'total_min',    coalesce((select sum(duration_min) from public.workouts where user_id = p_user and completed), 0),
    'dates',        coalesce((select array_agg(distinct to_char(date, 'YYYY-MM-DD')) from public.workouts where user_id = p_user and completed), array[]::text[]),
    'days',         coalesce((select json_agg(json_build_object('date', to_char(d.date, 'YYYY-MM-DD'), 'n', d.n, 'min', d.min) order by d.date)
                       from (select date, count(*)::int as n, sum(coalesce(duration_min, 0))::int as min
                             from public.workouts where user_id = p_user and completed group by date) d), '[]'::json)
  );
$$;
grant execute on function public.public_profile(uuid) to authenticated, anon;
