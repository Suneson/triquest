# Training update: what you need to make

Work through this in order. Each batch is what its phase needs, so nothing is made before it's useful. Design and numbers are in `docs/TRAINING.md`.

## The short answers to your worries

- **Do you need a bike model?** Yes for when someone rides, but you already have tier 1: `road-bike-t1.glb` and `bike-trainer.glb` (the rollers). You only need models for bike tiers 2 to 4.
- **Does the bike model need splitting or rigging?** No. Send it as one piece, the way Tripo gives it to you. The cranks and wheels get separated here by code; that's been tested on your tier 1 bike.
- **Do you need a Mixamo cycling animation?** No. I couldn't find one on Mixamo, and it isn't needed. The ride gets generated from the bike's own measurements, which keeps the feet on the pedals. See `bike-rig-test-side.jpg` and `bike-rig-test-game-angle.jpg`.
- **What format?** Mixamo: **FBX Binary**. Tripo: **GLB**, as you do now. You don't need to convert anything.

## Settings for everything

**Gemini:** attach `icons/UI/ref/modern-shop.jpg` and `icons/UI/ref/modern-building.jpg` every time, and start each prompt with:

> Modern, clean 3D game art for a premium sports brand. Smooth rounded forms, satin plastic, brushed metal and glass, soft studio lighting. Navy #16264D, white, warm grey, baby blue #6FAEF6, small gold accents. No wood, no medieval or fantasy details, no parchment, no heavy black outlines.

**Tripo, for machines and items:** your usual settings: HD Model, V3.1, PBR, 2K. Export GLB. One model per tier.

**Tripo, for characters:** the same settings, and:

- A **T-pose**: arms straight out, legs slightly apart, hands open and flat, standing straight, facing front.
- **Generate from a front view and a back view** if you can. The back of the character is what the camera mostly sees on a bike.
- No hair or clothing touching the arms or sides. No gaps through the body.
- **Don't** use Tripo's rig or segmentation. Send the plain model.

**Mixamo, for animation clips:**

You don't need to upload anything. Preview clips on Mixamo's default character (Y Bot) and download them with no skin. The clip gets moved onto our athlete here, because the skeleton uses the same Mixamo bone names.

Download settings for each clip:

| Setting | Value |
| --- | --- |
| Format | FBX Binary (.fbx) |
| Skin | **Without Skin** |
| Frames per second | 30 |
| Keyframe reduction | None |
| In Place | **Ticked**, where it's offered |

Name the files as listed below. Put them in `MOSKE APP\Items\Training\clips\`.

## Batch A: for phases 1 and 2 (energy, treadmill drills)

**Mixamo clips**

| File | Search Mixamo for | Used for |
| --- | --- | --- |
| `idle.fbx` | "Breathing Idle" | Standing beside a machine |
| `exhausted.fbx` | "Exhausted", "Tired", or hands-on-knees poses | A failed drill: stops on the machine, out of breath |
| `victory.fbx` | "Victory", "Fist Pump" | A first clear |

If a search finds nothing close, tell me. A clip can be generated here, like the cycling one, though a real motion-capture clip looks better for anything loose like this.

**Gemini icons:** flat `#00FF00` background, 1024 x 1024, one centred object, no text:

| File | Prompt, after the style line |
| --- | --- |
| `icon-energy.png` | A glowing white and baby-blue lightning bolt in a rounded navy capsule, gold rim. |
| `icon-drill-start.png` | A rounded navy stopwatch with a gold crown and a white lightning bolt on its face. |
| `icon-failed.png` | A rounded grey stopwatch with a cracked glass face, a small sweat drop beside it. |
| `icon-first-clear.png` | A gold star medal on a navy and white ribbon, a small white lightning bolt in its centre. |

## Batch B: for phase 3 (bike, strength, swim)

**Start with one thing:** I reduce your existing bike and the runner, and we test on your phone. Then make the rest.

**Tripo models.** Make the concept in Gemini first, your usual way, on a plain background.

| Model | Files | Gemini concept, after the style line |
| --- | --- | --- |
| Road bike, tiers 2 to 4 | `road-bike-t2.glb`, `t3`, `t4` | Pure side view of a road bike with dropped bars, drawn exactly side-on, both wheels on the ground, cranks horizontal. T2: white and baby-blue alloy frame. T3: navy carbon aero frame with deep-section wheels. T4: white and gold time-trial superbike with disc wheels and aero bars. |
| Bench press, tiers 1 to 4 | `bench-press-t1.glb` to `t4` | Three-quarter view of a flat bench with two empty uprights. **No bar on it**: the bar is its own model, because it has to move with the hands. T1: navy pad, grey steel, a plain bar. T2: rounded white frame, baby-blue pad. T3: a compact power rack in navy and brushed metal. T4: a sculpted rack in white and gold, with the MOSKE bird on the back upright. |
| Barbell | `barbell.glb` | A single Olympic barbell on its own, straight, navy and steel plates, gold collars. |
| Pool lane, tiers 1 to 4 | `pool-lane-t1.glb` to `t4` | Three-quarter view of one rectangular lap lane set in a pale tile surround, water visible, floating lane ropes down both sides. T1: plain ropes. T2: blue and white ropes with a start block. T3: adds a wall pace clock. T4: white and gold edging and a lit underwater strip. |
| Sauna, tiers 1 to 3 | `sauna-t1.glb` to `t3` | A small modern sauna cabin. **No wood:** walls of matt navy and warm-grey composite panels, a glass front with a glowing heater inside, soft steam. T1: compact and plain. T2: wider with a bench seat. T3: adds gold trim and a backlit MOSKE bird. |
| Ice bath, tiers 2 and 3 | `ice-bath-t2.glb`, `t3` | A modern cold-plunge tub with ice in clear blue water. T2: white with baby-blue trim and a digital panel. T3: brushed metal with gold trim, a glass side and a chiller unit. |

Keep each machine's footprint simple, and leave room on it for a person. For the bench, the pad must be flat and clear of parts where the back lies.

**Mixamo clips**

| File | Search Mixamo for | Used for |
| --- | --- | --- |
| `swim.fbx` | "Swimming" | Front crawl in the lane |
| `bench.fbx` | "Bench Press" | Bench press. If it doesn't exist, tell me and it gets generated with the hands locked to the bar. |
| `lift-rest.fbx` | "Sitting Idle" or "Sitting Rubbing Arm" | Between sets |

**No cycling clip, and no model of the rider on a bike.** Those come from here.

## Batch C: for phase 4 (mechanic)

**One Tripo character,** in the T-pose settings above.

**Gemini concept:**

> Full-body character in a T-pose, front view, plain light grey background. A cheerful stylised bike mechanic with a big head and short limbs, same proportions as the attached athlete. Navy overalls with white and baby-blue panels, a MOSKE bird on the chest, a gold spanner in a belt loop, a baby-blue cap, rounded white shoes. Open flat hands.

Attach a screenshot of the current runner, so it matches. Save as `mechanic.glb`.

**Mixamo clips**

| File | Search Mixamo for |
| --- | --- |
| `mechanic-work.fbx` | "Kneeling", "Picking Up", "Hammering", whichever looks most like fixing something low down |
| `mechanic-idle.fbx` | "Idle" with a relaxed stance |
| `mechanic-walk.fbx` | "Walking" |

**Gemini:** on the flat green background, `icon-mechanic-busy.png` (the mechanic's cap and a gold spanner, with a small clock badge) and `icon-mechanic-free.png` (the same with a green tick badge).

## Batch D: for phase 5 (classes)

Portraits now; bodies come in batch E. Flat `#00FF00`, 1024 x 1024, from the hips up, facing three-quarters, in the same style as the runner, all in the same plain navy and white kit:

| File | Prompt, after the style line |
| --- | --- |
| `class-pacer.png` | A very lean distance runner, long thin limbs, narrow shoulders, light and quick looking. |
| `class-triathlete.png` | A medium, athletic all-rounder, swimmer's shoulders, balanced build. |
| `class-functional.png` | A strong, broad hybrid athlete, thick arms and solid core, still mobile looking. |
| `class-titan.png` | A huge powerlifter, massive chest and neck, thick waist, heavy arms. |

Also: `locker-roster-bg.png`, a wide 1600 x 900 view inside a clean navy and white locker room with four empty lit bays, for the class screen, no people, no text.

## Batch E: for phase 6 (bodies and clothes)

**Do this one step at a time. The first step tests the idea, and the rest depend on it.**

**Step 1: one body and one set.**

- `body-medium.glb`: the Triathlete in plain skin-tight base layers, T-pose.
- `set-aero-medium.glb`: **the same character, same pose, same proportions**, wearing the full Aero set.

Use the same concept image for both, editing only the clothes. Send me those two and wait. I'll bake one onto the other and show you the result. If the proportions drift a lot between the two, the bake gets harder, so keep them as close as you can.

**Step 2: the other bodies,** once step 1 works. Same head, same style, T-pose, plain base layers: `body-lean.glb`, `body-strong.glb`, `body-tank.glb`.

**Step 3: the sets.** One per class to start, each on the medium body, T-pose, with top, bottom and shoes clearly separate pieces of clothing:

| File | Concept, after the style line |
| --- | --- |
| `set-aero-medium.glb` | Pacer's set. White and baby-blue racing singlet, short split shorts, light carbon-plated racing shoes. |
| `set-iron-medium.glb` | Triathlete's set. Navy and gold tri top, fitted tri shorts, white and gold cycling-style shoes. |
| `set-forge-medium.glb` | Functional's set. Fitted grey and navy training tee, compression shorts over tights, flat stable training shoes. |
| `set-titan-medium.glb` | Titan's set. Navy lifting singlet with a gold band, knee sleeves, high-top lifting shoes with a gold strap. |

Keep to skin-tight or close-fitting clothes. Nothing loose: no flapping fabric, wide sleeves, hoods or long socks with a gap.

**Step 4: icons.** For each set, on flat green at 1024 x 1024: `wear-aero-top.png`, `wear-aero-bottom.png`, `wear-aero-shoes.png`, and the same for `iron`, `forge` and `titan`. That's 12. One piece of clothing, floating, shown flat and from the front.

**Optional, later: accessories.** One Tripo model each, small, on their own: `cap.glb`, `headphones.glb`, `hydration-pack.glb`.

## Batch F: for phase 7 (carbs)

**Tripo:** `smoothie-bar-t1.glb` to `t3`, a compact modern smoothie counter. **No wood.**

- T1: white counter with one blender and fruit bowls.
- T2: navy counter with two blenders and a small menu board with the bird.
- T3: curved white and gold counter, glass fruit display, a backlit MOSKE bird.

**Gemini:** on flat green, `icon-carbs-ready.png` (a rounded smoothie cup, a white straw, a small gold bubble) and `icon-fuel-up.png` (a smoothie cup and a white lightning bolt).

## What happens to what you send

Machines and items go through the usual route: Tripo GLB, my render, your Gemini repaint, cut. Put the GLBs in `MOSKE APP\Items\Training\glb\`, the repaint sheets in `MOSKE APP\Items\Training\sheets\`, and the clips and icons in their own folders beside them. The only change: bikes, benches and bars get reduced for live use as well as rendered.

## Totals

| Batch | Tripo models | Mixamo clips | Gemini images |
| --- | --- | --- | --- |
| A | 0 | 3 | 4 |
| B | 3 bikes, 4 benches, 1 barbell, 4 pool lanes, 3 saunas, 2 ice baths: **17** | 3 | Concepts only |
| C | 1 | 3 | 2, plus the concept |
| D | 0 | 0 | 5 |
| E | 4 bodies, 4 sets: **8** | 0 | 12, plus concepts |
| F | 3 | 0 | 2, plus concepts |
| **Total** | **29** | **9** | **25, plus concepts** |
