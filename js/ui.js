/**
 * DOM updates / panel rendering.
 * Phase 7: weather status + preference tips for juice vs cocoa.
 * Phase 9: stand ownership gate + hideable instructions panel.
 * Phase 10: coldCups / hotCups fields; recipe yield + COGS display.
 * Phase 11: four products + daily menuOffered toggles; food recipes/prices.
 * Phase 12: multi-item Sell Day chips (bought item + reaction) and
 * per-item customer summary aggregates.
 * Phase 13: multi-stand dropdown + Add stand + unlock banner; map render.
 * Phase 14: staff panel (hire / layoff / assign player) + understaffed hints.
 * Phase 18: Business ledger panel with metric info blurbs + restaurant rollups.
 * Phase 19: hideable instructions cover stands → restaurants, rent/wages, ledger.
 */
(function (global) {
  const MORNING_COPY =
    "Good morning. Buy your stand if needed, staff multi-stand locations, check the weather, set today’s menu, edit recipes & prices for offered items, Buy stock, then Sell Day.";

  const PANEL_IDS = {
    recipe: "panel-recipe",
    buy: "panel-buy",
    price: "panel-price",
    business: "panel-business",
  };

  const PRODUCT_TITLES = {
    juice: "Juice",
    cocoa: "Hot cocoa",
    burger: "Burger",
    soup: "Soup",
  };

  /** Latest state from render() — used for live recipe yield/COGS updates. */
  let cachedState = null;
  /** Business panel tab: "business" (default) | "daily". */
  let businessTab = "business";
  /** Whether the on-page daily summary section is hidden by the player. */
  let dailySummaryHidden = false;

  function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "$" + Math.abs(amount).toFixed(2);
  }

  function activeProduct(state) {
    return global.GameState.normalizeProduct(
      state && state.activeProduct,
      "juice"
    );
  }

  function fillRecipeForm(state) {
    const product = activeProduct(state);
    const recipe = global.GameState.activeRecipe(state) || {};
    for (const key of global.GameState.recipeKeysFor(product)) {
      const input = document.getElementById("recipe-" + key);
      if (input) input.value = String(recipe[key] ?? 0);
    }
    renderRecipeStats(state);
  }

  function fillPriceForm(state) {
    const input = document.getElementById("sell-price");
    if (input) {
      input.value = Number(global.GameState.activePrice(state)).toFixed(2);
    }
  }

  function readRecipeForm(state) {
    const product = activeProduct(state || cachedState || { activeProduct: "juice" });
    const draft = {};
    for (const key of global.GameState.recipeKeysFor(product)) {
      const input = document.getElementById("recipe-" + key);
      draft[key] = input ? input.value : 0;
    }
    return draft;
  }

  /**
   * Show max sellable servings from current inventory + COGS per item
   * for the product being edited (uses draft form values when present).
   */
  function renderRecipeStats(state) {
    const source = state || cachedState;
    if (!source) return;

    const product = activeProduct(source);
    const draft = readRecipeForm(source);
    const parsed = global.GameRecipe.parseDraft(product, draft);
    const recipe = parsed.ok
      ? parsed.recipe
      : global.GameState.activeRecipe(source) || {};

    const servings = global.GameEconomy.maxCupsFromStock(
      source,
      product,
      recipe
    );
    const cogs = global.GameEconomy.costOfGoodsPerServing(
      source,
      product,
      recipe
    );
    const item = global.GameState.productLabel(product);

    const yieldEl = document.getElementById("recipe-yield");
    const cogsEl = document.getElementById("recipe-cogs");
    if (yieldEl) {
      yieldEl.textContent =
        "Can make " +
        servings +
        " serving" +
        (servings === 1 ? "" : "s") +
        " of " +
        item +
        " from current stock.";
    }
    if (cogsEl) {
      cogsEl.textContent =
        "COGS per " + item + ": " + formatMoney(cogs) + ".";
    }
  }

  function readPriceForm() {
    const input = document.getElementById("sell-price");
    return input ? input.value : "0";
  }

  /** Session cart — survives panel switches until checkout, clear, or new game. */
  let supplyCart = global.GameState.emptyCart();

  function getCart() {
    return supplyCart;
  }

  function resetCart() {
    supplyCart = global.GameState.emptyCart();
    return supplyCart;
  }

  function readBuyQty(key) {
    const input = document.getElementById("buy-qty-" + key);
    return input ? input.value : "0";
  }

  function addToCart(key, qty) {
    if (!global.GameState.INVENTORY_KEYS.includes(key)) {
      return { ok: false, message: "Unknown ingredient." };
    }
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return {
        ok: false,
        message: "Enter a whole number greater than zero to add.",
      };
    }
    supplyCart[key] = (supplyCart[key] || 0) + amount;
    const labels = global.GameState.inventoryLabels();
    return {
      ok: true,
      key,
      qty: amount,
      inCart: supplyCart[key],
      message:
        "Added " +
        amount +
        " " +
        labels[key].toLowerCase() +
        " to cart (" +
        supplyCart[key] +
        " in cart).",
    };
  }

  function removeFromCart(key) {
    if (!global.GameState.INVENTORY_KEYS.includes(key)) {
      return { ok: false, message: "Unknown ingredient." };
    }
    const had = supplyCart[key] || 0;
    supplyCart[key] = 0;
    const labels = global.GameState.inventoryLabels();
    if (had <= 0) {
      return {
        ok: true,
        message: "No " + labels[key].toLowerCase() + " in your cart.",
      };
    }
    return {
      ok: true,
      message: "Removed " + labels[key].toLowerCase() + " from cart.",
    };
  }

  function clearCart() {
    const hadItems = global.GameState.cartHasItems(supplyCart);
    resetCart();
    return {
      ok: true,
      message: hadItems ? "Cart cleared." : "Cart is already empty.",
    };
  }

  function renderBuyPrices(state) {
    const labels = global.GameState.inventoryLabels();
    for (const key of global.GameState.INVENTORY_KEYS) {
      const priceEl = document.getElementById("buy-price-" + key);
      if (priceEl) {
        priceEl.textContent =
          labels[key] +
          " — " +
          formatMoney(global.GameState.unitPrice(key, state)) +
          " each";
      }
    }
  }

  function renderCart(state) {
    for (const key of global.GameState.INVENTORY_KEYS) {
      const qtyEl = document.getElementById("cart-qty-" + key);
      if (qtyEl) qtyEl.textContent = String(supplyCart[key] || 0);
      const removeBtn = document.querySelector(
        '[data-remove-cart="' + key + '"]'
      );
      if (removeBtn) {
        removeBtn.disabled = !(supplyCart[key] > 0);
      }
    }

    const total = global.GameState.cartTotal(supplyCart, state);
    const totalEl = document.getElementById("cart-total");
    if (totalEl) {
      totalEl.textContent = formatMoney(total);
      const overBudget =
        total > 0 && state && total > Number(state.cash) + 1e-9;
      totalEl.classList.toggle("is-over-budget", overBudget);
    }

    const clearBtn = document.getElementById("btn-clear-cart");
    if (clearBtn) {
      clearBtn.disabled = !global.GameState.cartHasItems(supplyCart);
    }
  }

  function renderWeather(state) {
    const weather = state.weather || "mild";
    const weatherEl = document.getElementById("stat-weather");
    const card = document.getElementById("stat-weather-card");
    if (weatherEl && global.GameWeather) {
      weatherEl.textContent = global.GameWeather.label(weather);
    }
    if (card) {
      card.setAttribute("data-weather", weather);
      let tipEl = document.getElementById("weather-tip");
      if (!tipEl) {
        tipEl = document.createElement("p");
        tipEl.id = "weather-tip";
        tipEl.className = "weather-tip";
        card.appendChild(tipEl);
      }
      tipEl.textContent = global.GameWeather
        ? global.GameWeather.tip(weather)
        : "";
    }
  }

  function renderMenuToggles(state) {
    const offered = state.menuOffered || global.GameState.defaultMenuOffered();
    const on = [];
    for (const product of global.GameState.PRODUCTS) {
      const input = document.getElementById("menu-offer-" + product);
      if (input) {
        input.checked = !!offered[product];
      }
      if (offered[product]) {
        on.push(PRODUCT_TITLES[product] || product);
      }
    }
    const hint = document.getElementById("menu-hint");
    if (hint) {
      if (on.length === 0) {
        hint.textContent =
          "No items on today’s menu — toggle at least one before Sell Day.";
      } else {
        hint.textContent =
          "Offered today: " +
          on.join(", ") +
          ". Sell Day serves every offered item; customers choose among them.";
      }
    }
  }

  function renderProductPicker(state) {
    const product = activeProduct(state);
    const selects = [
      document.getElementById("recipe-product-select"),
      document.getElementById("price-product-select"),
    ];
    for (const select of selects) {
      if (select && select.value !== product) select.value = product;
    }

    document.querySelectorAll("[data-recipe-product]").forEach(function (block) {
      block.hidden = block.getAttribute("data-recipe-product") !== product;
    });

    const recipeTitle = document.getElementById("recipe-panel-title");
    const recipeLead = document.getElementById("recipe-panel-lead");
    const item = global.GameState.productLabel(product);
    const title = PRODUCT_TITLES[product] || "Item";
    if (recipeTitle) {
      recipeTitle.textContent = title + " recipe";
    }
    if (recipeLead) {
      recipeLead.textContent =
        "Units of each ingredient used per serving of " +
        item +
        ". Switching items or closing without save discards edits.";
    }

    const priceTitle = document.getElementById("price-panel-title");
    const priceLead = document.getElementById("price-panel-lead");
    const priceLabel = document.getElementById("sell-price-label");
    const unit =
      product === "burger" || product === "soup" ? "serving" : "cup";
    if (priceTitle) {
      priceTitle.textContent = title + " price";
    }
    if (priceLead) {
      priceLead.textContent =
        "Set what you charge per " +
        unit +
        " of " +
        item +
        ". Switching items or closing without save discards edits.";
    }
    if (priceLabel) {
      priceLabel.textContent = "Dollars per " + unit;
    }
  }

  function setPanel(name) {
    for (const [key, id] of Object.entries(PANEL_IDS)) {
      const panel = document.getElementById(id);
      if (panel) panel.hidden = name !== key;
    }
  }

  function getOpenPanel() {
    for (const [key, id] of Object.entries(PANEL_IDS)) {
      const panel = document.getElementById(id);
      if (panel && !panel.hidden) return key;
    }
    return null;
  }

  function closePanel(state) {
    const wasOpen = getOpenPanel();
    setPanel(null);
    if (state) {
      fillRecipeForm(state);
      fillPriceForm(state);
    }
    return wasOpen;
  }

  /** Which ledger metric info blurb is expanded (key or null). */
  let openLedgerInfoKey = null;

  function formatLedgerValue(metric) {
    if (!metric) return "—";
    if (metric.kind === "count") return String(metric.value | 0);
    return formatMoney(metric.value);
  }

  function renderLedger(state) {
    const listEl = document.getElementById("ledger-metrics");
    const restSection = document.getElementById("ledger-restaurants");
    const restList = document.getElementById("ledger-restaurant-list");
    if (!listEl || !global.GameLedger) return;

    const display = global.GameLedger.getDisplayMetrics(state);
    listEl.innerHTML = "";

    for (const metric of display.metrics) {
      const row = document.createElement("div");
      row.className = "ledger-row";
      row.setAttribute("data-ledger-metric", metric.key);

      const head = document.createElement("div");
      head.className = "ledger-row-head";

      const label = document.createElement("span");
      label.className = "ledger-label";
      label.textContent = metric.label;

      const infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "btn-ledger-info";
      infoBtn.setAttribute("data-ledger-info", metric.key);
      infoBtn.setAttribute(
        "aria-expanded",
        openLedgerInfoKey === metric.key ? "true" : "false"
      );
      infoBtn.setAttribute(
        "aria-label",
        "What is " + metric.label + "?"
      );
      infoBtn.textContent = "?";

      const value = document.createElement("span");
      value.className = "ledger-value";
      value.textContent = formatLedgerValue(metric);

      head.append(label, infoBtn, value);

      const blurb = document.createElement("p");
      blurb.className = "ledger-info-blurb";
      blurb.id = "ledger-info-" + metric.key;
      blurb.hidden = openLedgerInfoKey !== metric.key;
      blurb.textContent =
        (display.info && display.info[metric.key]) ||
        global.GameLedger.infoFor(metric.key) ||
        "";

      row.append(head, blurb);
      listEl.appendChild(row);
    }

    if (restSection && restList) {
      const show = !!display.showRestaurants;
      restSection.hidden = !show;
      restList.innerHTML = "";
      const restInfoBtn = document.getElementById("btn-ledger-info-restaurants");
      const restBlurb = document.getElementById("ledger-info-restaurantRollup");
      if (restInfoBtn) {
        restInfoBtn.setAttribute(
          "aria-expanded",
          openLedgerInfoKey === "restaurantRollup" ? "true" : "false"
        );
      }
      if (restBlurb) {
        restBlurb.hidden = openLedgerInfoKey !== "restaurantRollup";
        restBlurb.textContent =
          (display.info && display.info.restaurantRollup) ||
          global.GameLedger.infoFor("restaurantRollup") ||
          "";
      }
      if (show) {
        for (const loc of display.restaurants) {
          const li = document.createElement("li");
          li.className = "ledger-restaurant-item";

          const title = document.createElement("div");
          title.className = "ledger-restaurant-title";
          title.textContent =
            loc.restaurantName +
            (loc.daysOperated
              ? " · " + loc.daysOperated + " day" + (loc.daysOperated === 1 ? "" : "s")
              : "");

          const row = document.createElement("div");
          row.className = "ledger-restaurant-row";
          row.innerHTML =
            "Sales <em>" +
            formatMoney(loc.revenue) +
            "</em> · COGS <em>" +
            formatMoney(loc.cogs) +
            "</em> · wages <em>" +
            formatMoney(loc.wages) +
            "</em> · rent <em>" +
            formatMoney(loc.rent) +
            "</em> · profit <em>" +
            formatMoney(loc.profit) +
            "</em>";

          li.append(title, row);
          restList.appendChild(li);
        }
      }
    }
  }

  function toggleLedgerInfo(key) {
    openLedgerInfoKey = openLedgerInfoKey === key ? null : key;
    if (cachedState) renderLedger(cachedState);
  }

  function formatDayReport(report) {
    if (!report) return null;
    if (report.message) return report.message;

    const cups = report.cupsSold ?? 0;
    const revenue = report.revenue ?? 0;
    const costs = report.cogs ?? report.costs ?? 0;
    const profit = report.profit ?? 0;
    return (
      "Sold " +
      cups +
      " serving" +
      (cups === 1 ? "" : "s") +
      ". Revenue " +
      formatMoney(revenue) +
      ", costs " +
      formatMoney(costs) +
      ", profit " +
      formatMoney(profit) +
      "."
    );
  }

  function renderStand(state) {
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    const owns = global.GameState.ownsStand(state);
    const standEl = document.getElementById("stat-stand");
    const locationLabel = document.getElementById("stat-location-label");
    if (locationLabel) {
      locationLabel.textContent = isRestaurant ? "Restaurant" : "Stand";
    }
    const gate = document.getElementById("stand-gate");
    const gateCopy = document.getElementById("stand-gate-copy");
    const buyBtn = document.getElementById("btn-buy-stand");
    const manage = document.getElementById("stand-manage");
    const select = document.getElementById("stand-select");
    const addBtn = document.getElementById("btn-add-stand");
    const sellBtn = document.getElementById("btn-sell-stand");
    const unlockBanner = document.getElementById("stand-unlock-banner");
    const manageLead = document.getElementById("stand-manage-lead");
    const count = global.GameState.standCount(state);
    const max = global.GameState.MAX_STANDS;
    const unlocked = global.GameState.extraStandUnlocked(state);
    const canAdd = global.GameState.canBuyExtraStand(state);
    const canSell = global.GameState.canSellStand(state);
    const active = global.GameState.getActiveStand(state);
    const sellPrice = Number(global.GameState.STAND_SELL_PRICE) || 10;

    if (standEl) {
      if (isRestaurant) {
        const r =
          global.GameState.getActiveRestaurant &&
          global.GameState.getActiveRestaurant(state);
        standEl.textContent = r && r.name ? r.name : "Restaurant";
      } else if (owns) {
        if (count === 1) {
          standEl.textContent = active && active.name ? active.name : "Owned";
        } else {
          standEl.textContent =
            count +
            "/" +
            max +
            (active && active.name ? " · " + active.name : "");
        }
      } else {
        standEl.textContent = "None yet";
      }
    }

    if (gate) {
      gate.hidden = owns || isRestaurant;
    }

    if (gateCopy && !owns) {
      gateCopy.innerHTML =
        "You need a corner stand before customers can buy. Cost: <strong>$" +
        Number(global.GameState.STAND_COST).toFixed(2) +
        "</strong>.";
    }

    if (buyBtn) {
      buyBtn.disabled = owns;
      buyBtn.textContent =
        "Buy stand ($" + Number(global.GameState.STAND_COST).toFixed(0) + ")";
    }

    if (manage) {
      manage.hidden = !owns || isRestaurant;
    }

    const restUnlock = document.getElementById("restaurant-unlock-banner");
    const buyRestBtn = document.getElementById("btn-buy-restaurant");
    const canBuyRest =
      global.GameState.canBuyRestaurant &&
      global.GameState.canBuyRestaurant(state);
    const restUnlocked =
      global.GameState.restaurantUnlocked &&
      global.GameState.restaurantUnlocked(state);
    if (restUnlock) {
      restUnlock.hidden = !(owns && !isRestaurant && restUnlocked);
      if (!restUnlock.hidden) {
        restUnlock.textContent =
          "4 stands and cash over $" +
          (global.GameState.RESTAURANT_UNLOCK_CASH || 1000) +
          " — you can buy a restaurant for $" +
          (global.GameState.RESTAURANT_COST || 400) +
          " (all stands will be forfeited).";
      }
    }
    if (buyRestBtn) {
      buyRestBtn.hidden = !(owns && !isRestaurant && restUnlocked);
      buyRestBtn.disabled = !canBuyRest;
      buyRestBtn.textContent =
        "Buy restaurant ($" +
        Number(global.GameState.RESTAURANT_COST || 400).toFixed(0) +
        ")";
    }

    if (manageLead && owns) {
      manageLead.textContent =
        count === 1
          ? "You own 1 stand. When cash is over $" +
            global.GameState.EXTRA_STAND_UNLOCK_CASH +
            ", you can add more (max " +
            max +
            "). Inventory is shared."
          : "You own " +
            count +
            " of " +
            max +
            " stands. Pick which stand you are managing. Inventory is shared across all stands.";
    }

    if (select && owns) {
      const prev = select.value;
      select.innerHTML = "";
      for (const stand of state.stands) {
        const opt = document.createElement("option");
        opt.value = stand.id;
        opt.textContent = stand.name;
        if (stand.id === state.activeStandId) opt.selected = true;
        select.appendChild(opt);
      }
      if (
        prev &&
        state.stands.some(function (s) {
          return s.id === prev;
        }) &&
        !state.activeStandId
      ) {
        select.value = prev;
      }
    }

    if (addBtn) {
      const showAdd = owns && count < max && unlocked;
      addBtn.hidden = !showAdd;
      addBtn.disabled = !canAdd;
      addBtn.textContent =
        "Add stand ($" + Number(global.GameState.STAND_COST).toFixed(0) + ")";
      addBtn.title = !unlocked
        ? "Unlocks when cash is over $" +
          global.GameState.EXTRA_STAND_UNLOCK_CASH
        : canAdd
          ? "Buy another stand for $" +
            Number(global.GameState.STAND_COST).toFixed(0)
          : "Need $" +
            Number(global.GameState.STAND_COST).toFixed(0) +
            " to buy another stand";
    }

    if (sellBtn) {
      sellBtn.hidden = !owns;
      sellBtn.disabled = !canSell;
      sellBtn.textContent = "Sell stand ($" + sellPrice.toFixed(0) + ")";
      sellBtn.title = canSell
        ? "Sell the active stand for $" +
          sellPrice.toFixed(0) +
          " (you must keep at least one)"
        : "You must keep at least one stand";
    }

    if (unlockBanner) {
      const showBanner = owns && count < max && unlocked;
      unlockBanner.hidden = !showBanner;
      if (showBanner) {
        unlockBanner.textContent =
          "Cash over $" +
          global.GameState.EXTRA_STAND_UNLOCK_CASH +
          " — you can add another stand for $" +
          Number(global.GameState.STAND_COST).toFixed(0) +
          " (max " +
          max +
          ").";
      }
    }

    if (global.GameMap && typeof global.GameMap.render === "function") {
      global.GameMap.render(state);
    }

    renderRestaurant(state);
    renderLocationPnl(state);
    renderStaff(state);
  }

  function renderRestaurant(state) {
    const panel = document.getElementById("restaurant-manage");
    const countEl = document.getElementById("restaurant-staff-count");
    const statusEl = document.getElementById("restaurant-status");
    const lead = document.getElementById("restaurant-manage-lead");
    const hireBtn = document.getElementById("btn-hire-restaurant");
    const layoffBtn = document.getElementById("btn-layoff-restaurant");
    const select = document.getElementById("restaurant-select");
    const addBtn = document.getElementById("btn-add-restaurant");
    const sellBtn = document.getElementById("btn-sell-restaurant");
    const extraBanner = document.getElementById("extra-restaurant-unlock-banner");
    const mapLead = document.getElementById("stand-map-lead");
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    if (panel) panel.hidden = !isRestaurant;
    if (mapLead) {
      mapLead.textContent = isRestaurant
        ? "Your restaurants on the city map. Shared supply bag continues."
        : "City map of your corner. Owned stands light up; empty pads wait for Add stand.";
    }
    if (!isRestaurant) return;

    const restaurants = Array.isArray(state.restaurants) ? state.restaurants : [];
    const count = restaurants.length;
    const maxRest = Number(global.GameState.MAX_RESTAURANTS) || 4;
    const restaurant =
      global.GameState.getActiveRestaurant &&
      global.GameState.getActiveRestaurant(state);
    const minStaff = Number(global.GameState.RESTAURANT_MIN_STAFF) || 2;
    const maxStaff = Number(global.GameState.RESTAURANT_MAX_STAFF) || 4;
    const wage = Number(global.GameState.RESTAURANT_WAGE) || 8;
    const rentEach = Number(global.GameState.RESTAURANT_RENT) || 18;
    const sellPrice = Number(global.GameState.RESTAURANT_SELL_PRICE) || 200;
    const cost = Number(global.GameState.RESTAURANT_COST) || 400;
    const unlockCash = Number(global.GameState.RESTAURANT_UNLOCK_CASH) || 1000;
    const n = restaurant ? Number(restaurant.employeeCount) || 0 : 0;
    const cap =
      global.GameState.restaurantCapacityMultFor && restaurant
        ? global.GameState.restaurantCapacityMultFor(restaurant)
        : global.GameState.restaurantCapacityMult
          ? global.GameState.restaurantCapacityMult(state)
          : 0.7 + 0.2 * n;
    const wages =
      global.GameState.dailyRestaurantWageCost
        ? global.GameState.dailyRestaurantWageCost(state)
        : n * wage;
    const rentTotal =
      global.GameState.dailyRestaurantRent
        ? global.GameState.dailyRestaurantRent(state)
        : count * rentEach;
    const check =
      global.GameState.restaurantOverheadCheck
        ? global.GameState.restaurantOverheadCheck(state)
        : { ok: n >= minStaff, message: "" };
    const extraUnlocked =
      global.GameState.extraRestaurantUnlocked &&
      global.GameState.extraRestaurantUnlocked(state);
    const canAdd =
      global.GameState.canBuyExtraRestaurant &&
      global.GameState.canBuyExtraRestaurant(state);
    const canSell =
      global.GameState.canSellRestaurant &&
      global.GameState.canSellRestaurant(state);

    if (lead) {
      lead.textContent =
        "You own " +
        count +
        " of " +
        maxRest +
        " restaurants. Hire " +
        minStaff +
        "–" +
        maxStaff +
        " at each (you cannot staff them). Wage $" +
        wage.toFixed(0) +
        "/day each + rent $" +
        rentEach.toFixed(0) +
        "/day per restaurant. Active capacity ×" +
        Number(cap).toFixed(2) +
        " (0.7 + 0.2 × staff).";
    }

    if (select) {
      select.innerHTML = "";
      for (const r of restaurants) {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent =
          r.name + " (" + (Number(r.employeeCount) || 0) + " staff)";
        if (r.id === state.activeRestaurantId) opt.selected = true;
        select.appendChild(opt);
      }
    }

    if (extraBanner) {
      extraBanner.hidden = !(count < maxRest && extraUnlocked);
      if (!extraBanner.hidden) {
        extraBanner.textContent =
          "Cash over $" +
          unlockCash +
          " — you can buy another restaurant for $" +
          cost.toFixed(0) +
          " (max " +
          maxRest +
          ").";
      }
    }

    if (addBtn) {
      addBtn.hidden = !(count < maxRest && extraUnlocked);
      addBtn.disabled = !canAdd;
      addBtn.textContent = "Add restaurant ($" + cost.toFixed(0) + ")";
      addBtn.title = !extraUnlocked
        ? "Unlocks when cash is over $" + unlockCash
        : canAdd
          ? "Buy another restaurant for $" + cost.toFixed(0)
          : "Need $" + cost.toFixed(0) + " to buy another restaurant";
    }

    if (sellBtn) {
      sellBtn.hidden = false;
      sellBtn.disabled = !canSell;
      sellBtn.textContent =
        count <= 1
          ? "Sell last → stand ($" + sellPrice.toFixed(0) + ")"
          : "Sell restaurant ($" + sellPrice.toFixed(0) + ")";
      sellBtn.title =
        count <= 1
          ? "Sell your last restaurant for $" +
            sellPrice.toFixed(0) +
            " and restart with one stand"
          : "Sell the active restaurant for $" +
            sellPrice.toFixed(0) +
            " (keep at least one, or sell last to restart stands)";
    }

    if (countEl) {
      countEl.textContent =
        (restaurant && restaurant.name ? restaurant.name + " · " : "") +
        "Employees: " +
        n +
        " / " +
        maxStaff;
    }
    if (hireBtn) {
      hireBtn.disabled = n >= maxStaff;
      hireBtn.textContent = "Hire ($" + wage.toFixed(0) + "/day)";
    }
    if (layoffBtn) {
      layoffBtn.disabled = n <= 0;
    }
    if (statusEl) {
      if (check.ok) {
        statusEl.textContent =
          "Open-ready · wages " +
          formatMoney(wages) +
          " + rent " +
          formatMoney(rentTotal) +
          " (" +
          count +
          " × " +
          formatMoney(rentEach) +
          ") = " +
          formatMoney(Number(wages) + Number(rentTotal)) +
          "/day. Active capacity ×" +
          Number(cap).toFixed(2) +
          ".";
        statusEl.classList.remove("is-warn");
        statusEl.classList.add("is-ok");
      } else {
        statusEl.textContent =
          check.message || "Staff and fund every restaurant before Sell Day.";
        statusEl.classList.remove("is-ok");
        statusEl.classList.add("is-warn");
      }
    }
  }

  function renderLocationPnl(state) {
    const panel = document.getElementById("location-pnl");
    if (!panel) return;
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    panel.hidden = !isRestaurant;
    if (!isRestaurant) return;

    const report = state.lastDayReport;
    const salesEl = document.getElementById("pnl-sales");
    const wagesEl = document.getElementById("pnl-wages");
    const rentEl = document.getElementById("pnl-rent");
    const profitEl = document.getElementById("pnl-profit");
    const noteEl = document.getElementById("location-pnl-note");
    const lead = document.getElementById("location-pnl-lead");
    const listEl = document.getElementById("location-pnl-list");
    const restaurants = Array.isArray(state.restaurants) ? state.restaurants : [];
    const count = restaurants.length;

    if (lead) {
      lead.textContent =
        count > 1
          ? "Compare sales and profitability across " +
            count +
            " restaurants (staffing and rent effects)."
          : "Sales, wages, rent, and profit for your restaurant (updates after each Sell Day).";
    }

    if (!report || !report.isRestaurant) {
      if (salesEl) salesEl.textContent = "—";
      if (wagesEl) wagesEl.textContent = "—";
      if (rentEl) rentEl.textContent = "—";
      if (profitEl) profitEl.textContent = "—";
      if (listEl) {
        listEl.hidden = true;
        listEl.innerHTML = "";
      }
      if (noteEl) {
        const lines = restaurants.map(function (r) {
          const n = Number(r.employeeCount) || 0;
          const cap = global.GameState.restaurantCapacityMultFor
            ? global.GameState.restaurantCapacityMultFor(r)
            : 0.7 + 0.2 * n;
          return (
            r.name +
            ": " +
            n +
            " staff → capacity ×" +
            Number(cap).toFixed(2)
          );
        });
        noteEl.textContent =
          "No Sell Day yet in restaurant mode. " +
          (lines.length
            ? lines.join(" · ") + ". "
            : "") +
          "More staff can raise sales but also wages against fixed rent per location.";
      }
      return;
    }

    if (salesEl) salesEl.textContent = formatMoney(report.revenue);
    if (wagesEl) wagesEl.textContent = formatMoney(report.wages);
    if (rentEl) rentEl.textContent = formatMoney(report.rent || 0);
    if (profitEl) profitEl.textContent = formatMoney(report.profit);

    const locations = Array.isArray(report.locations) ? report.locations : [];
    if (listEl) {
      if (locations.length > 1) {
        listEl.hidden = false;
        listEl.innerHTML = "";
        for (const loc of locations) {
          const li = document.createElement("li");
          li.className = "location-pnl-item";
          li.innerHTML =
            "<strong>" +
            (loc.restaurantName || "Restaurant") +
            "</strong>" +
            "<span class=\"location-pnl-item-meta\">" +
            (loc.employeeCount || 0) +
            " staff · ×" +
            Number(loc.capacityMult || 1).toFixed(2) +
            "</span>" +
            "<span class=\"location-pnl-item-row\">Sales " +
            formatMoney(loc.revenue) +
            " · Wages " +
            formatMoney(loc.wages) +
            " · Rent " +
            formatMoney(loc.rent) +
            " · <em>Profit " +
            formatMoney(loc.profit) +
            "</em></span>";
          listEl.appendChild(li);
        }
      } else {
        listEl.hidden = true;
        listEl.innerHTML = "";
      }
    }

    if (noteEl) {
      if (locations.length > 1) {
        noteEl.textContent =
          "Totals above · per-restaurant lines show how employee count changes sales vs wages against $" +
          (Number(global.GameState.RESTAURANT_RENT) || 18).toFixed(0) +
          " rent each.";
      } else {
        noteEl.textContent =
          (report.restaurantName || "Restaurant") +
          " · " +
          (report.employeeCount || 0) +
          " employees · capacity ×" +
          Number(report.capacityMult || 1).toFixed(2) +
          ". Changing staff changes sales capacity and wage cost vs fixed rent.";
      }
    }
  }

  function renderEventBanner(state) {
    const banner = document.getElementById("event-banner");
    const textEl = document.getElementById("event-banner-text");
    if (!banner) return;
    const info = state && state.eventBanner;
    if (!info || !info.message) {
      banner.hidden = true;
      banner.classList.remove("is-good", "is-bad", "is-neutral");
      if (textEl) textEl.textContent = "";
      return;
    }
    banner.hidden = false;
    banner.classList.remove("is-good", "is-bad", "is-neutral");
    const tone =
      info.tone === "good" || info.tone === "bad" || info.tone === "neutral"
        ? info.tone
        : "neutral";
    banner.classList.add("is-" + tone);
    if (textEl) textEl.textContent = info.message;
  }

  function renderStaff(state) {
    const panel = document.getElementById("staff-panel");
    const list = document.getElementById("staff-list");
    const statusEl = document.getElementById("staff-status");
    const lead = document.getElementById("staff-lead");
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    const owns = global.GameState.ownsStand(state);
    const required = global.GameState.staffingRequired(state);
    const wage = Number(global.GameState.STAND_EMPLOYEE_WAGE) || 5;
    const employees = global.GameState.employeeCount(state);
    const wageBill = global.GameState.dailyWageCost(state);

    if (panel) {
      // Stand staff UI only in stand mode (restaurant has its own panel).
      panel.hidden = !owns || isRestaurant;
    }
    if (!owns || isRestaurant || !list) return;

    if (lead) {
      lead.textContent = required
        ? "With 2 or more stands, every stand needs a worker. You may run one stand yourself; hire employees for the rest ($" +
          wage.toFixed(0) +
          "/day each, paid on Sell Day). Or staff every stand with employees."
        : "One stand: you can run it alone (no hire required). Hire an employee if you like — wage is $" +
          wage.toFixed(0) +
          "/day on Sell Day. Adding a second stand will require staffing every location.";
    }

    const check = global.GameState.staffingCheck(state);
    if (statusEl) {
      if (!required) {
        statusEl.textContent =
          employees > 0
            ? "Optional staff: " +
              employees +
              " employee" +
              (employees === 1 ? "" : "s") +
              " · today’s wage bill " +
              formatMoney(wageBill) +
              "."
            : "Staffing optional with 1 stand — you can Sell Day without hiring.";
        statusEl.classList.remove("is-warn");
        statusEl.classList.add("is-ok");
      } else if (check.ok) {
        const playerId = global.GameState.playerStandId(state);
        statusEl.textContent =
          "Fully staffed" +
          (playerId ? " (you run one stand)" : " (all employee-run)") +
          ". " +
          employees +
          " employee" +
          (employees === 1 ? "" : "s") +
          " · wage bill " +
          formatMoney(wageBill) +
          "/day.";
        statusEl.classList.remove("is-warn");
        statusEl.classList.add("is-ok");
      } else {
        statusEl.textContent = check.message;
        statusEl.classList.remove("is-ok");
        statusEl.classList.add("is-warn");
      }
    }

    list.innerHTML = "";
    for (const stand of state.stands) {
      const li = document.createElement("li");
      li.className = "staff-row";
      li.dataset.standId = stand.id;

      const meta = document.createElement("div");
      meta.className = "staff-row-meta";
      const name = document.createElement("span");
      name.className = "staff-row-name";
      name.textContent = stand.name;
      const role = document.createElement("span");
      role.className = "staff-row-role";
      role.textContent = global.GameState.staffLabel(stand.staffedBy);
      meta.append(name, role);

      const actions = document.createElement("div");
      actions.className = "staff-row-actions";

      const isPlayer = stand.staffedBy === global.GameState.STAFF_PLAYER;
      const isEmployee = stand.staffedBy === global.GameState.STAFF_EMPLOYEE;

      if (isPlayer) {
        const unassign = document.createElement("button");
        unassign.type = "button";
        unassign.className = "btn btn-quiet";
        unassign.dataset.staffAction = "unassign-player";
        unassign.dataset.standId = stand.id;
        unassign.textContent = "Stop running";
        actions.appendChild(unassign);
      } else {
        const assign = document.createElement("button");
        assign.type = "button";
        assign.className = "btn";
        assign.dataset.staffAction = "assign-player";
        assign.dataset.standId = stand.id;
        assign.textContent = "I run this";
        assign.title = "Assign yourself to this stand (only one at a time)";
        actions.appendChild(assign);
      }

      if (isEmployee) {
        const layoff = document.createElement("button");
        layoff.type = "button";
        layoff.className = "btn btn-quiet";
        layoff.dataset.staffAction = "layoff";
        layoff.dataset.standId = stand.id;
        layoff.textContent = "Lay off";
        actions.appendChild(layoff);
      } else if (!isPlayer) {
        const hire = document.createElement("button");
        hire.type = "button";
        hire.className = "btn btn-primary";
        hire.dataset.staffAction = "hire";
        hire.dataset.standId = stand.id;
        hire.textContent = "Hire ($" + wage.toFixed(0) + "/day)";
        hire.title = "No upfront cost — wage paid on Sell Day";
        actions.appendChild(hire);
      }

      li.append(meta, actions);
      list.appendChild(li);
    }
  }

  function renderInstructions() {
    const hidden = global.GameState.loadInstructionsHidden();
    const panel = document.getElementById("instructions");
    const reveal = document.getElementById("instructions-reveal");
    if (panel) panel.hidden = hidden;
    if (reveal) reveal.hidden = !hidden;
  }

  function setInstructionsHidden(hidden) {
    global.GameState.saveInstructionsHidden(!!hidden);
    renderInstructions();
  }

  function morningHint(state) {
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    if (
      !isRestaurant &&
      !global.GameState.ownsStand(state)
    ) {
      return (
        "Buy your first stand for $" +
        Number(global.GameState.STAND_COST).toFixed(2) +
        " before Sell Day unlocks."
      );
    }

    const staffCheck = global.GameState.staffingCheck(state);
    if (!staffCheck.ok) {
      return staffCheck.message;
    }

    if (isRestaurant) {
      const n = global.GameState.restaurantEmployeeCount
        ? global.GameState.restaurantEmployeeCount(state)
        : 0;
      const cap = global.GameState.restaurantCapacityMult
        ? global.GameState.restaurantCapacityMult(state)
        : 1;
      const rent = global.GameState.dailyRestaurantRent
        ? global.GameState.dailyRestaurantRent(state)
        : Number(global.GameState.RESTAURANT_RENT) || 18;
      const wages = global.GameState.dailyRestaurantWageCost
        ? global.GameState.dailyRestaurantWageCost(state)
        : 0;
      return (
        "Restaurant open with " +
        n +
        " employee" +
        (n === 1 ? "" : "s") +
        " (capacity ×" +
        Number(cap).toFixed(2) +
        "). Overhead today: wages " +
        formatMoney(wages) +
        " + rent " +
        formatMoney(rent) +
        ". Set menu, stock up, then Sell Day."
      );
    }

    const offered = global.GameEconomy.offeredProducts
      ? global.GameEconomy.offeredProducts(state)
      : global.GameState.PRODUCTS.filter(function (p) {
          return global.GameState.isMenuOffered(state, p);
        });

    function withUnlockTip(text) {
      if (!global.GameState.extraStandUnlocked(state)) return text;
      const left =
        global.GameState.MAX_STANDS - global.GameState.standCount(state);
      return (
        text +
        " You can also Add stand ($" +
        Number(global.GameState.STAND_COST).toFixed(0) +
        ") — " +
        left +
        " slot" +
        (left === 1 ? "" : "s") +
        " left."
      );
    }

    function withWageTip(text) {
      const employees = global.GameState.employeeCount(state);
      if (employees <= 0) return text;
      return (
        text +
        " Employee wages today: " +
        formatMoney(global.GameState.dailyWageCost(state)) +
        "."
      );
    }

    if (offered.length === 0) {
      return withWageTip(
        withUnlockTip(
          "Toggle at least one item on Today’s menu before Sell Day."
        )
      );
    }

    const weather = state.weather || "mild";
    let totalStock = 0;
    const stocked = [];
    const unpriced = [];

    for (const product of offered) {
      const stock = global.GameEconomy.maxCupsFromStock(state, product);
      totalStock += stock;
      if (stock > 0) stocked.push(product);
      const price = Number(
        state.prices && state.prices[product] != null
          ? state.prices[product]
          : 0
      );
      if (!Number.isFinite(price) || price <= 0) unpriced.push(product);
    }

    if (stocked.length === 0) {
      return withWageTip(
        withUnlockTip(
          "No stock for today’s menu (" +
            offered
              .map(function (p) {
                return global.GameState.productLabel(p);
              })
              .join(", ") +
            ") — buy ingredients first."
        )
      );
    }

    if (unpriced.length === offered.length) {
      return withWageTip(
        withUnlockTip(
          "Set a sell price above $0 for at least one offered item."
        )
      );
    }

    const labels = stocked.map(function (p) {
      return global.GameState.productLabel(p);
    });
    let fit = "";
    const favors = stocked.filter(function (p) {
      return global.GameWeather
        ? global.GameWeather.favorsProduct(weather, p) === true
        : false;
    });
    if (favors.length) {
      fit =
        " " +
        global.GameWeather.label(weather) +
        " weather favors " +
        favors
          .map(function (p) {
            return global.GameState.productLabel(p);
          })
          .join(" / ") +
        ".";
    }

    return withWageTip(
      withUnlockTip(
        "Menu ready: " +
          labels.join(", ") +
          " (~" +
          totalStock +
          " servings in stock)." +
          fit
      )
    );
  }

  function renderMorningHint(state) {
    const hint = document.getElementById("morning-hint");
    if (!hint) return;
    const text = morningHint(state);
    hint.textContent = text || "";
    hint.hidden = !text;
  }

  function renderInventoryVisibility() {
    const section = document.getElementById("inventory-section");
    const reveal = document.getElementById("inventory-reveal");
    const hidden = global.GameState.loadInventoryHidden
      ? global.GameState.loadInventoryHidden()
      : false;
    if (section) section.hidden = !!hidden;
    if (reveal) reveal.hidden = !hidden;
  }

  function setInventoryHidden(hidden) {
    if (global.GameState.saveInventoryHidden) {
      global.GameState.saveInventoryHidden(!!hidden);
    }
    renderInventoryVisibility();
  }

  function setBusinessTab(tab) {
    businessTab = tab === "daily" ? "daily" : "business";
    const businessPanel = document.getElementById("business-tab-business");
    const dailyPanel = document.getElementById("business-tab-daily");
    const businessBtn = document.getElementById("tab-business-summary");
    const dailyBtn = document.getElementById("tab-daily-summary");
    if (businessPanel) businessPanel.hidden = businessTab !== "business";
    if (dailyPanel) dailyPanel.hidden = businessTab !== "daily";
    if (businessBtn) {
      businessBtn.classList.toggle("is-active", businessTab === "business");
      businessBtn.setAttribute(
        "aria-selected",
        businessTab === "business" ? "true" : "false"
      );
    }
    if (dailyBtn) {
      dailyBtn.classList.toggle("is-active", businessTab === "daily");
      dailyBtn.setAttribute(
        "aria-selected",
        businessTab === "daily" ? "true" : "false"
      );
    }
  }

  function syncBusinessDailySummary(text) {
    const body = document.getElementById("business-daily-summary-body");
    if (!body) return;
    if (text) {
      body.textContent = text;
      return;
    }
    if (cachedState && cachedState.lastDayReport) {
      const formatted = formatDayReport(cachedState.lastDayReport);
      if (formatted) {
        body.textContent = formatted;
        return;
      }
    }
    body.textContent =
      "No Sell Day yet. Run a day to see today’s report here.";
  }

  function renderDailySummaryVisibility() {
    const section = document.getElementById("daily-summary");
    if (section) section.hidden = !!dailySummaryHidden;
  }

  function setDailySummaryHidden(hidden) {
    dailySummaryHidden = !!hidden;
    renderDailySummaryVisibility();
    if (hidden && businessTab === "daily") {
      setBusinessTab("business");
    }
  }

  function showDailySummary() {
    dailySummaryHidden = false;
    renderDailySummaryVisibility();
  }

  function render(state) {
    cachedState = state;
    const dayEl = document.getElementById("stat-day");
    const cashEl = document.getElementById("stat-cash");
    const listEl = document.getElementById("inventory-list");
    const reportEl = document.getElementById("report-body");

    if (dayEl) dayEl.textContent = String(state.day);
    if (cashEl) cashEl.textContent = formatMoney(state.cash);

    if (listEl) {
      const labels = global.GameState.inventoryLabels();
      listEl.innerHTML = "";
      for (const key of global.GameState.INVENTORY_KEYS) {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = labels[key];
        const qty = document.createElement("span");
        qty.className = "qty";
        qty.textContent = String(state.inventory[key] ?? 0);
        li.append(name, qty);
        listEl.appendChild(li);
      }
    }

    renderWeather(state);
    renderStand(state);
    renderEventBanner(state);
    renderInstructions();
    renderMenuToggles(state);
    renderProductPicker(state);
    fillRecipeForm(state);
    fillPriceForm(state);
    renderBuyPrices(state);
    renderCart(state);
    renderMorningHint(state);
    renderInventoryVisibility();
    renderDailySummaryVisibility();
    setBusinessTab(businessTab);

    const sellBtn = document.getElementById("btn-sell");
    if (sellBtn && !sellBtn.textContent.includes("Selling")) {
      sellBtn.disabled = !(global.GameState.ownsBusiness ? global.GameState.ownsBusiness(state) : global.GameState.ownsStand(state));
    }

    const businessOpen = getOpenPanel() === "business";
    if (businessOpen) renderLedger(state);

    if (reportEl) {
      const text = formatDayReport(state.lastDayReport);
      reportEl.textContent = text || MORNING_COPY;
      reportEl.classList.remove("is-receipt");
      syncBusinessDailySummary(text || null);
    }
  }

  function setReport(message, { flash, receipt, revealDaily } = {}) {
    const reportEl = document.getElementById("report-body");
    const panel = document.getElementById("daily-summary") || document.querySelector(".report");
    if (reportEl) {
      reportEl.textContent = message;
      reportEl.classList.toggle("is-receipt", !!receipt);
    }
    syncBusinessDailySummary(message);
    if (revealDaily || receipt) {
      showDailySummary();
    }
    if (flash && panel && !panel.hidden) {
      panel.classList.remove("is-fresh");
      void panel.offsetWidth;
      panel.classList.add("is-fresh");
    }
  }

  function svgIcon(kind) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "customer-icon");
    svg.setAttribute("aria-hidden", "true");
    const stroke = "currentColor";

    function path(d, fill) {
      const el = document.createElementNS(ns, "path");
      el.setAttribute("d", d);
      el.setAttribute("fill", fill || "none");
      el.setAttribute("stroke", stroke);
      el.setAttribute("stroke-width", "2");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
      svg.appendChild(el);
    }

    function circle(cx, cy, r, fill) {
      const el = document.createElementNS(ns, "circle");
      el.setAttribute("cx", String(cx));
      el.setAttribute("cy", String(cy));
      el.setAttribute("r", String(r));
      el.setAttribute("fill", fill || "none");
      el.setAttribute("stroke", stroke);
      el.setAttribute("stroke-width", "2");
      svg.appendChild(el);
    }

    if (kind === "price") {
      path("M12 3v18");
      path("M16 8a3 3 0 0 0-3-2h-2a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2a3 3 0 0 1-3-2");
      path("M4 4l16 16");
    } else if (kind === "stock") {
      path("M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z");
      path("M8 8V6a4 4 0 0 1 8 0v2");
    } else if (kind === "weather") {
      path("M7 16a4 4 0 0 1 .5-7.9A5 5 0 0 1 17 10a3.5 3.5 0 0 1 .2 7H7z");
      path("M4 4l16 16");
    } else if (kind === "happy") {
      path("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z");
      path("M8.5 10.5h.01");
      path("M15.5 10.5h.01");
      path("M8.5 14.5c1.2 1.4 2.5 2 3.5 2s2.3-.6 3.5-2", "none");
    } else if (kind === "like") {
      path(
        "M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm3 9h6.5a2 2 0 0 0 1.9-1.4l2-6A2 2 0 0 0 18.5 10H14V6a2 2 0 0 0-2-2l-2 7v9z"
      );
    } else if (kind === "dislike") {
      path(
        "M7 13V4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3zm3-9h6.5a2 2 0 0 1 1.9 1.4l2 6A2 2 0 0 1 18.5 14H14v4a2 2 0 0 1-2 2l-2-7V4z"
      );
    } else if (kind === "juice") {
      // Tall cold cup with straw.
      path("M8 7h8l-1 12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2L8 7z");
      path("M9 7V5h6");
      path("M14 3v5");
      path("M10 12h4");
    } else if (kind === "cocoa") {
      // Mug with steam.
      path("M6 9h10v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9z");
      path("M16 11h2a2 2 0 0 1 0 4h-2");
      path("M9 5c0 1 .5 1.5.5 2.5");
      path("M12 4.5c0 1 .5 1.5.5 2.5");
    } else if (kind === "burger") {
      // Layered burger.
      path("M5 11h14v2H5z");
      path("M6 9c0-2.5 2.5-4 6-4s6 1.5 6 4H6z");
      path("M6 15h12c0 2-2.5 3.5-6 3.5S6 17 6 15z");
      circle(9, 12, 0.6, "currentColor");
      circle(15, 12, 0.6, "currentColor");
    } else if (kind === "soup") {
      // Bowl with spoon.
      path("M4 11h16a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z");
      path("M8 11c0-2 1.5-3.5 4-3.5");
      path("M16 6l3-2 1 1-2 3");
    } else {
      path("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z");
    }
    return svg;
  }

  function setSellDayLocked(locked, state) {
    const sell = document.getElementById("btn-sell");
    if (sell) {
      const owns =
        state && global.GameState.ownsBusiness
          ? global.GameState.ownsBusiness(state)
          : state
            ? global.GameState.ownsStand(state)
            : true;
      sell.disabled = !!locked || (state && !owns);
      sell.textContent = locked ? "Selling…" : "Sell Day";
    }

    // Recipe / Buy / Price / Business leave standby while the day plays.
    const standbyIds = [
      "btn-recipe",
      "btn-buy",
      "btn-price",
      "btn-business",
      "recipe-product-select",
      "price-product-select",
    ];
    for (const id of standbyIds) {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !!locked;
    }
  }

  function startCustomerDay() {
    const day = document.getElementById("customer-day");
    const stage = document.getElementById("customer-stage");
    const summary = document.getElementById("customer-summary");
    const progress = document.getElementById("customer-day-progress");
    if (summary) summary.hidden = true;
    if (day) day.hidden = false;
    if (stage) stage.innerHTML = "";
    if (progress) progress.textContent = "Customers are arriving…";
    setSellDayLocked(true);
  }

  function showCustomerEvent(event) {
    const stage = document.getElementById("customer-stage");
    const progress = document.getElementById("customer-day-progress");
    if (!stage) return;

    const chip = document.createElement("div");
    chip.className =
      "customer-chip " + (event.outcome === "buy" ? "is-buy" : "is-leave");

    let label = "Bought";
    if (event.outcome === "leave") {
      if (event.product) {
        chip.appendChild(svgIcon(event.product));
      }
      chip.appendChild(svgIcon(event.reason || "price"));
      label = global.GameCustomers
        ? global.GameCustomers.leaveReasonLabel(event.reason, event.product)
        : "Left";
    } else {
      // Bought item icon + reaction icon (Phase 12).
      if (event.product) {
        chip.appendChild(svgIcon(event.product));
      }
      chip.appendChild(svgIcon(event.reaction || "like"));
      label = global.GameCustomers
        ? global.GameCustomers.buyReactionLabel(event.reaction, event.product)
        : "Bought";
    }

    const text = document.createElement("span");
    text.textContent = label;
    chip.appendChild(text);
    stage.appendChild(chip);

    if (progress) {
      const buys = stage.querySelectorAll(".is-buy").length;
      const leaves = stage.querySelectorAll(".is-leave").length;
      progress.textContent =
        buys + " bought · " + leaves + " left";
    }
  }

  function showCustomerSummary(summary, plan, state) {
    const day = document.getElementById("customer-day");
    const summaryEl = document.getElementById("customer-summary");
    const body = document.getElementById("customer-summary-body");
    const progress = document.getElementById("customer-day-progress");
    if (progress) progress.textContent = "Day complete";
    if (summaryEl) summaryEl.hidden = false;
    if (body) {
      body.innerHTML = "";
      const byProduct = (summary && summary.byProduct) || {};
      const products = global.GameState.PRODUCTS || [
        "juice",
        "cocoa",
        "burger",
        "soup",
      ];
      const totals = {
        happy: 0,
        likes: 0,
        dislikes: 0,
        leftStock: 0,
        leftPrice: 0,
        leftWeather: 0,
      };

      function addRow(name, row, isTotal) {
        const tr = document.createElement("tr");
        const cells = [
          name,
          row.happy | 0,
          row.likes | 0,
          row.dislikes | 0,
          row.leftStock | 0,
          row.leftPrice | 0,
          row.leftWeather | 0,
        ];
        cells.forEach(function (value, index) {
          const cell = document.createElement(index === 0 || isTotal ? "th" : "td");
          if (index === 0) cell.setAttribute("scope", "row");
          cell.textContent = String(value);
          tr.appendChild(cell);
        });
        body.appendChild(tr);
      }

      for (const product of products) {
        const row = byProduct[product] || {
          happy: 0,
          likes: 0,
          dislikes: 0,
          leftStock: 0,
          leftPrice: 0,
          leftWeather: 0,
        };
        const hasActivity =
          (row.happy | 0) +
            (row.likes | 0) +
            (row.dislikes | 0) +
            (row.leftStock | 0) +
            (row.leftPrice | 0) +
            (row.leftWeather | 0) >
          0;
        if (!hasActivity) continue;
        totals.happy += row.happy | 0;
        totals.likes += row.likes | 0;
        totals.dislikes += row.dislikes | 0;
        totals.leftStock += row.leftStock | 0;
        totals.leftPrice += row.leftPrice | 0;
        totals.leftWeather += row.leftWeather | 0;
        const label = global.GameCustomers
          ? global.GameCustomers.productShortLabel(product)
          : product;
        addRow(label, row, false);
      }

      addRow("Total", totals, true);
    }
    if (day) day.hidden = false;
    setSellDayLocked(false, state);
    if (plan && plan.message) {
      setReport(plan.message, { flash: true, revealDaily: true });
    }
  }

  function hideCustomerDay(state) {
    const day = document.getElementById("customer-day");
    const summary = document.getElementById("customer-summary");
    const stage = document.getElementById("customer-stage");
    if (day) day.hidden = true;
    if (summary) summary.hidden = true;
    if (stage) stage.innerHTML = "";
    setSellDayLocked(false, state);
  }

  function hideCustomerSummary() {
    const summary = document.getElementById("customer-summary");
    if (summary) summary.hidden = true;
  }

  const recipeForm = document.getElementById("form-recipe");
  if (recipeForm) {
    recipeForm.addEventListener("input", function () {
      renderRecipeStats(cachedState);
    });
  }

  const ledgerPanel = document.getElementById("panel-business");
  if (ledgerPanel) {
    ledgerPanel.addEventListener("click", function (event) {
      const btn = event.target.closest("[data-ledger-info]");
      if (!btn) return;
      const key = btn.getAttribute("data-ledger-info");
      if (key) toggleLedgerInfo(key);
    });
  }

  // Default business tab on load.
  setBusinessTab("business");

  global.GameUI = {
    MORNING_COPY,
    formatMoney,
    render,
    setReport,
    setPanel,
    getOpenPanel,
    closePanel,
    readRecipeForm,
    readPriceForm,
    readBuyQty,
    getCart,
    resetCart,
    addToCart,
    removeFromCart,
    clearCart,
    renderCart,
    renderRecipeStats,
    renderMenuToggles,
    morningHint,
    renderStand,
    renderStaff,
    renderEventBanner,
    renderInstructions,
    setInstructionsHidden,
    setInventoryHidden,
    setBusinessTab,
    setDailySummaryHidden,
    showDailySummary,
    setSellDayLocked,
    renderLedger,
    startCustomerDay,
    showCustomerEvent,
    showCustomerSummary,
    hideCustomerSummary,
    hideCustomerDay,
  };
})(window);
