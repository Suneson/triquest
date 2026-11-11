# Your athlete walking the base

Your athlete (the wardrobe character) lives in one room of your base and walks its floor, tile to tile, diagonals too.

Code:
- `js/core/walk.js`: the floor grid and the paths (no DOM, tested in `tests/walk.test.js`);
- `js/app/walker.js`: the character on the floor;
- `syncAthlete` in `js/app/diorama-view.js`: where it should be.

## What it does

- **In its room:** it stands for 4 to 10 seconds, then walks to a free tile 2 to 5 steps away, and stands again.
  - It walks round items and never cuts a corner: a diagonal step needs both tiles beside it free.
  - If you set an item down on its tile, it steps off to a free one.
- **Looking at another room:** it stays where it is. Rooms don't share an athlete.
- **Starting a drill on the treadmill:**
  - If the athlete is in another room, it comes into the treadmill's room on the free tile nearest the middle of the floor.
  - It walks to the back of the belt and gets on. The treadmill then shows it running the level.
  - When the drill ends or you stop it, it steps off and wanders again.
- **The ice bath:** it walks over and stands beside the bath while you recover. Sitting in the bath comes later.
- **You're not watching (another room or tab), or the device can't draw 3D:** it's at the machine at once.
- **Reduced motion:** it stands still and goes to places at once.

Where it is is kept on this device (`localStorage['moske-athlete']`): its room, its tile, and the machine it's on.

## Next

- Walking between rooms through a door, and the elevator.
- Sitting in the ice bath, and the sauna, once their art is in.
- Tapping the athlete for a little reaction (a taunt or the victory clip).
