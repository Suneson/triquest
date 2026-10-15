// chat.js — the Chat tab (friends + direct messages) and the notification
// bell's sheet. Data comes from js/app/social.js; this file only draws it and
// reacts to taps. Same pixel skin as the rest of the app: dialogue boxes for
// empty states, stepped panels, display font for labels, body font for text.

import { esc, dialogue } from './ui.js';
import { svg } from '../core/icons.js';
import { chatTime, cleanUsername, validUsername } from '../core/social.js';
import { toast } from './effects.js';
import { currentUser } from './auth.js';
import { openLayer, closeLayer, topLayerName, openRoute, leaveRoute } from './nav.js';
import {
  socialState, socialEnabled, startSocial, onSocial, threads, incoming, outgoing, relationTo, friendRow,
  requestFriend, requestByUsername, respondFriend, removeFriend, setUsername, loadThread, threadWith,
  sendMessage, markThreadRead, unreadNotifications, markNotificationsRead, bellCount, unreadMessages,
} from './social.js';
import { sheetHead } from './sheet.js';
import { onRoom, unreadRoom } from './room.js';
import { mountRoom, unmountRoom } from './room-view.js';
import { t, fmtDate, fmtTime } from '../core/i18n.js';

const ui = { open: null, view: null, draft: new Map() }; // open = friend user_id in the thread view

const avatar = (r, cls = '') => `<span class="lb-avatar ${cls}" aria-hidden="true">${r?.avatar
  ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">`
  : esc((r?.display_name || 'A').trim().charAt(0).toUpperCase())}</span>`;

const handle = (r) => (r?.username ? `@${r.username}` : '');

// friend notifications are written by the database in English with the name
// up front ("Ana accepted your friend request"); show them in the active language
const NOTIF_EN = { friend_accepted: ' accepted your friend request', friend_request: ' wants to be friends' };
function notifTitle(n) {
  const tail = NOTIF_EN[n.kind];
  if (!tail || !String(n.title || '').endsWith(tail)) return n.title;
  const name = n.title.slice(0, -tail.length);
  return t(n.kind === 'friend_accepted' ? 'chat.notif.accepted' : 'chat.notif.request', { name });
}

// ---- the tab -----------------------------------------------------------------------------------

/** First paint of the Chat tab; mountChat() fills it. */
export function chatShell() {
  return '<div class="chat" id="chat-root" aria-busy="true"></div>';
}

export function mountChat(view) {
  ui.view = view;
  const root = view.querySelector('#chat-root');
  if (!root) return;
  if (!socialEnabled()) {
    root.removeAttribute('aria-busy');
    root.innerHTML = `<div class="day-header"><h2>${t('chat.chat')}</h2></div>
      ${dialogue({ who: t('chat.chat'), icon: 'chat', text: t('chat.signInText'), cls: 'empty-dlg',
    body: `<button class="btn primary" data-action="open-auth">${t('chat.signIn')}</button>` })}`;
    return;
  }
  if (!socialState().ready) {
    root.innerHTML = skeleton();
    startSocial().then(() => drawChat());
    return;
  }
  drawChat();
}

function skeleton() {
  const row = (i) => `<li class="ch-row is-sk" style="--sk-i:${i}"><span class="lb-avatar sk-tile"></span>
    <span class="ch-txt"><b><i class="sk-line" style="width:${[60, 45, 70][i % 3]}%"></i></b><small><i class="sk-line" style="width:80%"></i></small></span></li>`;
  return `<div class="day-header"><h2>${t('chat.chat')}</h2></div><span class="sr">${t('chat.loading')}</span>
    <ul class="ch-list" aria-hidden="true">${[0, 1, 2].map(row).join('')}</ul>`;
}

// ---- General | Direct --------------------------------------------------------------------
// Two places to talk: General (everyone) and Direct (your friends). The choice
// is remembered; each side shows its own unread count, and the tab badge adds
// them up.
const MODE_KEY = 'moske-chat-mode';
export function chatMode() {
  try { return localStorage.getItem(MODE_KEY) === 'direct' ? 'direct' : 'general'; } catch { return 'general'; }
}
function setChatMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ } }

function segHtml(mode) {
  const n = { general: unreadRoom(), direct: socialState().ready ? unreadMessages() : 0 };
  const opt = (id, label) => `<button class="ch-seg-btn${mode === id ? ' on' : ''}" role="tab" aria-selected="${mode === id}" data-ch="mode" data-mode="${id}">
      ${label}${n[id] ? ` <span class="ch-seg-n data-num" aria-label="${t('chat.unreadN', { n: n[id] })}">${n[id] > 9 ? '9+' : n[id]}</span>` : ''}</button>`;
  return `<div class="ch-seg" role="tablist" aria-label="${t('chat.chat')}">${opt('general', t('chat.general'))}${opt('direct', t('chat.direct'))}</div>`;
}
function paintSeg() {
  const seg = document.querySelector('#chat-root .ch-seg');
  if (seg) seg.outerHTML = segHtml(chatMode());
}

// a row's quieter actions live behind ⋮ (a native menu: keyboard and screen readers for free)
function rowMenu(label, items, attrs) {
  return `<label class="icon-btn tiny gl-more" title="${t('chat.more')}">${svg('more')}
    <select data-ch-row ${attrs} aria-label="${esc(label)}">
      <option value="" selected disabled hidden>${t('chat.more')}</option>
      ${items.map(([v, text]) => `<option value="${v}">${esc(text)}</option>`).join('')}
    </select></label>`;
}

export function drawChat() {
  const root = document.getElementById('chat-root');
  if (!root) return;
  root.removeAttribute('aria-busy');
  if (ui.open && relationTo(ui.open) === 'friends') { drawThread(root, ui.open); return; }
  ui.open = null;
  const me = socialState().me;
  const inc = incoming();
  const out = outgoing();
  const ts = threads();
  const mode = chatMode();
  const head = `
    <div class="day-header ch-header">
      <div class="ch-title"><h2>${t('chat.chat')}</h2>
        <button class="link ch-me" data-ch="edit-name" aria-label="${esc(t('chat.yourUsername', { name: me?.username || t('chat.notSet') }))}">${me?.username ? `@${esc(me.username)}` : t('chat.setUsername')} ${svg('edit')}</button></div>
      ${mode === 'direct' ? `<button class="btn tiny secondary ch-add-btn" data-ch="add-friend">${svg('friend')} ${t('chat.addFriend')}</button>` : ''}
    </div>
    ${segHtml(mode)}`;
  if (mode === 'general') {
    // General keeps itself live (room-view.js); a redraw here would cost the
    // scroll position and the composer's focus, so only the switch repaints
    if (root.querySelector('#room-root')) { paintSeg(); return; }
    unmountRoom();
    root.innerHTML = `${head}<div class="rm" id="room-root"></div>`;
    wireChat(root);
    mountRoom(root.querySelector('#room-root'), ui.view || document.getElementById('view'));
    return;
  }
  unmountRoom();
  root.innerHTML = `${head}
    ${inc.length || ts.length || out.length ? `<ul class="ch-list">
      ${inc.map((f) => `<li class="ch-row is-pending">
        ${avatar(f)}<span class="ch-txt"><b>${esc(f.display_name)}</b><small class="muted"><span class="ch-chip">${t('chat.request')}</span>${esc(t('chat.wantsFriends', { handle: handle(f) || f.display_name }))}</small></span>
        <span class="ch-acts">
          <button class="btn tiny primary" data-ch="accept" data-fid="${f.friendship_id}">${t('chat.accept')}</button>
          ${rowMenu(t('chat.moreFor', { name: f.display_name }), [['decline', t('chat.declineRequest')]], `data-fid="${f.friendship_id}"`)}
        </span></li>`).join('')}
      ${ts.map((th) => {
    const f = th.friend; const l = th.last;
    const preview = l ? `${l.sender === me?.id ? t('chat.you') : ''}${l.body}` : t('chat.sayHello');
    return `<li><button class="ch-row ch-thread ${th.unread ? 'is-unread' : ''}" data-ch="open" data-uid="${esc(f.user_id)}"
        aria-label="${esc(th.unread ? t('chat.threadAriaUnread', { name: f.display_name, n: th.unread }) : f.display_name)}">
        ${avatar(f)}
        <span class="ch-txt"><b>${esc(f.display_name)}</b><small class="${l ? '' : 'muted'}">${esc(preview)}</small></span>
        <span class="ch-meta">${l ? `<small class="muted">${esc(chatTime(l.created_at))}</small>` : ''}
          ${th.unread ? `<span class="ch-badge data-num">${th.unread}</span>` : ''}</span>
      </button></li>`;
  }).join('')}
      ${out.map((f) => `<li class="ch-row is-pending">
        ${avatar(f)}<span class="ch-txt"><b>${esc(f.display_name)}</b><small class="muted"><span class="ch-chip is-quiet">${t('chat.requested')}</span>${esc(t('chat.waitingFor', { who: handle(f) || t('chat.them') }))}</small></span>
        <span class="ch-acts">${rowMenu(t('chat.moreFor', { name: f.display_name }), [['cancel', t('chat.cancelRequest')]], `data-uid="${esc(f.user_id)}"`)}</span></li>`).join('')}
    </ul>`
    : dialogue({ who: t('chat.chat'), icon: 'chat', text: t('chat.noFriends'), cls: 'empty-dlg' })}`;
  wireChat(root);
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t('date.today');
  if (d.toDateString() === y.toDateString()) return t('date.yesterday');
  return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
}

function bubbles(uid) {
  const me = socialState().me?.id;
  const msgs = threadWith(uid);
  if (!msgs.length) return `<p class="muted ch-hello">${t('chat.noMessages')}</p>`;
  let lastDay = '';
  return msgs.map((m) => {
    const day = dayLabel(m.created_at);
    const sep = day !== lastDay ? `<li class="ch-day" aria-hidden="true"><span>${esc(day)}</span></li>` : '';
    lastDay = day;
    const mine = m.sender === me;
    const time = fmtTime(new Date(m.created_at));
    return `${sep}<li class="ch-msg ${mine ? 'mine' : 'theirs'}"><p>${esc(m.body)}</p>
      <small>${esc(time)}${mine && m.read_at ? t('chat.read') : ''}</small></li>`;
  }).join('');
}

function drawThread(root, uid) {
  const f = friendRow(uid);
  const draft = ui.draft.get(uid) || '';
  root.innerHTML = `
    <div class="ch-head">${sheetHead({
      lead: 'back', label: t('chat.backToChats'), closeAttr: 'data-ch="back"',
      title: `<button class="ch-who" data-ch="profile" aria-label="${esc(t('chat.viewProfileOf', { name: f?.display_name || t('chat.friend') }))}">
        ${avatar(f)}<span class="ch-txt"><b>${esc(f?.display_name || t('chat.friend'))}</b><small class="muted">${esc(handle(f))}</small></span></button>`,
      action: `<label class="icon-btn tiny gl-more" title="${t('chat.more')}">${svg('more')}
        <select data-ch-menu aria-label="${t('chat.moreOptions')}">
          <option value="" selected disabled hidden>${t('chat.more')}</option>
          <option value="profile">${t('chat.viewProfile')}</option>
          <option value="remove">${t('chat.removeFriend')}</option>
        </select></label>`,
    })}</div>
    <ol class="ch-msgs" id="ch-msgs" aria-live="polite">${bubbles(uid)}</ol>
    <form class="ch-compose" data-ch-form="send" autocomplete="off">
      <textarea class="ch-in" name="body" rows="1" maxlength="1000" placeholder="${esc(t('chat.messagePh', { name: f?.display_name || '' }))}" aria-label="${t('chat.message')}">${esc(draft)}</textarea>
      <button class="btn primary ch-send" type="submit" aria-label="${t('chat.send')}">${svg('send')}</button>
    </form>`;
  wireChat(root);
  scrollToEnd();
  markThreadRead(uid);
}

function scrollToEnd() {
  const v = ui.view || document.getElementById('view');
  requestAnimationFrame(() => { if (v) v.scrollTop = v.scrollHeight; });
}

/** Only the message list changes while you're in a thread (the composer keeps focus). */
function refreshThread() {
  const list = document.getElementById('ch-msgs');
  if (!list || !ui.open) return;
  const v = ui.view || document.getElementById('view');
  const atEnd = v ? v.scrollHeight - v.scrollTop - v.clientHeight < 80 : true;
  list.innerHTML = bubbles(ui.open);
  if (atEnd) scrollToEnd();
  markThreadRead(ui.open);
}

export function openThread(uid) {
  ui.open = uid;
  // a thread is a route inside the Chat tab: back, Escape and the edge swipe
  // return to the list (and leaving the tab closes it)
  openRoute('chat-thread', { area: document.getElementById('view'), onClose: closeThread });
  drawChat();
  loadThread(uid).then(() => refreshThread()).catch(() => {});
}

/**
 * Add a friend by username: a small sheet, not a permanent field. The field
 * isn't focused for you (no keyboard until you tap it); paste and the
 * keyboard's suggestions work as usual.
 */
function openAddFriend() {
  const root = openLayer('add-friend');
  root.innerHTML = `
    <div class="modal-backdrop" data-af-close></div>
    <div class="modal pk-modal pk-small" role="dialog" aria-modal="true" aria-labelledby="af-title">
      ${sheetHead({ icon: 'friend', title: t('chat.addFriend'), id: 'af-title', closeAttr: 'data-af-close' })}
      <form class="modal-body ch-add-sheet" data-af-form novalidate>
        <label class="field"><span>${t('chat.theirUsername')}</span>
          <input class="ch-in" type="text" name="u" inputmode="text" autocapitalize="none" autocorrect="off" spellcheck="false"
            placeholder="@username" maxlength="21" aria-describedby="af-hint"></label>
        <p class="af-msg" role="status" hidden></p>
        <button class="btn primary block" type="submit">${t('chat.add')}</button>
        <small id="af-hint" class="muted">${t('chat.addHint')}</small>
      </form>
    </div>`;
  const msg = root.querySelector('.af-msg');
  root.onclick = (e) => { if (e.target.closest('[data-af-close]')) closeLayer(root); };
  root.querySelector('[data-af-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = form.u.value;
    const btn = form.querySelector('[type="submit"]');
    const fail = (text) => { msg.hidden = false; msg.textContent = text; };
    if (!validUsername(v)) { fail(t('chat.usernameRule')); return; }
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
    try {
      const r = await requestByUsername(v);
      closeLayer(root);
      toast(esc(r.status === 'friends' ? t('chat.nowFriendsWith', { name: r.user.display_name }) : t('chat.requestSent', { name: cleanUsername(v) })), { icon: svg('friend') });
    } catch (err) { fail(err.message); } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
  });
}

function closeThread() {
  if (!ui.open) return;
  ui.open = null;
  drawChat();
}

function wireChat(root) {
  root.onclick = async (e) => {
    const b = e.target.closest('[data-ch]');
    if (!b) return;
    const act = b.dataset.ch;
    try {
      if (act === 'open') openThread(b.dataset.uid);
      else if (act === 'back') { ui.open = null; leaveRoute('chat-thread'); drawChat(); }
      else if (act === 'accept') { b.setAttribute('aria-busy', 'true'); await respondFriend(Number(b.dataset.fid), true); toast(t('chat.friendAdded'), { icon: svg('friend') }); }
      else if (act === 'decline') { await respondFriend(Number(b.dataset.fid), false); }
      else if (act === 'cancel') { await removeFriend(b.dataset.uid); }
      else if (act === 'edit-name') editUsername();
      else if (act === 'add-friend') openAddFriend(b);
      else if (act === 'mode' && b.dataset.mode !== chatMode()) { setChatMode(b.dataset.mode); drawChat(); }
      else if (act === 'profile') openProfile(friendRow(ui.open));
    } catch (err) { toast(esc(err.message || t('chat.wentWrong')), { icon: svg('warn') }); }
  };
  root.onsubmit = async (e) => {
    const form = e.target.closest('[data-ch-form]');
    if (!form) return;
    e.preventDefault();
    const ta = form.body;
    const text = ta.value.trim();
    if (!text || !ui.open) return;
    ta.value = ''; ui.draft.delete(ui.open);
    try { await sendMessage(ui.open, text); refreshThread(); scrollToEnd(); } catch (err) {
      ta.value = text; toast(esc(err.message), { icon: svg('warn') });
    }
    ta.focus();
  };
  root.oninput = (e) => {
    if (e.target.matches('.ch-compose textarea') && ui.open) {
      ui.draft.set(ui.open, e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`;
    }
  };
  root.onkeydown = (e) => {
    // Enter sends on a keyboard; Shift+Enter is a new line (phones keep their return key)
    if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.ch-compose textarea') && !('ontouchstart' in window)) {
      e.preventDefault(); e.target.form.requestSubmit();
    }
  };
  root.onchange = async (e) => {
    const rowSel = e.target.closest('[data-ch-row]');
    if (rowSel) {
      const v = rowSel.value; rowSel.value = '';
      try {
        if (v === 'decline') await respondFriend(Number(rowSel.dataset.fid), false);
        else if (v === 'cancel') await removeFriend(rowSel.dataset.uid);
      } catch (err) { toast(esc(err.message || t('chat.wentWrong')), { icon: svg('warn') }); }
      return;
    }
    if (!e.target.matches('[data-ch-menu]')) return;
    const v = e.target.value; e.target.value = '';
    const f = friendRow(ui.open);
    if (v === 'remove' && f && confirm(t('chat.removeConfirm', { name: f.display_name }))) {
      await removeFriend(f.user_id); ui.open = null; leaveRoute('chat-thread'); drawChat();
    } else if (v === 'profile') openProfile(f);
  };
}

function openProfile(f) {
  if (!f) return;
  const from = document.querySelector('.ch-head .lb-avatar'); // carried into the profile header
  document.dispatchEvent(new CustomEvent('moske:open-athlete', { detail: { uid: f.user_id, name: f.display_name, avatar: f.avatar, from } }));
}

function editUsername() {
  const cur = socialState().me?.username || '';
  const v = prompt(t('chat.usernamePrompt'), cur);
  if (v == null || cleanUsername(v) === cur) return;
  if (!validUsername(v)) { toast(t('chat.usernameRule'), { icon: svg('warn') }); return; }
  setUsername(cleanUsername(v)).then((n) => { toast(esc(t('chat.nowAt', { name: n })), { icon: svg('check') }); drawChat(); })
    .catch((err) => toast(esc(err.message), { icon: svg('warn') }));
}

// ---- live updates from social.js --------------------------------------------------------------

let _wired = false;
/** Hook the bell, the Chat tab badge and the open chat view to social updates (once). */
export function wireSocialUi({ getTab }) {
  if (_wired) return;
  _wired = true;
  let lastBell = 0;
  onSocial((reason) => {
    paintBell(reason === 'notification' || (reason === 'refresh' && bellCount() > lastBell));
    lastBell = bellCount();
    paintChatBadge();
    paintSeg();
    if (getTab() !== 'chat') {
      if (reason === 'message') {
        const th = threads().find((x) => x.unread && x.last && x.last.sender !== socialState().me?.id);
        if (th) {
          toast(`<b>${esc(th.friend.display_name)}</b><br>${esc(th.last.body.slice(0, 80))}`, {
            icon: svg('chat'), actionLabel: t('chat.open'),
            onAction: () => document.dispatchEvent(new CustomEvent('moske:open-chat', { detail: th.friend.user_id })),
          });
        }
      }
      return;
    }
    if (ui.open && (reason === 'message' || reason === 'read' || reason === 'sent')) refreshThread();
    else if (chatMode() === 'direct' && (!ui.open || reason === 'refresh' || reason === 'load')) drawChat();
  });
}

// General's updates light the badge and the switch too
onRoom(() => { paintChatBadge(); paintSeg(); });

function paintChatBadge() {
  const tab = document.querySelector('.tab[data-tab="chat"]');
  if (!tab) return;
  const n = (socialState().ready ? unreadMessages() : 0) + unreadRoom();
  let b = tab.querySelector('.tab-badge');
  if (!n) { b?.remove(); tab.setAttribute('aria-label', t('nav.chat')); return; }
  if (!b) { b = document.createElement('span'); b.className = 'tab-badge data-num'; tab.appendChild(b); }
  b.textContent = n > 9 ? '9+' : String(n);
  tab.setAttribute('aria-label', t('chat.chatUnread', { n }));
}

/** Light the bell when something waits; ring it once when something new arrives. */
export function paintBell(ring = false) {
  const btn = document.getElementById('bell-btn');
  if (!btn) return;
  const on = socialEnabled() && socialState().ready;
  btn.hidden = !on;
  if (!on) return;
  const n = bellCount();
  btn.classList.toggle('is-lit', n > 0);
  btn.querySelector('.bell-n')?.remove();
  if (n) btn.insertAdjacentHTML('beforeend', `<span class="bell-n data-num" aria-hidden="true">${n > 9 ? '9+' : n}</span>`);
  btn.setAttribute('aria-label', n ? t('chat.notificationsNew', { n }) : t('chat.notifications'));
  if (ring && n) {
    btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring');
  }
}

// ---- the bell's sheet ---------------------------------------------------------------------------

export function openBell() {
  if (topLayerName() === 'bell') return;
  let off = () => {};
  const root = openLayer('bell', { reuse: false, onClose: () => off() });
  const draw = () => {
    const inc = incoming();
    const notes = socialState().notifications;
    // friend requests are answered above; Updates is everything else
    const updates = notes.filter((n) => n.kind !== 'friend_request');
    const unread = new Set(unreadNotifications().map((n) => n.id));
    const row = (n) => {
      const ic = n.kind === 'app_update' ? 'star' : n.kind.startsWith('friend') ? 'friend' : 'bell';
      const uid = n.data?.user_id;
      const msg = n.kind === 'friend_accepted' && uid && relationTo(uid) === 'friends'
        ? `<button class="btn tiny secondary" data-bell="chat" data-uid="${esc(uid)}">${svg('chat')} ${t('chat.message')}</button>` : '';
      return `<li class="bl-row ${unread.has(n.id) ? 'is-new' : ''}">
        <span class="bl-ico">${svg(ic)}</span>
        <span class="ch-txt"><b>${esc(notifTitle(n))}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<small class="muted">${esc(chatTime(n.created_at))}</small></span>
        ${msg}</li>`;
    };
    root.innerHTML = `<div class="modal-backdrop" data-bell-close></div>
      <div class="modal" role="dialog" aria-modal="true" aria-label="${t('chat.notifications')}">
        ${sheetHead({ icon: 'bell', title: t('chat.notifications'), closeAttr: 'data-bell-close' })}
        <div class="modal-body">
          ${inc.length ? `<h3>${t('chat.friendRequests')}</h3><ul class="ch-list">${inc.map((f) => `<li class="ch-row">
            ${avatar(f)}<span class="ch-txt"><b>${esc(f.display_name)}</b><small class="muted">${esc(handle(f))}</small></span>
            <span class="ch-acts">
              <button class="btn tiny primary" data-bell="accept" data-fid="${f.friendship_id}">${t('chat.accept')}</button>
              <button class="icon-btn tiny" data-bell="decline" data-fid="${f.friendship_id}" aria-label="${esc(t('chat.decline', { name: f.display_name }))}">${svg('close')}</button>
            </span></li>`).join('')}</ul>` : ''}
          ${updates.length ? `<h3>${t('chat.updates')}</h3><ul class="bl-list">${updates.map(row).join('')}</ul>`
    : (!inc.length ? dialogue({ who: 'MOSKE', icon: 'bell', text: t('chat.nothingNew'), cls: 'empty-dlg' }) : '')}
        </div>
      </div>`;
  };
  draw();
  off = onSocial(() => { if (root.isConnected) draw(); else off(); });
  root.onclick = async (e) => {
    if (e.target.closest('[data-bell-close]')) { closeLayer(root); return; }
    const b = e.target.closest('[data-bell]');
    if (!b) return;
    try {
      if (b.dataset.bell === 'accept') { await respondFriend(Number(b.dataset.fid), true); toast(t('chat.friendAdded'), { icon: svg('friend') }); }
      else if (b.dataset.bell === 'decline') await respondFriend(Number(b.dataset.fid), false);
      else if (b.dataset.bell === 'chat') {
        closeLayer(root);
        document.dispatchEvent(new CustomEvent('moske:open-chat', { detail: b.dataset.uid }));
      }
    } catch (err) { toast(esc(err.message || t('chat.wentWrong')), { icon: svg('warn') }); }
  };
  // opening the sheet reads everything except requests (those wait for an answer)
  setTimeout(() => markNotificationsRead(), 600);
}

// ---- Add friend (athlete profile from Ranks) -------------------------------------------------

/** The friend button for another athlete's profile, or '' for yourself / signed out. */
export function friendButton(uid, { icon = false } = {}) {
  if (!socialEnabled() || !uid || uid === currentUser()?.id) return '';
  const rel = relationTo(uid);
  const ic = { friends: 'chat', incoming: 'friend', outgoing: 'clock', none: 'friend' }[rel];
  const text = t(`chat.btn.${rel}`);
  const gold = rel === 'none' || rel === 'incoming'; // an invitation to act; Message and Requested stay quiet
  if (icon) {
    // the screen header's one action: an icon button with the full name for screen readers
    return `<button class="icon-btn sh-friend ${gold ? 'is-primary' : ''}" data-friend-btn="${esc(uid)}" data-rel="${rel}" data-icon="1"
      aria-label="${text}" title="${text}" ${rel === 'outgoing' ? 'disabled' : ''}>${svg(ic)}</button>`;
  }
  return `<button class="btn tiny ${gold ? 'primary' : 'secondary'} fh-friend" data-friend-btn="${esc(uid)}" data-rel="${rel}" ${rel === 'outgoing' ? 'disabled' : ''}>${svg(ic)} ${text}</button>`;
}

export function wireFriendButton(root) {
  root?.querySelectorAll('[data-friend-btn]').forEach((b) => b.addEventListener('click', async () => {
    const uid = b.dataset.friendBtn;
    const rel = b.dataset.rel;
    if (rel === 'friends') { document.dispatchEvent(new CustomEvent('moske:open-chat', { detail: uid })); return; }
    b.setAttribute('aria-busy', 'true'); b.disabled = true;
    try {
      if (rel === 'incoming') await respondFriend(friendRow(uid).friendship_id, true);
      else await requestFriend(uid);
      toast(relationTo(uid) === 'friends' ? t('chat.nowFriends') : t('chat.requestSentShort'), { icon: svg('friend') });
      b.outerHTML = friendButton(uid, { icon: b.dataset.icon === '1' });
      wireFriendButton(root);
    } catch (err) {
      b.removeAttribute('aria-busy'); b.disabled = false;
      toast(esc(err.message || t('chat.wentWrong')), { icon: svg('warn') });
    }
  }));
}
