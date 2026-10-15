// auth.js — authentication + store swapping. Logged-out uses LocalStore;
// signing in swaps to SupabaseStore (which merges + uploads local data); signing
// out swaps back. All UI is built here and surfaced via Settings / a prompt.

import { getSupabase } from './stores/supabase-client.js';
import { SupabaseStore } from './stores/supabase-store.js';
import { LocalStore } from './stores/local-store.js';
import * as store from './store.js';
import { SYNC_ENABLED } from './config.js';
import { toast } from './effects.js';
import { svg } from '../core/icons.js';
import { busy } from './motion.js';
import { openLayer, closeLayer, topLayerName } from './nav.js';
import { sheetHead } from './sheet.js';
import { t } from '../core/i18n.js';

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

  // Capture URL flags BEFORE the client is created — detectSessionInUrl may
  // consume & clean the hash during createClient.
  const fromRedirect = /[#&?](access_token|code)=/.test(location.href);
  const isRecovery = /[#&?]type=recovery/.test(location.href);

  try {
    _client = await getSupabase();
  } catch (e) {
    console.warn('Supabase unavailable (offline) — staying local-only:', e?.message || e);
    return null;
  }

  const { data: { session } } = await _client.auth.getSession();
  // Recovery: a session exists (so updateUser works) but DON'T sign in — prompt
  // for a new password instead. (The event often fires before this listener.)
  if (isRecovery) { cleanAuthUrl(); openSetPassword(); }
  else if (session?.user) await activateUser(session.user, { silent: !fromRedirect });

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
    // A delete that never reached the server comes back on the next sync, so
    // say so rather than letting the athlete believe the wipe stuck.
    onWriteError: (e) => toast(
      escHtml(t('auth.writeError', { detail: e?.message || t('auth.checkConnection') })),
      { icon: svg('warn') },
    ),
  });
  await store.useStore(_store); // hydrate: pull + LWW merge + push local-only
  if (!silent) {
    const uploaded = _store.uploadedLocal;
    toast(uploaded ? t('auth.signedInSynced', { n: uploaded }) : t('auth.signedInSyncing'), { icon: svg('cloud') });
  }
}

// Supabase answers in English; the common ones read in the active language
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// i18n-ignore-start (Supabase's English messages, matched as keys)
const AUTH_ERRORS = {
  'Invalid login credentials': 'invalid', 'Email not confirmed': 'unconfirmed',
  'User already registered': 'exists', 'Password should be at least 6 characters.': 'short',
};
// i18n-ignore-end
const authError = (err, fallback) => {
  const m = String(err?.message || '');
  return AUTH_ERRORS[m] ? t(`auth.err.${AUTH_ERRORS[m]}`) : (m || t(fallback));
};

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
  if (topLayerName() === 'set-password') return; // already showing
  const root = openLayer('set-password', { swipeBack: false });
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal auth-modal" role="dialog" aria-modal="true" aria-label="${t('auth.setPassword')}">
      ${sheetHead({ icon: 'lock', title: t('auth.setPassword'), noLead: true })}
      <div class="modal-body">
        <form data-set-pw>
          <label class="field"><span>${t('auth.newPassword')}</span>
            <input type="password" name="password" required minlength="6" autocomplete="new-password"></label>
          <label class="field"><span>${t('auth.confirmPassword')}</span>
            <input type="password" name="confirm" required minlength="6" autocomplete="new-password"></label>
          <button class="btn primary" type="submit">${t('auth.updatePassword')}</button>
        </form>
        <p class="auth-msg" role="status" hidden></p>
      </div>
    </div>`;
  const msgEl = root.querySelector('.auth-msg');
  root.querySelector('[data-set-pw]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = e.target.password.value;
    if (password !== e.target.confirm.value) { msgEl.hidden = false; msgEl.textContent = t('auth.noMatch'); return; }
    await busy(e.submitter, async () => { try {
      const c = await client();
      const { error } = await c.auth.updateUser({ password });
      if (error) throw error;
      closeLayer(root);
      const { data: { user } } = await c.auth.getUser();
      if (user && !_user) { await activateUser(user, { silent: true }); if (_onChange) _onChange(_user); }
      toast(t('auth.updated'), { icon: svg('lock') });
    } catch (err) { msgEl.hidden = false; msgEl.textContent = authError(err, 'auth.updateFailed'); }
    });
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
  const root = openLayer('auth');
  root.innerHTML = `
    <div class="modal-backdrop" data-auth-close></div>
    <div class="modal auth-modal" role="dialog" aria-modal="true" aria-label="${t('auth.signIn')}">
      <button class="icon-btn auth-x" data-auth-close aria-label="${t('auth.close')}">${svg('close')}</button>
      <div class="auth-head">
        <div class="auth-logo">MOSKE</div>
        <h2>${t('auth.title')}</h2>
        <p>${t('auth.sub')}</p>
      </div>
      <form data-auth-password class="auth-form">
        <input type="email" name="email" required placeholder="${t('auth.email')}" autocomplete="email">
        <input type="password" name="password" required minlength="6" placeholder="${t('auth.password')}" autocomplete="current-password">
        <button class="btn primary block" type="submit" data-pw-mode="in">${t('auth.signIn')}</button>
        <button class="btn ghost block" type="submit" data-pw-mode="up">${t('auth.create')}</button>
      </form>
      <div class="auth-links">
        <button type="button" class="auth-link" data-auth-forgot>${t('auth.forgot')}</button>
        <span>·</span>
        <button type="button" class="auth-link" data-auth-magic-send>${t('auth.magic')}</button>
      </div>
      <p class="auth-msg" role="status" hidden></p>
    </div>`;

  const close = () => closeLayer(root);
  const msg = (text, ok = false) => {
    const el = root.querySelector('.auth-msg');
    el.hidden = false; el.textContent = text; el.classList.toggle('ok', ok);
  };
  const emailValue = () => root.querySelector('[data-auth-password] [name=email]').value.trim();

  root.querySelectorAll('[data-auth-close]').forEach((b) => b.addEventListener('click', close));

  root.querySelector('[data-auth-magic-send]').addEventListener('click', async () => {
    const email = emailValue();
    if (!email) { msg(t('auth.emailFirst')); return; }
    try { await signInWithEmail(email); msg(t('auth.magicSent'), true); }
    catch (err) { msg(authError(err, 'auth.magicFailed')); }
  });

  root.querySelector('[data-auth-forgot]').addEventListener('click', async () => {
    const email = emailValue();
    if (!email) { msg(t('auth.emailFirst')); return; }
    try { await resetPassword(email); msg(t('auth.resetSent'), true); }
    catch (err) { msg(authError(err, 'auth.resetFailed')); }
  });

  let pwMode = 'in';
  root.querySelectorAll('[data-pw-mode]').forEach((b) => b.addEventListener('click', () => { pwMode = b.dataset.pwMode; }));
  root.querySelector('[data-auth-password]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    await busy(e.submitter, async () => { try {
      if (pwMode === 'up') {
        const c = await client();
        // send the confirmation link back to this page (…/triquest/), not the
        // project's Site URL, which may be the bare github.io domain
        const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
        if (error) throw error;
        if (data.session) { close(); return; } // confirmation off → signed in immediately
        msg(t('auth.created'), true);
      } else {
        await signInWithPassword(email, password);
        close();
      }
    } catch (err) { msg(authError(err, 'auth.failed')); }
    });
  });
}
