# The stadium race (PVE)

The stadium on the island opens a race against a boss (BUILD-PLAN.md sections 2 and 12).

## For testing: non-stop 72 hour races

- Each race has a 10-hour warm-up first, then runs 72 hours: 82 hours a race, back to back, counted from `EPOCH` in `js/core/stadium.js`. Everyone sees the same race; no server is needed.
- In the warm-up the boss stands on the start line facing you and goes through his `warmup` clips (Blomvelt: arm stretch, laugh, two dances), the clock counts down to the start, and the island shows a note once a race ("warming up, the race starts in …") with a Watch button.
- Blomvelt has his own skeleton and clips, made on him in Mixamo (`Characters/Clips/Bosses/blomvelt/`): `boss-blomvelt-clips.glb`. Mixamo saved his skeleton at about half size; the build scales it up to the male's.
- The boss runs his distance evenly over the 72 hours (200 km for a full squad of 12; `BOSS_KM` for 3, 6 and 9) and once round the 400 m track, so he crosses the finish line as the clock hits zero. Then a new race starts.
- The screen (`js/app/stadium-view.js`): the bar at the top (the HUD gauge) fills with his km, the clock is on the infield, his km is over his head.
- The first time you open a race, he talks you through it: five lines, a pose each (`INTRO_POSES`: wave, taunt1, idle, taunt2, victory), tap to go on. "Talk to Blomvelt" plays it again.

## The picture

`js/app/stadium3d.js` shows the stadium at a slant: `icons/Stadium/stadium.webp`, cut from the green-screen render `MOSKE APP/Rooms/Stadium/Run track-upscale-2x.jpg` by `tools/cut-stadium.py`, which also measures the track (`PIC` in stadium3d.js; redo it if the picture changes). The picture is laid flat on the ground, stretched down by 1/sin(tilt), and the orthographic camera looks down at that same tilt (about 35°), so it sees the picture exactly as painted and a point on the track is a point on the ground.
- **Two lanes.** The boss runs in the inner one, anticlockwise from the finish line at the right-hand end of the near straight. The robot is in the outer one.
- **Big runners:** a runner is about four lanes tall (`RUNNER_PX`), so they read clearly on a phone.
- **The view** is zoomed in (the picture about 85% of the stage high), follows the boss, and can be dragged sideways; it goes back to following him 5 seconds after you let go.
- The clock sits at the foot of the stage, and each runner has a tag over its head.

## The clan robot

`GLB Assets/Robot/robot-lvl-<n>.glb` (10 levels) and the Mixamo clips made on level 1 (`Clips/ClubRobot/`: arm stretch, breathing idle, running, sad idle, victory) → `tools/build-characters.mjs robot` → `models/chars/robot-<n>.glb` and `robot-clips.glb`.
- In the warm-up it stands behind the start line next to the boss, stretching and idling (`ROBOT.warmup` in js/core/stadium.js).
- Until the server counts each clan's km, it waits there at 0 km while the boss runs (`ROBOT.waiting`: idle, sad). It shows level 1 until clans have XP.
- The first race with it: the warm-up began at `EPOCH` (13 November 2026, 01:30 UTC), so the race starts at 11:30 UTC.

## The boss

`GLB Assets/Bosses/<name>.glb` → `tools/build-characters.mjs bosses` → `models/chars/boss-<name>.glb`, bound to the male skeleton, so `male-clips.glb` drives it (run, wave, taunts, victory).

## Next: the robot moves

Each clan races with its robot, moved by the km its members log. It has 10 levels from clan XP (`ROBOT_XP`, `robotLevel`), and clan XP comes from clan PVP (Clan Games) and this race (`raceXp`). The robot's art: `MOSKE APP/PromptQueue Prompts/clan-robot-levels.csv`. Needs the server: each clan's km since the race started, queueing in squads of 3, 6, 9 or 12, one attempt per race, the world ranking.
