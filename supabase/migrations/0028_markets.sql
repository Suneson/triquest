-- 0028_markets.sql — the four markets round the tower's lobby (docs/MARKETS.md).
--
-- Each one is bought once for 400 coins, then makes coins on its own: a few an hour, up to what
-- it holds. Collecting takes what's waiting into the wallet (as much as there's room for).
-- The rules are js/core/markets.js's (tests/markets-sql.test.js holds them together).
--
--   user_markets      the markets you've bought: which slot, its level, what it cost, and the
--                     clock it makes coins from (collected_at)
--   market_collects   every collection, the coins it paid
--   wallet_fold()     as in 0027, with two more kinds of event: a market bought (rank 7, paid
--                     out) and a market collected (rank 8, paid in)

create or replace function public.market_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"cost":400,"slots":[1,2,3,4],"levels":[{"level":1,"perHour":2,"capacity":24}]}'::jsonb;
$$;

create table if not exists public.user_markets (
  user_id      uuid not null references auth.users (id) on delete cascade,
  slot         smallint not null check (slot between 1 and 4),
  level        smallint not null default 1 check (level >= 1),
  cost         int not null check (cost >= 0),
  bought_at    timestamptz not null default now(),
  collected_at timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.user_markets enable row level security;
drop policy if exists user_markets_own on public.user_markets;
create policy user_markets_own on public.user_markets for select using (user_id = auth.uid());
grant select on public.user_markets to authenticated;

create table if not exists public.market_collects (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  slot         smallint not null,
  coins        int not null check (coins > 0),
  collected_at timestamptz not null default now()
);
create index if not exists market_collects_user on public.market_collects (user_id);
alter table public.market_collects enable row level security;
drop policy if exists market_collects_own on public.market_collects;
create policy market_collects_own on public.market_collects for select using (user_id = auth.uid());
grant select on public.market_collects to authenticated;

-- the rules at a level (the top one past the last)
create or replace function public.market_level(p_level int)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(public.market_rules() -> 'levels' -> (least(greatest(p_level, 1), jsonb_array_length(public.market_rules() -> 'levels')) - 1),
                  public.market_rules() -> 'levels' -> 0);
$$;

-- whole coins waiting in a market at `p_at`
create or replace function public.market_stock(p_level int, p_collected_at timestamptz, p_at timestamptz)
returns int language sql immutable set search_path = public as $$
  select least((public.market_level(p_level) ->> 'capacity')::int,
               floor(greatest(0, extract(epoch from (p_at - p_collected_at))) / 3600.0
                     * (public.market_level(p_level) ->> 'perHour')::numeric)::int);
$$;

create or replace function public.buy_market(p_slot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  cost int := (public.market_rules() ->> 'cost')::int;
  bal  bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if not (public.market_rules() -> 'slots') @> to_jsonb(p_slot) then
    raise exception 'gear:unknown_market' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if exists (select 1 from public.user_markets where user_id = uid and slot = p_slot) then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.user_markets (user_id, slot, level, cost, bought_at, collected_at)
  values (uid, p_slot, 1, cost, now(), now());
  return public.wallet_for(uid);
end;
$$;

-- take what's waiting, as much as the wallet has room for; a full market starts again from now,
-- otherwise its clock moves on only by the coins taken (js/core/markets.js marketCollect())
create or replace function public.collect_market(p_slot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  m     public.user_markets;
  lv    jsonb;
  stock int;
  room  bigint;
  take  int;
  t     timestamptz := now();
  nxt   timestamptz;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select * into m from public.user_markets where user_id = uid and slot = p_slot;
  if not found then raise exception 'gear:not_owned' using errcode = '22023'; end if;
  lv := public.market_level(m.level);
  stock := public.market_stock(m.level, m.collected_at, t);
  if stock < 1 then raise exception 'gear:market_empty' using errcode = '22023'; end if;
  select greatest(0, (public.gear_rules() ->> 'storageCap')::bigint - f.coins) into room from public.wallet_fold(uid) f;
  take := least(stock, room)::int;
  if take < 1 then raise exception 'gear:wallet_full' using errcode = '22023'; end if;
  nxt := case when stock >= (lv ->> 'capacity')::int and take = stock then t
              else m.collected_at + make_interval(secs => take / (lv ->> 'perHour')::numeric * 3600) end;
  update public.user_markets set collected_at = least(nxt, t) where user_id = uid and slot = p_slot;
  insert into public.market_collects (user_id, slot, coins, collected_at) values (uid, p_slot, take, t);
  return json_build_object('coins', take, 'wallet', public.wallet_for(uid));
end;
$$;

-- ---- the wallet: markets bought (rank 7) and collected (rank 8) ----------------------------

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

grant execute on function public.market_rules(), public.market_level(int), public.market_stock(int, timestamptz, timestamptz) to authenticated, anon;
grant execute on function public.buy_market(int), public.collect_market(int) to authenticated;
