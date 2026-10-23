// challenges-view.js — challenges on screen (docs/CHALLENGES.md):
//   - the card (in the general room, and in the list), drawn from the
//     challenge's live state so it updates in place;
//   - the list of challenges, the new-challenge form (suggestions first,
//     then custom), and one challenge with its live standings, the join sheet
//     and the result.
// Every layer is instant (no slide), like the shop. The server decides
// everything that pays; this file only shows it and asks.

import { openLayer, closeLayer } from './nav.js';
import { sheetHead } from './sheet.js';
import { esc, dialogue } from './ui.js';
import { busy } from './motion.js';
import { toast, playAccept } from './effects.js';
import { haptic } from './haptics.js';
import { svg } from '../core/icons.js';
import { t, fmtNum, fmtDate } from '../core/i18n.js';
import { addDays, todayISO } from '../core/dates.js';
import {
  CHALLENGE_RULES, KINDS, TEMPLATES, LOWER_WINS, phaseOf, settlesOn, checkChallenge, stakeBlock, segmentIdFrom, ruleText,
} from '../core/challenges.js';
import { featById } from '../core/feats.js';
import { earnsXp, hasStravaProof } from '../core/xp-rules.js';
import {
  challengesEnabled, challengesState, challengeById, peopleOf, resultOf, standingsOf, myStatus, me, onChallenges,
  refreshChallenges, refreshStandings, createChallenge, joinChallenge, declineChallenge, cancelChallenge, challengeError,
} from './challenges-state.js';
import { walletNow } from './gear-state.js';
import { accepted } from './social.js';
import { currentUser } from './auth.js';
import * as store from './store.js';

const KIND_ICON = { distance: 'route', xp: 'xp', sessions: 'calendar', fastest: 'bolt', longest: 'clock', climb: 'flag', segment: 'target' };
const fmtDay = (iso) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
const coin = (n) => `<span class="cur-amt is-coins">${svg('coin', 'cur-ico')}<b class="data-num">${fmtNum(n)}</b></span>`;
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

const clock = (sec) => {
  const s = Math.round(Number(sec) || 0);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/** A score in its kind's unit: "142.3 km", "1,240 m", "312 XP", "5 days", "19:52", "2:45:00". */
export function scoreText(kind, score) {
  if (score == null) return t('chx.noShow');
  switch (kind) {
    case 'distance': return t('feat.ui.km', { n: fmtNum(score / 100, { maximumFractionDigits: 2 }) });
    case 'climb': return t('feat.ui.m', { n: fmtNum(score) });
    case 'xp': return t('chx.xp', { n: fmtNum(score) });
    case 'sessions': return t('chx.days', { n: fmtNum(score) });
    default: return clock(score);
  }
}

// ---- the card (room and list) --------------------------------------------------------

/** The card for a challenge, live: rule, window, stake and pot, who's in, and what you can do. */
export function challengeCard(c, { compact = false } = {}) {
  if (!c) return `<div class="chc is-missing">${svg('flag')} ${t('chx.gone')}</div>`;
  const today = todayISO();
  const phase = phaseOf(c, today);
  const people = peopleOf(c.id).filter((p) => p.status === 'joined');
  const pot = people.reduce((n, p) => n + (Number(p.stake) || 0), 0);
  const mine = myStatus(c.id);
  const res = resultOf(c.id);
  const myRow = res?.rows?.find((r) => r.user === me());
  let act;
  if (phase === 'open' && mine === 'joined') act = `<span class="chc-state is-in">${svg('check')} ${t('chx.youreIn')}</span>`;
  else if (phase === 'open' && people.length >= CHALLENGE_RULES.maxParticipants) act = `<span class="chc-state">${t('chx.full')}</span>`;
  // the whole card is the button, so its call to action is a look, not a second control inside it
  else if (phase === 'open') act = `<span class="btn tiny primary chc-cta">${c.stake ? t('chx.joinFor', { n: fmtNum(c.stake) }) : t('chx.joinFree')}</span>`;
  else if (phase === 'settled' && myRow) act = `<span class="chc-state ${myRow.payout ? 'is-won' : ''}">${myRow.payout ? t('chx.wonCoins', { n: fmtNum(myRow.payout) }) : t('chx.settled')}</span>`;
  else act = `<span class="chc-state">${t(`chx.phase.${phase}`)}</span>`;
  const faces = people.slice(0, 5).map((p) => `<i class="chc-face" title="${esc(p.display_name || '')}">${esc((p.display_name || '?').charAt(0).toUpperCase())}</i>`).join('');
  return `<article class="chc phase-${phase}${compact ? ' is-compact' : ''}" data-ch-open="${esc(c.id)}" role="button" tabindex="0"
      aria-label="${esc(t('chx.cardAria', { rule: ruleText(c, fmtDay) }))}">
    <header class="chc-head"><span class="chc-ico" aria-hidden="true">${svg(KIND_ICON[c.kind] || 'flag')}</span>
      <b class="chc-kind">${t(`chx.kind.${c.kind}`)}</b><span class="chc-phase">${t(`chx.phase.${phase}`)}</span></header>
    <p class="chc-rule">${esc(ruleText(c, fmtDay))}</p>
    <div class="chc-meta">
      ${c.stake ? `<span>${t('chx.stake')} ${coin(c.stake)}</span><span>${t('chx.pot')} ${coin(pot)}</span>` : `<span class="chc-free">${t('chx.free')}</span>`}
      <span class="chc-faces" aria-label="${esc(t('chx.inN', { n: people.length, max: CHALLENGE_RULES.maxParticipants }))}">${faces}<small>${people.length}/${CHALLENGE_RULES.maxParticipants}</small></span>
    </div>
    <div class="chc-foot">${act}</div>
  </article>`;
}

/** A trophy someone won inside a challenge, as a room card. */
export function trophyCard(featId, who) {
  const f = featById(featId);
  if (!f) return '';
  return `<div class="chc-trophy">${svg(f.tier >= 3 ? 'trophy' : 'medal')}<span><b>${esc(t('chx.trophyBy', { name: who }))}</b><br>${esc(f.name)} · ${esc(f.blurb)}</span></div>`;
}

/** One toast line for a challenge you were in that just settled (or was voided or cancelled). */
export function settleText({ challenge, result, row }) {
  const what = esc(challenge ? t(`chx.kind.${challenge.kind}`) : t('chx.title'));
  if (result.outcome === 'cancelled') return `<b>${what}</b><br>${t('chx.toast.cancelled')}`;
  if (result.outcome === 'void') return `<b>${what}</b><br>${t('chx.toast.void')}`;
  if (!row || row.place == null) return `<b>${what}</b><br>${t('chx.toast.noShow')}`;
  const of = result.rows?.length || 0;
  return row.payout
    ? `<b>${what}</b><br>${t('chx.toast.won', { place: fmtNum(row.place), of: fmtNum(of), n: fmtNum(row.payout) })}`
    : `<b>${what}</b><br>${t('chx.toast.placed', { place: fmtNum(row.place), of: fmtNum(of) })}`;
}

// ---- the list --------------------------------------------------------------------------

export function openChallenges() {
  let off = null;
  const root = openLayer('challenges', { className: 'gear-layer', instant: true, onClose: () => off?.() });
  const draw = () => {
    const st = challengesState();
    const today = todayISO();
    let body;
    if (!challengesEnabled()) {
      body = dialogue({ who: t('chx.title'), icon: 'flag', text: t('chx.signIn'), cls: 'empty-dlg' });
    } else if (!st.ready) {
      body = `<p class="gw-note">${t('chx.loading')}</p>`;
    } else {
      const invites = st.list.filter((c) => myStatus(c.id) === 'invited' && phaseOf(c, today) === 'open');
      const live = st.list.filter((c) => ['open', 'running', 'resolving'].includes(phaseOf(c, today)) && !invites.includes(c));
      const done = st.list.filter((c) => ['settled', 'cancelled'].includes(phaseOf(c, today))).reverse();
      const sec = (key, list) => (list.length ? `<section class="gw-row"><h3 class="gw-row-h">${t(`chx.sec.${key}`)}</h3>
        <div class="chc-list">${list.map((c) => challengeCard(c)).join('')}</div></section>` : '');
      body = sec('invites', invites) + sec('live', live) + sec('done', done)
        || `<p class="gw-note">${t('chx.none')}</p>`;
    }
    root.innerHTML = `<div class="fh-screen gw-screen ch-screen" role="dialog" aria-modal="true" aria-labelledby="chx-title">
      ${sheetHead({ lead: 'back', icon: 'flag', title: t('chx.title'), id: 'chx-title', action: '' })}
      ${challengesEnabled() ? `<div class="ch-new-row"><button class="btn primary" data-ch-new>${svg('plus')} ${t('chx.new')}</button></div>` : ''}
      ${body}
      <p class="gw-note gw-honest">${svg('check')} ${t('chx.honest')}</p>
    </div>`;
  };
  off = onChallenges(() => { if (root.isConnected) draw(); });
  root.onclick = (e) => {
    if (e.target.closest('[data-ch-new]')) { openNewChallenge(); return; }
    const o = e.target.closest('[data-ch-open]');
    if (o) openChallenge(o.dataset.chOpen);
  };
  root.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.chc[data-ch-open]')) { e.preventDefault(); openChallenge(e.target.dataset.chOpen); } };
  draw();
  refreshChallenges();
  return root;
}

// ---- one challenge ------------------------------------------------------------------------

export function openChallenge(id) {
  let off = null;
  const root = openLayer('challenge', { className: 'gear-layer', instant: true, reuse: false, onClose: () => off?.() });
  const draw = () => {
    const c = challengeById(id);
    if (!c) {
      root.innerHTML = `<div class="fh-screen gw-screen" role="dialog" aria-modal="true" aria-labelledby="cho-t">${sheetHead({ lead: 'back', icon: 'flag', title: t('chx.title'), id: 'cho-t', action: '' })}<p class="gw-note">${t('chx.gone')}</p></div>`;
      return;
    }
    const today = todayISO();
    const phase = phaseOf(c, today);
    const mine = myStatus(id);
    const people = peopleOf(id).filter((p) => p.status === 'joined');
    const pot = people.reduce((n, p) => n + (Number(p.stake) || 0), 0);
    const res = resultOf(id);
    const lower = LOWER_WINS.has(c.kind);
    let board = '';
    if (res && res.outcome !== 'cancelled') {
      const name = (u) => peopleOf(id).find((p) => p.user_id === u)?.display_name || t('chx.athlete');
      board = `<section class="gw-row ch-result" aria-labelledby="chr-h"><h3 id="chr-h" class="gw-row-h">${svg('trophy')} ${t(res.outcome === 'void' ? 'chx.void' : 'chx.result')}</h3>
        <ol class="ch-board">${res.rows.map((r) => `<li class="${r.user === me() ? 'is-me' : ''}"><b class="ch-place">${r.place ?? '–'}</b>
          <span class="ch-name">${esc(name(r.user))}</span><span class="ch-score data-num">${esc(scoreText(c.kind, r.score))}</span>
          <span class="ch-pay">${r.payout ? coin(r.payout) : ''}</span></li>`).join('')}</ol>
        ${res.pot ? `<p class="gw-note">${t('chx.potLine', { pot: fmtNum(res.pot), fee: fmtNum(res.fee), prize: fmtNum(res.prize), burned: fmtNum(res.burned) })}</p>` : ''}</section>`;
    } else if (res?.outcome === 'cancelled') {
      board = `<p class="gw-note">${t(res.rule?.reason === 'too_few' ? 'chx.cancelledFew' : 'chx.cancelled')}</p>`;
    } else if (phase !== 'open') {
      const s = standingsOf(id);
      board = `<section class="gw-row" aria-labelledby="chs-h"><h3 id="chs-h" class="gw-row-h">${svg('route')} ${t('chx.standings')}</h3>
        ${s ? `<ol class="ch-board">${s.map((r) => `<li class="${r.user_id === me() ? 'is-me' : ''}"><b class="ch-place">${r.place ?? '–'}</b>
          <span class="ch-name">${esc(r.display_name)}</span><span class="ch-score data-num">${esc(scoreText(c.kind, r.score))}${r.cut ? ` <small class="ch-cut">${t('chx.cut')}</small>` : ''}</span></li>`).join('')}</ol>`
          : `<p class="gw-note">${t('chx.loading')}</p>`}
        <p class="gw-note">${t(lower ? 'chx.lowerWins' : 'chx.higherWins')} · ${t(phase === 'resolving' ? 'chx.settlesOn' : 'chx.endsOn', { date: esc(fmtDay(phase === 'resolving' ? settlesOn(c) : c.ends_on)) })}</p></section>`;
    }
    let acts = '';
    if (phase === 'open') {
      if (mine === 'joined' && c.creator === me()) acts = `<button class="btn ghost danger" data-ch-cancel>${t('chx.cancel')}</button>`;
      else if (mine === 'joined') acts = `<button class="btn ghost" data-ch-leave>${t(c.stake ? 'chx.leaveRefund' : 'chx.leave')}</button>`;
      else if (people.length < CHALLENGE_RULES.maxParticipants) {
        acts = `<button class="btn primary" data-ch-join>${c.stake ? t('chx.joinFor', { n: fmtNum(c.stake) }) : t('chx.joinFree')}</button>
          ${mine === 'invited' ? `<button class="btn ghost" data-ch-decline>${t('chx.decline')}</button>` : ''}`;
      }
    }
    root.innerHTML = `<div class="fh-screen gw-screen cho-screen" role="dialog" aria-modal="true" aria-labelledby="cho-title">
      ${sheetHead({ lead: 'back', icon: KIND_ICON[c.kind] || 'flag', title: t(`chx.kind.${c.kind}`), id: 'cho-title', action: '' })}
      <section class="cho-rule">
        <p class="chc-rule">${esc(ruleText(c, fmtDay))}</p>
        <dl class="cho-facts">
          <div><dt>${t('chx.when')}</dt><dd>${esc(fmtDay(c.starts_on))} – ${esc(fmtDay(c.ends_on))}</dd></div>
          <div><dt>${t('chx.stake')}</dt><dd>${c.stake ? coin(c.stake) : t('chx.free')}</dd></div>
          <div><dt>${t('chx.pot')}</dt><dd>${coin(pot)}</dd></div>
          <div><dt>${t('chx.whoIn')}</dt><dd>${esc(people.map((p) => p.display_name).join(', ') || '–')}</dd></div>
        </dl>
      </section>
      ${board}
      ${acts ? `<div class="cho-acts">${acts}</div>` : ''}
      <details class="cho-rules"><summary>${t('chx.howItWorks')}</summary>
        <ul>${['strava', 'noShow', 'ties', 'fee', 'cap', 'refuse'].map((k) => `<li>${t(`chx.term.${k}`, { fee: CHALLENGE_RULES.feeBp / 100 })}</li>`).join('')}</ul></details>
    </div>`;
  };
  off = onChallenges(() => { if (root.isConnected) draw(); });
  root.onclick = async (e) => {
    const c = challengeById(id);
    if (e.target.closest('[data-ch-join]')) { openJoinSheet(c); return; }
    const leave = e.target.closest('[data-ch-leave], [data-ch-decline]');
    if (leave) {
      await busy(leave, async () => { try { await declineChallenge(id); toast(t('chx.left'), { icon: svg('check') }); } catch (err) { toast(esc(challengeError(err)), { icon: svg('warn') }); } });
      return;
    }
    const cancel = e.target.closest('[data-ch-cancel]');
    if (cancel && confirm(t('chx.cancelConfirm'))) {
      await busy(cancel, async () => { try { await cancelChallenge(id); toast(t('chx.cancelledToast'), { icon: svg('check') }); } catch (err) { toast(esc(challengeError(err)), { icon: svg('warn') }); } });
    }
  };
  draw();
  const c = challengeById(id);
  if (c && phaseOf(c, todayISO()) !== 'open') refreshStandings(id).then(() => { if (root.isConnected) draw(); });
  return root;
}

// what the client can tell about staking before asking the server (it re-checks)
function myStakeFacts() {
  const u = currentUser();
  const created = Date.parse(u?.created_at || '');
  const accountDays = Number.isFinite(created) ? Math.floor((Date.now() - created) / 864e5) : 999;
  const from = addDays(todayISO(), -30);
  const verified30 = store.getWorkouts().filter((w) => w.date >= from && earnsXp(w) && hasStravaProof(w)).length;
  const balance = walletNow(store.getWorkouts()).coins;
  return { accountDays, verified30, balance, stakedWeek: 0, pairs: new Map() };
}

/** The join sheet: the rule and the terms in plain words, and a second confirmation before any stake. */
function openJoinSheet(c) {
  if (!c) return;
  const root = openLayer('challenge-join', { instant: true, reuse: false });
  const block = c.stake ? stakeBlock(c.stake, myStakeFacts()) : null;
  root.innerHTML = `<div class="modal-backdrop" data-layer-close></div>
    <div class="modal ch-join" role="dialog" aria-modal="true" aria-labelledby="chj-title">
      <h2 id="chj-title" class="ch-join-h">${svg('flag')} ${t('chx.joinTitle')}</h2>
      <p class="chc-rule">${esc(ruleText(c, fmtDay))}</p>
      <ul class="ch-terms">${['strava', 'noShow', 'ties', ...(c.stake ? ['fee', 'cap'] : [])].map((k) => `<li>${t(`chx.term.${k}`, { fee: CHALLENGE_RULES.feeBp / 100 })}</li>`).join('')}</ul>
      ${block ? `<p class="ch-block" role="alert">${svg('warn')} ${t(`chx.err.${block}`)}</p>` : ''}
      ${c.stake && !block ? `<label class="toggle ch-sure"><span>${t('chx.sure', { n: fmtNum(c.stake) })}</span><input type="checkbox" data-ch-sure></label>` : ''}
      <div class="row ch-join-acts">
        <button class="btn ghost" data-layer-close>${t('chx.notNow')}</button>
        <button class="btn primary" data-ch-confirm ${block || c.stake ? 'disabled' : ''} ${online() ? '' : 'disabled'}>${c.stake ? t('chx.stakeN', { n: fmtNum(c.stake) }) : t('chx.joinFree')}</button>
      </div>
    </div>`;
  root.onchange = (e) => {
    if (e.target.matches('[data-ch-sure]')) root.querySelector('[data-ch-confirm]').disabled = !e.target.checked || !!block || !online();
  };
  root.onclick = async (e) => {
    const b = e.target.closest('[data-ch-confirm]');
    if (!b || b.disabled) return;
    await busy(b, async () => {
      try {
        await joinChallenge(c.id);
        playAccept(); haptic('record');
        toast(`<b>${t('chx.joined')}</b>`, { icon: svg('flag') });
        closeLayer(root);
      } catch (err) { toast(esc(challengeError(err)), { icon: svg('warn') }); }
    });
  };
}

// ---- a new challenge ------------------------------------------------------------------------

/** Suggestions first (one tap fills the form), then the whole form, with the rule read back live. */
export function openNewChallenge() {
  const root = openLayer('challenge-new', { className: 'gear-layer', instant: true, reuse: false });
  const today = todayISO();
  const nextDow = (dow) => { let d = addDays(today, 1); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== dow % 7) d = addDays(d, 1); return d; };
  let f = { kind: 'distance', sport: 'run', dist: '5k', targetMin: 120, segment: '', segmentName: '', starts_on: addDays(today, 1), days: 7, stake: 0, payout: 'winner', visibility: 'room', invitees: [] };

  const toChallenge = () => ({
    kind: f.kind, sport: f.sport, starts_on: f.starts_on, ends_on: addDays(f.starts_on, Math.max(1, Number(f.days) || 1) - 1),
    stake: Math.max(0, Math.round(Number(f.stake) || 0)), payout: f.payout, visibility: f.visibility, invitees: f.invitees,
    params: f.kind === 'fastest' ? { dist: f.dist } : f.kind === 'longest' ? { targetMin: Math.round(Number(f.targetMin) || 0) }
      : f.kind === 'segment' ? { segmentId: segmentIdFrom(f.segment), ...(f.segmentName.trim() ? { segmentName: f.segmentName.trim().slice(0, 60) } : {}) } : {},
  });

  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
  const draw = () => {
    if (!KINDS[f.kind].includes(f.sport)) f.sport = KINDS[f.kind][0];
    const dists = Object.keys(CHALLENGE_RULES.fastest[f.sport] || {});
    if (f.kind === 'fastest' && !dists.includes(f.dist)) f.dist = dists[0];
    const c = toChallenge();
    const why = checkChallenge(c, today);
    const friends = accepted();
    const block = c.stake ? stakeBlock(c.stake, myStakeFacts()) : null;
    const top = root.querySelector('.fh-screen')?.scrollTop || 0;
    // the form is redrawn on every change: keep keyboard focus where it was
    const had = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = had?.name ? `[name="${had.name}"]${had.name === 'inv' ? `[value="${had.value}"]` : ''}` : null;
    root.innerHTML = `<div class="fh-screen gw-screen chn-screen" role="dialog" aria-modal="true" aria-labelledby="chn-title">
      ${sheetHead({ lead: 'back', icon: 'plus', title: t('chx.new'), id: 'chn-title', action: '' })}
      <section class="gw-row" aria-labelledby="chn-sug"><h3 id="chn-sug" class="gw-row-h">${t('chx.suggestions')}</h3>
        <div class="chn-sugs">${TEMPLATES.map((tp) => `<button class="chn-sug" data-ch-tpl="${tp.id}">${svg(KIND_ICON[tp.kind])}<b>${t(`chx.tpl.${tp.id}`)}</b></button>`).join('')}</div></section>
      <form class="chn-form" data-ch-form>
        <h3 class="gw-row-h">${t('chx.custom')}</h3>
        <div class="chn-grid">
          <label class="field"><span>${t('chx.f.kind')}</span><select name="kind">${Object.keys(KINDS).map((k) => opt(k, t(`chx.kind.${k}`), f.kind)).join('')}</select></label>
          <label class="field"><span>${t('chx.f.sport')}</span><select name="sport">${KINDS[f.kind].map((s) => opt(s, t(`chx.sport.${s}`), f.sport)).join('')}</select></label>
          ${f.kind === 'fastest' ? `<label class="field"><span>${t('chx.f.dist')}</span><select name="dist">${dists.map((d) => opt(d, t(`ch.dist.${d}`), f.dist)).join('')}</select></label>` : ''}
          ${f.kind === 'longest' ? `<label class="field"><span>${t('chx.f.target', { max: CHALLENGE_RULES.longestMaxMin[f.sport] })}</span><input type="number" name="targetMin" min="10" max="${CHALLENGE_RULES.longestMaxMin[f.sport]}" step="5" value="${esc(f.targetMin)}"></label>` : ''}
          ${f.kind === 'segment' ? `<label class="field chn-wide"><span>${t('chx.f.segment')}</span><input name="segment" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${esc(t('chx.f.segmentPh'))}" value="${esc(f.segment)}"></label>
            <label class="field chn-wide"><span>${t('chx.f.segmentName')}</span><input name="segmentName" maxlength="60" autocomplete="off" value="${esc(f.segmentName)}"></label>` : ''}
          <label class="field"><span>${t('chx.f.start')}</span><input type="date" name="starts_on" min="${addDays(today, 1)}" max="${addDays(today, CHALLENGE_RULES.maxStartAheadDays)}" value="${esc(f.starts_on)}"></label>
          <label class="field"><span>${t('chx.f.days')}</span><input type="number" name="days" min="1" max="${CHALLENGE_RULES.maxWindowDays}" value="${esc(f.days)}"></label>
          <label class="field"><span>${t('chx.f.stake', { max: CHALLENGE_RULES.maxStake })}</span><input type="number" name="stake" min="0" max="${CHALLENGE_RULES.maxStake}" step="10" value="${esc(f.stake)}"></label>
          <label class="field"><span>${t('chx.f.payout')}</span><select name="payout">${Object.keys(CHALLENGE_RULES.payouts).map((p) => opt(p, t(`chx.payout.${p}`), f.payout)).join('')}</select></label>
          <label class="field chn-wide"><span>${t('chx.f.who')}</span><select name="visibility">${opt('room', t('chx.who.room'), f.visibility)}${opt('direct', t('chx.who.direct'), f.visibility)}</select></label>
        </div>
        ${f.visibility === 'direct' ? `<fieldset class="chn-friends"><legend>${t('chx.f.friends', { n: CHALLENGE_RULES.maxParticipants - 1 })}</legend>
          ${friends.length ? friends.map((fr) => `<label class="toggle"><span>${esc(fr.display_name || fr.username || t('chx.athlete'))}</span>
            <input type="checkbox" name="inv" value="${esc(fr.user_id)}" ${f.invitees.includes(fr.user_id) ? 'checked' : ''}></label>`).join('')
            : `<p class="gw-note">${t('chx.noFriends')}</p>`}</fieldset>` : ''}
        <div class="chn-preview" aria-live="polite">
          <p class="chc-rule">${esc(ruleText(c, fmtDay))}</p>
          ${why ? `<p class="ch-block">${svg('warn')} ${t(`chx.err.${why}`)}</p>` : ''}
          ${block ? `<p class="ch-block">${svg('warn')} ${t(`chx.err.${block}`)}</p>` : ''}
          ${c.stake ? `<p class="gw-note">${t('chx.stakeNote', { n: fmtNum(c.stake), fee: CHALLENGE_RULES.feeBp / 100 })}</p>` : ''}
        </div>
        <button class="btn primary block" type="submit" ${why || block || !online() ? 'disabled' : ''}>${c.stake ? t('chx.postStake', { n: fmtNum(c.stake) }) : t('chx.post')}</button>
      </form>
    </div>`;
    if (top) root.querySelector('.fh-screen').scrollTop = top;
    if (focusKey) root.querySelector(focusKey)?.focus({ preventScroll: true });
  };

  root.onclick = (e) => {
    const tpl = e.target.closest('[data-ch-tpl]');
    if (!tpl) return;
    const tp = TEMPLATES.find((x) => x.id === tpl.dataset.chTpl);
    const starts = tp.startDow != null ? nextDow(tp.startDow) : addDays(today, 1);
    f = { ...f, kind: tp.kind, sport: tp.sport, starts_on: starts, days: tp.days, ...(tp.params.dist ? { dist: tp.params.dist } : {}), ...(tp.params.targetMin ? { targetMin: tp.params.targetMin } : {}) };
    draw();
    root.querySelector('[data-ch-form]')?.scrollIntoView({ block: 'start' });
  };
  root.onchange = (e) => {
    const el = e.target;
    if (!el.closest('[data-ch-form]')) return;
    if (el.name === 'inv') f.invitees = [...root.querySelectorAll('input[name="inv"]:checked')].map((x) => x.value).slice(0, CHALLENGE_RULES.maxParticipants - 1);
    else if (el.name) f[el.name] = el.value;
    draw();
  };
  root.onsubmit = async (e) => {
    if (!e.target.matches('[data-ch-form]')) return;
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    await busy(btn, async () => {
      try {
        await createChallenge(toChallenge());
        playAccept(); haptic('record');
        toast(`<b>${t(f.visibility === 'room' ? 'chx.posted' : 'chx.sent')}</b>`, { icon: svg('flag') });
        closeLayer(root);
      } catch (err) { toast(esc(challengeError(err)), { icon: svg('warn') }); }
    });
  };
  draw();
}
