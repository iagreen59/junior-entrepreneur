/**
 * Phase 8–12: timed customer events that visualize a planned sell day.
 * Buy count always equals plan.cupsSold so the stage matches P&L.
 * Phase 12: buy events carry `product` (what they bought); summary
 * aggregates sold counts by item plus leave reasons.
 *
 * Day length ≈ DAY_MS (10s). Events are spaced across the day; leave
 * reasons: price | stock | weather. Buy reactions: like | dislike | happy.
 * Stock ("sold out") leaves always follow the buy window so successful
 * purchases never appear after the stand runs out.
 */
(function (global) {
  const DAY_MS = 10000;
  /** Cap walk-aways so the stage stays readable (buys still match cupsSold). */
  const MAX_WALKAWAYS = 8;
  const LEAVE_REASONS = ["price", "stock", "weather"];
  const BUY_REACTIONS = ["like", "dislike", "happy"];

  function productsList() {
    return global.GameState && global.GameState.PRODUCTS
      ? global.GameState.PRODUCTS.slice()
      : ["juice", "cocoa", "burger", "soup"];
  }

  function emptyProductCounts() {
    const map = {};
    for (const product of productsList()) map[product] = 0;
    return map;
  }

  function rand(randomFn) {
    return typeof randomFn === "function" ? randomFn() : Math.random();
  }

  function shuffle(list, randomFn) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand(randomFn) * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function recipeForProduct(plan, state, product) {
    if (plan.recipes && plan.recipes[product]) return plan.recipes[product];
    if (state.recipes && state.recipes[product]) return state.recipes[product];
    return global.GameState
      ? global.GameState.activeRecipe(
          Object.assign({}, state, { activeProduct: product })
        )
      : {};
  }

  function buyReactionForProduct(plan, state, product, randomFn) {
    const weather = plan.weather || state.weather || "mild";
    const price =
      plan.prices && Number.isFinite(Number(plan.prices[product]))
        ? Number(plan.prices[product])
        : Number(plan.price);
    const favor = global.GameWeather
      ? global.GameWeather.favorsProduct(weather, product)
      : null;
    const ref = global.GameEconomy.REF_PRICE || 1.5;
    const goodPrice = Number.isFinite(price) && price <= ref * 1.25;
    const highPrice = Number.isFinite(price) && price > ref * 1.6;
    const recipe = recipeForProduct(plan, state, product);
    const tasteScore = global.GameRecipePrefs
      ? global.GameRecipePrefs.recipeScore(product, recipe, weather)
      : 0.75;
    const greatTaste = tasteScore >= 0.85;
    const poorTaste = tasteScore < 0.55;

    if (favor === true && goodPrice && greatTaste) return "happy";
    if (favor === false || highPrice || poorTaste) {
      const dislikeChance = poorTaste ? 0.75 : highPrice ? 0.65 : 0.55;
      return rand(randomFn) < dislikeChance ? "dislike" : "like";
    }
    if (favor === true && greatTaste) {
      return rand(randomFn) < 0.75 ? "happy" : "like";
    }
    if (favor === true && goodPrice) return "happy";
    if (favor === true) return rand(randomFn) < 0.7 ? "happy" : "like";
    if (greatTaste) return rand(randomFn) < 0.6 ? "like" : "happy";
    return rand(randomFn) < 0.55 ? "like" : "happy";
  }

  /**
   * Expand plan.soldByProduct / plan.purchases into buy event stubs.
   * Guarantees buy count === plan.cupsSold.
   */
  function buildBuyEvents(plan, state, randomFn) {
    const events = [];
    if (plan.purchases && plan.purchases.length) {
      for (const product of plan.purchases) {
        events.push({
          outcome: "buy",
          product: product,
          reason: null,
          reaction: buyReactionForProduct(plan, state, product, randomFn),
        });
      }
      return events;
    }

    if (plan.soldByProduct) {
      for (const product of productsList()) {
        const n = Math.max(0, plan.soldByProduct[product] | 0);
        for (let i = 0; i < n; i++) {
          events.push({
            outcome: "buy",
            product: product,
            reason: null,
            reaction: buyReactionForProduct(plan, state, product, randomFn),
          });
        }
      }
      return events;
    }

    // Legacy single-product plan.
    const cupsSold = Math.max(0, plan.cupsSold | 0);
    const product = plan.product || state.activeProduct || "juice";
    for (let i = 0; i < cupsSold; i++) {
      events.push({
        outcome: "buy",
        product: product,
        reason: null,
        reaction: buyReactionForProduct(plan, state, product, randomFn),
      });
    }
    return events;
  }

  /**
   * Extra walk-aways for weather / price across the offered menu.
   * Returns leave stubs with the product customers were unhappy about.
   */
  function leaveExtras(plan, state) {
    const weather = plan.weather || state.weather || "mild";
    const offered =
      plan.products && plan.products.length
        ? plan.products.slice()
        : [plan.product || state.activeProduct || "juice"];

    const weatherProducts = [];
    const priceProducts = [];
    const ref = global.GameEconomy.REF_PRICE || 1.5;

    let mismatchCount = 0;
    let matchCount = 0;
    let prefSum = 0;
    let highPriceCount = 0;
    let maxPriceRatio = 1;

    for (const product of offered) {
      const favor = global.GameWeather
        ? global.GameWeather.favorsProduct(weather, product)
        : null;
      if (favor === false) {
        mismatchCount += 1;
        weatherProducts.push(product);
      }
      if (favor === true) matchCount += 1;
      const pref =
        plan.preferences && Number.isFinite(plan.preferences[product])
          ? plan.preferences[product]
          : global.GameWeather
            ? global.GameWeather.preferenceFactor(weather, product)
            : 1;
      prefSum += pref;

      const price =
        plan.prices && Number.isFinite(Number(plan.prices[product]))
          ? Number(plan.prices[product])
          : Number(plan.price);
      if (Number.isFinite(price) && price > ref) {
        highPriceCount += 1;
        maxPriceRatio = Math.max(maxPriceRatio, price / ref);
        priceProducts.push(product);
      }
    }

    let weatherLeft = 0;
    let priceLeft = 0;
    const avgPref = offered.length ? prefSum / offered.length : 1;
    if (mismatchCount > 0 && matchCount === 0) {
      weatherLeft = Math.max(2, Math.round(8 * (1 - Math.min(avgPref, 1))));
    } else if (mismatchCount > 0) {
      weatherLeft = Math.max(1, mismatchCount);
    } else if (matchCount === 0) {
      weatherLeft = 1; // mild
      if (!weatherProducts.length && offered.length) {
        weatherProducts.push(offered[0]);
      }
    }

    if (highPriceCount > 0) {
      priceLeft = Math.max(1, Math.round((maxPriceRatio - 1) * 6));
    }
    if (maxPriceRatio > 2) {
      priceLeft += 3;
    }

    weatherLeft = Math.min(weatherLeft, MAX_WALKAWAYS);
    priceLeft = Math.min(priceLeft, MAX_WALKAWAYS);

    return {
      weatherLeft: weatherLeft,
      priceLeft: priceLeft,
      weatherProducts: weatherProducts.length ? weatherProducts : offered.slice(),
      priceProducts: priceProducts.length ? priceProducts : offered.slice(),
    };
  }

  /** Spread count leave events across candidate products (round-robin). */
  function leaveEventsFor(reason, count, products) {
    const events = [];
    const pool =
      products && products.length ? products : ["juice"];
    for (let i = 0; i < count; i++) {
      events.push({
        outcome: "leave",
        product: pool[i % pool.length],
        reason: reason,
        reaction: null,
      });
    }
    return events;
  }

  /**
   * Sold-out leave counts per product from demand vs sold.
   */
  function soldOutLeaveProducts(plan) {
    const products = [];
    const demandBy =
      (plan && plan.demandByProduct) || {};
    const soldBy =
      (plan && plan.soldByProduct) || {};
    const offered =
      plan && plan.products && plan.products.length
        ? plan.products
        : productsList();
    for (const product of offered) {
      const want = Math.max(0, demandBy[product] | 0);
      const sold = Math.max(0, soldBy[product] | 0);
      const short = Math.max(0, want - sold);
      for (let i = 0; i < short; i++) products.push(product);
    }
    return products;
  }

  /**
   * Build a playable timeline from an economy plan.
   * Guarantees: buy events === plan.cupsSold (and per-item sold counts).
   */
  function buildTimeline(plan, state, randomFn) {
    const events = buildBuyEvents(plan, state, randomFn);
    const cupsSold = Math.max(0, plan.cupsSold | 0);

    // Pad / trim buys if rounding ever drifts (should not happen).
    while (events.length > cupsSold) events.pop();
    while (events.length < cupsSold) {
      const fallback =
        (plan.products && plan.products[0]) ||
        plan.product ||
        state.activeProduct ||
        "juice";
      events.push({
        outcome: "buy",
        product: fallback,
        reason: null,
        reaction: buyReactionForProduct(plan, state, fallback, randomFn),
      });
    }

    const demand = Math.max(0, plan.demand | 0);
    const stockLeftAfter = Math.max(0, (plan.stockCups | 0) - cupsSold);
    const soldOutLeft = Math.min(
      MAX_WALKAWAYS,
      Math.max(0, demand - cupsSold)
    );
    const soldOutPool = soldOutLeaveProducts(plan);
    const stockProducts =
      soldOutPool.length > 0
        ? soldOutPool
        : (plan.products && plan.products.length
            ? plan.products
            : [plan.product || state.activeProduct || "juice"]);
    events.push.apply(
      events,
      leaveEventsFor("stock", soldOutLeft, stockProducts)
    );

    const extras = leaveExtras(plan, state);
    events.push.apply(
      events,
      leaveEventsFor("weather", extras.weatherLeft, extras.weatherProducts)
    );
    events.push.apply(
      events,
      leaveEventsFor("price", extras.priceLeft, extras.priceProducts)
    );

    if (events.length === 0) {
      events.push({
        outcome: "leave",
        product:
          (plan.products && plan.products[0]) ||
          plan.product ||
          state.activeProduct ||
          "juice",
        reason: "price",
        reaction: null,
      });
    }

    // Sold-out (stock) leaves must come after all buys.
    const stockEvents = [];
    const earlyEvents = [];
    for (const event of events) {
      if (event.outcome === "leave" && event.reason === "stock") {
        stockEvents.push(event);
      } else {
        earlyEvents.push(event);
      }
    }
    const ordered = shuffle(earlyEvents, randomFn).concat(stockEvents);
    const n = ordered.length;
    const timeline = ordered.map(function (event, index) {
      const t =
        n === 1
          ? DAY_MS * 0.45
          : Math.round((index / (n - 1)) * (DAY_MS * 0.92) + DAY_MS * 0.04);
      return {
        atMs: t,
        outcome: event.outcome,
        product: event.product || null,
        reason: event.reason,
        reaction: event.reaction,
      };
    });

    const summary = summarize(timeline);
    summary.stockLeftAfter = stockLeftAfter;

    return {
      dayMs: DAY_MS,
      events: timeline,
      summary: summary,
      plan: plan,
    };
  }

  function emptyFeedbackRow() {
    return {
      happy: 0,
      likes: 0,
      dislikes: 0,
      leftStock: 0,
      leftPrice: 0,
      leftWeather: 0,
      bought: 0,
      left: 0,
    };
  }

  function summarize(events) {
    const summary = {
      bought: 0,
      left: 0,
      leftPrice: 0,
      leftStock: 0,
      leftWeather: 0,
      likes: 0,
      dislikes: 0,
      happy: 0,
      boughtByProduct: emptyProductCounts(),
      byProduct: {},
    };
    for (const product of productsList()) {
      summary.byProduct[product] = emptyFeedbackRow();
    }
    for (const event of events) {
      const product = event.product || null;
      const row =
        product && summary.byProduct[product]
          ? summary.byProduct[product]
          : null;
      if (event.outcome === "buy") {
        summary.bought += 1;
        if (product && summary.boughtByProduct[product] != null) {
          summary.boughtByProduct[product] += 1;
        }
        if (row) row.bought += 1;
        if (event.reaction === "like") {
          summary.likes += 1;
          if (row) row.likes += 1;
        } else if (event.reaction === "dislike") {
          summary.dislikes += 1;
          if (row) row.dislikes += 1;
        } else if (event.reaction === "happy") {
          summary.happy += 1;
          if (row) row.happy += 1;
        }
      } else {
        summary.left += 1;
        if (row) row.left += 1;
        if (event.reason === "price") {
          summary.leftPrice += 1;
          if (row) row.leftPrice += 1;
        } else if (event.reason === "stock") {
          summary.leftStock += 1;
          if (row) row.leftStock += 1;
        } else if (event.reason === "weather") {
          summary.leftWeather += 1;
          if (row) row.leftWeather += 1;
        }
      }
    }
    return summary;
  }

  function nowMs() {
    return typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  }

  /**
   * Play a timeline. Calls onEvent(event, index) and onDone().
   * Uses one short interval instead of N+1 long timeouts so iOS Safari
   * cannot drop the end-of-day timer after the last customer.
   * Returns a controller { cancel() }.
   */
  function play(timeline, { onEvent, onDone } = {}) {
    const events = (timeline && timeline.events) || [];
    const dayMs = (timeline && timeline.dayMs) || DAY_MS;
    let cancelled = false;
    let finished = false;
    let index = 0;
    const startedAt = nowMs();
    let tickId = 0;

    function finish() {
      if (cancelled || finished) return;
      finished = true;
      clearInterval(tickId);
      if (typeof onDone === "function") {
        onDone(timeline.summary, timeline.plan);
      }
    }

    function tick() {
      if (cancelled || finished) return;
      const elapsed = nowMs() - startedAt;
      while (index < events.length && events[index].atMs <= elapsed) {
        const event = events[index];
        const eventIndex = index;
        index += 1;
        if (typeof onEvent === "function") {
          try {
            onEvent(event, eventIndex);
          } catch {
            // Keep the day moving if a chip fails to render.
          }
        }
      }
      if (elapsed >= dayMs) finish();
    }

    tickId = setInterval(tick, 50);
    tick();

    return {
      cancel: function () {
        cancelled = true;
        clearInterval(tickId);
      },
    };
  }

  function leaveReasonLabel(reason, product) {
    const item = product ? productShortLabel(product) : null;
    if (reason === "price") {
      return item ? item + " · price too high" : "Price too high";
    }
    if (reason === "stock") {
      return item ? "Sold out of " + item : "Sold out";
    }
    if (reason === "weather") {
      return item ? item + " · weather mismatch" : "Weather mismatch";
    }
    return item ? "Left · " + item : "Left";
  }

  function buyReactionLabel(reaction, product) {
    const item = product ? productShortLabel(product) : null;
    if (reaction === "happy") return item ? item + " · happy" : "Happy";
    if (reaction === "like") return item ? item + " · liked" : "Liked it";
    if (reaction === "dislike") {
      return item ? "Disliked " + item : "Disliked it";
    }
    return item ? "Bought " + item : "Bought";
  }

  function productShortLabel(product) {
    if (product === "cocoa") return "Cocoa";
    if (product === "burger") return "Burger";
    if (product === "soup") return "Soup";
    if (product === "juice") return "Juice";
    return "Item";
  }

  global.GameCustomers = {
    DAY_MS,
    MAX_WALKAWAYS,
    LEAVE_REASONS,
    BUY_REACTIONS,
    buildTimeline,
    summarize,
    play,
    leaveReasonLabel,
    buyReactionLabel,
    productShortLabel,
  };
})(window);
