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
    "Good morning. Buy your stand if needed, staff multi-stand locations, check the weather, set today’s menu, edit recipes & prices for offered items, order supplies, then Sell Day.";

  const PANEL_IDS = {
    recipe: "panel-recipe",
    buy: "panel-buy",
    business: "panel-business",
  };

  const PRODUCT_TITLES = {
    juice: "Juice",
    cocoa: "Hot cocoa",
    burger: "Burger",
    soup: "Soup",
  };

  /** P&L trend chart: duration (5 | 30) and metric key. */
  let pnlChartDuration = 5;
  let pnlChartMetric = "profit";

  const PNL_CHART_METRICS = [
    { key: "revenue", label: "Revenue" },
    { key: "cogs", label: "COGS" },
    { key: "wages", label: "Wages" },
    { key: "rent", label: "Rent" },
    { key: "profit", label: "Profit" },
  ];

  /** Latest state from render() — used for live recipe yield/COGS updates. */
  let cachedState = null;
  /** Business panel tab: "business" (default) | "daily". */
  let businessTab = "business";
  /** Whether the day-results panel is hidden by the player. */
  let dayResultsHidden = true;
  /** Hint blurb visible inside day-results. */
  let dayHintsVisible = false;
  /** Latest completed-day report bound to the panel (live or history). */
  let activeDayReport = null;
  /** "live" after Sell Day; "history" when opened from Business / day stat. */
  let dayResultsMode = "live";

  function dayHistoryList(state) {
    const history = state && Array.isArray(state.dayHistory) ? state.dayHistory : [];
    if (history.length) return history;
    if (state && state.lastDayReport) return [state.lastDayReport];
    return [];
  }

  function reportForCompletedDay(state, completedDay) {
    const day = Number(completedDay);
    if (!Number.isFinite(day)) return null;
    const history = dayHistoryList(state);
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (Number(entry.completedDay) === day) return entry;
    }
    return null;
  }

  function latestCompletedReport(state) {
    const history = dayHistoryList(state);
    return history.length ? history[history.length - 1] : null;
  }

  function populateDayHistorySelect(selectEl, state, selectedDay) {
    if (!selectEl) return;
    const history = dayHistoryList(state);
    selectEl.innerHTML = "";
    if (!history.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No completed days yet";
      selectEl.appendChild(opt);
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      const dayNum = Number(entry.completedDay) || i + 1;
      const opt = document.createElement("option");
      opt.value = String(dayNum);
      const weatherLabel =
        entry.weather && global.GameWeather
          ? global.GameWeather.label(entry.weather)
          : "";
      opt.textContent =
        "Day " +
        dayNum +
        (weatherLabel ? " · " + weatherLabel : "");
      selectEl.appendChild(opt);
    }
    const pick =
      selectedDay != null
        ? String(selectedDay)
        : String(history[history.length - 1].completedDay || history.length);
    if (selectEl.querySelector('option[value="' + pick + '"]')) {
      selectEl.value = pick;
    }
  }

  function renderCustomerSummaryTable(summary) {
    const body = document.getElementById("customer-summary-body");
    const wrap = document.getElementById("day-results-table-wrap");
    if (!body) return;
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
    let anyRow = false;

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
      anyRow = true;
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

    if (anyRow) addRow("Total", totals, true);
    if (wrap) wrap.hidden = !anyRow;
  }

  function renderDayHints(report, state) {
    const hintsEl = document.getElementById("day-results-hints");
    const btn = document.getElementById("btn-day-hints");
    if (!hintsEl || !btn) return;
    const hints =
      global.GameRecipePrefs && report
        ? global.GameRecipePrefs.buildHints(report, state)
        : [];
    hintsEl.innerHTML = "";
    if (!hints.length) {
      hintsEl.hidden = true;
      btn.hidden = true;
      dayHintsVisible = false;
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "Show hints";
      return;
    }
    btn.hidden = false;
    const list = document.createElement("ul");
    list.className = "day-results-hints-list";
    for (const line of hints) {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    }
    hintsEl.appendChild(list);
    hintsEl.hidden = !dayHintsVisible;
    btn.setAttribute("aria-expanded", dayHintsVisible ? "true" : "false");
    btn.textContent = dayHintsVisible ? "Hide hints" : "Show hints";
  }

  function setDayHintsVisible(visible) {
    dayHintsVisible = !!visible;
    const hintsEl = document.getElementById("day-results-hints");
    const btn = document.getElementById("btn-day-hints");
    if (hintsEl) hintsEl.hidden = !dayHintsVisible;
    if (btn) {
      btn.setAttribute("aria-expanded", dayHintsVisible ? "true" : "false");
      btn.textContent = dayHintsVisible ? "Hide hints" : "Show hints";
    }
  }

  function setDayResultsTitle(mode, report) {
    const titleEl = document.getElementById("day-results-title");
    if (!titleEl) return;
    if (mode === "history") {
      const dayNum = report && report.completedDay ? report.completedDay : "—";
      titleEl.textContent = "Previous day · Day " + dayNum;
      return;
    }
    if (mode === "live-complete") {
      titleEl.textContent = "Day complete";
      return;
    }
    titleEl.textContent = "Customers today";
  }

  function renderDayResultsVisibility() {
    const panel = document.getElementById("day-results");
    if (panel) panel.hidden = !!dayResultsHidden;
  }

  function showDayResultsPanel() {
    dayResultsHidden = false;
    renderDayResultsVisibility();
  }

  function hideDayResultsPanel() {
    dayResultsHidden = true;
    dayHintsVisible = false;
    renderDayResultsVisibility();
    setDayHintsVisible(false);
  }

  function bindDayResultsReport(report, summary, state, mode) {
    activeDayReport = report || null;
    dayResultsMode = mode || "live";
    const historyWrap = document.getElementById("day-history-select-wrap");
    if (historyWrap) historyWrap.hidden = true;

    const backBtn = document.getElementById("btn-back-to-business");
    if (backBtn) {
      backBtn.hidden = mode !== "history" && mode !== "live-complete";
    }

    setDayResultsTitle(
      mode === "history"
        ? "history"
        : mode === "live-complete"
          ? "live-complete"
          : "live",
      report
    );

    const progress = document.getElementById("day-results-progress");
    if (progress) {
      if (mode === "live") {
        progress.textContent = "Customers are arriving…";
      } else if (summary) {
        const bought = summary.bought | 0;
        const left = summary.left | 0;
        progress.textContent = bought + " bought · " + left + " left";
      } else {
        progress.textContent = "";
      }
    }

    if (summary) renderCustomerSummaryTable(summary);
    else {
      const wrap = document.getElementById("day-results-table-wrap");
      if (wrap) wrap.hidden = true;
    }

    const stage = document.getElementById("customer-stage");
    if (stage && mode === "history") stage.innerHTML = "";

    const reportEl = document.getElementById("report-body");
    const text = formatDayReportStructured(report);
    if (reportEl) {
      if (mode === "live") {
        reportEl.textContent = "";
        reportEl.hidden = true;
        reportEl.classList.remove("is-pnl");
      } else {
        reportEl.hidden = false;
        reportEl.textContent = text || MORNING_COPY;
        reportEl.classList.toggle("is-pnl", !!text);
      }
      reportEl.classList.remove("is-receipt");
    }

    const hintsBtn = document.getElementById("btn-day-hints");
    if (hintsBtn) hintsBtn.hidden = mode === "live";

    if (mode === "live") {
      renderDayHints(null, state);
    } else {
      renderDayHints(report, state);
    }
    setDayHintsVisible(false);
    showDayResultsPanel();
  }

  function showPreviousDay(state, completedDay) {
    const report = latestCompletedReport(state);
    if (!report) {
      return {
        ok: false,
        message: "No completed Sell Day yet — run Sell Day to see results here.",
      };
    }
    closePanel();
    bindDayResultsReport(
      report,
      report.customers || null,
      state,
      "history"
    );
    const panel = document.getElementById("day-results");
    if (panel) {
      panel.classList.remove("is-fresh");
      void panel.offsetWidth;
      panel.classList.add("is-fresh");
    }
    return { ok: true, report: report };
  }

  function renderPreviousDayPreview(state) {
    const labelEl = document.getElementById("previous-day-label");
    const report = latestCompletedReport(state);
    if (!labelEl) return;
    if (!report) {
      labelEl.textContent = "No completed Sell Day yet — run Sell Day to see results here.";
      return;
    }
    const dayNum = Number(report.completedDay) || "—";
    const weatherLabel =
      report.weather && global.GameWeather
        ? global.GameWeather.label(report.weather)
        : "";
    labelEl.textContent =
      "Latest: Day " +
      dayNum +
      (weatherLabel ? " · " + weatherLabel : "") +
      " — profit " +
      formatMoney(report.profit ?? 0);
  }

  function renderBusinessDaySelect(state) {
    renderPreviousDayPreview(state);
  }

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

  function fillPriceForm(state) {
    const input = document.getElementById("sell-price");
    if (input) {
      input.value = Number(global.GameState.activePrice(state)).toFixed(2);
    }
  }

  function fillRecipeForm(state) {
    const product = activeProduct(state);
    const recipe = global.GameState.activeRecipe(state) || {};
    for (const key of global.GameState.recipeKeysFor(product)) {
      const input = document.getElementById("recipe-" + key);
      if (input) input.value = String(recipe[key] ?? 0);
    }
    // Sell price must load before stats — renderRecipeStats reads #sell-price.
    fillPriceForm(state);
    renderRecipeStats(state);
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

  function renderMenuSummary(state) {
    const listEl = document.getElementById("recipe-menu-summary-list");
    if (!listEl || !state) return;
    listEl.innerHTML = "";
    for (const product of global.GameState.PRODUCTS) {
      const recipe =
        (state.recipes && state.recipes[product]) ||
        global.GameState.activeRecipe(
          Object.assign({}, state, { activeProduct: product })
        ) ||
        {};
      const price = Number(
        state.prices && state.prices[product] != null
          ? state.prices[product]
          : 0
      );
      const cogs = global.GameEconomy.costOfGoodsPerServing(
        state,
        product,
        recipe
      );
      const profit = +(price - cogs).toFixed(2);
      const title = PRODUCT_TITLES[product] || product;
      const li = document.createElement("li");
      li.className = "recipe-menu-summary-item";
      if (global.GameState.isMenuOffered(state, product)) {
        li.classList.add("is-offered");
      }
      li.innerHTML =
        "<span class=\"recipe-menu-summary-name\">" +
        title +
        "</span>" +
        "<span class=\"recipe-menu-summary-detail\">Cost " +
        formatMoney(cogs) +
        " · Profit " +
        formatMoney(profit) +
        " (at " +
        formatMoney(price) +
        ")</span>";
      listEl.appendChild(li);
    }
  }

  /**
   * Show max sellable servings from current inventory + cost/profit per serving
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
    const price = Number(readPriceForm());
    const validPrice = Number.isFinite(price) && price >= 0 ? price : 0;
    const profit = +(validPrice - cogs).toFixed(2);
    const item = global.GameState.productLabel(product);

    const yieldEl = document.getElementById("recipe-yield");
    const cogsEl = document.getElementById("recipe-cogs");
    const profitEl = document.getElementById("recipe-profit");
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
      cogsEl.textContent = "Cost per " + item + ": " + formatMoney(cogs) + ".";
    }
    if (profitEl) {
      profitEl.textContent =
        "Profit per " +
        item +
        ": " +
        formatMoney(profit) +
        " (at " +
        formatMoney(validPrice) +
        ").";
      profitEl.classList.toggle("is-negative", profit < 0);
    }

    renderMenuSummary(source);
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

  function ensureBuyListBuilt() {
    const list = document.getElementById("buy-list");
    if (!list || list.children.length > 0) return;
    const labels = global.GameState.inventoryLabels();
    for (const key of global.GameState.INVENTORY_KEYS) {
      const li = document.createElement("li");
      li.className = "buy-row";
      li.dataset.ingredient = key;

      const meta = document.createElement("div");
      meta.className = "buy-meta";
      const name = document.createElement("span");
      name.className = "buy-name";
      name.id = "buy-price-" + key;
      name.textContent = labels[key];
      meta.appendChild(name);

      const onHandCell = document.createElement("div");
      onHandCell.className = "buy-onhand-cell";
      const onHandLabel = document.createElement("span");
      onHandLabel.className = "buy-onhand-label";
      onHandLabel.textContent = "On hand";
      const onHandQty = document.createElement("span");
      onHandQty.className = "buy-onhand-qty";
      onHandQty.id = "onhand-qty-" + key;
      onHandQty.textContent = "0";
      onHandCell.append(onHandLabel, onHandQty);

      const controls = document.createElement("div");
      controls.className = "buy-controls";
      const qtyLabel = document.createElement("label");
      qtyLabel.className = "field field-inline";
      const hidden = document.createElement("span");
      hidden.className = "visually-hidden";
      hidden.textContent = "Quantity of " + labels[key].toLowerCase();
      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.id = "buy-qty-" + key;
      qtyInput.min = "1";
      qtyInput.step = "1";
      qtyInput.value = "10";
      qtyLabel.append(hidden, qtyInput);
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-panel";
      addBtn.setAttribute("data-add-cart", key);
      addBtn.textContent = "Add to cart";
      controls.append(qtyLabel, addBtn);

      const cartCell = document.createElement("div");
      cartCell.className = "buy-cart-cell";
      const cartQty = document.createElement("span");
      cartQty.className = "buy-cart-qty";
      cartQty.id = "cart-qty-" + key;
      cartQty.setAttribute("aria-live", "polite");
      cartQty.textContent = "0";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-quiet-inline";
      removeBtn.setAttribute("data-remove-cart", key);
      removeBtn.setAttribute("aria-label", "Remove " + labels[key].toLowerCase() + " from cart");
      removeBtn.textContent = "Remove";
      cartCell.append(cartQty, removeBtn);

      li.append(meta, onHandCell, controls, cartCell);
      list.appendChild(li);
    }
  }

  function renderBuyList(state) {
    ensureBuyListBuilt();
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
      const onHandEl = document.getElementById("onhand-qty-" + key);
      if (onHandEl) {
        onHandEl.textContent = String(state.inventory[key] ?? 0);
      }
    }
    renderCart(state);
  }

  function renderBuyPrices(state) {
    renderBuyList(state);
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
        hint.textContent = "Offered today: " + on.join(", ") + ".";
      }
    }
  }

  function renderProductPicker(state) {
    const product = activeProduct(state);
    const select = document.getElementById("recipe-product-select");
    if (select && select.value !== product) select.value = product;

    document.querySelectorAll("[data-recipe-product]").forEach(function (block) {
      block.hidden = block.getAttribute("data-recipe-product") !== product;
    });

    const recipeTitle = document.getElementById("recipe-panel-title");
    const recipeLead = document.getElementById("recipe-panel-lead");
    const item = global.GameState.productLabel(product);
    const title = PRODUCT_TITLES[product] || "Item";
    const unit =
      product === "burger" || product === "soup" ? "serving" : "cup";
    if (recipeTitle) {
      recipeTitle.textContent = title + " recipe & price";
    }
    if (recipeLead) {
      recipeLead.textContent =
        "Set ingredients and price per " +
        unit +
        " of " +
        item +
        ". Switching items or closing without save discards edits.";
    }
    const priceLabel = document.getElementById("sell-price-label");
    if (priceLabel) {
      priceLabel.textContent = "Sell price (per " + unit + ")";
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

  function renderPnlTrendChart(state) {
    const section = document.getElementById("pnl-trend-section");
    const chartEl = document.getElementById("pnl-trend-chart");
    const durationSelect = document.getElementById("pnl-chart-duration");
    const metricSelect = document.getElementById("pnl-chart-metric");
    if (!section || !chartEl) return;

    const history = dayHistoryList(state);
    section.hidden = history.length === 0;

    if (durationSelect && durationSelect.value !== String(pnlChartDuration)) {
      durationSelect.value = String(pnlChartDuration);
    }
    if (metricSelect && metricSelect.value !== pnlChartMetric) {
      metricSelect.value = pnlChartMetric;
    }

    const days = pnlChartDuration === 30 ? 30 : 5;
    const slice = history.slice(-days);

    if (slice.length < 2) {
      chartEl.innerHTML =
        '<p class="pnl-chart-empty">Complete at least 2 Sell Days to see a trend line.</p>';
      return;
    }

    const metricDef =
      PNL_CHART_METRICS.find(function (m) {
        return m.key === pnlChartMetric;
      }) || PNL_CHART_METRICS[4];
    const values = slice.map(function (entry) {
      return Number(entry[metricDef.key]) || 0;
    });
    const labels = slice.map(function (entry) {
      return "D" + (Number(entry.completedDay) || "?");
    });

    const width = 320;
    const height = 140;
    const padL = 44;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    let minVal = Math.min.apply(null, values);
    let maxVal = Math.max.apply(null, values);
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const range = maxVal - minVal || 1;

    function xAt(i) {
      if (values.length === 1) return padL + plotW / 2;
      return padL + (i / (values.length - 1)) * plotW;
    }
    function yAt(v) {
      return padT + plotH - ((v - minVal) / range) * plotH;
    }

    const points = values
      .map(function (v, i) {
        return xAt(i).toFixed(1) + "," + yAt(v).toFixed(1);
      })
      .join(" ");

    const zeroInRange = minVal <= 0 && maxVal >= 0;
    const zeroY = zeroInRange ? yAt(0) : null;

    let gridLines = "";
    for (let t = 0; t <= 4; t++) {
      const v = minVal + (range * t) / 4;
      const y = yAt(v).toFixed(1);
      gridLines +=
        '<line class="pnl-chart-grid" x1="' +
        padL +
        '" y1="' +
        y +
        '" x2="' +
        (width - padR) +
        '" y2="' +
        y +
        '"/>';
      gridLines +=
        '<text class="pnl-chart-axis" x="' +
        (padL - 6) +
        '" y="' +
        y +
        '" text-anchor="end" dominant-baseline="middle">' +
        formatMoney(v) +
        "</text>";
    }

    let xLabels = "";
    const labelStep = values.length <= 6 ? 1 : Math.ceil(values.length / 5);
    for (let i = 0; i < labels.length; i += labelStep) {
      xLabels +=
        '<text class="pnl-chart-axis" x="' +
        xAt(i).toFixed(1) +
        '" y="' +
        (height - 6) +
        '" text-anchor="middle">' +
        labels[i] +
        "</text>";
    }

    chartEl.innerHTML =
      '<p class="pnl-chart-caption">' +
      metricDef.label +
      " · last " +
      slice.length +
      " day" +
      (slice.length === 1 ? "" : "s") +
      "</p>" +
      '<svg class="pnl-chart-svg" viewBox="0 0 ' +
      width +
      " " +
      height +
      '" role="img" aria-label="' +
      metricDef.label +
      " trend over " +
      slice.length +
      ' days">' +
      gridLines +
      (zeroY != null
        ? '<line class="pnl-chart-zero" x1="' +
          padL +
          '" y1="' +
          zeroY.toFixed(1) +
          '" x2="' +
          (width - padR) +
          '" y2="' +
          zeroY.toFixed(1) +
          '"/>'
        : "") +
      '<polyline class="pnl-chart-line" points="' +
      points +
      '"/>' +
      values
        .map(function (v, i) {
          return (
            '<circle class="pnl-chart-dot" cx="' +
            xAt(i).toFixed(1) +
            '" cy="' +
            yAt(v).toFixed(1) +
            '" r="3"><title>Day ' +
            labels[i].slice(1) +
            ": " +
            formatMoney(v) +
            "</title></circle>"
          );
        })
        .join("") +
      xLabels +
      "</svg>";
  }

  function setPnlChartDuration(days) {
    pnlChartDuration = days === 30 ? 30 : 5;
    if (cachedState) renderPnlTrendChart(cachedState);
  }

  function setPnlChartMetric(key) {
    const found = PNL_CHART_METRICS.some(function (m) {
      return m.key === key;
    });
    pnlChartMetric = found ? key : "profit";
    if (cachedState) renderPnlTrendChart(cachedState);
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

    renderPnlTrendChart(state);
  }

  function toggleLedgerInfo(key) {
    openLedgerInfoKey = openLedgerInfoKey === key ? null : key;
    if (cachedState) renderLedger(cachedState);
  }

  function servingWord(product, count) {
    if (product === "burger" || product === "soup") {
      return count === 1 ? "serving" : "servings";
    }
    return count === 1 ? "cup" : "cups";
  }

  function soldBreakdownLines(report) {
    if (!report || !report.soldByProduct) return [];
    const prices = report.prices || {};
    const products = global.GameState.PRODUCTS || [
      "juice",
      "cocoa",
      "burger",
      "soup",
    ];
    const lines = [];
    for (const product of products) {
      const n = report.soldByProduct[product] | 0;
      if (n <= 0) continue;
      const label = global.GameState.productLabel(product);
      const price = prices[product];
      lines.push(
        "  " +
          n +
          " " +
          label +
          " " +
          servingWord(product, n) +
          " @ " +
          formatMoney(price)
      );
    }
    return lines;
  }

  function weatherNoteFromReport(report) {
    if (!report || !report.weather) return "";
    const offered =
      report.products && report.products.length
        ? report.products
        : report.product
          ? [report.product]
          : [];
    if (!offered.length) return "";
    const weather = report.weather;
    const favors = offered.filter(function (product) {
      return global.GameWeather
        ? global.GameWeather.favorsProduct(weather, product) === true
        : false;
    });
    const mismatches = offered.filter(function (product) {
      return global.GameWeather
        ? global.GameWeather.favorsProduct(weather, product) === false
        : false;
    });
    if (favors.length) {
      return (
        global.GameWeather.label(weather) +
        " weather helped " +
        favors
          .map(function (p) {
            return global.GameState.productLabel(p);
          })
          .join(" / ") +
        "."
      );
    }
    if (mismatches.length === offered.length) {
      return (
        global.GameWeather.label(weather) +
        " weather cooled interest in today's menu."
      );
    }
    return "";
  }

  function formatDayReportStructured(report) {
    if (!report) return null;

    const lines = [];
    const revenue = report.revenue ?? 0;
    const cogs = report.cogs ?? report.costs ?? 0;
    const wages = report.wages ?? 0;
    const rent = report.rent ?? 0;
    const profit = report.profit ?? 0;
    const breakdown = soldBreakdownLines(report);
    const weatherNote = weatherNoteFromReport(report);

    if (report.isRestaurant && report.locations && report.locations.length) {
      lines.push(
        report.locations.length === 1
          ? "Restaurant P&L"
          : "Per-restaurant P&L"
      );
      lines.push("");
      for (const loc of report.locations) {
        if (report.locations.length > 1) {
          lines.push(loc.restaurantName || "Restaurant");
        }
        lines.push("  Sales     " + formatMoney(loc.revenue));
        lines.push("  Wages     " + formatMoney(loc.wages));
        lines.push("  Rent      " + formatMoney(loc.rent));
        lines.push("  Profit    " + formatMoney(loc.profit));
        lines.push("");
        lines.push("  " + loc.employeeCount + " staff");
        lines.push("");
      }
    } else {
      lines.push("Day P&L");
      lines.push("");
      lines.push("  Revenue   " + formatMoney(revenue));
      if (wages > 0) {
        lines.push("  Wages     " + formatMoney(wages));
      }
      if (rent > 0) {
        lines.push("  Rent      " + formatMoney(rent));
      }
      lines.push("  COGS      " + formatMoney(cogs));
      lines.push("  Profit    " + formatMoney(profit));
      lines.push("");
    }

    if (breakdown.length) {
      lines.push("Sales");
      lines.push.apply(lines, breakdown);
      lines.push("");
      lines.push("  COGS      " + formatMoney(cogs));
      lines.push("");
    } else if (report.cupsSold === 0 || breakdown.length === 0) {
      if (report.products && report.products.length === 0) {
        lines.push("No items on today's menu — sold 0 servings.");
        lines.push("");
      } else if ((report.stockCups | 0) === 0) {
        lines.push("No stock for today's offered menu — sold 0 servings.");
        lines.push("");
      } else if ((report.cupsSold | 0) === 0) {
        lines.push("Sold 0 servings from today's menu.");
        lines.push("");
      }
    }

    if (report.soldOut && report.soldOutProducts && report.soldOutProducts.length) {
      lines.push(
        "Sold out: " +
          report.soldOutProducts
            .map(function (p) {
              return global.GameState.productLabel(p);
            })
            .join(", ") +
          "."
      );
      lines.push("");
    }

    if (weatherNote) {
      lines.push(weatherNote);
    }

    return lines.join("\n").trim();
  }

  function formatDayReport(report) {
    return formatDayReportStructured(report) || (report && report.message) || null;
  }

  function renderStand(state) {
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    const owns = global.GameState.ownsStand(state);
    const panelTitle = document.getElementById("locations-panel-title");
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

    if (panelTitle) {
      if (isRestaurant) {
        panelTitle.textContent = "Your restaurants";
      } else if (owns) {
        panelTitle.textContent =
          count === 1 ? "Your stand" : "Your stands";
      } else {
        panelTitle.textContent = "Your stand";
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
    renderStaff(state);
    renderLocationsSummary(state);
  }

  function renderLocationsSummary(state) {
    const summaryEl = document.getElementById("locations-summary");
    if (!summaryEl) return;

    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    const owns = global.GameState.ownsStand(state);

    if (isRestaurant) {
      const restaurants = Array.isArray(state.restaurants)
        ? state.restaurants
        : [];
      const count = restaurants.length;
      const employees = global.GameState.employeeCount(state);
      const active =
        global.GameState.getActiveRestaurant &&
        global.GameState.getActiveRestaurant(state);
      let text =
        count +
        " restaurant" +
        (count === 1 ? "" : "s") +
        " · " +
        employees +
        " employee" +
        (employees === 1 ? "" : "s");
      if (active && active.name) {
        text += " · " + active.name;
      }
      summaryEl.textContent = text;
      return;
    }

    if (!owns) {
      summaryEl.textContent =
        "No stand yet · Buy one for $" +
        Number(global.GameState.STAND_COST).toFixed(0);
      return;
    }

    const count = global.GameState.standCount(state);
    const employees = global.GameState.employeeCount(state);
    const active = global.GameState.getActiveStand(state);
    const playerStandId = global.GameState.playerStandId(state);
    const parts = [
      count + " stand" + (count === 1 ? "" : "s"),
      employees +
        " employee" +
        (employees === 1 ? "" : "s"),
    ];

    if (playerStandId) {
      const playerStand = state.stands.find(function (s) {
        return s.id === playerStandId;
      });
      parts.push(
        "You at " + (playerStand && playerStand.name ? playerStand.name : "one stand")
      );
    } else if (count === 1 && employees === 0) {
      parts.push("You running it");
    } else if (global.GameState.staffingRequired(state)) {
      const check = global.GameState.staffingCheck(state);
      if (!check.ok) {
        parts.push("Understaffed");
      } else {
        parts.push("All employee-run");
      }
    }

    if (active && active.name && count > 1) {
      parts.push("Viewing " + active.name);
    }

    summaryEl.textContent = parts.join(" · ");
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
    const isRestaurant =
      global.GameState.isRestaurantMode &&
      global.GameState.isRestaurantMode(state);
    if (panel) panel.hidden = !isRestaurant;
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
    const wages =
      global.GameState.dailyWageCost
        ? global.GameState.dailyWageCost(state)
        : global.GameState.dailyRestaurantWageCost
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
        "/day per restaurant.";
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
          "/day.";
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
    const projectedWages =
      global.GameState.dailyWageCost
        ? global.GameState.dailyWageCost(state)
        : global.GameState.dailyRestaurantWageCost
          ? global.GameState.dailyRestaurantWageCost(state)
          : 0;
    const projectedRent =
      global.GameState.dailyRestaurantRent
        ? global.GameState.dailyRestaurantRent(state)
        : (Number(global.GameState.RESTAURANT_RENT) || 18) * count;

    if (lead) {
      lead.textContent =
        "Sales and profit update after each Sell Day. Wages update when you change staff or today’s menu.";
    }

    if (!report || !report.isRestaurant) {
      if (salesEl) salesEl.textContent = "—";
      if (wagesEl) wagesEl.textContent = formatMoney(projectedWages);
      if (rentEl) rentEl.textContent = formatMoney(projectedRent);
      if (profitEl) profitEl.textContent = "—";
      if (listEl) {
        listEl.hidden = true;
        listEl.innerHTML = "";
      }
      if (noteEl) {
        const lines = restaurants.map(function (r) {
          const n = Number(r.employeeCount) || 0;
          return r.name + ": " + n + " staff";
        });
        noteEl.textContent =
          "No Sell Day yet in restaurant mode. " +
          (lines.length ? lines.join(" · ") + ". " : "") +
          "More staff can raise sales but also wages against fixed rent per location.";
      }
      return;
    }

    if (salesEl) salesEl.textContent = formatMoney(report.revenue);
    // Live wage bill so menu / staffing changes show immediately.
    if (wagesEl) wagesEl.textContent = formatMoney(projectedWages);
    if (rentEl) rentEl.textContent = formatMoney(projectedRent);
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
            " staff</span>" +
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
          "Totals: sales/profit from last Sell Day · wages & rent reflect today’s staffing and menu vs $" +
          (Number(global.GameState.RESTAURANT_RENT) || 18).toFixed(0) +
          " rent each.";
      } else {
        noteEl.textContent =
          (report.restaurantName || "Restaurant") +
          " · " +
          (report.employeeCount || 0) +
          " employees. Changing staff or today’s menu changes wage cost vs fixed rent.";
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
      const menuNote =
        " Menu with 2+ items adds $" +
        (Number(global.GameState.MENU_WAGE_SURCHARGE) || 0.5).toFixed(2) +
        "/day per employee per extra item.";
      lead.textContent = required
        ? "With 2 or more stands, every stand needs a worker. You may run one stand yourself; hire employees for the rest ($" +
          wage.toFixed(0) +
          "/day each, paid on Sell Day)." +
          menuNote +
          " Or staff every stand with employees."
        : "One stand: you can run it alone (no hire required). Hire an employee if you like — wage is $" +
          wage.toFixed(0) +
          "/day on Sell Day." +
          menuNote +
          " Adding a second stand will require staffing every location.";
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
    const activeStand = global.GameState.getActiveStand(state);
    const standsToShow = activeStand ? [activeStand] : state.stands.slice(0, 1);
    for (const stand of standsToShow) {
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
      const rent = global.GameState.dailyRestaurantRent
        ? global.GameState.dailyRestaurantRent(state)
        : Number(global.GameState.RESTAURANT_RENT) || 18;
      const wages = global.GameState.dailyWageCost
        ? global.GameState.dailyWageCost(state)
        : global.GameState.dailyRestaurantWageCost
          ? global.GameState.dailyRestaurantWageCost(state)
          : 0;
      return (
        "Restaurant open with " +
        n +
        " employee" +
        (n === 1 ? "" : "s") +
        ". Overhead today: wages " +
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
      const wages = global.GameState.dailyWageCost(state);
      const surcharge =
        global.GameState.menuWageSurcharge &&
        global.GameState.menuWageSurcharge(state);
      if (employees <= 0 && !(surcharge > 0)) return text;
      let tip = text + " Wages today: " + formatMoney(wages) + ".";
      if (surcharge > 0) {
        const perEmployee =
          global.GameState.menuWageSurchargePerEmployee &&
          global.GameState.menuWageSurchargePerEmployee(state);
        tip +=
          " (includes " +
          formatMoney(surcharge) +
          " menu surcharge — " +
          formatMoney(perEmployee) +
          "/employee per extra item)";
      }
      return tip;
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
          "Set a sell price above $0 for at least one offered item in Recipe."
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

  function renderLocationsVisibility() {
    const panel = document.getElementById("locations-panel");
    const details = document.getElementById("locations-details");
    const summary = document.getElementById("locations-summary");
    const reveal = document.getElementById("locations-reveal");
    const header = panel ? panel.querySelector(".panel-header") : null;
    const hidden = global.GameState.loadLocationsHidden
      ? global.GameState.loadLocationsHidden()
      : false;
    if (panel) panel.classList.toggle("is-collapsed", !!hidden);
    if (details) details.hidden = !!hidden;
    if (summary) summary.hidden = !hidden;
    if (header) header.hidden = !!hidden;
    if (reveal) reveal.hidden = !hidden;
  }

  function setLocationsHidden(hidden) {
    if (global.GameState.saveLocationsHidden) {
      global.GameState.saveLocationsHidden(!!hidden);
    }
    renderLocationsVisibility();
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
    const dailyBtn = document.getElementById("tab-previous-day");
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
    if (businessTab === "daily" && cachedState) {
      renderBusinessDaySelect(cachedState);
    }
  }

  function openPreviousDayFromBusiness(state) {
    const result = showPreviousDay(state);
    if (result && result.ok) {
      businessTab = "daily";
      return result;
    }
    setBusinessTab("daily");
    setPanel("business");
    renderBusinessDaySelect(state);
    return result || {
      ok: false,
      message: "No completed Sell Day yet — run Sell Day to see results here.",
    };
  }

  let menuInfoVisible = false;

  function setMenuInfoVisible(visible) {
    menuInfoVisible = !!visible;
    const info = document.getElementById("menu-info");
    const btn = document.getElementById("btn-menu-info");
    if (info) info.hidden = !menuInfoVisible;
    if (btn) {
      btn.setAttribute("aria-expanded", menuInfoVisible ? "true" : "false");
      btn.textContent = menuInfoVisible ? "Hide info" : "Info";
    }
  }

  function toggleMenuInfo() {
    setMenuInfoVisible(!menuInfoVisible);
  }

  function render(state) {
    cachedState = state;
    const dayEl = document.getElementById("stat-day");
    const cashEl = document.getElementById("stat-cash");
    const reportEl = document.getElementById("report-body");

    if (dayEl) dayEl.textContent = String(state.day);
    if (cashEl) cashEl.textContent = formatMoney(state.cash);

    renderWeather(state);
    renderStand(state);
    renderEventBanner(state);
    renderInstructions();
    renderLocationsVisibility();
    renderMenuToggles(state);
    renderProductPicker(state);
    fillRecipeForm(state);
    renderBuyList(state);
    renderMorningHint(state);
    renderDayResultsVisibility();
    renderBusinessDaySelect(state);
    setBusinessTab(businessTab);

    const dayBtn = document.getElementById("stat-day-btn");
    const hasHistory = dayHistoryList(state).length > 0;
    if (dayBtn) dayBtn.disabled = !hasHistory;

    const sellBtn = document.getElementById("btn-sell");
    if (sellBtn && !sellBtn.textContent.includes("Selling")) {
      sellBtn.disabled = !(global.GameState.ownsBusiness ? global.GameState.ownsBusiness(state) : global.GameState.ownsStand(state));
    }

    const businessOpen = getOpenPanel() === "business";
    if (businessOpen) renderLedger(state);

    if (reportEl && dayResultsHidden && !activeDayReport) {
      reportEl.textContent = MORNING_COPY;
      reportEl.classList.remove("is-receipt");
    }
  }

  /**
   * Strip Sell Day / Previous Day chrome so a standalone message (e.g. buy
   * receipt) is not stacked under an old customer summary table.
   */
  function clearDayResultsChrome(title) {
    activeDayReport = null;
    dayResultsMode = "message";
    dayHintsVisible = false;

    const titleEl = document.getElementById("day-results-title");
    if (titleEl) titleEl.textContent = title || "Notice";

    const historyWrap = document.getElementById("day-history-select-wrap");
    if (historyWrap) historyWrap.hidden = true;

    const progress = document.getElementById("day-results-progress");
    if (progress) progress.textContent = "";

    const stage = document.getElementById("customer-stage");
    if (stage) stage.innerHTML = "";

    const tableWrap = document.getElementById("day-results-table-wrap");
    if (tableWrap) tableWrap.hidden = true;

    const hintsBtn = document.getElementById("btn-day-hints");
    if (hintsBtn) hintsBtn.hidden = true;
    setDayHintsVisible(false);
  }

  function setReport(message, { flash, receipt, revealDaily } = {}) {
    const reportEl = document.getElementById("report-body");
    const panel = document.getElementById("day-results");
    if (receipt) {
      clearDayResultsChrome("Purchase");
    }
    if (reportEl) {
      reportEl.hidden = false;
      reportEl.textContent = message;
      reportEl.classList.toggle("is-receipt", !!receipt);
    }
    if (revealDaily || receipt) {
      showDayResultsPanel();
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
      "btn-business",
      "recipe-product-select",
    ];
    for (const id of standbyIds) {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !!locked;
    }
  }

  function startCustomerDay() {
    const stage = document.getElementById("customer-stage");
    const tableWrap = document.getElementById("day-results-table-wrap");
    if (tableWrap) tableWrap.hidden = true;
    if (stage) stage.innerHTML = "";
    bindDayResultsReport(null, null, cachedState, "live");
    setSellDayLocked(true);
  }

  function customerFeedbackSentiment(event) {
    if (!event || event.outcome === "leave") return "negative";
    if (event.reaction === "dislike") return "negative";
    return "positive";
  }

  function showCustomerEvent(event) {
    const stage = document.getElementById("customer-stage");
    const progress = document.getElementById("day-results-progress");
    if (!stage) return;

    const sentiment = customerFeedbackSentiment(event);
    const chip = document.createElement("div");
    chip.className =
      "customer-chip " +
      (event.outcome === "buy" ? "is-buy" : "is-leave") +
      " " +
      (sentiment === "positive" ? "is-positive" : "is-negative");

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

  /**
   * Clear live feedback chips, show a brief closing-books beat, then continue.
   * Icons are only for active Sell Day simulation time.
   */
  function beginClosingBooks(onReady) {
    const stage = document.getElementById("customer-stage");
    if (stage) stage.innerHTML = "";

    const progress = document.getElementById("day-results-progress");
    if (progress) progress.textContent = "Closing the day’s books…";

    const titleEl = document.getElementById("day-results-title");
    if (titleEl) titleEl.textContent = "Closing books";

    const reportEl = document.getElementById("report-body");
    if (reportEl) {
      reportEl.hidden = false;
      reportEl.textContent = "Closing the day’s books…";
      reportEl.classList.remove("is-pnl", "is-receipt");
    }

    const tableWrap = document.getElementById("day-results-table-wrap");
    if (tableWrap) tableWrap.hidden = true;

    showDayResultsPanel();

    const delayMs = 1400;
    setTimeout(function () {
      if (typeof onReady === "function") onReady();
    }, delayMs);
  }

  function showCustomerSummary(summary, plan, state) {
    const stage = document.getElementById("customer-stage");
    if (stage) stage.innerHTML = "";
    const report =
      (state && state.lastDayReport) ||
      Object.assign({}, plan || {}, {
        message: plan && plan.message,
        customers: summary,
        recipes: plan && plan.recipes,
      });
    if (!report.customers) report.customers = summary;
    bindDayResultsReport(report, summary, state, "live-complete");
    const reportEl = document.getElementById("report-body");
    if (reportEl) {
      reportEl.hidden = false;
      const text = formatDayReportStructured(report);
      reportEl.textContent = text || "";
      reportEl.classList.toggle("is-pnl", !!text);
    }
    setSellDayLocked(false, state);
    const panel = document.getElementById("day-results");
    if (panel) {
      panel.classList.remove("is-fresh");
      void panel.offsetWidth;
      panel.classList.add("is-fresh");
    }
  }

  function minimizeCustomerDay() {
    hideDayResultsPanel();
  }

  function hideCustomerDay(state) {
    const stage = document.getElementById("customer-stage");
    if (stage) stage.innerHTML = "";
    hideDayResultsPanel();
    setSellDayLocked(false, state);
  }

  function hideCustomerSummary() {
    hideDayResultsPanel();
  }

  function toggleDayHints() {
    setDayHintsVisible(!dayHintsVisible);
  }

  function openBusinessOverview(state) {
    hideDayResultsPanel();
    setBusinessTab("business");
    setPanel("business");
    if (state) renderLedger(state);
  }

  function onDayHistorySelectChange(state) {
    showPreviousDay(state);
  }

  const recipeForm = document.getElementById("form-recipe");
  if (recipeForm) {
    recipeForm.addEventListener("input", function () {
      renderRecipeStats(cachedState);
    });
  }

  const sellPriceInput = document.getElementById("sell-price");
  if (sellPriceInput) {
    sellPriceInput.addEventListener("input", function () {
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
  setMenuInfoVisible(false);

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
    renderBuyList,
    renderRecipeStats,
    renderMenuToggles,
    morningHint,
    renderStand,
    renderStaff,
    renderEventBanner,
    renderInstructions,
    setInstructionsHidden,
    setInventoryHidden,
    setLocationsHidden,
    setBusinessTab,
    openBusinessOverview,
    openPreviousDayFromBusiness,
    toggleMenuInfo,
    setMenuInfoVisible,
    setPnlChartDuration,
    setPnlChartMetric,
    hideDayResultsPanel,
    showPreviousDay,
    toggleDayHints,
    onDayHistorySelectChange,
    setSellDayLocked,
    renderLedger,
    startCustomerDay,
    showCustomerEvent,
    beginClosingBooks,
    showCustomerSummary,
    hideCustomerSummary,
    hideCustomerDay,
    minimizeCustomerDay,
  };
})(window);
