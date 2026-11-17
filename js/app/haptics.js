// haptics.js — named vibration patterns, so a buzz means the same thing
// everywhere. Wraps the Vibration API and degrades silently.
//
// iOS Safari (and every iOS browser, and installed iOS web apps) does not
// implement navigator.vibrate. Since iOS 18, though, flipping a native switch
// (<input type="checkbox" switch>) gives the system's own light tap, so on an
// iPhone every pattern is that one tap, from a hidden switch. Older iOS: no buzz,
// the sound and the visual cue carry the moment.

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

const ios = () => typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let iosSwitch = null;
function iosTap() {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const box = document.createElement('input');
    box.type = 'checkbox'; box.setAttribute('switch', ''); box.tabIndex = -1;
    iosSwitch.append(box);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
  return true;
}

/** Buzz a named pattern if the device can. Returns whether it tried. */
export function haptic(name) {
  try {
    if (off()) return false;
    if (typeof navigator.vibrate === 'function') return navigator.vibrate(PATTERNS[name] || PATTERNS.tick);
    return ios() ? iosTap() : false;
  } catch { return false; }
}

export const hapticsSupported = () => typeof navigator !== 'undefined' && (typeof navigator.vibrate === 'function' || ios());
