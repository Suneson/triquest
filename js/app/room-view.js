// room-view.js — General, drawn inside the Chat tab: everyone's messages,
// newest at the bottom, earlier ones load as you scroll up. A message shows
// the author's avatar, @username, level and time; tap the author for their
// profile. Each message's ⋮ holds Report and Block (and Remove for your own,
// or for an admin). A blocked author's messages fold to "Message hidden".

import { esc, dialogue } from './ui.js';
import { svg } from '../core/icons.js';
import { chatTime } from '../core/social.js';
import { roomView } from '../core/room.js';
import { levelFromTotalXp } from '../core/scoring.js';
import { toast } from './effects.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import {
  roomState, onRoom, startRoom, loadOlder, sendRoom, discardRoom, removeRoom, reportRoom,
  blockUser, unblockUser, author, markRoomRead,
} from './room.js';

const GROUP_MS = 5 * 60000; // messages from one person within 5 min sit under one header
let mounted = null;          // { root, view, observer }
let draft = '';

const avatarOf = (a, uid) => `<span class="lb-avatar" aria-hidden="true">${a?.avatar
  ? `<img src="${esc(a.avatar)}" alt="" loading="lazy">`
  : esc((a?.display_name || 'A').trim().charAt(0).toUpperCase())}</span>`;
const nameOf = (a) => (a?.username ? `@${a.username}` : (a?.display_name || 'Athlete'));

function dayLabel(iso) {
  const d = new Date(iso); const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function menu(m, a) {
  const st = roomState();
  const items = [];
  if (m.kind === 'hidden') items.push(['unblock', `Unblock ${nameOf(a)}`]);
  if (m.kind === 'msg' && !m.mine) items.push(['report', 'Report message'], ['block', `Block ${nameOf(a)}`]);
  if (m.kind === 'msg' && (m.mine || st.isAdmin)) items.push(['remove', m.mine ? 'Remove my message' : 'Remove (admin)']);
  if (!items.length) return '';
  return `<label class="icon-btn tiny gl-more rm-more" title="More">${svg('more')}
    <select data-rm-menu data-mid="${m.id}" data-uid="${esc(m.user_id)}" aria-label="More for this message">
      <option value="" selected disabled hidden>More</option>
      ${items.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}
    </select></label>`;
}

function listHtml() {
  const st = roomState();
  const items = roomView(st.messages, { blocked: st.blocked, me: st.me });
  let lastDay = ''; let prev = null;
  const rows = items.map((m) => {
    const day = dayLabel(m.created_at);
    const sep = day !== lastDay ? `<li class="ch-day" aria-hidden="true"><span>${esc(day)}</span></li>` : '';
    if (sep) prev = null;
    lastDay = day;
    const a = author(m.user_id);
    const cont = prev && prev.user_id === m.user_id && prev.kind === 'msg' && m.kind === 'msg'
      && Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_MS;
    prev = m;
    if (m.kind === 'removed' || m.kind === 'hidden') {
      return `${sep}<li class="rm-msg rm-note ${m.mine ? 'mine' : ''}"><p>${m.kind === 'removed' ? 'Message removed' : `Message hidden (you blocked ${esc(nameOf(a))})`}</p>${menu(m, a)}</li>`;
    }
    const lvl = levelFromTotalXp(Number(a?.xp) || 0).level;
    const head = m.mine || cont ? '' : `<div class="rm-head">
        <button class="rm-name" data-rm="profile" data-uid="${esc(m.user_id)}">${esc(nameOf(a))}</button>
        <span class="lvl-chip rm-lvl">LVL ${lvl}</span>
        <time datetime="${esc(m.created_at)}">${esc(chatTime(m.created_at))}</time></div>`;
    const status = m.kind === 'pending' ? '<small class="rm-status">Sending…</small>'
      : m.kind === 'failed' ? `<small class="rm-status is-failed">${esc(m.error || 'Not sent.')}
          <button class="link" data-rm="retry" data-cid="${esc(m.client_id)}">Retry</button>
          <button class="link" data-rm="discard" data-cid="${esc(m.client_id)}">Discard</button></small>`
      : m.mine ? `<small class="rm-status"><time datetime="${esc(m.created_at)}">${esc(chatTime(m.created_at))}</time></small>` : '';
    return `${sep}<li class="rm-msg ${m.mine ? 'mine' : 'theirs'}${cont ? ' cont' : ''}${m.kind !== 'msg' ? ` is-${m.kind}` : ''}" data-mid="${m.id}">
      ${m.mine ? '' : cont ? '<span class="rm-av-gap"></span>' : `<button class="rm-av" data-rm="profile" data-uid="${esc(m.user_id)}" aria-label="${esc(`${nameOf(a)}, open profile`)}">${avatarOf(a)}</button>`}
      <div class="rm-bub">${head}<p>${esc(m.body)}</p>${status}</div>
      ${menu(m, a)}
    </li>`;
  }).join('');
  const top = st.hasMore ? '<li class="rm-top" data-rm-top><span class="muted small">Loading earlier messages…</span></li>'
    : '<li class="rm-top"><span class="muted small">This is the start of General. Be kind, keep it about training.</span></li>';
  return items.length ? top + rows : `${top}<li class="ch-hello muted">No messages yet. Say hello to everyone.</li>`;
}

function skeleton() {
  return `<span class="sr">Loading General…</span><ol class="rm-msgs" aria-hidden="true">${[0, 1, 2, 3].map((i) =>
    `<li class="rm-msg theirs is-sk" style="--sk-i:${i}"><span class="lb-avatar sk-tile"></span><div class="rm-bub"><i class="sk-line" style="width:${[55, 70, 40, 62][i]}%"></i></div></li>`).join('')}</ol>`;
}

function draw() {
  if (!mounted) return;
  const { root } = mounted;
  const st = roomState();
  if (st.error && !st.ready) {
    root.innerHTML = dialogue({ who: 'General', icon: 'chat', text: `Couldn’t load General. ${st.error}`, cls: 'empty-dlg',
      body: '<button class="btn secondary" data-rm="reload">Try again</button>' });
    return;
  }
  if (!st.ready) { root.innerHTML = skeleton(); return; }
  root.innerHTML = `
    <ol class="rm-msgs" id="rm-msgs" aria-live="polite" aria-label="General chat">${listHtml()}</ol>
    <form class="ch-compose rm-compose" data-rm-form autocomplete="off">
      ${st.offline ? `<p class="rm-offline" role="status">${svg('cloud')} You’re offline. You can read; sending waits until you’re back.</p>` : ''}
      <textarea class="ch-in" name="body" rows="1" maxlength="500" placeholder="Message everyone" aria-label="Message everyone in General" ${st.offline ? 'disabled' : ''}>${esc(draft)}</textarea>
      <button class="btn primary ch-send" type="submit" aria-label="Send" ${st.offline ? 'disabled' : ''}>${svg('send')}</button>
    </form>`;
  watchTop();
}

function atEnd() {
  const v = mounted?.view;
  return v ? v.scrollHeight - v.scrollTop - v.clientHeight < 80 : true;
}
function toEnd() {
  const v = mounted?.view;
  requestAnimationFrame(() => { if (v) v.scrollTop = v.scrollHeight; });
}

/** Only the list changes while you read and type (the composer keeps focus and draft). */
function refreshList({ keepTop = false } = {}) {
  const list = document.getElementById('rm-msgs');
  if (!list) { draw(); return; }
  const v = mounted.view;
  const end = atEnd();
  const fromBottom = v.scrollHeight - v.scrollTop;
  list.innerHTML = listHtml();
  if (keepTop) v.scrollTop = v.scrollHeight - fromBottom; // older messages arrived above: stay where you were
  else if (end) toEnd();
  watchTop();
  if (atEnd()) markRoomRead();
}

// scrolling to the top loads the page before
function watchTop() {
  mounted?.observer?.disconnect();
  const top = mounted?.root.querySelector('[data-rm-top]');
  if (!top || !('IntersectionObserver' in window)) return;
  mounted.observer = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) loadOlder().then((n) => { if (n) refreshList({ keepTop: true }); });
  }, { root: mounted.view, rootMargin: '200px 0px 0px 0px' });
  mounted.observer.observe(top);
}

function openReport(id) {
  const root = openLayer('report');
  root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
    <div class="modal pk-modal pk-small" role="dialog" aria-modal="true" aria-labelledby="rp-title">
      ${sheetHead({ icon: 'warn', title: 'Report message', id: 'rp-title' })}
      <form class="modal-body" data-rp-form>
        <label class="field"><span>What’s wrong? (optional)</span><input type="text" name="reason" maxlength="300" autocomplete="off"></label>
        <p class="muted small">The owner of MOSKE reviews every report. The author isn’t told who reported it.</p>
        <button class="btn primary block" type="submit">Report</button>
      </form>
    </div>`;
  root.querySelector('[data-rp-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await reportRoom(id, e.target.reason.value.trim() || null); closeLayer(root); toast('Reported. Thanks for keeping General friendly.', { icon: svg('check') }); }
    catch (err) { toast(esc(err.message || 'Couldn’t report'), { icon: svg('warn') }); }
  });
}

function wire(root) {
  root.onclick = async (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    const act = b.dataset.rm;
    if (act === 'profile') {
      const a = author(b.dataset.uid);
      const from = b.closest('.rm-msg')?.querySelector('.lb-avatar');
      document.dispatchEvent(new CustomEvent('moske:open-athlete', { detail: { uid: b.dataset.uid, name: a?.display_name || 'Athlete', avatar: a?.avatar || null, from } }));
    } else if (act === 'retry') {
      const m = roomState().messages.find((x) => x.pending && x.client_id === b.dataset.cid);
      if (m) sendRoom(m.body, { retryOf: m.client_id });
    } else if (act === 'discard') discardRoom(b.dataset.cid);
    else if (act === 'reload') { startRoom(); draw(); }
  };
  root.onchange = async (e) => {
    const sel = e.target.closest('[data-rm-menu]');
    if (!sel) return;
    const v = sel.value; sel.value = '';
    const id = Number(sel.dataset.mid); const uid = sel.dataset.uid; const a = author(uid);
    try {
      if (v === 'report') openReport(id);
      else if (v === 'block' && confirm(`Block ${nameOf(a)}? Their messages will be hidden for you. They won’t be told.`)) { await blockUser(uid); toast(`${esc(nameOf(a))} is blocked`, { icon: svg('check') }); }
      else if (v === 'unblock') await unblockUser(uid);
      else if (v === 'remove' && confirm('Remove this message for everyone?')) await removeRoom(id);
    } catch (err) { toast(esc(err.message || 'Something went wrong'), { icon: svg('warn') }); }
  };
  root.onsubmit = async (e) => {
    if (!e.target.matches('[data-rm-form]')) return;
    e.preventDefault();
    const ta = e.target.body;
    const text = ta.value;
    const err = await sendRoom(text);
    if (err) { toast(esc(err), { icon: svg('warn') }); return; }
    ta.value = ''; draft = ''; ta.style.height = 'auto';
    toEnd(); ta.focus();
  };
  root.oninput = (e) => {
    if (!e.target.matches('.rm-compose textarea')) return;
    draft = e.target.value;
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`;
  };
  root.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.rm-compose textarea') && !('ontouchstart' in window)) {
      e.preventDefault(); e.target.form.requestSubmit();
    }
  };
}

let _wired = false;
/** Draw General into `root` (inside the Chat tab, scrolling with `view`). */
export function mountRoom(root, view) {
  mounted?.observer?.disconnect();
  mounted = { root, view, observer: null };
  wire(root);
  if (!_wired) {
    _wired = true;
    onRoom((why) => {
      if (!mounted?.root.isConnected) return;
      if (why === 'load' || why === 'error' || why === 'online' || why === 'offline' || why === 'stop') { draw(); if (why === 'load') { toEnd(); markRoomRead(); } }
      else if (why !== 'read' && why !== 'older') refreshList();
    });
  }
  const st = roomState();
  if (!st.ready) startRoom();
  draw();
  if (st.ready) { toEnd(); markRoomRead(); }
}

export function unmountRoom() { mounted?.observer?.disconnect(); mounted = null; }
