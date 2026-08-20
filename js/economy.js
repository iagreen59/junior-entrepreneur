/**
 * Costs, demand, sales, profit.
 * Phase 3: real Sell Day — price-sensitive demand, weather noise, inventory
 * consumption, and end-of-day P&L. Replaces the Phase 1 stub.
 *
 * Demand formula (documented for play-testers / future balance):
 *   interest = BASE_INTEREST * (REF_PRICE / price) ^ ELASTICITY * weather
 *   weather  = uniform random in [WEATHER_MIN, WEATHER_MAX]
 *   demand   = floor(max(0, interest))
 *   stockCups = min over ingredients of floor(inv[k] / recipe[k])
 *               (ingredients with recipe[k] === 0 are ignored)
 *   cupsSold = min(demand, stockCups)
 *
 * Cash: ingredients were already paid when bought, so cash += revenue.
 * Reported profit = revenue − COGS (unit buy prices × recipe × cupsSold).
 * Profit can be negative when selling below ingredient cost.
 */
(function (global) {
  /** Typical daily foot traffic at the reference price. */
  const BASE_INTEREST = 18;
  /** Price where BASE_INTEREST customers show up before weather. */
  const REF_PRICE = 1.5;
  /** How sharply demand falls as price rises (1 = inverse to price). */
  const ELASTICITY = 1.15;
  const WEATHER_MIN = 0.7;
  const WEATHER_MAX = 1.3;

  function weatherFactor(randomFn) {
    const roll = typeof randomFn === "function" ? randomFn() : Math.random();
    return WEATHER_MIN + (WEATHER_MAX - WEATHER_MIN) * roll;
  }

  /**
   * How many cups inventory can support for the current recipe.
   * Returns 0 if the recipe cannot produce any cups (e.g. cups recipe = 0
   * should not happen after Phase 2 validation, but guard anyway).
   */
  function maxCupsFromStock(state) {
    const recipe = state.recipe || {};
    const inventory = state.inventory || {};
    let maxCups = Infinity;
    let anyRequirement = false;

    for (const key of global.GameState.INVENTORY_KEYS) {
      const perCup = Number(recipe[key]) || 0;
      if (perCup <= 0) continue;
      anyRequirement = true;
      const onHand = Number(inventory[key]) || 0;
      maxCups = Math.min(maxCups, Math.floor(onHand / perCup));
    }

    if (!anyRequirement) return 0;
    return Math.max(0, maxCups === Infinity ? 0 : maxCups);
  }

  function demandForPrice(price, randomFn) {
    const sellPrice = Number(price);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
      // Free / invalid → treat as huge interest, still capped by stock later.
      return Math.floor(BASE_INTEREST * 4);
    }

    const weather = weatherFactor(randomFn);
    const interest =
      BASE_INTEREST * Math.pow(REF_PRICE / sellPrice, ELASTICITY) * weather;
    return Math.max(0, Math.floor(interest));
  }

  function costOfGoods(state, cupsSold) {
    if (cupsSold <= 0) return 0;
    let total = 0;
    for (const key of global.GameState.INVENTORY_KEYS) {
      const perCup = Number(state.recipe[key]) || 0;
      if (perCup <= 0) continue;
      const unitCost = global.GameState.unitPrice(key);
      total += perCup * cupsSold * unitCost;
    }
    return +total.toFixed(2);
  }

  function consumeInventory(state, cupsSold) {
    if (cupsSold <= 0) return;
    for (const key of global.GameState.INVENTORY_KEYS) {
      const perCup = Number(state.recipe[key]) || 0;
      if (perCup <= 0) continue;
      state.inventory[key] = Math.max(
        0,
        (state.inventory[key] || 0) - perCup * cupsSold
      );
    }
  }

  /**
   * Run one real sell day. Mutates inventory on success path.
   * Returns report fields; caller advances day and cash.
   *
   * Optional `randomFn` (0..1) is for tests / deterministic play-checks.
   */
  function runSellDay(state, randomFn) {
    const price = Number(state.price);
    const stockCups = maxCupsFromStock(state);
    const demand = demandForPrice(price, randomFn);
    const cupsSold = Math.min(demand, stockCups);

    const revenue = +(cupsSold * (Number.isFinite(price) ? price : 0)).toFixed(2);
    const cogs = costOfGoods(state, cupsSold);
    const profit = +(revenue - cogs).toFixed(2);

    consumeInventory(state, cupsSold);

    const soldOut = stockCups > 0 && cupsSold === stockCups && demand > stockCups;
    const weatherNote =
      demand === 0 && stockCups > 0
        ? " Almost nobody stopped by at that price."
        : "";

    let message =
      "Sold " +
      cupsSold +
      " cup" +
      (cupsSold === 1 ? "" : "s") +
      " at " +
      formatMoney(price) +
      ". Revenue " +
      formatMoney(revenue) +
      ", costs " +
      formatMoney(cogs) +
      ", profit " +
      formatMoney(profit) +
      ".";

    if (stockCups === 0) {
      message =
        "No stock for today's recipe — sold 0 cups. Revenue $0.00, costs $0.00, profit $0.00.";
    } else if (soldOut) {
      message += " Sold out!";
    } else {
      message += weatherNote;
    }

    return {
      cupsSold,
      demand,
      stockCups,
      revenue,
      cogs,
      profit,
      cashAfter: +(state.cash + revenue).toFixed(2),
      soldOut,
      message,
    };
  }

  function formatMoney(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "$0.00";
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toFixed(2);
  }

  /**
   * Validate and apply a sell-price draft from the Price panel.
   * Returns { ok, message, price? } — mutates state only on success.
   */
  function applyPrice(state, rawPrice) {
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, message: "Enter a price of $0.00 or more." };
    }
    // Cap absurd inputs so demand math stays sane.
    if (price > 100) {
      return { ok: false, message: "Keep the cup price at $100.00 or less." };
    }
    state.price = +price.toFixed(2);
    return {
      ok: true,
      price: state.price,
      message: "Price set to " + formatMoney(state.price) + " per cup.",
    };
  }

  global.GameEconomy = {
    BASE_INTEREST,
    REF_PRICE,
    ELASTICITY,
    WEATHER_MIN,
    WEATHER_MAX,
    maxCupsFromStock,
    demandForPrice,
    runSellDay,
    applyPrice,
  };
})(window);
