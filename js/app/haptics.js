// haptics.js — named vibration patterns, so a buzz means the same thing
// everywhere. Wraps the Vibration API and degrades silently.
//
// iOS Safari (and every iOS browser, and installed iOS web apps) does not
// implement navigator.vibrate, so for now this is Android-only. On iPhone the
// sound and the visual cue carry the moment instead.

const PATTERNS = {
  tick: [12],                 // a set ticked
  restOver: [120, 80, 120],   // the rest timer hit zero
  record: [30, 40, 30, 40, 90], // a personal record
  levelUp: [60, 50, 60, 50, 160], // a level up
  request: [60, 40, 60],      // a friend request or notification arrived
  message: [40],              // a new message
  select: [10],               // an item picked up in the compound
  place: [18, 30, 36],        // an item set down on a free tile
  refuse: [40, 40, 40],       // an item dropped where it can't stand
};

const off = () => { try { return localStorage.getItem('moske-haptics') === 'off'; } catch { return false; } };

/** Buzz a named pattern if the device can. Returns whether it tried. */
export function haptic(name) {
  try {
    if (off() || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(PATTERNS[name] || PATTERNS.tick);
  } catch { return false; }
}

export const hapticsSupported = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
