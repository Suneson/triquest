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

`js/app/stadium3d.js` lays the stadium flat on the ground in metres (`TRACK`) and looks down at it at 56°. The ground is `icons/Stadium/track.webp` (a straight-down picture from `tools/gen-stadium.mjs`, its grey corners painted navy; it is not to scale, so its measured lanes are in `PIC` in stadium3d.js and the boss follows them). Without it the stadium is drawn in code. The scene is in the boss's units: the stadium is shrunk round him (`K`) rather than him grown, since a skinned character keeps its own scale.

## The boss

`GLB Assets/Bosses/<name>.glb` → `tools/build-characters.mjs bosses` → `models/chars/boss-<name>.glb`, bound to the male skeleton, so `male-clips.glb` drives it (run, wave, taunts, victory).

## Next: the clan robot

Each clan races with a robot moved by the km its members log. It has 10 levels from clan XP (`ROBOT_XP`, `robotLevel`), and clan XP comes from clan PVP (Clan Games) and this race (`raceXp`). The robot's art: `MOSKE APP/PromptQueue Prompts/clan-robot-levels.csv`. Needs the server: each clan's km since the race started, queueing in squads of 3, 6, 9 or 12, one attempt per race, the world ranking.
