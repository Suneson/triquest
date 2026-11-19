-- 0038_builders.sql: hiring the base's builders (js/core/builders.js, docs/PLOT.md).
-- Everyone has the blue builder, the head mechanic, from the start (no row). The red, green and gold
-- builders are hired once, for coins, from the shop's Base tab, and are yours at once: a user_gear
-- row the client reads with the rest of the inventory, and a coin_spends row taken off the wallet.
-- Their huts are placed like any item (user_placements).
--
-- Rules this file keeps:
--   - Builder rows are props with slot 'builder', so the catalog's kind check stays as it is.
--     Prices mirror BUILDERS in js/core/builders.js (tests/builders-sql.test.js checks they match).
--   - Only buy_builder() hires one; buy_gear() refuses them (it would send a prop to the workshop).

insert into public.gear_catalog (id, kind, sport, slot, tier, cost, boost_bp, currency) values
  ('builder-red', 'prop', null, 'builder', null, 1500, 0, 'coins'),
  ('builder-green', 'prop', null, 'builder', null, 3000, 0, 'coins'),
  ('builder-gold', 'prop', null, 'builder', null, 6000, 0, 'coins')
on conflict (id) do update set kind = excluded.kind, slot = excluded.slot, cost = excluded.cost, currency = excluded.currency;

create or replace function public.buy_builder(p_item text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c   public.gear_catalog;
  bal bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  select * into c from public.gear_catalog where id = p_item and kind = 'prop' and slot = 'builder';
  if not found then raise exception 'gear:unknown_item' using errcode = '22023'; end if;
  if exists (select 1 from public.user_gear where user_id = uid and item_id = c.id) then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < c.cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.coin_spends (user_id, item_id, coins, currency) values (uid, c.id, c.cost, 'coins');
  insert into public.user_gear (user_id, item_id) values (uid, c.id);
  return public.wallet_for(uid);
end;
$$;
revoke all on function public.buy_builder(text) from public, anon;
grant execute on function public.buy_builder(text) to authenticated;

-- buy_gear() as in 0025, but the builders aren't for sale here
create or replace function public.buy_gear(p_item_id text)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  c    public.gear_catalog;
  bal  bigint;
  sid  bigint;
  mins int;
  pick record;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  perform public.workshop_settle(uid);
  select * into c from public.gear_catalog where id = p_item_id;
  if not found then raise exception 'gear:unknown_item' using errcode = '22023'; end if;
  -- the stall's items are only sold by buy_stall(), on their day
  if c.kind = 'prop' and c.slot = 'decor' then raise exception 'gear:stall_only' using errcode = '22023'; end if;
  -- builders are only hired by buy_builder(), never fitted in the workshop
  if c.kind = 'prop' and c.slot = 'builder' then raise exception 'gear:builder_only' using errcode = '22023'; end if;
  if c.kind in ('gear', 'prop', 'kit') then
    if c.kind = 'gear' and c.tier = 0 then raise exception 'gear:starter' using errcode = '22023'; end if;
    if exists (select 1 from public.user_gear where user_id = uid and item_id = c.id) then
      raise exception 'gear:owned' using errcode = '22023';
    end if;
    if exists (select 1 from public.workshop_jobs where user_id = uid and item_id = c.id and state = 'queued') then
      raise exception 'gear:in_workshop' using errcode = '22023';
    end if;
    -- the tier below must be owned or already in the workshop ahead of it
    if c.kind = 'gear' and c.tier > 1 and not exists (
      select 1 from public.gear_catalog p
      where p.kind = 'gear' and p.sport = c.sport and p.slot = c.slot and p.tier = c.tier - 1
        and (exists (select 1 from public.user_gear g where g.user_id = uid and g.item_id = p.id)
          or exists (select 1 from public.workshop_jobs j where j.user_id = uid and j.item_id = p.id and j.state = 'queued'))
    ) then
      raise exception 'gear:tier_locked' using errcode = '22023';
    end if;
  else -- fuel
    if public.fuel_held(uid, c.id) >= (public.gear_rules() -> 'fuel' -> 'items' -> c.id ->> 'maxHeld')::int then
      raise exception 'gear:fuel_full' using errcode = '22023';
    end if;
  end if;
  select case when c.currency = 'carbs' then f.carbs else f.coins end into bal from public.wallet_fold(uid) f;
  if bal < c.cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.coin_spends (user_id, item_id, coins, currency) values (uid, c.id, c.cost, c.currency) returning id into sid;
  if c.kind = 'kit' then
    insert into public.user_gear (user_id, item_id) values (uid, c.id);
  elsif c.kind in ('gear', 'prop') then
    mins := public.workshop_fit_min(c.id);
    -- placeJob(): the bay that frees up first (lowest number on a tie), from then or now
    select b.bay, greatest(now(), coalesce(max(j.finishes_at), now())) as start_at into pick
    from generate_series(1, public.workshop_bays(uid)) b(bay)
    left join public.workshop_jobs j on j.user_id = uid and j.bay = b.bay and j.state = 'queued' and j.finishes_at > now()
    group by b.bay
    order by 2, 1
    limit 1;
    insert into public.workshop_jobs (user_id, item_id, spend_id, cost, bay, started_at, finishes_at)
    values (uid, c.id, sid, c.cost, pick.bay, pick.start_at, pick.start_at + make_interval(mins => mins));
  end if;
  return public.wallet_for(uid);
end;
$$;
