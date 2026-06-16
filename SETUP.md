# TriQuest — Backend Setup (accounts, sync & Strava)

TriQuest works **fully offline and local-only with no setup** — this guide is only
needed to turn on the optional cloud features: multi-device sync (Workstream A) and
Strava auto-sync (Workstream B). Until you fill in the values below, the app behaves
exactly like v1 and every sync/Strava feature stays hidden behind a flag.

You'll create two accounts (Supabase + Strava), paste a few public values into
`js/app/config.js`, and store the secrets in Supabase (never in the frontend).

Legend: 🟢 = safe to commit / public · 🔴 = secret, server-only, never in git.

---

## 1. Supabase project

1. Go to **https://supabase.com** → sign in → **New project**. Pick a name (e.g.
   `triquest`), a strong database password, and a region near you. Wait ~2 min.
2. **Project Settings → API**. Copy:
   - 🟢 **Project URL** → e.g. `https://abcdefgh.supabase.co`
   - 🟢 **anon public** key
   - 🔴 **service_role** key (you'll paste this into function secrets, step 4 — never the frontend)

### Run the database migration
Either:
- **CLI** (recommended): install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:
  ```bash
  supabase link --project-ref <your-project-ref>
  supabase db push
  ```
  This applies `supabase/migrations/0001_init.sql` (tables, RLS, triggers).
- **Or SQL editor**: open **SQL Editor**, paste the contents of
  `supabase/migrations/0001_init.sql`, and **Run**.

### Enable the auth providers you want
**Authentication → Providers**:
- **Email** — on by default (magic links). Under **URL Configuration**, set
  **Site URL** to `https://suneson.github.io/triquest/` and add it to
  **Redirect URLs**.
- **Google** / **Apple** (optional) — follow Supabase's provider guides, then add
  the same redirect URL.

### Put the public values in the frontend
Edit `js/app/config.js`:
```js
export const CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co', // 🟢 your Project URL
  supabaseAnonKey: 'eyJhbGciOi...',            // 🟢 your anon public key
  stravaClientId: '',                          // fill in step 3
};
```
Commit and redeploy (push to `main`). The **Sign in to sync** UI now appears.
**At this point Workstream A (accounts + multi-device sync) is fully live.**

---

## 2. (Strava) Create a Strava API application

1. Go to **https://www.strava.com/settings/api**.
2. Create an application:
   - **Application Name**: TriQuest
   - **Category**: anything (e.g. Training)
   - **Website**: `https://suneson.github.io/triquest/`
   - **Authorization Callback Domain**: 🟢 your Supabase **functions** domain
     **without scheme** — e.g. `abcdefgh.functions.supabase.co`
3. After creating, note:
   - 🟢 **Client ID**
   - 🔴 **Client Secret**

Add the Client ID to `js/app/config.js` (`stravaClientId`), commit, redeploy.

---

## 3. Deploy the Edge Functions

Install/login the Supabase CLI (`supabase login`), then from the repo root:

```bash
# public (Strava calls these) — disable JWT verification:
supabase functions deploy strava-callback --no-verify-jwt
supabase functions deploy strava-webhook  --no-verify-jwt
# requires the signed-in user's JWT:
supabase functions deploy strava-sync
```
(The same `verify_jwt` settings are declared in `supabase/config.toml`.)

---

## 4. Set the Edge Function secrets  🔴

Generate a random webhook verify token (any unguessable string), then:

```bash
supabase secrets set \
  STRAVA_CLIENT_ID="<your client id>" \
  STRAVA_CLIENT_SECRET="<your client secret>" \
  STRAVA_WEBHOOK_VERIFY_TOKEN="<random string you choose>" \
  APP_REDIRECT_URL="https://suneson.github.io/triquest/"
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
platform — you do **not** need to set them. (If running functions locally, add
them to `supabase/.env`.)

---

## 5. Register the Strava webhook (one command)

After the functions are deployed and secrets are set:

```bash
STRAVA_CLIENT_ID="<id>" STRAVA_CLIENT_SECRET="<secret>" \
STRAVA_WEBHOOK_VERIFY_TOKEN="<same random string>" \
CALLBACK_URL="https://<project-ref>.functions.supabase.co/strava-webhook" \
deno run -A supabase/functions/_scripts/register-webhook.ts
```
Strava will immediately GET your webhook to validate it (the function echoes the
challenge). `list` and `delete <id>` subcommands are available for management.

> No webhook? You can skip step 5 — the app still imports activities via the
> **Sync now** button and on app open (polling fallback, `strava-sync`).

---

## What you provide vs. what's already built

| You provide | Where it goes | Secret? |
|---|---|---|
| Supabase Project URL | `js/app/config.js` | 🟢 |
| Supabase anon key | `js/app/config.js` | 🟢 |
| Strava Client ID | `js/app/config.js` | 🟢 |
| Supabase service_role key | auto-injected to functions | 🔴 |
| Strava Client Secret | `supabase secrets set` | 🔴 |
| Webhook verify token | `supabase secrets set` + register script | 🔴 |

Everything else — schema, RLS, auth UI, sync engine, the Strava OAuth/callback,
webhook, polling sync, and the matching algorithm — is in the repo. If any value is
missing the related feature stays flagged off and the app still builds and deploys.

---

## Strava API compliance

TriQuest follows Strava's brand and platform guidelines:
- The **"Powered by Strava"** mark is shown next to synced data.
- Synced sessions **link back** to the original activity on Strava.
- A user only ever sees **their own** data (enforced by Postgres RLS).
- Strava data is **not** used to train any models.
