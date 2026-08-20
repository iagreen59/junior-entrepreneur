/**
 * DOM updates / panel rendering.
 * Phase 3: price panel + richer day-report display.
 */
(function (global) {
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
    const recipePanel = document.getElementById("panel-recipe");
    const buyPanel = document.getElementById("panel-buy");
    const pricePanel = document.getElementById("panel-price");
    if (recipePanel) recipePanel.hidden = name !== "recipe";
    if (buyPanel) buyPanel.hidden = name !== "buy";
    if (pricePanel) pricePanel.hidden = name !== "price";
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

    if (reportEl) {
      const text = formatDayReport(state.lastDayReport);
      reportEl.textContent =
        text || "Open for business. Prep your stand, then sell the day.";
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
    formatMoney,
    render,
    setReport,
    setPanel,
    readRecipeForm,
    readPriceForm,
    readBuyQty,
  };
})(window);
