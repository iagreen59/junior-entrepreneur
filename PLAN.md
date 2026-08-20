# Junior Entrepreneur — PLAN.md

Cloud Agent brief for the v1 corner juice stand game (vanilla HTML / CSS / JS).

**Read this file first.** Honor the Phase status checkboxes. Do not re-do checked phases. Implement **one phase per PR**. Touch only the files listed for that phase. Open a PR when done. In the same PR (or a tiny follow-up), mark the phase checkbox `[x]` when the work is complete.

**Stack rules:** no npm, no frameworks, no build step. Persist with `localStorage` via `js/state.js`. GitHub Pages is not in scope. Keep the Phase 1 Sell Day stub until Phase 3 replaces it.

**Suggested prompt:** `Implement Phase N from PLAN.md. Open a PR. Do not start later phases. Mark Phase N done in the Phase status list when finished.`

---

## Phase status

Future agents: skip anything already checked.

- [x] Phase 0 — Repo + Cursor integration
- [x] Phase 1 — Playable fake-day shell
- [x] Phase 2 — Recipe + buy ingredients
- [ ] Phase 3 — Price + real daily sales
- [ ] Phase 4 — Polish (validation, New Game, light balance)

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
- GitHub Pages
- npm, Docker, or non-empty install scripts

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

**Status:** not started — start only after Phase 2 is checked done

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

- [ ] Player can set and persist sell price
- [ ] High price → fewer sales (usually)
- [ ] Low price → more sales and/or sell-out when stock is low
- [ ] Inventory decreases by recipe × cups sold
- [ ] Day report shows revenue, costs, profit; cash updates; refresh persists
- [ ] Profit can be negative

### Out of scope

- New products / food
- Multiple stands or employees
- Phase 4 polish (New Game, morning checklist copy, deep balance)

---

## Phase 4 — Polish

**Status:** not started — start only after Phase 3 is checked done

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

- [ ] Morning / guidance copy makes the loop clear
- [ ] Validation blocks or explains bad Sell Day cases (e.g. empty stock)
- [ ] New Game clears save and returns to starting day/cash
- [ ] A reasonable recipe + buy + price can show profit across a few days
- [ ] Full loop still persists correctly after refresh

### Out of scope

- Other beverages / food
- Multiple stands + hiring
- Fancy art, sound, frameworks, build tools

---

## Later than v1 (not phases)

Do not implement these unless a future plan section is added and status checkboxes created:

- Other beverages and food
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
│   └── ui.js
├── .cursor/environment.json
└── .gitignore
```

---

## Parallel Cloud Agents

- **Do not parallelize Phase 2** (recipe + buy share UI/state wiring).
- After Phase 2, optional split: Agent A = `js/economy.js` formulas; Agent B = day-report UI in `js/ui.js` + CSS — only if prompts strictly file-scope and one agent owns `main.js` wiring.
- Avoid two agents changing `js/state.js` schema at the same time.

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
