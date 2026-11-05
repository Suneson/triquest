# Base items: concept image → 3D model → rendered sprite

Every item in the base is a picture, the way Supercell does it. Each one is made in three steps:

1. **Concept** (Gemini, you): one clean image of the item, made with the prompts below.
2. **3D model** (Tripo, you): the concept image turned into a model, exported as GLB.
3. **Sprites** (Claude, `tools/render-item.py`, to come): the model rendered in Blender from the base's locked camera.
   - Every item gets the same lights and two facings (turned 90° for the other wall), with a real contact shadow, at 2× size.
   - The sprites go straight into the app, already sized to their footprint.

The lighting and polish happen in step 3. So the concept should be **evenly lit, plain and muted**: that gives Tripo clean textures to work from. A texture pass comes later.

## Tripo settings

- **Model type: HD Model** (not Smart Mesh).
  - Smart Mesh makes a light, low-poly mesh for objects that move live in a game.
  - Ours are only rendered to stills, so the polygon count never reaches the phone. Take the detail.
- **AI Model:** V3.1.
- **Privacy:** Private. This is unreleased game art.
- **Ultra Mesh Quality: on.** It gives sharper edges and bevels, which is what the renders show.
- **AI Complete: on**, if it fills in the sides the concept doesn't show.
  - The second facing is the item turned 90°, so its side is on screen.
  - Turn it off if it adds parts that aren't in the concept.
- **Texture: on.**
  - **Texture Quality: 2K** is plenty for a sprite about 600 px across. 4K does no harm if it costs the same.
  - **8K: no.**
- **PBR: on.** Proper materials (metal, roughness), so Blender's lights react the way they should.
- **Polygon count: about 200,000** (100k to 300k), up to about 500k for a big detailed item (a power rack, a cable machine).
  - More is invisible in a picture about 600 px across.
  - 2 million makes the files huge and the renders slow.
- **Topology: Triangle.** It's fine for rendering. Quad only matters for re-modelling or animating.
- **Generate in Parts: off.**
- **Input:** single image. If the back or sides come out wrong, use the multi-image tab with a second view of the same item.
- **Export:** GLB. Name it like the concept image (`coffee-machine-t1.glb`) and drop it in the shared Drive folder.

## The general prompt

Paste one item block from the list below, then this:

```
Always blend the MOSKE logo I've attached into the item, small.

A single game item for a premium mobile strategy game, in the style of
Supercell's Clash of Clans buildings: one object, chunky and slightly
exaggerated proportions, soft rounded edges and bevels, thick readable forms,
modern and clean, made to be turned into a 3D model.

View: three-quarter view from the front-left, seen from slightly above (about
30 degrees down), the whole object in frame, centred, filling about 75% of a
square image, nothing cropped, nothing in front of it.

Lighting: flat, even, soft studio light from every side, like a light box. No
strong highlights, no glossy reflections, no rim light, no dark shadows on the
object, no ambient occlusion painted in, no glow.

Surfaces: clean, muted, true base colours (like an unlit texture), with
materials told apart by colour and fine texture, not by lighting. Matte to
satin finish.

Background: plain flat mid-grey studio background (#8A8A8A), the same
everywhere, no gradient, no floor, no ground line, no cast shadow, no
reflection under the object.

No text, no letters, no numbers apart from the logo, no watermark, no frame, no
people, no other objects. No wood anywhere: no wooden parts, no wood grain, no
planks; use metal, plastic, rubber, fabric, glass or stone instead.
```

### Rules that keep the set consistent

- **One object, one silhouette.** It should read when small: thick forms, no thin wires or tiny parts. Cables, spokes and straps are chunky.
- **Footprint:** each item has one, in floor tiles (u × v). Make the base match it in proportion: a 2 × 3 treadmill is a long rectangle seen from above, and a 2 × 2 rack is a square.
- **Palette:**
  - MOSKE blue `#0C4CAE` with sky blue `#6EA8FF` details;
  - navy `#16264D`;
  - gold `#F2C14E`, shading to `#B8892A`;
  - white `#F2F5FC`;
  - one accent per item: red `#D9443B`, orange, or green (only where the object is green);
  - no neon.
- **Materials:**
  - **Carbon fibre:** a fine woven texture with a satin sheen.
  - **Alloy:** brushed silver.
  - **Fabric:** soft folds and visible stitching.
  - **Gold:** warm and polished, never yellow plastic.
  - **Rubber:** matte black.
- **The MOSKE bird logo** (attach `icons/logo.png`) is small, flat and crisp:
  - white or blue on dark parts, gold on tier 3;
  - never distorted, and never more than about a fifth of the object;
  - only where a real product would carry one: a side panel, a console, a plaque or a bag.
- **Tiers read at a glance, always in the same three steps:**
  - **Tier 1:** entry level. Plain alloy, black and silver, simple shapes.
  - **Tier 2:** mid-range. MOSKE blue and steel, cleaner shapes, one carbon part.
  - **Tier 3:** pro. Carbon fibre with gold accents, sleek, the most premium. Glows and gold light get added in the render, not in the concept.

### Upgrades: edit, don't regenerate

Generate tier 1 first. Then make tiers 2 and 3 by **editing that same image** with this prompt, so the shape and size stay the same and only the finish changes:

```
Edit the attached image: the same object, same shape, same size, same view and
same flat grey background and flat lighting. Upgrade it to tier <2|3>:
<the tier's line from the item>. Keep the MOSKE logo, small.
```

## Making and naming

- **Image:** square, 1024 × 1024 if it's offered. Attach the logo as a reference, and for tiers 2 and 3, the tier 1 image too.
- **Names:** name each image exactly as listed (`treadmill-t1.png`) and put it in the shared Drive folder. Its model gets the same name, ending `.glb`.
- **Before sending to Tripo, check:**
  - the whole object is visible;
  - the background is plain grey;
  - there's no shadow under it;
  - it's seen from the front-left and slightly above.
- **Fixing a bad result:**
  - If it comes out shiny or strongly lit, ask again with "flatter, more even light, no highlights".
  - If parts are cut off, ask with "zoom out, the whole object in frame".

## The 30 items

Each block goes at the top of the general prompt. The footprint is u × v tiles.

### Run room

**1. `treadmill-t1`** (2 × 3)
```
Item: a home treadmill, tier 1: a long flat running belt on a low frame, two
side rails up to a simple console with a small screen, plain black and
brushed silver, chunky rounded frame. The belt runs from the back towards
the front-left.
```

**2. `treadmill-t2`** (2 × 3). Edit `treadmill-t1`:
```
tier 2: MOSKE blue side panels and steel frame, a bigger console with a wide
screen, a carbon-fibre deck edge, cushioned belt.
```

**3. `treadmill-t3`** (2 × 3). Edit `treadmill-t2`:
```
tier 3: carbon-fibre frame with gold trim and gold rail ends, a sleek
curved console with a large screen, a raised curved belt like a pro
self-powered treadmill.
```

**4. `shoe-display`** (2 × 1)
```
Item: a modern display shelf for running shoes, three shelves of white
metal and glass, holding three pairs of chunky running shoes (one red, one
MOSKE blue, one white with gold), a small MOSKE plaque on top.
```

**5. `race-podium`** (2 × 2)
```
Item: a three-step winners' podium for a race, rounded white steps with
navy sides, the tallest step in the middle, each step with a coloured
stripe instead of a number (gold in the middle, silver on one side,
bronze on the other), MOSKE logo on the front of the top step.
```

### Bike room

**6. `smart-bike-t1`** (1 × 2)
```
Item: an indoor spin bike, tier 1: a heavy round flywheel at the front,
chunky black frame, simple saddle and flat handlebar, a small clip-on
screen, plain black and brushed silver. The bike points towards the
front-left.
```

**7. `smart-bike-t2`** (1 × 2). Edit `smart-bike-t1`:
```
tier 2: MOSKE blue frame covers and steel, an enclosed flywheel cover, a
tablet-size screen on the bars, one carbon-fibre fork cover.
```

**8. `smart-bike-t3`** (1 × 2). Edit `smart-bike-t2`:
```
tier 3: a sleek carbon-fibre frame with gold accents, aero handlebar, a
large curved screen, gold crank and flywheel trim.
```

**9. `road-bike-stand`** (1 × 2)
```
Item: a carbon road bike standing on a chunky display stand, deep-section
wheels with thick rims (no thin spokes: solid disc-style wheels), orange
and black carbon frame, gold chainring, on a round navy base with a MOSKE
plaque.
```

**10. `bike-workstand`** (1 × 1)
```
Item: a bicycle repair workstand with a tool tray: a sturdy steel pole on
a tripod base with a clamp at the top, a magnetic tray holding chunky
spanners and a pump, MOSKE blue and silver.
```

### Gym room

**11. `weight-bench`** (1 × 2)
```
Item: an adjustable weight bench, padded navy seat and back rest with
visible stitching, chunky steel frame, a small MOSKE logo on the back rest.
```

**12. `dumbbell-rack`** (2 × 1)
```
Item: a two-tier dumbbell rack holding pairs of chunky hexagonal
dumbbells, black rubber heads with silver handles, a steel frame with a
MOSKE blue end plate.
```

**13. `power-rack`** (2 × 2)
```
Item: a power rack (squat cage): four thick steel posts, a loaded barbell
resting on the hooks with chunky black and MOSKE blue plates, a pull-up bar
on top, a small MOSKE plaque on the top crossbar.
```

**14. `kettlebell-set`** (1 × 1)
```
Item: a low round stand holding five kettlebells in rising sizes, matte
black with colour bands (white, blue, gold), on a navy rubber base.
```

**15. `rowing-machine`** (1 × 3)
```
Item: an indoor rowing machine: a long low rail, a sliding seat, foot
plates, a round fan housing at the front with a small screen on an arm,
MOSKE blue fan housing and silver rail.
```

**16. `punching-bag`** (1 × 1)
```
Item: a heavy punching bag hanging from a free-standing steel frame, a
red bag with white stitching and a MOSKE logo, a navy base.
```

**17. `cable-machine`** (2 × 2)
```
Item: a functional trainer cable machine: two tall steel towers with
weight stacks, a crossbar on top, chunky handles, MOSKE blue covers on the
weight stacks with the logo, the cables thick and simple.
```

### Pool

**18. `starting-block`** (1 × 1)
```
Item: a competition swimming starting block: a sloped white platform with
a grippy top, a navy column, a backstroke grip bar, a MOSKE logo on the
front, a lane number plate left blank.
```

**19. `swim-gear-rack`** (1 × 1)
```
Item: a small rack holding swim training gear: stacked kickboards in
MOSKE blue and white, pull buoys, a pair of fins and goggles on a hook,
white metal frame.
```

**20. `lifeguard-chair`** (1 × 1)
```
Item: a tall lifeguard chair in white powder-coated metal with a navy
seat, a ladder at the front, a red rescue float hanging on the side, a
MOSKE plaque on the back.
```

### Locker room and recovery

**21. `coffee-machine-t1`** (1 × 1)
```
Item: an espresso machine on a small counter cabinet, tier 1: a boxy
machine with one group head, a cup on the drip tray, a plain black and
brushed silver body.
```

**22. `coffee-machine-t2`** (1 × 1). Edit `coffee-machine-t1`:
```
tier 2: a two-group machine with a MOSKE blue body and steel panels, a
pressure gauge, a steam wand, a stack of cups on top.
```

**23. `coffee-machine-t3`** (1 × 1). Edit `coffee-machine-t2`:
```
tier 3: a sleek pro espresso machine in carbon fibre and gold, two gold
group heads, a gold gauge, a glass cup warmer on top with white cups.
```

**24. `locker-row`** (2 × 1)
```
Item: a row of three sports lockers, navy metal doors with vents and
silver handles, one door slightly open showing a towel, a MOSKE logo on
the middle door.
```

**25. `drinks-fridge`** (1 × 1)
```
Item: a glass-door drinks fridge full of sports drink bottles (blue, red
and white bottles, no readable labels), a navy body with a MOSKE logo on
the top panel.
```

**26. `ice-bath`** (1 × 2)
```
Item: a modern cold-plunge recovery tub, a rounded white shell with a navy
band, filled with clear blue water and ice cubes, a small control panel
on the side with a MOSKE logo.
```

**27. `massage-table`** (1 × 2)
```
Item: a padded sports massage table, navy cushion with visible stitching
and a face hole at one end, a folded white towel on it, a silver steel
frame.
```

### Trophies and decor

**28. `trophy-bronze`** (1 × 1)
```
Item: a chunky trophy cup on a stepped base, bronze #B87333 metal with
rounded handles, a navy base with a small MOSKE plaque.
```

**29. `trophy-silver`** (1 × 1)
```
Item: a taller trophy cup with a lid and two sweeping handles, polished
silver #C9D4E8 on a navy stepped base with a MOSKE plaque.
```

**30. `trophy-gold`** (1 × 1)
```
Item: a grand trophy: a gold #F2C14E cup on a tall stem with a winged
MOSKE bird on top, on a deep blue-black enamel base with gold edges.
```

### More, once the first 30 are in

These are good next items:
- **Trophies:** a medal display case, and tiers 4–5 in blue-black enamel and gold.
- **Decor:**
  - a modern planter with a round topiary;
  - a TV on a stand showing a leaderboard;
  - a water cooler;
  - a protein-shake counter;
  - a foam roller and yoga mat stand.
- **Run room:** a stretching rack.
- **Pool:** a lane rope reel.

## In the app

The first nine models are in the base, as pictures in `icons/Items/` (`<item>-<a|b>.webp`). They were rendered with `tools/render-items/`, repainted in Gemini, then cut out.

| Item | Room | Footprint (facing a) | Tiers |
| --- | --- | --- | --- |
| Coffee machine | locker | 1 × 1 | t1 to t3, by the locker room's level (t2 from 4, t3 from 7) |
| Road bike on balance rollers (`smart-bike`) | bike | 1 × 2 | t1 |
| Treadmill, with the 3D runner on its belt | run | 2 × 1 (it starts facing b, 1 × 2) | t1 to t2, by the run room's level (t2 from 5) |
| Bike on a stand | bike | 2 × 2 | |
| Gold mountain trophy | locker | 1 × 1 | |

- **Picking up an item** with two facings shows a round rotate button (`icons/UI/rotate.webp`, from Gemini) over the dock.
  - It turns the item 90° on the spot it stands on, if the turned footprint still fits there.
  - The other facing's picture shows the item from its other side (`orient()` in `js/core/placement.js`).
- **The 3D runner** stands on the treadmill's belt and faces its console in both facings (`runner` on the treadmill in `PLACEABLES`, `spot` and `foot` in `mountRunner`).
- **Saving the facing:** it's stored with the item's spot, on the device and in `user_placements.face` (`0030_placement_face.sql`, null for the item's default facing).
- **Measuring:** `tools/measure-items.py` measures these pictures by the object only (alpha above 200), leaving out the soft ground shadow.
- **Smart bike:** the rollers bike replaces the old animated rider.
