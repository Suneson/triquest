// clubs-view.js — the Club side of the Chat tab, and the club board
// (docs/LOOP.md §6). In a club: its crest and name, this week's shared total
// and the club's own room (General's plumbing, room-view.js). Not in one:
// your invites, starting a club, and finding one by name. The board holds the
// weekly target, the relay map filling in round the island, and who's in it,
// by name only. Leaving is one tap, costs nothing and tells no one.

import { esc, dialogue, meter } from './ui.js';
import { svg } from '../core/icons.js';
import { t, fmtNum } from '../core/i18n.js';
import { toast, playAccept } from './effects.js';
import { haptic } from './haptics.js';
import { busy } from './motion.js';
import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { mountRoom, unmountRoom } from './room-view.js';
import {
  clubState, refreshClub, onClub, clubRoom, clubsEnabled, clubError, listClubs, createClub, inviteToClub, respondInvite, leaveClub, setClubTarget, startRelay,
} from './clubs-state.js';
import {
  CLUB_RULES, crestArt, RELAY_MAP, routeById, nextRoute, routePath, routeLength, relayProgress, weeklyTargetMin, weekStanding, RELAY_ROUTES,
} from '../core/clubs.js';
import { socialState } from './social.js';

const hours = (min) => fmtNum(Math.round(min / 6) / 10);
let pickedCrest = CLUB_RULES.crests[0];
let found = null; // the last search's clubs

/** The week as a meter: the club's verified hours against its target. */
function weekBlock(b) {
  const target = weeklyTargetMin(b.members.length, b.target_minutes);
  const w = weekStanding(b.week_minutes, target);
  return `<div class="cl-week${w.done ? ' is-done' : ''}">
    <span class="cl-week-h">${t('club.week')}</span>
    <b class="data-num">${t('club.hoursOf', { n: hours(w.minutes), of: hours(target) })}</b>
    ${meter(w.frac, { segments: 12, cls: 'cl-meter', label: t('club.weekAria', { n: hours(w.minutes), of: hours(target) }) })}
    ${w.done ? `<small>${svg('check')} ${t('club.weekDone')}</small>` : ''}
  </div>`;
}

/** The relay: the island, the whole route faint, the part the club has covered bright. */
export function relayMap(b, { big = false } = {}) {
  const route = routeById(b.relay?.route_id) || RELAY_ROUTES[0];
  const p = relayProgress(route, b.relay?.km || 0);
  const len = routeLength(route).toFixed(2);
  const on = (p.frac * routeLength(route)).toFixed(2);
  const start = relayProgress(route, 0).at;
  return `<figure class="cl-relay${big ? ' is-big' : ''}${p.done ? ' is-done' : ''}">
    <div class="cl-map">
      <img src="${RELAY_MAP}" width="768" height="768" alt="${esc(t('club.mapAlt'))}" loading="lazy">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="cl-route" d="${routePath(route)}"/>
        <path class="cl-route-on" d="${routePath(route)}" style="stroke-dasharray:${on} ${len}"/>
        <circle class="cl-start" cx="${start[0]}" cy="${start[1]}" r="1.8"/>
        <circle class="cl-at" cx="${p.at[0]}" cy="${p.at[1]}" r="2.6"/>
      </svg>
    </div>
    <figcaption><b>${esc(t(`club.route.${route.id}`))}</b>
      <span class="data-num">${t('club.kmOf', { n: fmtNum(p.km), of: fmtNum(p.of) })}</span>
      ${meter(p.frac, { segments: 16, cls: 'cl-meter', label: t('club.relayAria', { n: fmtNum(p.km), of: fmtNum(p.of) }) })}</figcaption>
  </figure>`;
}

// ---- the Club side of the Chat tab ------------------------------------------------------

function noClub(st) {
  const inv = st.invites || [];
  const crests = CLUB_RULES.crests.map((c) => `<label class="cl-crest-opt">
      <input type="radio" name="crest" value="${c}"${c === pickedCrest ? ' checked' : ''}>
      <img src="${crestArt(c)}" width="56" height="56" alt="${esc(t(`club.crest.${c}`))}"></label>`).join('');
  return `
    ${inv.length ? `<section class="cl-sec" aria-labelledby="cl-inv-h"><h3 id="cl-inv-h" class="cl-h">${t('club.invites')}</h3>
      <ul class="cl-list">${inv.map((i) => `<li class="cl-row">
        <img src="${crestArt(i.crest)}" width="44" height="44" alt="">
        <span class="cl-row-txt"><b>${esc(i.name)}</b><small>${t('club.invitedBy', { name: esc(i.invited_by), n: i.members })}</small></span>
        <span class="cl-row-act"><button class="btn tiny primary" data-cl="accept" data-id="${i.id}">${t('club.join')}</button>
          <button class="icon-btn tiny" data-cl="decline" data-id="${i.id}" aria-label="${esc(t('club.declineAria', { name: i.name }))}">${svg('close')}</button></span>
      </li>`).join('')}</ul></section>` : ''}
    ${dialogue({ who: t('club.title'), icon: 'friend', text: t('club.pitch', { n: CLUB_RULES.maxMembers }), cls: 'cl-pitch' })}
    <form class="cl-sec cl-new" data-cl-form="create" autocomplete="off">
      <h3 class="cl-h">${t('club.start')}</h3>
      <label class="cl-field"><span>${t('club.name')}</span>
        <input name="name" maxlength="${CLUB_RULES.nameMax}" minlength="${CLUB_RULES.nameMin}" required placeholder="${esc(t('club.namePh'))}"></label>
      <fieldset class="cl-crests"><legend>${t('club.crestPick')}</legend>${crests}</fieldset>
      <button class="btn primary" type="submit">${svg('plus')} ${t('club.create')}</button>
    </form>
    <section class="cl-sec" aria-labelledby="cl-find-h">
      <h3 id="cl-find-h" class="cl-h">${t('club.find')}</h3>
      <form class="cl-search" data-cl-form="find" role="search"><input name="q" placeholder="${esc(t('club.findPh'))}" aria-label="${esc(t('club.findPh'))}">
        <button class="btn secondary tiny" type="submit">${svg('search')}</button></form>
      ${found ? (found.length ? `<ul class="cl-list">${found.map((c) => `<li class="cl-row">
        <img src="${crestArt(c.crest)}" width="44" height="44" alt=""><span class="cl-row-txt"><b>${esc(c.name)}</b>
        <small>${t('club.membersN', { n: c.members, max: CLUB_RULES.maxMembers })}</small></span></li>`).join('')}</ul>
        <p class="cl-note">${t('club.inviteOnly', { me: esc(socialState().me?.username ? `@${socialState().me.username}` : t('club.yourUsername')) })}</p>`
    : `<p class="cl-note">${t('club.noneFound')}</p>`) : ''}
    </section>`;
}

function inClub(b) {
  return `<button class="cl-head" data-cl="board" aria-label="${esc(t('club.boardAria', { name: b.name }))}">
      <img src="${crestArt(b.crest)}" width="56" height="56" alt="">
      <span class="cl-head-txt"><b>${esc(b.name)}</b><small>${t('club.membersN', { n: b.members.length, max: CLUB_RULES.maxMembers })}</small></span>
      <span class="cl-head-go">${t('club.board')} ${svg('chevron')}</span>
    </button>
    ${weekBlock(b)}
    <div class="rm" id="club-room"></div>`;
}

/** Draw the Club side into the Chat tab's `root` (below the General | Direct | Club switch). */
export function drawClub(root, view) {
  const host = root.querySelector('#club-root');
  if (!host) return;
  if (!clubsEnabled()) { host.innerHTML = `<p class="cl-note">${t('club.signIn')}</p>`; return; }
  const st = clubState();
  if (!st.ready) { host.innerHTML = `<p class="cl-note" aria-busy="true">${t('club.loading')}</p>`; refreshClub(); return; }
  if (st.board) {
    // the room keeps itself live; only draw it once per club
    const cur = host.querySelector('#club-room');
    if (cur && Number(cur.dataset.club) === st.board.id) {
      host.querySelector('.cl-week')?.replaceWith(Object.assign(document.createElement('div'), { innerHTML: weekBlock(st.board) }).firstElementChild);
      return;
    }
    host.innerHTML = inClub(st.board);
    host.querySelector('#club-room').dataset.club = st.board.id;
    mountRoom(host.querySelector('#club-room'), view, clubRoom());
  } else {
    unmountRoom();
    host.innerHTML = noClub(st);
  }
  wire(host, view);
}

function wire(host, view) {
  host.onclick = async (e) => {
    const b = e.target.closest('[data-cl]');
    if (!b) return;
    const act = b.dataset.cl;
    if (act === 'board') { openClubBoard(); return; }
    if (act === 'accept' || act === 'decline') {
      await busy(b, async () => {
        try {
          await respondInvite(Number(b.dataset.id), act === 'accept');
          if (act === 'accept') { playAccept(); haptic('record'); toast(t('club.joined'), { icon: svg('friend') }); }
        } catch (err) { toast(esc(clubError(err)), { icon: svg('warn') }); }
      });
    }
  };
  host.onchange = (e) => { if (e.target.name === 'crest') pickedCrest = e.target.value; };
  host.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.dataset.clForm === 'find') {
      found = await listClubs(f.q.value.trim());
      drawClub(document.getElementById('chat-root'), view);
      return;
    }
    if (f.dataset.clForm === 'create') {
      const btn = f.querySelector('[type="submit"]');
      await busy(btn, async () => {
        try {
          await createClub(f.name.value, pickedCrest);
          playAccept(); haptic('levelUp');
          toast(t('club.created'), { icon: svg('friend') });
        } catch (err) { toast(esc(clubError(err)), { icon: svg('warn') }); }
      });
    }
  };
}

// ---- the club board ----------------------------------------------------------------------

/** The club board sheet: the week, the relay, who's in, invite, leave. */
export function openClubBoard() {
  const root = openLayer('club-board');
  let off = null;
  const draw = () => {
    const b = clubState().board;
    if (!b) { closeLayer(root); return; }
    const route = routeById(b.relay?.route_id) || RELAY_ROUTES[0];
    const done = relayProgress(route, b.relay?.km || 0).done;
    const target = weeklyTargetMin(b.members.length, b.target_minutes);
    root.innerHTML = `<div class="modal-backdrop" data-cb-close></div>
      <div class="modal cl-modal" role="dialog" aria-modal="true" aria-labelledby="cb-h">
        ${sheetHead({ title: esc(b.name), id: 'cb-h', closeAttr: 'data-cb-close', before: `<img class="cl-sheet-crest" src="${crestArt(b.crest)}" width="36" height="36" alt="">` })}
        <div class="modal-body">
          ${weekBlock(b)}
          <form class="cl-target" data-cb-form="target">
            <label><span>${t('club.targetLabel')}</span>
              <input type="number" name="h" inputmode="numeric" min="${CLUB_RULES.targetHours.min}" max="${CLUB_RULES.targetHours.max}" value="${Math.round(target / 60)}"></label>
            <button class="btn secondary tiny" type="submit">${t('club.targetSave')}</button>
          </form>
          <p class="cl-note">${t('club.targetNote', { n: CLUB_RULES.defaultMinPerMember / 60 })}</p>
          <h3 class="cl-h">${t('club.relay')} <span class="cl-sub">${t('club.relaysDone', { n: b.relays_done || 0 })}</span></h3>
          ${relayMap(b, { big: true })}
          ${done ? `<button class="btn primary cl-next" data-cb="relay">${svg('route')} ${t('club.nextRoute', { name: t(`club.route.${nextRoute(route.id).id}`) })}</button>` : ''}
          <p class="cl-note">${t('club.relayNote')}</p>
          <h3 class="cl-h">${t('club.members')} <span class="cl-sub">${b.members.length} / ${CLUB_RULES.maxMembers}</span></h3>
          <ul class="cl-members">${b.members.map((m) => `<li><span class="lb-avatar" aria-hidden="true">${m.avatar ? `<img src="${esc(m.avatar)}" alt="">` : esc((m.display_name || 'A').charAt(0).toUpperCase())}</span>
            <b>${esc(m.display_name)}</b>${m.username ? `<small>@${esc(m.username)}</small>` : ''}${m.role === 'owner' ? `<i class="cl-owner">${t('club.owner')}</i>` : ''}</li>`).join('')}</ul>
          <p class="cl-note">${svg('lock')} ${t('club.privacy')}</p>
          ${b.members.length < CLUB_RULES.maxMembers ? `<form class="cl-invite" data-cb-form="invite" autocomplete="off">
            <label><span>${t('club.inviteLabel')}</span><input name="u" placeholder="@username" required></label>
            <button class="btn primary tiny" type="submit">${t('club.invite')}</button></form>` : `<p class="cl-note">${t('club.full', { n: CLUB_RULES.maxMembers })}</p>`}
          <button class="btn ghost cl-leave" data-cb="leave">${t('club.leave')}</button>
        </div>
      </div>`;
  };
  draw();
  off = onClub(() => { if (root.isConnected) draw(); else off?.(); });
  root.onclick = async (e) => {
    if (e.target.closest('[data-cb-close]')) { closeLayer(root); return; }
    const b = e.target.closest('[data-cb]');
    if (!b) return;
    if (b.dataset.cb === 'leave') {
      if (!confirm(t('club.leaveConfirm'))) return;
      try { await leaveClub(); closeLayer(root); toast(t('club.left'), { icon: svg('check') }); } catch (err) { toast(esc(clubError(err)), { icon: svg('warn') }); }
      return;
    }
    if (b.dataset.cb === 'relay') {
      await busy(b, async () => {
        try { await startRelay(); playAccept(); haptic('levelUp'); } catch (err) { toast(esc(clubError(err)), { icon: svg('warn') }); }
      });
    }
  };
  root.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector('[type="submit"]');
    await busy(btn, async () => {
      try {
        if (f.dataset.cbForm === 'target') {
          await setClubTarget(Number(f.h.value));
          toast(t('club.targetSet'), { icon: svg('target') });
        } else if (f.dataset.cbForm === 'invite') {
          await inviteToClub(f.u.value);
          toast(esc(t('club.invited', { name: f.u.value.replace(/^@/, '') })), { icon: svg('friend') });
          f.reset();
        }
      } catch (err) { toast(esc(clubError(err)), { icon: svg('warn') }); }
    });
  };
  refreshClub();
  return root;
}
