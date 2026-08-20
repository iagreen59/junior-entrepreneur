/**
 * Game state + localStorage persistence.
 * Phase 2: day, cash, inventory, and recipe persist; price reserved for Phase 3.
 *
 * Buy unit prices (cash per inventory unit) — schema note for Phase 2:
 * not stored in the save blob; constants live here so Buy UI / helpers share one source.
 */
(function (global) {
  const STORAGE_KEY = "junior-entrepreneur-v1";

  const INVENTORY_KEYS = ["fruit", "sugar", "ice", "cups"];

  /** Cash cost per inventory unit when buying supplies. */
  const UNIT_PRICES = {
    fruit: 0.5,
    sugar: 0.25,
    ice: 0.1,
    cups: 0.15,
  };

  function defaultState() {
    return {
      day: 1,
      cash: 20,
      inventory: {
        fruit: 0,
        sugar: 0,
        ice: 0,
        cups: 0,
      },
      recipe: {
        fruit: 2,
        sugar: 1,
        ice: 1,
        cups: 1,
      },
      price: 1.5,
      lastDayReport: null,
    };
  }

  function normalize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;

    const inventory = { ...base.inventory };
    for (const key of INVENTORY_KEYS) {
      const value = raw.inventory && raw.inventory[key];
      inventory[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
    }

    const recipe = { ...base.recipe };
    if (raw.recipe && typeof raw.recipe === "object") {
      for (const key of INVENTORY_KEYS) {
        const value = raw.recipe[key];
        if (Number.isFinite(value) && value >= 0) recipe[key] = value;
      }
    }

    return {
      day: Number.isFinite(raw.day) && raw.day >= 1 ? Math.floor(raw.day) : 1,
      cash: Number.isFinite(raw.cash) ? raw.cash : base.cash,
      inventory,
      recipe,
      price: Number.isFinite(raw.price) && raw.price >= 0 ? raw.price : base.price,
      lastDayReport:
        raw.lastDayReport && typeof raw.lastDayReport === "object"
          ? raw.lastDayReport
          : null,
    };
  }

  function load() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (!text) return defaultState();
      return normalize(JSON.parse(text));
    } catch {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function inventoryLabels() {
    return {
      fruit: "Fruit",
      sugar: "Sugar",
      ice: "Ice",
      cups: "Cups",
    };
  }

  function unitPrice(key) {
    return UNIT_PRICES[key] ?? 0;
  }

  /**
   * Buy `qty` units of an ingredient.
   * Returns { ok, message, cost?, qty?, key? } — mutates state only on success.
   */
  function buyIngredient(state, key, qty) {
    if (!INVENTORY_KEYS.includes(key)) {
      return { ok: false, message: "Unknown ingredient." };
    }

    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return {
        ok: false,
        message: "Enter a whole number greater than zero to buy.",
      };
    }

    const price = unitPrice(key);
    const cost = +(price * amount).toFixed(2);
    if (cost > state.cash + 1e-9) {
      const labels = inventoryLabels();
      return {
        ok: false,
        message:
          "Not enough cash for " +
          amount +
          " " +
          labels[key].toLowerCase() +
          " (need $" +
          cost.toFixed(2) +
          ", have $" +
          state.cash.toFixed(2) +
          ").",
      };
    }

    state.cash = +(state.cash - cost).toFixed(2);
    state.inventory[key] = (state.inventory[key] || 0) + amount;

    const labels = inventoryLabels();
    return {
      ok: true,
      key,
      qty: amount,
      cost,
      message:
        "Bought " +
        amount +
        " " +
        labels[key].toLowerCase() +
        " for $" +
        cost.toFixed(2) +
        ".",
    };
  }

  global.GameState = {
    STORAGE_KEY,
    INVENTORY_KEYS,
    UNIT_PRICES,
    defaultState,
    load,
    save,
    inventoryLabels,
    unitPrice,
    buyIngredient,
  };
})(window);
