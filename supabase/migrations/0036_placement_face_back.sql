-- 0036_placement_face_back.sql — the back facings c and d (js/core/placement.js, orient).
-- The club room's items are painted from all four sides: 'c' is the back of 'a' (turned half
-- round, same footprint), 'd' the back of 'b'. Until this is live, a c or d facing is kept on the
-- device only (placement-state.js saves the spot without it).
alter table public.user_placements drop constraint if exists user_placements_face_check;
alter table public.user_placements add constraint user_placements_face_check check (face is null or face in ('a', 'b', 'c', 'd'));
