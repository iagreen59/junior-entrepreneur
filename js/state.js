/**
 * Game state + localStorage persistence.
 * Phase 6: dual products (juice | cocoa), shared inventory bag, dual recipes/prices.
 * Migrates Phase 1–5 juice-only saves (legacy `recipe` / `price` → recipes.juice / prices.juice).
 *
 * Buy unit prices (cash per inventory unit) — not stored in the save blob;
 * constants live here so Buy UI / helpers share one source.
 */
(function (global) {
  const STORAGE_KEY = "junior-entrepreneur-v1";

  const PRODUCTS = ["juice", "cocoa"];

  /** Juice recipe keys (units per cup). */
  const JUICE_KEYS = ["fruit", "sugar", "ice", "cups"];

  /** Cocoa recipe keys (units per cup). Shared cups with juice. */
  const COCOA_KEYS = [
    "chocolate",
    "milk",
    "whippedCream",
    "chocolateSprinkles",
    "cups",
  ];

  /** Full shared inventory bag (all buyable ingredients). */
  const INVENTORY_KEYS = [
    "fruit",
    "sugar",
    "ice",
    "chocolate",
    "milk",
    "whippedCream",
    "chocolateSprinkles",
    "cups",
  ];

  /** Cash cost per inventory unit when buying supplies. */
  const UNIT_PRICES = {
    fruit: 0.5,
    sugar: 0.25,
    ice: 0.1,
    chocolate: 0.4,
    milk: 0.3,
    whippedCream: 0.25,
    chocolateSprinkles: 0.15,
    cups: 0.15,
  };

  function defaultJuiceRecipe() {
    return { fruit: 2, sugar: 1, ice: 1, cups: 1 };
  }

  function defaultCocoaRecipe() {
    return {
      chocolate: 2,
      milk: 1,
      whippedCream: 1,
      chocolateSprinkles: 1,
      cups: 1,
    };
  }

  function emptyInventory() {
    const inventory = {};
    for (const key of INVENTORY_KEYS) inventory[key] = 0;
    return inventory;
  }

  function defaultState(randomFn) {
    return {
      day: 1,
      cash: 20,
      activeProduct: "juice",
      weather: global.GameWeather
        ? global.GameWeather.roll(randomFn)
        : "mild",
      inventory: emptyInventory(),
      recipes: {
        juice: defaultJuiceRecipe(),
        cocoa: defaultCocoaRecipe(),
      },
      prices: {
        juice: 1.5,
        cocoa: 2.0,
      },
      lastDayReport: null,
    };
  }

  function productLabel(product) {
    if (product === "cocoa") return "hot cocoa";
    return "juice";
  }

  function recipeKeysFor(product) {
    return product === "cocoa" ? COCOA_KEYS.slice() : JUICE_KEYS.slice();
  }

  function normalizeRecipe(product, rawRecipe, fallback) {
    const keys = recipeKeysFor(product);
    const recipe = { ...fallback };
    if (!rawRecipe || typeof rawRecipe !== "object") return recipe;
    for (const key of keys) {
      const value = rawRecipe[key];
      if (Number.isFinite(value) && value >= 0) recipe[key] = value;
    }
    return recipe;
  }

  function normalizePrice(raw, fallback) {
    return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  }

  /**
   * Normalize any save blob (including pre–Phase 6 juice-only shapes).
   * Legacy: top-level `recipe` / `price` become recipes.juice / prices.juice.
   */
  function normalize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;

    const inventory = emptyInventory();
    const rawInv = raw.inventory && typeof raw.inventory === "object" ? raw.inventory : {};
    for (const key of INVENTORY_KEYS) {
      const value = rawInv[key];
      inventory[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
    }

    const legacyRecipe =
      raw.recipe && typeof raw.recipe === "object" ? raw.recipe : null;
    const recipesRaw =
      raw.recipes && typeof raw.recipes === "object" ? raw.recipes : {};

    const recipes = {
      juice: normalizeRecipe(
        "juice",
        recipesRaw.juice || legacyRecipe,
        base.recipes.juice
      ),
      cocoa: normalizeRecipe(
        "cocoa",
        recipesRaw.cocoa,
        base.recipes.cocoa
      ),
    };

    const pricesRaw =
      raw.prices && typeof raw.prices === "object" ? raw.prices : {};
    const prices = {
      juice: normalizePrice(
        pricesRaw.juice !== undefined ? pricesRaw.juice : raw.price,
        base.prices.juice
      ),
      cocoa: normalizePrice(pricesRaw.cocoa, base.prices.cocoa),
    };

    const activeProduct = PRODUCTS.includes(raw.activeProduct)
      ? raw.activeProduct
      : "juice";

    const weather = global.GameWeather
      ? global.GameWeather.normalize(raw.weather)
      : raw.weather === "hot" || raw.weather === "cold" || raw.weather === "mild"
        ? raw.weather
        : "mild";

    return {
      day: Number.isFinite(raw.day) && raw.day >= 1 ? Math.floor(raw.day) : 1,
      cash: Number.isFinite(raw.cash) ? raw.cash : base.cash,
      activeProduct,
      weather,
      inventory,
      recipes,
      prices,
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
      chocolate: "Chocolate",
      milk: "Milk",
      whippedCream: "Whipped cream",
      chocolateSprinkles: "Chocolate sprinkles",
      cups: "Cups",
    };
  }

  function unitPrice(key) {
    return UNIT_PRICES[key] ?? 0;
  }

  function activeRecipe(state) {
    const product = state.activeProduct === "cocoa" ? "cocoa" : "juice";
    return state.recipes[product];
  }

  function activePrice(state) {
    const product = state.activeProduct === "cocoa" ? "cocoa" : "juice";
    return state.prices[product];
  }

  function setActiveProduct(state, product) {
    if (!PRODUCTS.includes(product)) {
      return { ok: false, message: "Unknown product." };
    }
    state.activeProduct = product;
    return {
      ok: true,
      product,
      message: "Now selling " + productLabel(product) + ".",
    };
  }

  function emptyCart() {
    const cart = {};
    for (const key of INVENTORY_KEYS) cart[key] = 0;
    return cart;
  }

  function cartLineCost(key, qty) {
    return +(unitPrice(key) * qty).toFixed(2);
  }

  /** Total cash needed for a cart object of ingredient → qty. */
  function cartTotal(cart) {
    if (!cart || typeof cart !== "object") return 0;
    let total = 0;
    for (const key of INVENTORY_KEYS) {
      const qty = Number(cart[key]) || 0;
      if (qty > 0) total += unitPrice(key) * qty;
    }
    return +total.toFixed(2);
  }

  function cartHasItems(cart) {
    if (!cart || typeof cart !== "object") return false;
    for (const key of INVENTORY_KEYS) {
      if ((Number(cart[key]) || 0) > 0) return true;
    }
    return false;
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

  /**
   * Checkout an entire cart in one purchase.
   * Returns { ok, message, total?, lines? } — mutates state only on success.
   * `message` is a multi-line receipt string for the day report.
   */
  function buyCart(state, cart) {
    if (!cartHasItems(cart)) {
      return { ok: false, message: "Your cart is empty. Add supplies first." };
    }

    const lines = [];
    const labels = inventoryLabels();
    for (const key of INVENTORY_KEYS) {
      const qty = Number(cart[key]) || 0;
      if (qty <= 0) continue;
      if (!Number.isInteger(qty)) {
        return {
          ok: false,
          message: "Cart quantities must be whole numbers.",
        };
      }
      lines.push({
        key,
        label: labels[key],
        qty,
        cost: cartLineCost(key, qty),
      });
    }

    const total = cartTotal(cart);
    if (total > state.cash + 1e-9) {
      return {
        ok: false,
        message:
          "You don't have enough money. Cart total is $" +
          total.toFixed(2) +
          ", but you only have $" +
          state.cash.toFixed(2) +
          ".",
        total,
        shortfall: true,
      };
    }

    state.cash = +(state.cash - total).toFixed(2);
    for (const line of lines) {
      state.inventory[line.key] = (state.inventory[line.key] || 0) + line.qty;
    }

    const receipt = [
      "Sunny Corner Supply Co.",
      "────────────────────────",
    ];
    for (const line of lines) {
      receipt.push(
        line.label +
          "  ×" +
          line.qty +
          "  $" +
          line.cost.toFixed(2)
      );
    }
    receipt.push("────────────────────────");
    receipt.push("TOTAL  $" + total.toFixed(2));
    receipt.push("Thank you for your purchase!");

    return {
      ok: true,
      total,
      lines,
      message: receipt.join("\n"),
    };
  }

  global.GameState = {
    STORAGE_KEY,
    PRODUCTS,
    JUICE_KEYS,
    COCOA_KEYS,
    INVENTORY_KEYS,
    UNIT_PRICES,
    defaultState,
    load,
    save,
    normalize,
    inventoryLabels,
    unitPrice,
    productLabel,
    recipeKeysFor,
    activeRecipe,
    activePrice,
    setActiveProduct,
    buyIngredient,
    emptyCart,
    cartTotal,
    cartHasItems,
    buyCart,
  };
})(window);
