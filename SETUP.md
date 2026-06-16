# TriQuest — Backend Setup

TriQuest works **fully offline and local-only with no setup**. The cloud features
(multi-device sync + Strava auto-sync) are optional and gated behind config flags.

## ✅ Already done (provisioned via the Supabase connector)

- Supabase project **`triquest`** created (`kmanszmqgmyninoplwbt`, region eu-west-3).
- Schema + RLS applied (`profiles`, `workouts`, `strava_accounts`), definer functions
  locked down, realtime enabled. Mirrored in `supabase/migrations/0001_init.sql`.
- Project URL + anon key wired into `js/app/config.js`.
- The three Edge Functions deployed: `strava-callback`, `strava-webhook`, `strava-sync`.

**Multi-device sync is live now** — open the app, *Settings → Sign in to sync*.

---

## 🔶 To turn on Strava — your remaining steps (~10 min)

You only need to create the Strava app and set two secrets; everything else is deployed.

### 1. Create a Strava API application
Go to **https://www.strava.com/settings/api** → create an app:
- **Website**: `https://suneson.github.io/triquest/`
- **Authorization Callback Domain** (no `https://`): `kmanszmqgmyninoplwbt.functions.supabase.co`

Note your **Client ID** (public) and **Client Secret** (🔴 keep private).

### 2. Set the Edge Function secrets
**Supabase Dashboard → Project Settings → Edge Functions → Secrets** (no CLI needed),
add:

| Name | Value |
|---|---|
| `STRAVA_CLIENT_ID` | your Strava Client ID |
| `STRAVA_CLIENT_SECRET` | 🔴 your Strava Client Secret |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | any random string you invent (only needed for step 4) |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
`APP_REDIRECT_URL` defaults to the live site — only set it if you fork the URL.

### 3. Add the public Client ID to the frontend
Put your Client ID in `js/app/config.js` → `stravaClientId`, commit, and push
(or just send me the Client ID — it's public — and I'll commit it). The
**Connect Strava** button then appears in Settings.

Now: **Settings → Connect Strava → authorize → Sync now.** Activities import and
auto-match to your planned sessions. This works on polling alone.

### 4. (Optional) Live push via webhook
For instant import the moment you finish an activity, register the push
subscription once (uses the secret you set; run anywhere with Deno, or use curl):

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=<CLIENT_ID> \
  -F client_secret=<CLIENT_SECRET> \
  -F callback_url=https://kmanszmqgmyninoplwbt.functions.supabase.co/strava-webhook \
  -F verify_token=<STRAVA_WEBHOOK_VERIFY_TOKEN>
```
Strava immediately validates the callback (the function echoes the challenge).
A Deno helper with `list`/`delete` subcommands is at
`supabase/functions/_scripts/register-webhook.ts`.

---

## What stays secret vs public

| Public (safe to commit) | Secret (never in git/chat) |
|---|---|
| Supabase URL, anon key | Supabase service_role key (auto-injected) |
| Strava Client ID | Strava Client Secret |
|  | Webhook verify token |

---

## Strava API compliance

- The **"Powered by Strava"** mark is shown on every synced session card.
- Synced sessions **link back** to the original activity on Strava.
- Each user only ever sees **their own** data (enforced by Postgres RLS).
- Strava data is **not** used to train any models.

---

## Re-deploying from source (optional, needs Supabase CLI)

Everything is also reproducible from the repo:
```bash
supabase link --project-ref kmanszmqgmyninoplwbt
supabase db push                                   # applies migrations
supabase functions deploy strava-callback --no-verify-jwt
supabase functions deploy strava-webhook  --no-verify-jwt
supabase functions deploy strava-sync
```
