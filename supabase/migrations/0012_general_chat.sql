-- 0012: General chat — one public room for everyone with an account.
--
-- room_messages      anyone signed in reads and posts; text is 1–500 chars;
--                    at most 10 posts a minute (trigger); removal is soft
--                    (deleted_at set, body blanked) and goes through
--                    remove_room_message(): the author or an app admin.
-- user_blocks        your own mute list (block_user / unblock_user); the
--                    client folds a blocked author's messages to "message hidden".
-- room_reports       "report this message": the reporter files a row, an app
--                    admin reviews them (owner_room_reports()).
-- app_admins         who may remove anyone's message and read reports.
--
-- Written without DELETE/DROP/REVOKE statements: removal is a soft delete
-- through a checked function, and nothing is ever dropped.

-- ---- admins --------------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- no policies: only security-definer functions read it

create or replace function public.is_app_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = p_user);
$$;

-- the app's owner is the first admin
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = 'albertosuneson@gmail.com'
on conflict (user_id) do nothing;

-- ---- the room ---------------------------------------------------------------------------
create table if not exists public.room_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  client_id  text,                       -- the sender's temporary id, so an optimistic bubble can be matched
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint room_messages_body_len check (
    (deleted_at is null and char_length(btrim(body)) between 1 and 500)
    or (deleted_at is not null and body = '')
  ),
  constraint room_messages_client_id_len check (client_id is null or char_length(client_id) <= 64)
);
create index if not exists room_messages_created on public.room_messages (created_at desc, id desc);
create index if not exists room_messages_user_time on public.room_messages (user_id, created_at desc);
alter table public.room_messages enable row level security;

create policy room_read on public.room_messages for select
  using (auth.uid() is not null);
create policy room_post on public.room_messages for insert
  with check (auth.uid() = user_id and deleted_at is null);
-- no update or removal policies: removal goes through remove_room_message()

-- rate limit: 10 posts a minute per account, checked on the server
create or replace function public.room_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.room_messages
       where user_id = new.user_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Slow down: at most 10 messages a minute' using errcode = 'P0001';
  end if;
  new.created_at := now(); -- the server's clock, not the client's
  return new;
end;
$$;
create trigger room_rate_limit before insert on public.room_messages
  for each row execute function public.room_rate_limit();

-- soft removal: the author, or an app admin. The text is blanked, the row stays.
create or replace function public.remove_room_message(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  update public.room_messages set deleted_at = now(), body = ''
   where id = p_id and deleted_at is null and (user_id = uid or public.is_app_admin(uid));
  if not found then raise exception 'not yours to remove' using errcode = '42501'; end if;
end;
$$;

-- who wrote in the room: name, username, avatar and total XP (for the level chip)
create or replace function public.room_authors()
returns table (user_id uuid, display_name text, username text, avatar text, xp bigint)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.display_name, 'Athlete'), p.username, p.settings ->> 'avatar', coalesce(l.xp, 0)::bigint
  from public.profiles p
  left join public.leaderboard(null) l on l.user_id = p.id
  where auth.uid() is not null
    and exists (select 1 from public.room_messages m where m.user_id = p.id);
$$;

-- ---- blocks -----------------------------------------------------------------------------
-- A block is a row; unblocking marks it ended (unblocked_at) and blocking
-- again revives it, the same soft pattern as friendships.
create table if not exists public.user_blocks (
  blocker      uuid not null references auth.users(id) on delete cascade,
  blocked      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unblocked_at timestamptz,
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;
create policy blocks_read on public.user_blocks for select using (auth.uid() = blocker);
-- writes go through block_user / unblock_user

create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'pick someone else' using errcode = '22023'; end if;
  insert into public.user_blocks (blocker, blocked) values (auth.uid(), p_user)
  on conflict (blocker, blocked) do update set unblocked_at = null, created_at = now();
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update public.user_blocks set unblocked_at = now()
   where blocker = auth.uid() and blocked = p_user and unblocked_at is null;
$$;

-- ---- reports ----------------------------------------------------------------------------
create table if not exists public.room_reports (
  id          bigint generated always as identity primary key,
  message_id  bigint not null references public.room_messages(id) on delete cascade,
  reporter    uuid not null references auth.users(id) on delete cascade,
  reason      text check (reason is null or char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (message_id, reporter)
);
alter table public.room_reports enable row level security;
create policy reports_file on public.room_reports for insert with check (auth.uid() = reporter and resolved_at is null);
create policy reports_own on public.room_reports for select using (auth.uid() = reporter);

-- for the owner: open reports with the message and both people
create or replace function public.owner_room_reports()
returns table (report_id bigint, message_id bigint, body text, author uuid, reporter uuid, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, m.id, m.body, m.user_id, r.reporter, r.reason, r.created_at
  from public.room_reports r join public.room_messages m on m.id = r.message_id
  where public.is_app_admin() and r.resolved_at is null
  order by r.created_at desc;
$$;

create or replace function public.resolve_room_report(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.room_reports set resolved_at = now() where id = p_id and public.is_app_admin();
$$;

-- ---- grants + live updates --------------------------------------------------------------
grant execute on function public.remove_room_message(bigint), public.room_authors(), public.is_app_admin(uuid),
  public.block_user(uuid), public.unblock_user(uuid),
  public.owner_room_reports(), public.resolve_room_report(bigint) to authenticated;

alter publication supabase_realtime add table public.room_messages;
