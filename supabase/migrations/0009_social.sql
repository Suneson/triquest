-- 0009: friends, direct messages and notifications.
-- Usernames are unique, lowercase, 3-20 of [a-z0-9_]. Every write goes through
-- a security-definer RPC that checks auth.uid(); tables only allow reads of
-- your own rows (and direct inserts of messages to accepted friends).

-- ---- usernames ------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9_]{3,20}$');
  end if;
end $$;
create unique index if not exists profiles_username_key on public.profiles (username);

create or replace function public.make_username(p_seed text, p_id uuid)
returns text language sql immutable set search_path = public as $$
  select left(coalesce(nullif(regexp_replace(lower(coalesce(p_seed, '')), '[^a-z0-9_]', '', 'g'), ''), 'athlete'), 14)
         || '_' || substr(replace(p_id::text, '-', ''), 1, 5);
$$;

update public.profiles set username = public.make_username(display_name, id) where username is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text := coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, v_name, public.make_username(v_name, new.id))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---- tables ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id           bigint generated always as identity primary key,
  requester    uuid not null references auth.users(id) on delete cascade,
  addressee    uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
create policy friendships_read on public.friendships for select
  using (auth.uid() = requester or auth.uid() = addressee);

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists messages_pair_time on public.messages (sender, recipient, created_at desc);
create index if not exists messages_recipient_unread on public.messages (recipient) where read_at is null;
alter table public.messages enable row level security;

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete cascade,   -- null = for everyone (app news)
  kind       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select
  using (user_id = auth.uid() or user_id is null);

-- ---- friendship helpers + RPCs ---------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and least(f.requester, f.addressee) = least(a, b)
                   and greatest(f.requester, f.addressee) = greatest(a, b));
$$;

create policy messages_read on public.messages for select
  using (auth.uid() = sender or auth.uid() = recipient);
create policy messages_send on public.messages for insert
  with check (auth.uid() = sender and read_at is null and public.are_friends(sender, recipient));

create or replace function public.set_username(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v text := lower(btrim(coalesce(p_username, '')));
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if v !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3-20 letters, numbers or _' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where username = v and id <> uid) then
    raise exception 'That username is taken' using errcode = '23505';
  end if;
  update public.profiles set username = v, updated_at = now() where id = uid;
  return v;
end;
$$;

create or replace function public.my_username()
returns text language sql stable security definer set search_path = public as $$
  select username from public.profiles where id = auth.uid();
$$;

create or replace function public.find_user(p_username text)
returns table (user_id uuid, display_name text, username text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, 'Athlete'), p.username, p.settings ->> 'avatar'
  from public.profiles p
  where auth.uid() is not null and p.username = lower(btrim(p_username)) and p.id <> auth.uid();
$$;

-- Declining or removing a friend marks the row ended (ended_at) instead of
-- deleting it; asking again later revives the same row.
alter table public.friendships add column if not exists ended_at timestamptz;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f
                 where f.status = 'accepted' and f.ended_at is null
                   and least(f.requester, f.addressee) = least(a, b)
                   and greatest(f.requester, f.addressee) = greatest(a, b));
$$;

create or replace function public.request_friend(p_user uuid)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); f public.friendships; v_name text; v_found boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_user is null or p_user = uid then raise exception 'pick someone else' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such athlete' using errcode = '22023';
  end if;
  select coalesce(display_name, 'An athlete') into v_name from public.profiles where id = uid;
  select * into f from public.friendships
   where least(requester, addressee) = least(uid, p_user) and greatest(requester, addressee) = greatest(uid, p_user);
  v_found := found;
  if v_found and f.ended_at is null then
    if f.status = 'accepted' then return json_build_object('status', 'friends'); end if;
    if f.addressee = uid then
      update public.friendships set status = 'accepted', responded_at = now() where id = f.id;
      update public.notifications set read_at = now()
       where user_id = uid and kind = 'friend_request' and (data ->> 'friendship_id')::bigint = f.id and read_at is null;
      insert into public.notifications (user_id, kind, title, data)
      values (p_user, 'friend_accepted', v_name || ' accepted your friend request', json_build_object('user_id', uid)::jsonb);
      return json_build_object('status', 'friends');
    end if;
    return json_build_object('status', 'pending');
  end if;
  if v_found then
    update public.friendships
       set requester = uid, addressee = p_user, status = 'pending', created_at = now(), responded_at = null, ended_at = null
     where id = f.id returning * into f;
  else
    insert into public.friendships (requester, addressee) values (uid, p_user) returning * into f;
  end if;
  insert into public.notifications (user_id, kind, title, data)
  values (p_user, 'friend_request', v_name || ' wants to be friends',
          json_build_object('user_id', uid, 'friendship_id', f.id)::jsonb);
  return json_build_object('status', 'pending');
end;
$$;

create or replace function public.respond_friend(p_id bigint, p_accept boolean)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); f public.friendships; v_name text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into f from public.friendships where id = p_id and addressee = uid and status = 'pending' and ended_at is null;
  if not found then raise exception 'no such request' using errcode = '22023'; end if;
  update public.notifications set read_at = now()
   where user_id = uid and kind = 'friend_request' and (data ->> 'friendship_id')::bigint = p_id and read_at is null;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = p_id;
    select coalesce(display_name, 'An athlete') into v_name from public.profiles where id = uid;
    insert into public.notifications (user_id, kind, title, data)
    values (f.requester, 'friend_accepted', v_name || ' accepted your friend request', json_build_object('user_id', uid)::jsonb);
    return json_build_object('status', 'friends');
  end if;
  update public.friendships set responded_at = now(), ended_at = now() where id = p_id;
  return json_build_object('status', 'declined');
end;
$$;

create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.friendships set ended_at = now()
   where ended_at is null
     and least(requester, addressee) = least(uid, p_user) and greatest(requester, addressee) = greatest(uid, p_user);
end;
$$;

create or replace function public.my_friends()
returns table (friendship_id bigint, user_id uuid, display_name text, username text, avatar text,
               status text, incoming boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id,
         o.id, coalesce(o.display_name, 'Athlete'), o.username, o.settings ->> 'avatar',
         f.status, f.addressee = auth.uid(), f.created_at
  from public.friendships f
  join public.profiles o on o.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee) and f.ended_at is null
  order by f.status, f.created_at desc;
$$;

create or replace function public.mark_chat_read(p_from uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where recipient = auth.uid() and sender = p_from and read_at is null;
$$;

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.set_username(text), public.my_username(), public.find_user(text),
  public.request_friend(uuid), public.respond_friend(bigint, boolean), public.remove_friend(uuid),
  public.my_friends(), public.mark_chat_read(uuid), public.mark_notifications_read() to authenticated;

-- ---- live updates ------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.friendships, public.notifications;

-- ---- app news: the first broadcast -------------------------------------------------------
insert into public.notifications (user_id, kind, title, body)
values (null, 'app_update', 'New: Chat with your friends',
        'Add friends from Ranks or by username in the Chat tab, then message them. Gym sessions you log now earn XP without Strava.');
