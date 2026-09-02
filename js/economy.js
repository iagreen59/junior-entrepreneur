/**
 * Costs, demand, sales, profit.
 * Phase 3–4: price-sensitive demand, inventory consumption, P&L.
 * Phase 6–11: per-product recipes/prices (juice|cocoa|burger|soup).
 * Phase 12: one Sell Day serves every offered menu item; customers choose
 * among offered items weighted by weather preference + price.
 * Phase 14: deduct stand employee wages ($5/day each) from cash/profit.
 * Phase 15: demandMult (foot-traffic event) scales planned demand;
 *           unit prices for COGS respect temporary supplyPriceMult.
 * Phase 16: restaurant mode — capacityMult = 0.7 + 0.2 * employeeCount
 *           scales demand; wages $8/employee + rent (Phase 19: $18/day); P&L
 *           breaks out sales vs wages vs rent vs profit.
 * Phase 17: multi-restaurant — demand/capacity rolled PER restaurant with that
 *           location's staff (shared inventory allocated in ownership order);
 *           rent × restaurant count; day report includes locations[] rollups.
 * Phase 18: Sell Day plans feed GameLedger running totals (caller records).
 * Phase 19: light balance — BASE_INTEREST 22 (was 20) so restaurant rent/wage
 *           overhead creates pressure without instant loss; rent comes from
 *           GameState.RESTAURANT_RENT ($18).
 *
 * Demand formula (Phase 12 multi-item, Phase 16–17 capacity):
 *   offered   = products with menuOffered[p] === true
 *   weight[p] = GameWeather.preferenceFactor(weather, p)
 *               * (demandRefPrice(weather,p) / price[p]) ^ ELASTICITY
 *               (demandRefPrice uses per-product anchors; extreme-weather
 *                matches boost the ref so cocoa/soup margins match juice)
 *   capacityMult = 1 in stand mode;
 *                = 0.7 + 0.2 * restaurant.employeeCount PER restaurant
 *                  (2 staff → 1.1, 3 → 1.3, 4 → 1.5)
 *   demand[p] = floor(max(0, BASE_INTEREST * weight[p] * demandMult * capacityMult))
 *               (invalid / ≤0 price → treat as very cheap: BASE * 4 * pref)
 *               demandMult defaults to 1; foot-traffic surge uses ~1.4
 *   stock[p]  = max sellable from remaining shared bag for that product
 *   sold[p]   = min(demand[p], stock[p])  (bag depletes across restaurants)
 *   cupsSold  = sum over restaurants and products
 *   revenue   = sum sold * price
 *   cogs      = sum costOfGoodsPerServing * sold
 *   wages     = stand: employeeCount * $5; restaurant: sum staff * $8
 *   rent      = restaurant: $18/day × restaurant count (0 in stand mode)
 *   profit    = revenue − cogs − wages − rent
 *
 * Single offered item reduces to the Phase 7 single-product formula.
 * Customers “choose among” offered items in proportion to weight[p]
 * (each item draws its own interest from the foot-traffic pool).
 *
 * Cash: ingredients were already paid when bought, so cash += revenue − wages − rent.
 * Reported profit = revenue − COGS − wages − rent.
 */
(function (global) {
  /**
   * Typical daily foot traffic at the reference price (per item weight).
   * Phase 19: 22 (was 20) — slight demand bump so $18 rent + wages stay avoidable
   * with solid pricing/stock, while multi-restaurant overhead still bites.
   */
  const BASE_INTEREST = 22;
  /** Drink anchor for legacy callers; per-product refs drive demand and reactions. */
  const REF_PRICE = 1.5;
  /** How sharply demand falls as price rises (1 = inverse to price). */
  const ELASTICITY = 1.05;

  /**
   * Default sell-price anchors per product (also used for happy / high-price bands).
   * Kids can charge more on extreme-weather perfect-match days — see favoredPriceMults.
   */
  const PRODUCT_REF_PRICES = {
    juice: 1.5,
    cocoa: 2.0,
    burger: 4.0,
    soup: 3.5,
  };

  /** Baseline happy band: price ≤ ref × this when weather-matched. */
  const HAPPY_MULT_BASE = 1.25;
  /** Above ref × this, buyers often dislike (unless extreme-weather match widens the band). */
  const HIGH_MULT_BASE = 1.6;

  /**
   * Extreme / strong weather: customers happily pay more for the right item.
   * demandRefBoost shifts the demand curve so margins stay fair vs hot-day juice.
   */
  const FAVORED_HAPPY_MULT = {
    steaming: { juice: 1.5, burger: 1.3 },
    hot: { juice: 1.35, burger: 1.25 },
    cold: { cocoa: 1.35, soup: 1.3 },
    bitter: { cocoa: 1.75, soup: 1.3 },
  };
  const FAVORED_HIGH_MULT = {
    steaming: { juice: 2.0, burger: 1.75 },
    hot: { juice: 1.6, burger: 1.6 },
    cold: { cocoa: 1.7, soup: 1.65 },
    bitter: { cocoa: 2.25, soup: 1.75 },
  };
  const FAVORED_DEMAND_REF_BOOST = {
    steaming: { juice: 1.5, burger: 1.1 },
    hot: { juice: 1.2, burger: 1.05 },
    cold: { cocoa: 1.2, soup: 1.1 },
    bitter: { cocoa: 1.75, soup: 1.15 },
  };

  function productRefPrice(product) {
    const key =
      product === "cocoa" ||
      product === "burger" ||
      product === "soup"
        ? product
        : "juice";
    return Number(PRODUCT_REF_PRICES[key]) || REF_PRICE;
  }

  /** Happy / high / demand multipliers when weather favors this product. */
  function favoredPriceMults(weather, product) {
    const favor =
      global.GameWeather && global.GameWeather.favorsProduct
        ? global.GameWeather.favorsProduct(weather, product)
        : null;
    if (favor !== true) {
      return {
        happyMult: HAPPY_MULT_BASE,
        highMult: HIGH_MULT_BASE,
        demandRefBoost: 1,
      };
    }
    const happyMap = FAVORED_HAPPY_MULT[weather] || {};
    const highMap = FAVORED_HIGH_MULT[weather] || {};
    const demandMap = FAVORED_DEMAND_REF_BOOST[weather] || {};
    return {
      happyMult: happyMap[product] != null ? happyMap[product] : HAPPY_MULT_BASE,
      highMult: highMap[product] != null ? highMap[product] : HIGH_MULT_BASE,
      demandRefBoost:
        demandMap[product] != null ? demandMap[product] : 1,
    };
  }

  /** Max price that still earns a happy reaction (weather-favored + great recipe). */
  function happyPriceMax(weather, product) {
    const ref = productRefPrice(product);
    const mults = favoredPriceMults(weather, product);
    return +(ref * mults.happyMult).toFixed(2);
  }

  /** Price above this tends to trigger dislike / price walk-aways. */
  function highPriceThreshold(weather, product) {
    const ref = productRefPrice(product);
    const mults = favoredPriceMults(weather, product);
    return +(ref * mults.highMult).toFixed(2);
  }

  /**
   * Effective reference price in the demand formula for this product today.
   * Boosted on extreme-weather matches so cold-day cocoa can profit like hot-day juice.
   */
  function demandRefPrice(weather, product) {
    const ref = productRefPrice(product);
    const mults = favoredPriceMults(weather, product);
    return +(ref * mults.demandRefBoost).toFixed(3);
  }

  /** Kid-friendly tip for the recipe panel when today's weather favors this item. */
  function priceComfortTip(weather, product) {
    if (
      !global.GameWeather ||
      !global.GameWeather.favorsProduct ||
      global.GameWeather.favorsProduct(weather, product) !== true
    ) {
      return "";
    }
    const label = global.GameWeather.label(weather);
    const happy = happyPriceMax(weather, product);
    const item =
      global.GameState && global.GameState.productLabel
        ? global.GameState.productLabel(product)
        : product;
    if (weather === "steaming" && product === "juice") {
      return (
        label +
        " — shoppers will happily pay up to " +
        formatMoney(happy) +
        " for icy " +
        item +
        "!"
      );
    }
    if (weather === "bitter" && product === "cocoa") {
      return (
        label +
        " — raise " +
        item +
        " toward " +
        formatMoney(happy) +
        "; rich cocoa sells well!"
      );
    }
    if (weather === "steaming" || weather === "hot") {
      if (product === "burger") {
        return (
          label +
          " favors " +
          item +
          " — happy faces up to about " +
          formatMoney(happy) +
          "."
        );
      }
      if (product === "juice") {
        return (
          label +
          " favors " +
          item +
          " — you can charge up to about " +
          formatMoney(happy) +
          "."
        );
      }
    }
    if (weather === "cold" || weather === "bitter") {
      if (product === "soup" || product === "cocoa") {
        return (
          label +
          " favors " +
          item +
          " — happy faces up to about " +
          formatMoney(happy) +
          "."
        );
      }
    }
    return "";
  }

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
      total += perCup * global.GameState.unitPrice(key, state);
    }
    return +total.toFixed(2);
  }

  function recipeForProduct(state, product) {
    return (
      (state.recipes && state.recipes[product]) ||
      global.GameState.activeRecipe(
        Object.assign({}, state, { activeProduct: product })
      ) ||
      {}
    );
  }

  function tasteFactor(state, weather, product) {
    if (!global.GameRecipePrefs) return 1;
    const recipe = recipeForProduct(state, product);
    return global.GameRecipePrefs.demandFactor(product, recipe, weather);
  }

  /**
   * Price + weather + recipe taste demand for selling `product`.
   * `weather` should be one of GameWeather.TYPES (from state.weather).
   */
  function demandForPrice(price, weather, product, state) {
    const preference = global.GameWeather
      ? global.GameWeather.preferenceFactor(weather, product)
      : 1;
    const taste = state ? tasteFactor(state, weather, product) : 1;
    const sellPrice = Number(price);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
      return Math.floor(BASE_INTEREST * 4 * preference * taste);
    }

    const refForDemand = demandRefPrice(weather, product);
    const interest =
      BASE_INTEREST *
      Math.pow(refForDemand / sellPrice, ELASTICITY) *
      preference *
      taste;
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

  function soldOutProductList(demandByProduct, soldByProduct, stockByProduct, offered) {
    const out = [];
    for (const product of offered || productsList()) {
      const want = Math.max(0, demandByProduct[product] | 0);
      const sold = Math.max(0, soldByProduct[product] | 0);
      const stock = Math.max(0, stockByProduct[product] | 0);
      if (want > sold && (stock === 0 || sold >= stock)) {
        out.push(product);
      }
    }
    return out;
  }

  function formatSoldOutNote(soldOutProducts) {
    if (!soldOutProducts || !soldOutProducts.length) {
      return " Sold out of at least one item!";
    }
    const labels = soldOutProducts.map(function (product) {
      return global.GameState.productLabel(product);
    });
    if (labels.length === 1) return " Sold out of " + labels[0] + "!";
    if (labels.length === 2) {
      return " Sold out of " + labels[0] + " and " + labels[1] + "!";
    }
    return (
      " Sold out of " +
      labels.slice(0, -1).join(", ") +
      ", and " +
      labels[labels.length - 1] +
      "!"
    );
  }

  function cloneInventory(inventory) {
    const bag = {};
    const keys = global.GameState.INVENTORY_KEYS || Object.keys(inventory || {});
    for (const key of keys) {
      bag[key] = Number(inventory && inventory[key]) || 0;
    }
    // Preserve any extra keys on the bag.
    if (inventory && typeof inventory === "object") {
      for (const key of Object.keys(inventory)) {
        if (!Object.prototype.hasOwnProperty.call(bag, key)) {
          bag[key] = Number(inventory[key]) || 0;
        }
      }
    }
    return bag;
  }

  /** Max servings for a product from an inventory bag (does not mutate). */
  function maxCupsFromBag(state, product, bag) {
    const recipe =
      (state.recipes && state.recipes[product]) ||
      global.GameState.activeRecipe(
        Object.assign({}, state, { activeProduct: product })
      ) ||
      {};
    const keys = global.GameState.recipeKeysFor(product);
    let maxCups = Infinity;
    let anyRequirement = false;
    for (const key of keys) {
      const perCup = Number(recipe[key]) || 0;
      if (perCup <= 0) continue;
      anyRequirement = true;
      const onHand = Number(bag[key]) || 0;
      maxCups = Math.min(maxCups, Math.floor(onHand / perCup));
    }
    if (!anyRequirement) return 0;
    return Math.max(0, maxCups === Infinity ? 0 : maxCups);
  }

  /** Deduct recipe ingredients for cupsSold from a bag copy. */
  function consumeBagForProduct(state, bag, product, cupsSold) {
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
      bag[key] = Math.max(0, (Number(bag[key]) || 0) - perCup * cupsSold);
    }
  }

  /**
   * Plan sales for one restaurant against a shared inventory bag.
   * Mutates bag as stock is reserved. Returns a location P&L rollup.
   */
  function planRestaurantLocation(state, restaurant, offered, prices, weather, demandMult, bag) {
    const staff = Math.max(0, Number(restaurant.employeeCount) || 0);
    const capacityMult = global.GameState.restaurantCapacityMultFor
      ? global.GameState.restaurantCapacityMultFor(restaurant)
      : +(0.7 + 0.2 * staff).toFixed(2);
    const wageRate = Number(global.GameState.RESTAURANT_WAGE) || 8;
    const rentEach = Number(global.GameState.RESTAURANT_RENT) || 18;
    const menuSurchargePerEmployee =
      global.GameState.menuWageSurchargePerEmployee &&
      global.GameState.menuWageSurchargePerEmployee(state)
        ? global.GameState.menuWageSurchargePerEmployee(state)
        : 0;
    const soldByProduct = emptySoldMap();
    const demandByProduct = emptySoldMap();
    let cupsSold = 0;
    let demand = 0;
    let revenue = 0;
    let cogs = 0;
    let soldOut = false;

    for (const product of offered) {
      const price = prices[product];
      const stock = maxCupsFromBag(state, product, bag);
      const want = Math.max(
        0,
        Math.floor(
          demandForPrice(price, weather, product, state) *
            demandMult *
            capacityMult
        )
      );
      const sold = Math.min(want, stock);
      demandByProduct[product] = want;
      soldByProduct[product] = sold;
      demand += want;
      cupsSold += sold;
      revenue += sold * (Number.isFinite(price) ? price : 0);
      cogs += costOfGoodsForProduct(state, product, sold);
      consumeBagForProduct(state, bag, product, sold);
      if (stock > 0 && sold === stock && want > stock) soldOut = true;
      else if (stock === 0 && want > 0) soldOut = true;
    }

    revenue = +revenue.toFixed(2);
    cogs = +cogs.toFixed(2);
    const wages = +(
      staff * (wageRate + menuSurchargePerEmployee)
    ).toFixed(2);
    const rent = +rentEach.toFixed(2);
    const profit = +(revenue - cogs - wages - rent).toFixed(2);

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      employeeCount: staff,
      capacityMult: capacityMult,
      soldByProduct: soldByProduct,
      demandByProduct: demandByProduct,
      cupsSold: cupsSold,
      demand: demand,
      revenue: revenue,
      cogs: cogs,
      wages: wages,
      rent: rent,
      profit: profit,
      soldOut: soldOut,
    };
  }

  /**
   * Plan one sell day without mutating inventory.
   * Phase 12: every offered menu item is sold in one day.
   * Phase 8 plays this plan as timed customers, then applySellDay commits it.
   * Phase 17: restaurant mode rolls demand per restaurant (shared bag).
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
    const demandMult = global.GameState.demandMultiplier
      ? global.GameState.demandMultiplier(state)
      : Number(state.demandMult) > 0
        ? Number(state.demandMult)
        : 1;

    for (const product of offered) {
      const price = priceOf(state, product);
      prices[product] = Number.isFinite(price) ? price : 0;
      const preference = global.GameWeather
        ? global.GameWeather.preferenceFactor(weather, product)
        : 1;
      preferences[product] = preference;
      preferenceSum += preference;
      stockByProduct[product] = maxCupsFromStock(state, product);
      stockCups += stockByProduct[product];
    }

    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    const locations = [];
    let capacityMult = 1;

    if (isRestaurant && Array.isArray(state.restaurants) && state.restaurants.length) {
      // Per-restaurant demand with shared inventory allocation (ownership order).
      const bag = cloneInventory(state.inventory);
      for (const restaurant of state.restaurants) {
        const loc = planRestaurantLocation(
          state,
          restaurant,
          offered,
          prices,
          weather,
          demandMult,
          bag
        );
        locations.push(loc);
        for (const product of offered) {
          soldByProduct[product] =
            (soldByProduct[product] | 0) + (loc.soldByProduct[product] | 0);
          demandByProduct[product] =
            (demandByProduct[product] | 0) +
            (loc.demandByProduct[product] | 0);
        }
        cupsSold += loc.cupsSold;
        demand += loc.demand;
        revenue += loc.revenue;
        cogs += loc.cogs;
        if (loc.soldOut) soldOut = true;
      }
      // Report weighted-average capacity for headline; UI shows per-location.
      let staffSum = 0;
      for (const loc of locations) staffSum += loc.employeeCount;
      capacityMult =
        locations.length === 1
          ? locations[0].capacityMult
          : global.GameState.restaurantCapacityMultFor
            ? +(
                0.7 +
                0.2 * (staffSum / Math.max(1, locations.length))
              ).toFixed(2)
            : 1;
    } else {
      // Stand mode: single pooled demand (capacityMult = 1).
      capacityMult = 1;
      for (const product of offered) {
        const price = prices[product];
        const stock = stockByProduct[product];
        const want = Math.max(
          0,
          Math.floor(
            demandForPrice(price, weather, product, state) * demandMult * capacityMult
          )
        );
        const sold = Math.min(want, stock);
        demandByProduct[product] = want;
        soldByProduct[product] = sold;
        demand += want;
        cupsSold += sold;
        revenue += sold * (Number.isFinite(price) ? price : 0);
        cogs += costOfGoodsForProduct(state, product, sold);
        if (stock > 0 && sold === stock && want > stock) soldOut = true;
        else if (stock === 0 && want > 0) soldOut = true;
      }
    }

    revenue = +revenue.toFixed(2);
    cogs = +cogs.toFixed(2);
    const employeeCount = global.GameState.employeeCount
      ? global.GameState.employeeCount(state)
      : 0;
    const wageRate = isRestaurant
      ? Number(global.GameState.RESTAURANT_WAGE) || 8
      : Number(global.GameState.STAND_EMPLOYEE_WAGE) || 5;
    const wages = global.GameState.dailyWageCost
      ? global.GameState.dailyWageCost(state)
      : +(employeeCount * wageRate).toFixed(2);
    const rent =
      isRestaurant && global.GameState.dailyRestaurantRent
        ? global.GameState.dailyRestaurantRent(state)
        : 0;
    const restaurant =
      isRestaurant && global.GameState.getActiveRestaurant
        ? global.GameState.getActiveRestaurant(state)
        : null;
    const profit = +(revenue - cogs - wages - rent).toFixed(2);
    const preference =
      offered.length > 0 ? preferenceSum / offered.length : 1;

    const purchases = buildPurchaseList(soldByProduct);
    const breakdown = formatSoldBreakdown(soldByProduct, prices);
    const soldOutProducts = soldOutProductList(
      demandByProduct,
      soldByProduct,
      stockByProduct,
      offered
    );
    if (soldOutProducts.length) soldOut = true;

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

    let locationNote = null;
    if (isRestaurant && locations.length > 0) {
      const parts = locations.map(function (loc) {
        return (
          (loc.restaurantName || "Restaurant") +
          "\n  Sales     " +
          formatMoney(loc.revenue) +
          "\n  Wages     " +
          formatMoney(loc.wages) +
          "\n  Rent      " +
          formatMoney(loc.rent) +
          "\n  Profit    " +
          formatMoney(loc.profit) +
          "\n  Staff     " +
          loc.employeeCount +
          " employee" +
          (loc.employeeCount === 1 ? "" : "s")
        );
      });
      const operating = +(revenue - profit).toFixed(2);
      locationNote =
        (locations.length === 1 ? "Restaurant P&L" : "Per-restaurant P&L") +
        "\n\n" +
        parts.join("\n\n") +
        "\n\nBusiness totals" +
        "\n  Sales     " +
        formatMoney(revenue) +
        "\n  Wages     " +
        formatMoney(wages) +
        "\n  Rent      " +
        formatMoney(rent) +
        "\n  COGS      " +
        formatMoney(cogs) +
        "\n  Operating " +
        formatMoney(operating) +
        "\n  Profit    " +
        formatMoney(profit);
    }

    let message;
    if (locationNote) {
      if (offered.length === 0) {
        message =
          locationNote + "\n\nNo items on today's menu — sold 0 servings.";
      } else if (stockCups === 0) {
        message =
          locationNote +
          "\n\nNo stock for today's offered menu — sold 0 servings.";
      } else if (breakdown.length === 0) {
        message =
          locationNote +
          "\n\nSold 0 servings from today's menu." +
          (weatherNote ? "\n" + weatherNote.trim() : "");
      } else {
        message =
          locationNote +
          "\n\nSold\n  " +
          breakdown.join("\n  ");
        if (soldOut) message += "\n" + formatSoldOutNote(soldOutProducts).trim();
        else if (weatherNote) message += "\n" + weatherNote.trim();
      }
    } else if (offered.length === 0) {
      message =
        "No items on today's menu — sold 0 servings.\n" +
        "Sales     $0.00\n" +
        "Costs     $0.00" +
        (wages > 0 ? "\nWages     " + formatMoney(wages) : "") +
        (rent > 0 ? "\nRent      " + formatMoney(rent) : "") +
        "\nProfit    " +
        formatMoney(profit);
    } else if (stockCups === 0) {
      message =
        "No stock for today's offered menu — sold 0 servings.\n" +
        "Sales     $0.00\n" +
        "Costs     $0.00" +
        (wages > 0 ? "\nWages     " + formatMoney(wages) : "") +
        (rent > 0 ? "\nRent      " + formatMoney(rent) : "") +
        "\nProfit    " +
        formatMoney(profit);
    } else if (breakdown.length === 0) {
      message =
        "Sold 0 servings from today's menu.\n" +
        "Sales     $0.00\n" +
        "Costs     $0.00" +
        (wages > 0 ? "\nWages     " + formatMoney(wages) : "") +
        (rent > 0 ? "\nRent      " + formatMoney(rent) : "") +
        "\nProfit    " +
        formatMoney(profit) +
        (weatherNote ? "\n" + weatherNote.trim() : "");
    } else {
      const operating = +(cogs + wages + rent).toFixed(2);
      message =
        "Sold\n  " +
        breakdown.join("\n  ") +
        "\n\n" +
        "Sales     " +
        formatMoney(revenue) +
        "\nCOGS      " +
        formatMoney(cogs) +
        (wages > 0 ? "\nWages     " + formatMoney(wages) : "") +
        (rent > 0 ? "\nRent      " + formatMoney(rent) : "") +
        (wages > 0 || rent > 0
          ? "\nOperating " + formatMoney(operating)
          : "") +
        "\nProfit    " +
        formatMoney(profit);
      if (soldOut) message += "\n" + formatSoldOutNote(soldOutProducts).trim();
      else if (weatherNote) message += "\n" + weatherNote.trim();
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
      wages: wages,
      rent: rent,
      employeeCount: employeeCount,
      capacityMult: capacityMult,
      isRestaurant: !!isRestaurant,
      restaurantId: restaurant ? restaurant.id : null,
      restaurantName: restaurant ? restaurant.name : null,
      locations: locations,
      restaurantCount: locations.length,
      profit: profit,
      demandMult: demandMult,
      cashAfter: +(state.cash + revenue - wages - rent).toFixed(2),
      soldOut: soldOut,
      soldOutProducts: soldOutProducts,
      recipes: offered.reduce(function (acc, product) {
        const recipe = recipeForProduct(state, product);
        acc[product] = Object.assign({}, recipe);
        return acc;
      }, {}),
      message: message,
    };
  }

  /**
   * Commit a planned sell day: consume inventory for each sold product.
   * Caller updates cash / day / weather from the plan, and should call
   * GameLedger.recordSellDay so the Business ledger stays in sync.
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
    PRODUCT_REF_PRICES,
    HAPPY_MULT_BASE,
    HIGH_MULT_BASE,
    productRefPrice,
    favoredPriceMults,
    happyPriceMax,
    highPriceThreshold,
    demandRefPrice,
    priceComfortTip,
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
