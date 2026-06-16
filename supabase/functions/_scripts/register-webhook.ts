// register-webhook.ts — one-time Strava push-subscription registration.
//
// Run (after deploying the strava-webhook function and setting secrets):
//   STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... \
//   STRAVA_WEBHOOK_VERIFY_TOKEN=... \
//   CALLBACK_URL="https://<project-ref>.functions.supabase.co/strava-webhook" \
//   deno run -A supabase/functions/_scripts/register-webhook.ts
//
// Subcommands:  (default) create | list | delete <id>

const id = Deno.env.get("STRAVA_CLIENT_ID");
const secret = Deno.env.get("STRAVA_CLIENT_SECRET");
const verify = Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN");
const callback = Deno.env.get("CALLBACK_URL");
const API = "https://www.strava.com/api/v3/push_subscriptions";

if (!id || !secret) {
  console.error("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.");
  Deno.exit(1);
}

const cmd = Deno.args[0] ?? "create";

if (cmd === "list") {
  const r = await fetch(`${API}?client_id=${id}&client_secret=${secret}`);
  console.log(JSON.stringify(await r.json(), null, 2));
} else if (cmd === "delete") {
  const subId = Deno.args[1];
  const r = await fetch(`${API}/${subId}?client_id=${id}&client_secret=${secret}`, { method: "DELETE" });
  console.log("delete:", r.status);
} else {
  if (!verify || !callback) {
    console.error("Set STRAVA_WEBHOOK_VERIFY_TOKEN and CALLBACK_URL to create a subscription.");
    Deno.exit(1);
  }
  const body = new FormData();
  body.set("client_id", id);
  body.set("client_secret", secret);
  body.set("callback_url", callback);
  body.set("verify_token", verify);
  const r = await fetch(API, { method: "POST", body });
  console.log(r.status, JSON.stringify(await r.json(), null, 2));
}
