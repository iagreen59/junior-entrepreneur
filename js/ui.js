/**
 * DOM updates / panel rendering.
 * Phase 6: product picker, dual recipe/price forms, full inventory/buy list.
 */
(function (global) {
  const MORNING_COPY =
    "Good morning. Pick a drink → Recipe → Buy → Price → Sell Day.";

  const PANEL_IDS = {
    recipe: "panel-recipe",
    buy: "panel-buy",
    price: "panel-price",
  };

  function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "$" + Math.abs(amount).toFixed(2);
  }

  function activeProduct(state) {
    return state.activeProduct === "cocoa" ? "cocoa" : "juice";
  }

  function recipeCupsInputId(product) {
    return product === "cocoa" ? "recipe-cocoa-cups" : "recipe-juice-cups";
  }

  function fillRecipeForm(state) {
    const product = activeProduct(state);
    const recipe = global.GameState.activeRecipe(state) || {};
    for (const key of global.GameState.recipeKeysFor(product)) {
      const inputId =
        key === "cups" ? recipeCupsInputId(product) : "recipe-" + key;
      const input = document.getElementById(inputId);
      if (input) input.value = String(recipe[key] ?? 0);
    }
  }

  function fillPriceForm(state) {
    const input = document.getElementById("sell-price");
    if (input) {
      input.value = Number(global.GameState.activePrice(state)).toFixed(2);
    }
  }

  function readRecipeForm(state) {
    const product = activeProduct(state);
    const draft = {};
    for (const key of global.GameState.recipeKeysFor(product)) {
      const inputId =
        key === "cups" ? recipeCupsInputId(product) : "recipe-" + key;
      const input = document.getElementById(inputId);
      draft[key] = input ? input.value : 0;
    }
    return draft;
  }

  function readPriceForm() {
    const input = document.getElementById("sell-price");
    return input ? input.value : "0";
  }

  function readBuyQty(key) {
    const input = document.getElementById("buy-qty-" + key);
    return input ? input.value : "0";
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

  function renderProductPicker(state) {
    const product = activeProduct(state);
    document.querySelectorAll("[data-product]").forEach(function (btn) {
      const isActive = btn.getAttribute("data-product") === product;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const hint = document.getElementById("product-hint");
    if (hint) {
      hint.textContent =
        "Selling " +
        global.GameState.productLabel(product) +
        ". Recipe, price, and Sell Day use this drink.";
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
        "Units of each ingredient used per cup of " + drink + ".";
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

  /**
   * Hide any open panel and restore Recipe/Price fields from saved state
   * so Close / Escape discard unsaved edits.
   */
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

  function morningHint(state) {
    const product = activeProduct(state);
    const drink = global.GameState.productLabel(product);
    const stockCups = global.GameEconomy.maxCupsFromStock(state);
    const price = Number(global.GameState.activePrice(state));
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
    return (
      "Ready for about " +
      stockCups +
      " " +
      drink +
      " cup" +
      (stockCups === 1 ? "" : "s") +
      " at " +
      formatMoney(price) +
      "."
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

    renderProductPicker(state);
    fillRecipeForm(state);
    fillPriceForm(state);
    renderBuyPrices();
    renderMorningHint(state);

    if (reportEl) {
      const text = formatDayReport(state.lastDayReport);
      reportEl.textContent = text || MORNING_COPY;
    }
  }

  function setReport(message, { flash } = {}) {
    const reportEl = document.getElementById("report-body");
    const panel = document.querySelector(".report");
    if (reportEl) reportEl.textContent = message;
    if (flash && panel) {
      panel.classList.remove("is-fresh");
      void panel.offsetWidth;
      panel.classList.add("is-fresh");
    }
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
    morningHint,
  };
})(window);
