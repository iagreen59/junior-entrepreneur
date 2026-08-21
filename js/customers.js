/**
 * Phase 8: timed customer events that visualize a planned sell day.
 * Buy count always equals plan.cupsSold so the stage matches P&L.
 *
 * Day length ≈ DAY_MS (10s). Events are spaced across the day; leave
 * reasons: price | stock | weather. Buy reactions: like | dislike | happy.
 */
(function (global) {
  const DAY_MS = 10000;
  const LEAVE_REASONS = ["price", "stock", "weather"];
  const BUY_REACTIONS = ["like", "dislike", "happy"];

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

  function buyReaction(plan, state, randomFn) {
    const weather = plan.weather || state.weather || "mild";
    const product = plan.product || state.activeProduct;
    const price = Number(plan.price);
    const favor = global.GameWeather
      ? global.GameWeather.favorsProduct(weather, product)
      : null;
    const ref = global.GameEconomy.REF_PRICE || 1.5;
    const goodPrice = Number.isFinite(price) && price <= ref * 1.25;
    const highPrice = Number.isFinite(price) && price > ref * 1.6;

    if (favor === true && goodPrice) return "happy";
    if (favor === false || highPrice) {
      return rand(randomFn) < 0.65 ? "dislike" : "like";
    }
    if (favor === true) return rand(randomFn) < 0.7 ? "happy" : "like";
    return rand(randomFn) < 0.55 ? "like" : "happy";
  }

  /**
   * Build a playable timeline from an economy plan.
   * Guarantees: buy events === plan.cupsSold.
   */
  function buildTimeline(plan, state, randomFn) {
    const events = [];
    const cupsSold = Math.max(0, plan.cupsSold | 0);
    const demand = Math.max(0, plan.demand | 0);
    const stockLeftAfter = Math.max(0, (plan.stockCups | 0) - cupsSold);

    for (let i = 0; i < cupsSold; i++) {
      events.push({
        outcome: "buy",
        reason: null,
        reaction: buyReaction(plan, state, randomFn),
      });
    }

    const soldOutLeft = Math.max(0, demand - cupsSold);
    for (let i = 0; i < soldOutLeft; i++) {
      events.push({
        outcome: "leave",
        reason: "stock",
        reaction: null,
      });
    }

    const weather = plan.weather || state.weather || "mild";
    const product = plan.product || state.activeProduct;
    const favor = global.GameWeather
      ? global.GameWeather.favorsProduct(weather, product)
      : null;
    const price = Number(plan.price);
    const ref = global.GameEconomy.REF_PRICE || 1.5;

    let weatherLeft = 0;
    if (favor === false) {
      weatherLeft = Math.max(2, Math.round(8 * (1 - (plan.preference || 0.65))));
    } else if (favor === null) {
      weatherLeft = 1;
    }

    let priceLeft = 0;
    if (Number.isFinite(price) && price > ref) {
      priceLeft = Math.max(1, Math.round((price / ref - 1) * 6));
    }
    if (Number.isFinite(price) && price > ref * 2) {
      priceLeft += 3;
    }

    // Keep the stage readable — cap extra walk-aways.
    weatherLeft = Math.min(weatherLeft, 8);
    priceLeft = Math.min(priceLeft, 8);

    for (let i = 0; i < weatherLeft; i++) {
      events.push({ outcome: "leave", reason: "weather", reaction: null });
    }
    for (let i = 0; i < priceLeft; i++) {
      events.push({ outcome: "leave", reason: "price", reaction: null });
    }

    // If nobody showed and we somehow have zero events, show a quiet beat.
    if (events.length === 0) {
      events.push({ outcome: "leave", reason: "price", reaction: null });
    }

    const ordered = shuffle(events, randomFn);
    const n = ordered.length;
    const timeline = ordered.map(function (event, index) {
      const t =
        n === 1
          ? DAY_MS * 0.45
          : Math.round((index / (n - 1)) * (DAY_MS * 0.92) + DAY_MS * 0.04);
      return {
        atMs: t,
        outcome: event.outcome,
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
    };
    for (const event of events) {
      if (event.outcome === "buy") {
        summary.bought += 1;
        if (event.reaction === "like") summary.likes += 1;
        else if (event.reaction === "dislike") summary.dislikes += 1;
        else if (event.reaction === "happy") summary.happy += 1;
      } else {
        summary.left += 1;
        if (event.reason === "price") summary.leftPrice += 1;
        else if (event.reason === "stock") summary.leftStock += 1;
        else if (event.reason === "weather") summary.leftWeather += 1;
      }
    }
    return summary;
  }

  /**
   * Play a timeline. Calls onEvent(event, index) and onDone().
   * Returns a controller { cancel() }.
   */
  function play(timeline, { onEvent, onDone } = {}) {
    const timers = [];
    let cancelled = false;
    const events = (timeline && timeline.events) || [];
    const dayMs = (timeline && timeline.dayMs) || DAY_MS;

    events.forEach(function (event, index) {
      const id = setTimeout(function () {
        if (cancelled) return;
        if (typeof onEvent === "function") onEvent(event, index);
      }, event.atMs);
      timers.push(id);
    });

    const doneId = setTimeout(function () {
      if (cancelled) return;
      if (typeof onDone === "function") onDone(timeline.summary, timeline.plan);
    }, dayMs);
    timers.push(doneId);

    return {
      cancel: function () {
        cancelled = true;
        timers.forEach(clearTimeout);
      },
    };
  }

  function leaveReasonLabel(reason) {
    if (reason === "price") return "Price too high";
    if (reason === "stock") return "Sold out";
    if (reason === "weather") return "Weather mismatch";
    return "Left";
  }

  function buyReactionLabel(reaction) {
    if (reaction === "happy") return "Happy";
    if (reaction === "like") return "Liked it";
    if (reaction === "dislike") return "Disliked it";
    return "Bought";
  }

  global.GameCustomers = {
    DAY_MS,
    LEAVE_REASONS,
    BUY_REACTIONS,
    buildTimeline,
    summarize,
    play,
    leaveReasonLabel,
    buyReactionLabel,
  };
})(window);
