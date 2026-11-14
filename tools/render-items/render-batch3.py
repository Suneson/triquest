"""render-batch3.py: the clan room's items and the base's new items (Tripo GLBs of 14 Nov), both facings.

    node tools/decode-glb.mjs <in.glb> <out.glb>        # Tripo's meshopt GLBs, once each, into <dec>/club, <dec>/base
    ARGS="tools/render-items/rig.py|<dec>|<out>" blender -b --python tools/render-items/render-batch3.py

Writes <out>/<set>/<name>-a.png and -b.png; sheets.py makes the repaint sheets from them. Models are
found by the start of Tripo's file id. Club names carry clan- as their references do
(Characters/Photos/Robots/Robots/Items/Clan/clan-<name>.jpg); base names match Items/item/Items/<name>.jpg.
"""
import os, math, glob
A = os.environ["ARGS"].split("|"); exec(open(A[0]).read())
DEC, OUT = A[1], A[2]
PPM = 420
# set: {name: (file id start, size in metres, along: 'z' height or 'h' longest across, yaw for facing a)}
# facing a has the item's front towards the bottom left; b is turned 90 degrees from it
ITEMS = {
    'club': {
        'clan-coffee-cart': ('1678b84e', 1.7, 'h', 90),
        'clan-bar-counter-corner': ('24402d39', 1.1, 'z', 90),
        'clan-high-table': ('2693d4ca', 1.05, 'z', 0),
        'clan-grandfather-clock': ('38efcb13', 2.1, 'z', 90),
        'clan-bookcase': ('397a645d', 2.2, 'z', 90),
        'clan-jukebox': ('5032503d', 1.6, 'z', 0),
        'clan-champagne-bucket': ('63e6ed83', 0.45, 'z', 0),
        'clan-decanters': ('71a05468', 0.4, 'z', 0),
        'clan-globe-bar': ('7cb983ae', 1.0, 'z', 0),
        'clan-coffee-table': ('8093fecc', 1.4, 'h', 0),
        'clan-bar-stool': ('8104b93f', 0.85, 'z', 0),
        'clan-leather-bench': ('821d4488', 1.7, 'h', 0),
        'clan-cake-stand': ('8a8c5941', 0.45, 'z', 90),
        'clan-espresso-machine-vintage': ('8d6a99ee', 0.55, 'z', 90),
        'clan-brass-till': ('927dd7f2', 0.45, 'z', 90),
        'clan-corner-sofa': ('9e3efea7', 2.8, 'h', 0),
        'clan-fireplace': ('a4289008', 1.8, 'h', 90),
        'clan-chess-table': ('b04db159', 0.95, 'h', 90),
        'clan-floor-lamp': ('b61c5961', 1.7, 'z', 0),
        'clan-cocktail-station': ('c07fb677', 0.5, 'z', 0),
        'clan-card-table': ('c27ed928', 1.6, 'h', 0),
        'clan-bar-counter-long': ('c2846f6c', 3.6, 'h', 0),
        'clan-chesterfield-sofa': ('c2983e6b', 2.4, 'h', 0),
        'clan-cue-rack': ('dd004635', 1.7, 'z', 0),
        'clan-arcade-cabinet': ('e30d93f3', 1.8, 'z', 90),
        'clan-beer-tap': ('e376739c', 0.55, 'z', 0),
        'clan-darts-board': ('ed029b99', 1.9, 'z', 90),
        'clan-gramophone': ('ef7056bd', 1.1, 'z', 90),
        'clan-chesterfield-armchair': ('fc1c36d1', 0.85, 'z', 90),
        'clan-back-bar-shelves': ('fd4f902d', 2.2, 'z', 0),
    },
    'base': {
        'bench-press-t1': ('0078ad13', 1.9, 'h', 90),
        'leaderboard-tv': ('00d8d728', 1.9, 'z', 0),
        'water-cooler': ('0bbfc5d8', 1.3, 'z', 90),
        'road-bike-t3': ('224284e1', 1.75, 'h', 0),
        'bench-press-t2': ('2b150f95', 1.9, 'h', 90),
        'clan-banner-t2': ('2b48668e', 2.2, 'z', 0),
        'medal-case': ('2d573af0', 1.6, 'z', 90),
        'clan-banner-t1': ('30e04650', 2.2, 'z', 0),
        'clan-banner-t3': ('48afecf4', 2.2, 'z', 0),
        'barbell': ('48c90387', 2.2, 'h', 0),
        'smoothie-bar-t3': ('4c499021', 2.0, 'h', 0),
        'lifeguard-chair': ('52fd8c63', 2.2, 'z', 90),
        'bench-press-t3': ('a636d061', 1.9, 'h', 90),
        'foam-roller-stand': ('bea974a9', 1.3, 'z', 90),
        'trophy-bronze': ('c6813f7e', 0.9, 'z', 90),
        'swim-gear-rack': ('c86e1632', 1.6, 'z', 90),
        'power-rack': ('cfd8ac91', 2.3, 'z', 0),
        'smoothie-bar-t2': ('e15aeac3', 2.0, 'h', 90),
        'bench-press-t4': ('ee626662', 1.9, 'h', 90),
        'smoothie-bar-t1': ('f316602d', 2.0, 'h', 90),
        'cable-machine': ('f52af902', 2.2, 'z', 0),
        'trophy-silver': ('fa8d1f26', 0.9, 'z', 90),
        'trophy-gold': ('fb9a6d7c', 0.9, 'z', 90),
    },
}
only = os.environ.get('ONLY')
for st, items in ITEMS.items():
    os.makedirs(f'{OUT}/{st}', exist_ok=True)
    for name, (fid, size, axis, yaw_a) in items.items():
        if only and name not in only.split(','): continue
        src = glob.glob(f'{DEC}/{st}/*{fid}*.glb')
        assert len(src) == 1, (name, src)
        for face, yaw in (('a', yaw_a), ('b', yaw_a + 90)):
            if os.path.exists(f'{OUT}/{st}/{name}-{face}.png'): continue
            reset(); root, ms = load(src[0])
            lo, hi = bounds(ms); ext = hi - lo
            s = size / (ext.z if axis == 'z' else max(ext.x, ext.y))
            root.scale = (s, s, s); bpy.context.view_layer.update()
            root.rotation_euler[2] = math.radians(yaw); ground(root, ms)
            setup(ms, px_per_unit=PPM, samples=64)
            render(f'{OUT}/{st}/{name}-{face}.png')
            print('rendered', st, name, face, flush=True)
