-- 0037: items can be placed in the club room (the club house on the club grounds).
alter table public.user_placements drop constraint user_placements_room_check;
alter table public.user_placements add constraint user_placements_room_check
  check (room in ('gym', 'pool', 'bike', 'run', 'locker', 'club'));
