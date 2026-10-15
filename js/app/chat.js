// chat.js — the Chat tab (friends + direct messages) and the notification
// bell's sheet. Data comes from js/app/social.js; this file only draws it and
// reacts to taps. Same pixel skin as the rest of the app: dialogue boxes for
// empty states, stepped panels, display font for labels, body font for text.

import { esc, dialogue } from './ui.js';
import { svg } from '../core/icons.js';
import { chatTime, cleanUsername, validUsername } from '../core/social.js';
import { toast } from './effects.js';
import { currentUser } from './auth.js';
import {
  socialState, socialEnabled, startSocial, onSocial, threads, incoming, outgoing, relationTo, friendRow,
  requestFriend, requestByUsername, respondFriend, removeFriend, setUsername, loadThread, threadWith,
  sendMessage, markThreadRead, unreadNotifications, markNotificationsRead, bellCount, unreadMessages,
} from './social.js';

const ui = { open: null, view: null, draft: new Map() }; // open = friend user_id in the thread view

const avatar = (r, cls = '') => `<span class="lb-avatar ${cls}" aria-hidden="true">${r?.avatar
  ? `<img src="${esc(r.avatar)}" alt="" loading="lazy">`
  : esc((r?.display_name || 'A').trim().charAt(0).toUpperCase())}</span>`;

const handle = (r) => (r?.username ? `@${r.username}` : '');

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
    root.innerHTML = `<div class="day-header"><h2>Chat</h2></div>
      ${dialogue({ who: 'Chat', icon: 'chat', text: 'Sign in to add friends and message them. Your training stays private; only what you send is shared.', cls: 'empty-dlg',
    body: '<button class="btn primary" data-action="open-auth">Sign in</button>' })}`;
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
  return `<div class="day-header"><h2>Chat</h2></div><span class="sr">Loading your chats…</span>
    <ul class="ch-list" aria-hidden="true">${[0, 1, 2].map(row).join('')}</ul>`;
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
  root.innerHTML = `
    <div class="day-header"><h2>Chat</h2>
      <button class="btn tiny secondary" data-ch="edit-name" aria-label="Edit your username">${me?.username ? `@${esc(me.username)}` : 'Set username'}</button></div>
    <form class="card ch-add" data-ch-form="add" autocomplete="off">
      <label class="ch-add-lbl" for="ch-add-in">${svg('friend')} Add a friend</label>
      <div class="ch-add-row">
        <input id="ch-add-in" class="ch-in" type="text" name="u" inputmode="text" autocapitalize="none" spellcheck="false"
          placeholder="@username" maxlength="21" aria-describedby="ch-add-hint">
        <button class="btn primary tiny" type="submit">Add</button>
      </div>
      <small id="ch-add-hint" class="muted">Type their exact username, or tap an athlete on Ranks.</small>
    </form>
    ${inc.length ? `<h3 class="sec-title">${svg('friend')} Requests <span class="ch-count data-num">${inc.length}</span></h3>
      <ul class="ch-list">${inc.map((f) => `<li class="ch-row">
        ${avatar(f)}<span class="ch-txt"><b>${esc(f.display_name)}</b><small class="muted">${esc(handle(f))} wants to be friends</small></span>
        <span class="ch-acts">
          <button class="btn tiny primary" data-ch="accept" data-fid="${f.friendship_id}">Accept</button>
          <button class="icon-btn tiny" data-ch="decline" data-fid="${f.friendship_id}" aria-label="Decline ${esc(f.display_name)}">${svg('close')}</button>
        </span></li>`).join('')}</ul>` : ''}
    <h3 class="sec-title">${svg('chat')} Messages</h3>
    ${ts.length ? `<ul class="ch-list">${ts.map((t) => {
    const f = t.friend; const l = t.last;
    const preview = l ? `${l.sender === me?.id ? 'You: ' : ''}${l.body}` : 'Say hello';
    return `<li><button class="ch-row ch-thread ${t.unread ? 'is-unread' : ''}" data-ch="open" data-uid="${esc(f.user_id)}"
        aria-label="${esc(`${f.display_name}${t.unread ? `, ${t.unread} unread` : ''}`)}">
        ${avatar(f)}
        <span class="ch-txt"><b>${esc(f.display_name)}</b><small class="${l ? '' : 'muted'}">${esc(preview)}</small></span>
        <span class="ch-meta">${l ? `<small class="muted">${esc(chatTime(l.created_at))}</small>` : ''}
          ${t.unread ? `<span class="ch-badge data-num">${t.unread}</span>` : ''}</span>
      </button></li>`;
  }).join('')}</ul>`
    : dialogue({ who: 'Chat', icon: 'chat', text: 'No friends yet. Add someone by username above, or open an athlete on Ranks and tap Add friend.', cls: 'empty-dlg' })}
    ${out.length ? `<h3 class="sec-title">${svg('clock')} Sent</h3>
      <ul class="ch-list">${out.map((f) => `<li class="ch-row">
        ${avatar(f)}<span class="ch-txt"><b>${esc(f.display_name)}</b><small class="muted">Waiting for ${esc(handle(f) || 'them')} to accept</small></span>
        <button class="btn tiny ghost" data-ch="cancel" data-uid="${esc(f.user_id)}">Cancel</button></li>`).join('')}</ul>` : ''}`;
  wireChat(root);
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function bubbles(uid) {
  const me = socialState().me?.id;
  const msgs = threadWith(uid);
  if (!msgs.length) return '<p class="muted ch-hello">No messages yet. Say hello.</p>';
  let lastDay = '';
  return msgs.map((m) => {
    const day = dayLabel(m.created_at);
    const sep = day !== lastDay ? `<li class="ch-day" aria-hidden="true"><span>${esc(day)}</span></li>` : '';
    lastDay = day;
    const mine = m.sender === me;
    const time = new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${sep}<li class="ch-msg ${mine ? 'mine' : 'theirs'}"><p>${esc(m.body)}</p>
      <small>${esc(time)}${mine && m.read_at ? ' · Read' : ''}</small></li>`;
  }).join('');
}

function drawThread(root, uid) {
  const f = friendRow(uid);
  const draft = ui.draft.get(uid) || '';
  root.innerHTML = `
    <div class="ch-head">
      <button class="fh-back" data-ch="back" aria-label="Back to chats">${svg('back')}</button>
      <button class="ch-who" data-ch="profile" aria-label="View ${esc(f?.display_name || 'friend')}’s profile">
        ${avatar(f)}
        <span class="ch-txt"><b>${esc(f?.display_name || 'Friend')}</b><small class="muted">${esc(handle(f))}</small></span>
      </button>
      <label class="icon-btn tiny gl-more" title="More">${svg('more')}
        <select data-ch-menu aria-label="More options">
          <option value="" selected disabled hidden>More</option>
          <option value="profile">View profile</option>
          <option value="remove">Remove friend</option>
        </select></label>
    </div>
    <ol class="ch-msgs" id="ch-msgs" aria-live="polite">${bubbles(uid)}</ol>
    <form class="ch-compose" data-ch-form="send" autocomplete="off">
      <textarea class="ch-in" name="body" rows="1" maxlength="1000" placeholder="Message ${esc(f?.display_name || '')}" aria-label="Message">${esc(draft)}</textarea>
      <button class="btn primary ch-send" type="submit" aria-label="Send">${svg('send')}</button>
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
  drawChat();
  loadThread(uid).then(() => refreshThread()).catch(() => {});
}

function wireChat(root) {
  root.onclick = async (e) => {
    const b = e.target.closest('[data-ch]');
    if (!b) return;
    const act = b.dataset.ch;
    try {
      if (act === 'open') openThread(b.dataset.uid);
      else if (act === 'back') { ui.open = null; drawChat(); }
      else if (act === 'accept') { b.setAttribute('aria-busy', 'true'); await respondFriend(Number(b.dataset.fid), true); toast('Friend added', { icon: svg('friend') }); }
      else if (act === 'decline') { await respondFriend(Number(b.dataset.fid), false); }
      else if (act === 'cancel') { await removeFriend(b.dataset.uid); }
      else if (act === 'edit-name') editUsername();
      else if (act === 'profile') openProfile(friendRow(ui.open));
    } catch (err) { toast(esc(err.message || 'Something went wrong'), { icon: svg('warn') }); }
  };
  root.onsubmit = async (e) => {
    const form = e.target.closest('[data-ch-form]');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    if (form.dataset.chForm === 'add') {
      const v = form.u.value;
      if (!validUsername(v)) { toast('Usernames are 3–20 letters, numbers or _', { icon: svg('warn') }); return; }
      btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
      try {
        const r = await requestByUsername(v);
        form.reset();
        toast(r.status === 'friends' ? `You and ${esc(r.user.display_name)} are friends` : `Request sent to @${esc(cleanUsername(v))}`, { icon: svg('friend') });
      } catch (err) { toast(esc(err.message), { icon: svg('warn') }); } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
    } else {
      const ta = form.body;
      const text = ta.value.trim();
      if (!text || !ui.open) return;
      ta.value = ''; ui.draft.delete(ui.open);
      try { await sendMessage(ui.open, text); refreshThread(); scrollToEnd(); } catch (err) {
        ta.value = text; toast(esc(err.message), { icon: svg('warn') });
      }
      ta.focus();
    }
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
    if (!e.target.matches('[data-ch-menu]')) return;
    const v = e.target.value; e.target.value = '';
    const f = friendRow(ui.open);
    if (v === 'remove' && f && confirm(`Remove ${f.display_name} from your friends? You won’t be able to message each other.`)) {
      await removeFriend(f.user_id); ui.open = null; drawChat();
    } else if (v === 'profile') openProfile(f);
  };
}

function openProfile(f) {
  if (!f) return;
  document.dispatchEvent(new CustomEvent('moske:open-athlete', { detail: { uid: f.user_id, name: f.display_name, avatar: f.avatar } }));
}

function editUsername() {
  const cur = socialState().me?.username || '';
  const v = prompt('Your username (3–20 letters, numbers or _). Friends use it to find you.', cur);
  if (v == null || cleanUsername(v) === cur) return;
  if (!validUsername(v)) { toast('Usernames are 3–20 letters, numbers or _', { icon: svg('warn') }); return; }
  setUsername(cleanUsername(v)).then((n) => { toast(`You’re now @${esc(n)}`, { icon: svg('check') }); drawChat(); })
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
    if (getTab() !== 'chat') {
      if (reason === 'message') {
        const t = threads().find((x) => x.unread && x.last && x.last.sender !== socialState().me?.id);
        if (t) {
          toast(`<b>${esc(t.friend.display_name)}</b><br>${esc(t.last.body.slice(0, 80))}`, {
            icon: svg('chat'), actionLabel: 'Open',
            onAction: () => document.dispatchEvent(new CustomEvent('moske:open-chat', { detail: t.friend.user_id })),
          });
        }
      }
      return;
    }
    if (ui.open && (reason === 'message' || reason === 'read' || reason === 'sent')) refreshThread();
    else if (!ui.open || reason === 'refresh' || reason === 'load') drawChat();
  });
}

function paintChatBadge() {
  const tab = document.querySelector('.tab[data-tab="chat"]');
  if (!tab) return;
  const n = socialState().ready ? unreadMessages() : 0;
  let b = tab.querySelector('.tab-badge');
  if (!n) { b?.remove(); tab.setAttribute('aria-label', 'Chat'); return; }
  if (!b) { b = document.createElement('span'); b.className = 'tab-badge data-num'; tab.appendChild(b); }
  b.textContent = n > 9 ? '9+' : String(n);
  tab.setAttribute('aria-label', `Chat, ${n} unread`);
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
  btn.setAttribute('aria-label', n ? `Notifications, ${n} new` : 'Notifications');
  if (ring && n) {
    btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring');
  }
}

// ---- the bell's sheet ---------------------------------------------------------------------------

export function openBell() {
  const root = document.getElementById('modal-root');
  root.classList.add('open');
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
        ? `<button class="btn tiny secondary" data-bell="chat" data-uid="${esc(uid)}">${svg('chat')} Message</button>` : '';
      return `<li class="bl-row ${unread.has(n.id) ? 'is-new' : ''}">
        <span class="bl-ico">${svg(ic)}</span>
        <span class="ch-txt"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ''}<small class="muted">${esc(chatTime(n.created_at))}</small></span>
        ${msg}</li>`;
    };
    root.innerHTML = `<div class="modal-backdrop" data-bell-close></div>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Notifications">
        <header class="modal-head"><h2>${svg('bell')} Notifications</h2><button class="icon-btn" data-bell-close aria-label="Close">${svg('close')}</button></header>
        <div class="modal-body">
          ${inc.length ? `<h3>Friend requests</h3><ul class="ch-list">${inc.map((f) => `<li class="ch-row">
            ${avatar(f)}<span class="ch-txt"><b>${esc(f.display_name)}</b><small class="muted">${esc(handle(f))}</small></span>
            <span class="ch-acts">
              <button class="btn tiny primary" data-bell="accept" data-fid="${f.friendship_id}">Accept</button>
              <button class="icon-btn tiny" data-bell="decline" data-fid="${f.friendship_id}" aria-label="Decline ${esc(f.display_name)}">${svg('close')}</button>
            </span></li>`).join('')}</ul>` : ''}
          ${updates.length ? `<h3>Updates</h3><ul class="bl-list">${updates.map(row).join('')}</ul>`
    : (!inc.length ? dialogue({ who: 'MOSKE', icon: 'bell', text: 'Nothing new. Friend requests and app news show up here.', cls: 'empty-dlg' }) : '')}
        </div>
      </div>`;
  };
  draw();
  const off = onSocial(() => { if (root.querySelector('[aria-label="Notifications"]')) draw(); else off(); });
  root.onclick = async (e) => {
    if (e.target.closest('[data-bell-close]')) { root.innerHTML = ''; root.classList.remove('open'); root.onclick = null; off(); return; }
    const b = e.target.closest('[data-bell]');
    if (!b) return;
    try {
      if (b.dataset.bell === 'accept') { await respondFriend(Number(b.dataset.fid), true); toast('Friend added', { icon: svg('friend') }); }
      else if (b.dataset.bell === 'decline') await respondFriend(Number(b.dataset.fid), false);
      else if (b.dataset.bell === 'chat') {
        root.innerHTML = ''; root.classList.remove('open'); root.onclick = null; off();
        document.dispatchEvent(new CustomEvent('moske:open-chat', { detail: b.dataset.uid }));
      }
    } catch (err) { toast(esc(err.message || 'Something went wrong'), { icon: svg('warn') }); }
  };
  // opening the sheet reads everything except requests (those wait for an answer)
  setTimeout(() => markNotificationsRead(), 600);
}

// ---- Add friend (athlete profile from Ranks) -------------------------------------------------

/** The friend button for another athlete's profile, or '' for yourself / signed out. */
export function friendButton(uid) {
  if (!socialEnabled() || !uid || uid === currentUser()?.id) return '';
  const rel = relationTo(uid);
  const label = { friends: `${svg('chat')} Message`, incoming: `${svg('friend')} Accept request`, outgoing: `${svg('clock')} Requested`, none: `${svg('friend')} Add friend` }[rel];
  return `<button class="btn tiny ${rel === 'none' || rel === 'incoming' ? 'primary' : 'secondary'} fh-friend" data-friend-btn="${esc(uid)}" data-rel="${rel}" ${rel === 'outgoing' ? 'disabled' : ''}>${label}</button>`;
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
      toast(relationTo(uid) === 'friends' ? 'You’re now friends' : 'Friend request sent', { icon: svg('friend') });
      b.outerHTML = friendButton(uid);
      wireFriendButton(root);
    } catch (err) {
      b.removeAttribute('aria-busy'); b.disabled = false;
      toast(esc(err.message || 'Something went wrong'), { icon: svg('warn') });
    }
  }));
}
