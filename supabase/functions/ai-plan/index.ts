// ai-plan — generates a personalized plan via Gemini and batch-inserts it into
// the authenticated user's calendar (user_id from their JWT). Deploy with JWT:
//   supabase functions deploy ai-plan
// Secret required: GEMINI_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const TYPES = ["run", "bike", "swim", "gym", "brick", "mobility", "other"];
const INTEN = ["easy", "steady", "moderate", "threshold", "quality", "vo2", "race"];

const SYSTEM = `You are an elite endurance coach. Build a personalized training plan as a JSON array.
Each item must match exactly: { "title": string, "type": one of ${TYPES.join("|")}, "intensity": one of ${INTEN.join("|")}, "date": "YYYY-MM-DD" (future dates only, starting tomorrow), "duration": integer minutes, "notes": string }.
Respect the chosen sports, the weekly training frequency, and taper toward each event date. Use the Strava history to set realistic volume/intensity. Return ONLY the JSON array.`;

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" }, type: { type: "STRING" }, intensity: { type: "STRING" },
      date: { type: "STRING" }, duration: { type: "INTEGER" }, notes: { type: "STRING" },
    },
    required: ["title", "type", "intensity", "date", "duration"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return json({ error: "missing auth" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(auth);
  if (uErr || !u?.user) return json({ error: "invalid token" }, 401);
  const userId = u.user.id;

  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}.
Questionnaire: ${JSON.stringify(body.wizard || {})}
Recent Strava history (most recent first): ${JSON.stringify(body.strava || [])}`;

  const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.7 },
    }),
  });
  if (!gRes.ok) return json({ error: `Gemini error ${gRes.status}` }, 502);
  const g = await gRes.json();
  let plan: any[];
  try { plan = JSON.parse(g.candidates?.[0]?.content?.parts?.[0]?.text || "[]"); } catch { return json({ error: "AI returned invalid JSON" }, 502); }
  if (!Array.isArray(plan) || !plan.length) return json({ error: "AI returned no sessions" }, 502);

  const now = new Date().toISOString();
  const rows = plan.slice(0, 120).filter((p) => p?.date && p?.type).map((p) => ({
    id: crypto.randomUUID(), user_id: userId, date: String(p.date).slice(0, 10),
    type: TYPES.includes(p.type) ? p.type : "other",
    title: String(p.title || "AI session").slice(0, 120),
    intensity: INTEN.includes(p.intensity) ? p.intensity : "moderate",
    duration_min: Math.max(10, Math.min(360, parseInt(p.duration) || 45)),
    notes: String(p.notes || ""), completed: false, source: "custom",
    segments: [], exercises: [], packing: [], extra: { ai: true }, updated_at: now,
  }));
  if (!rows.length) return json({ error: "no valid sessions" }, 502);

  const { error: insErr } = await admin.from("workouts").insert(rows);
  if (insErr) return json({ error: insErr.message }, 500);
  return json({ inserted: rows.length });
});
