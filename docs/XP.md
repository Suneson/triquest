# How XP works

Everyone on the leaderboard earned their XP one of two ways. Both are honest;
they're just checked differently. The same rules run in the app
(`js/core/xp-rules.js`) and on the server (`supabase/migrations/0013_gym_integrity.sql`),
so your Profile and the leaderboard always agree.

## The two paths

### 1. Verified by Strava ✓

A session linked to a Strava activity earns its XP, in any sport, plus a
**10% bonus** for being verified. It shows a ✓ on the session card, in the
calendar, and in the session's detail ("Verified by Strava: +10% XP").

### 2. Logged in the app (gym only)

A gym session you log set by set in the app earns XP without Strava, as long
as the log looks like a real session:

| Rule | Why |
| --- | --- |
| At least **3 working sets** ticked (warm-ups don't count) | A session, not a tap |
| Every ticked set has a time | The logger stamps each tick; a log without them wasn't done in the logger |
| The ticks span at least **5 minutes**, and at least **20 seconds per set** after the first | Twelve sets ticked in a minute isn't training |
| The ticks span at most **4 hours** | Sets spread across a day aren't one session |
| The session counts for **the minutes the log supports**: the span of your ticks plus 20 minutes (warm-up, the last set, cool-down), at most the duration you entered and at most 180 | Editing the duration up doesn't buy XP the log doesn't show |
| Shorter than **10 minutes** counts for nothing | |
| Gym XP logged in the app is capped at **150 a day** | One honest long session fits; farming doesn't |

When a session doesn't count, the app says why, right where you finish it and
on the session itself ("Not counted: the sets were ticked too fast to be one
session"). It's never silently zeroed. A quest that depends on a session that
didn't count is refused by the server with the same reason.

Everything else (a run or a ride marked done without Strava) earns no XP. It
still shows on your calendar.

## On the leaderboard

Next to each athlete, **✓ 82%** is the share of their session XP that Strava
verified. Quest XP isn't part of that share. An athlete who only lifts in the
app shows no ✓, and that's fine: their XP passed the rules above.

## Gear doesn't count on Ranks

GEAR (the workshop, `docs/GEAR.md`) lets you buy equipment and gels with
coins earned by training. Gear adds a small permanent boost to its
discipline, up to +16%. A gel adds +30% to sessions inside its 4-hour
window. Those boosts count for **your own** discipline levels, your account
level and your scene art. **They never count on Ranks.** The leaderboard is
base session XP plus quest XP, the same number for everyone, exactly as
above.

So XP you see on your own sessions is written with both numbers, e.g.
**+320 XP (240 base · 80 gear)**. Anywhere your number sits next to another
athlete's, it's the base number, labelled as base.

A session's boost is worked out once, by the server, from the gear you owned
and the gel that was running when you did the session. It's stored with the
session, so buying wheels today never inflates last March.

## The gym check-in (optional)

If you turn it on (Settings → Gym check-in), finishing a gym session checks
whether you're at the gym you saved and puts a pin on the session when you
are.

- It's **off** unless you turn it on, and the screen that turns it on says all of this.
- Only a **yes** is stored with the session (`gymCheckin: true`). Never a coordinate.
- Your gym's position is saved **on that phone only**. It isn't synced or sent anywhere. Turning the check-in off forgets it.
- It **doesn't change XP**: a phone can be anywhere, so the pin is a courtesy signal, not proof.

## What didn't change

- Gym sessions dated before **16 October 2026** keep the old rule (logged in the app = counts), so nobody lost XP they already had.
- The per-minute XP formula is the same: minutes × sport factor × intensity factor, plus 1.5 per km.
- A watch integration would join Strava as a second kind of proof, with the same ✓ and bonus.
