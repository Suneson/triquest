# Reward chests

Branch `feature/strava-reward-chests`.

When a session finishes (synced from Strava, or logged in the app), it leaves
a chest. A banner slides down to say so. The chest then waits on Home until
you open it. Opening plays the chest's clip and sound. Then the session's coins
and carbs rise out of it, one tap at a time, with the chest's bonus next to
each.

## The rules (`js/core/rewards.js`, mirrored by `0027_reward_chests.sql`)

**Who gets a chest.** A session that earns XP (the XP rule: verified, not
hand-typed), dated on or after `CHEST_RULES.since` (30 Oct 2026), at least 20
minutes long. At most 3 chests a day. Older history leaves none, so the launch
doesn't flood anyone.

**Difficulty bracket.** This comes from what was measured: Strava's moving time
(else the logged minutes), distance and sport.

| Bracket | When |
| --- | --- |
| Easy | under 45 min, or any mobility session |
| Moderate | 45–89 min |
| Hard | 90–149 min |
| Brutal | 150 min or more; or a century ride (100 km), a half marathon (21 km), a 3.8 km swim, a brick of 90 min or more; or a race of an hour or more |

The plan's intensity label (threshold, quality, VO₂) moves a session up one
bracket at most, and never to Brutal. A label is typed by the user, so it can't
turn a short session into a top-odds one.

FTP and max heart rate are not used. Both are self-declared, so lowering them
would farm rarer chests.

**The tier** is rolled once, by the server, with `random()`, when the chest is
made:

| Bracket | Common | Uncommon | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- | --- |
| Easy | 82% | 15% | 2.9% | 0.09% | 0.01% | 0% |
| Moderate | 68% | 24% | 7.4% | 0.55% | 0.05% | 0.005% |
| Hard | 48% | 36% | 13% | 2.8% | 0.19% | 0.01% |
| Brutal | 32% | 42% | 19% | 6.5% | 0.45% | 0.05% |

**Epic is switched off** (`CHEST_RULES.enabled.epic`) until its clip exists. A
switched-off tier passes its share to the enabled tier below it, so Epic's share
rolls as Rare. Legendary and Mythic stay exactly as rare as the table says.

To switch Epic on:
1. Add `Epic.webm`, `Epic.mp3` and the still.
2. Set `enabled.epic: true`.
3. Run `node tools/chests-sql.mjs`.
4. Apply the new rules block.

A chest is made once per session and once per Strava activity, so deleting and
re-importing an activity doesn't roll again.

**The bonus.** Opening pays the tier's flat amount plus a share of the
session's own coins and carbs:

| Tier | Coins | Carbs | + share of the session |
| --- | --- | --- | --- |
| Common | 10 | 15 g | 10% |
| Uncommon | 25 | 40 g | 20% |
| Rare | 60 | 90 g | 35% |
| Epic | 120 | 180 g | 50% |
| Legendary | 250 | 400 g | 75% |
| Mythic | 600 | 900 g | 100% |

The session's own coins and carbs were already paid when it synced (wallet.js).
The chest shows them as the total, with its bonus beside it. Only the bonus is
new money, and it enters `wallet_fold()` as rank 6 from the moment the chest is
opened. An unopened chest is worth nothing yet.

## The server (`supabase/migrations/0027_reward_chests.sql`)

- `reward_chests`: one row per chest. You can read your own; only the functions
  below write.
- `my_chests()`: makes the chests your sessions have earned and don't have yet,
  then lists them. It returns `{ admin, chests }`. The app calls it on sign-in,
  after a Strava sync, and when the app comes back to the front (at most once a
  minute).
- `open_chest(id)`: stamps `opened_at`. Opening twice pays once.
- `admin_gift_chest(tier)`: only for `app_admins` (0012), and only switched-on
  tiers. It gives you a real chest that pays its flat bonus.
- `tests/rewards-sql.test.js` checks that the SQL and JS agree on every bracket,
  every roll (a fine grid of random numbers) and every bonus. It also checks
  the grant, open and wallet path, and the admin gate.

## The art (`icons/AnimatedRewards/`)

| Tier | Clip and sound | Container |
| --- | --- | --- |
| Common | `WEBM/Common.webm`, `mp3/Common.mp3` | Kit bag |
| Uncommon | `Uncommon.*` | Cool box |
| Rare | `Rare.*` | Trail pack |
| Legendary | `Legendary.*` | Gold chest |
| Mythic | `Mythic.*` | Carbon vault |

- **Clips:** 940 × 940, 3–5 s, VP9 with transparency. They are the source and
  are never re-encoded.
- **Stills:** `still/<Tier>.webp` (512 px, same framing as the clip) is what the
  chest rests on when its clip ends. It also appears on Home and in the banner.
  - Today they come from each clip's last frame: `node tools/reward-stills.mjs`
    with the dev server running.
  - When the painted JPG stills are in `JPG/`, `python3 tools/cut-reward-stills.py`
    keys them instead. It reads the screen colour (green, or pink `#FF017E`) from
    the image's border.
- **iPhone:** Safari, so every browser on iPhone, plays WebM but ignores its
  transparency. On Safari the chest's still drops in and shakes to the same
  sound, with no clip. For the clip on iPhone too, the clips would also need
  exporting as HEVC with alpha (`.mov`).
- **Service worker:** media files and range requests skip it (`sw.js`). Clips
  stream straight from the server and are never cached in full.

## On screen (`js/app/chests-state.js`, `js/app/chest-view.js`, `css/chests.css`)

- **Banner:** a bottle-green pill with a beige rim and a pulsing gold dot.
  - It shows once per chest per device. Tapping it opens the chest.
  - Dismissed or ignored (it folds away after 12 s), the chest stays on Home.
- **Home card:** a blue card under today's session, with the waiting chest
  bobbing and a red count when more than one is waiting.
  - It reads "Your last session rewards are ready". Tapping it opens the
    waiting chests one after another, newest first.
- **The opening:**
  1. The tier's name and container drop in, and the clip plays with its sound.
     Sound follows Settings → Sound.
  2. The chest rests on its still, with a flash and slowly turning rays in its
     tier's colour: *Tap to open*.
  3. A tap: coins spray out of the chest into a card on top of it. The total
     counts up, and the gold *+bonus* chip pops in beside it. The small line
     says how much came from the session.
  4. A tap: carbs, the same. Then *Collect*, or *Next chest (n left)*.
  - *Skip* jumps to the end.
  - A gift has no session, so it shows one figure.
  - Reduced motion: no clip, no spray, no count-up.
- **Admin tools** (Settings, admins only):
  - *Play* any tier: plays it, pays nothing.
  - *Gift* yourself a real one.
  - *Simulate a finished workout*: shows the banner for a made-up hard session.
- **Demo** (`?demo=1`): two waiting chests (a Legendary from a long run, a Rare
  from a ride) that open on the device.
