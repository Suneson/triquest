// strava-webhook — Strava push subscription endpoint.
//   GET  → subscription validation (echo hub.challenge if verify_token matches)
//   POST → activity create/update/delete events
//
// Deploy WITHOUT JWT verification (Strava calls it unauthenticated):
//   supabase functions deploy strava-webhook --no-verify-jwt

import { adminClient, validAccessToken, fetchActivity, matchAndWrite, env, json, CORS } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);

  // --- subscription validation handshake ---
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === env("STRAVA_WEBHOOK_VERIFY_TOKEN") && challenge) {
      return json({ "hub.challenge": challenge });
    }
    return json({ error: "verification failed" }, 403);
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let event: any;
  try { event = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // Acknowledge fast; do the work in the background (Strava expects a quick 200).
  const work = handleEvent(event).catch((e) => console.error("webhook handler error", e));
  // @ts-ignore EdgeRuntime is provided by the Supabase runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(work);
  else await work;

  return json({ received: true });
});

async function handleEvent(event: any) {
  if (event?.object_type !== "activity") return;
  const admin = adminClient();
  const athleteId = event.owner_id;

  const { data: acct } = await admin.from("strava_accounts").select("user_id").eq("athlete_id", athleteId).maybeSingle();
  if (!acct) return; // unknown athlete
  const userId = acct.user_id;

  if (event.aspect_type === "delete") {
    const { data: linked } = await admin.from("workouts")
      .select("id, source").eq("user_id", userId).eq("strava_activity_id", event.object_id).maybeSingle();
    if (!linked) return;
    if (linked.source === "strava") {
      await admin.from("workouts").delete().eq("id", linked.id); // unplanned import → remove
    } else {
      await admin.from("workouts").update({ // planned session → just unlink, keep the plan
        strava_activity_id: null, actual: null, completed: false, completed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", linked.id);
    }
    return;
  }

  // create | update → fetch detail, then match/write.
  const token = await validAccessToken(admin, userId);
  if (!token) return;
  const activity = await fetchActivity(token, event.object_id);
  await matchAndWrite(admin, userId, activity);
}
