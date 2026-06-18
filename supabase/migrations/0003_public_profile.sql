-- Public, safe per-user profile summary for leaderboard profile previews.
-- Exposes only aggregates + completed dates — never settings/tokens.
create or replace function public.public_profile(p_user uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'display_name', coalesce((select display_name from public.profiles where id = p_user), 'Athlete'),
    'completed',    (select count(*) from public.workouts where user_id = p_user and completed),
    'total_km',     coalesce((select sum(distance_km) from public.workouts where user_id = p_user and completed), 0),
    'total_min',    coalesce((select sum(duration_min) from public.workouts where user_id = p_user and completed), 0),
    'dates',        coalesce((select array_agg(distinct to_char(date, 'YYYY-MM-DD')) from public.workouts where user_id = p_user and completed), array[]::text[])
  );
$$;
grant execute on function public.public_profile(uuid) to authenticated, anon;
