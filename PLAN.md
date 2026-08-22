# Junior Entrepreneur — PLAN.md

Cloud Agent brief for the Junior Entrepreneur game (vanilla HTML / CSS / JS). Phases 0–8 shipped the dual-drink stand loop. Phases **9–19** expand into a larger entrepreneur game (menu, multi-stand, employees, restaurants, ledger, events).

**Read this file first.** Honor the Phase status checkboxes. Do not re-do checked phases. Implement **one phase per PR**. Touch only the files listed for that phase. Open a PR when done. In the same PR (or a tiny follow-up), mark the phase checkbox `[x]` when the work is complete.

**Stack rules:** no npm, no frameworks, no build step. Persist with `localStorage` via `js/state.js`. GitHub Pages is in scope (live site from `main` `/`). Migrate/normalize older saves when schema changes.

**Preview artifacts (required for Phase 5+):** Every phase PR must include **screenshot(s) and/or a short screen recording** of the new UI/behavior before the change is accepted or merged. Attach artifacts under `/opt/cursor/artifacts/` and embed or link them in the PR body so a human can review the look and feel without running the game. Each Phase 5+ play-test checklist includes a preview checkbox — do not mark the phase done until that preview is in the PR.

**Suggested prompt:** `Implement Phase N from PLAN.md. Open a PR. Do not start later phases. Mark Phase N done in the Phase status list when finished. Include screenshot or video preview artifacts before asking for review.`

---

## Locked design (Phases 9–19)

Agents must follow these rules unless a later phase explicitly changes a constant.

| Topic | Rule |
| ----- | ---- |
| Start | Cash **$50**; must **buy first stand for $20** before selling |
| Extra stands | When **cash > $100**, unlock buy another stand for **$20**; max **4** stands; notify when eligible; player chooses when to buy |
| Stand UI | Dropdown of owned stands + **Add** (buy) when unlocked; switch active stand for management UI |
| Inventory | **One shared supply bag** consumed by all locations |
| Menu | 4 products: **juice, cocoa, burger, soup**; player picks **which are offered today**; customers choose among offered items each Sell Day |
| Prices | **Per menu item** |
| Cups split | **coldCups** (juice) / **hotCups** (cocoa) — remove shared `cups` overlap |
| Food prefs | Burger preferred **hot**; soup preferred **cold** (extend weather helpers) |
| Ingredients | **No shared ingredients** across the four recipes (4–5 each) |
| Recipe UI | Show **max sellable from stock** + **COGS per item** |
| Feedback | Per-customer icons for bought item / leave reason / reaction (extend Phase 8) |
| Employees (stands) | At **2+ stands**, each stand needs staffing; player may run **one** stand; others need an employee; or all employee-run; **hire/layoff**; paid **each day** |
| Wage default | **$5/day** per stand employee; **$8/day** per restaurant employee (tunable in Phase 19) |
| Map | In-page **cartoon SVG/CSS map** of owned stands / restaurant(s) |
| Instructions | In-game help covering new systems; **hideable** |
| Restaurant gate | Own **4 stands** and **cash > $1000** → may buy restaurant for **$400**; **stands forfeited**; cannot own stands + restaurants together |
| More restaurants | When **cash > $1000**, unlock buy another restaurant for **$400**; max **4** |
| Restaurant staff | Min **2**, max **4** employees **per restaurant**; player **cannot** work a restaurant shift |
| Restaurant rent | **Daily rent per restaurant** (default **$15/day** each, tunable in Phase 19). Charged on Sell Day with wages |
| Stay open | Must pay **today’s wages + rent** to stay open; underfunded/understaffed → clear block message. Overhead should push profitability or a return to stands via selling restaurants |
| Per-restaurant P&L | UI shows **sales and profitability per restaurant** so the player sees employee-count (and rent) effects |
| Sell locations | Sell a stand for **$10** (keep ≥1 in stand mode); sell a restaurant for **$200** (keep ≥1 in restaurant mode) |
| Sell last restaurant | Player receives **one stand** to restart stand mode |
| Random events | **Less than 1 per week** (~chance per day); good and bad; always manageable; banner message |
| Ledger | Openable **business metrics** panel + info tooltips; include rent and per-location rollups in restaurant mode |

### Default unique recipes (Phases 10–11+)

- **Juice:** fruit, sugar, ice, coldCups
- **Cocoa:** chocolate, milk, whippedCream, chocolateSprinkles, hotCups
- **Burger:** bun, beefPatty, cheese, lettuce, tomato
- **Soup:** broth, noodles, carrot, celery, herbs

### Save / migration

Extend `junior-entrepreneur-v1` normalize path so old saves migrate: `cups` → cold/hot as needed; invent default stands/menu/ledger fields; gate Sell Day until a stand exists.

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
- [x] Phase 8 — Animated customer day + summary
- [x] Phase 9 — Starting cash, first stand, hideable instructions
- [x] Phase 10 — Hot/cold cups + recipe yield and COGS
- [x] Phase 11 — Four-item menu + daily offers + per-item prices
- [x] Phase 12 — Multi-item Sell Day + purchase feedback icons
- [x] Phase 13 — Multi-stand unlock, selector, map
- [x] Phase 14 — Employees for multi-stand
- [x] Phase 15 — Sell stands + random events
- [ ] Phase 16 — First restaurant (rent + per-location P&L)
- [ ] Phase 17 — Multi-restaurant, sell, restart stand
- [ ] Phase 18 — Business ledger and educational metrics
- [ ] Phase 19 — Instructions refresh + balance + event polish

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

**Status:** done

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

- [x] Sell Day lasts about 10 seconds (not instant)
- [x] Customers appear over the day; some buy and some leave
- [x] Leave shows readable reason icons (price / stock / weather mismatch)
- [x] Buy shows like / dislike / happy icons as appropriate
- [x] Cannot start another Sell Day while one is running
- [x] Day-end customer summary matches buy/leave totals and sits with P&L
- [x] Inventory, cash, and day still update correctly after the animation
- [x] **Preview:** short video of a full Sell Day plus a screenshot of the customer summary — attach to the PR

### Out of scope

- Sound effects
- Employees / hiring
- Food items
- npm, frameworks, or a build step

---

## Phase 9 — Starting cash, first stand purchase, hideable instructions

**Status:** done

### Goal

Start at **$50** cash. Player must **buy the first stand for $20** before Sell Day is allowed. Add a **hideable instructions** panel that explains buying your stand and the basic loop (expand copy further in later phases).

### Files to touch

**Primary**

- `js/state.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] New game shows $50 cash and no owned stand (or equivalent gate)
- [x] Sell Day blocked until stand purchased
- [x] Buying stand costs $20 → cash $30 and selling unlocked
- [x] Instructions panel can hide and show
- [x] Old saves migrate sensibly (grant a stand or prompt purchase without soft-locking)
- [x] **Preview:** screenshot of buy-stand gate + instructions panel — attach to the PR

### Out of scope

- Multi-stand unlocks
- Food items
- Employees
- Restaurant

---

## Phase 10 — Hot/cold cups + recipe yield and COGS display

**Status:** done

### Goal

Replace shared `cups` with **coldCups** (juice) and **hotCups** (cocoa). Recipe UI shows **servings possible from current inventory** and **COGS per item** for the recipes being edited. Migrate legacy `cups` inventory.

### Files to touch

**Primary**

- `js/state.js`
- `js/recipe.js`
- `js/economy.js`
- `js/ui.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] Juice uses coldCups; cocoa uses hotCups (no shared cups key)
- [x] Buy UI offers both cup types
- [x] Recipe panel shows max sellable servings from stock
- [x] Recipe panel shows COGS for the item
- [x] Old saves with `cups` migrate without losing progress
- [x] **Preview:** screenshots of recipe yield/COGS and buy rows for cup types — attach to the PR

### Out of scope

- Burger / soup
- Multi-stand
- Changing Sell Day multi-item resolution (Phase 12)

---

## Phase 11 — Four-item menu + daily offer toggles + per-item prices

**Status:** done

### Goal

Add **burger** and **soup** with the locked unique ingredient lists. Player enables/disables which items are on **today’s menu**. Set **price per menu item**. Buy lists all ingredients. Extend weather prefs: burger favored on **hot**, soup on **cold**.

### Files to touch

**Primary**

- `js/state.js`
- `js/recipe.js`
- `js/weather.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

**Allowed if needed**

- `js/economy.js` — only enough to keep single-product sell working until Phase 12

### Play-test checklist

- [x] All four recipes editable with unique ingredients
- [x] Daily menu toggles persist
- [x] Player can offer a subset (e.g. no soup on a hot day)
- [x] Independent prices per item persist
- [x] Buy UI covers all new ingredients
- [x] **Preview:** screenshots of menu toggles, food recipes, and buy list — attach to the PR

### Out of scope

- Full multi-item customer resolution (Phase 12)
- Multi-stand / employees

---

## Phase 12 — Multi-item Sell Day + richer purchase/feedback icons

**Status:** done

### Goal

One Sell Day serves **all offered menu items**. Customers choose among offered items. Icons show **what they bought** (or leave reason) and reaction. Day-end summary aggregates by item. Empty menu blocked. P&L and animation totals must match.

### Files to touch

**Primary**

- `js/economy.js`
- `js/customers.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

**Allowed if needed**

- `js/weather.js` — preference helpers for food + drinks

### Play-test checklist

- [x] Two or more offered items → mixed purchases in one Sell Day
- [x] Weather skews burger/juice vs soup/cocoa as designed
- [x] Icons show purchased item and/or leave reason + reaction
- [x] Summary aggregates by item and matches economy
- [x] Empty menu cannot start Sell Day
- [x] **Preview:** short Sell Day video + summary screenshot — attach to the PR

### Out of scope

- Multi-stand staffing
- Restaurant

---

## Phase 13 — Multi-stand unlock, selector, shared inventory, map

**Status:** done

### Goal

When **cash > $100**, notify the player and allow **Add stand ($20)** up to **4**. Dropdown switches the active stand for management UI. Inventory remains **shared**. Cartoon **map** (SVG/CSS) shows owned stands.

### Files to touch

**Primary**

- `js/state.js` (stands array / mode)
- `js/map.js` (new — or map section in UI)
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] Unlock / notify when cash > $100
- [x] Buy 2nd–4th stand at $20 each; cannot exceed 4
- [x] Dropdown switches active stand
- [x] Inventory shared across stands
- [x] Map updates with owned stands
- [x] **Preview:** screenshots of stand dropdown, Add flow, and map — attach to the PR

### Out of scope

- Employees
- Restaurant

---

## Phase 14 — Employees for multi-stand

**Status:** done

### Goal

With **2+ stands**, each stand must be staffed. Player may assign themselves to **one** stand; other stands need employees; or all stands employee-run. **Hire/layoff**. Daily wage (**$5** default) deducted on Sell Day. **Default:** block Sell Day with a clear message if understaffed.

### Files to touch

**Primary**

- `js/state.js`
- `js/economy.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] 2+ stands require staffing rules as above
- [x] Wages reduce cash on Sell Day
- [x] Hire and layoff work and persist
- [x] Player-run one stand + employee others works
- [x] All-employee mode works
- [x] Understaffed → Sell Day blocked with clear message
- [x] **Preview:** staff panel screenshots — attach to the PR

### Out of scope

- Restaurant staffing / rent

---

## Phase 15 — Sell stands + random events (v1 set)

**Status:** done

### Goal

Sell any stand for **$10** (must keep ≥1 stand in stand mode). Add random events at **less than 1 per week** (good and bad): e.g. supply price bump/drop, employee quit, foot-traffic surge. Always manageable; show a **banner message**.

### Files to touch

**Primary**

- `js/events.js` (new)
- `js/state.js`
- `js/economy.js` / buy unit prices as needed
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [x] Sell stand updates cash, dropdown, and map
- [x] Cannot sell the last stand
- [x] Events are rare (< ~1/week expected)
- [x] Event message banner displays
- [x] Impacts are recoverable (no instant lose)
- [x] **Preview:** sell-stand UI + an event banner screenshot — attach to the PR

### Out of scope

- Restaurant purchase

---

## Phase 16 — First restaurant conversion (rent + per-location P&L)

**Status:** not started — start only after Phase 15 is checked done

### Goal

With **4 stands** and **cash > $1000**, offer buy restaurant for **$400**. On buy, **forfeit all stands**; enter restaurant mode (map shows restaurant). **2–4 employees required** (player cannot staff). Shared menu/inventory continues. Each Sell Day charges **daily rent** (default **$15**) plus wages. Day report and location panel show **that restaurant’s sales, wages, rent, and profit**. Demand/capacity scales with employee count (document formula) so more staff can raise sales but also raise wage cost against fixed rent. Must afford wages + rent (and be staffed) to stay open.

### Files to touch

**Primary**

- `js/state.js`
- `js/map.js` and/or `js/ui.js`
- `js/economy.js`
- `js/main.js`
- `index.html`
- `css/styles.css`
- Instructions copy as needed

### Play-test checklist

- [ ] Gate enforced (4 stands + cash > $1000)
- [ ] After buy: no stands; restaurant mode active
- [ ] Must have 2+ employees and afford wages+rent to Sell Day
- [ ] Day report breaks out sales vs wages vs rent vs profit
- [ ] Changing employee count visibly changes sales and profitability
- [ ] Understaffed or can’t cover overhead → clear block message
- [ ] **Preview:** buy-restaurant flow + per-location P&L screenshot — attach to the PR

### Out of scope

- Multiple restaurants
- Selling restaurants

---

## Phase 17 — Multi-restaurant, sell restaurants, restart stand

**Status:** not started — start only after Phase 16 is checked done

### Goal

In restaurant mode, **cash > $1000** unlocks another restaurant for **$400** (max **4**). Each restaurant has its own staff (2–4) and pays its own **daily rent**. Sell one for **$200** (keep ≥1). Selling the **last** restaurant grants **one stand** and returns to stand mode. UI lists **per-restaurant sales and profitability** (compare locations / staffing). Unprofitable overhead should make selling back to stands a viable strategy. Never own stands and restaurants at the same time.

### Files to touch

**Primary**

- `js/state.js`
- `js/map.js` and/or `js/ui.js`
- `js/economy.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [ ] Buy 2nd–4th restaurant when cash > $1000; cost $400 each
- [ ] Each restaurant shows separate sales/profit and employee-count effect
- [ ] Rent × number of restaurants charged daily
- [ ] Sell one restaurant for $200; cannot sell last except via last-restaurant rule
- [ ] Sell last restaurant → one stand; stand UI returns
- [ ] Never own stands + restaurants together
- [ ] **Preview:** multi-restaurant map/P&L + sell-last → stand restart — attach to the PR

### Out of scope

- Deep ledger (Phase 18)

---

## Phase 18 — Business ledger and educational metrics

**Status:** not started — start only after Phase 17 is checked done

### Goal

Openable **Business** menu with running totals: revenue, COGS, **wages**, **rent**, other overhead, profit, cash, days operated, etc. Include **per-restaurant** rollups in restaurant mode. Each metric has an **info** control with a short educational blurb. Updates from daily results and events.

### Files to touch

**Primary**

- `js/ledger.js` (new)
- `js/state.js`
- `js/economy.js`
- `js/ui.js`
- `js/main.js`
- `index.html`
- `css/styles.css`

### Play-test checklist

- [ ] After several days, ledger matches summed history including rent and wages
- [ ] Per-restaurant lines match day reports when applicable
- [ ] Info blurbs present for metrics
- [ ] Panel open/close works
- [ ] **Preview:** ledger panel screenshot with info open — attach to the PR

### Out of scope

- New location types beyond stands/restaurants

---

## Phase 19 — Instructions refresh + balance pass + event pack polish

**Status:** not started — start only after Phase 18 is checked done

### Goal

Instructions cover stands, menu, employees, **restaurant rent/wages**, ledger, events, and the choice to stay in restaurants or sell back to stands; remain **hideable**. Tune wages, **rent**, demand, and event rates so failure is avoidable but restaurants feel like a profitability challenge.

### Files to touch

**Primary**

- Instructions copy in `index.html` / `js/ui.js`
- Light constant tweaks in `js/economy.js`, `js/events.js`, `js/state.js`

### Play-test checklist

- [ ] New player can learn core rules from in-game help alone
- [ ] Smoke path: stand → multi-stand → restaurant works
- [ ] Rent + wages create visible pressure without instant loss
- [ ] Event rates still feel rare and manageable
- [ ] **Preview:** instructions panel screenshots covering new systems — attach to the PR

### Out of scope

- Features beyond this roadmap

---

## Explicitly deferred (not in Phases 9–19)

- Sound, frameworks, npm
- More than 4 stands or 4 restaurants
- Owning stands and restaurants simultaneously
- Player working as a restaurant employee

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
│   ├── weather.js     (Phase 7+)
│   ├── customers.js   (Phase 8+)
│   ├── map.js         (Phase 13+)
│   ├── events.js      (Phase 15+)
│   └── ledger.js      (Phase 18+)
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
- **Do not parallelize Phases 11–12** (menu schema + multi-item Sell Day).
- **Do not parallelize Phases 13–14** (stands + staffing).
- **Do not parallelize Phases 16–17** (restaurant conversion + multi-restaurant).

---

## Suggested phone prompts

**Phase 8** (already done — kept for history)

```text
Implement Phase 8 from PLAN.md. Open a PR.
Phases 5–7 must already be done. Include a short Sell Day video and a customer-summary screenshot.
Mark Phase 8 checked when finished.
```

**Phase 9**

```text
Implement Phase 9 from PLAN.md. Open a PR. Do not start Phase 10+.
Include screenshot previews of the buy-stand gate and hideable instructions.
Mark Phase 9 checked when finished.
```

**Phase 10**

```text
Implement Phase 10 from PLAN.md. Open a PR. Do not start Phase 11+.
Phase 9 must already be done. Include screenshots of cold/hot cups and recipe yield/COGS.
Mark Phase 10 checked when finished.
```

**Phase 11**

```text
Implement Phase 11 from PLAN.md. Open a PR. Do not start Phase 12+.
Phase 10 must already be done. Include screenshots of menu toggles and food recipes.
Mark Phase 11 checked when finished.
```

**Phase 12**

```text
Implement Phase 12 from PLAN.md. Open a PR. Do not start Phase 13+.
Phase 11 must already be done. Include a short multi-item Sell Day video and summary screenshot.
Mark Phase 12 checked when finished.
```

**Phase 13**

```text
Implement Phase 13 from PLAN.md. Open a PR. Do not start Phase 14+.
Phase 12 must already be done. Include screenshots of stand dropdown, Add stand, and map.
Mark Phase 13 checked when finished.
```

**Phase 14**

```text
Implement Phase 14 from PLAN.md. Open a PR. Do not start Phase 15+.
Phase 13 must already be done. Include staff panel screenshots.
Mark Phase 14 checked when finished.
```

**Phase 15**

```text
Implement Phase 15 from PLAN.md. Open a PR. Do not start Phase 16+.
Phase 14 must already be done. Include sell-stand and event banner screenshots.
Mark Phase 15 checked when finished.
```

**Phase 16**

```text
Implement Phase 16 from PLAN.md. Open a PR. Do not start Phase 17+.
Phase 15 must already be done. Include buy-restaurant and per-location P&L screenshots.
Mark Phase 16 checked when finished.
```

**Phase 17**

```text
Implement Phase 17 from PLAN.md. Open a PR. Do not start Phase 18+.
Phase 16 must already be done. Include multi-restaurant P&L and sell-last→stand restart previews.
Mark Phase 17 checked when finished.
```

**Phase 18**

```text
Implement Phase 18 from PLAN.md. Open a PR. Do not start Phase 19.
Phase 17 must already be done. Include ledger panel screenshot with a metric info blurb open.
Mark Phase 18 checked when finished.
```

**Phase 19**

```text
Implement Phase 19 from PLAN.md. Open a PR.
Phase 18 must already be done. Include instructions screenshots covering restaurant rent/wages and ledger.
Mark Phase 19 checked when finished.
```
