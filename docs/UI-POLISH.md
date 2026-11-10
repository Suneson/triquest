# UI polish

How the app moves and feels. The code is `css/polish.css` (loaded last), `js/core/spring.js` (the numbers), `js/app/spring-run.js`, `js/app/press.js` and `js/app/nav.js`.

## Motion rules

These are fixed. `tests/spring.test.js` fails if the code or the stylesheet drifts from them.

1. **Duration ceiling.** A tap, a toggle or a sheet let go is finished in 150–300 ms. Only idle loops and rare celebrations (a chest, a level up) run longer.
2. **Easing by direction.** What arrives uses `cubic-bezier(0.16, 1, 0.3, 1)` or an under-damped spring. What leaves uses `cubic-bezier(0.7, 0, 0.84, 0)` and takes 100–180 ms.
3. **Where a squash starts.** A button squashes from its foot (`transform-origin: 50% 100%`). A wide card gives around the finger.
4. **Gestures hand over to a spring.** Under the finger a sheet follows 1:1 with no easing. On release a spring starts from the finger's speed. A sheet that is rising or springing back can be caught again.

## Tokens

| Token | Value | Used for |
| --- | --- | --- |
| `DUR.pressDown` | 100 ms | finger lands, the control squashes |
| `DUR.toggle` | 160 ms | a tab, chip or switch changing |
| `DUR.enter` | 240 ms | a panel, card or partial sheet arriving; a tab slide |
| `DUR.sheetIn` | 300 ms | a sheet rising |
| `DUR.exit` | 160 ms | anything leaving by a tap |
| `DUR.sheetOut` | 180 ms | a sheet dropping away |
| `DUR.stagger` | 30 ms, 150 ms at most | a cascade of cards |

| Spring | Stiffness | Damping | Mass | Damping ratio | Overshoot | Settles |
| --- | --- | --- | --- | --- | --- | --- |
| `SPRING.press` | 1150 | 31 | 1 | 0.46 | 19% | 260 ms |
| `SPRING.pop` | 1000 | 36 | 1 | 0.57 | 11% | 270 ms |
| `SPRING.sheetBack` | 520 | 32 | 1 | 0.70 | 5% | 290 ms |
| `SPRING.sheetAway` | 1024 | 64 | 1 | 1.00 | none | 180 ms (cut off) |

Press shapes (`pressShape`): a control under 140 px squashes to 1.05 wide by 0.88 tall, one under 260 px to 1.02 by 0.93, both from the foot. Anything bigger scales to 0.985 around the finger.

Sheet release: it closes past 28% of its height, or on a flick faster than 0.55 px/ms that travelled at least 24 px. The speed handed to the spring is limited to 3 px/ms. A finger that stops before lifting is not a flick.

## How the springs run

`springSamples` works the spring out once as keyframes and the browser plays them on the compositor, so they hold their frame rate while the page is busy. In CSS the same springs are `linear()` curves (`--spring-pop`, `--spring-press`), with a one-overshoot bezier where `linear()` isn't supported.

## Art

`tools/cut-ui-plates.py` cuts the generated Close plate (up and pressed), a gold plate and the sheet handle into `icons/Pixelart/NEW/UI/`. The plates carry no lettering: the app writes the label, so it translates.

## Not done

- The edge swipe back (left edge) still settles on a 180 ms ease, not a spring.
- A sheet that is already dropping away can't be caught: it is gone in 180 ms.
- Nothing here has been tried on a real iPhone.
