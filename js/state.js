/**
 * Game state + localStorage persistence.
 * Phase 1: day + cash persist; inventory/recipe/price stored for later slices.
 */
(function (global) {
  const STORAGE_KEY = "junior-entrepreneur-v1";

  const INVENTORY_KEYS = ["fruit", "sugar", "ice", "cups"];

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

  global.GameState = {
    STORAGE_KEY,
    INVENTORY_KEYS,
    defaultState,
    load,
    save,
    inventoryLabels,
  };
})(window);
