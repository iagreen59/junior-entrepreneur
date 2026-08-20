/**
 * Boot, wire events, day-loop orchestration.
 * Phase 4: morning guidance, Sell Day validation, New Game reset.
 */
(function () {
  let state = GameState.load();

  function refresh() {
    GameUI.render(state);
  }

  function onRecipeOpen() {
    GameUI.setPanel("recipe");
    GameUI.setReport("Edit units per cup, then save your mix.", { flash: true });
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
      "Set your cup price. Current: " + GameUI.formatMoney(state.price) + ".",
      { flash: true }
    );
  }

  function onRecipeSave(event) {
    event.preventDefault();
    const result = GameRecipe.apply(state, GameUI.readRecipeForm());
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

  /**
   * Block Sell Day when the stand cannot make any cups (empty / mismatched stock)
   * or when the sell price is not usable. Explains what to fix; does not burn a day.
   */
  function validateSellDay(current) {
    const price = Number(current.price);
    if (!Number.isFinite(price) || price < 0) {
      return {
        ok: false,
        message: "Set a valid sell price before Sell Day.",
      };
    }
    if (price === 0) {
      return {
        ok: false,
        message:
          "A $0.00 price will not earn cash. Set a price above ingredient cost first.",
      };
    }

    const stockCups = GameEconomy.maxCupsFromStock(current);
    if (stockCups <= 0) {
      return {
        ok: false,
        message:
          "No stock for today's recipe — buy ingredients (or fix the recipe) before Sell Day.",
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
    state.lastDayReport = {
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
      "Start a new game? This clears your saved day, cash, inventory, recipe, and price."
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
      "New game started. Day 1, $20.00 cash. " + GameUI.MORNING_COPY,
      { flash: true }
    );
  }

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

  refresh();
})();
