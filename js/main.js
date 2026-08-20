/**
 * Boot, wire events, day-loop orchestration.
 * Phase 3: price panel + real Sell Day economy (no stub).
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

  function onSellDay() {
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

  document.getElementById("btn-recipe")?.addEventListener("click", onRecipeOpen);
  document.getElementById("btn-buy")?.addEventListener("click", onBuyOpen);
  document.getElementById("btn-price")?.addEventListener("click", onPriceOpen);
  document.getElementById("btn-sell")?.addEventListener("click", onSellDay);

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
