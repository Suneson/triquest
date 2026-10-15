// ai-plan — generates a personalized plan via Groq and batch-inserts it into
// the authenticated user's calendar (user_id from JWT).
// Deploy with JWT:  supabase functions deploy ai-plan
// Secret required:  GROQ_API_KEY
// Secret optional:  GROQ_MODEL — pin a model id; otherwise FALLBACK_MODELS is
//                   tried in order, then a live model is discovered from Groq.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { libraryPromptLines, splitPrompt, sanitizeExercises } from "./gym.js";
import { allowedTypes } from "./rules.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const TYPES = ["run", "bike", "swim", "gym", "brick", "mobility", "other"];
const INTEN = ["easy", "steady", "moderate", "threshold", "quality", "vo2", "race"];

// Groq decommissioned meta-llama/llama-4-scout-17b-16e-instruct (deprecation
// announced 2026-06-17), which turned every plan request into a 502. Groq's
// recommended replacements head this list; it is tried in order, and GROQ_MODEL
// overrides the head of it without a redeploy.
const FALLBACK_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile"];

// Preference order used when recovering from a decommission, best first.
const PREFERRED = [/gpt-oss-120b/i, /gpt-oss/i, /llama.*(70b|versatile)/i, /qwen/i, /llama/i];
// Endpoints that exist on Groq but cannot answer a chat completion.
const NOT_CHAT = /whisper|tts|embed|guard|playai|compound/i;

const chat = (key: string, model: string, messages: unknown[]) =>
  fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.7 }),
  });

/** Last-resort recovery: ask Groq which chat models this key can actually run,
 *  so one more decommission does not need a code change to unbreak the coach. */
async function discoverModel(key: string, tried: Set<string>): Promise<string | null> {
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  const ids: string[] = (body?.data || [])
    .filter((m: any) => m?.active !== false)
    .map((m: any) => String(m?.id || ""))
    .filter((id: string) => id && !NOT_CHAT.test(id) && !tried.has(id));
  for (const pattern of PREFERRED) {
    const hit = ids.find((id) => pattern.test(id));
    if (hit) return hit;
  }
  return ids[0] || null;
}

/** Ask Groq for a completion, walking past any model id that no longer exists. */
async function groqComplete(key: string, models: string[], messages: unknown[]) {
  let lastError = "Groq request failed";
  const tried = new Set<string>();

  for (const model of models) {
    tried.add(model);
    const res = await chat(key, model, messages);
    if (res.ok) return await res.json();
    lastError = `Groq ${res.status} on ${model}: ${(await res.text()).slice(0, 300)}`;
    // Only a rejected model id is worth retrying elsewhere — a bad key, a rate
    // limit or an outage fails identically on every model.
    if (res.status !== 400 && res.status !== 404) throw new Error(lastError);
  }

  const discovered = await discoverModel(key, tried);
  if (discovered) {
    const res = await chat(key, discovered, messages);
    if (res.ok) return await res.json();
    lastError = `Groq ${res.status} on ${discovered}: ${(await res.text()).slice(0, 300)}`;
  }
  throw new Error(lastError);
}

const SYSTEM = `You are an elite endurance & strength coach in the style of Whoop and Bevel. NEVER output generic descriptions (no plain "easy run" or "gym session"). Every workout's "notes" MUST be specific and split into bracketed structured segments: "[Warmup] ... [Main Set] ... [Cooldown] ...".
RUNNING: program specific variations — Fartlek, track intervals (e.g. 6x400m, 5x1km), tempo blocks, VO2 max (e.g. 5x3min @ 3k pace) with paces/reps in the [Main Set].
CYCLING: program explicit CADENCE or POWER blocks — Sweet Spot, Over-Unders, Cadence Ladders, threshold. ALWAYS express power as ABSOLUTE WATTS scaled to the athlete's FTP from the questionnaire, formatted like "4x8min @ 250W" (letter W), in the [Main Set].
For EVERY bike session you MUST ALSO output a structured "power" array: an ordered list of interval blocks covering warmup → main set → cooldown, each block {"min": integer minutes, "watts": integer absolute watts scaled to the athlete's FTP}. Expand repeats into individual blocks (e.g. 4x8min @ 250W with 2min @ 120W recoveries = eight blocks). The watt values in "power" MUST agree with the [Main Set] text. Omit "power" entirely for non-bike sessions.
GYM/OTHER: prescribe specific movements with sets x reps and an RPE value (1-10), e.g. "Back Squat 4x5 @ RPE 8", in the [Main Set]. List each distinct movement separated by commas so it can be rendered one per line.
For EVERY gym session you MUST ALSO output a structured "exercises" array (4-8 items, in the order they are done) that matches the [Main Set]: each item {"id": library id from the list below or null, "name": exercise name, "sets": integer 1-10, "reps": string such as "8", "8-10", "45s" or "10 / leg", "rpe": number 5-10}. Prefer exercises from the library and use their exact id and name; only use "id": null for a movement the library does not have. If the questionnaire has a "gym_split", every gym session follows the next day of that split in order and trains its muscle groups. Omit "exercises" for non-gym sessions.
EXERCISE LIBRARY (id = name (main muscle, equipment)):
${libraryPromptLines()}
Return ONLY a JSON object {"workouts": [ ... ]}. Each item has EXACTLY: "title" (string), "type" (one of ${TYPES.join("|")}), "intensity" (one of ${INTEN.join("|")}), "date" ("YYYY-MM-DD", future only starting tomorrow), "duration_min" (integer), "hr_zone" (integer 1-5, target heart-rate zone), "notes" (structured as above), for bike sessions "power" (array of {"min":int,"watts":int}), and for gym sessions "exercises" (array as above).`;

// The athlete's language (the wizard sends "en" or "es"). Titles and the prose
// in notes follow it; everything the app reads stays in English, so nothing
// downstream changes. English keeps the prompt exactly as it was.
const LANGS = ["en", "es"];
const LANGUAGE_RULE: Record<string, string> = {
  es: `LANGUAGE: write every "title" and all the prose inside "notes" in Spanish from Spain, the way a Spanish coach talks to a triathlete or a lifter: "Tirada larga", "Rodaje suave", "Series", "Umbral", "Sweet spot", "Calentamiento", "Vuelta a la calma", "Fartlek", "Tempo", "Press de banca", "Sentadilla". Keep the following EXACTLY in English, because the app reads them: every JSON key; the values of "type", "intensity" and "date"; the segment labels "[Warmup]", "[Main Set]" and "[Cooldown]"; every exercise "id"; and in the "exercises" array, the "name" of a library exercise exactly as listed. Numbers, units and the set notation stay as they are (km, W, min, s, RPE, "4x8min @ 250W", "4x5 @ RPE 8").`,
};
const FALLBACK_TITLE: Record<string, string> = { en: "AI session", es: "Sesión IA" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

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
  const ftp = Math.max(50, Math.min(600, parseInt(body.wizard?.ftp) || 250));
  const lang = LANGS.includes(body.wizard?.lang) ? body.wizard.lang : "en";
  const allowed = allowedTypes(body.wizard?.sports, TYPES);
  // the athlete's Monday of this week (their local date): every unfinished,
  // unverified session from there on is replaced by the new plan
  const wipeFrom = ISO.test(String(body.wipe_from || "")) ? String(body.wipe_from) : null;
  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}.
Athlete FTP: ${ftp}W (use for cycling watt targets).
HARD SCHEDULING RULE: at most ${maxDoubles} day(s) per week may contain two sessions (two-a-day / double training). Every other day must have at most one session. Never exceed ${maxDoubles} double days in any single weekly cycle.
ALLOWED DISCIPLINES: every session's "type" MUST be one of: ${allowed.join(", ")}. Never schedule any other type, not even as cross-training or recovery.
${splitPrompt(body.wizard?.gym_split)}
Questionnaire: ${JSON.stringify(body.wizard || {})}
Recent Strava history (most recent first): ${JSON.stringify(body.strava || [])}`;

  const override = Deno.env.get("GROQ_MODEL");
  const models = override ? [override, ...FALLBACK_MODELS.filter((m) => m !== override)] : FALLBACK_MODELS;

  let g: any;
  try {
    g = await groqComplete(key, models, [
      { role: "system", content: LANGUAGE_RULE[lang] ? `${SYSTEM}\n${LANGUAGE_RULE[lang]}` : SYSTEM },
      { role: "user", content: prompt },
    ]);
  } catch (e) {
    return json({ error: "AI coach unavailable", detail: String((e as Error)?.message || e) }, 502);
  }

  let parsed: any;
  try { parsed = JSON.parse(g.choices?.[0]?.message?.content || "{}"); } catch { return json({ error: "AI returned invalid JSON" }, 502); }
  const plan = Array.isArray(parsed) ? parsed : (parsed.workouts || parsed.plan || parsed.sessions || []);
  if (!Array.isArray(plan) || !plan.length) return json({ error: "AI returned no sessions" }, 502);

  const now = new Date().toISOString();
  // sessions in a discipline the athlete didn't pick are dropped, whatever the model sent
  const rows = plan.slice(0, 120).filter((p: any) => p?.date && p?.type && allowed.includes(p.type)).map((p: any) => {
    const type = TYPES.includes(p.type) ? p.type : "other";
    // Structured cycling power intervals → exact Zwift-style bars (no regex parsing of notes).
    const power = type === "bike" && Array.isArray(p.power)
      ? p.power
          .map((b: any) => ({
            min: Math.max(1, Math.min(240, parseInt(b?.min ?? b?.minutes) || 1)),
            watts: Math.max(40, Math.min(2000, parseInt(b?.watts ?? b?.w) || 0)),
          }))
          .filter((b: any) => b.watts)
          .slice(0, 40)
      : [];
    // Structured gym exercises → the logger, art and set grid (validated like power).
    const exercises = type === "gym" ? sanitizeExercises(p.exercises) : [];
    return {
      id: crypto.randomUUID(), user_id: userId, date: String(p.date).slice(0, 10),
      type,
      title: String(p.title || FALLBACK_TITLE[lang]).slice(0, 120),
      intensity: INTEN.includes(p.intensity) ? p.intensity : "moderate",
      duration_min: Math.max(10, Math.min(360, parseInt(p.duration_min ?? p.duration) || 45)),
      notes: String(p.notes || ""), completed: false, source: "custom",
      segments: [], exercises, packing: [],
      extra: {
        ai: true, hr_zone: Math.max(1, Math.min(5, parseInt(p.hr_zone) || 2)),
        ...(power.length ? { power } : {}),
        // the main set already lives in `exercises`: the app must not re-read it from the notes
        ...(exercises.length ? { notesParsed: true } : {}),
      },
      updated_at: now,
    };
  });
  if (!rows.length) return json({ error: "no valid sessions" }, 502);

  // A new plan replaces the old one: unfinished, unverified sessions from this
  // week's Monday on go (completed and Strava-verified history always stays),
  // so the new plan never lands on top of the old one.
  let removed = 0;
  if (wipeFrom) {
    const { data: gone, error: delErr } = await admin.from("workouts").delete()
      .eq("user_id", userId).gte("date", wipeFrom).eq("completed", false).is("strava_activity_id", null)
      .select("id");
    if (delErr) return json({ error: delErr.message }, 500);
    removed = gone?.length || 0;
  }

  const { error: insErr } = await admin.from("workouts").insert(rows);
  if (insErr) return json({ error: insErr.message }, 500);
  return json({ inserted: rows.length, removed });
});
