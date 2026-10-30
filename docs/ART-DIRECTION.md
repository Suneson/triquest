# Art direction (read before making any new art)

**Modern, clean 3D. No wood, anywhere.**

The game started from Clash of Clans and Clash Royale references. Since the Shop and Home dock icons (`icons/UI/ref/modern-shop.jpg`, `icons/UI/ref/modern-building.jpg`), the house style has been more modern. Every new image follows it:

- **Materials:** smooth, rounded, satin plastic, brushed metal and glass, with soft studio lighting. Think a premium sports brand's city store, not a fantasy village.
- **Colours:**
  - navy `#16264D`, white, warm grey and baby blue (the shop cards' `#6FAEF6`);
  - small gold accents;
  - the MOSKE bird (white on blue) wherever a logo fits.
- **Never:**
  - wood (planks, carved frames, wooden signs, barrels, carts);
  - medieval, fantasy, rustic or pirate details;
  - parchment;
  - heavy black cartoon outlines.
- **References:** pass the two modern references to the image model with every new job. `tools/gen-shop-ui.mjs` does this through `MODERN`, and its `STYLE` and `ICON()` prompts carry these rules.
- **Screens:** the backdrop for the Journal and Chat is the quilted baby-blue leather (`icons/UI/bg/quilt.webp`). Panels on it sit forward with deep, soft shadows, so the backdrop reads as far away.
- **Keying:** generate on a flat `#00FF00` or `#FF00FF` screen. `tools/cut-shop-ui.py` keys either.

Older art with wood is due to be replaced as it's touched: the stall cart, the chest containers and the wooden room props.
