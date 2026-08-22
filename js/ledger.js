/**
 * Phase 18 — Business ledger: running operating totals + educational blurbs.
 *
 * Persisted on state.ledger. Updated after each Sell Day from the economy plan
 * (revenue, COGS, wages, rent, profit) and after location sales that move cash.
 * Restaurant mode also keeps per-restaurant cumulative rollups.
 *
 * Old saves without a ledger get an empty one via normalizeLedger().
 */
(function (global) {
  /** Short educational blurbs shown next to each ledger metric (?). */
  const METRIC_INFO = {
    revenue:
      "Revenue is all the money customers paid you for food and drinks. It is your top-line sales total — before you subtract costs.",
    cogs:
      "COGS (cost of goods sold) is what the ingredients in the items you sold were worth. Buying stock spends cash earlier; COGS tracks that cost when you sell.",
    wages:
      "Wages are what you pay employees each Sell Day. Stand workers cost $5/day; restaurant staff cost $8/day each. More staff can raise sales but also raise this cost.",
    rent:
      "Rent is the daily fee to keep each restaurant open (default $18 per restaurant). Stands do not pay rent. Rent is charged on Sell Day with wages.",
    otherOverhead:
      "Other overhead is extra operating costs that are not COGS, wages, or rent — for example unusual fees from events. Most days this stays at $0.",
    profit:
      "Profit is what is left after costs: revenue − COGS − wages − rent − other overhead. Positive means the business earned more than it spent that day (in accounting terms).",
    cash:
      "Cash is the money in your pocket right now. Sales add cash; buying ingredients, stands, restaurants, and paying wages/rent take cash away.",
    daysOperated:
      "Days operated counts how many Sell Days you have completed. Use it with totals to see average sales or profit per day.",
    restaurantRollup:
      "Each restaurant line adds up that location’s sales, wages, rent, and profit across Sell Days so you can compare staffing and which spot is earning more.",
  };

  const METRIC_LABELS = {
    revenue: "Revenue",
    cogs: "COGS",
    wages: "Wages",
    rent: "Rent",
    otherOverhead: "Other overhead",
    profit: "Profit",
    cash: "Cash on hand",
    daysOperated: "Days operated",
  };

  function money(n) {
    const v = Number(n);
    return Number.isFinite(v) ? +v.toFixed(2) : 0;
  }

  function emptyRestaurantEntry(id, name) {
    return {
      restaurantId: typeof id === "string" ? id : "",
      restaurantName: typeof name === "string" && name ? name : "Restaurant",
      revenue: 0,
      cogs: 0,
      wages: 0,
      rent: 0,
      profit: 0,
      daysOperated: 0,
    };
  }

  function createEmptyLedger() {
    return {
      revenue: 0,
      cogs: 0,
      wages: 0,
      rent: 0,
      otherOverhead: 0,
      profit: 0,
      daysOperated: 0,
      /** Cumulative per-restaurant P&L while in restaurant mode. */
      restaurantBreakdown: {},
    };
  }

  function normalizeRestaurantEntry(raw, fallbackId) {
    const base = emptyRestaurantEntry(
      (raw && raw.restaurantId) || fallbackId || "",
      (raw && raw.restaurantName) || "Restaurant"
    );
    if (!raw || typeof raw !== "object") return base;
    return {
      restaurantId:
        typeof raw.restaurantId === "string" && raw.restaurantId
          ? raw.restaurantId
          : base.restaurantId,
      restaurantName:
        typeof raw.restaurantName === "string" && raw.restaurantName
          ? raw.restaurantName
          : base.restaurantName,
      revenue: money(raw.revenue),
      cogs: money(raw.cogs),
      wages: money(raw.wages),
      rent: money(raw.rent),
      profit: money(raw.profit),
      daysOperated:
        Number.isFinite(raw.daysOperated) && raw.daysOperated >= 0
          ? Math.floor(raw.daysOperated)
          : 0,
    };
  }

  /**
   * Migrate missing / partial ledger blobs from older saves.
   */
  function normalizeLedger(raw) {
    const empty = createEmptyLedger();
    if (!raw || typeof raw !== "object") return empty;

    const breakdown = {};
    if (raw.restaurantBreakdown && typeof raw.restaurantBreakdown === "object") {
      for (const key of Object.keys(raw.restaurantBreakdown)) {
        const entry = normalizeRestaurantEntry(
          raw.restaurantBreakdown[key],
          key
        );
        if (entry.restaurantId) breakdown[entry.restaurantId] = entry;
      }
    }

    return {
      revenue: money(raw.revenue),
      cogs: money(raw.cogs),
      wages: money(raw.wages),
      rent: money(raw.rent),
      otherOverhead: money(raw.otherOverhead),
      profit: money(raw.profit),
      daysOperated:
        Number.isFinite(raw.daysOperated) && raw.daysOperated >= 0
          ? Math.floor(raw.daysOperated)
          : 0,
      restaurantBreakdown: breakdown,
    };
  }

  function ensureLedger(state) {
    if (!state) return createEmptyLedger();
    state.ledger = normalizeLedger(state.ledger);
    return state.ledger;
  }

  /**
   * Add one Sell Day’s plan into running totals (including rent & wages).
   * Per-restaurant lines accumulate from plan.locations when present.
   */
  function recordSellDay(state, plan) {
    if (!state || !plan) return ensureLedger(state);
    const ledger = ensureLedger(state);

    const revenue = money(plan.revenue);
    const cogs = money(plan.cogs != null ? plan.cogs : plan.costs);
    const wages = money(plan.wages);
    const rent = money(plan.rent);
    const other = money(plan.otherOverhead);
    const profit =
      plan.profit != null
        ? money(plan.profit)
        : money(revenue - cogs - wages - rent - other);

    ledger.revenue = money(ledger.revenue + revenue);
    ledger.cogs = money(ledger.cogs + cogs);
    ledger.wages = money(ledger.wages + wages);
    ledger.rent = money(ledger.rent + rent);
    ledger.otherOverhead = money(ledger.otherOverhead + other);
    ledger.profit = money(ledger.profit + profit);
    ledger.daysOperated += 1;

    if (Array.isArray(plan.locations)) {
      for (const loc of plan.locations) {
        if (!loc || typeof loc !== "object") continue;
        const id =
          typeof loc.restaurantId === "string" && loc.restaurantId
            ? loc.restaurantId
            : null;
        if (!id) continue;
        const prev =
          ledger.restaurantBreakdown[id] ||
          emptyRestaurantEntry(id, loc.restaurantName);
        prev.restaurantName =
          typeof loc.restaurantName === "string" && loc.restaurantName
            ? loc.restaurantName
            : prev.restaurantName;
        prev.revenue = money(prev.revenue + money(loc.revenue));
        prev.cogs = money(prev.cogs + money(loc.cogs));
        prev.wages = money(prev.wages + money(loc.wages));
        prev.rent = money(prev.rent + money(loc.rent));
        prev.profit = money(prev.profit + money(loc.profit));
        prev.daysOperated += 1;
        ledger.restaurantBreakdown[id] = prev;
      }
    }

    return ledger;
  }

  /**
   * Location sales (stand / restaurant) change cash but are not operating
   * revenue. Keep cash display fresh; optionally note proceeds as otherIncome
   * is out of scope — cash comes from state.cash at render time.
   * Called so events/sales that mutate cash still refresh ledger shape.
   */
  function recordCashEvent(state, _meta) {
    return ensureLedger(state);
  }

  /**
   * Snapshot of display rows for the Business panel.
   * Cash is always the live state.cash (not a stored total).
   */
  function getDisplayMetrics(state) {
    const ledger = ensureLedger(state);
    const isRestaurant =
      global.GameState &&
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);

    const metrics = [
      { key: "revenue", label: METRIC_LABELS.revenue, value: ledger.revenue, kind: "money" },
      { key: "cogs", label: METRIC_LABELS.cogs, value: ledger.cogs, kind: "money" },
      { key: "wages", label: METRIC_LABELS.wages, value: ledger.wages, kind: "money" },
      { key: "rent", label: METRIC_LABELS.rent, value: ledger.rent, kind: "money" },
      {
        key: "otherOverhead",
        label: METRIC_LABELS.otherOverhead,
        value: ledger.otherOverhead,
        kind: "money",
      },
      { key: "profit", label: METRIC_LABELS.profit, value: ledger.profit, kind: "money" },
      {
        key: "cash",
        label: METRIC_LABELS.cash,
        value: money(state && state.cash),
        kind: "money",
      },
      {
        key: "daysOperated",
        label: METRIC_LABELS.daysOperated,
        value: ledger.daysOperated,
        kind: "count",
      },
    ];

    let restaurants = [];
    if (isRestaurant && ledger.restaurantBreakdown) {
      const owned = Array.isArray(state.restaurants) ? state.restaurants : [];
      const ownedIds = {};
      for (const r of owned) {
        if (r && r.id) ownedIds[r.id] = true;
      }
      // Prefer currently owned restaurants (match day-report locations).
      restaurants = owned
        .map(function (r) {
          const entry =
            ledger.restaurantBreakdown[r.id] ||
            emptyRestaurantEntry(r.id, r.name);
          return {
            restaurantId: r.id,
            restaurantName: r.name || entry.restaurantName,
            revenue: entry.revenue,
            cogs: entry.cogs,
            wages: entry.wages,
            rent: entry.rent,
            profit: entry.profit,
            daysOperated: entry.daysOperated,
          };
        })
        .concat(
          Object.keys(ledger.restaurantBreakdown)
            .filter(function (id) {
              return !ownedIds[id];
            })
            .map(function (id) {
              return ledger.restaurantBreakdown[id];
            })
        );
    }

    return {
      metrics: metrics,
      restaurants: restaurants,
      showRestaurants: isRestaurant && restaurants.length > 0,
      info: METRIC_INFO,
    };
  }

  function infoFor(key) {
    return METRIC_INFO[key] || "";
  }

  global.GameLedger = {
    METRIC_INFO,
    METRIC_LABELS,
    createEmptyLedger,
    normalizeLedger,
    ensureLedger,
    recordSellDay,
    recordCashEvent,
    getDisplayMetrics,
    infoFor,
  };
})(window);
