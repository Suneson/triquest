// slice-gear-art.mjs — cut 3×3 gear sheets into one picture per item, exactly
// the way the exercise sheets are cut (it runs tools/slice-exercise-art.mjs
// with the gear defaults): crop each cell, drop the printed label, quantise,
// scale nearest-neighbour to 256×256.
//
//   node tools/slice-gear-art.mjs                                  every sheet in docs/gear/sheets.json
//   node tools/slice-gear-art.mjs <sheet> 3x3 bike-wheels-t1,…    one sheet, ids in reading order ("-" skips a cell)
//
// Output: icons/Pixelart/GEAR/<item-id>.png (gear tiers are <sport>-<slot>-t<tier>),
// and a contact sheet at docs/gear/art-check.png. The exact file name for every
// cell is listed in docs/gear/ART-BRIEF.md. Build-time only.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const slicer = fileURLToPath(new URL('./slice-exercise-art.mjs', import.meta.url));
const defaults = ['--out=icons/Pixelart/GEAR', '--contact=docs/gear/art-check.png', '--manifest=docs/gear/sheets.json', '--size=256', '--colors=32'];
const given = process.argv.slice(2);
const args = [...defaults.filter((d) => !given.some((g) => g.startsWith(d.split('=')[0]))), ...given];
const r = spawnSync(process.execPath, [slicer, ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
