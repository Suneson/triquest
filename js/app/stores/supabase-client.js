// supabase-client.js — lazily loads supabase-js from a CDN only when sync is
// actually used, so the logged-out / offline path never needs the network.

import { CONFIG } from '../config.js';

let _clientPromise = null;

export async function getSupabase() {
  if (!_clientPromise) {
    _clientPromise = import('https://esm.sh/@supabase/supabase-js@2.45.4').then((m) =>
      m.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Implicit flow: the magic-link token arrives in the URL hash and needs
          // no code-verifier, so sign-in completes even when the email link opens
          // in a different / in-app browser. (PKCE would silently fail there.)
          flowType: 'implicit',
        },
      }));
  }
  return _clientPromise;
}
