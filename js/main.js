/**
 * Boot, wire events, day-loop orchestration.
 * Phase 2: recipe editor + buy ingredients. Sell Day stays the Phase 1 stub.
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

  function onPriceStub() {
    GameUI.setPanel(null);
    GameUI.setReport(
      "Price controls come in Phase 3. Current price: " +
        GameUI.formatMoney(state.price) +
        ".",
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
    const result = GameEconomy.runStubDay(state);
    state.cash = result.cashAfter;
    state.day += 1;
    state.lastDayReport = {
      cupsSold: result.cupsSold,
      profit: result.profit,
      message: result.message,
    };
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  document.getElementById("btn-recipe")?.addEventListener("click", onRecipeOpen);
  document.getElementById("btn-buy")?.addEventListener("click", onBuyOpen);
  document.getElementById("btn-price")?.addEventListener("click", onPriceStub);
  document.getElementById("btn-sell")?.addEventListener("click", onSellDay);

  document
    .getElementById("form-recipe")
    ?.addEventListener("submit", onRecipeSave);

  document.getElementById("panel-buy")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-buy]");
    if (!btn) return;
    onBuy(btn.getAttribute("data-buy"));
  });

  refresh();
})();
