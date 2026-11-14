// Prints the discipline ladders from js/core/training.js as Markdown tables, for
// docs/TRAINING.md: node tools/training-table.mjs

import { TRAINING, DISCIPLINES, OPEN_LEVELS, levelTarget, drillMinutes, rawBurn, realSessionXp, settleDrill, planDrill, successChance, maxStamina } from '../js/core/training.js';

const newcomer = { sportLevel: 1, machineTier: 1, gearBp: 0, classId: null, cleared: false };
const stamina = maxStamina({ rank: 21, cleared: 10 });
const min = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)} min`);

for (const d of Object.values(DISCIPLINES)) {
  console.log(`\n**${d.id}** (${d.machine})\n`);
  console.log('| Level | Target | On the clock | Burn, no buffs | Real XP | Drill XP | XP per stamina | Coins |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (let l = 1; l <= OPEN_LEVELS; l++) {
    const r = settleDrill(d, l, newcomer, 1e6, 0.5);
    console.log(`| ${l} | ${levelTarget(d, l)} ${d.unit} | ${min(drillMinutes(d, l))} | ${(rawBurn(d, l) + TRAINING.entryBurn).toFixed(0)} | ${realSessionXp(d, l).toFixed(0)} | ${r.xp} | ${(r.xp / (rawBurn(d, l) + TRAINING.entryBurn)).toFixed(2)} | ${r.coins} |`);
  }
}

console.log(`\n**Level 8 by build**, with a gauge of ${stamina}\n`);
console.log('| Build | run | bike | swim | lift |');
console.log('| --- | --- | --- | --- | --- |');
const base = { sportLevel: 8, machineTier: 3, gearBp: 1600, cleared: false };
const rows = [
  ['Pacer, full build', { ...base, classId: 'pacer' }],
  ['Triathlete, full build', { ...base, classId: 'triathlete' }],
  ['Functional, full build', { ...base, classId: 'functional' }],
  ['Titan, full build', { ...base, classId: 'titan' }],
  ['Triathlete, tier 4 machine', { ...base, classId: 'triathlete', machineTier: 4 }],
  ['Pacer, no gear', { ...base, classId: 'pacer', gearBp: 0 }],
  ['Pacer, tier 1 machine', { ...base, classId: 'pacer', machineTier: 1 }],
  ['Pacer, sport level 3', { ...base, classId: 'pacer', sportLevel: 3 }],
];
for (const [name, a] of rows) {
  const cells = Object.values(DISCIPLINES).map((d) => {
    const p = planDrill(d, 8, a);
    return `${p.burn.toFixed(0)} (${Math.round(successChance(p, stamina) * 100)}%)`;
  });
  console.log(`| ${name} | ${cells.join(' | ')} |`);
}
