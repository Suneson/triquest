// poses.js — original inline-SVG movement illustrations. No external images:
// these are hand-drawn line-art figures that theme with the app (stroke uses
// currentColor; equipment uses the .equip accent) and never break offline.
//
// poseKeyFor(name) maps a free-text exercise name to the closest pose.
// poseSvg(key) returns a full <svg> string. cuesFor(name) returns coaching cues.

// Inner SVG markup per pose. viewBox is 0 0 120 100 for all of them.
const P = {
  'back-squat': `
    <line class="equip" x1="28" y1="30" x2="92" y2="30"/>
    <rect class="equip fill" x="26" y="24" width="5" height="12" rx="1.5"/>
    <rect class="equip fill" x="89" y="24" width="5" height="12" rx="1.5"/>
    <circle cx="60" cy="24" r="7"/>
    <path d="M60 31 L62 52"/>
    <path d="M52 31 H68"/>
    <path d="M52 31 L48 30 M68 31 L72 30"/>
    <path d="M62 52 L50 64 L50 84 M62 52 L74 64 L74 84"/>
    <line x1="40" y1="88" x2="84" y2="88"/>`,
  'romanian-deadlift': `
    <line class="equip" x1="34" y1="70" x2="86" y2="70"/>
    <rect class="equip fill" x="32" y="64" width="5" height="12" rx="1.5"/>
    <rect class="equip fill" x="83" y="64" width="5" height="12" rx="1.5"/>
    <circle cx="44" cy="28" r="7"/>
    <path d="M49 31 L66 40"/>
    <path d="M66 40 L70 70 M60 40 L60 70"/>
    <path d="M66 40 L66 84 M66 62 L72 84"/>
    <line x1="40" y1="88" x2="84" y2="88"/>`,
  'trap-bar-deadlift': `
    <rect class="equip" x="44" y="60" width="32" height="8" rx="2"/>
    <line class="equip" x1="38" y1="64" x2="44" y2="64"/>
    <line class="equip" x1="76" y1="64" x2="82" y2="64"/>
    <circle cx="60" cy="26" r="7"/>
    <path d="M60 33 L58 52"/>
    <path d="M58 52 L48 60 M58 52 L72 60"/>
    <path d="M58 52 L50 68 L50 84 M58 52 L70 68 L70 84"/>
    <line x1="42" y1="88" x2="80" y2="88"/>`,
  'bulgarian-split-squat': `
    <rect class="equip fill" x="76" y="62" width="22" height="6" rx="2"/>
    <circle cx="44" cy="24" r="7"/>
    <path d="M44 31 L46 52"/>
    <path d="M46 52 L40 66 L40 84"/>
    <path d="M46 52 L62 60 L80 62"/>
    <path d="M40 36 L34 50 M46 36 L52 50"/>
    <line x1="30" y1="88" x2="74" y2="88"/>`,
  'step-up': `
    <rect class="equip fill" x="62" y="58" width="30" height="28" rx="2"/>
    <circle cx="44" cy="22" r="7"/>
    <path d="M44 29 L46 50"/>
    <path d="M46 50 L66 58"/>
    <path d="M46 50 L42 68 L42 84"/>
    <path d="M40 34 L34 48 M48 34 L54 46"/>
    <line x1="28" y1="88" x2="62" y2="88"/>`,
  'standing-calf-raise': `
    <circle cx="60" cy="26" r="7"/>
    <path d="M60 33 L60 60"/>
    <path d="M52 40 H68"/>
    <path d="M60 60 L54 76 M60 60 L66 76"/>
    <path d="M54 76 L52 82 L58 82 M66 76 L64 82 L70 82"/>
    <line class="equip" x1="44" y1="84" x2="76" y2="84"/>
    <path d="M50 84 L46 84 M70 84 L74 84" stroke-dasharray="2 3"/>`,
  'nordic-hamstring-curl': `
    <path class="equip" d="M40 80 q12 6 24 0" />
    <circle cx="84" cy="40" r="7"/>
    <path d="M80 45 L52 74"/>
    <path d="M52 74 L46 82"/>
    <path d="M78 44 L70 56 M82 46 L78 60"/>
    <line x1="36" y1="84" x2="92" y2="84"/>
    <path class="equip fill" d="M42 78 h8 v6 h-8 z"/>`,
  'copenhagen-plank': `
    <rect class="equip fill" x="74" y="44" width="24" height="6" rx="2"/>
    <circle cx="34" cy="58" r="7"/>
    <path d="M40 60 L86 47"/>
    <path d="M40 60 L42 80"/>
    <path d="M58 54 L60 40"/>
    <line x1="30" y1="84" x2="96" y2="84"/>`,
  'pull-up': `
    <line class="equip" x1="30" y1="20" x2="90" y2="20"/>
    <path d="M48 20 L50 34 M72 20 L70 34"/>
    <circle cx="60" cy="40" r="7"/>
    <path d="M60 47 L60 70"/>
    <path d="M60 70 L54 84 M60 70 L66 84"/>`,
  'db-bench-press': `
    <rect class="equip fill" x="34" y="60" width="52" height="6" rx="2"/>
    <rect class="equip fill" x="40" y="66" width="6" height="14"/>
    <rect class="equip fill" x="74" y="66" width="6" height="14"/>
    <circle cx="40" cy="52" r="7"/>
    <path d="M47 54 L78 56"/>
    <path d="M60 55 L62 34 M70 56 L72 34"/>
    <rect class="equip fill" x="58" y="28" width="8" height="6" rx="1.5"/>
    <rect class="equip fill" x="68" y="28" width="8" height="6" rx="1.5"/>
    <line x1="30" y1="84" x2="90" y2="84"/>`,
  'seated-row': `
    <rect class="equip fill" x="30" y="66" width="22" height="6" rx="2"/>
    <circle cx="44" cy="42" r="7"/>
    <path d="M44 49 L44 66"/>
    <path d="M44 52 L66 54"/>
    <path d="M44 66 L62 70 L78 70"/>
    <line class="equip" x1="78" y1="54" x2="78" y2="84"/>
    <path class="equip" d="M66 54 H78"/>
    <line x1="28" y1="84" x2="92" y2="84"/>`,
  'shoulder-press': `
    <circle cx="60" cy="50" r="7"/>
    <path d="M60 57 L60 78"/>
    <path d="M52 60 L48 40 M68 60 L72 40"/>
    <rect class="equip fill" x="42" y="34" width="12" height="6" rx="1.5"/>
    <rect class="equip fill" x="66" y="34" width="12" height="6" rx="1.5"/>
    <path d="M60 78 L54 88 M60 78 L66 88"/>`,
  'face-pull': `
    <circle cx="44" cy="42" r="7"/>
    <path d="M44 49 L44 72"/>
    <path d="M44 52 L62 46 M44 54 L62 50"/>
    <path d="M44 72 L38 86 M44 72 L50 86"/>
    <line class="equip" x1="62" y1="40" x2="62" y2="84"/>
    <path class="equip" d="M62 48 L52 48" stroke-dasharray="3 3"/>`,
  run: `
    <circle cx="58" cy="24" r="7"/>
    <path d="M58 31 L54 52"/>
    <path d="M54 52 L66 64 L62 82 M54 52 L42 62 L36 76"/>
    <path d="M56 36 L42 40 M56 38 L72 34"/>`,
  bike: `
    <circle cx="38" cy="74" r="14"/>
    <circle cx="86" cy="74" r="14"/>
    <path class="equip" d="M38 74 L60 74 L76 50 L86 74 M60 74 L70 50 H80"/>
    <circle cx="68" cy="34" r="6"/>
    <path d="M68 40 L60 56"/>
    <path d="M64 44 L78 50 M64 44 L52 46"/>`,
  swim: `
    <path class="equip" d="M16 60 q12 8 24 0 t24 0 t24 0 t16 0" opacity="0.6"/>
    <circle cx="48" cy="50" r="7"/>
    <path d="M54 52 L86 58"/>
    <path d="M86 58 L96 50"/>
    <path d="M54 52 L40 46"/>
    <path d="M70 55 L66 66 M82 57 L88 66"/>`,
  mobility: `
    <circle cx="40" cy="34" r="7"/>
    <path d="M40 41 L46 60 L40 80"/>
    <path d="M46 60 L78 64"/>
    <path d="M40 80 L70 80"/>
    <path d="M44 46 L66 56"/>`,
  fallback: `
    <line class="equip" x1="30" y1="50" x2="90" y2="50"/>
    <rect class="equip fill" x="26" y="42" width="6" height="16" rx="1.5"/>
    <rect class="equip fill" x="88" y="42" width="6" height="16" rx="1.5"/>
    <rect class="equip fill" x="34" y="44" width="5" height="12" rx="1.5"/>
    <rect class="equip fill" x="81" y="44" width="5" height="12" rx="1.5"/>`,
};

// Name (lowercased substring) -> pose key. First match wins, so order matters.
const NAME_MAP = [
  [/bulgarian|split squat/, 'bulgarian-split-squat'],
  [/back squat|front squat|\bsquat\b/, 'back-squat'],
  [/romanian|rdl|stiff[- ]?leg/, 'romanian-deadlift'],
  [/trap[- ]?bar|hex bar|deadlift/, 'trap-bar-deadlift'],
  [/step[- ]?up/, 'step-up'],
  [/calf/, 'standing-calf-raise'],
  [/nordic/, 'nordic-hamstring-curl'],
  [/copenhagen|side plank/, 'copenhagen-plank'],
  [/pull[- ]?up|chin[- ]?up/, 'pull-up'],
  [/bench|push[- ]?up/, 'db-bench-press'],
  [/\brow\b|pulldown|pull[- ]?down/, 'seated-row'],
  [/shoulder press|overhead press|\bohp\b|military/, 'shoulder-press'],
  [/face pull|pallof|band pull/, 'face-pull'],
  [/run|jog|stride|tempo/, 'run'],
  [/bike|cycl|spin|ride/, 'bike'],
  [/swim/, 'swim'],
  [/mobility|stretch|yoga|plank|core|balance/, 'mobility'],
];

export function poseKeyFor(name = '') {
  const n = String(name).toLowerCase();
  for (const [re, key] of NAME_MAP) if (re.test(n)) return key;
  return 'fallback';
}

export function poseSvg(key) {
  const inner = P[key] || P.fallback;
  return `<svg viewBox="0 0 120 100" class="pose" role="img" aria-hidden="true" focusable="false">` +
    `<g fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}

export function poseSvgFor(name) {
  return poseSvg(poseKeyFor(name));
}

// Coaching cues per pose key — 2–3 short, actionable points.
const CUES = {
  'back-squat': ['Brace your core before you descend', 'Knees track over toes, sit between the hips', 'Drive the floor away — full depth'],
  'romanian-deadlift': ['Hinge at the hips, soft knees', 'Bar stays close, shins vertical', 'Feel the hamstring stretch, flat back'],
  'trap-bar-deadlift': ['Chest up, push the floor away', 'Neutral spine, lats engaged', 'Stand tall, squeeze glutes at the top'],
  'bulgarian-split-squat': ['Most weight through the front heel', 'Drop straight down, torso tall', 'Control the rear knee toward the floor'],
  'step-up': ['Drive through the top foot', 'Don’t push off the trailing leg', 'Control the descent — no bouncing'],
  'standing-calf-raise': ['Full range — heels low to high', 'Pause at the top, squeeze', 'Slow on the way down'],
  'nordic-hamstring-curl': ['Anchor the ankles firmly', 'Lower as slowly as you can', 'Keep hips extended, hinge from the knees'],
  'copenhagen-plank': ['Stack shoulder over elbow', 'Squeeze the top adductor', 'Keep a straight line head-to-hip'],
  'pull-up': ['Start from a dead hang', 'Pull elbows down and back', 'Chin over the bar, control the lower'],
  'db-bench-press': ['Shoulder blades pinned to the bench', 'Lower to mid-chest', 'Press up and slightly together'],
  'seated-row': ['Tall chest, pull to the navel', 'Squeeze shoulder blades together', 'Don’t lean back — stay over the hips'],
  'shoulder-press': ['Brace, don’t arch the lower back', 'Press to a locked-out finish', 'Bar/dumbbells over the mid-foot'],
  'face-pull': ['Pull to eye level, elbows high', 'Externally rotate at the end', 'Light weight, slow tempo'],
  run: ['Tall posture, relaxed shoulders', 'Quick light cadence (~180 spm)', 'Land under your hips'],
  bike: ['Smooth, round pedal stroke', 'Relaxed grip and shoulders', 'Hold target RPE / HR'],
  swim: ['Long reach, high elbow catch', 'Rotate from the hips', 'Exhale steadily underwater'],
  mobility: ['Move slow and controlled', 'Breathe into each position', 'Never force a stretch'],
  fallback: ['Control the eccentric', 'Full range of motion', 'Log weight + RPE'],
};

export function cuesFor(name) {
  return CUES[poseKeyFor(name)] || CUES.fallback;
}

export const ALL_POSE_KEYS = Object.keys(P);
