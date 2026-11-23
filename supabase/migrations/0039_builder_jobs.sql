-- 0039_builder_jobs.sql: the builders' jobs (js/core/jobs.js, docs/JOBS.md).
--
-- Every upgrade on the base is a builder's job: its coins are paid when it starts, one of your builders
-- works on it for its hours, and the building is a level up when the time is up. A builder does one job
-- at a time and a building takes one at a time. A building's level is 1 plus its finished jobs.
--
--   builder_rules()       the targets' prices by level and the builders (as JOB_RULES in jobs.js;
--                         tests/jobs-sql.test.js checks they match)
--   builder_jobs          one row per job, kept for good (the levels are counted from them)
--   start_builder_job()   start one: checks the builder is hired and free, the building free, the coins
--   wallet_fold()         as in 0035, with one more kind of event: a job started (rank 13)

create or replace function public.builder_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"targets":{"gel-stand":{"2":{"coins":400,"hours":2},"3":{"coins":900,"hours":6},"4":{"coins":1800,"hours":12},"5":{"coins":3500,"hours":24},"6":{"coins":6000,"hours":36}},"coffee-shop":{"2":{"coins":500,"hours":2},"3":{"coins":1000,"hours":6},"4":{"coins":2000,"hours":12},"5":{"coins":4000,"hours":24},"6":{"coins":7000,"hours":36}}},"builders":{"blue":0,"red":1500,"green":3000,"gold":6000}}'::jsonb;
$$;

create table if not exists public.builder_jobs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  builder     text not null check (builder in ('blue', 'red', 'green', 'gold')),
  target      text not null,
  to_level    smallint not null check (to_level >= 2),
  cost        int not null check (cost >= 0),
  started_at  timestamptz not null default now(),
  finishes_at timestamptz not null,
  unique (user_id, target, to_level)
);
create index if not exists builder_jobs_user on public.builder_jobs (user_id);
alter table public.builder_jobs enable row level security;
drop policy if exists builder_jobs_own on public.builder_jobs;
create policy builder_jobs_own on public.builder_jobs for select using (user_id = auth.uid());
grant select on public.builder_jobs to authenticated;

create or replace function public.start_builder_job(p_target text, p_builder text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  rules  jsonb := public.builder_rules();
  levels jsonb := rules -> 'targets' -> p_target;
  lvl    int;
  price  jsonb;
  bal    bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if levels is null then raise exception 'gear:unknown_target' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select 1 + count(*) into lvl from public.builder_jobs j where j.user_id = uid and j.target = p_target and j.finishes_at <= now();
  price := levels -> (lvl + 1)::text;
  if price is null then raise exception 'gear:top' using errcode = '22023'; end if;
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

-- ---- the wallet: builders' jobs (rank 13) ---------------------------------------------------

create or replace function public.wallet_fold(p_user uuid)
returns table (coins bigint, carbs bigint, earned_coins bigint, earned_carbs bigint,
               spent_coins bigint, spent_carbs bigint, lost_coins bigint, lost_carbs bigint)
language plpgsql stable set search_path = public as $$
declare
  r     jsonb := public.gear_rules();
  cap   bigint := (r ->> 'storageCap')::bigint;
  since date := (r ->> 'since')::date;
  e     record;
  room  bigint;
begin
  earned_coins := (r ->> 'starterPurse')::bigint;  earned_carbs := (r ->> 'starterCarbs')::bigint;
  coins := least(cap, earned_coins);               carbs := least(cap, earned_carbs);
  spent_coins := 0; spent_carbs := 0; lost_coins := 0; lost_carbs := 0;
  for e in
    with days as (
      select l.date, sum(l.xp) as x from public.xp_ledger(p_user) l where l.date >= since group by l.date
    ), ev as (
      select to_char(d.date, 'YYYY-MM-DD') || 'T00:00:00.000Z' as at, 0 as rank, to_char(d.date, 'YYYY-MM-DD') as key,
             least((r ->> 'dailyCoinCap')::numeric, floor(greatest(d.x, 0) * (r ->> 'coinsPerXp')::numeric))::bigint as c,
             least((r ->> 'dailyCarbCap')::numeric, floor(greatest(d.x, 0) * (r ->> 'carbsPerXp')::numeric))::bigint as g
      from days d
      union all
      select to_char(q.day, 'YYYY-MM-DD') || 'T00:00:00.000Z', 1, q.quest_id,
             (public.quest_reward(q.quest_id) ->> 'coins')::bigint, (public.quest_reward(q.quest_id) ->> 'carbs')::bigint
      from public.quest_completions q
      where q.user_id = p_user and q.day >= since and public.quest_reward(q.quest_id) is not null
      union all
      select to_char(s.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 2, lpad(s.id::text, 12, '0'),
             case when s.currency = 'coins' then -s.coins else 0 end,
             case when s.currency = 'carbs' then -s.coins else 0 end
      from public.coin_spends s where s.user_id = p_user
      union all
      select to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 3, lpad(m.id::text, 12, '0'),
             m.coins::bigint, 0
      from public.coin_moves m where m.user_id = p_user
      union all
      select to_char(a.at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 4, a.sport || ':' || a.tier,
             a.coins::bigint, 0
      from public.collection_awards(p_user) a
      union all
      select to_char(m.claimed_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 5,
             to_char(m.week, 'YYYY-MM-DD') || ':' || m.mission_id, m.coins::bigint, m.carbs::bigint
      from public.mission_claims m where m.user_id = p_user
      union all
      select to_char(c.opened_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 6,
             lpad(c.id::text, 12, '0'), c.coins::bigint, c.carbs::bigint
      from public.reward_chests c where c.user_id = p_user and c.opened_at is not null
      union all
      -- a market bought is paid for when it's bought
      select to_char(k.bought_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 7,
             'market:' || k.slot, -k.cost::bigint, 0
      from public.user_markets k where k.user_id = p_user
      union all
      -- and what it makes comes in when it's collected
      select to_char(x.collected_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 8,
             lpad(x.id::text, 12, '0'), x.coins::bigint, 0
      from public.market_collects x where x.user_id = p_user
      union all
      -- an upgrade is paid for when it's made
      select to_char(u.upgraded_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 9,
             lpad(u.id::text, 12, '0'), -u.cost::bigint, 0
      from public.market_upgrades u where u.user_id = p_user
      union all
      -- a room expanded is paid for when it's bought
      select to_char(x.bought_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 10,
             'expand:' || x.room, -x.cost::bigint, 0
      from public.user_expansions x where x.user_id = p_user
      union all
      -- the island's rebuilds and its stall are paid for when started
      select to_char(i.started_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 11,
             'island:' || i.piece, -i.cost::bigint, 0
      from public.user_island i where i.user_id = p_user
      union all
      -- the markets on the market plot: built, upgraded, stock bought, sales collected, a VIP's buy-out
      select to_char(s.at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 12,
             lpad(s.id::text, 12, '0'), s.coins::bigint, 0
      from public.shop_moves s where s.user_id = p_user and s.coins <> 0
      union all
      -- a builder's job is paid for when it starts (0039)
      select to_char(b.started_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 13,
             'job:' || b.target || ':' || b.to_level, -b.cost::bigint, 0
      from public.builder_jobs b where b.user_id = p_user
    )
    select * from ev order by at collate "C", rank, key collate "C"
  loop
    if e.c > 0 then
      room := greatest(0, cap - coins);
      coins := coins + least(e.c, room); earned_coins := earned_coins + e.c; lost_coins := lost_coins + greatest(0, e.c - room);
    elsif e.c < 0 then
      coins := coins + e.c; spent_coins := spent_coins - e.c;
    end if;
    if e.g > 0 then
      room := greatest(0, cap - carbs);
      carbs := carbs + least(e.g, room); earned_carbs := earned_carbs + e.g; lost_carbs := lost_carbs + greatest(0, e.g - room);
    elsif e.g < 0 then
      carbs := carbs + e.g; spent_carbs := spent_carbs - e.g;
    end if;
  end loop;
  return next;
end;
$$;
