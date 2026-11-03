# Markets

Four small shops stand round the MOSKE tower's lobby, two on each side. Everyone has all four, dark, until they buy them. A bought market makes MOSKE coins on its own, and a coin bubble over it says there's something to collect. It works like the collectors round a base in a builder game.

| | |
| --- | --- |
| Level | Price | Makes | Holds | Model |
| --- | --- | --- | --- | --- |
| Not bought | | | | `market-locked.glb`, grey |
| 1 | 400 coins (buy) | 2 coins an hour | 24 (full in 12 h) | `market-1.glb`, blue |
| 2 | 600 coins (upgrade) | 3 coins an hour | 36 (full in 12 h) | `market-2.glb`, gold |

Each market is bought and upgraded on its own. At level 2 the info window says "Max level".

The numbers live in `js/core/markets.js` (`MARKET_RULES`) and in `market_rules()` in `supabase/migrations/0028_markets.sql`. `tests/markets-sql.test.js` fails if the two disagree.

## On the server (`0028_markets.sql`)

- **`user_markets`**: the markets you've bought. Each row has its slot (1 to 4), level, what it cost, when it was bought, and `collected_at`, the clock it makes coins from.
- **`market_collects`**: every collection, with the coins it paid.
- **`buy_market(slot)`**: charges the price if you have it (`gear:insufficient`, `gear:owned`, `gear:unknown_market`).
- **`upgrade_market(slot)`**: up a level for that level's price (`gear:market_max` at the top). The coins already made stay, and it makes them at the new rate from then on.
- **`market_upgrades`**: every upgrade, with its level and price.
- **`collect_market(slot)`**: takes what's waiting into the wallet, as much as there's room for (`gear:market_empty`, `gear:wallet_full`, `gear:not_owned`).
  - A full market starts again from now. Otherwise its clock moves on only by the coins taken, so a part-made coin isn't lost, and what didn't fit in the wallet stays in the market.
  - Like the collectors it copies, a full market stops making more until it's emptied.
- **`wallet_fold()`**: as in 0027, plus three kinds of event. A market bought is rank 7 (paid out), a collection rank 8 (paid in) and an upgrade rank 9 (paid out). `js/core/wallet.js` folds them the same way for the offline wallet.

## In the app

- **The 3D markets** (`city3d.js` `MARKETS`) stand where the picture's painted kiosks were.
  - The kiosks were painted out of the city picture with Gemini: bare wall and pavement (`market-left.webp`, `market-right.webp` in `tools/compose-city.py` `PATCHES`).
  - One model per level (see the table), compressed with gltf-transform (WebP textures at 512 px, meshopt) to about 110 KB each. Every slot holds all three, and the one for its level shows.
  - The models stand on y = 0 with their shop front facing −X. The left pair are turned to face down-left and the right pair down-right. Each stands on a soft shadow.
- **Tapping a market** (`market-view.js`) bounces it and brings up a bar over the dock: "Market (Level 1)" over square beige buttons.
  - Info is always there.
  - A bought market has Collect, with the coins waiting, and Upgrade (with its price) while there's a level above.
  - One not bought yet has Buy, with its price on a navy tag.
- **The coin bubble** over a bought market shows once it has a coin waiting. It glows when the market is full. Tapping it collects, and the coins fly up to the coin gauge.
- **The info window** is laid out like a builder game's: a navy header with the name and level and a full level bar, the picture for its level (`icons/City/market/market-0|1|2.webp`, rendered from the models) in a baby-blue frame, then production rate, capacity and time till full (or the price). At its foot: what the next level makes and a green Upgrade button with its price, or "Max level".
- **Before 0028 is live**, the markets stand dark and Buy is greyed out.
- **Demo mode** has the near right market bought, with coins waiting.
