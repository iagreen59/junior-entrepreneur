/**
 * Boot, wire events, day-loop orchestration (Phase 1 stub).
 */
(function () {
  let state = GameState.load();

  function refresh() {
    GameUI.render(state);
  }

  function onStub(kind) {
    if (kind === "recipe") {
      GameUI.setReport(GameRecipe.stubMessage() + " " + GameRecipe.describe(state.recipe), {
        flash: true,
      });
      return;
    }
    if (kind === "buy") {
      GameUI.setReport("Buying ingredients comes in Phase 2.", { flash: true });
      return;
    }
    if (kind === "price") {
      GameUI.setReport(
        "Price controls come in Phase 3. Current price: " +
          GameUI.formatMoney(state.price) +
          ".",
        { flash: true }
      );
    }
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

  document.getElementById("btn-recipe")?.addEventListener("click", () => onStub("recipe"));
  document.getElementById("btn-buy")?.addEventListener("click", () => onStub("buy"));
  document.getElementById("btn-price")?.addEventListener("click", () => onStub("price"));
  document.getElementById("btn-sell")?.addEventListener("click", onSellDay);

  refresh();
})();
