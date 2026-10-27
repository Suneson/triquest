-- 0024: where your compound items stand (docs/COMPOUND.md). One row per item:
-- the room and the tile of its back corner. Written by the app when you move an
-- item (placement-state.js); only you can read or change your rows. The rules
-- about walls, water and collisions live in js/core/placement.js: a position is
-- cosmetic, so a stale or odd row is simply moved to a free tile when drawn.

create table if not exists public.user_placements (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id    text not null check (item_id ~ '^[a-z0-9-]{1,40}$'),
  room       text not null check (room in ('gym', 'pool', 'bike', 'run', 'locker')),
  u          int not null check (u between 0 and 31),
  v          int not null check (v between 0 and 31),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_placements enable row level security;
drop policy if exists user_placements_read on public.user_placements;
create policy user_placements_read on public.user_placements for select using (user_id = auth.uid());
drop policy if exists user_placements_insert on public.user_placements;
create policy user_placements_insert on public.user_placements for insert with check (user_id = auth.uid());
drop policy if exists user_placements_update on public.user_placements;
create policy user_placements_update on public.user_placements for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_placements_delete on public.user_placements;
create policy user_placements_delete on public.user_placements for delete using (user_id = auth.uid());
revoke all on public.user_placements from anon;
grant select, insert, update, delete on public.user_placements to authenticated;
