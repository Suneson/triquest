// strava-client.js — frontend Strava controls. The OAuth secret never touches
// the browser; we only build the authorize URL (public client id) and call the
// Edge Functions, passing the user's Supabase JWT.

import { client } from './auth.js';
import { CONFIG, functionsBaseUrl } from './config.js';

async function session() {
  const c = await client();
  const { data: { session } } = await c.auth.getSession();
  if (!session) throw new Error('Sign in first');
  return session;
}

/** Token-free connection status (via the strava_status RPC). */
export async function stravaStatus() {
  const c = await client();
  const { data, error } = await c.rpc('strava_status');
  if (error) return { connected: false };
  return Array.isArray(data) ? (data[0] || { connected: false }) : data;
}

/** Kick off the Strava OAuth flow (redirects away). */
export async function connectStrava() {
  const s = await session();
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', CONFIG.stravaClientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', `${functionsBaseUrl()}/strava-callback`);
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', 'activity:read_all');
  url.searchParams.set('state', s.access_token); // verified server-side
  location.href = url.toString();
}

/** Pull recent activities through the polling Edge Function. */
export async function syncNow() {
  const s = await session();
  const res = await fetch(`${functionsBaseUrl()}/strava-sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.access_token}` },
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  return res.json();
}

/** Disconnect: delete the user's token row (RLS allows deleting own row only). */
export async function disconnectStrava() {
  const c = await client();
  const { data: { user } } = await c.auth.getUser();
  if (!user) throw new Error('Sign in first');
  const { error } = await c.from('strava_accounts').delete().eq('user_id', user.id);
  if (error) throw error;
}
