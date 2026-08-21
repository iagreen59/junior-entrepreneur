/**
 * Boot, wire events, day-loop orchestration.
 * Phase 7: roll typed weather each new day; demand uses weather preference.
 */
(function () {
  let state = GameState.load();

  function refresh() {
    GameUI.render(state);
  }

  function onProductSelect(product) {
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
    GameUI.setPanel("recipe");
    GameUI.setReport(
      "Edit the " +
        GameState.productLabel(state.activeProduct) +
        " recipe, then save.",
      { flash: true }
    );
  }

  function onBuyOpen() {
    GameUI.setPanel("buy");
    GameUI.setReport("Buy supplies. Cash drops; inventory goes up.", {
      flash: true,
    });
  }

  function onPriceOpen() {
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
    const closed = GameUI.closePanel(state);
    if (!closed) return;
    GameUI.setReport("Panel closed. Nothing new was saved.", { flash: true });
  }

  function onRecipeSave(event) {
    event.preventDefault();
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

  function onSellDay() {
    const check = validateSellDay(state);
    if (!check.ok) {
      GameUI.setPanel(null);
      GameUI.setReport(check.message, { flash: true });
      return;
    }

    const result = GameEconomy.runSellDay(state);
    state.cash = result.cashAfter;
    state.day += 1;
    // New morning: re-roll typed weather for the next day.
    state.weather = GameWeather.roll();
    state.lastDayReport = {
      product: result.product,
      weather: result.weather,
      preference: result.preference,
      cupsSold: result.cupsSold,
      demand: result.demand,
      stockCups: result.stockCups,
      revenue: result.revenue,
      cogs: result.cogs,
      profit: result.profit,
      soldOut: result.soldOut,
      message: result.message,
    };
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onNewGame() {
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
    if (!GameUI.getOpenPanel()) return;
    event.preventDefault();
    onPanelClose();
  });

  refresh();
})();
