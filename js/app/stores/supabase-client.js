// supabase-client.js — lazily loads supabase-js from a CDN only when sync is
// actually used, so the logged-out / offline path never needs the network.

import { CONFIG } from '../config.js';

let _clientPromise = null;

export async function getSupabase() {
  if (!_clientPromise) {
    _clientPromise = import('https://esm.sh/@supabase/supabase-js@2.45.4').then((m) =>
      m.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }));
  }
  return _clientPromise;
}
