/**
 * Game state + localStorage persistence.
 * Phase 6: dual products (juice | cocoa), shared inventory bag, dual recipes/prices.
 * Phase 9: starting cash $50; must buy first stand ($20) before Sell Day;
 * hideable instructions preference; migrate legacy saves with an implicit stand.
 * Phase 10: split shared `cups` into coldCups (juice) and hotCups (cocoa);
 * recipe yield + COGS helpers consume these keys.
 * Phase 11: four products (juice, cocoa, burger, soup); unique ingredient recipes;
 * per-item prices; menuOffered daily toggles (drinks on by default, food off);
 * migrate dual-drink saves.
 * Phase 13: multi-stand unlock when cash > $100; buy 2nd–4th stand for $20;
 * activeStandId selector; shared inventory; unlock notify flag.
 *
 * Buy unit prices (cash per inventory unit) — not stored in the save blob;
 * constants live here so Buy UI / helpers share one source.
 *
 * Migration (Phase 10): legacy inventory `cups` is copied into BOTH coldCups
 * and hotCups when those keys are absent, so neither drink loses cup stock.
 * Legacy recipe `cups` maps to coldCups (juice) or hotCups (cocoa).
 *
 * Migration (Phase 11): dual-drink saves gain burger/soup default recipes + prices
 * and menuOffered (juice/cocoa true, burger/soup false).
 */
(function (global) {
  const STORAGE_KEY = "junior-entrepreneur-v1";
  const INSTRUCTIONS_HIDDEN_KEY = "junior-entrepreneur-instructions-hidden";

  /** Phase 9 / 13 locked constants. */
  const STARTING_CASH = 50;
  const STAND_COST = 20;
  /** Max owned stands (Phase 13). */
  const MAX_STANDS = 4;
  /** Cash must be strictly greater than this to unlock buying stands 2–4. */
  const EXTRA_STAND_UNLOCK_CASH = 100;

  const PRODUCTS = ["juice", "cocoa", "burger", "soup"];

  /** Juice recipe keys (units per serving). Cold cups only. */
  const JUICE_KEYS = ["fruit", "sugar", "ice", "coldCups"];

  /** Cocoa recipe keys (units per serving). Hot cups only. */
  const COCOA_KEYS = [
    "chocolate",
    "milk",
    "whippedCream",
    "chocolateSprinkles",
    "hotCups",
  ];

  /** Burger recipe keys — no shared ingredients with other products. */
  const BURGER_KEYS = ["bun", "beefPatty", "cheese", "lettuce", "tomato"];

  /** Soup recipe keys — no shared ingredients with other products. */
  const SOUP_KEYS = ["broth", "noodles", "carrot", "celery", "herbs"];

  /** Full shared inventory bag (all buyable ingredients). */
  const INVENTORY_KEYS = [
    "fruit",
    "sugar",
    "ice",
    "chocolate",
    "milk",
    "whippedCream",
    "chocolateSprinkles",
    "coldCups",
    "hotCups",
    "bun",
    "beefPatty",
    "cheese",
    "lettuce",
    "tomato",
    "broth",
    "noodles",
    "carrot",
    "celery",
    "herbs",
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
    coldCups: 0.15,
    hotCups: 0.15,
    bun: 0.35,
    beefPatty: 0.8,
    cheese: 0.3,
    lettuce: 0.15,
    tomato: 0.2,
    broth: 0.4,
    noodles: 0.25,
    carrot: 0.15,
    celery: 0.15,
    herbs: 0.2,
  };

  function isProduct(value) {
    return PRODUCTS.includes(value);
  }

  function normalizeProduct(value, fallback) {
    return isProduct(value) ? value : fallback || "juice";
  }

  /** Cup key for drink products; null for food (burger / soup). */
  function cupKeyFor(product) {
    if (product === "cocoa") return "hotCups";
    if (product === "juice") return "coldCups";
    return null;
  }

  function defaultJuiceRecipe() {
    return { fruit: 2, sugar: 1, ice: 1, coldCups: 1 };
  }

  function defaultCocoaRecipe() {
    return {
      chocolate: 2,
      milk: 1,
      whippedCream: 1,
      chocolateSprinkles: 1,
      hotCups: 1,
    };
  }

  function defaultBurgerRecipe() {
    return { bun: 1, beefPatty: 1, cheese: 1, lettuce: 1, tomato: 1 };
  }

  function defaultSoupRecipe() {
    return { broth: 1, noodles: 1, carrot: 1, celery: 1, herbs: 1 };
  }

  /**
   * Default daily menu: drinks offered, food off until the player opts in.
   * Phase 12 will use this for multi-item Sell Day; Phase 11 still sells
   * the single activeProduct.
   */
  function defaultMenuOffered() {
    return {
      juice: true,
      cocoa: true,
      burger: false,
      soup: false,
    };
  }

  function emptyInventory() {
    const inventory = {};
    for (const key of INVENTORY_KEYS) inventory[key] = 0;
    return inventory;
  }

  function createStand(index) {
    const n = Number.isFinite(index) && index >= 1 ? Math.floor(index) : 1;
    return {
      id: "stand-" + n,
      name: "Stand " + n,
    };
  }

  function defaultState(randomFn) {
    return {
      day: 1,
      cash: STARTING_CASH,
      /** Owned stands; empty until the player buys the first stand ($20). */
      stands: [],
      activeStandId: null,
      /**
       * True after we have shown the “you can add another stand” notice for the
       * current eligibility window (cash > $100 and stands < 4). Resets when
       * the player is no longer eligible so a later re-unlock notifies again.
       */
      extraStandUnlockNotified: false,
      /** Product being edited / sold (Phase 11 Sell Day still single-product). */
      activeProduct: "juice",
      /**
       * Which products are on today's menu. Independent of activeProduct.
       * Defaults: juice + cocoa on; burger + soup off.
       */
      menuOffered: defaultMenuOffered(),
      weather: global.GameWeather
        ? global.GameWeather.roll(randomFn)
        : "mild",
      inventory: emptyInventory(),
      recipes: {
        juice: defaultJuiceRecipe(),
        cocoa: defaultCocoaRecipe(),
        burger: defaultBurgerRecipe(),
        soup: defaultSoupRecipe(),
      },
      prices: {
        juice: 1.5,
        cocoa: 2.0,
        burger: 4.0,
        soup: 3.5,
      },
      lastDayReport: null,
    };
  }

  function ownsStand(state) {
    return Array.isArray(state.stands) && state.stands.length > 0;
  }

  function standCount(state) {
    return ownsStand(state) ? state.stands.length : 0;
  }

  function getActiveStand(state) {
    if (!ownsStand(state)) return null;
    const id = state.activeStandId;
    const found = state.stands.find(function (s) {
      return s.id === id;
    });
    return found || state.stands[0] || null;
  }

  /**
   * Extra stands (2nd–4th) unlock when the player already owns ≥1 stand,
   * has fewer than MAX_STANDS, and cash is strictly greater than $100.
   * First stand has no cash > $100 gate (Phase 9).
   */
  function extraStandUnlocked(state) {
    return (
      ownsStand(state) &&
      standCount(state) < MAX_STANDS &&
      Number(state.cash) > EXTRA_STAND_UNLOCK_CASH
    );
  }

  /** Unlocked and can afford the $20 purchase. */
  function canBuyExtraStand(state) {
    return (
      extraStandUnlocked(state) && Number(state.cash) + 1e-9 >= STAND_COST
    );
  }

  function setActiveStand(state, standId) {
    if (!ownsStand(state)) {
      return { ok: false, message: "You do not own a stand yet." };
    }
    const stand = state.stands.find(function (s) {
      return s.id === standId;
    });
    if (!stand) {
      return { ok: false, message: "Unknown stand." };
    }
    state.activeStandId = stand.id;
    return {
      ok: true,
      stand,
      message: "Managing " + stand.name + ". Inventory is shared across all stands.",
    };
  }

  /**
   * If newly eligible to buy an extra stand, return a one-shot notify message
   * and mark notified. Returns null when already notified or not eligible.
   * Resets the flag when not eligible so a later re-unlock notifies again.
   */
  function consumeExtraStandUnlockNotify(state) {
    if (!extraStandUnlocked(state)) {
      state.extraStandUnlockNotified = false;
      return null;
    }
    if (state.extraStandUnlockNotified) return null;
    state.extraStandUnlockNotified = true;
    const left = MAX_STANDS - standCount(state);
    return (
      "Cash is over $" +
      EXTRA_STAND_UNLOCK_CASH +
      "! You can add another stand for $" +
      STAND_COST.toFixed(0) +
      " (up to " +
      MAX_STANDS +
      "; " +
      left +
      " slot" +
      (left === 1 ? "" : "s") +
      " left). Use Add stand when you are ready."
    );
  }

  /**
   * Buy the first stand (Phase 9) or an extra stand (Phase 13).
   * First stand: no cash > $100 gate. Extra stands: require unlock + room.
   */
  function buyStand(state) {
    const count = standCount(state);

    if (count >= MAX_STANDS) {
      return {
        ok: false,
        message: "You already own the maximum of " + MAX_STANDS + " stands.",
      };
    }

    if (count >= 1 && !extraStandUnlocked(state)) {
      return {
        ok: false,
        message:
          "Extra stands unlock when cash is over $" +
          EXTRA_STAND_UNLOCK_CASH +
          " (you have $" +
          Number(state.cash).toFixed(2) +
          ").",
      };
    }

    if (state.cash + 1e-9 < STAND_COST) {
      return {
        ok: false,
        message:
          "Not enough cash to buy a stand (need $" +
          STAND_COST.toFixed(2) +
          ", have $" +
          Number(state.cash).toFixed(2) +
          ").",
      };
    }

    state.cash = +(state.cash - STAND_COST).toFixed(2);
    const nextIndex = count + 1;
    const stand = createStand(nextIndex);
    if (!Array.isArray(state.stands)) state.stands = [];
    state.stands.push(stand);
    state.activeStandId = stand.id;

    if (count === 0) {
      return {
        ok: true,
        stand,
        cost: STAND_COST,
        message:
          "Bought your first stand for $" +
          STAND_COST.toFixed(2) +
          "! Cash left: $" +
          state.cash.toFixed(2) +
          ". You can Sell Day when stock and price are ready.",
      };
    }

    return {
      ok: true,
      stand,
      cost: STAND_COST,
      message:
        "Bought " +
        stand.name +
        " for $" +
        STAND_COST.toFixed(2) +
        "! You now own " +
        state.stands.length +
        " stand" +
        (state.stands.length === 1 ? "" : "s") +
        ". Cash left: $" +
        state.cash.toFixed(2) +
        ". Inventory stays shared.",
    };
  }

  function loadInstructionsHidden() {
    try {
      return localStorage.getItem(INSTRUCTIONS_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveInstructionsHidden(hidden) {
    try {
      localStorage.setItem(INSTRUCTIONS_HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      // Ignore storage failures; UI still toggles in-session.
    }
  }

  function productLabel(product) {
    if (product === "cocoa") return "hot cocoa";
    if (product === "burger") return "burger";
    if (product === "soup") return "soup";
    return "juice";
  }

  function recipeKeysFor(product) {
    if (product === "cocoa") return COCOA_KEYS.slice();
    if (product === "burger") return BURGER_KEYS.slice();
    if (product === "soup") return SOUP_KEYS.slice();
    return JUICE_KEYS.slice();
  }

  /**
   * Map legacy shared `cups` on a recipe blob to coldCups / hotCups.
   * Does not mutate the original object.
   */
  function migrateRecipeCups(product, rawRecipe) {
    if (!rawRecipe || typeof rawRecipe !== "object") return rawRecipe;
    const cupKey = cupKeyFor(product);
    if (!cupKey) {
      const out = Object.assign({}, rawRecipe);
      delete out.cups;
      return out;
    }
    const out = Object.assign({}, rawRecipe);
    if (
      !Number.isFinite(out[cupKey]) &&
      Number.isFinite(out.cups) &&
      out.cups >= 0
    ) {
      out[cupKey] = out.cups;
    }
    delete out.cups;
    return out;
  }

  function normalizeRecipe(product, rawRecipe, fallback) {
    const keys = recipeKeysFor(product);
    const recipe = { ...fallback };
    const migrated = migrateRecipeCups(product, rawRecipe);
    if (!migrated || typeof migrated !== "object") return recipe;
    for (const key of keys) {
      const value = migrated[key];
      if (Number.isFinite(value) && value >= 0) recipe[key] = value;
    }
    return recipe;
  }

  function normalizePrice(raw, fallback) {
    return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  }

  function normalizeMenuOffered(raw) {
    const base = defaultMenuOffered();
    if (!raw || typeof raw !== "object") return base;
    const out = {};
    for (const product of PRODUCTS) {
      if (typeof raw[product] === "boolean") {
        out[product] = raw[product];
      } else {
        out[product] = base[product];
      }
    }
    return out;
  }

  /**
   * Normalize any save blob (including pre–Phase 6 juice-only shapes).
   * Legacy: top-level `recipe` / `price` become recipes.juice / prices.juice.
   * Phase 11: dual-drink saves get burger/soup defaults + menuOffered.
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

    // Phase 10: legacy shared `cups` → both coldCups and hotCups when missing,
    // so juice and cocoa keep cup stock from older saves (no progress lost).
    const legacyCups = Number.isFinite(rawInv.cups)
      ? Math.max(0, rawInv.cups)
      : 0;
    if (legacyCups > 0) {
      if (!Number.isFinite(rawInv.coldCups)) inventory.coldCups = legacyCups;
      if (!Number.isFinite(rawInv.hotCups)) inventory.hotCups = legacyCups;
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
      burger: normalizeRecipe(
        "burger",
        recipesRaw.burger,
        base.recipes.burger
      ),
      soup: normalizeRecipe("soup", recipesRaw.soup, base.recipes.soup),
    };

    const pricesRaw =
      raw.prices && typeof raw.prices === "object" ? raw.prices : {};
    const prices = {
      juice: normalizePrice(
        pricesRaw.juice !== undefined ? pricesRaw.juice : raw.price,
        base.prices.juice
      ),
      cocoa: normalizePrice(pricesRaw.cocoa, base.prices.cocoa),
      burger: normalizePrice(pricesRaw.burger, base.prices.burger),
      soup: normalizePrice(pricesRaw.soup, base.prices.soup),
    };

    const activeProduct = normalizeProduct(raw.activeProduct, "juice");
    const menuOffered = normalizeMenuOffered(raw.menuOffered);

    const weather = global.GameWeather
      ? global.GameWeather.normalize(raw.weather)
      : raw.weather === "hot" || raw.weather === "cold" || raw.weather === "mild"
        ? raw.weather
        : "mild";

    // Phase 9 stands: missing `stands` on a legacy save → grant one stand
    // (pre–Phase 9 games already had an implicit stand). Explicit empty array
    // means the player has not bought a stand yet (new Phase 9 save).
    let stands;
    if (!Object.prototype.hasOwnProperty.call(raw, "stands")) {
      stands = [createStand(1)];
    } else if (Array.isArray(raw.stands)) {
      stands = raw.stands
        .filter(function (s) {
          return s && typeof s === "object";
        })
        .map(function (s, i) {
          const n = i + 1;
          return {
            id: typeof s.id === "string" && s.id ? s.id : "stand-" + n,
            name:
              typeof s.name === "string" && s.name ? s.name : "Stand " + n,
          };
        })
        .slice(0, MAX_STANDS);
    } else {
      stands = [createStand(1)];
    }

    let activeStandId =
      typeof raw.activeStandId === "string" ? raw.activeStandId : null;
    if (stands.length === 0) {
      activeStandId = null;
    } else if (
      !activeStandId ||
      !stands.some(function (s) {
        return s.id === activeStandId;
      })
    ) {
      activeStandId = stands[0].id;
    }

    const extraStandUnlockNotified = !!raw.extraStandUnlockNotified;

    return {
      day: Number.isFinite(raw.day) && raw.day >= 1 ? Math.floor(raw.day) : 1,
      cash: Number.isFinite(raw.cash) ? raw.cash : base.cash,
      stands,
      activeStandId,
      extraStandUnlockNotified,
      activeProduct,
      menuOffered,
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
      coldCups: "Cold cups",
      hotCups: "Hot cups",
      bun: "Bun",
      beefPatty: "Beef patty",
      cheese: "Cheese",
      lettuce: "Lettuce",
      tomato: "Tomato",
      broth: "Broth",
      noodles: "Noodles",
      carrot: "Carrot",
      celery: "Celery",
      herbs: "Herbs",
    };
  }

  function unitPrice(key) {
    return UNIT_PRICES[key] ?? 0;
  }

  function activeRecipe(state) {
    const product = normalizeProduct(state.activeProduct, "juice");
    return state.recipes[product];
  }

  function activePrice(state) {
    const product = normalizeProduct(state.activeProduct, "juice");
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
      message: "Now editing / selling " + productLabel(product) + ".",
    };
  }

  /**
   * Toggle whether a product is on today's menu.
   * Independent of activeProduct (which product you are editing).
   */
  function setMenuOffered(state, product, offered) {
    if (!PRODUCTS.includes(product)) {
      return { ok: false, message: "Unknown product." };
    }
    if (!state.menuOffered || typeof state.menuOffered !== "object") {
      state.menuOffered = defaultMenuOffered();
    }
    state.menuOffered[product] = !!offered;
    const label = productLabel(product);
    return {
      ok: true,
      product,
      offered: state.menuOffered[product],
      message: state.menuOffered[product]
        ? label.charAt(0).toUpperCase() + label.slice(1) + " is on today's menu."
        : label.charAt(0).toUpperCase() +
          label.slice(1) +
          " is off today's menu.",
    };
  }

  function isMenuOffered(state, product) {
    if (!PRODUCTS.includes(product)) return false;
    if (!state.menuOffered || typeof state.menuOffered !== "object") {
      return defaultMenuOffered()[product];
    }
    return !!state.menuOffered[product];
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
    INSTRUCTIONS_HIDDEN_KEY,
    STARTING_CASH,
    STAND_COST,
    MAX_STANDS,
    EXTRA_STAND_UNLOCK_CASH,
    PRODUCTS,
    JUICE_KEYS,
    COCOA_KEYS,
    BURGER_KEYS,
    SOUP_KEYS,
    INVENTORY_KEYS,
    UNIT_PRICES,
    defaultState,
    defaultMenuOffered,
    load,
    save,
    normalize,
    createStand,
    ownsStand,
    standCount,
    getActiveStand,
    extraStandUnlocked,
    canBuyExtraStand,
    setActiveStand,
    consumeExtraStandUnlockNotify,
    buyStand,
    loadInstructionsHidden,
    saveInstructionsHidden,
    inventoryLabels,
    unitPrice,
    productLabel,
    recipeKeysFor,
    cupKeyFor,
    isProduct,
    normalizeProduct,
    activeRecipe,
    activePrice,
    setActiveProduct,
    setMenuOffered,
    isMenuOffered,
    buyIngredient,
    emptyCart,
    cartTotal,
    cartHasItems,
    buyCart,
  };
})(window);
