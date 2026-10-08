# MOSKE concepts: image prompts

Prompts only. These are for you to run in an image generator; bring the
results back and they'll be built with `/image-to-code` against the real
components. Written with the `imagegen-frontend-mobile` and `brandkit` skills.
Where those skills and `DESIGN.md` disagree, `DESIGN.md` wins: no rounded
corners (one-step notched pixel corners instead), no soft shadows (hard 4–8 px
drop edges), no blur or glass, no gradients on surfaces.

Four concepts, each a separate image:

1. [Season path](#1-season-path): Home's week path and the season path sheet
2. [Trophy cabinet](#2-trophy-cabinet): the Fitness hub shelf, earned and locked
3. [Share card frames](#3-share-card-frames): post 1080×1350 and story 1080×1920
4. [Pixel brand board](#4-pixel-brand-board): a 3×3 brand-kit board

## Design bible (paste at the top of every prompt)

Lock this across all four images so they read as one product.

> **MOSKE design bible.** A triathlon training app drawn as a 16-bit pixel-art
> game on a deep navy night palette. Surfaces: background `#0B1222`, panels
> `#121C33`, raised `#1A2744`, wells `#24345A`; borders `#5372B5` (active) and
> `#2A3B63` (quiet); hard shadow `#050912`. Text `#F2F5FC`, muted `#9AA8C7`.
> One accent, gold `#F2C14E` with dark text `#1A1205` on it. Status: good
> `#5BD08A`, danger `#F06A6A`, info `#6EA8FF`. Sport colours: run red, bike blue,
> swim teal, gym violet, brick orange. Every panel, button and chip is a flat
> rectangle with a 2 px border, a one-pixel notch cut out of each corner, and a
> hard 4–8 px drop edge straight down in `#050912`: no rounded corners, no soft
> or blurred shadows, no gradients, no glass. Type: an 8-px-grid pixel font
> (Silkscreen-like, all caps) for labels, headings, levels and XP; a clean system
> sans for sentences and for training numbers (minutes, km, kcal). Icons are
> 16×16 pixel glyphs drawn on whole pixels. Art is isometric pixel-art dioramas
> with crisp, unblurred pixels.

Phone mockup (for 1 and 2): a clean, flat iPhone 15-style frame with a thin
dark bezel, centred on a `#050912` canvas with even margins, no reflections, no
soft drop shadow under the phone. The screen content is the subject.

---

## 1. Season path

**What it's for:** a richer look for the week path card on Home and the season
path sheet it opens. Today they're built in code (seven stops on a dashed
trail, flags, a gold "you are here" marker, a finish gate). This concept asks
what a game map version could look like.

**Canvas:** 2400×1800, two phones side by side, same scale, equal gutters.

> [Design bible]
>
> Two iPhone screens side by side.
>
> Left screen, the Home tab: at the top a pixel wordmark "MOSKE", a gold
> "LVL 10" chip and a round avatar. Below the date "THURSDAY · 8 OCTOBER", a
> panel titled "WEEK PATH" showing this week as a tiny isometric pixel-art map:
> seven square stepping-stone tiles from Monday to Sunday along a dashed dirt
> trail, each tile carrying a small sport glyph (swim waves, bike, run, a gym
> dumbbell). Monday to Wednesday have small green pennant flags planted in them
> (sessions done). Thursday has a gold down-pointing marker hovering over it
> (today). Friday to Sunday are unlit. At the trail's end a gold pixel finish
> gate with a banner "24D". Under the map, the "THIS WEEK" panel with three
> segmented meters (gold, blue, green). Gold-filled tab bar item "Home" at the
> bottom.
>
> Right screen, a bottom sheet titled "SEASON PATH" over the dimmed Home: a
> vertical trail running down the sheet, one node per week ("WEEK 1 · Mon 5
> Oct" … "WEEK 4 · Mon 26 Oct"), each with a 10-cell segmented progress meter
> and "2 / 7 sessions". The current week's node has the gold marker; finished
> weeks show a green check; the last node is a gold finish gate with a flag and
> the race name "HALF IRONMAN". The trail between nodes is dashed, pixel-stepped.
>
> Sparse text, large and readable. No lorem ipsum.

**Bring back:** the image as PNG. What to look at in it: the map tiles, the
trail and gate shapes, the marker.

---

## 2. Trophy cabinet

**What it's for:** the trophy shelf at the bottom of the Fitness hub (built in
code now: 17 badges, four per shelf, earned lit gold, locked as dark
silhouettes, tap shows how to earn).

**Canvas:** 1500×1800, one phone.

> [Design bible]
>
> One iPhone screen, the Fitness hub scrolled to the bottom. A panel titled
> "TROPHY CABINET" with "14 / 17" in gold on the right. Inside, four wooden
> pixel-art shelves stacked vertically, each a 4 px brown plank with a hard dark
> shadow under it, holding four trophies: pixel cups, medals, flames, a star, a
> bike, a running figure, swim waves, a brick wall, a flag. Earned trophies are
> bright gold with a 2-pixel highlight and stand on small gold plinths; locked
> ones are solid dark silhouettes with a thin lighter outline, on grey plinths.
> One trophy is selected (white plinth) and the line under the shelves reads
> "Triple Threat · LOCKED · Run, bike and swim on the same day." Above the
> panel, the tail of a "CARDIO LOAD" panel with violet block bars. Tab bar at
> the bottom with "Profile" filled gold.
>
> Pixels crisp at every size. No glow, no bloom, no gradients.

**Bring back:** the image as PNG. What to look at in it: trophy glyph shapes at
32 px, the shelf and plinth drawing, the silhouette treatment.

---

## 3. Share card frames

**What it's for:** the session-complete card people post. The app draws it on a
canvas: the sport's scene at the athlete's level, the numbers, a gold level
chip, the MOSKE wordmark. This concept asks for decorative **frames** around
that content, one per sport, that the canvas can draw as an overlay.

**Canvas:** two images per sport (run, bike, swim, gym), 1080×1350 and
1080×1920, so eight in total. Generate them at 2× (2160×2700, 2160×3840) and
they'll be brought down with nearest-neighbour.

> [Design bible, minus the phone mockup]
>
> A pixel-art frame for a social share card, 1080×1350 (or 1080×1920 for the
> story size). The frame is a border only: the middle is a flat `#00FF00`
> rectangle (it gets keyed out) covering the area from 40 px to 1040 px across
> and 160 px to 1020 px down (story: 240 px to 1300 px down), where the scene
> will be drawn. Around it, a 16-bit game border themed for [RUN: a red running
> track with lane numbers and hurdles in the corners | BIKE: blue road with
> painted lines, chevrons and a chequered finish strip | SWIM: teal pool tiles
> and lane-rope floats | GYM: violet steel plates and barbell collars]. The top
> band holds space for a wordmark (left) and a gold level chip (right): leave
> it empty, flat `#0B1222`. The bottom band is a flat `#121C33` panel with a
> 4 px `#5372B5` notched-corner border, left empty for the stats. No text, no
> numbers, no logos anywhere. Crisp whole pixels on a 4 px grid, no
> anti-aliasing, no gradients, no glow.

**Bring back:** 8 PNGs named `share-frame-{run|bike|swim|gym}-{post|story}.png`.
They'll be keyed and drawn under the text in `js/app/share.js`.

---

## 4. Pixel brand board

**What it's for:** one reference board for the MOSKE pixel identity, to keep
future art and screens consistent. Built with the `brandkit` 3×3 panel system,
in a dark product/operator mode, translated to pixel art.

**Canvas:** 2400×2400, a 3×3 grid of panels with even 24 px gutters on
`#050912`.

> [Design bible, minus the phone mockup]
>
> A premium 3×3 brand-kit board for "MOSKE", a pixel-art triathlon training
> game. Every panel is a flat `#0B1222` or `#121C33` rectangle with a notched
> pixel corner and a hard dark drop edge. Panels, left to right, top to bottom:
>
> 1. **Logo cover:** the blue MOSKE bird mark redrawn as pixel art on a 32×32
>    grid, large, with the wordmark "MOSKE" in a heavy pixel font under it.
>    Lots of empty navy space.
> 2. **Construction:** the same bird on a visible 32×32 pixel grid, guide lines
>    in `#2A3B63`, showing it built from whole pixels.
> 3. **Digital application:** a phone app header: the pixel wordmark, a gold
>    "LVL 10" chip, and below it a gold-filled tab bar cell.
> 4. **Brand essence:** one line in the pixel font, large: "TRAIN. LEVEL UP."
> 5. **Colour system:** square swatches with hex labels: `#0B1222`, `#121C33`,
>    `#5372B5`, `#F2C14E`, `#5BD08A`, `#F06A6A`, `#6EA8FF`, then five small
>    sport swatches (run red, bike blue, swim teal, gym violet, brick orange).
> 6. **Typography:** "AaBbCc 0123456789" in the pixel font next to "35 min ·
>    6.6 km" in a clean sans, showing which font does which job.
> 7. **Physical application:** a pixel-art race bib and a gym towel with the
>    bird mark.
> 8. **Image direction:** a crop of an isometric pixel-art diorama: a running
>    track island at dusk with a coach on a bench.
> 9. **System detail:** a row of 16×16 pixel icons (run, bike, swim, gym, flag,
>    trophy, flame, clock), a segmented gold meter, a notched-corner button
>    "SHARE CARD".
>
> Very little text, all large and legible. No paragraphs, no fake UI copy.
> Crisp pixels everywhere; no blur, no gradients, no rounded corners.

**Bring back:** the board as PNG. It becomes the visual reference next to
`DESIGN.md`.
