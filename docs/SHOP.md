# The shop overhaul: a two-column tactical store

Branch `feature/shop-ui-overhaul`. It merges to `main` only when every phase is done.

The dark, text-heavy list becomes a visual card grid in the spirit of a
base-building game's league and season shops. The look follows the MOSKE
bottle green palette, and the content stays MOSKE's:
- **Cards:** two per row, and each says only four things: the name, the 3D
  picture on a lit well, how many you hold of how many, and the price.
- **Details:** everything else (boost, when it works, weekly limit, story) is
  behind the card's `(i)` button.
- **Currency:** the currency the open tab spends is pinned to the bottom.

## Look

- **Canvas:** bottle green `#0F3A20`.
- **Structure:** warm beige `#E6D7BD` for the header, the tab plates and the
  card bezels.
- **Cards (the facelift):** painted plates, blue (`card-plate-blue`) for
  gear, clothes, base and the stall, seafoam (`card-plate-green`) for fuel, each
  with its own painted `(i)` (`info-blue`, `info-green`). The whole card is the
  button. Full, owned or locked cards go fully grey; out-of-reach prices turn
  red, with no shortfall printed.
- **Active tab:** seafoam `#39A672` with a light mint `#A7DBC5` rim.
- **Price:** in the plate's tray, white with the currency's picture.
  - Out of reach: the price turns red `#D9443B`; a touch shakes the card.
  - Storage full: the card goes grey and the tray says **MAX**.
- **Type:** Franklin Gothic Heavy for titles, Franklin for reading. On iPhone
  both fall back to the served Libre Franklin, held heavy for titles.
- **Tokens:** `css/theme.css`. The shop's styles are `css/shop.css`, scoped to
  `.gw-screen.is-shop`.

## Pieces

| File | What |
| --- | --- |
| `js/core/shop-cards.js` | A card's state: `buy`, `short` (and by how much), `max`, `owned`, `building`, and its storage. Pure and tested (`tests/shop-cards.test.js`). |
| `js/app/shop-ui.js` | `shopCard()`; `cardButton()` and `actionButton()` build a card's *tap* (go, deny, off, wait), drawn as the card and by `tapButton()` in the sheet; `denyTap()`, `walletBar()`, `openShopInfo()`. |
| `js/app/gear-view.js` | The shop itself: tabs, panels, buying. |
| `tools/gen-shop-ui.mjs`, `tools/cut-shop-ui.py` | Tab icons (`icons/UI/tabs/`), made with Gemini. |
| `tools/cut-card-art.py` | The painted card plates and `(i)` buttons: `icons/UI/cards/src/` → `icons/UI/cards/*.webp`. |

## Phases (built two at a time)

1. **Foundations (done).** Palette tokens, the bottle green shell, the beige
   header and tab plates with the seafoam active state. The generated tab
   icons and card plates.
2. **The card system and Fuel (done).** The two-column card, the `(i)` sheet
   (boost, when it works, weekly limit, storage, price, story) and MAX
   CAPACITY. The pinned currency bar (carbs on Fuel, coins elsewhere).
3. **Gear (done).** The sport row on the canvas. A card per slot (current tier,
   next tier's price, the boost in `(i)`). A slot in the workshop shows its live
   countdown on the button. The workshop card is restyled in beige and gold.
4. **Base, Kit and Stall (done).** Props (size on the well, build points),
   collections, blueprints (fragments, *Aim* in mint, *Build* in gold), kits
   (*Wear*), feat items (grey *LOCKED* until earned) and season colourways. The
   daily stall is one wide card under its countdown, with what's coming up.
5. **Inventory (done).** The same cards for what you hold, under three tabs.
   - **Fuel:** *Use*, or a grey *Use* with the reason it can't go on yet.
   - **Kit:** *Wear* for kits, won feat items and season colourways.
   - **Gear:** fitted gear by sport, with each sport's boost.
   - Every card has the same `(i)` sheet as in the shop, and an empty tab
     points to the shop.
6. **Finish (done).**
   - **Tabs:** keyboard tabs (arrows, Home, End, one tab stop per row), and
     each tab panel is labelled by its tab.
   - **Focus:** returns to the card's `(i)` after its sheet closes. Focus rings
     show on both beige and green.
   - **Targets:** every target is at least 44px.
   - **Motion:** reduced motion is respected.
   - **Widths:** no overflow at 320, 390 or 430.
   - **Docs:** DESIGN.md and HANDOFF.
