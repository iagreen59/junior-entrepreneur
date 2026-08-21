/**
 * DOM updates / panel rendering.
 * Phase 5: panel Close controls + Escape to dismiss without saving drafts.
 */
(function (global) {
  const MORNING_COPY =
    "Good morning. Recipe → Buy → Price → Sell Day. Stock up before you open.";

  const PANEL_IDS = {
    recipe: "panel-recipe",
    buy: "panel-buy",
    price: "panel-price",
  };

  function formatMoney(amount) {
    const sign = amount < 0 ? "-" : "";
    return sign + "$" + Math.abs(amount).toFixed(2);
  }

  function fillRecipeForm(state) {
    for (const key of global.GameState.INVENTORY_KEYS) {
      const input = document.getElementById("recipe-" + key);
      if (input) input.value = String(state.recipe[key] ?? 0);
    }
  }

  function fillPriceForm(state) {
    const input = document.getElementById("sell-price");
    if (input) input.value = Number(state.price).toFixed(2);
  }

  function readRecipeForm() {
    const draft = {};
    for (const key of global.GameState.INVENTORY_KEYS) {
      const input = document.getElementById("recipe-" + key);
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
          labels[key] + " — " + formatMoney(global.GameState.unitPrice(key)) + " each";
      }
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

  /**
   * Short readiness line under the morning checklist (stock / price hints).
   */
  function morningHint(state) {
    const stockCups = global.GameEconomy.maxCupsFromStock(state);
    const price = Number(state.price);
    if (stockCups <= 0) {
      return "No cups ready — buy ingredients that match your recipe first.";
    }
    if (!Number.isFinite(price) || price <= 0) {
      return "Set a sell price before you open.";
    }
    return (
      "Ready for about " +
      stockCups +
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
      // Restart animation
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
