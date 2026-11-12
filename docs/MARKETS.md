# Markets

## The market plot (0035, from 2026-11-12)

The old markets round the lobby are no longer drawn. Markets now stand on the island's rebuilt market plot: a bare plaza with six spots, two rows of three (`js/app/island-view.js`). Tap one to open the markets' screen (`js/app/shop-view.js`, styles in `css/market.css`). The rules are in `js/core/shop.js` and the server is `supabase/migrations/0035_shop.sql` (`tests/shop-sql.test.js` keeps them in step).

- **Building and levels:** a market costs 300, 600, 1000, 1500, 2200 and then 3000 coins, the 1st to the 6th. It goes from level 1 to 8 (pictures `icons/Market/market-<level>.webp`), and each level opens a slot and holds more of each item (10 up to 50).
- **Stock:** 60 items, 15 per sport (gym, bike, run, swim, pictures `icons/Market/items/<id>.webp`). Each unlocks at a market level. You buy them wholesale into a storeroom that holds 1000 of each. Selling one puts it in a slot: a slot that already has it fills up first, otherwise you pick the slot it replaces.
- **Sales:** a slot sells one unit at a time (6 to 30 minutes, by tier). **Collect** banks the coins and **Restock all** refills every slot, from the storeroom first and the rest bought.
- **Training twists:**
  - **Demand:** a sport trained in the last 4 hours sells for 30% more.
  - **Foot traffic:** 60, 150 or 300 minutes this week (from Monday) sell 10%, 15% or 20% faster.
  - **Specialty:** every open slot (two or more) holding one sport's gear earns 10% more and shows a gold border.
  - **Wholesale crate:** one per reward chest opened, it fills a market's slots for free.
  - **VIP:** on a brick day (two sports trained), once a day, a VIP buys out your best market at 1.5×.

## The old markets (0028)

Four small shops stand round the MOSKE tower's lobby, two on each side. Everyone has all four, dark, until they buy them. A bought market makes MOSKE coins on its own, and a coin bubble over it says there's something to collect. It works like the collectors round a base in a builder game.

| Level | Price | Makes | Holds | Picture |
| --- | --- | --- | --- | --- |
| Not bought | | | | `kiosk-0-l|r.webp`: shutter down, a for-sale sign |
| 1 | 400 coins (buy) | 2 coins an hour | 24 (full in 12 h) | `kiosk-1-l|r.webp`: blue, the MOSKE logo on its sign |
| 2 | 600 coins (upgrade) | 3 coins an hour | 36 (full in 12 h) | `kiosk-2-l|r.webp`: vivid yellow, the MOSKE logo, a flower box |

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

- **The markets are painted pictures** (`icons/City/market/`, `MARKETS` in `market-view.js`), standing where the city picture's own kiosks were.
  - The kiosks were painted out of the city picture with Gemini, leaving bare wall and pavement (`market-left.webp`, `market-right.webp` in `tools/compose-city.py` `PATCHES`).
  - Six pictures, one per level and facing, generated on green and keyed. The left pair (`-l`) face down-left, along the lobby's left wall; the right pair (`-r`) face down-right, along its right wall.
  - Each stands by its foot (its front corner, the picture's lowest point) on the ground where its kiosk's corner was.
  - 3D models were tried first and dropped: real-time light and blob shadows made them look pasted on next to the painted city.
- **Trees and lamp posts** (`prop-0..8.webp`, `DRESSING` in `market-view.js`) are the city picture's own painted ones. They were cut out of the original render, before the kiosks were painted out, and are stored at 2x with their exact box in px of the city picture. So they stand exactly where they were, three on the left and four on the right. The two lamp posts in front of the left markets (`prop-2`, `prop-4`) were dropped: they came out pale and stood up out of the new markets' bases. The two left trees (`prop-0`, `prop-1`) are mirrored about their trunks, because the cut left a seam and a piece of the old kiosk wall in them. They're drawn in depth order with the markets by their foot, so the nearer ones stand in front.
- **Tapping a market** (`market-view.js`) makes it grow and spring back from its foot, and brings up a bar over the dock: "Market (Level 1)" over square beige buttons.
  - Info is always there.
  - A bought market has Collect, with the coins waiting, and Upgrade (with its price) while there's a level above.
  - One not bought yet has Buy, with its price on a navy tag.
- **The coin bubble** over a bought market shows once it has a coin waiting. It glows when the market is full. Tapping it collects, and the coins fly up to the coin gauge.
- **The info window** is laid out like a builder game's: a navy header with the name and level and a full level bar, the picture for its level and facing (`kiosk-<level>-<l|r>.webp`) in a baby-blue frame, then production rate, capacity and time till full (or the price). At its foot: what the next level makes and a green Upgrade button with its price, or "Max level".
- **Before 0028 is live**, the markets stand dark and Buy is greyed out.
- **Demo mode** has the near right market bought, with coins waiting.
