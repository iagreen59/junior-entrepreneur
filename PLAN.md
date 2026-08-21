# Junior Entrepreneur — PLAN.md

Cloud Agent brief for the v1 corner juice stand game (vanilla HTML / CSS / JS).

**Read this file first.** Honor the Phase status checkboxes. Do not re-do checked phases. Implement **one phase per PR**. Touch only the files listed for that phase. Open a PR when done. In the same PR (or a tiny follow-up), mark the phase checkbox `[x]` when the work is complete.

**Stack rules:** no npm, no frameworks, no build step. Persist with `localStorage` via `js/state.js`. GitHub Pages is in scope (live site from `main` `/`). Keep the Phase 1 Sell Day stub until Phase 3 replaces it.

**Preview artifacts (required for Phase 5+):** Every phase PR must include **screenshot(s) and/or a short screen recording** of the new UI/behavior before the change is accepted or merged. Attach artifacts under `/opt/cursor/artifacts/` and embed or link them in the PR body so a human can review the look and feel without running the game. Each Phase 5+ play-test checklist includes a preview checkbox — do not mark the phase done until that preview is in the PR.

**Suggested prompt:** `Implement Phase N from PLAN.md. Open a PR. Do not start later phases. Mark Phase N done in the Phase status list when finished. Include screenshot or video preview artifacts before asking for review.`

---

## Phase status

Future agents: skip anything already checked.

- [x] Phase 0 — Repo + Cursor integration
- [x] Phase 1 — Playable fake-day shell
- [x] Phase 2 — Recipe + buy ingredients
- [x] Phase 3 — Price + real daily sales
- [x] Phase 4 — Polish (validation, New Game, light balance)
- [x] Phase 5 — Panel close buttons
- [x] Phase 6 — Hot cocoa drink
- [x] Phase 7 — Weather and drink preference
- [ ] Phase 8 — Animated customer day + summary

---

## Phase 0 — Repo + Cursor integration

**Status:** done

### Goal

GitHub repo + Cursor Cloud Agents path working for a static project (no game UI required beyond repo scaffolding).

### Files to touch

- `.cursor/environment.json` (`{}` is enough)
- `.gitignore`
- `README.md`

### Play-test checklist

- [x] Repo exists on GitHub and local clone/push works
- [x] Cloud Agent can open a PR against this repo
- [x] Merge + `git pull` on PC updates local files

### Out of scope

- Game UI / JS gameplay
- npm, Docker, or non-empty install scripts

**Hosting (in scope for the project):** GitHub Pages deploys from `main` branch `/` (root). Live URL: https://iagreen59.github.io/junior-entrepreneur/

---

## Phase 1 — Playable fake-day shell

**Status:** done

### Goal

Clickable stand shell: day, cash, inventory placeholders, Recipe / Buy / Price / Sell Day buttons. Sell Day is a stub (e.g. sold 10 cups, +$5). Day and cash persist across refresh.

### Files to touch

- `index.html`
- `css/styles.css`
- `js/main.js`
- `js/state.js`
- `js/ui.js`
- `js/recipe.js` (stub)
- `js/economy.js` (stub)

### Play-test checklist

- [x] Open `index.html` in a browser
- [x] Sell Day advances day and updates cash / report
- [x] Refresh keeps day and cash (`localStorage`)
- [x] Recipe / Buy / Price show “coming later” stub messages

### Out of scope

- Real recipe editor
- Buying ingredients
- Setting sell price
- Real demand / inventory consumption / P&L

---

## Phase 2 — Recipe + buy ingredients

**Status:** done

### Goal

Player can edit the juice recipe (fruit, sugar, ice, cups — units per cup) and buy those ingredients. Buying deducts cash and adds inventory; unaffordable buys are blocked. Recipe, inventory, and cash persist. Sell Day stays the Phase 1 stub.

### Files to touch

**Primary**

- `js/recipe.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

**Allowed if needed**

- `js/state.js` — only for buy unit prices / small helpers; document any schema changes in the PR

### Play-test checklist

- [x] Recipe UI edits fruit, sugar, ice, cups and saves to state
- [x] Buy UI purchases ingredients; cash goes down; inventory goes up
- [x] Cannot buy more than cash allows (clear message)
- [x] Refresh keeps recipe, inventory, and cash
- [x] Sell Day still uses the Phase 1 stub (unchanged economy)

### Out of scope

- Changing `js/economy.js` sell stub
- Price panel / real sales / demand
- Other beverages, food, multi-stand, employees
- Parallel agents splitting recipe vs buy (do Phase 2 as one PR)

---

## Phase 3 — Price + real daily sales

**Status:** done

### Goal

Player sets sell price. Sell Day runs a simple demand simulation (price + light random/weather; document formula in comments). Cups sold consume inventory per recipe; cannot sell more than stock allows. End-of-day P&L (revenue, cost of goods used, profit); update cash and save.

### Files to touch

**Primary**

- `js/economy.js` (owns formulas)
- `js/ui.js` (price UI + report display)
- `js/main.js` (wire Sell Day to real economy)

**Allowed**

- `index.html`, `css/styles.css` — light markup/styles for price controls

### Play-test checklist

- [x] Player can set and persist sell price
- [x] High price → fewer sales (usually)
- [x] Low price → more sales and/or sell-out when stock is low
- [x] Inventory decreases by recipe × cups sold
- [x] Day report shows revenue, costs, profit; cash updates; refresh persists
- [x] Profit can be negative

### Out of scope

- New products / food
- Multiple stands or employees
- Phase 4 polish (New Game, morning checklist copy, deep balance)

---

## Phase 4 — Polish

**Status:** done

### Goal

Morning guidance (what to do before Sell Day), basic validation messages (e.g. no stock), **New Game** reset (clears `localStorage`), and a light balance pass so a sensible recipe + price can profit over a few days.

### Files to touch

**Primary**

- `js/ui.js`
- `js/main.js`
- `css/styles.css`
- `index.html` (if New Game control / copy needs markup)

**Allowed**

- `js/economy.js`, `js/recipe.js` — balance constants only

### Play-test checklist

- [x] Morning / guidance copy makes the loop clear
- [x] Validation blocks or explains bad Sell Day cases (e.g. empty stock)
- [x] New Game clears save and returns to starting day/cash
- [x] A reasonable recipe + buy + price can show profit across a few days
- [x] Full loop still persists correctly after refresh

### Out of scope

- Other beverages / food
- Multiple stands + hiring
- Fancy art, sound, frameworks, build tools

---

## Phase 5 — Panel close buttons

**Status:** done

### Goal

Every open menu (Recipe, Buy, Price) has an obvious **Close** control that hides the panel without saving. Pressing **Escape** also closes the open panel. Opening another menu still switches panels as today.

### Files to touch

**Primary**

- `index.html`
- `css/styles.css`
- `js/ui.js`
- `js/main.js`

### Play-test checklist

- [x] Recipe panel Close hides the panel without applying unsaved edits
- [x] Buy panel Close hides the panel
- [x] Price panel Close hides the panel without applying unsaved price
- [x] Escape closes whichever panel is open
- [x] Save recipe / Buy / Set price still work after adding Close
- [x] **Preview:** screenshot of each panel (Recipe, Buy, Price) with the Close control visible — attach to the PR

### Out of scope

- Weather UI
- Hot cocoa / new ingredients
- Customer animation or Sell Day changes

---

## Phase 6 — Hot cocoa drink

**Status:** done

### Goal

Player can sell **juice** (cold) or **hot cocoa** (hot). Cocoa ingredients: chocolate, milk, whipped cream, chocolate sprinkles, plus shared **cups**. Recipe / Buy / Price work for the selected product. Inventory and dual recipes/prices persist across refresh (migrate/normalize old juice-only saves). Sell Day still resolves **instantly** (no customer animation yet) and consumes the correct product recipe; demand may stay simple per active product until Phase 7 wires weather preference.

**Locked schema notes**

- Products: `juice` | `cocoa`
- Cocoa recipe keys: `chocolate`, `milk`, `whippedCream`, `chocolateSprinkles`, plus `cups`
- Juice keeps existing keys: `fruit`, `sugar`, `ice`, `cups`
- Shared inventory bag holds all ingredient keys; document unit prices in `js/state.js`

### Files to touch

**Primary**

- `js/state.js` — inventory keys, dual recipes/prices, migrate/normalize
- `js/recipe.js`
- `js/ui.js`
- `js/main.js`
- `js/economy.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] Player can switch between juice and hot cocoa
- [x] Cocoa recipe edits chocolate, milk, whipped cream, chocolate sprinkles, cups and saves
- [x] Buy UI purchases new cocoa ingredients; cash and inventory update
- [x] Player can set a cocoa sell price (and juice price remains independent)
- [x] Sell Day consumes inventory for the product being sold
- [x] Refresh keeps both products’ recipes, prices, and inventory
- [x] Old juice-only saves still load (migrate/normalize)
- [x] **Preview:** screenshots of cocoa recipe panel and buy rows for new ingredients — attach to the PR

### Out of scope

- Named weather UI / hot-vs-cold preference (Phase 7)
- Customer sprites, 10-second Sell Day, day-end customer summary (Phase 8)
- Food items
- Multiple stands or employees

---

## Phase 7 — Weather and drink preference

**Status:** done

### Goal

Morning shows today’s weather as discrete **hot**, **mild**, or **cold** (rolled each new day; visible before Sell Day). Replace the anonymous `[0.75, 1.25]` weather noise with typed weather that **biases demand toward cold drinks (juice) on hot days and hot drinks (cocoa) on cold days**; mild is roughly even. Document the formula in comments. When both products are stocked, sales should favor the weather-matched drink; mismatch reduces interest in the wrong-temperature product.

### Files to touch

**Primary**

- `js/weather.js` (new — weather types, labels, roll helpers)
- `js/economy.js`
- `js/ui.js`
- `js/state.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] Status / morning UI shows today’s weather (hot / mild / cold)
- [x] Weather re-rolls for each new day (after Sell Day advances the day)
- [x] Hot day favors juice sales vs cocoa when both are stocked
- [x] Cold day favors cocoa sales vs juice when both are stocked
- [x] Mild day is roughly balanced between juice and cocoa
- [x] Formula is documented in code comments
- [x] Refresh keeps or correctly re-derives the current day’s weather as designed
- [x] **Preview:** screenshots of hot and cold weather in the status UI — attach to the PR

### Out of scope

- Customer sprites / timed Sell Day timeline (Phase 8)
- Food items
- Sound, frameworks, build tools

---

## Phase 8 — Animated customer day + summary

**Status:** not started

### Goal

Sell Day runs about **10 seconds**. Customers appear gradually (slowed buy activity so one day plays out over ~10s). Each customer either **buys** or **leaves**:

- **Leaves** → show an icon for why (price too high, sold out / no stock, weather mismatch). Use SVG/CSS icons, not emoji.
- **Buys** → show an icon for what they like or don’t like about the drink/price/weather fit; if they are happy, show a **happy** icon.

Block starting another Sell Day while the animation runs. After ~10s, show a **customer summary** (bought count, left-by-reason counts, likes / dislikes / happy) plus the existing P&L. Visual totals must match the economy results (Phase 8 visualizes demand as timed customer events; reuse `randomFn` where useful for determinism).

### Files to touch

**Primary**

- `js/customers.js` (new — customer events, timing, summary aggregation)
- `js/economy.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

**Allowed if needed**

- `js/weather.js` — leave/buy reason helpers tied to weather preference

### Play-test checklist

- [ ] Sell Day lasts about 10 seconds (not instant)
- [ ] Customers appear over the day; some buy and some leave
- [ ] Leave shows readable reason icons (price / stock / weather mismatch)
- [ ] Buy shows like / dislike / happy icons as appropriate
- [ ] Cannot start another Sell Day while one is running
- [ ] Day-end customer summary matches buy/leave totals and sits with P&L
- [ ] Inventory, cash, and day still update correctly after the animation
- [ ] **Preview:** short video of a full Sell Day plus a screenshot of the customer summary — attach to the PR

### Out of scope

- Sound effects
- Employees / hiring
- Food items
- npm, frameworks, or a build step

---

## Later than v1 (not phases)

Do not implement these unless a future plan section is added and status checkboxes created:

- Food items
- Multiple stands
- Hiring employees

---

## Project layout

```
junior-entrepreneur/
├── PLAN.md
├── README.md
├── index.html
├── css/styles.css
├── js/
│   ├── main.js
│   ├── state.js
│   ├── economy.js
│   ├── recipe.js
│   ├── ui.js
│   ├── weather.js    (Phase 7+)
│   └── customers.js  (Phase 8+)
├── .cursor/environment.json
└── .gitignore
```

---

## Parallel Cloud Agents

- **Do not parallelize Phase 2** (recipe + buy share UI/state wiring).
- After Phase 2, optional split: Agent A = `js/economy.js` formulas; Agent B = day-report UI in `js/ui.js` + CSS — only if prompts strictly file-scope and one agent owns `main.js` wiring.
- Avoid two agents changing `js/state.js` schema at the same time.
- **Phase 5** may run alone (UI close controls only).
- **Do not parallelize Phase 6** (dual-product schema + Recipe/Buy/Price/economy wiring).
- **Do not parallelize Phase 8** (Sell Day animation + economy + UI must stay in one PR).
- Phase 7 should land after Phase 6 (needs juice + cocoa for weather preference).

---

## Suggested phone prompts

**Phase 2**

```text
Implement Phase 2 from PLAN.md. Open a PR. Do not start Phase 3 or 4.
When done, mark Phase 2 checked in the Phase status list.
```

**Phase 3**

```text
Implement Phase 3 from PLAN.md. Open a PR. Do not start Phase 4.
Phase 2 must already be done. Mark Phase 3 checked when finished.
```

**Phase 4**

```text
Implement Phase 4 from PLAN.md. Open a PR.
Phases 2 and 3 must already be done. Mark Phase 4 checked when finished.
```

**Phase 5**

```text
Implement Phase 5 from PLAN.md. Open a PR. Do not start Phase 6+.
Include screenshot previews of each panel with Close visible.
Mark Phase 5 checked when finished.
```

**Phase 6**

```text
Implement Phase 6 from PLAN.md. Open a PR. Do not start Phase 7 or 8.
Phase 5 should already be done. Include screenshot previews of cocoa recipe and buy UI.
Mark Phase 6 checked when finished.
```

**Phase 7**

```text
Implement Phase 7 from PLAN.md. Open a PR. Do not start Phase 8.
Phases 5 and 6 must already be done. Include screenshots of hot and cold weather UI.
Mark Phase 7 checked when finished.
```

**Phase 8**

```text
Implement Phase 8 from PLAN.md. Open a PR.
Phases 5–7 must already be done. Include a short Sell Day video and a customer-summary screenshot.
Mark Phase 8 checked when finished.
```
