# English and Spanish: extraction checklist

Phase 6 of the polish pass. Every source file is listed below, with what was
moved into the locales and what was deliberately left alone. The locales are
`js/core/locales/en.js` and `es.js` (1,182 keys each). `tests/i18n.test.js`
keeps them honest: the same keys and placeholders in both, no literal English
on a render path (`tools/i18n-scan.mjs`), and every key the code asks for
exists.

How it works, in one paragraph: `t(key, vars)` from `js/core/i18n.js` returns
the active language's string, picks a plural form from `vars.n`, and falls
back to English with a warning on localhost. Data with stable ids (sports,
intensities, badges, quests, exercises, muscles, set kinds, split presets)
keeps its id and reads its label through a getter, so call sites didn't
change. Dates and numbers go through `fmtDate` / `fmtNum`, so weekday and
month names and the decimal separator follow the language. The seeded
training plan is stored data in English and is translated where it's drawn
(`js/core/plan-i18n.js`, table in `js/core/locales/plan-es.js`).

To add a string: put it in both `en.js` and `es.js` under the screen's
namespace, call `t('ns.key')`, run `npm test`.

## js/app

- [x] `ai.js`: the sign-in error, the AI function's error messages (matched as keys), `lang` goes in the payload from `onboarding.js`
- [x] `auth.js`: sign-in sheet, password reset, sync toasts; Supabase's common errors are mapped to `auth.err.*`
- [x] `chat.js`: Chat tab, General | Direct switch, threads, Add friend sheet, bell sheet, friend button, tab badge labels; friend notifications written by the database in English are re-read by kind
- [x] `config.js`: no text (exempt)
- [x] `demo.js`: exempt. Fixture content standing in for other people's messages, names and the shop
- [x] `drag-sort.js`: no text
- [x] `editor.js`: the session sheet; the seeded plan's title, notes, interval labels and packing items open in the shown language
- [x] `effects.js`: no text of its own (toasts arrive translated)
- [x] `game.js`: week path and season path, including day letters and aria labels
- [x] `gym-history.js`: exercise history, records shelf, gym card, muscle names
- [x] `gym-logger.js`: session bar, rest timer, set grid, menus, finish view, toasts
- [x] `gym-picker.js`: search, filters (values stay English, labels translated), create-exercise form
- [x] `gym-routines.js`: routine rows
- [x] `haptics.js`: no text
- [x] `i18n-dom.js`: new. Fills `index.html`'s `data-i18n` / `data-i18n-aria`, `<html lang>`, title and description
- [x] `lang-toggle.js`: new. The EN / ES switch
- [x] `leaderboard.js`: header, season banner, podium, rival, movement badges, empty and error states
- [x] `main.js`: language boot and live switch, toasts, confirms, Settings, goals, level up, welcome cards, Strava redirects
- [x] `motion.js`: rolling numbers use the language's separators
- [x] `nav.js`: no text
- [x] `onboarding.js`: every question, choice, placeholder and toast. The choice names inside the `i18n-ignore` block stay English on purpose: they are what the AI reads
- [x] `pixel-chart.js`: no text
- [x] `profile-game.js`: sport switcher, HUD, Fitness hub (account block with the language switch, stats, calendar, charts, trophies), public athlete view, cardio drill-down
- [x] `profile.js`: public profile preview and milestones
- [x] `pull.js`: screen-reader status lines
- [x] `quest-sync.js`: no text
- [x] `room-view.js`: General: menus, notes, statuses, composer, report sheet, confirms
- [x] `room.js`: send errors and the rate limit
- [x] `share.js`: share sheet and the card itself (the canvas text, upper-cased for the language)
- [x] `sheet.js`: Back / Close labels
- [x] `shop.js`: header, states, prices in the language's currency format
- [x] `social.js`: RPC errors, including the database's username rule
- [x] `stamp.js`: the record plaque
- [x] `store.js`: "(copy)" on a duplicated session
- [x] `strava-client.js`: errors
- [x] `swipe.js`, `vt.js`: no text
- [x] `ui.js`: Home, the session detail, Calendar, the pixel components, the older Progress panels; every `toLocaleDateString('en-GB')` replaced

## js/core

- [x] `badges.js`: name and description by id (`badge.<id>.*`)
- [x] `calendar.js`: the `.ics` export writes the stored titles; not interface text
- [x] `coach-lines.js`: every line moved to `coach.*`; the logic only picks
- [x] `dates.js`: weekday and month names from the locale lists
- [x] `disciplines.js`: sport and intensity labels as getters; pace hints in `pace.*`
- [x] `exercises.js`: names and cues by id (`ex.<id>.*`), muscle and equipment labels; Spanish names also match free text. The English source stays in the file (exempt from the scan)
- [x] `gesture.js`: no text
- [x] `gym-edit.js`: create-exercise errors; search also matches the English name; logged exercises store the English name and show the library's
- [x] `gym-log.js`: set kinds, set letters (W/D/F, C/D/F in Spanish), rest labels, decimal weights
- [x] `gym-split.js`: preset names, day names (in the athlete's language when picked), warnings
- [x] `gym-stats.js`: record labels and the balance sentence
- [x] `i18n.js`: new
- [x] `icons.js`: drawing data (exempt)
- [x] `load.js`, `quest-claims.js`, `ranks.js`, `rest.js`, `scoring.js`, `sets.js`, `streaks.js`, `sync.js`: no interface text
- [x] `path.js`: the event fallback
- [x] `plan.js`: exempt. Seed data, shown through `plan-i18n.js`
- [x] `plan-i18n.js`: new
- [x] `poses.js`: fallback cues (`pose.*`); drawing data exempt
- [x] `quests.js`: quest text by id (`quest.<id>`)
- [x] `room.js`: message rules
- [x] `scenes.js`: scene labels and the coach's name
- [x] `social.js`: chat times (now, 5m, weekday, date)
- [x] `strava.js`: the fallback title for an untitled activity

## index.html

- [x] Tab labels, header buttons, the + button, the storage banner: `data-i18n` / `data-i18n-aria`
- [x] Title and description set by `i18n-dom.js`
- [x] `<noscript>` is in both languages (no JavaScript, no switching)

## Formatting (6.4)

- [x] All 17 `toLocaleDateString` / `toLocaleString` / `toLocaleTimeString` calls replaced with `fmtDate`, `fmtTime`, `fmtNum`
- [x] Weekday and month names, decimal separators, relative chat times and currency follow the language
- [x] `<html lang>` changes with the language

## What is not translated, on purpose

- Content people write: session titles they typed, chat messages, routine names, custom exercises
- What the AI writes, which already arrives in the athlete's language (6.6)
- App news posted by the owner (the bell's "Updates")
- `demo.js` fixtures
- Product names and brands: MOSKE, Strava, HYROX, Ironman
