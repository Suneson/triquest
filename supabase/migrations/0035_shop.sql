-- 0035_shop.sql: the markets on the island's market plot (docs/MARKETS.md).
--
-- Six spots on the rebuilt market plot. A market is built on a spot and goes up to level 8; each
-- level opens a slot and holds more of each item. Stock is bought wholesale into a storeroom, put
-- in a slot, and sells one unit at a time on its own. Training moves it: demand for a sport just
-- trained, foot traffic from the week's minutes, a pro athlete on a brick day, a wholesale crate for
-- every reward chest opened, and a specialty bonus. The rules are js/core/shop.js's
-- (tests/shop-sql.test.js holds them together).
--
--   user_shops       a market: its spot and level
--   user_shop_slots  what's in a market's slots: item, units left, and the clock of its sales
--   user_shop_stock  the storeroom: units of each item
--   shop_moves       every coin the markets take or pay (and each crate used)
--   wallet_fold()    as in 0033, with one more kind of event: the markets (rank 12)

create or replace function public.shop_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"spots":6,"buildCost":[300,600,1000,1500,2200,3000],"levels":[{"level":1,"slots":1,"capacity":10},{"level":2,"slots":2,"capacity":15,"cost":400},{"level":3,"slots":3,"capacity":20,"cost":700},{"level":4,"slots":4,"capacity":25,"cost":1100},{"level":5,"slots":5,"capacity":30,"cost":1600},{"level":6,"slots":6,"capacity":35,"cost":2300},{"level":7,"slots":7,"capacity":40,"cost":3200},{"level":8,"slots":8,"capacity":50,"cost":4500}],"buy":[2,3,5,8,12,18,26,40],"sell":[3,5,8,12,18,27,40,60],"minutes":[6,8,10,12,15,18,22,30],"stockMax":1000,"demand":{"hours":4,"bonus":0.3},"traffic":[{"id":"quiet","min":0,"f":1},{"id":"busy","min":60,"f":0.9},{"id":"bustling","min":150,"f":0.85},{"id":"festival","min":300,"f":0.8}],"specialty":0.1,"vip":1.5,"cratesSince":"2026-11-12","items":{"gym-rope":1,"gym-bands":1,"gym-shaker":2,"gym-towel":2,"gym-mat":3,"gym-gloves":3,"gym-roller":4,"gym-dumbbells":4,"gym-kettlebell":5,"gym-protein":5,"gym-medball":6,"gym-belt":6,"gym-massager":7,"gym-boots":7,"gym-gold-kettlebell":8,"bike-bottle":1,"bike-gloves":1,"bike-pump":2,"bike-repair":2,"bike-cap":3,"bike-lights":3,"bike-bars":4,"bike-jersey":4,"bike-shoes":5,"bike-helmet":5,"bike-computer":6,"bike-pedals":6,"bike-aero":7,"bike-wheel":7,"bike-gold-frame":8,"run-socks":1,"run-headband":1,"run-cap":2,"run-flask":2,"run-gels":3,"run-trainers":3,"run-shorts":4,"run-singlet":4,"run-belt":5,"run-vest":5,"run-shades":6,"run-hrstrap":6,"run-watch":7,"run-racers":7,"run-gold-watch":8,"swim-cap":1,"swim-goggles":1,"swim-plugs":2,"swim-towel":2,"swim-kickboard":3,"swim-buoy":3,"swim-paddles":4,"swim-fins":4,"swim-snorkel":5,"swim-mirror":5,"swim-bag":6,"swim-robe":6,"swim-trisuit":7,"swim-wetsuit":7,"swim-gold-goggles":8}}'::jsonb;
$$;

create table if not exists public.user_shops (
  user_id  uuid not null references auth.users (id) on delete cascade,
  spot     smallint not null check (spot between 1 and 6),
  level    smallint not null default 1 check (level between 1 and 8),
  built_at timestamptz not null default now(),
  primary key (user_id, spot)
);
create table if not exists public.user_shop_slots (
  user_id uuid not null references auth.users (id) on delete cascade,
  spot    smallint not null check (spot between 1 and 6),
  slot    smallint not null check (slot between 1 and 8),
  item    text not null,
  units   int not null check (units >= 0),
  since   timestamptz not null default now(),
  primary key (user_id, spot, slot)
);
create table if not exists public.user_shop_stock (
  user_id uuid not null references auth.users (id) on delete cascade,
  item    text not null,
  units   int not null check (units between 0 and 1000),
  primary key (user_id, item)
);
create table if not exists public.shop_moves (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (kind in ('build', 'upgrade', 'buy', 'sale', 'restock', 'crate', 'vip')),
  spot    smallint,
  coins   int not null,
  day     date not null default (now() at time zone 'utc')::date,
  at      timestamptz not null default now()
);
create index if not exists shop_moves_user on public.shop_moves (user_id, at);
create unique index if not exists shop_moves_vip_day on public.shop_moves (user_id, day) where kind = 'vip';

alter table public.user_shops enable row level security;
alter table public.user_shop_slots enable row level security;
alter table public.user_shop_stock enable row level security;
alter table public.shop_moves enable row level security;
drop policy if exists user_shops_own on public.user_shops;
create policy user_shops_own on public.user_shops for select using (user_id = auth.uid());
drop policy if exists user_shop_slots_own on public.user_shop_slots;
create policy user_shop_slots_own on public.user_shop_slots for select using (user_id = auth.uid());
drop policy if exists user_shop_stock_own on public.user_shop_stock;
create policy user_shop_stock_own on public.user_shop_stock for select using (user_id = auth.uid());
drop policy if exists shop_moves_own on public.shop_moves;
create policy shop_moves_own on public.shop_moves for select using (user_id = auth.uid());
grant select on public.user_shops, public.user_shop_slots, public.user_shop_stock, public.shop_moves to authenticated;

-- ---- the pieces of the rules ------------------------------------------------------------------

create or replace function public.shop_tier(p_item text)
returns int language sql immutable set search_path = public as $$
  select (public.shop_rules() -> 'items' ->> p_item)::int;
$$;
create or replace function public.shop_level_rules(p_level int)
returns jsonb language sql immutable set search_path = public as $$
  select public.shop_rules() -> 'levels' -> (greatest(1, least(8, p_level)) - 1);
$$;
create or replace function public.shop_price(p_item text, p_kind text)
returns int language sql immutable set search_path = public as $$
  select (public.shop_rules() -> p_kind ->> (public.shop_tier(p_item) - 1))::int;
$$;

/* The sports a session counts as: a brick is a bike and a run. */
create or replace function public.shop_sports(p_type text)
returns text[] language sql immutable set search_path = public as $$
  select case when p_type = 'brick' then array['bike', 'run']
              when p_type in ('gym', 'bike', 'run', 'swim') then array[p_type] else array[]::text[] end;
$$;

/* The traffic factor now: this week's minutes (from Monday, UTC). */
create or replace function public.shop_traffic(p_user uuid)
returns numeric language sql stable set search_path = public as $$
  with m as (
    select coalesce(sum(greatest(0, coalesce(w.duration_min, 0))), 0) as mins
    from public.workouts w
    where w.user_id = p_user and w.completed
      and w.date >= date_trunc('week', now() at time zone 'utc')::date and w.date <= (now() at time zone 'utc')::date
  )
  select coalesce((select (t ->> 'f')::numeric from jsonb_array_elements(public.shop_rules() -> 'traffic') t, m
                   where (t ->> 'min')::numeric <= m.mins order by (t ->> 'min')::numeric desc limit 1), 1);
$$;

/* The sports in demand now: a session finished in the last few hours. */
create or replace function public.shop_demand(p_user uuid)
returns text[] language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct s), array[]::text[])
  from public.workouts w, unnest(public.shop_sports(w.type)) s
  where w.user_id = p_user and w.completed and w.completed_at <= now()
    and w.completed_at > now() - make_interval(hours => (public.shop_rules() -> 'demand' ->> 'hours')::int);
$$;

/* Seconds to sell one unit of an item at a traffic factor. */
create or replace function public.shop_period(p_item text, p_f numeric)
returns numeric language sql immutable set search_path = public as $$
  select (public.shop_rules() -> 'minutes' ->> (public.shop_tier(p_item) - 1))::numeric * 60 * p_f;
$$;

/* Is every open slot (two or more) filled with one sport's gear? */
create or replace function public.shop_specialty(p_user uuid, p_spot int, p_level int)
returns boolean language sql stable set search_path = public as $$
  with open as (select (public.shop_level_rules(p_level) ->> 'slots')::int as n),
  s as (select split_part(x.item, '-', 1) as sport from public.user_shop_slots x, open
        where x.user_id = p_user and x.spot = p_spot and x.slot <= open.n and x.units > 0)
  select (select n from open) >= 2 and (select count(*) from s) = (select n from open) and (select count(distinct sport) from s) = 1;
$$;

/*
 * Take a market's sales so far: the coins go to the wallet (a 'sale' move), each slot's units go
 * down and its clock moves on by what it sold. Returns the coins. Called first by everything that
 * changes a market, so a change never touches what was already sold.
 */
create or replace function public.shop_settle(p_user uuid, p_spot int)
returns int language plpgsql set search_path = public as $$
declare
  lvl    int;
  f      numeric := public.shop_traffic(p_user);
  dem    text[] := public.shop_demand(p_user);
  spec   numeric;
  r      record;
  per    numeric;
  n      int;
  total  int := 0;
begin
  select level into lvl from public.user_shops where user_id = p_user and spot = p_spot;
  if lvl is null then return 0; end if;
  spec := case when public.shop_specialty(p_user, p_spot, lvl) then (public.shop_rules() ->> 'specialty')::numeric else 0 end;
  for r in select * from public.user_shop_slots
           where user_id = p_user and spot = p_spot and slot <= (public.shop_level_rules(lvl) ->> 'slots')::int and units > 0
  loop
    per := public.shop_period(r.item, f);
    n := least(r.units, floor(extract(epoch from (now() - r.since)) / per)::int);
    if n <= 0 then continue; end if;
    total := total + floor(n * public.shop_price(r.item, 'sell')
             * (1 + spec + case when split_part(r.item, '-', 1) = any (dem) then (public.shop_rules() -> 'demand' ->> 'bonus')::numeric else 0 end))::int;
    update public.user_shop_slots set units = units - n, since = since + make_interval(secs => (n * per)::double precision)
    where user_id = p_user and spot = p_spot and slot = r.slot;
  end loop;
  if total > 0 then insert into public.shop_moves (user_id, kind, spot, coins) values (p_user, 'sale', p_spot, total); end if;
  return total;
end;
$$;

create or replace function public.shop_uid()
returns uuid language plpgsql stable set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  return uid;
end;
$$;

create or replace function public.shop_pay(p_user uuid, p_cost int)
returns void language plpgsql set search_path = public as $$
declare bal bigint;
begin
  select f.coins into bal from public.wallet_fold(p_user) f;
  if bal < p_cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
end;
$$;

-- ---- what a player can do --------------------------------------------------------------------

create or replace function public.build_shop(p_spot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := public.shop_uid();
  cost int;
begin
  if p_spot not between 1 and (public.shop_rules() ->> 'spots')::int then raise exception 'gear:unknown_spot' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if not exists (select 1 from public.user_island i where i.user_id = uid and i.piece = 'market' and i.finishes_at <= now()) then
    raise exception 'gear:not_built' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_shops where user_id = uid and spot = p_spot) then raise exception 'gear:owned' using errcode = '22023'; end if;
  cost := (public.shop_rules() -> 'buildCost' ->> (select count(*)::int from public.user_shops where user_id = uid))::int;
  perform public.shop_pay(uid, cost);
  insert into public.user_shops (user_id, spot) values (uid, p_spot);
  insert into public.shop_moves (user_id, kind, spot, coins) values (uid, 'build', p_spot, -cost);
  return public.wallet_for(uid);
end;
$$;

create or replace function public.upgrade_shop(p_spot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := public.shop_uid();
  lvl  int;
  cost int;
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select level into lvl from public.user_shops where user_id = uid and spot = p_spot;
  if lvl is null then raise exception 'gear:not_owned' using errcode = '22023'; end if;
  if lvl >= 8 then raise exception 'gear:top_level' using errcode = '22023'; end if;
  perform public.shop_settle(uid, p_spot);
  cost := (public.shop_level_rules(lvl + 1) ->> 'cost')::int;
  perform public.shop_pay(uid, cost);
  update public.user_shops set level = lvl + 1 where user_id = uid and spot = p_spot;
  insert into public.shop_moves (user_id, kind, spot, coins) values (uid, 'upgrade', p_spot, -cost);
  return public.wallet_for(uid);
end;
$$;

create or replace function public.buy_shop_stock(p_item text, p_units int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := public.shop_uid();
  held int;
  cost int;
begin
  if public.shop_tier(p_item) is null then raise exception 'gear:unknown_item' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  held := coalesce((select units from public.user_shop_stock where user_id = uid and item = p_item), 0);
  if p_units < 1 or held + p_units > (public.shop_rules() ->> 'stockMax')::int then raise exception 'gear:too_many' using errcode = '22023'; end if;
  cost := p_units * public.shop_price(p_item, 'buy');
  perform public.shop_pay(uid, cost);
  insert into public.user_shop_stock (user_id, item, units) values (uid, p_item, p_units)
  on conflict (user_id, item) do update set units = public.user_shop_stock.units + excluded.units;
  insert into public.shop_moves (user_id, kind, coins) values (uid, 'buy', -cost);
  return public.wallet_for(uid);
end;
$$;

/* Put the storeroom's units of an item in a slot: up to what it holds; a different item's units go back first. */
create or replace function public.shop_stock_slot(p_spot int, p_slot int, p_item text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := public.shop_uid();
  lvl       int;
  cap       int;
  held      int;
  cur_item  text;
  cur_units int := 0;
  put       int;
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select level into lvl from public.user_shops where user_id = uid and spot = p_spot;
  if lvl is null then raise exception 'gear:not_owned' using errcode = '22023'; end if;
  if p_slot < 1 or p_slot > (public.shop_level_rules(lvl) ->> 'slots')::int then raise exception 'gear:locked' using errcode = '22023'; end if;
  if public.shop_tier(p_item) is null then raise exception 'gear:unknown_item' using errcode = '22023'; end if;
  if public.shop_tier(p_item) > lvl then raise exception 'gear:locked' using errcode = '22023'; end if;
  perform public.shop_settle(uid, p_spot);
  cap := (public.shop_level_rules(lvl) ->> 'capacity')::int;
  select item, units into cur_item, cur_units from public.user_shop_slots where user_id = uid and spot = p_spot and slot = p_slot;
  if cur_item is not null and cur_item <> p_item then
    if cur_units > 0 then
      insert into public.user_shop_stock (user_id, item, units) values (uid, cur_item, least(1000, cur_units))
      on conflict (user_id, item) do update set units = least(1000, public.user_shop_stock.units + excluded.units);
    end if;
    delete from public.user_shop_slots where user_id = uid and spot = p_spot and slot = p_slot;
    cur_item := null; cur_units := 0;
  end if;
  cur_units := coalesce(cur_units, 0);
  held := coalesce((select units from public.user_shop_stock where user_id = uid and item = p_item), 0);
  put := least(held, cap - cur_units);
  if put <= 0 then raise exception 'gear:nothing_to_put' using errcode = '22023'; end if;
  update public.user_shop_stock set units = units - put where user_id = uid and item = p_item;
  if cur_item is null then
    insert into public.user_shop_slots (user_id, spot, slot, item, units, since) values (uid, p_spot, p_slot, p_item, put, now());
  else
    -- an empty slot starts selling now; one still selling keeps its clock
    update public.user_shop_slots set units = units + put, since = case when units = 0 then now() else since end
    where user_id = uid and spot = p_spot and slot = p_slot;
  end if;
  return json_build_object('put', put);
end;
$$;

/* Take an item off a slot: its units go back to the storeroom. */
create or replace function public.shop_clear_slot(p_spot int, p_slot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := public.shop_uid();
  cur_item  text;
  cur_units int;
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  perform public.shop_settle(uid, p_spot);
  delete from public.user_shop_slots where user_id = uid and spot = p_spot and slot = p_slot returning item, units into cur_item, cur_units;
  if cur_item is not null and cur_units > 0 then
    insert into public.user_shop_stock (user_id, item, units) values (uid, cur_item, least(1000, cur_units))
    on conflict (user_id, item) do update set units = least(1000, public.user_shop_stock.units + excluded.units);
  end if;
  return json_build_object('back', coalesce(cur_units, 0));
end;
$$;

create or replace function public.collect_shop(p_spot int)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := public.shop_uid();
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  return json_build_object('coins', public.shop_settle(uid, p_spot));
end;
$$;

/* Fill every slot with an item back up: from the storeroom first, the rest bought wholesale. */
create or replace function public.restock_shop(p_spot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := public.shop_uid();
  lvl  int;
  cap  int;
  r    record;
  need int;
  have int;
  cost int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select level into lvl from public.user_shops where user_id = uid and spot = p_spot;
  if lvl is null then raise exception 'gear:not_owned' using errcode = '22023'; end if;
  perform public.shop_settle(uid, p_spot);
  cap := (public.shop_level_rules(lvl) ->> 'capacity')::int;
  for r in select * from public.user_shop_slots where user_id = uid and spot = p_spot
           and slot <= (public.shop_level_rules(lvl) ->> 'slots')::int order by slot
  loop
    need := cap - r.units;
    if need <= 0 then continue; end if;
    have := least(need, coalesce((select units from public.user_shop_stock where user_id = uid and item = r.item), 0));
    if have > 0 then update public.user_shop_stock set units = units - have where user_id = uid and item = r.item; end if;
    cost := cost + (need - have) * public.shop_price(r.item, 'buy');
    update public.user_shop_slots set units = cap, since = case when units = 0 then now() else since end
    where user_id = uid and spot = p_spot and slot = r.slot;
  end loop;
  if cost > 0 then
    perform public.shop_pay(uid, cost);
    insert into public.shop_moves (user_id, kind, spot, coins) values (uid, 'restock', p_spot, -cost);
  end if;
  return json_build_object('coins', cost);
end;
$$;

/* A wholesale crate: fills every slot with an item, free. One for each reward chest opened. */
create or replace function public.use_shop_crate(p_spot int)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := public.shop_uid();
  lvl  int;
  left_ int;
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select level into lvl from public.user_shops where user_id = uid and spot = p_spot;
  if lvl is null then raise exception 'gear:not_owned' using errcode = '22023'; end if;
  left_ := (select count(*) from public.reward_chests c where c.user_id = uid and c.opened_at is not null
             and (c.opened_at at time zone 'utc')::date >= (public.shop_rules() ->> 'cratesSince')::date)
         - (select count(*) from public.shop_moves m where m.user_id = uid and m.kind = 'crate');
  if left_ <= 0 then raise exception 'gear:no_crate' using errcode = '22023'; end if;
  perform public.shop_settle(uid, p_spot);
  update public.user_shop_slots set units = (public.shop_level_rules(lvl) ->> 'capacity')::int,
         since = case when units = 0 then now() else since end
  where user_id = uid and spot = p_spot and slot <= (public.shop_level_rules(lvl) ->> 'slots')::int;
  insert into public.shop_moves (user_id, kind, spot, coins) values (uid, 'crate', p_spot, 0);
  return json_build_object('crates', left_ - 1);
end;
$$;

/* A brick day's pro athlete: once a day, buys everything on the shelves of your best market at 1.5×. */
create or replace function public.shop_vip()
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := public.shop_uid();
  today date := (now() at time zone 'utc')::date;
  best  int;
  pay   int;
begin
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if (select count(distinct s) from public.workouts w, unnest(public.shop_sports(w.type)) s
      where w.user_id = uid and w.completed and w.date = today) < 2 then
    raise exception 'gear:no_brick' using errcode = '22023';
  end if;
  if exists (select 1 from public.shop_moves where user_id = uid and kind = 'vip' and day = today) then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  select spot into best from public.user_shops where user_id = uid order by level desc, spot limit 1;
  if best is null then raise exception 'gear:not_owned' using errcode = '22023'; end if;
  perform public.shop_settle(uid, best);
  select coalesce(sum(floor(units * public.shop_price(item, 'sell') * (public.shop_rules() ->> 'vip')::numeric)), 0)::int into pay
  from public.user_shop_slots x, public.user_shops s
  where x.user_id = uid and x.spot = best and s.user_id = uid and s.spot = best and x.slot <= (public.shop_level_rules(s.level) ->> 'slots')::int;
  if pay <= 0 then raise exception 'gear:nothing_to_sell' using errcode = '22023'; end if;
  update public.user_shop_slots set units = 0 where user_id = uid and spot = best;
  insert into public.shop_moves (user_id, kind, spot, coins, day) values (uid, 'vip', best, pay, today);
  return json_build_object('coins', pay, 'spot', best);
end;
$$;

-- ---- the wallet: the markets (rank 12) ---------------------------------------------------------

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

grant execute on function public.shop_rules() to authenticated, anon;
grant execute on function public.build_shop(int) to authenticated;
grant execute on function public.upgrade_shop(int) to authenticated;
grant execute on function public.buy_shop_stock(text, int) to authenticated;
grant execute on function public.shop_stock_slot(int, int, text) to authenticated;
grant execute on function public.shop_clear_slot(int, int) to authenticated;
grant execute on function public.collect_shop(int) to authenticated;
grant execute on function public.restock_shop(int) to authenticated;
grant execute on function public.use_shop_crate(int) to authenticated;
grant execute on function public.shop_vip() to authenticated;
revoke execute on function public.shop_settle(uuid, int) from public, anon, authenticated;
revoke execute on function public.shop_pay(uuid, int) from public, anon, authenticated;
