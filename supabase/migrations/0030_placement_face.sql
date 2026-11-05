-- 0030_placement_face.sql — which way an item in the compound faces (docs/ITEMS-3D.md).
-- The base items are pictures in two facings: 'a' (front down-left) and 'b' (turned 90 degrees,
-- front down-right; its footprint turned too). Null: the item's own default facing.
alter table public.user_placements add column if not exists face text;
alter table public.user_placements drop constraint if exists user_placements_face_check;
alter table public.user_placements add constraint user_placements_face_check check (face is null or face in ('a', 'b'));
