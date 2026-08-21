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
    GameUI.renderCart(state);
    GameUI.setReport(
      "Add supplies to your cart, then Buy at the bottom. Cart stays if you switch menus.",
      { flash: true }
    );
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
    GameUI.closePanel(state);
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
    GameUI.closePanel(state);
    GameUI.setReport(result.message, { flash: true });
  }

  function onAddToCart(key) {
    if (selling) return;
    const result = GameUI.addToCart(key, GameUI.readBuyQty(key));
    GameUI.renderCart(state);
    GameUI.setReport(result.message, { flash: true });
  }

  function onRemoveFromCart(key) {
    if (selling) return;
    const result = GameUI.removeFromCart(key);
    GameUI.renderCart(state);
    GameUI.setReport(result.message, { flash: true });
  }

  function onClearCart() {
    if (selling) return;
    const result = GameUI.clearCart();
    GameUI.renderCart(state);
    GameUI.setReport(result.message, { flash: true });
  }

  function onCartBuy() {
    if (selling) return;
    const result = GameState.buyCart(state, GameUI.getCart());
    if (!result.ok) {
      GameUI.renderCart(state);
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameUI.resetCart();
    GameState.save(state);
    refresh();
    GameUI.closePanel(state);
    GameUI.setReport(result.message, { flash: true, receipt: true });
  }

  function validateSellDay(current) {
    if (!GameState.ownsStand(current)) {
      return {
        ok: false,
        message:
          "Buy your first stand for $" +
          GameState.STAND_COST.toFixed(2) +
          " before Sell Day.",
      };
    }

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
    GameUI.showCustomerSummary(summary, plan, state);
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
    GameUI.hideCustomerDay(state);
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

  function onBuyStand() {
    if (selling) return;
    const result = GameState.buyStand(state);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onHideInstructions() {
    GameUI.setInstructionsHidden(true);
  }

  function onShowInstructions() {
    GameUI.setInstructionsHidden(false);
  }

  function onNewGame() {
    if (selling) {
      if (playback) playback.cancel();
      selling = false;
      playback = null;
      GameUI.hideCustomerDay(state);
    }

    const confirmed = window.confirm(
      "Start a new game? This clears your saved day, cash, stand, inventory, recipes, prices, and weather."
    );
    if (!confirmed) return;

    try {
      localStorage.removeItem(GameState.STORAGE_KEY);
    } catch {
      // Still reset in-memory state if storage is unavailable.
    }

    state = GameState.defaultState();
    GameState.save(state);
    GameUI.resetCart();
    GameUI.setPanel(null);
    GameUI.hideCustomerDay(state);
    refresh();
    GameUI.setReport(
      "New game started. Day 1, $" +
        Number(GameState.STARTING_CASH).toFixed(2) +
        " cash, no stand yet. Weather: " +
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
  document.getElementById("btn-buy-stand")?.addEventListener("click", onBuyStand);
  document
    .getElementById("btn-hide-instructions")
    ?.addEventListener("click", onHideInstructions);
  document
    .getElementById("btn-show-instructions")
    ?.addEventListener("click", onShowInstructions);

  document
    .getElementById("form-recipe")
    ?.addEventListener("submit", onRecipeSave);

  document
    .getElementById("form-price")
    ?.addEventListener("submit", onPriceSave);

  document.getElementById("panel-buy")?.addEventListener("click", (event) => {
    const addBtn = event.target.closest("[data-add-cart]");
    if (addBtn) {
      onAddToCart(addBtn.getAttribute("data-add-cart"));
      return;
    }
    const removeBtn = event.target.closest("[data-remove-cart]");
    if (removeBtn) {
      onRemoveFromCart(removeBtn.getAttribute("data-remove-cart"));
      return;
    }
  });

  document.getElementById("btn-clear-cart")?.addEventListener("click", onClearCart);
  document.getElementById("btn-cart-buy")?.addEventListener("click", onCartBuy);

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
