/**
 * Boot, wire events, day-loop orchestration.
 * Phase 8: Sell Day plays ~10s of customer events, then commits P&L.
 */
(function () {
  let state = GameState.load();
  let selling = false;
  let playback = null;

  function refresh() {
    GameUI.render(state);
  }

  function onProductSelect(product) {
    if (selling) return;
    const result = GameState.setActiveProduct(state, product);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onRecipeOpen() {
    if (selling) return;
    GameUI.setPanel("recipe");
    GameUI.setReport(
      "Edit the " +
        GameState.productLabel(state.activeProduct) +
        " recipe, then save.",
      { flash: true }
    );
  }

  function onBuyOpen() {
    if (selling) return;
    GameUI.setPanel("buy");
    GameUI.setReport("Buy supplies. Cash drops; inventory goes up.", {
      flash: true,
    });
  }

  function onPriceOpen() {
    if (selling) return;
    GameUI.setPanel("price");
    GameUI.setReport(
      "Set " +
        GameState.productLabel(state.activeProduct) +
        " price. Current: " +
        GameUI.formatMoney(GameState.activePrice(state)) +
        ".",
      { flash: true }
    );
  }

  function onPanelClose() {
    if (selling) return;
    const closed = GameUI.closePanel(state);
    if (!closed) return;
    GameUI.setReport("Panel closed. Nothing new was saved.", { flash: true });
  }

  function onRecipeSave(event) {
    event.preventDefault();
    if (selling) return;
    const result = GameRecipe.apply(state, GameUI.readRecipeForm(state));
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onPriceSave(event) {
    event.preventDefault();
    if (selling) return;
    const result = GameEconomy.applyPrice(state, GameUI.readPriceForm());
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onBuy(key) {
    if (selling) return;
    const result = GameState.buyIngredient(state, key, GameUI.readBuyQty(key));
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function validateSellDay(current) {
    const drink = GameState.productLabel(current.activeProduct);
    const price = Number(GameState.activePrice(current));
    if (!Number.isFinite(price) || price < 0) {
      return {
        ok: false,
        message: "Set a valid " + drink + " sell price before Sell Day.",
      };
    }
    if (price === 0) {
      return {
        ok: false,
        message:
          "A $0.00 " +
          drink +
          " price will not earn cash. Set a price above ingredient cost first.",
      };
    }

    const stockCups = GameEconomy.maxCupsFromStock(current);
    if (stockCups <= 0) {
      return {
        ok: false,
        message:
          "No stock for today's " +
          drink +
          " recipe — buy ingredients (or fix the recipe) before Sell Day.",
      };
    }

    return { ok: true, stockCups };
  }

  function finishSellDay(summary, plan) {
    GameEconomy.applySellDay(state, plan);
    state.cash = plan.cashAfter;
    state.day += 1;
    state.weather = GameWeather.roll();
    state.lastDayReport = {
      product: plan.product,
      weather: plan.weather,
      preference: plan.preference,
      cupsSold: plan.cupsSold,
      demand: plan.demand,
      stockCups: plan.stockCups,
      revenue: plan.revenue,
      cogs: plan.cogs,
      profit: plan.profit,
      soldOut: plan.soldOut,
      message: plan.message,
      customers: summary,
    };
    GameState.save(state);
    selling = false;
    playback = null;
    refresh();
    GameUI.showCustomerSummary(summary, plan);
  }

  function onSellDay() {
    if (selling) return;

    const check = validateSellDay(state);
    if (!check.ok) {
      GameUI.setPanel(null);
      GameUI.setReport(check.message, { flash: true });
      return;
    }

    const plan = GameEconomy.planSellDay(state);
    const timeline = GameCustomers.buildTimeline(plan, state);

    // Guard: visual buys must match economy cups sold.
    if (timeline.summary.bought !== plan.cupsSold) {
      GameUI.setReport(
        "Could not build a matching customer day. Try Sell Day again.",
        { flash: true }
      );
      return;
    }

    selling = true;
    GameUI.setPanel(null);
    GameUI.hideCustomerDay();
    GameUI.startCustomerDay();
    GameUI.setReport(
      "Sell Day is under way — watch the customers for about 10 seconds.",
      { flash: true }
    );

    playback = GameCustomers.play(timeline, {
      onEvent: function (event) {
        GameUI.showCustomerEvent(event);
      },
      onDone: function (summary, donePlan) {
        finishSellDay(summary, donePlan);
      },
    });
  }

  function onNewGame() {
    if (selling) {
      if (playback) playback.cancel();
      selling = false;
      playback = null;
      GameUI.hideCustomerDay();
    }

    const confirmed = window.confirm(
      "Start a new game? This clears your saved day, cash, inventory, recipes, prices, and weather."
    );
    if (!confirmed) return;

    try {
      localStorage.removeItem(GameState.STORAGE_KEY);
    } catch {
      // Still reset in-memory state if storage is unavailable.
    }

    state = GameState.defaultState();
    GameState.save(state);
    GameUI.setPanel(null);
    GameUI.hideCustomerDay();
    refresh();
    GameUI.setReport(
      "New game started. Day 1, $20.00 cash. Weather: " +
        GameWeather.label(state.weather) +
        ". " +
        GameUI.MORNING_COPY,
      { flash: true }
    );
  }

  document
    .getElementById("btn-product-juice")
    ?.addEventListener("click", function () {
      onProductSelect("juice");
    });
  document
    .getElementById("btn-product-cocoa")
    ?.addEventListener("click", function () {
      onProductSelect("cocoa");
    });

  document.getElementById("btn-recipe")?.addEventListener("click", onRecipeOpen);
  document.getElementById("btn-buy")?.addEventListener("click", onBuyOpen);
  document.getElementById("btn-price")?.addEventListener("click", onPriceOpen);
  document.getElementById("btn-sell")?.addEventListener("click", onSellDay);
  document.getElementById("btn-new-game")?.addEventListener("click", onNewGame);

  document
    .getElementById("form-recipe")
    ?.addEventListener("submit", onRecipeSave);

  document
    .getElementById("form-price")
    ?.addEventListener("submit", onPriceSave);

  document.getElementById("panel-buy")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-buy]");
    if (!btn) return;
    onBuy(btn.getAttribute("data-buy"));
  });

  document.querySelectorAll("[data-close-panel]").forEach((btn) => {
    btn.addEventListener("click", onPanelClose);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (selling) return;
    if (!GameUI.getOpenPanel()) return;
    event.preventDefault();
    onPanelClose();
  });

  refresh();
})();
