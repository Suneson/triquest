# Friends, chat, notifications and the XP rule

## XP: who earns it
A session earns XP when it is **completed** and either has **Strava proof**
(`strava_activity_id` or `source = 'strava'`) or is a **gym session logged in
the app** (Finish/Save stamps `gymLoggedAt` and sets `completed`). Every other
sport still needs Strava. One rule everywhere:
- app: `earnsXp()` in `js/core/scoring.js` (stats, levels, quests via `isVerified`)
- database: `public.earns_xp(...)` in `supabase/migrations/0008_xp_rule.sql`,
  used by `leaderboard` and `claim_quest`

Gym Finish/Save (`finishPatch` in `js/core/gym-log.js`) completes the session,
freezes the clock at the logged duration and keeps it on later saves.

## Navigation
Tabs: Home · Shop · Ranks · **Chat** · Profile. The Journal opens from a green
button beside today's date on Home (Home stays lit while it's open).

## Social (`supabase/migrations/0009_social.sql`)
- `profiles.username`: unique, 3–20 of `a-z 0-9 _`, generated for everyone
  (`make_username`), editable from the Chat tab (`set_username`).
- `friendships`: one row per pair; `pending` → `accepted`; declining or
  removing sets `ended_at` (asking again revives the row). RPCs:
  `request_friend`, `respond_friend`, `remove_friend`, `my_friends`, `find_user`.
- `messages`: readable by sender and recipient; insertable only to an
  accepted friend (`messages_send` policy); `mark_chat_read`.
- `notifications`: per user, or `user_id null` for app news (read state for
  news is per device in localStorage). `mark_notifications_read`.
- Realtime: `messages`, `friendships`, `notifications` are in the
  `supabase_realtime` publication; RLS decides who receives what.

## App
- `js/app/social.js`: state, loading, realtime, actions. New requests,
  notifications and messages light the bell and buzz through
  `js/app/haptics.js`: **Android only**. iOS Safari, iOS browsers and
  installed iOS web apps have no Vibration API, so on iPhone the bell lights
  but doesn't vibrate.
- `js/core/social.js`: pure counting (threads, unread, bell count), tested.
- `js/app/chat.js`: Chat tab (username, add by username, requests, threads,
  conversation with a sticky composer), the bell sheet, the Add friend /
  Message button on an athlete's profile (from Ranks).
- `?demo=1` fills friends and chats with sample data (no network).

## General (phase 5 of the polish pass)
One public room for everyone signed in, next to Direct messages. The Chat
tab opens on a two-way switch, **General | Direct**, which remembers the last
choice; each side shows its own unread count and the tab badge adds them up.

**Database** (`supabase/migrations/0012_general_chat.sql`):
- `room_messages (id, user_id, body, client_id, created_at, deleted_at)`.
  Anyone signed in reads and posts as themselves. 1–500 characters. A
  trigger caps posts at **10 a minute** per account and stamps the server's
  time. Index on `created_at` for paging. In the realtime publication.
- Removal is soft: `remove_room_message(id)` (the author, or an app admin)
  sets `deleted_at` and blanks the text; the row stays as "Message removed".
- `user_blocks`: your own list (`block_user` / `unblock_user`, soft like
  friendships). Blocked authors' messages fold to "Message hidden" for you.
- `room_reports`: "Report message" files a row (one per person per message).
  `owner_room_reports()` / `resolve_room_report()` are for the owner.
- `app_admins`: who may remove anyone's message and read reports. The
  migration adds the owner's account.
- `room_authors()`: name, @username, avatar and XP of everyone who has
  posted, for the level chip.

**Client**: `js/core/room.js` (rules: length, rate, unread, block/remove
display, optimistic reconcile; tested), `js/app/room.js` (data, realtime,
paging back, optimistic send with retry/discard, offline state, actions),
`js/app/room-view.js` (drawing). Unread in General is per device
(localStorage), like app news.
