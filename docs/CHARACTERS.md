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
