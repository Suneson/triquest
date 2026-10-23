# MOSKE item art: the painted style

This replaces the pixel-art brief for **item icons** (gear, fuel, currencies,
clothes, trophies, feat items, challenge marks). The reference is the
Clash of Clans food set: chunky, glossy, hand-painted 3D game icons. The first
batch already made in this style (fuel, bike frames, aerobars, pedals, the
backpack, the stall, the coin and the carbs ear) is the house reference from
now on. Attach two or three of them to every request together with the MOSKE
logo.

## The style, in one paragraph (paste after every item description)

> Stylised 3D game item icon in the style of a premium mobile strategy game
> (Clash of Clans / Supercell item art): a single object, chunky and slightly
> exaggerated proportions with soft rounded edges, hand-painted look over a 3D
> form, smooth gradients, glossy specular highlights, a soft warm key light from
> the top left, a cool rim light on the right edge, gentle ambient occlusion in
> the creases, rich saturated colours. Seen in three-quarter view from slightly
> above, centred, filling about 80% of a square frame. No outline, no text, no
> letters, no numbers, no watermark, no frame, no ground, no cast shadow.
> Background: one flat solid pure green #00FF00 everywhere around the object,
> no gradient, no vignette, no glow spilling onto the background.

## Rules that keep the set consistent

- **One object, one silhouette.** It should read at 48 px: thick forms, no thin wires, no tiny parts that vanish when small.
- **Palette:**
  - MOSKE blue `#0C4CAE` with sky blue `#6EA8FF` highlights
  - navy `#16264D`
  - gold `#F2C14E`, shading to `#B8892A`
  - white `#F2F5FC`
  - one accent per item: red `#D9443B` (caffeine, crimson kit), orange (the carbon frame), green (only where the object is green)
  - no neon, except the carbs ear's glow
- **Materials:**
  - Carbon fibre: a fine woven texture with a satin sheen.
  - Alloy: brushed silver with a bright edge highlight.
  - Foil: crinkled, with hard specular streaks.
  - Fabric: soft folds and visible stitching.
  - Gold: warm, polished, never yellow-plastic.
- **The MOSKE bird logo** (the speed-line bird, `icons/logo.png`) goes small, flat and crisp:
  - white or blue on dark parts
  - gold on the pro and race items
  - never distorted, never more than about a fifth of the object
  - only where a real product would carry a logo (sachets, bars, jerseys, frames, bags, plaques)
- **Tiers read at a glance, always the same three steps:**
  - **Tier 1:** entry level. Plain alloy, black and silver, simple shapes.
  - **Tier 2:** mid-range. MOSKE blue and steel, cleaner shapes, one carbon part.
  - **Tier 3:** pro. Carbon fibre with gold accents, sleek and aerodynamic, the most premium of the three. A faint gold rim light is allowed on tier 3 only.
- **Trophies** are the one exception to "no glow": metal tiers glow softly inside the object's own silhouette. Bronze `#B87333`, silver `#C9D4E8`, gold `#F2C14E`, and for tiers 4–5 a deep blue-black enamel with gold.

## Making and exporting

1. Generate square, 1024 × 1024 if offered, on the flat green background, with the logo and two finished icons attached as references.
2. Name the file exactly as listed below.
3. Drop the raw images in `docs/gear/gen/` (git-ignored). I'll key out the green, trim, and export a 256 × 256 PNG with smooth (not pixel) alpha into the path listed.
   - The current `tools/gen-items.mjs` pixel-snaps to 128 px; I'll change it to keep the painted look before the first batch goes in.
4. If a result has a green fringe on soft edges, ask again with "hard clean edge against the green, no glow".

## A question before props and boards

The Profile scenes are pixel-art dioramas. Painted props and boards placed
**inside** those scenes would clash. The list below includes them, marked
**scene**. Generate those only if the scenes are being repainted too;
otherwise they stay as pixel art and I'll keep drawing them that way.

---

## The list

Paths keep the current folders so nothing in the code changes. **Have** means it
already exists in your new-style sheets and only needs cutting out.

### Currencies, buttons and fuel (all done)

| File | Item | Status |
| --- | --- | --- |
| `icons/Pixelart/GEAR/coin.png` | Gold coin with an embossed M | Have |
| `icons/Pixelart/GEAR/carbs.png` | Glowing blue wheat ear | Have |
| `icons/Pixelart/GEAR/btn-shop.png` | Market stall, blue and gold awning | Have |
| `icons/Pixelart/GEAR/btn-inventory.png` | Navy backpack, orange zips, bottle in the side pocket | Have |
| `icons/Pixelart/GEAR/fuel-gel.png` | White sachet, blue label band, bird logo | Have |
| `icons/Pixelart/GEAR/fuel-gel-caffeine.png` | Red sachet, torn silver tab, white bird | Have |
| `icons/Pixelart/GEAR/fuel-gel-race.png` | Gold sachet, black band, gold bird | Have |
| `icons/Pixelart/GEAR/fuel-energy-bar.png` | Gold wrapper, navy band, torn open | Have |
| `icons/Pixelart/GEAR/fuel-rice-cake.png` | Rice and raisin square in silver foil | Have (the foil one, not the plain white block) |
| `icons/Pixelart/GEAR/fuel-pasta.png` | Spaghetti bowl with a blue rim, fork, basil | Have |
| `icons/Pixelart/GEAR/fuel-recovery-shake.png` | Clear shaker, blue lid, chocolate shake | Have |

### Cycling gear

| File | Prompt (then the style paragraph) | Status |
| --- | --- | --- |
| `GEAR/bike-wheels-t1.png` | A single road bike wheel, plain silver alloy rim, black tyre, 32 straight silver spokes, simple hub | **New** |
| `GEAR/bike-wheels-t2.png` | A single road bike wheel, mid-depth carbon rim with a satin weave, MOSKE blue decal with the white bird logo, black tyre, bladed spokes | **New** |
| `GEAR/bike-wheels-t3.png` | A single deep-section carbon race wheel, very deep glossy carbon rim with gold decal and gold bird logo, black tyre, aero bladed spokes, gold hub | **New** |
| `GEAR/bike-aerobars-t1.png` | Clip-on aerobars, black alloy | Have |
| `GEAR/bike-aerobars-t2.png` | Carbon clip-ons, blue | Have |
| `GEAR/bike-aerobars-t3.png` | Integrated cockpit, carbon and gold | Have |
| `GEAR/bike-frame-t1.png` | Alloy frame, silver and blue | Have |
| `GEAR/bike-frame-t2.png` | Carbon frame, orange and silver | Have |
| `GEAR/bike-frame-t3.png` | Carbon TT frame, black and gold | Have |
| `GEAR/bike-power-t1.png` | Single-sided power pedal, black | Have (the single black pedal) |
| `GEAR/bike-power-t2.png` | Dual-sided power pedals, silver pair | Have (the silver pair) |
| `GEAR/bike-power-t3.png` | A sleek smart bike trainer (direct-drive turbo, wide stable legs, a cassette on the side), glossy black with MOSKE blue panels and a gold flywheel cover, a pair of carbon-and-gold power pedals resting in front of it | **New** |

### Swimming gear

| File | Prompt | Status |
| --- | --- | --- |
| `GEAR/swim-goggles-t1.png` | A pair of simple swimming goggles, clear lenses, black silicone strap | **New** |
| `GEAR/swim-goggles-t2.png` | A pair of mirrored swimming goggles, blue-silver mirrored lenses, MOSKE blue strap with a small white bird | **New** |
| `GEAR/swim-goggles-t3.png` | A pair of low-profile racing goggles, gold mirrored lenses, black split strap, gold nose bridge | **New** |
| `GEAR/swim-paddles-t1.png` | A pair of small finger paddles, clear blue plastic, black finger strap | **New** |
| `GEAR/swim-paddles-t2.png` | A pair of hand-sized swim paddles, MOSKE blue with drilled holes, navy straps | **New** |
| `GEAR/swim-paddles-t3.png` | A pair of large contoured swim paddles, carbon-black with gold edges and gold straps | **New** |
| `GEAR/swim-buoy-t1.png` | A figure-eight pull buoy, plain grey foam | **New** |
| `GEAR/swim-buoy-t2.png` | A blue pull buoy with a pair of short training fins, navy and blue | **New** |
| `GEAR/swim-buoy-t3.png` | A navy and gold pull buoy, a pair of black fins with gold tips, and a centre-mount swim snorkel in MOSKE blue | **New** |
| `GEAR/swim-wetsuit-t1.png` | A sleeveless triathlon wetsuit laid flat, black neoprene with a thin blue trim | **New** |
| `GEAR/swim-wetsuit-t2.png` | A full-sleeve triathlon wetsuit laid flat, black neoprene with MOSKE blue panels and a white bird on the chest | **New** |
| `GEAR/swim-wetsuit-t3.png` | A premium race wetsuit laid flat, glossy black neoprene with a textured forearm panel, gold seams, a gold bird on the chest | **New** |

### Running gear

| File | Prompt | Status |
| --- | --- | --- |
| `GEAR/run-shoes-t1.png` | A single daily running shoe, grey mesh upper, white foam sole, blue laces | **New** |
| `GEAR/run-shoes-t2.png` | A single lightweight tempo running shoe, MOSKE blue knit upper, white and navy sole, a small white bird on the heel | **New** |
| `GEAR/run-shoes-t3.png` | A single carbon-plated racing shoe, white upper with gold accents, very thick angled foam sole, a visible carbon plate edge, gold bird on the heel | **New** |
| `GEAR/run-watch-t1.png` | A simple round GPS sports watch, black case, black strap, a plain grey screen | **New** |
| `GEAR/run-watch-t2.png` | A GPS sports watch in MOSKE blue with a chest heart-rate strap coiled beside it | **New** |
| `GEAR/run-watch-t3.png` | A premium multisport watch, titanium case with a gold bezel, black strap, a colourful map-and-graph screen | **New** |
| `GEAR/run-kit-t1.png` | A running T-shirt and shorts folded together, grey technical fabric, a small blue bird | **New** |
| `GEAR/run-kit-t2.png` | A lightweight running vest and split shorts, MOSKE blue mesh, white bird | **New** |
| `GEAR/run-kit-t3.png` | A race singlet with a race bib pinned on (the bib blank, no numbers), navy and gold, gold bird | **New** |
| `GEAR/run-recovery-t1.png` | A ridged foam roller, blue and black | **New** |
| `GEAR/run-recovery-t2.png` | A massage gun, matte navy body, a round gold head | **New** |
| `GEAR/run-recovery-t3.png` | A pair of air compression recovery boots, black and MOSKE blue, a small control unit with a gold dial | **New** |

### Gym gear

| File | Prompt | Status |
| --- | --- | --- |
| `GEAR/gym-belt-t1.png` | A rolled nylon lifting belt, black with a blue velcro strap | **New** |
| `GEAR/gym-belt-t2.png` | A thick leather lifting belt, brown leather, a silver prong buckle | **New** |
| `GEAR/gym-belt-t3.png` | A lever lifting belt, black suede, a polished gold lever buckle, a gold bird embossed | **New** |
| `GEAR/gym-shoes-t1.png` | A single flat-soled training shoe, black canvas, white flat sole | **New** |
| `GEAR/gym-shoes-t2.png` | A single weightlifting shoe, MOSKE blue with a raised white heel and one strap | **New** |
| `GEAR/gym-shoes-t3.png` | A single competition weightlifting shoe, white leather with a raised wooden-look heel, two gold straps | **New** |
| `GEAR/gym-sleeves-t1.png` | A pair of cotton lifting straps, navy | **New** |
| `GEAR/gym-sleeves-t2.png` | A pair of black neoprene knee sleeves and lifting straps | **New** |
| `GEAR/gym-sleeves-t3.png` | Knee sleeves, lifting straps and wrist wraps together, black with gold stitching and gold bird | **New** |
| `GEAR/gym-bar-t1.png` | A block of white lifting chalk in a small tin | **New** |
| `GEAR/gym-bar-t2.png` | A short section of a steel barbell with knurling, a chalk block resting on it | **New** |
| `GEAR/gym-bar-t3.png` | A short section of a competition barbell with two calibrated plates, one MOSKE blue and one gold, a gold collar | **New** |

### Clothes (shop kits)

| File | Prompt | Status |
| --- | --- | --- |
| `GEAR/kit-moske-navy.png` | A short-sleeved cycling jersey laid flat, navy fabric, a gold chest band, gold cuffs, a full zip, white bird | **New** |
| `GEAR/kit-moske-sand.png` | The same jersey in sand beige, slate-blue chest band and cuffs, navy bird | **New** |
| `GEAR/kit-moske-crimson.png` | The same jersey in deep crimson, white chest band and cuffs, white bird | **New** |
| `GEAR/kit-moske-climber.png` | The same jersey in white with royal blue polka dots, blue cuffs, blue bird | **New** |
| `GEAR/kit-moske-pro.png` | The same jersey in matte black with thin gold pinstripes, gold cuffs and zip, gold bird | **New** |

### Items only a feat gives (`icons/Pixelart/FEATS/items/`)

| File | Prompt | Status |
| --- | --- | --- |
| `kit-run-sub20.png` | A running singlet in electric blue with a gold "fast" chevron across the chest | **New** |
| `kit-gran-fondo.png` | A long-sleeved cycling jersey, deep navy fading to sky blue, with a gold mountain silhouette across the chest | **New** |
| `kit-iron.png` | A cycling jersey in black and red with a gold bird | **New** |
| `trisuit-limited.png` | A one-piece triathlon suit laid flat, white and MOSKE blue with gold side panels | **New** |
| `singlet-lifting.png` | A weightlifting singlet laid flat, navy with a gold side stripe and gold bird | **New** |
| `shirt-finisher.png` | A finisher T-shirt, white with a laurel wreath print in gold | **New** |
| `cap-run.png` | A running cap, white with a blue brim and a small gold bird | **New** |
| `cap-climber.png` | A cycling cap, white with blue polka dots | **New** |
| `cap-training.png` | A plain navy training cap with a gold bird | **New** |
| `frame-olympic.png` | A gold picture frame with three linked rings in blue, gold and white (not the Olympic logo), a velvet navy backing | **New** |
| `frame-race.png` | A gold picture frame around a blank race bib, a finisher medal hanging from one corner | **New** |

### Trophies, one per feat (`icons/Pixelart/FEATS/`)

A trophy's metal follows its tier: 1 bronze, 2 silver, 3 gold, 4 blue-black enamel and gold, 5 a tall gold cup with a blue gem. Each carries a small emblem for its sport on the front plate. No text and no numbers; the emblem tells the story.

| File | Prompt | Status |
| --- | --- | --- |
| `run-10k.png` | A bronze medal on a blue ribbon, a running shoe emblem | **New** |
| `run-5k-25.png` | A bronze stopwatch-shaped medal, blue ribbon | **New** |
| `run-5k-22.png` | A silver stopwatch-shaped medal, blue ribbon | **New** |
| `run-5k-20.png` | A gold trophy cup with a winged stopwatch emblem | **New** |
| `run-10k-50.png` | A silver medal with a stopwatch and a road | **New** |
| `run-10k-45.png` | A gold medal with a stopwatch and a road | **New** |
| `run-half.png` | A silver medal shaped like half a laurel wreath | **New** |
| `run-30k.png` | A gold medal with a long winding road | **New** |
| `run-marathon.png` | A blue-black enamel and gold medal with a full laurel wreath | **New** |
| `run-month-50.png` | A bronze calendar plaque with a running shoe | **New** |
| `run-month-100.png` | A gold calendar plaque with a running shoe | **New** |
| `bike-50.png` | A bronze medal with a bicycle wheel emblem | **New** |
| `bike-100.png` | A silver medal shaped like a bicycle wheel with a laurel | **New** |
| `bike-160.png` | A gold trophy cup with a mountain-road emblem | **New** |
| `bike-climb-2000.png` | A gold mountain-shaped trophy with a winding road up it | **New** |
| `bike-40kph.png` | A gold trophy with a speedometer and wind lines | **New** |
| `bike-hc.png` | A blue-black enamel and gold trophy shaped like a jagged summit with a flag | **New** |
| `bike-month-200.png` | A bronze calendar plaque with a bicycle wheel | **New** |
| `bike-month-500.png` | A gold calendar plaque with a bicycle wheel | **New** |
| `swim-1k.png` | A bronze medal with a wave emblem | **New** |
| `swim-1k-steady.png` | A silver medal with a calm flat wave and a lane line | **New** |
| `swim-2k.png` | A silver trophy with two waves | **New** |
| `swim-1k-145.png` | A gold trophy with a wave and a stopwatch | **New** |
| `swim-month-10.png` | A silver calendar plaque with a wave | **New** |
| `gym-25.png` | A bronze dumbbell-shaped trophy | **New** |
| `gym-100.png` | A gold dumbbell-shaped trophy on a plinth | **New** |
| `gym-bench-1.png` | A silver trophy with a bench and barbell emblem | **New** |
| `gym-squat-15.png` | A gold trophy with a barbell across a squat rack emblem | **New** |
| `gym-dead-2.png` | A gold trophy shaped like a loaded barbell lifted from the floor | **New** |
| `cross-four-weeks.png` | A gold four-part shield with a wave, a wheel, a shoe and a dumbbell | **New** |
| `cross-olympic-day.png` | A gold trophy with three linked emblems: wave, wheel, shoe | **New** |
| `cross-iron-day.png` | A tall gold cup with a blue gem and the three emblems around it, the grandest trophy of all | **New** |
| `cross-race.png` | A silver medal with a finish-line arch and a ribbon | **New** |

### Challenge and stake marks (`icons/Pixelart/FEATS/`)

| File | Prompt | Status |
| --- | --- | --- |
| `challenge.png` | A pair of crossed flags, one MOSKE blue, one gold, on a short pole | **New** |
| `stake-pot.png` | A small open treasure chest overflowing with gold M coins | **New** |
| `stake-locked.png` | A stack of gold M coins with a small steel padlock on top | **New** |
| `podium.png` | A three-step winners' podium, gold, silver and bronze blocks, no numbers | **New** |
| `segment.png` | A short stretch of road with a start and finish flag, a stopwatch floating above | **New** |

### Scene pieces (only if the scenes are repainted)

| File | Prompt | Status |
| --- | --- | --- |
| `FEATS/board-run.png`, `board-bike.png`, `board-swim.png`, `board-gym.png` | A free-standing medal board for that sport: a wooden frame on legs with empty brass hooks and a gold bird plaque | **Scene** |
| `PROPS/bike-rack.png` | A low steel bike rack with four hoops and two road bikes | **Scene** |
| `PROPS/bike-stand.png` | A bike repair workstand holding a red frame, a small tool tray | **Scene** |
| `PROPS/bike-tent.png` | A pop-up team tent, blue and white valance, a table with bidons | **Scene** |
| `PROPS/bike-lights.png` | A tall floodlight pole with a four-bulb lamp head | **Scene** |
| `PROPS/run-water.png` | A trestle table with paper cups and a blue water cooler | **Scene** |
| `PROPS/run-gate.png` | A finish timing gate: navy posts and banner, a black clock panel | **Scene** |
| `PROPS/run-stand.png` | A three-row spectator stand with navy seats and three spectators | **Scene** |
| `PROPS/run-lights.png` | A stadium light pole with a six-bulb head | **Scene** |
| `PROPS/swim-reel.png` | A lane-rope reel wound with blue, white and red rope | **Scene** |
| `PROPS/swim-clock.png` | A round pace clock, white face, red sweep hand, on a post | **Scene** |
| `PROPS/swim-stand.png` | A two-row poolside bench with two spectators | **Scene** |
| `PROPS/gym-chalk.png` | A steel chalk bowl on a pedestal, heaped with chalk | **Scene** |
| `PROPS/gym-sound.png` | A pair of black PA speakers on a small amp | **Scene** |

## Count

- **Have:** 19. That's 4 currency and button icons, 7 fuels, and 8 cycling items (aerobars and frames tiers 1–3, power pedals tiers 1–2). They only need cutting out.
- **New:** 94:
  - 4 cycling gear
  - 12 swimming gear
  - 12 running gear
  - 12 gym gear
  - 5 kits
  - 11 feat items
  - 33 trophies
  - 5 challenge marks
- **Scene:** 17, only if the scenes are repainted.
