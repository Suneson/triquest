# Rooms as 3D models (a preview)

The rooms are painted pictures today. This trial shows one as a 3D model instead: the 16 × 16 locker room at level 10 (`LOCKER_LVL10.glb`, from Meshy).

- **Seeing it:** open the app with `?room3d=1` in the address. The device remembers it until `?room3d=0`. Without it, everyone sees the painted locker room as before.
- **The picture** (`icons/Pixelart/NEW/LOCKER/model-10.webp`, 2200 × 1610) is the model rendered from the city's own camera: orthographic, at the room pictures' slope (0.489), from its front corner. Its floor's inner corners were found on the model itself, by casting rays straight down (`ROOM_GEOMETRY['locker-3d']` in `js/core/placement.js`). So the floor grid and the items stand on it as on the painted rooms.
- **It's a still**, not live 3D: one picture per room level, made once. A live model would cost the phone a second WebGL scene for little gain, since the room doesn't move.
- **Next:** if this looks right, the other rooms' models are rendered the same way, one picture per level.
