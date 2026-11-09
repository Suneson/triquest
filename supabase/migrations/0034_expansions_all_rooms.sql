-- 0034_expansions_all_rooms.sql: every room can now be expanded to 16 x 16 and 32 x 32.
--
-- The app still offers the four sport rooms only to admins until all their levels exist (js/core/expansions.js).

create or replace function public.expansion_rules()
returns jsonb language sql immutable set search_path = public as $$
  select '{"cost":1000,"cost32":5000,"rooms":["locker","gym","bike","run","pool"],"ready":["locker","gym","bike","run","pool"],"ready32":["locker","gym","bike","run","pool"]}'::jsonb;
$$;
