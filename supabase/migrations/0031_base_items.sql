-- 0031_base_items.sql — base items you own, and the stash (docs/ITEMS-3D.md).
-- user_base_items: the furniture you own outright. It's separate from user_gear, which is tied to
-- the shop's catalogue and its boosts: a base item is cosmetic. Only the server can grant one.
-- user_placements.stashed: the item is put away, in the inventory's Stash tab, and stands nowhere.
create table if not exists public.user_base_items (
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     text not null check (item_id ~ '^[a-z0-9-]{1,40}$'),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_base_items enable row level security;
drop policy if exists user_base_items_read on public.user_base_items;
create policy user_base_items_read on public.user_base_items for select using (user_id = auth.uid());
revoke all on public.user_base_items from anon;
grant select on public.user_base_items to authenticated;

alter table public.user_placements add column if not exists stashed boolean not null default false;
