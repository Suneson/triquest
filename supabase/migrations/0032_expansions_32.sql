-- 0032_expansions_32.sql — the third and last size of a room: 8 x 8, 16 x 16, 32 x 32 (docs/ROOMS3D.md).
--
-- Each step is bought once per room, for good, the next only after the one before. Rows from before
-- this migration are the 16 x 16 step. wallet_fold() needs no change: every row is one more payment.
-- The rules are js/core/expansions.js's (tests/expansions-sql.test.js holds them together).

create or replace function public.expansion_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"cost":1000,"cost32":5000,"rooms":["locker","gym","bike","run","pool"],"ready":["locker"],"ready32":["locker"]}'::jsonb;
$$;

alter table public.user_expansions add column if not exists size int not null default 16 check (size in (16, 32));
alter table public.user_expansions drop constraint if exists user_expansions_pkey;
alter table public.user_expansions add primary key (user_id, room, size);

drop function if exists public.buy_expansion(text);
create or replace function public.buy_expansion(p_room text, p_size int default 16)
returns json language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  rules jsonb := public.expansion_rules();
  cost  int;
  bal   bigint;
begin
  if uid is null then raise exception 'gear:not_signed_in' using errcode = '28000'; end if;
  if not (rules -> 'rooms') @> to_jsonb(p_room) then
    raise exception 'gear:unknown_room' using errcode = '22023';
  end if;
  if p_size is null or p_size not in (16, 32) then
    raise exception 'gear:unknown_size' using errcode = '22023';
  end if;
  if not (rules -> (case when p_size = 32 then 'ready32' else 'ready' end)) @> to_jsonb(p_room) then
    raise exception 'gear:coming_soon' using errcode = '22023';
  end if;
  cost := (rules ->> (case when p_size = 32 then 'cost32' else 'cost' end))::int;
  perform pg_advisory_xact_lock(hashtext('gear:' || uid::text));
  if exists (select 1 from public.user_expansions x where x.user_id = uid and x.room = p_room and x.size = p_size) then
    raise exception 'gear:owned' using errcode = '22023';
  end if;
  if p_size = 32 and not exists (select 1 from public.user_expansions x where x.user_id = uid and x.room = p_room and x.size = 16) then
    raise exception 'gear:needs_16' using errcode = '22023';
  end if;
  select f.coins into bal from public.wallet_fold(uid) f;
  if bal < cost then raise exception 'gear:insufficient' using errcode = '22023'; end if;
  insert into public.user_expansions (user_id, room, size, cost, bought_at) values (uid, p_room, p_size, cost, now());
  return public.wallet_for(uid);
end;
$$;

grant execute on function public.expansion_rules() to authenticated, anon;
grant execute on function public.buy_expansion(text, int) to authenticated;
