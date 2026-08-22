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
 * Phase 14: stand staffing — with 2+ stands each must be player-run (at most
 * one) or have an employee; hire/layoff; $5/day wage per employee on Sell Day.
 * Phase 15: sell a stand for $10 (keep ≥1); temporary event modifiers
 * (supplyPriceMult / demandMult) + eventBanner for morning messages.
 * Phase 16: first restaurant — own 4 stands + cash > $1000 → buy for $400;
 * forfeit all stands; mode "restaurant"; 2–4 employees (player cannot staff);
 * daily rent (Phase 19: $18) + wage $8/employee on Sell Day; shared menu/inventory.
 * Phase 19: instructions refresh + light rent/demand/event balance polish.
 * Phase 17: multi-restaurant — cash > $1000 unlocks another for $400 (max 4);
 * each has own 2–4 staff + daily rent; sell for $200 (keep ≥1); sell last →
 * one stand + stand mode; never own stands and restaurants together.
 * Phase 18: business ledger — running revenue/COGS/wages/rent/overhead/profit
 * + days operated + optional per-restaurant rollups (see js/ledger.js).
 *
 * Buy unit prices (cash per inventory unit) — not stored in the save blob;
 * constants live here so Buy UI / helpers share one source. Event modifiers
 * temporarily scale effective buy prices via unitPrice(key, state).
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
  /** Phase 14: daily wage per stand employee (deducted on Sell Day). */
  const STAND_EMPLOYEE_WAGE = 5;
  /** Phase 15: cash received when selling a stand (must keep ≥1). */
  const STAND_SELL_PRICE = 10;
  /** Staffing modes on a stand: player | employee | null (unstaffed). */
  const STAFF_PLAYER = "player";
  const STAFF_EMPLOYEE = "employee";
  /** Phase 16–17: restaurant conversion and multi-restaurant. */
  const RESTAURANT_COST = 400;
  /** Cash must be strictly greater than this to buy first / extra restaurants. */
  const RESTAURANT_UNLOCK_CASH = 1000;
  /** Max owned restaurants (Phase 17). */
  const MAX_RESTAURANTS = 4;
  /** Cash received when selling a restaurant (Phase 17). */
  const RESTAURANT_SELL_PRICE = 200;
  /**
   * Daily rent charged on Sell Day per restaurant.
   * Phase 19: $18 (was $15) — enough overhead to pressure restaurant P&L without
   * instant loss when staffed at the minimum and sales are decent.
   */
  const RESTAURANT_RENT = 18;
  /** Daily wage per restaurant employee (higher than stand wage; Phase 19: kept $8). */
  const RESTAURANT_WAGE = 8;
  /** Min / max employees per restaurant; player cannot work a restaurant shift. */
  const RESTAURANT_MIN_STAFF = 2;
  const RESTAURANT_MAX_STAFF = 4;
  /** Business mode: stand booths vs restaurant. Cannot own both. */
  const MODE_STAND = "stand";
  const MODE_RESTAURANT = "restaurant";
  /** Floor/ceiling for temporary supply price event multipliers. */
  const SUPPLY_MULT_MIN = 0.5;
  const SUPPLY_MULT_MAX = 1.5;

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
      /** "player" | "employee" | null — null means unstaffed. */
      staffedBy: null,
    };
  }

  function createRestaurant(index) {
    const n = Number.isFinite(index) && index >= 1 ? Math.floor(index) : 1;
    return {
      id: "restaurant-" + n,
      name: "Restaurant " + n,
      /** Hired staff count; player cannot work a restaurant shift. */
      employeeCount: 0,
    };
  }

  function normalizeStaffedBy(value) {
    if (value === STAFF_PLAYER || value === STAFF_EMPLOYEE) return value;
    return null;
  }

  function clampRestaurantStaff(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return 0;
    return Math.min(RESTAURANT_MAX_STAFF, Math.floor(v));
  }

  function defaultState(randomFn) {
    return {
      day: 1,
      cash: STARTING_CASH,
      /** "stand" | "restaurant" — never own stands and restaurants together. */
      mode: MODE_STAND,
      /** Owned stands; empty until the player buys the first stand ($20). */
      stands: [],
      activeStandId: null,
      /**
       * Owned restaurants (Phase 17: up to MAX_RESTAURANTS). Cleared stands on
       * conversion; never owned together with stands.
       * Shape: { id, name, employeeCount }.
       */
      restaurants: [],
      activeRestaurantId: null,
      /**
       * True after we have shown the “you can add another stand” notice for the
       * current eligibility window (cash > $100 and stands < 4). Resets when
       * the player is no longer eligible so a later re-unlock notifies again.
       */
      extraStandUnlockNotified: false,
      /**
       * True after we have shown the “buy a restaurant” notice for the current
       * eligibility window (4 stands + cash > $1000).
       */
      restaurantUnlockNotified: false,
      /**
       * True after we have shown the “buy another restaurant” notice for the
       * current eligibility window (restaurant mode + cash > $1000 + room).
       */
      extraRestaurantUnlockNotified: false,
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
      /**
       * Phase 15 event modifiers — always recoverable (temporary / rehire).
       * supplyPriceMult: scales UNIT_PRICES while supplyPriceDaysLeft > 0.
       * demandMult: scales Sell Day foot traffic once, then clears.
       * eventBanner: { message, tone: "good"|"bad"|"neutral", day } | null.
       */
      supplyPriceMult: 1,
      supplyPriceDaysLeft: 0,
      demandMult: 1,
      eventBanner: null,
      /**
       * Phase 18 business ledger — running operating totals.
       * Shape owned by GameLedger.createEmptyLedger / normalizeLedger.
       */
      ledger:
        global.GameLedger && global.GameLedger.createEmptyLedger
          ? global.GameLedger.createEmptyLedger()
          : {
              revenue: 0,
              cogs: 0,
              wages: 0,
              rent: 0,
              otherOverhead: 0,
              profit: 0,
              daysOperated: 0,
              restaurantBreakdown: {},
            },
    };
  }

  function ownsStand(state) {
    return Array.isArray(state.stands) && state.stands.length > 0;
  }

  function standCount(state) {
    return ownsStand(state) ? state.stands.length : 0;
  }

  function isRestaurantMode(state) {
    return state && state.mode === MODE_RESTAURANT;
  }

  function ownsRestaurant(state) {
    return (
      isRestaurantMode(state) &&
      Array.isArray(state.restaurants) &&
      state.restaurants.length > 0
    );
  }

  function restaurantCount(state) {
    return ownsRestaurant(state) ? state.restaurants.length : 0;
  }

  /** True when the player owns a stand or a restaurant (can run Sell Day). */
  function ownsBusiness(state) {
    return ownsRestaurant(state) || ownsStand(state);
  }

  function getActiveRestaurant(state) {
    if (!ownsRestaurant(state)) return null;
    const id = state.activeRestaurantId;
    const found = state.restaurants.find(function (r) {
      return r.id === id;
    });
    return found || state.restaurants[0] || null;
  }

  function findRestaurant(state, restaurantId) {
    if (!ownsRestaurant(state) || typeof restaurantId !== "string") return null;
    return (
      state.restaurants.find(function (r) {
        return r.id === restaurantId;
      }) || null
    );
  }

  /**
   * First restaurant unlock (from stand mode): own MAX_STANDS stands and cash > $1000.
   */
  function restaurantUnlocked(state) {
    if (isRestaurantMode(state)) return false;
    return (
      standCount(state) >= MAX_STANDS &&
      Number(state.cash) > RESTAURANT_UNLOCK_CASH
    );
  }

  /**
   * Extra restaurants (2nd–4th) unlock in restaurant mode when cash > $1000
   * and the player owns fewer than MAX_RESTAURANTS.
   */
  function extraRestaurantUnlocked(state) {
    return (
      ownsRestaurant(state) &&
      restaurantCount(state) < MAX_RESTAURANTS &&
      Number(state.cash) > RESTAURANT_UNLOCK_CASH
    );
  }

  /** True when the player can afford and is eligible to buy a restaurant now. */
  function canBuyRestaurant(state) {
    if (Number(state.cash) + 1e-9 < RESTAURANT_COST) return false;
    if (ownsRestaurant(state)) return extraRestaurantUnlocked(state);
    return restaurantUnlocked(state);
  }

  function canBuyExtraRestaurant(state) {
    return (
      extraRestaurantUnlocked(state) &&
      Number(state.cash) + 1e-9 >= RESTAURANT_COST
    );
  }

  /**
   * One-shot notify when first eligible to convert to a restaurant.
   * Resets when no longer eligible so a later re-unlock can notify again.
   */
  function consumeRestaurantUnlockNotify(state) {
    if (!restaurantUnlocked(state)) {
      state.restaurantUnlockNotified = false;
      return null;
    }
    if (state.restaurantUnlockNotified) return null;
    state.restaurantUnlockNotified = true;
    return (
      "Cash is over $" +
      RESTAURANT_UNLOCK_CASH +
      " and you own " +
      MAX_STANDS +
      " stands! You can buy a restaurant for $" +
      RESTAURANT_COST.toFixed(0) +
      " — all stands will be forfeited. Hire 2–4 employees (you cannot work the restaurant yourself)."
    );
  }

  /**
   * One-shot notify when eligible to buy an additional restaurant (Phase 17).
   */
  function consumeExtraRestaurantUnlockNotify(state) {
    if (!extraRestaurantUnlocked(state)) {
      state.extraRestaurantUnlockNotified = false;
      return null;
    }
    if (state.extraRestaurantUnlockNotified) return null;
    state.extraRestaurantUnlockNotified = true;
    const left = MAX_RESTAURANTS - restaurantCount(state);
    return (
      "Cash is over $" +
      RESTAURANT_UNLOCK_CASH +
      "! You can buy another restaurant for $" +
      RESTAURANT_COST.toFixed(0) +
      " (up to " +
      MAX_RESTAURANTS +
      "; " +
      left +
      " slot" +
      (left === 1 ? "" : "s") +
      " left). Each pays its own daily rent and needs 2–4 staff."
    );
  }

  /** Next restaurant number for naming (max existing index + 1). */
  function nextRestaurantIndex(state) {
    let max = 0;
    if (Array.isArray(state.restaurants)) {
      for (const r of state.restaurants) {
        const m = String(r.id || "").match(/restaurant-(\d+)/i);
        if (m) max = Math.max(max, Number(m[1]) || 0);
        const nm = String(r.name || "").match(/Restaurant\s+(\d+)/i);
        if (nm) max = Math.max(max, Number(nm[1]) || 0);
      }
    }
    return max + 1;
  }

  /**
   * Buy the first restaurant ($400, forfeit stands) or an additional one in
   * restaurant mode when cash > $1000 (max MAX_RESTAURANTS). Starts with 0 staff.
   */
  function buyRestaurant(state) {
    // Phase 17: buy another restaurant while already in restaurant mode.
    if (ownsRestaurant(state)) {
      const count = restaurantCount(state);
      if (count >= MAX_RESTAURANTS) {
        return {
          ok: false,
          message:
            "You already own the maximum of " +
            MAX_RESTAURANTS +
            " restaurants.",
        };
      }
      if (Number(state.cash) <= RESTAURANT_UNLOCK_CASH) {
        return {
          ok: false,
          message:
            "Another restaurant unlocks when cash is over $" +
            RESTAURANT_UNLOCK_CASH +
            " (you have $" +
            Number(state.cash).toFixed(2) +
            ").",
        };
      }
      if (state.cash + 1e-9 < RESTAURANT_COST) {
        return {
          ok: false,
          message:
            "Not enough cash to buy another restaurant (need $" +
            RESTAURANT_COST.toFixed(2) +
            ", have $" +
            Number(state.cash).toFixed(2) +
            ").",
        };
      }

      state.cash = +(state.cash - RESTAURANT_COST).toFixed(2);
      state.extraRestaurantUnlockNotified = false;
      const restaurant = createRestaurant(nextRestaurantIndex(state));
      state.restaurants.push(restaurant);
      state.activeRestaurantId = restaurant.id;

      return {
        ok: true,
        restaurant: restaurant,
        cost: RESTAURANT_COST,
        message:
          "Bought " +
          restaurant.name +
          " for $" +
          RESTAURANT_COST.toFixed(2) +
          "! You now own " +
          state.restaurants.length +
          " restaurants. Hire " +
          RESTAURANT_MIN_STAFF +
          "–" +
          RESTAURANT_MAX_STAFF +
          " employees at each before Sell Day. Each pays rent $" +
          RESTAURANT_RENT.toFixed(0) +
          "/day. Cash left: $" +
          state.cash.toFixed(2) +
          ".",
      };
    }

    // Phase 16: first restaurant from stand mode.
    if (standCount(state) < MAX_STANDS) {
      return {
        ok: false,
        message:
          "You need " +
          MAX_STANDS +
          " stands before you can buy a restaurant (you have " +
          standCount(state) +
          ").",
      };
    }
    if (Number(state.cash) <= RESTAURANT_UNLOCK_CASH) {
      return {
        ok: false,
        message:
          "Restaurants unlock when cash is over $" +
          RESTAURANT_UNLOCK_CASH +
          " (you have $" +
          Number(state.cash).toFixed(2) +
          ").",
      };
    }
    if (state.cash + 1e-9 < RESTAURANT_COST) {
      return {
        ok: false,
        message:
          "Not enough cash to buy a restaurant (need $" +
          RESTAURANT_COST.toFixed(2) +
          ", have $" +
          Number(state.cash).toFixed(2) +
          ").",
      };
    }

    const forfeited = standCount(state);
    state.cash = +(state.cash - RESTAURANT_COST).toFixed(2);
    state.mode = MODE_RESTAURANT;
    state.stands = [];
    state.activeStandId = null;
    state.extraStandUnlockNotified = false;
    state.restaurantUnlockNotified = false;
    state.extraRestaurantUnlockNotified = false;

    const restaurant = createRestaurant(1);
    state.restaurants = [restaurant];
    state.activeRestaurantId = restaurant.id;

    return {
      ok: true,
      restaurant: restaurant,
      cost: RESTAURANT_COST,
      message:
        "Bought " +
        restaurant.name +
        " for $" +
        RESTAURANT_COST.toFixed(2) +
        "! Forfeited " +
        forfeited +
        " stands. Cash left: $" +
        state.cash.toFixed(2) +
        ". Hire " +
        RESTAURANT_MIN_STAFF +
        "–" +
        RESTAURANT_MAX_STAFF +
        " employees before Sell Day (you cannot staff the restaurant yourself). Daily rent $" +
        RESTAURANT_RENT.toFixed(0) +
        " + wages $" +
        RESTAURANT_WAGE.toFixed(0) +
        "/employee. Menu and inventory stay the same.",
    };
  }

  function setActiveRestaurant(state, restaurantId) {
    if (!ownsRestaurant(state)) {
      return { ok: false, message: "You do not own a restaurant yet." };
    }
    const restaurant = state.restaurants.find(function (r) {
      return r.id === restaurantId;
    });
    if (!restaurant) {
      return { ok: false, message: "Unknown restaurant." };
    }
    state.activeRestaurantId = restaurant.id;
    return {
      ok: true,
      restaurant: restaurant,
      message:
        "Managing " +
        restaurant.name +
        ". Inventory is shared across all restaurants.",
    };
  }

  /** True when selling a restaurant is allowed (including last → stand restart). */
  function canSellRestaurant(state) {
    return ownsRestaurant(state) && restaurantCount(state) >= 1;
  }

  /**
   * Sell a restaurant for RESTAURANT_SELL_PRICE ($200).
   * With 2+: keep ≥1 in restaurant mode.
   * Selling the last restaurant grants one stand via createStand(1) and
   * returns to stand mode (never own stands + restaurants together).
   */
  function sellRestaurant(state, restaurantId) {
    if (!ownsRestaurant(state)) {
      return { ok: false, message: "You do not own a restaurant to sell." };
    }
    const id =
      typeof restaurantId === "string" && restaurantId
        ? restaurantId
        : state.activeRestaurantId;
    const restaurant = findRestaurant(state, id);
    if (!restaurant) {
      return { ok: false, message: "Unknown restaurant." };
    }

    const count = restaurantCount(state);
    state.restaurants = state.restaurants.filter(function (r) {
      return r.id !== restaurant.id;
    });
    state.cash = +(Number(state.cash) + RESTAURANT_SELL_PRICE).toFixed(2);

    // Last restaurant → restart stand mode with one stand.
    if (state.restaurants.length === 0) {
      state.mode = MODE_STAND;
      state.activeRestaurantId = null;
      state.extraRestaurantUnlockNotified = false;
      state.restaurantUnlockNotified = false;
      const stand = createStand(1);
      state.stands = [stand];
      state.activeStandId = stand.id;
      state.extraStandUnlockNotified = false;
      return {
        ok: true,
        restaurant: restaurant,
        price: RESTAURANT_SELL_PRICE,
        restartedStand: true,
        stand: stand,
        message:
          "Sold " +
          restaurant.name +
          " for $" +
          RESTAURANT_SELL_PRICE.toFixed(2) +
          " — your last restaurant. You received " +
          stand.name +
          " and returned to stand mode. Cash: $" +
          state.cash.toFixed(2) +
          ". Stands and restaurants are never owned together.",
      };
    }

    if (
      !state.activeRestaurantId ||
      state.activeRestaurantId === restaurant.id ||
      !state.restaurants.some(function (r) {
        return r.id === state.activeRestaurantId;
      })
    ) {
      state.activeRestaurantId = state.restaurants[0].id;
    }

    return {
      ok: true,
      restaurant: restaurant,
      price: RESTAURANT_SELL_PRICE,
      restartedStand: false,
      message:
        "Sold " +
        restaurant.name +
        " for $" +
        RESTAURANT_SELL_PRICE.toFixed(2) +
        ". Cash: $" +
        state.cash.toFixed(2) +
        ". You still own " +
        state.restaurants.length +
        " restaurant" +
        (state.restaurants.length === 1 ? "" : "s") +
        ". Keep every remaining restaurant staffed (2–4 each) before Sell Day.",
    };
  }

  /** Total restaurant employees across all restaurants. */
  function restaurantEmployeeCount(state) {
    if (!ownsRestaurant(state)) return 0;
    let n = 0;
    for (const r of state.restaurants) {
      n += clampRestaurantStaff(r.employeeCount);
    }
    return n;
  }

  function dailyRestaurantWageCost(state) {
    return +(restaurantEmployeeCount(state) * RESTAURANT_WAGE).toFixed(2);
  }

  function dailyRestaurantRent(state) {
    if (!ownsRestaurant(state)) return 0;
    return +(restaurantCount(state) * RESTAURANT_RENT).toFixed(2);
  }

  /** Wages + rent for restaurant mode (0 in stand mode). */
  function dailyRestaurantOverhead(state) {
    if (!ownsRestaurant(state)) return 0;
    return +(dailyRestaurantWageCost(state) + dailyRestaurantRent(state)).toFixed(
      2
    );
  }

  /**
   * Demand/capacity multiplier from one restaurant's staff.
   * Formula: capacityMult = 0.7 + 0.2 * employeeCount
   *   2 staff → 1.1, 3 → 1.3, 4 → 1.5
   * Phase 17 economy rolls demand per restaurant with this mult (shared inventory).
   */
  function restaurantCapacityMultFor(restaurant) {
    const n = restaurant ? clampRestaurantStaff(restaurant.employeeCount) : 0;
    return +(0.7 + 0.2 * n).toFixed(2);
  }

  /** Active restaurant's capacity mult (UI); stand mode → 1. */
  function restaurantCapacityMult(state) {
    if (!ownsRestaurant(state)) return 1;
    return restaurantCapacityMultFor(getActiveRestaurant(state));
  }

  /**
   * Every owned restaurant must have RESTAURANT_MIN_STAFF–MAX staff.
   * Player cannot work a restaurant shift.
   */
  function restaurantStaffingCheck(state) {
    if (!ownsRestaurant(state)) {
      return {
        ok: false,
        message: "You do not own a restaurant.",
        employeeCount: 0,
      };
    }
    const total = restaurantEmployeeCount(state);
    for (const r of state.restaurants) {
      const n = clampRestaurantStaff(r.employeeCount);
      if (n < RESTAURANT_MIN_STAFF) {
        return {
          ok: false,
          employeeCount: total,
          restaurantId: r.id,
          message:
            "Understaffed — " +
            r.name +
            " needs at least " +
            RESTAURANT_MIN_STAFF +
            " employees (has " +
            n +
            "). You cannot work a restaurant shift; hire staff before Sell Day. All restaurants must be staffed.",
        };
      }
      if (n > RESTAURANT_MAX_STAFF) {
        return {
          ok: false,
          employeeCount: total,
          restaurantId: r.id,
          message:
            "Too many employees at " +
            r.name +
            " — max " +
            RESTAURANT_MAX_STAFF +
            " per restaurant.",
        };
      }
    }
    return { ok: true, message: "", employeeCount: total };
  }

  /**
   * Must afford today's wages + rent (all restaurants) from current cash to stay open.
   * Returns { ok, message, overhead, wages, rent }.
   */
  function restaurantOverheadCheck(state) {
    const staff = restaurantStaffingCheck(state);
    if (!staff.ok) {
      return {
        ok: false,
        message: staff.message,
        overhead: dailyRestaurantOverhead(state),
        wages: dailyRestaurantWageCost(state),
        rent: dailyRestaurantRent(state),
      };
    }
    const wages = dailyRestaurantWageCost(state);
    const rent = dailyRestaurantRent(state);
    const overhead = +(wages + rent).toFixed(2);
    const count = restaurantCount(state);
    if (Number(state.cash) + 1e-9 < overhead) {
      return {
        ok: false,
        overhead: overhead,
        wages: wages,
        rent: rent,
        message:
          "Can't cover today's overhead — need $" +
          overhead.toFixed(2) +
          " for wages ($" +
          wages.toFixed(2) +
          ") + rent ($" +
          rent.toFixed(2) +
          " across " +
          count +
          " restaurant" +
          (count === 1 ? "" : "s") +
          "), but you only have $" +
          Number(state.cash).toFixed(2) +
          ". Earn or save more before Sell Day, or lay off staff / sell a restaurant to lower overhead.",
      };
    }
    return {
      ok: true,
      message: "",
      overhead: overhead,
      wages: wages,
      rent: rent,
    };
  }

  /**
   * Hire one more restaurant employee (up to MAX). No upfront cost; wage on Sell Day.
   */
  function hireRestaurantEmployee(state, restaurantId) {
    const id =
      typeof restaurantId === "string" && restaurantId
        ? restaurantId
        : state.activeRestaurantId;
    const restaurant = findRestaurant(state, id) || getActiveRestaurant(state);
    if (!restaurant) {
      return { ok: false, message: "Unknown restaurant." };
    }
    const n = clampRestaurantStaff(restaurant.employeeCount);
    if (n >= RESTAURANT_MAX_STAFF) {
      return {
        ok: false,
        message:
          restaurant.name +
          " already has the maximum of " +
          RESTAURANT_MAX_STAFF +
          " employees.",
      };
    }
    restaurant.employeeCount = n + 1;
    return {
      ok: true,
      restaurant: restaurant,
      message:
        "Hired an employee for " +
        restaurant.name +
        " (" +
        restaurant.employeeCount +
        "/" +
        RESTAURANT_MAX_STAFF +
        "). Wage: $" +
        RESTAURANT_WAGE.toFixed(2) +
        "/day each + rent $" +
        RESTAURANT_RENT.toFixed(2) +
        "/day (paid on Sell Day).",
    };
  }

  /** Lay off one restaurant employee. */
  function layoffRestaurantEmployee(state, restaurantId) {
    const id =
      typeof restaurantId === "string" && restaurantId
        ? restaurantId
        : state.activeRestaurantId;
    const restaurant = findRestaurant(state, id) || getActiveRestaurant(state);
    if (!restaurant) {
      return { ok: false, message: "Unknown restaurant." };
    }
    const n = clampRestaurantStaff(restaurant.employeeCount);
    if (n <= 0) {
      return {
        ok: false,
        message: restaurant.name + " has no employees to lay off.",
      };
    }
    restaurant.employeeCount = n - 1;
    return {
      ok: true,
      restaurant: restaurant,
      message:
        "Laid off an employee at " +
        restaurant.name +
        " (" +
        restaurant.employeeCount +
        "/" +
        RESTAURANT_MAX_STAFF +
        " left)." +
        (restaurant.employeeCount < RESTAURANT_MIN_STAFF
          ? " Hire back to at least " +
            RESTAURANT_MIN_STAFF +
            " before Sell Day."
          : ""),
    };
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
    if (isRestaurantMode(state)) {
      return {
        ok: false,
        message:
          "You own a restaurant now — stands and restaurants cannot be owned together.",
      };
    }

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
        " stands. Staff every stand (you may run one; hire for the rest) before Sell Day. Cash left: $" +
        state.cash.toFixed(2) +
        ". Inventory stays shared.",
    };
  }

  /** True when the player owns 2+ stands (may sell one and keep ≥1). */
  function canSellStand(state) {
    return standCount(state) >= 2;
  }

  /**
   * Sell a stand for STAND_SELL_PRICE ($10). Must keep at least one stand.
   * Defaults to the active stand when standId is omitted.
   * Clears activeStandId / player assignment when that stand is sold.
   */
  function sellStand(state, standId) {
    if (isRestaurantMode(state)) {
      return {
        ok: false,
        message: "You are in restaurant mode — stands were forfeited when you bought the restaurant.",
      };
    }
    const count = standCount(state);
    if (count < 1) {
      return { ok: false, message: "You do not own a stand to sell." };
    }
    if (count < 2) {
      return {
        ok: false,
        message:
          "You must keep at least one stand. Selling your last stand is not allowed.",
      };
    }

    const id =
      typeof standId === "string" && standId
        ? standId
        : state.activeStandId;
    const stand = findStand(state, id);
    if (!stand) {
      return { ok: false, message: "Unknown stand." };
    }

    const wasPlayerRun = stand.staffedBy === STAFF_PLAYER;
    state.stands = state.stands.filter(function (s) {
      return s.id !== stand.id;
    });
    state.cash = +(Number(state.cash) + STAND_SELL_PRICE).toFixed(2);

    if (
      !state.activeStandId ||
      state.activeStandId === stand.id ||
      !state.stands.some(function (s) {
        return s.id === state.activeStandId;
      })
    ) {
      state.activeStandId = state.stands[0].id;
    }

    return {
      ok: true,
      stand,
      price: STAND_SELL_PRICE,
      message:
        "Sold " +
        stand.name +
        " for $" +
        STAND_SELL_PRICE.toFixed(2) +
        ". Cash: $" +
        state.cash.toFixed(2) +
        ". You still own " +
        state.stands.length +
        " stand" +
        (state.stands.length === 1 ? "" : "s") +
        "." +
        (wasPlayerRun
          ? " You are no longer assigned to the sold stand."
          : "") +
        (standCount(state) >= 2
          ? " Keep every remaining stand staffed before Sell Day."
          : " With one stand left, staffing is optional again."),
    };
  }

  /** Find a stand by id, or null. */
  function findStand(state, standId) {
    if (!ownsStand(state) || typeof standId !== "string") return null;
    return (
      state.stands.find(function (s) {
        return s.id === standId;
      }) || null
    );
  }

  /** Id of the stand the player is running, or null. */
  function playerStandId(state) {
    if (!ownsStand(state)) return null;
    const stand = state.stands.find(function (s) {
      return s.staffedBy === STAFF_PLAYER;
    });
    return stand ? stand.id : null;
  }

  /**
   * Hired employees: stand employees in stand mode, restaurant staff in
   * restaurant mode (player cannot count as restaurant staff).
   */
  function employeeCount(state) {
    if (isRestaurantMode(state)) return restaurantEmployeeCount(state);
    if (!ownsStand(state)) return 0;
    let n = 0;
    for (const stand of state.stands) {
      if (stand.staffedBy === STAFF_EMPLOYEE) n += 1;
    }
    return n;
  }

  /**
   * Daily wage bill. Stand mode: $5/employee. Restaurant mode: $8/employee
   * (rent is separate via dailyRestaurantRent).
   */
  function dailyWageCost(state) {
    if (isRestaurantMode(state)) return dailyRestaurantWageCost(state);
    return +(employeeCount(state) * STAND_EMPLOYEE_WAGE).toFixed(2);
  }

  /**
   * Staffing is required with 2+ stands, or always in restaurant mode
   * (min 2 restaurant employees; player cannot staff).
   */
  function staffingRequired(state) {
    if (isRestaurantMode(state)) return true;
    return standCount(state) >= 2;
  }

  /** Stands that have neither player nor employee when staffing is required. */
  function unstaffedStands(state) {
    if (!ownsStand(state)) return [];
    if (!staffingRequired(state)) return [];
    return state.stands.filter(function (s) {
      return s.staffedBy !== STAFF_PLAYER && s.staffedBy !== STAFF_EMPLOYEE;
    });
  }

  function isFullyStaffed(state) {
    if (isRestaurantMode(state)) {
      return restaurantStaffingCheck(state).ok;
    }
    if (!ownsStand(state)) return false;
    if (!staffingRequired(state)) return true;
    return unstaffedStands(state).length === 0;
  }

  /**
   * Human-readable staffing check for Sell Day / morning hint.
   * Stand mode: every stand staffed when 2+.
   * Restaurant mode: 2–4 employees and enough cash for wages + rent.
   * Returns { ok, message, unstaffed }.
   */
  function staffingCheck(state) {
    if (isRestaurantMode(state)) {
      const overhead = restaurantOverheadCheck(state);
      return {
        ok: overhead.ok,
        message: overhead.message,
        unstaffed: [],
        wages: overhead.wages,
        rent: overhead.rent,
        overhead: overhead.overhead,
      };
    }
    if (!ownsStand(state)) {
      return {
        ok: false,
        message:
          "Buy your first stand for $" +
          STAND_COST.toFixed(2) +
          " before Sell Day.",
        unstaffed: [],
      };
    }
    if (!staffingRequired(state)) {
      return { ok: true, message: "", unstaffed: [] };
    }
    const missing = unstaffedStands(state);
    if (missing.length === 0) {
      return { ok: true, message: "", unstaffed: [] };
    }
    const names = missing
      .map(function (s) {
        return s.name;
      })
      .join(", ");
    return {
      ok: false,
      unstaffed: missing,
      message:
        "Understaffed — every stand needs a worker when you own 2+. " +
        "Unstaffed: " +
        names +
        ". Assign yourself to one stand and/or Hire employees for the others before Sell Day.",
    };
  }

  /**
   * Hire an employee for a stand (no upfront cost; wage on Sell Day).
   * If the player was running this stand, they step aside.
   */
  function hireEmployee(state, standId) {
    if (isRestaurantMode(state)) {
      return {
        ok: false,
        message:
          "Use restaurant Hire controls — stand employees are not used in restaurant mode.",
      };
    }
    const stand = findStand(state, standId);
    if (!stand) {
      return { ok: false, message: "Unknown stand." };
    }
    if (stand.staffedBy === STAFF_EMPLOYEE) {
      return {
        ok: false,
        message: stand.name + " already has an employee.",
      };
    }
    stand.staffedBy = STAFF_EMPLOYEE;
    return {
      ok: true,
      stand,
      message:
        "Hired an employee for " +
        stand.name +
        ". Wage: $" +
        STAND_EMPLOYEE_WAGE.toFixed(2) +
        "/day (paid on Sell Day).",
    };
  }

  /** Lay off the employee at a stand (clears employee staffing only). */
  function layoffEmployee(state, standId) {
    const stand = findStand(state, standId);
    if (!stand) {
      return { ok: false, message: "Unknown stand." };
    }
    if (stand.staffedBy !== STAFF_EMPLOYEE) {
      return {
        ok: false,
        message: stand.name + " has no employee to lay off.",
      };
    }
    stand.staffedBy = null;
    return {
      ok: true,
      stand,
      message:
        "Laid off the employee at " +
        stand.name +
        "." +
        (staffingRequired(state)
          ? " Staff that stand (hire again or run it yourself) before Sell Day."
          : ""),
    };
  }

  /**
   * Assign the player to run one stand (at most one). Clears any previous
   * player assignment and replaces an employee at the target if present.
   */
  function assignPlayerToStand(state, standId) {
    const stand = findStand(state, standId);
    if (!stand) {
      return { ok: false, message: "Unknown stand." };
    }
    if (stand.staffedBy === STAFF_PLAYER) {
      return {
        ok: true,
        stand,
        message: "You are already running " + stand.name + ".",
      };
    }
    // Clear player from any other stand (at most one player-run stand).
    for (const s of state.stands) {
      if (s.staffedBy === STAFF_PLAYER) s.staffedBy = null;
    }
    const replacedEmployee = stand.staffedBy === STAFF_EMPLOYEE;
    stand.staffedBy = STAFF_PLAYER;
    return {
      ok: true,
      stand,
      message:
        "You are now running " +
        stand.name +
        "." +
        (replacedEmployee
          ? " That stand’s employee was let go (you took the shift)."
          : "") +
        " You can run only one stand; hire employees for the others.",
    };
  }

  /** Stop the player from running a stand (leaves it unstaffed). */
  function unassignPlayerFromStand(state, standId) {
    const stand = findStand(state, standId);
    if (!stand) {
      return { ok: false, message: "Unknown stand." };
    }
    if (stand.staffedBy !== STAFF_PLAYER) {
      return {
        ok: false,
        message: "You are not running " + stand.name + ".",
      };
    }
    stand.staffedBy = null;
    return {
      ok: true,
      stand,
      message:
        "You stepped away from " +
        stand.name +
        "." +
        (staffingRequired(state)
          ? " Hire an employee (or assign yourself again) before Sell Day."
          : ""),
    };
  }

  function staffLabel(staffedBy) {
    if (staffedBy === STAFF_PLAYER) return "You (player)";
    if (staffedBy === STAFF_EMPLOYEE) return "Employee";
    return "Unstaffed";
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
            staffedBy: normalizeStaffedBy(s.staffedBy),
          };
        })
        .slice(0, MAX_STANDS);
      // At most one player-run stand after migrate/normalize.
      let sawPlayer = false;
      for (const s of stands) {
        if (s.staffedBy === STAFF_PLAYER) {
          if (sawPlayer) s.staffedBy = null;
          else sawPlayer = true;
        }
      }
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
    const restaurantUnlockNotified = !!raw.restaurantUnlockNotified;
    const extraRestaurantUnlockNotified = !!raw.extraRestaurantUnlockNotified;

    // Phase 16–17 restaurants: normalize mode + restaurants (up to MAX_RESTAURANTS).
    let mode =
      raw.mode === MODE_RESTAURANT || raw.mode === MODE_STAND
        ? raw.mode
        : MODE_STAND;
    let restaurants = [];
    if (Array.isArray(raw.restaurants)) {
      restaurants = raw.restaurants
        .filter(function (r) {
          return r && typeof r === "object";
        })
        .map(function (r, i) {
          const n = i + 1;
          return {
            id:
              typeof r.id === "string" && r.id ? r.id : "restaurant-" + n,
            name:
              typeof r.name === "string" && r.name
                ? r.name
                : "Restaurant " + n,
            employeeCount: clampRestaurantStaff(r.employeeCount),
          };
        })
        .slice(0, MAX_RESTAURANTS);
    }
    // Legacy / inconsistent saves: restaurants present ⇒ restaurant mode.
    // Never keep stands and restaurants together.
    if (restaurants.length > 0) mode = MODE_RESTAURANT;
    if (mode === MODE_RESTAURANT) {
      stands = [];
      activeStandId = null;
      if (restaurants.length === 0) {
        restaurants = [createRestaurant(1)];
      }
    } else {
      restaurants = [];
    }

    let activeRestaurantId =
      typeof raw.activeRestaurantId === "string"
        ? raw.activeRestaurantId
        : null;
    if (restaurants.length === 0) {
      activeRestaurantId = null;
    } else if (
      !activeRestaurantId ||
      !restaurants.some(function (r) {
        return r.id === activeRestaurantId;
      })
    ) {
      activeRestaurantId = restaurants[0].id;
    }

    let supplyPriceMult = Number(raw.supplyPriceMult);
    if (!Number.isFinite(supplyPriceMult) || supplyPriceMult <= 0) {
      supplyPriceMult = 1;
    }
    supplyPriceMult = Math.min(
      SUPPLY_MULT_MAX,
      Math.max(SUPPLY_MULT_MIN, supplyPriceMult)
    );

    let supplyPriceDaysLeft = Number(raw.supplyPriceDaysLeft);
    if (!Number.isFinite(supplyPriceDaysLeft) || supplyPriceDaysLeft < 0) {
      supplyPriceDaysLeft = 0;
    } else {
      supplyPriceDaysLeft = Math.floor(supplyPriceDaysLeft);
    }
    if (supplyPriceDaysLeft === 0) supplyPriceMult = 1;

    let demandMult = Number(raw.demandMult);
    if (!Number.isFinite(demandMult) || demandMult <= 0) demandMult = 1;
    demandMult = Math.min(2, Math.max(0.5, demandMult));

    let eventBanner = null;
    if (raw.eventBanner && typeof raw.eventBanner === "object") {
      const msg =
        typeof raw.eventBanner.message === "string"
          ? raw.eventBanner.message.trim()
          : "";
      if (msg) {
        const tone =
          raw.eventBanner.tone === "good" ||
          raw.eventBanner.tone === "bad" ||
          raw.eventBanner.tone === "neutral"
            ? raw.eventBanner.tone
            : "neutral";
        const day =
          Number.isFinite(raw.eventBanner.day) && raw.eventBanner.day >= 1
            ? Math.floor(raw.eventBanner.day)
            : null;
        eventBanner = { message: msg, tone: tone, day: day };
      }
    }

    return {
      day: Number.isFinite(raw.day) && raw.day >= 1 ? Math.floor(raw.day) : 1,
      cash: Number.isFinite(raw.cash) ? raw.cash : base.cash,
      mode,
      stands,
      activeStandId,
      restaurants,
      activeRestaurantId,
      extraStandUnlockNotified,
      restaurantUnlockNotified,
      extraRestaurantUnlockNotified,
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
      supplyPriceMult,
      supplyPriceDaysLeft,
      demandMult,
      eventBanner,
      // Phase 18: invent empty ledger when missing on older saves.
      ledger:
        global.GameLedger && global.GameLedger.normalizeLedger
          ? global.GameLedger.normalizeLedger(raw.ledger)
          : base.ledger,
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // iOS private mode / quota / blocked storage: keep the in-memory
      // day going so Sell Day can still finish and return to standby.
    }
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

  /**
   * Effective buy price for an ingredient.
   * When `state` is passed, applies temporary supplyPriceMult from events.
   */
  function unitPrice(key, state) {
    const base = UNIT_PRICES[key] ?? 0;
    if (!state) return base;
    let mult = Number(state.supplyPriceMult);
    if (!Number.isFinite(mult) || mult <= 0) mult = 1;
    if ((Number(state.supplyPriceDaysLeft) || 0) <= 0) mult = 1;
    mult = Math.min(SUPPLY_MULT_MAX, Math.max(SUPPLY_MULT_MIN, mult));
    return +(base * mult).toFixed(4);
  }

  /** Current demand multiplier for Sell Day (foot-traffic events). */
  function demandMultiplier(state) {
    const mult = Number(state && state.demandMult);
    if (!Number.isFinite(mult) || mult <= 0) return 1;
    return Math.min(2, Math.max(0.5, mult));
  }

  /** Clear one-shot demand multiplier after it was used on a Sell Day. */
  function clearDemandMultiplier(state) {
    state.demandMult = 1;
  }

  /**
   * Tick temporary supply-price modifiers at the start of a new day.
   * Call before rolling a new morning event.
   */
  function tickSupplyPriceModifiers(state) {
    let days = Number(state.supplyPriceDaysLeft) || 0;
    if (days <= 0) {
      state.supplyPriceMult = 1;
      state.supplyPriceDaysLeft = 0;
      return;
    }
    days -= 1;
    state.supplyPriceDaysLeft = days;
    if (days <= 0) {
      state.supplyPriceMult = 1;
      state.supplyPriceDaysLeft = 0;
    }
  }

  function setEventBanner(state, message, tone, day) {
    if (!message || typeof message !== "string") {
      state.eventBanner = null;
      return;
    }
    const t =
      tone === "good" || tone === "bad" || tone === "neutral"
        ? tone
        : "neutral";
    state.eventBanner = {
      message: message,
      tone: t,
      day: Number.isFinite(day) ? Math.floor(day) : state.day || null,
    };
  }

  function clearEventBanner(state) {
    state.eventBanner = null;
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

  function cartLineCost(key, qty, state) {
    return +(unitPrice(key, state) * qty).toFixed(2);
  }

  /** Total cash needed for a cart object of ingredient → qty. */
  function cartTotal(cart, state) {
    if (!cart || typeof cart !== "object") return 0;
    let total = 0;
    for (const key of INVENTORY_KEYS) {
      const qty = Number(cart[key]) || 0;
      if (qty > 0) total += unitPrice(key, state) * qty;
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

    const price = unitPrice(key, state);
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
        cost: cartLineCost(key, qty, state),
      });
    }

    const total = cartTotal(cart, state);
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
    STAND_EMPLOYEE_WAGE,
    STAND_SELL_PRICE,
    STAFF_PLAYER,
    STAFF_EMPLOYEE,
    RESTAURANT_COST,
    RESTAURANT_UNLOCK_CASH,
    MAX_RESTAURANTS,
    RESTAURANT_SELL_PRICE,
    RESTAURANT_RENT,
    RESTAURANT_WAGE,
    RESTAURANT_MIN_STAFF,
    RESTAURANT_MAX_STAFF,
    MODE_STAND,
    MODE_RESTAURANT,
    SUPPLY_MULT_MIN,
    SUPPLY_MULT_MAX,
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
    createRestaurant,
    ownsStand,
    standCount,
    isRestaurantMode,
    ownsRestaurant,
    restaurantCount,
    ownsBusiness,
    getActiveStand,
    getActiveRestaurant,
    findRestaurant,
    restaurantUnlocked,
    extraRestaurantUnlocked,
    canBuyRestaurant,
    canBuyExtraRestaurant,
    consumeRestaurantUnlockNotify,
    consumeExtraRestaurantUnlockNotify,
    buyRestaurant,
    setActiveRestaurant,
    canSellRestaurant,
    sellRestaurant,
    restaurantEmployeeCount,
    dailyRestaurantWageCost,
    dailyRestaurantRent,
    dailyRestaurantOverhead,
    restaurantCapacityMultFor,
    restaurantCapacityMult,
    restaurantStaffingCheck,
    restaurantOverheadCheck,
    hireRestaurantEmployee,
    layoffRestaurantEmployee,
    extraStandUnlocked,
    canBuyExtraStand,
    setActiveStand,
    consumeExtraStandUnlockNotify,
    buyStand,
    canSellStand,
    sellStand,
    findStand,
    playerStandId,
    employeeCount,
    dailyWageCost,
    staffingRequired,
    unstaffedStands,
    isFullyStaffed,
    staffingCheck,
    hireEmployee,
    layoffEmployee,
    assignPlayerToStand,
    unassignPlayerFromStand,
    staffLabel,
    loadInstructionsHidden,
    saveInstructionsHidden,
    inventoryLabels,
    unitPrice,
    demandMultiplier,
    clearDemandMultiplier,
    tickSupplyPriceModifiers,
    setEventBanner,
    clearEventBanner,
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
