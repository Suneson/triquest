// ai-plan — generates a personalized plan via Groq (Llama-4-Scout) and
// batch-inserts it into the authenticated user's calendar (user_id from JWT).
// Deploy with JWT:  supabase functions deploy ai-plan
// Secret required:  GROQ_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const TYPES = ["run", "bike", "swim", "gym", "brick", "mobility", "other"];
const INTEN = ["easy", "steady", "moderate", "threshold", "quality", "vo2", "race"];

const SYSTEM = `You are an elite endurance & strength coach in the style of Whoop and Bevel. NEVER output generic descriptions (no plain "easy run" or "gym session"). Every workout's "notes" MUST be specific and split into bracketed structured segments: "[Warmup] ... [Main Set] ... [Cooldown] ...".
RUNNING: program specific variations — Fartlek, track intervals (e.g. 6x400m, 5x1km), tempo blocks, VO2 max (e.g. 5x3min @ 3k pace) with paces/reps in the [Main Set].
CYCLING: program explicit CADENCE or POWER blocks — Sweet Spot, Over-Unders, Cadence Ladders, threshold — with target cadence (rpm) and/or power/zone in the [Main Set].
GYM/OTHER: prescribe specific movements with sets x reps and an RPE value (1-10), e.g. "Back Squat 4x5 @ RPE 8", in the [Main Set].
Return ONLY a JSON object {"workouts": [ ... ]}. Each item has EXACTLY: "title" (string), "type" (one of ${TYPES.join("|")}), "intensity" (one of ${INTEN.join("|")}), "date" ("YYYY-MM-DD", future only starting tomorrow), "duration_min" (integer), "hr_zone" (integer 1-5, target heart-rate zone), "notes" (structured as above).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return json({ error: "missing auth" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(auth);
  if (uErr || !u?.user) return json({ error: "invalid token" }, 401);
  const userId = u.user.id;

  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return json({ error: "GROQ_API_KEY not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const maxDoubles = Math.max(0, Math.min(5, parseInt(body.wizard?.max_double_days) || 0));
  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}.
HARD SCHEDULING RULE: at most ${maxDoubles} day(s) per week may contain two sessions (two-a-day / double training). Every other day must have at most one session. Never exceed ${maxDoubles} double days in any single weekly cycle.
Questionnaire: ${JSON.stringify(body.wizard || {})}
Recent Strava history (most recent first): ${JSON.stringify(body.strava || [])}`;

  const gRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });
  if (!gRes.ok) return json({ error: `Groq ${gRes.status}`, detail: (await gRes.text()).slice(0, 500) }, 502);

  const g = await gRes.json();
  let parsed: any;
  try { parsed = JSON.parse(g.choices?.[0]?.message?.content || "{}"); } catch { return json({ error: "AI returned invalid JSON" }, 502); }
  const plan = Array.isArray(parsed) ? parsed : (parsed.workouts || parsed.plan || parsed.sessions || []);
  if (!Array.isArray(plan) || !plan.length) return json({ error: "AI returned no sessions" }, 502);

  const now = new Date().toISOString();
  const rows = plan.slice(0, 120).filter((p: any) => p?.date && p?.type).map((p: any) => ({
    id: crypto.randomUUID(), user_id: userId, date: String(p.date).slice(0, 10),
    type: TYPES.includes(p.type) ? p.type : "other",
    title: String(p.title || "AI session").slice(0, 120),
    intensity: INTEN.includes(p.intensity) ? p.intensity : "moderate",
    duration_min: Math.max(10, Math.min(360, parseInt(p.duration_min ?? p.duration) || 45)),
    notes: String(p.notes || ""), completed: false, source: "custom",
    segments: [], exercises: [], packing: [], extra: { ai: true, hr_zone: Math.max(1, Math.min(5, parseInt(p.hr_zone) || 2)) }, updated_at: now,
  }));
  if (!rows.length) return json({ error: "no valid sessions" }, 502);

  const { error: insErr } = await admin.from("workouts").insert(rows);
  if (insErr) return json({ error: insErr.message }, 500);
  return json({ inserted: rows.length });
});
