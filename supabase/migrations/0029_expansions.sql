-- 0029_expansions.sql — taking a room from 8 x 8 to 16 x 16 (docs/ROOMS3D.md).
--
-- Every room starts as the painted 8 x 8 room in the middle of its floor's roof. Expanding it
-- buys the 16 x 16 room, which fills the whole roof. Bought once per room, for good, for
-- 1,000 coins; only rooms whose 16 x 16 model is in can be bought (the locker room, so far).
-- The rules are js/core/expansions.js's (tests/expansions-sql.test.js holds them together).
--
--   user_expansions   the rooms you've expanded, and what each cost
--   wallet_fold()     as in 0028, with one more kind of event: a room expanded (rank 10, paid out)

create or replace function public.expansion_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"cost":1000,"rooms":["locker","gym","bike","run","pool"],"ready":["locker"]}'::jsonb;
$$;

create table if not exists public.user_expansions (
  user_id   uuid not null references auth.users (id) on delete cascade,
  room      text not null,
  cost      int not null check (cost >= 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, room)
);
alter table public.user_expansions enable row level security;
drop policy if exists user_expansions_own on public.user_expansions;
create policy user_expansions_own on public.user_expansions for select using (user_id = auth.uid());
grant select on public.user_expansions to authenticated;

create or replace function public.buy_expansion(p_room text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  cost int := (public.expansion_rules() ->> 'cost')::int;
  bal  bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if not (public.expansion_rules() -> 'rooms') @> to_jsonb(p_room) then
    raise exception 'gear:unknown_room' using errcode = '22023';
  end if;
  if not (public.expansion_rules() -> 'ready') @> to_jsonb(p_room) then
    raise exception 'gear:coming_soon' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if exists (select 1 from public.user_expansions where user_id = uid and room = p_room) then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.user_expansions (user_id, room, cost, bought_at) values (uid, p_room, cost, now());
  return public.wallet_for(uid);
end;
$$;

-- ---- the wallet: rooms expanded (rank 10) --------------------------------------------------

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

grant execute on function public.expansion_rules() to authenticated, anon;
grant execute on function public.buy_expansion(text) to authenticated;
