-- 0033_island.sql: the island (docs/CITY.md).
--
-- The club base, the pool and the market start in ruins. Each is paid for once and is rebuilt over
-- two hours. On the rebuilt market you can buy one stall and place it on a spot: for now it only
-- stands there. There are also eight market slots round the base now instead of four.
-- The rules are js/core/island.js's (tests/island-sql.test.js holds them together).
--
--   user_island     what's been started: 'club', 'pool', 'market', and 'stand' with its spot
--   wallet_fold()   as in 0029, with one more kind of event: something on the island paid for (rank 11)

create or replace function public.market_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"cost":400,"slots":[1,2,3,4,5,6,7,8],"levels":[{"level":1,"perHour":2,"capacity":24},{"level":2,"perHour":3,"capacity":36,"cost":600}]}'::jsonb;
$$;
alter table public.user_markets drop constraint if exists user_markets_slot_check;
alter table public.user_markets add constraint user_markets_slot_check check (slot between 1 and 8);

create or replace function public.island_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"buildHours":2,"pieces":{"club":150,"pool":350,"market":600},"standCost":400,"spots":[1,2,3,4,5,6,7,8,9]}'::jsonb;
$$;

create table if not exists public.user_island (
  user_id     uuid not null references auth.users (id) on delete cascade,
  piece       text not null check (piece in ('club', 'pool', 'market', 'stand')),
  cost        int not null check (cost >= 0),
  started_at  timestamptz not null default now(),
  finishes_at timestamptz not null default now(),
  spot        smallint check (spot between 1 and 9),
  primary key (user_id, piece)
);
alter table public.user_island enable row level security;
drop policy if exists user_island_own on public.user_island;
create policy user_island_own on public.user_island for select using (user_id = auth.uid());
grant select on public.user_island to authenticated;

create or replace function public.start_island_build(p_piece text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  rules jsonb := public.island_rules();
  cost  int := (rules -> 'pieces' ->> p_piece)::int;
  bal   bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if cost is null then raise exception 'gear:unknown_piece' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if exists (select 1 from public.user_island i where i.user_id = uid and i.piece = p_piece) then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.user_island (user_id, piece, cost, started_at, finishes_at)
  values (uid, p_piece, cost, now(), now() + make_interval(hours => (rules ->> 'buildHours')::int));
  return public.wallet_for(uid);
end;
$$;

create or replace function public.buy_island_stand(p_spot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  rules jsonb := public.island_rules();
  cost  int := (rules ->> 'standCost')::int;
  bal   bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if not (rules -> 'spots') @> to_jsonb(p_spot) then raise exception 'gear:unknown_spot' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if exists (select 1 from public.user_island i where i.user_id = uid and i.piece = 'stand') then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_island i where i.user_id = uid and i.piece = 'market' and i.finishes_at <= now()) then
    raise exception 'gear:not_built' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.user_island (user_id, piece, cost, started_at, finishes_at, spot) values (uid, 'stand', cost, now(), now(), p_spot);
  return public.wallet_for(uid);
end;
$$;

create or replace function public.move_island_stand(p_spot int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if not (public.island_rules() -> 'spots') @> to_jsonb(p_spot) then raise exception 'gear:unknown_spot' using errcode = '22023'; end if;
  update public.user_island set spot = p_spot where user_id = uid and piece = 'stand';
  if not found then raise exception 'gear:not_owned' using errcode = '22023'; end if;
end;
$$;

-- ---- the wallet: the island (rank 11) -------------------------------------------------------

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

grant execute on function public.island_rules() to authenticated, anon;
grant execute on function public.start_island_build(text) to authenticated;
grant execute on function public.buy_island_stand(int) to authenticated;
grant execute on function public.move_island_stand(int) to authenticated;
