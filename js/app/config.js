// config.js — frontend configuration. SAFE TO COMMIT.
//
// The Supabase URL and anon key are public values (protected by Row-Level
// Security). NEVER put the service-role key or the Strava client secret here —
// those live only in Supabase Edge Function secrets (see SETUP.md).
//
// Leave these blank to keep TriQuest fully local-only (no sign-in UI, identical
// to v1). Fill them in after creating your Supabase project, then redeploy.

export const CONFIG = {
  supabaseUrl: 'https://vopzemijzoxezathmrai.supabase.co',
  supabaseAnonKey: 'sb_publishable_Swiz6YuHXjnjnE4fMqgIaw_S_f1Xvf3',
  stravaClientId: '258518', // Strava app Client ID (public; NOT the secret)
};

// Feature flag: sync + accounts UI only appear once Supabase is configured.
export const SYNC_ENABLED = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

// Strava UI appears only when both Supabase and a Strava client id are present.
export const STRAVA_ENABLED = Boolean(SYNC_ENABLED && CONFIG.stravaClientId);

/** Base URL for Edge Functions — canonical path form, so the OAuth redirect
 *  domain is simply the project domain (vopzemijzoxezathmrai.supabase.co). */
export function functionsBaseUrl() {
  if (!CONFIG.supabaseUrl) return '';
  return `${CONFIG.supabaseUrl}/functions/v1`;
}
