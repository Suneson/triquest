// strava-sync — polling fallback. Called by the app (on open and "Sync now")
// with the user's Supabase JWT. Pulls recent activities and matches each.
//
// Deploy WITH JWT verification (default):
//   supabase functions deploy strava-sync

import { adminClient, validAccessToken, matchAndWrite, json, CORS } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return json({ error: "missing auth" }, 401);

  const admin = adminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(auth);
  if (userErr || !userData?.user) return json({ error: "invalid token" }, 401);
  const userId = userData.user.id;

  const token = await validAccessToken(admin, userId);
  if (!token) return json({ error: "strava not connected" }, 400);

  // Default: activities in the last 30 days (or ?days=N).
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const after = Math.floor((Date.now() - days * 86400_000) / 1000);

  let activities: any[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50&after=${after}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
    if (!res.ok) return json({ error: `strava list failed: ${res.status}` }, 502);
    activities = await res.json();
    break;
  }

  const results: Record<string, number> = { link: 0, insert: 0, update: 0 };
  for (const a of activities) {
    try {
      const r = await matchAndWrite(admin, userId, a);
      results[r.action] = (results[r.action] || 0) + 1;
    } catch (e) {
      console.error("sync match error", a?.id, e);
    }
  }

  return json({ synced: activities.length, ...results });
});
