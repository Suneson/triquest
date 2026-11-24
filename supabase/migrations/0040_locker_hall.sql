-- 0040_locker_hall.sql: the locker room is the base's hall (js/core/jobs.js HALL, docs/JOBS.md).
--
-- The locker room becomes a builder's job like the others, and its level caps every other building's:
-- builder_rules() gains the locker's prices, "hall" and "caps" (hall level -> the others' top level), and
-- start_builder_job() refuses a level past the cap with gear:hall_low.

create or replace function public.builder_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"targets":{"locker":{"2":{"coins":1000,"hours":4},"3":{"coins":2500,"hours":12},"4":{"coins":5000,"hours":24},"5":{"coins":9000,"hours":36},"6":{"coins":15000,"hours":48}},"gel-stand":{"2":{"coins":400,"hours":2},"3":{"coins":900,"hours":6},"4":{"coins":1800,"hours":12},"5":{"coins":3500,"hours":24},"6":{"coins":6000,"hours":36}},"coffee-shop":{"2":{"coins":500,"hours":2},"3":{"coins":1000,"hours":6},"4":{"coins":2000,"hours":12},"5":{"coins":4000,"hours":24},"6":{"coins":7000,"hours":36}}},"builders":{"blue":0,"red":1500,"green":3000,"gold":6000},"hall":"locker","caps":{"1":2,"2":3,"3":4,"4":5,"5":6,"6":6}}'::jsonb;
$$;

create or replace function public.start_builder_job(p_target text, p_builder text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  rules  jsonb := public.builder_rules();
  levels jsonb := rules -> 'targets' -> p_target;
  lvl    int;
  price  jsonb;
  bal    bigint;
  hall   int;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if levels is null then raise exception 'gear:unknown_target' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select 1 + count(*) into lvl from public.builder_jobs j where j.user_id = uid and j.target = p_target and j.finishes_at <= now();
  price := levels -> (lvl + 1)::text;
  if price is null then raise exception 'gear:top' using errcode = '22023'; end if;
  -- the locker room is the hall: no other building goes past what its level allows
  if p_target <> rules ->> 'hall' then
    select 1 + count(*) into hall from public.builder_jobs j where j.user_id = uid and j.target = rules ->> 'hall' and j.finishes_at <= now();
    if lvl + 1 > coalesce((rules -> 'caps' ->> hall::text)::int, 99) then raise exception 'gear:hall_low' using errcode = '22023'; end if;
  end if;
  if exists (select 1 from public.builder_jobs j where j.user_id = uid and j.target = p_target and j.finishes_at > now()) then
    raise exception 'gear:busy_target' using errcode = '22023';
  end if;
  if not (rules -> 'builders') ? p_builder then raise exception 'gear:not_hired' using errcode = '22023'; end if;
  -- the blue builder is everyone's; the others once hired (0038)
  if (rules -> 'builders' ->> p_builder)::int > 0
     and not exists (select 1 from public.user_gear g where g.user_id = uid and g.item_id = 'builder-' || p_builder) then
    raise exception 'gear:not_hired' using errcode = '22023';
  end if;
  if exists (select 1 from public.builder_jobs j where j.user_id = uid and j.builder = p_builder and j.finishes_at > now()) then
    raise exception 'gear:builder_busy' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < (price ->> 'coins')::int then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.builder_jobs (user_id, builder, target, to_level, cost, started_at, finishes_at)
  values (uid, p_builder, p_target, lvl + 1, (price ->> 'coins')::int, now(), now() + make_interval(hours => (price ->> 'hours')::int));
  return public.wallet_for(uid);
end;
$$;
revoke all on function public.start_builder_job(text, text) from public, anon;
grant execute on function public.start_builder_job(text, text) to authenticated;
grant execute on function public.builder_rules() to authenticated, anon;
