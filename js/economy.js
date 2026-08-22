/**
 * Costs, demand, sales, profit.
 * Phase 3–4: price-sensitive demand, inventory consumption, P&L.
 * Phase 6–11: per-product recipes/prices (juice|cocoa|burger|soup).
 * Phase 12: one Sell Day serves every offered menu item; customers choose
 * among offered items weighted by weather preference + price.
 *
 * Demand formula (Phase 12 multi-item):
 *   offered   = products with menuOffered[p] === true
 *   weight[p] = GameWeather.preferenceFactor(weather, p)
 *               * (REF_PRICE / price[p]) ^ ELASTICITY
 *               (preference: match 1.35, mismatch 0.65, mild 1.00 —
 *                hot favors juice+burger; cold favors cocoa+soup)
 *   demand[p] = floor(max(0, BASE_INTEREST * weight[p]))
 *               (invalid / ≤0 price → treat as very cheap: BASE * 4 * pref)
 *   stock[p]  = maxCupsFromStock for that product's recipe
 *   sold[p]   = min(demand[p], stock[p])
 *   cupsSold  = sum_p sold[p]
 *   demand    = sum_p demand[p]
 *   revenue   = sum_p sold[p] * price[p]
 *   cogs      = sum_p costOfGoodsPerServing(p) * sold[p]
 *   profit    = revenue − cogs
 *
 * Single offered item reduces to the Phase 7 single-product formula.
 * Customers “choose among” offered items in proportion to weight[p]
 * (each item draws its own interest from the foot-traffic pool).
 *
 * Cash: ingredients were already paid when bought, so cash += revenue.
 * Reported profit = revenue − COGS (unit buy prices × recipe × sold).
 */
(function (global) {
  /** Typical daily foot traffic at the reference price (per item weight). */
  const BASE_INTEREST = 20;
  /** Price where BASE_INTEREST customers show up before weather preference. */
  const REF_PRICE = 1.5;
  /** How sharply demand falls as price rises (1 = inverse to price). */
  const ELASTICITY = 1.05;

  function activeProduct(state) {
    return global.GameState.normalizeProduct(state.activeProduct, "juice");
  }

  function productsList() {
    return global.GameState.PRODUCTS
      ? global.GameState.PRODUCTS.slice()
      : ["juice", "cocoa", "burger", "soup"];
  }

  /** Products toggled on for today's menu. */
  function offeredProducts(state) {
    return productsList().filter(function (product) {
      return global.GameState.isMenuOffered(state, product);
    });
  }

  function emptySoldMap() {
    const map = {};
    for (const product of productsList()) map[product] = 0;
    return map;
  }

  function servingWord(product, count) {
    if (product === "burger" || product === "soup") {
      return count === 1 ? "serving" : "servings";
    }
    return count === 1 ? "cup" : "cups";
  }

  /**
   * How many servings inventory can support for a product recipe.
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
      const preference = global.GameWeather
        ? global.GameWeather.preferenceFactor(weather, product)
        : 1;
      return Math.floor(BASE_INTEREST * 4 * preference);
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

  function priceOf(state, product) {
    if (state.prices && Number.isFinite(Number(state.prices[product]))) {
      return Number(state.prices[product]);
    }
    return Number(global.GameState.activePrice(state)) || 0;
  }

  function costOfGoodsForProduct(state, product, cupsSold) {
    if (cupsSold <= 0) return 0;
    return +(costOfGoodsPerServing(state, product) * cupsSold).toFixed(2);
  }

  function consumeInventoryForProduct(state, product, cupsSold) {
    if (cupsSold <= 0) return;
    const recipe =
      (state.recipes && state.recipes[product]) ||
      global.GameState.activeRecipe(
        Object.assign({}, state, { activeProduct: product })
      ) ||
      {};
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

  function buildPurchaseList(soldByProduct) {
    const purchases = [];
    for (const product of productsList()) {
      const n = Math.max(0, soldByProduct[product] | 0);
      for (let i = 0; i < n; i++) purchases.push(product);
    }
    return purchases;
  }

  function formatSoldBreakdown(soldByProduct, prices) {
    const parts = [];
    for (const product of productsList()) {
      const n = soldByProduct[product] | 0;
      if (n <= 0) continue;
      const label = global.GameState.productLabel(product);
      const price = prices[product];
      parts.push(
        n +
          " " +
          label +
          " " +
          servingWord(product, n) +
          " @ " +
          formatMoney(price)
      );
    }
    return parts;
  }

  /**
   * Plan one sell day without mutating inventory.
   * Phase 12: every offered menu item is sold in one day.
   * Phase 8 plays this plan as timed customers, then applySellDay commits it.
   */
  function planSellDay(state) {
    const weather = state.weather || "mild";
    const offered = offeredProducts(state);
    const soldByProduct = emptySoldMap();
    const demandByProduct = emptySoldMap();
    const stockByProduct = emptySoldMap();
    const preferences = {};
    const prices = {};

    let cupsSold = 0;
    let demand = 0;
    let stockCups = 0;
    let revenue = 0;
    let cogs = 0;
    let soldOut = false;
    let preferenceSum = 0;

    for (const product of offered) {
      const price = priceOf(state, product);
      prices[product] = Number.isFinite(price) ? price : 0;
      const preference = global.GameWeather
        ? global.GameWeather.preferenceFactor(weather, product)
        : 1;
      preferences[product] = preference;
      preferenceSum += preference;

      const stock = maxCupsFromStock(state, product);
      const want = demandForPrice(price, weather, product);
      const sold = Math.min(want, stock);

      stockByProduct[product] = stock;
      demandByProduct[product] = want;
      soldByProduct[product] = sold;

      stockCups += stock;
      demand += want;
      cupsSold += sold;
      revenue += sold * (Number.isFinite(price) ? price : 0);
      cogs += costOfGoodsForProduct(state, product, sold);

      if (stock > 0 && sold === stock && want > stock) {
        soldOut = true;
      }
    }

    revenue = +revenue.toFixed(2);
    cogs = +cogs.toFixed(2);
    const profit = +(revenue - cogs).toFixed(2);
    const preference =
      offered.length > 0 ? preferenceSum / offered.length : 1;

    const purchases = buildPurchaseList(soldByProduct);
    const breakdown = formatSoldBreakdown(soldByProduct, prices);

    let weatherNote = "";
    if (offered.length > 0 && demand === 0 && stockCups > 0) {
      weatherNote = " Almost nobody stopped by at those prices.";
    } else if (offered.length > 0) {
      const favors = offered.filter(function (product) {
        return global.GameWeather
          ? global.GameWeather.favorsProduct(weather, product) === true
          : false;
      });
      const mismatches = offered.filter(function (product) {
        return global.GameWeather
          ? global.GameWeather.favorsProduct(weather, product) === false
          : false;
      });
      if (favors.length && !soldOut) {
        weatherNote =
          " " +
          global.GameWeather.label(weather) +
          " weather helped " +
          favors
            .map(function (p) {
              return global.GameState.productLabel(p);
            })
            .join(" / ") +
          ".";
      } else if (mismatches.length === offered.length && cupsSold < stockCups) {
        weatherNote =
          " " +
          global.GameWeather.label(weather) +
          " weather cooled interest in today's menu.";
      }
    }

    let message;
    if (offered.length === 0) {
      message =
        "No items on today's menu — sold 0 servings. Revenue $0.00, costs $0.00, profit $0.00.";
    } else if (stockCups === 0) {
      message =
        "No stock for today's offered menu — sold 0 servings. Revenue $0.00, costs $0.00, profit $0.00.";
    } else if (breakdown.length === 0) {
      message =
        "Sold 0 servings from today's menu. Revenue $0.00, costs $0.00, profit $0.00." +
        weatherNote;
    } else {
      message =
        "Sold " +
        breakdown.join("; ") +
        ". Revenue " +
        formatMoney(revenue) +
        ", costs " +
        formatMoney(cogs) +
        ", profit " +
        formatMoney(profit) +
        ".";
      if (soldOut) message += " Sold out of at least one item!";
      else message += weatherNote;
    }

    // Primary product field kept for older UI paths; multi-item uses soldByProduct.
    const primary =
      offered.length === 1
        ? offered[0]
        : offered.includes(activeProduct(state))
          ? activeProduct(state)
          : offered[0] || activeProduct(state);

    return {
      product: primary,
      products: offered.slice(),
      soldByProduct: soldByProduct,
      demandByProduct: demandByProduct,
      stockByProduct: stockByProduct,
      preferences: preferences,
      prices: prices,
      purchases: purchases,
      weather: weather,
      preference: preference,
      price: prices[primary] != null ? prices[primary] : 0,
      cupsSold: cupsSold,
      demand: demand,
      stockCups: stockCups,
      revenue: revenue,
      cogs: cogs,
      profit: profit,
      cashAfter: +(state.cash + revenue).toFixed(2),
      soldOut: soldOut,
      message: message,
    };
  }

  /**
   * Commit a planned sell day: consume inventory for each sold product.
   * Caller updates cash / day / weather from the plan.
   */
  function applySellDay(state, plan) {
    if (plan && plan.soldByProduct) {
      for (const product of productsList()) {
        consumeInventoryForProduct(
          state,
          product,
          plan.soldByProduct[product] | 0
        );
      }
      return plan;
    }
    // Legacy single-product plan fallback.
    consumeInventoryForProduct(
      state,
      (plan && plan.product) || activeProduct(state),
      (plan && plan.cupsSold) || 0
    );
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
    offeredProducts,
    maxCupsFromStock,
    costOfGoodsPerServing,
    demandForPrice,
    planSellDay,
    applySellDay,
    runSellDay,
    applyPrice,
  };
})(window);
