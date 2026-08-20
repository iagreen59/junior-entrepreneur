/**
 * Costs, demand, sales, profit.
 * Phase 1: stub sell-day — always sells 10 cups for +$5.
 */
(function (global) {
  function runStubDay(state) {
    const cupsSold = 10;
    const profit = 5;
    const nextCash = state.cash + profit;

    return {
      cupsSold,
      profit,
      cashAfter: nextCash,
      message:
        "Sold " +
        cupsSold +
        " cups. Profit +$" +
        profit.toFixed(2) +
        ". (Stub day — real sales in Phase 3.)",
    };
  }

  global.GameEconomy = {
    runStubDay,
  };
})(window);
