# Characters

Your athlete in the wardrobe (`js/app/wardrobe3d.js`) and on the treadmill (`js/app/runner3d.js`), both drawn by `js/app/char3d.js`.

## The files (`models/chars/`)

| File | What |
| --- | --- |
| `male.glb`, `female.glb` | The two bodies: a skinned mesh, 1.8 tall, feet on y = 0, facing +Z. |
| `<outfit>-male.glb`, `<outfit>-female.glb` | An outfit: the whole dressed character, on that body's skeleton. |
| `male-clips.glb`, `female-clips.glb` | That body's skeleton and every clip, no mesh. One file drives the body and every outfit made for it. |
| `mechanic.glb`, `mechanic-clips.glb` | The mechanic (fixing on his knees; his walk and idle are the male's for now). |

Clips: idle, walk, run-slow, run, run-fast, swim, squat, pushup, sit, taunt1, taunt2, victory (`CLIPS` in `js/core/wardrobe.js`). A clip finds its bones by name.

Each file is about 0.4 to 0.7 MB: 30,000 triangles at most, 1024 px WebP textures, meshopt.

The emissive map is a mask, not a glow: red marks the skin and green the irises. The wardrobe's skin tone and eye colour recolour them.

## Making them

```
node tools/build-characters.mjs "<MOSKE APP/Characters>" [male|female|mechanic|clips|outfits|<outfit-name>]
```

What it reads from the Characters folder:
- `Rigged/<Body>_Model…`: the Mixamo-rigged bodies (FBX and their PNGs);
- `Clips/`: Mixamo clips as FBX ("Without Skin", in place);
- `GLB Assets/`: the outfits, one GLB per outfit and body, from Meshy or Tripo (30k triangles is fine), plus the mechanic.

How an outfit gets its rig: the outfit mesh comes unrigged, so the body's skeleton is fitted to it. The tool searches scale, position and eight limb angles until the posed body sits on the outfit, then copies each vertex's weights from the nearest body skin, smoothed. Fingers are folded into the hand, so outfit hands move as mittens.

Fit quality is printed (mm apart, about 22 to 28 mm for the first outfits). Check each new outfit in the wardrobe: admins and the demo can try every outfit that has its two models.

## Adding an outfit

1. Put `<outfit>-male.glb` and `<outfit>-female.glb` in `GLB Assets/`.
2. Run the tool with the outfit's name.
3. In `js/core/wardrobe.js`, give the outfit `models: made('<outfit>')`.

Better source files help: a female clip set downloaded "With Skin" from Mixamo, and the mechanic's own walk from Mixamo (his current walk is a different rig and is skipped).

## Accessories (hair, hats, helmets, glasses, shoes)

Code: `js/app/gear3d.js` (the fitting), `js/core/wardrobe.js` (`SLOTS`, `ACCESSORY_MODELS`, `gearFor`), models in `models/gear/<id>.glb`.

Each accessory is a plain mesh, not skinned. The app fits it to whoever wears it:
1. with the character in its bind pose, it measures the skin that moves with the head (or each foot);
2. it scales and places the accessory against that box, by its slot's rule (`FIT`) and any change for that item (`ITEM_FIT`);
3. it hangs it on the head bone, or a shoe on each foot bone (the right one mirrored), so it follows every clip.

So one file fits the male, the female and every outfit. A hat or helmet hides the hair (the visor doesn't). Hair is free, on the Look tab, and tinted with the hair colour: hair models are painted grey.

### Adding one

1. Put the GLB in `MOSKE APP/Items/z_GLB MODELS` (a shoe is one shoe).
2. Add a row to `ITEMS` in `tools/build-accessories.mjs`: the app's id, the file, and `yaw`, the turn round Y that makes it face +Z (shoes are turned automatically: the heel is the taller end).
3. `node tools/build-accessories.mjs "<z_GLB MODELS>" <id>`: about 6,000 triangles, one 512 px WebP, 50 to 110 KB.
4. Add the id to `ACCESSORY_MODELS` (and its slot in `SLOTS` if it's new), and its name in both locales.
5. Check it on both bodies. If it sits too high, low or small, give it a line in `ITEM_FIT`.

What the first set showed (November 2026):
- Hair `hair-curls` and `hair-bun-low` have a band of hair under the chin in the model itself; new hair should stop at the jaw line.
- The navy model in the helmets folder is a baseball cap: it's the Navy cap.
- One file in the glasses folder was the first female hair again; it isn't used.
