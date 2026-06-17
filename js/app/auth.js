// auth.js — authentication + store swapping. Logged-out uses LocalStore;
// signing in swaps to SupabaseStore (which merges + uploads local data); signing
// out swaps back. All UI is built here and surfaced via Settings / a prompt.

import { getSupabase } from './stores/supabase-client.js';
import { SupabaseStore } from './stores/supabase-store.js';
import { LocalStore } from './stores/local-store.js';
import * as store from './store.js';
import { SYNC_ENABLED } from './config.js';
import { toast } from './effects.js';

let _client = null;
let _user = null;
let _store = null;
let _onChange = null;

export const currentUser = () => _user;
export const isOnline = () => (_store ? _store.online : true);
export async function client() { if (!_client) _client = await getSupabase(); return _client; }

export async function initAuth(onChange) {
  _onChange = onChange;
  if (!SYNC_ENABLED) return null;
  try {
    _client = await getSupabase();
  } catch (e) {
    console.warn('Supabase unavailable (offline) — staying local-only:', e?.message || e);
    return null;
  }

  // Was this load a return from a magic-link / OAuth redirect? (Capture before
  // the client consumes & cleans the URL.) If so, greet the user, not silent.
  const fromRedirect = /[#&?](access_token|code)=/.test(location.href);

  const { data: { session } } = await _client.auth.getSession();
  if (session?.user) await activateUser(session.user, { silent: !fromRedirect });

  _client.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') { cleanAuthUrl(); openSetPassword(); return; }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      if (!_user || _user.id !== session.user.id) {
        await activateUser(session.user);
        if (_onChange) _onChange(_user);
      }
    } else if (event === 'SIGNED_OUT') {
      _user = null;
      if (_store) { try { await _store.dispose(); } catch { /* ignore */ } }
      _store = null;
      await store.useStore(new LocalStore());
      if (_onChange) _onChange(null);
    }
  });

  return _user;
}

function cleanAuthUrl() {
  if (/[#&?](access_token|refresh_token|code|type)=/.test(location.href)) {
    history.replaceState({}, '', location.origin + location.pathname);
  }
}

async function activateUser(user, { silent = false } = {}) {
  _user = user;
  cleanAuthUrl(); // remove the token from the URL right away (don't wait on hydrate)
  _store = new SupabaseStore(_client, user.id, {
    onRemoteChange: () => { if (_onChange) _onChange(_user, { remote: true }); },
  });
  await store.useStore(_store); // hydrate: pull + LWW merge + push local-only
  if (!silent) {
    const uploaded = _store.uploadedLocal;
    toast(uploaded
      ? `Signed in ☁️ · synced ${uploaded} local session${uploaded === 1 ? '' : 's'} to your account`
      : 'Signed in ☁️ · your data is now syncing', { icon: '✅' });
  }
}

// ---- sign-in actions -------------------------------------------------------

const redirectTo = () => location.origin + location.pathname;

export async function signInWithEmail(email) {
  const c = await client();
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}

export async function resetPassword(email) {
  const c = await client();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) throw error;
}

// Shown after the user follows the password-reset email link (PASSWORD_RECOVERY).
function openSetPassword() {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal auth-modal" role="dialog" aria-modal="true" aria-label="Set a new password">
      <header class="modal-head"><h2>🔑 Set a new password</h2></header>
      <div class="modal-body">
        <form data-set-pw>
          <label class="field"><span>New password</span>
            <input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
          <button class="btn primary" type="submit">Update password</button>
        </form>
        <p class="auth-msg" role="status" hidden></p>
      </div>
    </div>`;
  const msgEl = root.querySelector('.auth-msg');
  root.querySelector('[data-set-pw]').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const c = await client();
      const { error } = await c.auth.updateUser({ password: e.target.password.value });
      if (error) throw error;
      root.innerHTML = ''; root.classList.remove('open');
      toast('Password updated — you’re signed in ✅', { icon: '🔑' });
    } catch (err) { msgEl.hidden = false; msgEl.textContent = err.message || 'Could not update password'; }
  });
}

export async function signInWithPassword(email, password) {
  const c = await client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const c = await client();
  await c.auth.signOut();
}

// ---- sign-in modal ---------------------------------------------------------

export function openAuthModal() {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
  root.innerHTML = `
    <div class="modal-backdrop" data-auth-close></div>
    <div class="modal auth-modal" role="dialog" aria-modal="true" aria-label="Sign in">
      <header class="modal-head"><h2>☁️ Sign in to sync</h2><button class="icon-btn" data-auth-close aria-label="Close">✕</button></header>
      <div class="modal-body">
        <p class="muted small">Sync your training across phone and laptop. Your data stays private to you. Logged out, MOSKE keeps working locally on this device.</p>

        <form data-auth-magic>
          <label class="field"><span>Email — magic link</span>
            <input type="email" name="email" required placeholder="you@example.com" autocomplete="email"></label>
          <button class="btn primary" type="submit">Send magic link</button>
        </form>

        <div class="auth-divider"><span>or email &amp; password</span></div>

        <form data-auth-password>
          <label class="field"><span>Email</span><input type="email" name="email" required autocomplete="email"></label>
          <label class="field"><span>Password</span><input type="password" name="password" required minlength="6" autocomplete="current-password"></label>
          <div class="row">
            <button class="btn primary" type="submit" data-pw-mode="in">Sign in</button>
            <button class="btn ghost" type="submit" data-pw-mode="up">Create account</button>
          </div>
          <button type="button" class="link" data-auth-forgot>Forgot password?</button>
        </form>
        <p class="auth-msg" role="status" hidden></p>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; root.classList.remove('open'); };
  const msg = (text, ok = false) => {
    const el = root.querySelector('.auth-msg');
    el.hidden = false; el.textContent = text; el.classList.toggle('ok', ok);
  };

  root.querySelectorAll('[data-auth-close]').forEach((b) => b.addEventListener('click', close));

  root.querySelector('[data-auth-magic]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    try { await signInWithEmail(email); msg('Check your email for the magic link ✉️', true); }
    catch (err) { msg(err.message || 'Could not send link'); }
  });

  root.querySelector('[data-auth-forgot]').addEventListener('click', async () => {
    const email = root.querySelector('[data-auth-password] [name=email]').value.trim();
    if (!email) { msg('Enter your email above first, then tap Forgot password.'); return; }
    try { await resetPassword(email); msg('Check your email for a password-reset link 🔑', true); }
    catch (err) { msg(err.message || 'Could not send reset email'); }
  });

  let pwMode = 'in';
  root.querySelectorAll('[data-pw-mode]').forEach((b) => b.addEventListener('click', () => { pwMode = b.dataset.pwMode; }));
  root.querySelector('[data-auth-password]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    try {
      if (pwMode === 'up') {
        const c = await client();
        const { data, error } = await c.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) { close(); return; } // confirmation off → signed in immediately
        msg('Account created — confirm your email, then sign in. (Or disable email confirmation in Supabase.)', true);
      } else {
        await signInWithPassword(email, password);
        close();
      }
    } catch (err) { msg(err.message || 'Sign-in failed'); }
  });
}
