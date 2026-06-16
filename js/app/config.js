// config.js — frontend configuration. SAFE TO COMMIT.
//
// The Supabase URL and anon key are public values (protected by Row-Level
// Security). NEVER put the service-role key or the Strava client secret here —
// those live only in Supabase Edge Function secrets (see SETUP.md).
//
// Leave these blank to keep TriQuest fully local-only (no sign-in UI, identical
// to v1). Fill them in after creating your Supabase project, then redeploy.

export const CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',  // the project's anon / public key
  stravaClientId: '',   // Strava app Client ID (public; NOT the secret)
};

// Feature flag: sync + accounts UI only appear once Supabase is configured.
export const SYNC_ENABLED = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

// Strava UI appears only when both Supabase and a Strava client id are present.
export const STRAVA_ENABLED = Boolean(SYNC_ENABLED && CONFIG.stravaClientId);

/** Base URL for Edge Functions, derived from the project URL. */
export function functionsBaseUrl() {
  if (!CONFIG.supabaseUrl) return '';
  return CONFIG.supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
}
