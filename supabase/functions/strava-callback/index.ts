// strava-callback — OAuth redirect target. Strava sends ?code & ?state (the
// signed-in user's Supabase access token). We verify the user, exchange the
// code for tokens, store them, then bounce back to the app.
//
// Deploy WITHOUT JWT verification (Strava calls it unauthenticated):
//   supabase functions deploy strava-callback --no-verify-jwt

import { adminClient, exchangeCode, env, CORS } from "../_shared/util.ts";

const APP_URL = () => Deno.env.get("APP_REDIRECT_URL") || "https://suneson.github.io/triquest/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user's Supabase access token
  const error = url.searchParams.get("error");

  const back = (q: string) => Response.redirect(`${APP_URL()}?${q}`, 302);

  if (error) return back(`strava=denied`);
  if (!code || !state) return back(`strava=error`);

  try {
    const admin = adminClient();
    const { data: userData, error: userErr } = await admin.auth.getUser(state);
    if (userErr || !userData?.user) return back(`strava=auth_failed`);
    const userId = userData.user.id;

    const tok = await exchangeCode(code);
    await admin.from("strava_accounts").upsert({
      user_id: userId,
      athlete_id: tok.athlete?.id ?? null,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(tok.expires_at * 1000).toISOString(),
      scope: url.searchParams.get("scope") ?? null,
      updated_at: new Date().toISOString(),
    });

    return back(`strava=connected`);
  } catch (e) {
    console.error("strava-callback error", e);
    return back(`strava=error`);
  }
});
