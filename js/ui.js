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
 */
(function (global) {
  const MORNING_COPY =
    "Good morning. Buy your stand if needed, staff multi-stand locations, check the weather, set today’s menu, edit recipes & prices for offered items, Buy stock, then Sell Day.";

  const PANEL_IDS = {
    recipe: "panel-recipe",
    buy: "panel-buy",
    price: "panel-price",
  };

  const PRODUCT_TITLES = {
    juice: "Juice",
    cocoa: "Hot cocoa",
    burger: "Burger",
    soup: "Soup",
  };

  /** Latest state from render() — used for live recipe yield/COGS updates. */
  let cachedState = null;

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
    const weather = state.weather || "mild";
    document.querySelectorAll("[data-product]").forEach(function (btn) {
      const isActive = btn.getAttribute("data-product") === product;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const hint = document.getElementById("product-hint");
    if (hint) {
      const favor = global.GameWeather
        ? global.GameWeather.favorsProduct(weather, product)
        : null;
      let fit = "Mild weather — any item is fine.";
      if (favor === true) {
        fit =
          global.GameWeather.label(weather) +
          " weather favors " +
          global.GameState.productLabel(product) +
          ".";
      } else if (favor === false) {
        fit =
          global.GameWeather.label(weather) +
          " weather is a mismatch for " +
          global.GameState.productLabel(product) +
          ".";
      }
      const onMenu = global.GameState.isMenuOffered(state, product);
      hint.textContent =
        "Editing " +
        global.GameState.productLabel(product) +
        (onMenu
          ? " (on today’s menu — Sell Day can sell it). "
          : " (off today’s menu — not sold until you toggle it on). ") +
        fit;
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
        ". Ingredients are unique to this product.";
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
        ". Each menu item has its own saved price.";
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
    const owns = global.GameState.ownsStand(state);
    const standEl = document.getElementById("stat-stand");
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
      if (owns) {
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
      gate.hidden = owns;
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
      manage.hidden = !owns;
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

    renderStaff(state);
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
    const owns = global.GameState.ownsStand(state);
    const required = global.GameState.staffingRequired(state);
    const wage = Number(global.GameState.STAND_EMPLOYEE_WAGE) || 5;
    const employees = global.GameState.employeeCount(state);
    const wageBill = global.GameState.dailyWageCost(state);

    if (panel) {
      // Show staff UI whenever the player owns stands (1 stand: optional self-run).
      panel.hidden = !owns;
    }
    if (!owns || !list) return;

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
    if (!global.GameState.ownsStand(state)) {
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
    const list = document.getElementById("morning-list");
    if (!list) return;
    let hint = document.getElementById("morning-hint");
    if (!hint) {
      hint = document.createElement("p");
      hint.id = "morning-hint";
      hint.className = "morning-hint";
      list.insertAdjacentElement("afterend", hint);
    }
    hint.textContent = morningHint(state);
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

    const sellBtn = document.getElementById("btn-sell");
    if (sellBtn && !sellBtn.textContent.includes("Selling")) {
      sellBtn.disabled = !global.GameState.ownsStand(state);
    }

    if (reportEl) {
      const text = formatDayReport(state.lastDayReport);
      reportEl.textContent = text || MORNING_COPY;
      reportEl.classList.remove("is-receipt");
    }
  }

  function setReport(message, { flash, receipt } = {}) {
    const reportEl = document.getElementById("report-body");
    const panel = document.querySelector(".report");
    if (reportEl) {
      reportEl.textContent = message;
      reportEl.classList.toggle("is-receipt", !!receipt);
    }
    if (flash && panel) {
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
      const noStand = state ? !global.GameState.ownsStand(state) : false;
      sell.disabled = !!locked || noStand;
      sell.textContent = locked ? "Selling…" : "Sell Day";
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
      chip.appendChild(svgIcon(event.reason || "price"));
      label = global.GameCustomers
        ? global.GameCustomers.leaveReasonLabel(event.reason)
        : "Left";
    } else {
      // Bought item icon + reaction icon (Phase 12).
      if (event.product) {
        chip.appendChild(svgIcon(event.product));
      }
      chip.appendChild(svgIcon(event.reaction || "like"));
      const itemName = global.GameCustomers
        ? global.GameCustomers.productShortLabel(event.product)
        : "Item";
      const reaction = global.GameCustomers
        ? global.GameCustomers.buyReactionLabel(event.reaction)
        : "Bought";
      label = itemName + " · " + reaction;
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
    const list = document.getElementById("customer-summary-list");
    const progress = document.getElementById("customer-day-progress");
    if (progress) progress.textContent = "Day complete";
    if (summaryEl) summaryEl.hidden = false;
    if (list) {
      const rows = [];
      const byProduct =
        (summary && summary.boughtByProduct) ||
        (plan && plan.soldByProduct) ||
        {};
      for (const product of global.GameState.PRODUCTS) {
        const qty = byProduct[product] | 0;
        if (qty > 0) {
          rows.push([
            "Bought " +
              (global.GameCustomers
                ? global.GameCustomers.productShortLabel(product)
                : product),
            qty,
          ]);
        }
      }
      rows.push(
        ["Bought total", summary.bought],
        ["Happy", summary.happy],
        ["Liked", summary.likes],
        ["Disliked", summary.dislikes],
        ["Left (price)", summary.leftPrice],
        ["Left (stock)", summary.leftStock],
        ["Left (weather)", summary.leftWeather],
        ["Left total", summary.left]
      );
      list.innerHTML = "";
      for (const [name, qty] of rows) {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = name;
        const value = document.createElement("span");
        value.className = "qty";
        value.textContent = String(qty);
        li.append(label, value);
        list.appendChild(li);
      }
    }
    if (day) day.hidden = false;
    setSellDayLocked(false, state);
    if (plan && plan.message) {
      setReport(plan.message, { flash: true });
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

  const recipeForm = document.getElementById("form-recipe");
  if (recipeForm) {
    recipeForm.addEventListener("input", function () {
      renderRecipeStats(cachedState);
    });
  }

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
    setSellDayLocked,
    startCustomerDay,
    showCustomerEvent,
    showCustomerSummary,
    hideCustomerDay,
  };
})(window);
