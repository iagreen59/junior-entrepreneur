/**
 * Costs, demand, sales, profit.
 * Phase 3–4: price-sensitive demand, inventory consumption, P&L.
 * Phase 6: sells the active product (juice or cocoa).
 * Phase 7: typed weather (hot/mild/cold) biases demand toward the
 * weather-matched drink instead of anonymous [0.75, 1.25] noise.
 * Phase 10: coldCups / hotCups keys; costOfGoodsPerServing for recipe UI.
 * Phase 11: activeProduct may be juice|cocoa|burger|soup; Sell Day still
 * resolves a single product (multi-item menu Sell Day is Phase 12).
 *
 * Demand formula (documented for play-testers / future balance):
 *   preference = GameWeather.preferenceFactor(weather, product)
 *                hot+juice|burger / cold+cocoa|soup → 1.35 (match)
 *                hot+cocoa|soup / cold+juice|burger → 0.65 (mismatch)
 *                mild + any                          → 1.00
 *   interest   = BASE_INTEREST * (REF_PRICE / price) ^ ELASTICITY * preference
 *   demand     = floor(max(0, interest))
 *   stockCups  = min over active-recipe ingredients of floor(inv[k] / recipe[k])
 *   cupsSold   = min(demand, stockCups)
 *
 * Cash: ingredients were already paid when bought, so cash += revenue.
 * Reported profit = revenue − COGS (unit buy prices × recipe × cupsSold).
 */
(function (global) {
  /** Typical daily foot traffic at the reference price. */
  const BASE_INTEREST = 20;
  /** Price where BASE_INTEREST customers show up before weather preference. */
  const REF_PRICE = 1.5;
  /** How sharply demand falls as price rises (1 = inverse to price). */
  const ELASTICITY = 1.05;

  function activeProduct(state) {
    return global.GameState.normalizeProduct(state.activeProduct, "juice");
  }

  function servingWord(product, count) {
    if (product === "burger" || product === "soup") {
      return count === 1 ? "serving" : "servings";
    }
    return count === 1 ? "cup" : "cups";
  }

  /**
   * How many cups inventory can support for a product recipe.
   * Defaults to the active product when `product` is omitted.
   * Optional `recipeOverride` lets the recipe UI preview draft amounts.
   */
  function maxCupsFromStock(state, product, recipeOverride) {
    const drink = product || activeProduct(state);
    const recipe =
      recipeOverride ||
      (state.recipes && state.recipes[drink]) ||
      global.GameState.activeRecipe(state) ||
      {};
    const inventory = state.inventory || {};
    const keys = global.GameState.recipeKeysFor(drink);
    let maxCups = Infinity;
    let anyRequirement = false;

    for (const key of keys) {
      const perCup = Number(recipe[key]) || 0;
      if (perCup <= 0) continue;
      anyRequirement = true;
      const onHand = Number(inventory[key]) || 0;
      maxCups = Math.min(maxCups, Math.floor(onHand / perCup));
    }

    if (!anyRequirement) return 0;
    return Math.max(0, maxCups === Infinity ? 0 : maxCups);
  }

  /**
   * COGS for one serving of `product` given its recipe (or draft override).
   * Sum of unitPrice(key) × recipe amount per serving.
   */
  function costOfGoodsPerServing(state, product, recipeOverride) {
    const drink = product || activeProduct(state);
    const recipe =
      recipeOverride ||
      (state.recipes && state.recipes[drink]) ||
      global.GameState.activeRecipe(state) ||
      {};
    const keys = global.GameState.recipeKeysFor(drink);
    let total = 0;
    for (const key of keys) {
      const perCup = Number(recipe[key]) || 0;
      if (perCup <= 0) continue;
      total += perCup * global.GameState.unitPrice(key);
    }
    return +total.toFixed(2);
  }

  /**
   * Price + weather preference demand for selling `product`.
   * `weather` should be hot | mild | cold (from state.weather).
   */
  function demandForPrice(price, weather, product) {
    const sellPrice = Number(price);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
      return Math.floor(BASE_INTEREST * 4);
    }

    const preference = global.GameWeather
      ? global.GameWeather.preferenceFactor(weather, product)
      : 1;
    const interest =
      BASE_INTEREST *
      Math.pow(REF_PRICE / sellPrice, ELASTICITY) *
      preference;
    return Math.max(0, Math.floor(interest));
  }

  function costOfGoods(state, cupsSold) {
    if (cupsSold <= 0) return 0;
    const product = activeProduct(state);
    const recipe = global.GameState.activeRecipe(state) || {};
    const keys = global.GameState.recipeKeysFor(product);
    let total = 0;
    for (const key of keys) {
      const perCup = Number(recipe[key]) || 0;
      if (perCup <= 0) continue;
      const unitCost = global.GameState.unitPrice(key);
      total += perCup * cupsSold * unitCost;
    }
    return +total.toFixed(2);
  }

  function consumeInventory(state, cupsSold) {
    if (cupsSold <= 0) return;
    const product = activeProduct(state);
    const recipe = global.GameState.activeRecipe(state) || {};
    const keys = global.GameState.recipeKeysFor(product);
    for (const key of keys) {
      const perCup = Number(recipe[key]) || 0;
      if (perCup <= 0) continue;
      state.inventory[key] = Math.max(
        0,
        (state.inventory[key] || 0) - perCup * cupsSold
      );
    }
  }

  /**
   * Plan one sell day without mutating inventory.
   * Phase 8 plays this plan as timed customers, then applySellDay commits it.
   */
  function planSellDay(state) {
    const product = activeProduct(state);
    const weather = state.weather || "mild";
    const price = Number(global.GameState.activePrice(state));
    const stockCups = maxCupsFromStock(state, product);
    const demand = demandForPrice(price, weather, product);
    const cupsSold = Math.min(demand, stockCups);

    const revenue = +(cupsSold * (Number.isFinite(price) ? price : 0)).toFixed(2);
    const cogs = costOfGoods(state, cupsSold);
    const profit = +(revenue - cogs).toFixed(2);

    const soldOut = stockCups > 0 && cupsSold === stockCups && demand > stockCups;
    const drink = global.GameState.productLabel(product);
    const preference = global.GameWeather
      ? global.GameWeather.preferenceFactor(weather, product)
      : 1;
    const favor = global.GameWeather
      ? global.GameWeather.favorsProduct(weather, product)
      : null;

    let weatherNote = "";
    if (demand === 0 && stockCups > 0) {
      weatherNote = " Almost nobody stopped by at that price.";
    } else if (favor === false && cupsSold < stockCups) {
      weatherNote =
        " " +
        global.GameWeather.label(weather) +
        " weather cooled interest in " +
        drink +
        ".";
    } else if (favor === true && !soldOut) {
      weatherNote =
        " " +
        global.GameWeather.label(weather) +
        " weather helped " +
        drink +
        " sell.";
    }

    let message =
      "Sold " +
      cupsSold +
      " " +
      drink +
      " " +
      servingWord(product, cupsSold) +
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
        "No stock for today's " +
        drink +
        " recipe — sold 0 " +
        servingWord(product, 0) +
        ". Revenue $0.00, costs $0.00, profit $0.00.";
    } else if (soldOut) {
      message += " Sold out!";
    } else {
      message += weatherNote;
    }

    return {
      product,
      weather,
      preference,
      price: Number.isFinite(price) ? price : 0,
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

  /**
   * Commit a planned sell day: consume inventory for cupsSold.
   * Caller updates cash / day / weather from the plan.
   */
  function applySellDay(state, plan) {
    consumeInventory(state, plan.cupsSold);
    return plan;
  }

  /**
   * Instant sell day (plan + apply). Kept for tests / simple callers.
   */
  function runSellDay(state) {
    const plan = planSellDay(state);
    applySellDay(state, plan);
    return plan;
  }

  function formatMoney(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "$0.00";
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toFixed(2);
  }

  function applyPrice(state, rawPrice) {
    const product = activeProduct(state);
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, message: "Enter a price of $0.00 or more." };
    }
    if (price > 100) {
      return { ok: false, message: "Keep the cup price at $100.00 or less." };
    }
    state.prices[product] = +price.toFixed(2);
    const unit =
      product === "burger" || product === "soup" ? "serving" : "cup";
    return {
      ok: true,
      product,
      price: state.prices[product],
      message:
        "Price for " +
        global.GameState.productLabel(product) +
        " set to " +
        formatMoney(state.prices[product]) +
        " per " +
        unit +
        ".",
    };
  }

  global.GameEconomy = {
    BASE_INTEREST,
    REF_PRICE,
    ELASTICITY,
    maxCupsFromStock,
    costOfGoodsPerServing,
    demandForPrice,
    planSellDay,
    applySellDay,
    runSellDay,
    applyPrice,
  };
})(window);
