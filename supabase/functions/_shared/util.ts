// Shared utilities for Edge Functions: Supabase admin client, CORS, and
// Strava token management (exchange + refresh with the client secret).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra },
  });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Service-role client — bypasses RLS. Use only in trusted server code. */
export function adminClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

export async function exchangeCode(code: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  return await res.json();
}

/** Return a valid access token for a user, refreshing if it has expired. */
export async function validAccessToken(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data: acct } = await admin.from("strava_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (!acct) return null;

  const expiresMs = new Date(acct.expires_at).getTime();
  if (expiresMs - Date.now() > 60_000) return acct.access_token;

  // Refresh.
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: acct.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const t = await res.json();
  await admin.from("strava_accounts").update({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(t.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return t.access_token;
}

/** Fetch a Strava activity, retrying once on 429 with backoff. */
export async function fetchActivity(token: string, id: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://www.strava.com/api/v3/activities/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Strava activity fetch failed: ${res.status}`);
    return await res.json();
  }
  throw new Error("Strava rate limit (429) — backoff exhausted");
}

/**
 * Match an activity-derived row to the user's planned sessions and write it.
 * Implements the documented algorithm against the workouts table.
 */
export async function matchAndWrite(admin: SupabaseClient, userId: string, activity: any) {
  const { activityToRow } = await import("./strava.ts");
  const row = activityToRow(activity);

  // Dedupe: already linked?
  const { data: existing } = await admin.from("workouts")
    .select("id").eq("user_id", userId).eq("strava_activity_id", activity.id).maybeSingle();
  if (existing) {
    await admin.from("workouts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", existing.id);
    return { action: "update", id: existing.id };
  }

  // Candidate planned sessions: same day, same type, not done, not linked.
  const { data: candidates } = await admin.from("workouts")
    .select("id, duration_min")
    .eq("user_id", userId).eq("date", row.date).eq("type", row.type)
    .eq("completed", false).is("strava_activity_id", null);

  if (candidates && candidates.length) {
    const target = row.duration_min ?? 0;
    candidates.sort((a, b) => Math.abs((a.duration_min ?? 0) - target) - Math.abs((b.duration_min ?? 0) - target));
    const chosen = candidates[0];
    await admin.from("workouts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", chosen.id);
    return { action: "link", id: chosen.id };
  }

  // No match: insert as an unplanned completed Strava session.
  const { data: inserted } = await admin.from("workouts").insert({
    user_id: userId,
    title: activity.name ?? "Strava activity",
    intensity: "steady",
    source: "strava",
    segments: [], exercises: [], packing: [],
    updated_at: new Date().toISOString(),
    ...row,
  }).select("id").single();
  return { action: "insert", id: inserted?.id };
}
