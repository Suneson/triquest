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
- `js/app/social.js`: state, loading, realtime, actions (buzzes on new
  requests/notifications/messages).
- `js/core/social.js`: pure counting (threads, unread, bell count), tested.
- `js/app/chat.js`: Chat tab (username, add by username, requests, threads,
  conversation with a sticky composer), the bell sheet, the Add friend /
  Message button on an athlete's profile (from Ranks).
- `?demo=1` fills friends and chats with sample data (no network).
