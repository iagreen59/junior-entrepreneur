/**
 * DOM updates / panel rendering.
 * Phase 7: weather status + preference tips for juice vs cocoa.
 * Phase 9: stand ownership gate + hideable instructions panel.
 * Phase 10: coldCups / hotCups fields; recipe yield + COGS display.
 */
(function (global) {
  const MORNING_COPY =
    "Good morning. Buy your stand if needed, check the weather, pick a drink → Recipe → Buy → Price → Sell Day.";

  const PANEL_IDS = {
    recipe: "panel-recipe",
    buy: "panel-buy",
    price: "panel-price",
  };

  /** Latest state from render() — used for live recipe yield/COGS updates. */
  let cachedState = null;

  function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "$" + Math.abs(amount).toFixed(2);
  }

  function activeProduct(state) {
    return state.activeProduct === "cocoa" ? "cocoa" : "juice";
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
    const drink = global.GameState.productLabel(product);

    const yieldEl = document.getElementById("recipe-yield");
    const cogsEl = document.getElementById("recipe-cogs");
    if (yieldEl) {
      yieldEl.textContent =
        "Can make " +
        servings +
        " serving" +
        (servings === 1 ? "" : "s") +
        " of " +
        drink +
        " from current stock.";
    }
    if (cogsEl) {
      cogsEl.textContent =
        "COGS per " + drink + ": " + formatMoney(cogs) + ".";
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

  function renderBuyPrices() {
    const labels = global.GameState.inventoryLabels();
    for (const key of global.GameState.INVENTORY_KEYS) {
      const priceEl = document.getElementById("buy-price-" + key);
      if (priceEl) {
        priceEl.textContent =
          labels[key] +
          " — " +
          formatMoney(global.GameState.unitPrice(key)) +
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

    const total = global.GameState.cartTotal(supplyCart);
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
      let fit = "Mild weather — either drink is fine.";
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
      hint.textContent =
        "Selling " + global.GameState.productLabel(product) + ". " + fit;
    }

    document.querySelectorAll("[data-recipe-product]").forEach(function (block) {
      block.hidden = block.getAttribute("data-recipe-product") !== product;
    });

    const recipeTitle = document.getElementById("recipe-panel-title");
    const recipeLead = document.getElementById("recipe-panel-lead");
    const drink = global.GameState.productLabel(product);
    if (recipeTitle) {
      recipeTitle.textContent =
        product === "cocoa" ? "Hot cocoa recipe" : "Juice recipe";
    }
    if (recipeLead) {
      recipeLead.textContent =
        "Units of each ingredient used per cup of " +
        drink +
        ". Juice uses cold cups; cocoa uses hot cups.";
    }

    const priceTitle = document.getElementById("price-panel-title");
    const priceLead = document.getElementById("price-panel-lead");
    if (priceTitle) {
      priceTitle.textContent =
        product === "cocoa" ? "Hot cocoa price" : "Juice price";
    }
    if (priceLead) {
      priceLead.textContent =
        "Set what you charge per cup of " +
        drink +
        ". Higher prices usually mean fewer buyers. Juice and cocoa prices are saved separately.";
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
      " cup" +
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

    if (standEl) {
      if (owns) {
        const stand = state.stands[0];
        standEl.textContent = stand && stand.name ? stand.name : "Owned";
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

    const product = activeProduct(state);
    const drink = global.GameState.productLabel(product);
    const weather = state.weather || "mild";
    const stockCups = global.GameEconomy.maxCupsFromStock(state, product);
    const price = Number(global.GameState.activePrice(state));
    const favor = global.GameWeather
      ? global.GameWeather.favorsProduct(weather, product)
      : null;

    if (stockCups <= 0) {
      return (
        "No " +
        drink +
        " cups ready — buy ingredients that match that recipe first."
      );
    }
    if (!Number.isFinite(price) || price <= 0) {
      return "Set a sell price for " + drink + " before you open.";
    }

    let fit = "";
    if (favor === true) fit = " Weather match.";
    if (favor === false) fit = " Weather mismatch — expect fewer buyers.";

    return (
      "Ready for about " +
      stockCups +
      " " +
      drink +
      " cup" +
      (stockCups === 1 ? "" : "s") +
      " at " +
      formatMoney(price) +
      "." +
      fit
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
    renderInstructions();
    renderProductPicker(state);
    fillRecipeForm(state);
    fillPriceForm(state);
    renderBuyPrices();
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

    if (kind === "price") {
      // Dollar with slash
      path("M12 3v18");
      path("M16 8a3 3 0 0 0-3-2h-2a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2a3 3 0 0 1-3-2");
      path("M4 4l16 16");
    } else if (kind === "stock") {
      // Empty cup outline
      path("M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z");
      path("M8 8V6a4 4 0 0 1 8 0v2");
    } else if (kind === "weather") {
      // Cloud with sun rays crossed feel
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

    let kind = "like";
    let label = "Bought";
    if (event.outcome === "leave") {
      kind = event.reason || "price";
      label = global.GameCustomers
        ? global.GameCustomers.leaveReasonLabel(event.reason)
        : "Left";
    } else {
      kind = event.reaction || "like";
      label = global.GameCustomers
        ? global.GameCustomers.buyReactionLabel(event.reaction)
        : "Bought";
    }

    chip.appendChild(svgIcon(kind));
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
      const rows = [
        ["Bought", summary.bought],
        ["Happy", summary.happy],
        ["Liked", summary.likes],
        ["Disliked", summary.dislikes],
        ["Left (price)", summary.leftPrice],
        ["Left (stock)", summary.leftStock],
        ["Left (weather)", summary.leftWeather],
        ["Left total", summary.left],
      ];
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

  // Live-update recipe yield / COGS while editing amounts (no main.js change).
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
    morningHint,
    renderStand,
    renderInstructions,
    setInstructionsHidden,
    setSellDayLocked,
    startCustomerDay,
    showCustomerEvent,
    showCustomerSummary,
    hideCustomerDay,
  };
})(window);
