/**
 * Boot, wire events, day-loop orchestration.
 * Phase 8: Sell Day plays ~10s of customer events, then commits P&L.
 * Phase 11: four-item product picker + daily menuOffered toggles.
 * Phase 12: Sell Day serves all offered menu items; empty menu blocked.
 * Phase 13: multi-stand buy / selector / unlock notify + map refresh.
 * Phase 14: staff hire/layoff/assign; understaffed blocks Sell Day; wages.
 * Phase 16: buy restaurant ($400), restaurant staff hire/layoff;
 *           Sell Day gates on restaurant staff + wages/rent; P&L includes rent.
 * Phase 15: sell stand ($10, keep ≥1); morning random events + banner.
 * Phase 17: multi-restaurant buy/sell; last restaurant → one stand restart.
 * Phase 18: Business ledger panel; record Sell Day + location cash events.
 */
(function () {
  let state = GameState.load();
  let selling = false;
  let playback = null;

  function refresh() {
    GameUI.render(state);
  }

  /** Show one-shot unlock message when cash > $100 and stands < 4. */
  function maybeNotifyExtraStandUnlock() {
    const msg = GameState.consumeExtraStandUnlockNotify(state);
    if (!msg) return false;
    GameState.save(state);
    GameUI.setReport(msg, { flash: true });
    refresh();
    return true;
  }

  /** Show one-shot message when eligible to buy the first restaurant. */
  function maybeNotifyRestaurantUnlock() {
    if (!GameState.consumeRestaurantUnlockNotify) return false;
    const msg = GameState.consumeRestaurantUnlockNotify(state);
    if (!msg) return false;
    GameState.save(state);
    GameUI.setReport(msg, { flash: true });
    refresh();
    return true;
  }

  /** Show one-shot message when eligible to buy another restaurant. */
  function maybeNotifyExtraRestaurantUnlock() {
    if (!GameState.consumeExtraRestaurantUnlockNotify) return false;
    const msg = GameState.consumeExtraRestaurantUnlockNotify(state);
    if (!msg) return false;
    GameState.save(state);
    GameUI.setReport(msg, { flash: true });
    refresh();
    return true;
  }

  /** After day advances: clear used demand mult, roll rare morning event. */
  function runMorningEvents() {
    if (GameState.clearDemandMultiplier) {
      GameState.clearDemandMultiplier(state);
    }
    if (!window.GameEvents || typeof GameEvents.onNewDay !== "function") {
      return null;
    }
    const result = GameEvents.onNewDay(state);
    return result && result.rolled ? result.event : null;
  }

  function onProductSelect(product, { quiet } = {}) {
    if (selling) return;
    const result = GameState.setActiveProduct(state, product);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      return;
    }
    GameState.save(state);
    // Reloading forms from saved state discards any unsaved recipe/price edits.
    refresh();
    if (!quiet) {
      GameUI.setReport(result.message, { flash: true });
    }
  }

  function onPanelProductChange(event) {
    if (selling) return;
    const select = event.target;
    const product = select && select.value;
    if (!product) return;
    onProductSelect(product, { quiet: true });
    const open = GameUI.getOpenPanel();
    if (open === "recipe") {
      GameUI.setReport(
        "Editing " +
          GameState.productLabel(state.activeProduct) +
          " recipe & price. Unsaved edits were discarded.",
        { flash: true }
      );
    }
  }

  function onMenuToggle(product, offered) {
    if (selling) return;
    const result = GameState.setMenuOffered(state, product, offered);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
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
        " recipe and price, then save.",
      { flash: true }
    );
  }

  function onBuyOpen() {
    if (selling) return;
    GameUI.setPanel("buy");
    GameUI.renderBuyList(state);
    GameUI.setReport(
      "Check on-hand stock, add supplies to your cart, then Place order at the bottom.",
      { flash: true }
    );
  }

  function onBusinessOpen() {
    if (selling) return;
    GameUI.setBusinessTab("business");
    GameUI.setPanel("business");
    GameUI.renderLedger(state);
  }

  function onViewPreviousDay() {
    if (selling) return;
    const result = GameUI.showPreviousDay(state);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
    }
  }

  function onBackToBusiness() {
    if (selling) return;
    GameUI.openBusinessOverview(state);
  }

  function onDailyBackToSummary() {
    if (selling) return;
    GameUI.setBusinessTab("business");
    GameUI.renderLedger(state);
  }

  function onPnlChartDurationChange(event) {
    if (selling) return;
    const value = event.target && event.target.value;
    GameUI.setPnlChartDuration(value === "30" ? 30 : 5);
  }

  function onPnlChartMetricChange(event) {
    if (selling) return;
    const value = event.target && event.target.value;
    if (value) GameUI.setPnlChartMetric(value);
  }

  function onStatDayClick() {
    if (selling) return;
    const latest =
      state.dayHistory && state.dayHistory.length
        ? state.dayHistory[state.dayHistory.length - 1].completedDay
        : state.day > 1
          ? state.day - 1
          : null;
    const result = GameUI.showPreviousDay(state, latest);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
    }
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
    const recipeResult = GameRecipe.apply(state, GameUI.readRecipeForm(state));
    if (!recipeResult.ok) {
      GameUI.setReport(recipeResult.message, { flash: true });
      return;
    }
    const priceResult = GameEconomy.applyPrice(state, GameUI.readPriceForm());
    if (!priceResult.ok) {
      GameUI.setReport(priceResult.message, { flash: true });
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.closePanel(state);
    GameUI.setReport(
      recipeResult.message + " " + priceResult.message,
      { flash: true }
    );
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
    const isRestaurant =
      GameState.isRestaurantMode && GameState.isRestaurantMode(current);
    const ownsBusiness = GameState.ownsBusiness
      ? GameState.ownsBusiness(current)
      : GameState.ownsStand(current);
    if (!ownsBusiness) {
      return {
        ok: false,
        message:
          "Buy your first stand for $" +
          GameState.STAND_COST.toFixed(2) +
          " before Sell Day.",
      };
    }

    const staff = GameState.staffingCheck(current);
    if (!staff.ok) {
      return { ok: false, message: staff.message };
    }

    const offered = GameEconomy.offeredProducts(current);
    if (offered.length === 0) {
      return {
        ok: false,
        message:
          "Today’s menu is empty — toggle on at least one item before Sell Day.",
      };
    }

    let pricedOk = false;
    let stockOk = false;
    for (const product of offered) {
      const price = Number(
        current.prices && current.prices[product] != null
          ? current.prices[product]
          : 0
      );
      if (Number.isFinite(price) && price > 0) pricedOk = true;
      if (GameEconomy.maxCupsFromStock(current, product) > 0) stockOk = true;
    }

    if (!pricedOk) {
      return {
        ok: false,
        message:
          "Set a sell price above $0.00 for at least one offered menu item before Sell Day.",
      };
    }

    if (!stockOk) {
      return {
        ok: false,
        message:
          "No stock for today’s offered menu — buy ingredients (or fix a recipe) before Sell Day.",
      };
    }

    return { ok: true, offered };
  }

  function finishSellDay(summary, plan) {
    let morningEvent = null;
    try {
      GameEconomy.applySellDay(state, plan);
      state.cash = plan.cashAfter;
      const completedDay = state.day;
      state.day += 1;
      state.weather = GameWeather.roll();
      if (window.GameLedger && GameLedger.recordSellDay) {
        GameLedger.recordSellDay(state, plan);
      }
      const dayReport = {
        product: plan.product,
        products: plan.products,
        soldByProduct: plan.soldByProduct,
        demandByProduct: plan.demandByProduct,
        prices: plan.prices || null,
        weather: plan.weather,
        preference: plan.preference,
        preferences: plan.preferences,
        cupsSold: plan.cupsSold,
        demand: plan.demand,
        stockCups: plan.stockCups,
        revenue: plan.revenue,
        cogs: plan.cogs,
        wages: plan.wages,
        rent: plan.rent || 0,
        employeeCount: plan.employeeCount,
        capacityMult: plan.capacityMult,
        isRestaurant: !!plan.isRestaurant,
        restaurantId: plan.restaurantId || null,
        restaurantName: plan.restaurantName || null,
        locations: Array.isArray(plan.locations) ? plan.locations : [],
        restaurantCount: plan.restaurantCount || 0,
        profit: plan.profit,
        soldOut: plan.soldOut,
        soldOutProducts: plan.soldOutProducts || [],
        message: plan.message,
        customers: summary,
        recipes: plan.recipes || null,
        completedDay: completedDay,
      };
      if (!Array.isArray(state.dayHistory)) state.dayHistory = [];
      state.dayHistory.push(dayReport);
      if (state.dayHistory.length > 40) {
        state.dayHistory = state.dayHistory.slice(-40);
      }
      state.lastDayReport = dayReport;

      morningEvent = runMorningEvents();
      GameState.save(state);
    } finally {
      // Always return to standby even if save/storage throws (common on
      // iPhone Safari private mode) so the report can complete.
      selling = false;
      playback = null;
      try {
        refresh();
      } catch {
        // Still unlock controls and show the summary.
      }
      try {
        GameUI.showCustomerSummary(summary, plan, state);
      } catch {
        GameUI.setSellDayLocked(false, state);
        if (plan && plan.message) {
          GameUI.setReport(plan.message, { flash: true, revealDaily: true });
        }
      }
    }

    let reportExtra = "";
    if (morningEvent && morningEvent.message) {
      reportExtra =
        (reportExtra ? reportExtra + "\n\n" : "") + morningEvent.message;
    }

    // After Sell Day P&L is shown, notify if cash crossed the multi-stand unlock.
    const unlockMsg = GameState.consumeExtraStandUnlockNotify(state);
    if (unlockMsg) {
      reportExtra = (reportExtra ? reportExtra + "\n\n" : "") + unlockMsg;
    }

    if (GameState.consumeRestaurantUnlockNotify) {
      const restMsg = GameState.consumeRestaurantUnlockNotify(state);
      if (restMsg) {
        reportExtra = (reportExtra ? reportExtra + "\n\n" : "") + restMsg;
      }
    }

    if (GameState.consumeExtraRestaurantUnlockNotify) {
      const extraRestMsg = GameState.consumeExtraRestaurantUnlockNotify(state);
      if (extraRestMsg) {
        reportExtra = (reportExtra ? reportExtra + "\n\n" : "") + extraRestMsg;
      }
    }

    if (reportExtra) {
      GameState.save(state);
      GameUI.setReport(
        (plan && plan.message ? plan.message + "\n\n" : "") + reportExtra,
        { flash: true }
      );
      try {
        refresh();
      } catch {
        // Report text already shown; standby stays unlocked.
      }
    }
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

    // Guard: visual buys must match economy cups sold (and per-item when present).
    if (timeline.summary.bought !== plan.cupsSold) {
      GameUI.setReport(
        "Could not build a matching customer day. Try Sell Day again.",
        { flash: true }
      );
      return;
    }
    if (plan.soldByProduct && timeline.summary.boughtByProduct) {
      for (const product of GameState.PRODUCTS) {
        if (
          (timeline.summary.boughtByProduct[product] | 0) !==
          (plan.soldByProduct[product] | 0)
        ) {
          GameUI.setReport(
            "Could not match per-item sales to the customer day. Try Sell Day again.",
            { flash: true }
          );
          return;
        }
      }
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
        // Clear live feedback chips, brief closing beat, then daily summary.
        GameUI.beginClosingBooks(function () {
          finishSellDay(summary, donePlan);
        });
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

  function onAddStand() {
    if (selling) return;
    const result = GameState.buyStand(state);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onSellStand() {
    if (selling) return;
    const active = GameState.getActiveStand(state);
    const name = active && active.name ? active.name : "this stand";
    const price = Number(GameState.STAND_SELL_PRICE) || 10;
    if (!GameState.canSellStand(state)) {
      GameUI.setReport(
        "You must keep at least one stand. Selling your last stand is not allowed.",
        { flash: true }
      );
      refresh();
      return;
    }
    const confirmed = window.confirm(
      "Sell " + name + " for $" + price.toFixed(0) + "? You must keep at least one stand."
    );
    if (!confirmed) return;
    const result = GameState.sellStand(state, state.activeStandId);
    if (result.ok && window.GameLedger && GameLedger.recordCashEvent) {
      GameLedger.recordCashEvent(state, {
        kind: "sellStand",
        amount: Number(GameState.STAND_SELL_PRICE) || 10,
      });
    }
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onBuyRestaurant() {
    if (selling) return;
    if (!GameState.canBuyRestaurant || !GameState.canBuyRestaurant(state)) {
      const inRest =
        GameState.isRestaurantMode && GameState.isRestaurantMode(state);
      GameUI.setReport(
        inRest
          ? "Need cash over $" +
              (GameState.RESTAURANT_UNLOCK_CASH || 1000) +
              " and room under " +
              (GameState.MAX_RESTAURANTS || 4) +
              " restaurants to buy another for $" +
              (GameState.RESTAURANT_COST || 400) +
              "."
          : "Need 4 stands and cash over $" +
              (GameState.RESTAURANT_UNLOCK_CASH || 1000) +
              " to buy a restaurant for $" +
              (GameState.RESTAURANT_COST || 400) +
              ".",
        { flash: true }
      );
      refresh();
      return;
    }
    const cost = Number(GameState.RESTAURANT_COST) || 400;
    const inRest =
      GameState.isRestaurantMode && GameState.isRestaurantMode(state);
    const confirmed = window.confirm(
      inRest
        ? "Buy another restaurant for $" +
            cost.toFixed(0) +
            "? It needs its own 2–4 employees and pays $" +
            (GameState.RESTAURANT_RENT || 18) +
            "/day rent."
        : "Buy a restaurant for $" +
            cost.toFixed(0) +
            "? All stands will be forfeited. You will need 2–4 employees (you cannot staff it yourself). Daily rent $" +
            (GameState.RESTAURANT_RENT || 18) +
            " + wages $" +
            (GameState.RESTAURANT_WAGE || 8) +
            "/employee."
    );
    if (!confirmed) return;
    const result = GameState.buyRestaurant(state);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    if (window.GameLedger && GameLedger.recordCashEvent) {
      GameLedger.recordCashEvent(state, {
        kind: "buyRestaurant",
        amount: -(Number(GameState.RESTAURANT_COST) || 400),
      });
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onAddRestaurant() {
    onBuyRestaurant();
  }

  function onSellRestaurant() {
    if (selling) return;
    if (!GameState.canSellRestaurant || !GameState.canSellRestaurant(state)) {
      GameUI.setReport("You do not own a restaurant to sell.", { flash: true });
      refresh();
      return;
    }
    const active =
      GameState.getActiveRestaurant && GameState.getActiveRestaurant(state);
    const name = active && active.name ? active.name : "this restaurant";
    const price = Number(GameState.RESTAURANT_SELL_PRICE) || 200;
    const count = GameState.restaurantCount(state);
    const confirmed = window.confirm(
      count <= 1
        ? "Sell " +
            name +
            " for $" +
            price.toFixed(0) +
            "? This is your last restaurant — you will receive one stand and return to stand mode."
        : "Sell " +
            name +
            " for $" +
            price.toFixed(0) +
            "? You will keep your other restaurants."
    );
    if (!confirmed) return;
    const result = GameState.sellRestaurant(state, state.activeRestaurantId);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    if (window.GameLedger && GameLedger.recordCashEvent) {
      GameLedger.recordCashEvent(state, {
        kind: "sellRestaurant",
        amount: Number(GameState.RESTAURANT_SELL_PRICE) || 200,
      });
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onRestaurantSelectChange(event) {
    if (selling) return;
    const select = event.target;
    const result = GameState.setActiveRestaurant(state, select.value);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onRestaurantStaffAction(event) {
    if (selling) return;
    const btn = event.target.closest("[data-restaurant-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-restaurant-action");
    let result;
    if (action === "hire") {
      result = GameState.hireRestaurantEmployee(state);
    } else if (action === "layoff") {
      result = GameState.layoffRestaurantEmployee(state);
    } else {
      return;
    }
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onDismissEvent() {
    if (selling) return;
    GameState.clearEventBanner(state);
    GameState.save(state);
    refresh();
  }

  function onStandSelectChange(event) {
    if (selling) return;
    const select = event.target;
    const result = GameState.setActiveStand(state, select.value);
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
      return;
    }
    GameState.save(state);
    refresh();
    GameUI.setReport(result.message, { flash: true });
  }

  function onStaffAction(event) {
    if (selling) return;
    const btn = event.target.closest("[data-staff-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-staff-action");
    const standId = btn.getAttribute("data-stand-id");
    let result;
    if (action === "hire") {
      result = GameState.hireEmployee(state, standId);
    } else if (action === "layoff") {
      result = GameState.layoffEmployee(state, standId);
    } else if (action === "assign-player") {
      result = GameState.assignPlayerToStand(state, standId);
    } else if (action === "unassign-player") {
      result = GameState.unassignPlayerFromStand(state, standId);
    } else {
      return;
    }
    if (!result.ok) {
      GameUI.setReport(result.message, { flash: true });
      refresh();
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

  function onHideLocations() {
    GameUI.setLocationsHidden(true);
  }

  function onShowLocations() {
    GameUI.setLocationsHidden(false);
  }

  function onCloseDayResults() {
    GameUI.hideDayResultsPanel();
  }

  function onToggleDayHints() {
    GameUI.toggleDayHints();
  }

  function onBusinessTabClick(event) {
    const btn = event.target.closest("[data-business-tab]");
    if (!btn) return;
    const tab = btn.getAttribute("data-business-tab");
    GameUI.setBusinessTab(tab);
    if (tab === "business") {
      GameUI.renderLedger(state);
    }
  }

  function onNewGame() {
    if (selling) {
      if (playback) playback.cancel();
      selling = false;
      playback = null;
      GameUI.hideCustomerDay(state);
    }

    const confirmed = window.confirm(
      "Start a new game? This clears your saved day, cash, stands, restaurants, staff, inventory, recipes, prices, menu, weather, events, and business ledger."
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
    .getElementById("recipe-product-select")
    ?.addEventListener("change", onPanelProductChange);

  document.querySelectorAll("[data-menu-product]").forEach(function (input) {
    input.addEventListener("change", function () {
      onMenuToggle(input.getAttribute("data-menu-product"), input.checked);
    });
  });

  document.getElementById("btn-recipe")?.addEventListener("click", onRecipeOpen);
  document.getElementById("btn-buy")?.addEventListener("click", onBuyOpen);
  document.getElementById("btn-business")?.addEventListener("click", onBusinessOpen);
  document.getElementById("btn-sell")?.addEventListener("click", onSellDay);
  document.getElementById("btn-new-game")?.addEventListener("click", onNewGame);
  document.getElementById("btn-buy-stand")?.addEventListener("click", onBuyStand);
  document.getElementById("btn-add-stand")?.addEventListener("click", onAddStand);
  document.getElementById("btn-sell-stand")?.addEventListener("click", onSellStand);
  document
    .getElementById("btn-buy-restaurant")
    ?.addEventListener("click", onBuyRestaurant);
  document
    .getElementById("btn-add-restaurant")
    ?.addEventListener("click", onAddRestaurant);
  document
    .getElementById("btn-sell-restaurant")
    ?.addEventListener("click", onSellRestaurant);
  document
    .getElementById("restaurant-select")
    ?.addEventListener("change", onRestaurantSelectChange);
  document
    .getElementById("restaurant-manage")
    ?.addEventListener("click", onRestaurantStaffAction);
  document
    .getElementById("btn-dismiss-event")
    ?.addEventListener("click", onDismissEvent);
  document
    .getElementById("stand-select")
    ?.addEventListener("change", onStandSelectChange);
  document.getElementById("staff-panel")?.addEventListener("click", onStaffAction);
  document
    .getElementById("btn-hide-instructions")
    ?.addEventListener("click", onHideInstructions);
  document
    .getElementById("btn-show-instructions")
    ?.addEventListener("click", onShowInstructions);
  document
    .getElementById("btn-hide-locations")
    ?.addEventListener("click", onHideLocations);
  document
    .getElementById("btn-show-locations")
    ?.addEventListener("click", onShowLocations);
  document
    .getElementById("btn-close-day-results")
    ?.addEventListener("click", onCloseDayResults);
  document
    .getElementById("btn-day-hints")
    ?.addEventListener("click", onToggleDayHints);
  document
    .getElementById("btn-back-to-business")
    ?.addEventListener("click", onBackToBusiness);
  document
    .getElementById("btn-daily-back-to-summary")
    ?.addEventListener("click", onDailyBackToSummary);
  document
    .getElementById("pnl-chart-duration")
    ?.addEventListener("change", onPnlChartDurationChange);
  document
    .getElementById("pnl-chart-metric")
    ?.addEventListener("change", onPnlChartMetricChange);
  document
    .getElementById("stat-day-btn")
    ?.addEventListener("click", onStatDayClick);
  document
    .getElementById("btn-view-previous-day")
    ?.addEventListener("click", onViewPreviousDay);
  document
    .getElementById("panel-business")
    ?.addEventListener("click", onBusinessTabClick);

  document
    .getElementById("form-recipe")
    ?.addEventListener("submit", onRecipeSave);

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
  maybeNotifyExtraStandUnlock();
  maybeNotifyRestaurantUnlock();
  maybeNotifyExtraRestaurantUnlock();
})();
