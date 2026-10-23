# Challenges and stakes

Status: **Phase 0 signed off (2026-10-22) with the changes in §12. Phases 4–6 built (2026-10-23): the engine
(`js/core/challenges.js`), the SQL (`0019_challenges.sql`, live since 2026-10-23, settled hourly by `0020_challenges_cron.sql`) and the screens
(`challenges-view.js`).** Every number lives in
one constants block (`CHALLENGE_RULES` in `js/core/challenges.js`), and the SQL copy is
generated from it.

## 0. The lines that never move

1. **Coins and carbs are never bought with money and never cashed out.**
   - No top-ups, no conversion, no gifting, no transfers.
   - Coins move only as a stake into a challenge pot and as a payout out of it.
   - Stakes are **coins only**. Carbs stay out of challenges entirely; they buy fuel, and fuel shouldn't be something you win from a friend.
2. **Ranks stays on base XP.** `public.leaderboard` isn't touched, and a payout is coins, never XP.
3. **Only Strava-verified sessions decide a result.**
   - No manual Strava entries.
   - No app-logged session in any challenge.
   - No session on a planned rest day.
4. **The server decides.** Resolution and escrow run in Postgres against stored workouts. The client shows the same numbers live, and a JS/SQL fixture test keeps the two equal.
5. **Health first.**
   - A window is 1 day to 4 weeks, never longer.
   - Every volume type has a ceiling (§2).
   - Rest-day sessions never count.
   - The daily coin cap and the rest-day mission stay exactly as they are.

---

## 1. Challenge types

| Kind | Sports | Wins | Counts |
| --- | --- | --- | --- |
| `distance` | run, bike, swim | Most distance in the window | Strava distance per session, with per-day and per-week ceilings (§2) |
| `xp` | any (or one sport) | Most **base** XP in the window | `xpLedger` base XP only. Gear and gels never count, or the shop would buy wins |
| `sessions` | any (or one sport) | Most sessions | At most **one session per day**, so a two-a-day doesn't count twice |
| `fastest` | run 5 km / 10 km / half; bike 20 km / 40 km; swim 1 km | Fastest single effort over the set distance | Run: Strava best effort over that distance. Bike and swim: whole-activity moving average, labelled "whole activity", over an activity at least that long |
| `longest` | run, bike, swim | Longest single session by moving time | **Capped at a target the creator sets** (run ≤ 3 h, bike ≤ 6 h, swim ≤ 2 h). Everyone who reaches the target ties at the top |
| `climb` | bike, run | Most climbing | Per-day ceiling of 2,500 m (bike) or 1,500 m (run) |
| `segment` | run, bike | Fastest time on one Strava segment the creator picks | The best effort on that segment in the window, read from the activity's `segment_efforts` (lower wins) |

**Gym is never in a challenge.** Strava doesn't carry lifts, and an app log
isn't proof enough to take someone's coins.

### Segment challenges (no AI needed)

Strava already does the matching. When an activity crosses a segment, the
detailed activity lists a `segment_effort` with that segment's id and the
elapsed time. Phase 1 stores those (id and seconds, for every segment the
activity crossed). A segment challenge is then just this: the lowest time on
segment `N` among the participants' activities in the window.

- The creator pastes a Strava segment link (`strava.com/segments/123456`) or picks from segments they've ridden or run lately.
- The card shows the segment's name, length and grade.
- It ranks 3 to 5 people automatically, with nothing to judge.
- An AI looking at the uploaded activity would only be guessing at what Strava already knows exactly.

### Suggested and custom

Posting a challenge starts from **suggestions**, one tap each, and **Custom**
opens the full form. The suggestions:

| Suggestion | Kind | Window |
| --- | --- | --- |
| Weekend long ride | `longest` bike, target 3 h | Sat–Sun |
| Fastest 5 km | `fastest` run 5 km | 7 days |
| Kilometre week | `distance` run (or bike, swim) | Mon–Sun |
| Most consistent | `sessions`, any sport | 14 days |
| XP sprint | `xp`, any sport | 7 days |
| Climb of the month | `climb` bike | 28 days |
| King of the segment | `segment`, the creator's pick | 7 days |

**The custom form** asks for:
- The kind and the sport.
- The distance or target, where the kind needs one.
- The window: a start date and 1–28 days.
- The stake: 0 to the cap.
- The payout (§4b).
- Who can join: the room, or chosen friends.

Everything the form accepts is inside the rules above, so freedom never
reaches past a ceiling or a cap. The preview reads the rule back in plain
words: "most running kilometres between Monday 3 and Sunday 9 November,
Strava only, top 3 paid 50/30/20".

**Window:** 1 to 28 days, starting at least an hour after the challenge is
created and at most 14 days ahead. Joining closes when the window starts, so nobody joins
knowing the result. Results use each session's local date, as the rest of the app does.

**Sanity bounds are the feat bounds** (docs/FEATS.md §3). A session that a feat
would reject doesn't count in a challenge either. A treadmill run, an indoor ride or
an e-bike never counts for `distance`, `fastest`, `longest` or `climb`. It does count for
`xp` and `sessions`, because the XP rules already accept it.

## 2. Ceilings: why "most distance" can't become "most damage"

A distance or climbing challenge is the one place where more is always better, so
each person's counted volume is capped three ways:

1. **Per day:**
   - Run 25 km.
   - Bike 150 km.
   - Swim 5 km.
   - Climbing: 2,500 m on the bike, 1,500 m running.
2. **Per week:**
   - Each person's counted volume in a sport is capped at **1.3 × their own weekly average over the 4 weeks before the window**, with a floor so a beginner isn't stuck at zero:
     - Run 20 km.
     - Bike 100 km.
     - Swim 4 km.
     - Climbing 1,500 m.
   - 1.3 is the usual "don't build more than 30% a week" guard.
   - This turns a distance challenge into "who **uses** their training best", not "who can double their week".
3. **The window:** at most 4 weeks.

The standings show each person's **counted** total, and when the ceiling cut
something, a small "ceiling reached" mark. You can see why a monster week didn't
pull away.

## 3. Lifecycle

`draft → open → running → resolving → settled`, or `cancelled`.

| State | What happens |
| --- | --- |
| `draft` | Being written; only the creator sees it |
| `open` | Visible (in the room if posted, or to the invited person). People join, and stakes go into escrow |
| `running` | The window has started; joining is closed. Standings update from sessions as they sync |
| `resolving` | The window has ended. There's a **48-hour grace** for late Strava syncs, then `resolve_challenge()` runs |
| `settled` | The result row is written and payouts are made. Nothing changes after this |
| `cancelled` | The creator cancelled before the window started, or it started with fewer than 2 participants. **Every stake is refunded in full** |

**Before anyone joins, the join sheet says, in plain words:**
- "No Strava session in the window means you lose your stake to the pot."
- How the pot is paid ("winner takes all", or "1st 50% · 2nd 30% · 3rd 20%"), and that ties share.
- "5% of the pot is the track fee and disappears."
- "This counts only sessions verified by Strava, not on a rest day."

## 4. Resolution rule per type

Every participant gets one number (their **score**). Higher wins, except `fastest`,
where lower wins. A participant with no qualifying session has no score; they're a
**no-show**.

| Kind | Score |
| --- | --- |
| `distance` | Sum of the session distances inside the window, after the day and week ceilings |
| `xp` | Sum of `xpLedger` base XP for qualifying sessions |
| `sessions` | Number of days with at least one qualifying session |
| `fastest` | Best time over the distance, in seconds (lower wins) |
| `longest` | Longest moving time, capped at the target |
| `climb` | Sum of elevation gain, after the ceilings |

**Places go by score.**
- No-shows take the last places.
- **Ties** share the places they cover (§4b).
- Scores are compared to the unit the app shows (10 m, 1 XP, 1 second), so a 3 m difference in GPS isn't a "win".

The result row (`challenge_results`) stores:
- Each participant's score.
- The sessions that made it, and what each ceiling cut.
- The rule text that applied.
- The pot, the fee and each payout.

That's the audit trail.

## 4b. Payouts

The creator picks how the prize is paid. Up to **5 people** can join a challenge.

| Payout | Split of the prize |
| --- | --- |
| `winner` (default) | 1st 100% |
| `top2` | 1st 65% · 2nd 35% |
| `top3` | 1st 50% · 2nd 30% · 3rd 20% |

Places below the paid ones (4th and 5th in a `top3`) get nothing.

**Ties share the places they cover.** Two people tied for 1st in a `top3`
cover 1st and 2nd, so each gets (50 + 30) ÷ 2 = 40%, and the next person is
3rd with 20%.

**Fewer people with a session than paid places:** the paid places that are
left empty fold into the ones that are filled, in the same proportions. For
example, with `top3` and only two people with a session, 50 : 30 becomes
62.5% : 37.5%. A paid place never goes to a no-show.

**A paid place must have a session.** That's why a `top3` with three people
where one no-shows pays like a `top2`.

## 5. Escrow

### The ledger

Balances stay derived, as in GEAR. One new table holds every coin move:

```
coin_moves (id, user_id, challenge_id, kind, coins, created_at)
  kind = 'stake'  (coins < 0) — joining
       | 'refund' (coins > 0) — cancelled, or everybody no-showed
       | 'payout' (coins > 0) — settlement
```

- `walletFold()` and `wallet_fold()` take these in time order with everything else.
- A stake is a spend.
- A payout or refund is an earning, so **the 10,000 storage cap applies**. The join sheet warns when a win would overflow your store.
- Joining and settling are each **one transaction**, under the same advisory lock `buy_gear()` takes, so a balance can never go below zero and nothing is ever borrowed.

### The pot

```
pot      = sum of stakes
fee      = floor(pot × 5%)           ← burned: a coin sink, and the reason trading wins loses coins
prize    = pot − fee
payout   = floor(prize × that person's share)   (§4b)
leftover = prize − sum of payouts               ← burned with the fee (at most a few coins)
```

### Worked through: three people, 100 coins each, pot 300, fee 15, prize 285

Winner takes all:

| Case | Ana | Ben | Caro | Burned |
| --- | --- | --- | --- | --- |
| Ana wins | +285 (net **+185**) | 0 (net −100) | 0 (net −100) | 15 |
| Ana and Ben tie | +142 (net **+42**) | +142 (net **+42**) | 0 (net −100) | 15 + 1 left over |
| Caro no-shows, Ana wins | +285 (net +185) | 0 (net −100) | 0 (net −100) | 15 |
| Ana is the only one with a session | +285 (net +185) | 0 (−100) | 0 (−100) | 15 |
| Nobody has a session | +100 refund | +100 refund | +100 refund | 0. Void: there's no winner to give a pot to |
| Fewer than 2 joined by the start | refund | — | — | 0. Cancelled |

### Worked through: five people, 60 each, pot 300, fee 15, prize 285, `top3`

| Case | 1st | 2nd | 3rd | 4th | 5th | Burned |
| --- | --- | --- | --- | --- | --- | --- |
| Clear places | 142 (50%) | 85 (30%) | 57 (20%) | 0 | 0 | 15 + 1 |
| Two tied for 1st | 114 each (40% each) | — | 57 | 0 | 0 | 15 |
| Only two have a session | 178 (62.5%) | 106 (37.5%) | — | — | — | 15 + 1 |

Nets in the clear case: +82, +25, −3, −60, −60.
**Free challenges** (stake 0) run the same way with no pot. Bragging rights,
and a trophy on the board if a feat falls inside them.

## 6. Caps and guards

| Constant | Value | Why |
| --- | --- | --- |
| `maxStake` | **150 coins** | About half a week's coins at 5 h; under a third at 12 h |
| `maxStakeShare` | **20%** of your balance when you join | Nobody empties their wallet on one challenge |
| `weeklyStakeCap` | **300 coins** staked in any rolling 7 days | About a week's coins at 5 h. Stops chasing losses |
| `minAccountDays` | **14 days** since sign-up | A fresh account can't stake |
| `minVerified` | **6 Strava-verified sessions in the last 30 days** | Proves a real, training account (and costs an alt real training) |
| `pairCooldown` | The same two people in a **staked one-on-one**: at most 1 per 7 days, at most 3 per 30 days | The specific control against two accounts trading wins |
| `maxParticipants` | **5** | A room challenge stays readable, and every place on the card can be shown |
| `maxOpenCreated` | 2 open or running challenges you created | |
| `maxWindowDays` | 28 | Health rule 5 |
| `fee` | 5% of the pot, burned | A coin sink; it also makes trading wins cost both sides |
| No floor below zero | A stake that would take your balance below zero is refused; there is no credit | Hard rule |

A **free** challenge only needs `minVerified`. Account age, the stake caps and the pair
cooldown apply only when coins are at stake.

## 7. Collusion: the attacks and the controls

| Attack | How it would work | Control |
| --- | --- | --- |
| **Win trading** between two friends | They take turns winning to look active, or to push coins to one side | <ul><li>The 5% fee: every round trip loses 5% for nothing.</li><li>The pair cooldown: one staked one-on-one a week, three a month.</li><li>The admin flag (§8).</li></ul> |
| **Funnelling from an alt** | A second account joins and no-shows, so its stake goes to the main account | <ul><li>The alt needs 14 days and 6 Strava sessions a month, which means real training on a second Strava account.</li><li>One Strava athlete per app account (a unique index on `strava_accounts.athlete_id`).</li><li>The pair cooldown caps the flow at about **135 coins a week** per pair (a 150 stake each: the main account nets 285 − 150).</li><li>The repeated no-show flag.</li></ul> |
| **Selling coins for money outside the app** ("pay me €5 and I'll no-show") | A real-money trade dressed as a challenge | <ul><li>Coins only buy cosmetics and boosts to your own levels, never Ranks, so there is little to buy.</li><li>The flow caps above.</li><li>The admin flag.</li><li>Terms say it's not allowed. That's as far as code can go.</li></ul> |
| **Joining when the result is known** | Join after seeing the standings | Joining closes when the window starts. Nobody can join a running challenge |
| **Faking the data** | A hand-typed Strava activity, a ride on a motorbike, a treadmill typed up to 20 km/h, one activity on two accounts | <ul><li>Manual activities are refused.</li><li>The feat sanity bounds apply.</li><li>Machines are refused for distance, speed and climbing.</li><li>One Strava athlete per account.</li><li>Overlapping activities count once.</li></ul> |
| **Editing after the fact** | Change a Strava activity after the window ends | Sessions are read once, at resolution after the 48 h grace, and the sessions used are written into the result. Later edits change nothing |
| **Rest-day farming** | Train on a planned rest day to pull ahead | Rest-day sessions don't count. The stamp is fixed when the session first earns, so deleting the plan afterwards changes nothing |
| **Volume spike** | One huge week to win a distance challenge | The day and week ceilings (§2) |
| **Spamming the room** | A wall of bets | Room limits (§10) |
| **Social pressure** | A friend keeps challenging you | Declining is free and silent. Direct challenges can be switched off (§9) |

## 8. The admin view (no automatic punishment)

A view for app admins (`is_app_admin()`), `challenge_pair_flags`. It shows one row
per pair of people who've been in staked challenges together in the last 90 days,
with:

- **How often they met:** number of staked challenges together, and how many were one-on-one.
- **Who came out ahead:** net coins from A to B, and A's win share.
- **No-shows:** how many times each of them no-showed against the other.
- **Flagged when:**
  - one side won ≥ 80% of at least 4 one-on-ones; or
  - the net flow is ≥ 300 coins; or
  - one side no-showed ≥ 2 times against the same person.

**What I'd do with a flag:**
1. Look at the sessions in the result rows. They usually explain themselves: one is simply faster.
2. If it looks like trading, message both.
3. If it carries on, the lever is to **turn staking off for that account**: a `stake_blocked` flag the join RPC checks. Free challenges stay open to them.
4. Never claw back coins automatically. A false positive taking someone's coins is worse than a few coins moving.

The full log is `coin_moves` plus `challenge_results`: who staked, who was paid,
by which rule, and which sessions decided it.

## 9. Refusing

- **A direct challenge (one person to another) is an invitation.**
  - **Decline** is one tap and costs nothing.
  - The sender sees "declined", never a reason.
  - An invitation left unanswered when the window starts simply lapses.
- **Settings → Challenges → "Let friends challenge me directly"** is on by default and can be switched off. When it's off:
  - Nobody can send you a direct challenge.
  - You can still join open ones in the room.
  - The sender's button tells them you aren't taking direct challenges.
- **Nobody is ever auto-joined.** Staking needs a second confirmation on the join sheet, with the stake and the forfeit rule written out.

## 10. In general chat

- **A challenge card is a real message row** with `kind = 'challenge'` and a `challenge_id`, created only by `post_challenge()`.
  - The text is drawn from the challenge row, so typing can't fake a card.
  - Clients render the card from the challenge's live state.
- **The card updates in place:** joins, then the standings, then the result and payouts. It reads realtime changes on `challenges` and `challenge_participants`.
- **Limits:**
  - At most **3 challenge cards per person per day** in the room.
  - At most **2 of your challenges open** at once.
  - At most **6 open cards in the room** overall. When it's full, posting says so.
- **A settled challenge that produced a feat** posts the trophy card under it.

## 11. Numbers in context

From the month model in docs/FEATS.md §6 (five hours a week earns about 920 coins a month,
twelve hours about 2,150):

- **At the maximum:** a 5 h athlete staking 150 every week (they'd hit the 20% share
  first unless their balance is ≥ 750) puts about 600 a month at risk, about 65% of what they earn.
  - Even losing every challenge, their balance still grows, slowly.
  - A **typical** month of two challenges at 50 stays a side game.
- **The 12 h athlete** hits the weekly cap of 300 long before their balance matters. Their money can't buy them the room.
- **Neither gets more for training more inside a challenge** than the week ceiling (1.3 × their own average) allows.

## 12. Decided at sign-off (2026-10-22)

1. **Track fee: 5%**, burned.
2. **Stake caps as proposed:** 150 per challenge, 20% of balance, 300 a week, the pair cooldown.
3. **No-shows forfeit to the pot.** The caps hold the alt funnel to about 135 coins a week per pair, and the admin flag watches for it.
4. **Payouts respect the 10,000 storage cap.** The join sheet warns when a win would overflow.
5. **Up to 5 people** per challenge, with a choice of payouts (§4b).
6. **Suggested challenges plus a custom form** (§1), and a **segment** kind that ranks by Strava's own segment times.
7. **Gym is not in challenges.** Gym strength feats stay, as "logged" and with the gym check-in required (docs/FEATS.md §5).
8. **Manual Strava activities** stop earning XP from the day 0018 goes live (docs/FEATS.md §7).
