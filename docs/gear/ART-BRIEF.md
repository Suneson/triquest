# GEAR art brief

Everything in the shop and the inventory: gear upgrades, clothes, fuel, the
two currencies and the scene buttons. Hand this to an image generator as is.
`tools/gen-items.mjs` already does it with Gemini (see "Generating"), and
`tools/slice-gear-art.mjs` cuts your own sheets the same way the exercise
sheets are cut.

## House style

- **Same pixel language as the exercise cards and the Profile scenes:**
  - Detailed pixel art with clean dark one-pixel outlines.
  - Soft cel shading in 3 to 4 tones per colour, lit from the top left.
  - A slight three-quarter view.
- **One object per picture.** Centred, filling about 80% of the frame. No text, no letters, no ground shadow, no frame.
- **Palette** follows the app:
  - navy `#0B1222` to `#24396E`
  - MOSKE blue `#0C4CAE`
  - gold `#F2C14E`
  - white `#F2F5FC`
  - Discipline colours only as small accents.
- **The MOSKE logo** (`icons/logo.png`, the bird made of speed lines) goes on gels, jerseys and the recovery shake: small, white or blue on dark, gold on the pro kit.
- **Tiers read at a glance:**
  - Tier 1: entry level, plain.
  - Tier 2: mid-range, navy and steel details.
  - Tier 3: pro, carbon and gold.
- **Background:** flat pure green `#00FF00` for single items (keyed out by the tools), or the exercise cards' cream for a sheet.

## Sheet layout (for your own sheets)

- **Grid:** 3×3 cells, one item per cell, the item's name printed under it if you like. The slicer drops printed labels.
- **Order:** reading order, left to right and top to bottom. Use `-` in the id list to skip a cell.
- **Cutting:** `node tools/slice-gear-art.mjs <sheet> 3x3 id1,id2,…`, or list the sheets in `docs/gear/sheets.json` and run `node tools/slice-gear-art.mjs`.
- **Output:** 256×256 PNGs in `icons/Pixelart/GEAR/`, with a contact sheet at `docs/gear/art-check.png`.

## Animated items

Use `python3 -I tools/gear-anim.py <green-screen.gif | frames-dir> icons/Pixelart/GEAR/<id>.webp`.

- It keys the green with spill suppression, trims and scales nearest, and keeps the WebP under 400 KB.
- It warns if a green fringe is left.
- For an MP4, export frames first with ffmpeg.

## File names

Every file is `icons/Pixelart/GEAR/<id>.png`. ✓ = done (generated, in the repo).

**Gear upgrades: `<sport>-<slot>-t<tier>`, 48 files.** Each name shows tiers 1 → 2 → 3:

| Sport | Slot | Tiers | Files |
| --- | --- | --- | --- |
| bike | wheels | Alloy training → Carbon → Deep-section carbon | `bike-wheels-t1..t3` ✓ |
| bike | aerobars | Clip-on → Carbon clip-ons → Integrated cockpit | `bike-aerobars-t1..t3` ✓ |
| bike | frame | Alloy → Carbon → Carbon TT | `bike-frame-t1..t3` ✓ |
| bike | power | Single-sided → Dual-sided → Dual + smart trainer | `bike-power-t1..t3` ✓ |
| swim | goggles | Anti-fog → Mirrored → Racing | `swim-goggles-t1..t3` ✓ |
| swim | paddles | Finger → Small → Full | `swim-paddles-t1..t3` ✓ |
| swim | buoy | Pull buoy → Buoy and fins → + snorkel | `swim-buoy-t1..t3` ✓ |
| swim | wetsuit | Sleeveless → Full → Race | `swim-wetsuit-t1..t3` ✓ |
| run | shoes | Daily trainers → Tempo → Carbon racers | `run-shoes-t1..t3` ✓ |
| run | watch | GPS → GPS + HR strap → Multisport | `run-watch-t1..t3` ✓ |
| run | kit | Technical → Lightweight → Race singlet | `run-kit-t1..t3` ✓ |
| run | recovery | Foam roller → Massage gun → Compression boots | `run-recovery-t1..t3` ✓ |
| gym | belt | Nylon → Leather → Lever | `gym-belt-t1..t3` ✓ |
| gym | shoes | Flat → Lifting → Competition | `gym-shoes-t1..t3` ✓ |
| gym | sleeves | Straps → + knee sleeves → + wrist wraps | `gym-sleeves-t1..t3` ✓ |
| gym | bar | Chalk → Chalk and good bar → Calibrated bar and plates | `gym-bar-t1..t3` ✓ |

The starter tier (`-t0`) shows the slot's pixel icon dimmed, by design.

**Fuel:**
- `fuel-gel` (blue) ✓
- `fuel-gel-caffeine` (red) ✓
- `fuel-gel-race` (gold) ✓
- `fuel-rice-cake` ✓
- `fuel-energy-bar` ✓
- `fuel-pasta` ✓
- `fuel-recovery-shake` ✓

**Clothes:**
- `kit-moske-navy` ✓
- `kit-moske-sand` ✓
- `kit-moske-crimson` ✓
- `kit-moske-climber` ✓
- `kit-moske-pro` ✓

**Currencies and buttons:**
- `coin` ✓
- `carbs` (blue wheat) ✓
- `btn-shop` ✓
- `btn-inventory` ✓

## Kit on the animated characters

The ten per-level characters are never redrawn for a kit. Clothing colour is
applied as a palette swap of the existing sprite.

- **What's done:**
  - Level 6 of cycling exists in all five kits (`bikelvl6_char--kit-moske-*.webp`, made with `tools/kit-recolor.py`).
  - The other levels show the base kit until they have a variant.
- **The limit:** a palette swap changes colour, not pattern.
  - Logos, stripes and polka dots can't come from it, so the climber kit is plain white on the rider.
  - The MOSKE logo lives on the static shop pictures, not on the animated character.
- **Gear that changes the silhouette** (frame, wheels, aerobars, wetsuit, carbon shoes) is already drawn by the level art, so it's never layered on.

### Still missing

| What | Spec |
| --- | --- |
| Kit variants for cycling levels 1–5 and 7–10 | Run `tools/kit-recolor.py` per level and check it; the hue band needs checking per level |
| Animated characters for run, gym and swim (none exist yet) | 10 per discipline: 768×624, transparent background, 12 fps (83 ms), about 8 frames, plus a matching empty background still per level |
| Swim scene stills, levels 2–10 | 512×512, the same layout as `SWIM_LVL1.png` |

## Generating

```
GEMINI_API_KEY=… node tools/gen-items.mjs            # everything
GEMINI_API_KEY=… node tools/gen-items.mjs fuel-gel   # one item
```

- The key is read from the environment only.
- Prompts live in `tools/gen-items.mjs`. A new item is one line there, plus its entry in `js/core/gear.js`.
- Raw model outputs land in `docs/gear/gen/` for review. That folder is git-ignored because it's about 20 MB; `docs/gear/art-check.png` shows every final image.
