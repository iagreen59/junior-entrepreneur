/**
 * Phase 15 — random morning events (rare: less than ~1 per week expected).
 *
 * Roll after Sell Day advances the day (morning of the new day):
 *   chance ≈ 11% per day → ~0.77 events/week (keep expected < 1/week).
 *
 * Event set (good + bad, always manageable — no instant game over):
 *   - supply_bump  — buy prices ↑ for a few days
 *   - supply_drop  — buy prices ↓ for a few days
 *   - employee_quit — one hired employee leaves (rehire anytime)
 *   - foot_traffic — demand multiplier for the next Sell Day
 *
 * Banner message is stored on state.eventBanner for the stand UI.
 */
(function (global) {
  /** ~0.11/day → ~0.77/week expected. */
  const EVENT_CHANCE_PER_DAY = 0.11;

  const SUPPLY_BUMP_MULT = 1.25;
  const SUPPLY_DROP_MULT = 0.75;
  const SUPPLY_EVENT_DAYS = 3;
  const FOOT_TRAFFIC_MULT = 1.4;

  const EVENT_IDS = [
    "supply_bump",
    "supply_drop",
    "employee_quit",
    "foot_traffic",
  ];

  function rand(randomFn) {
    const fn = typeof randomFn === "function" ? randomFn : Math.random;
    const n = Number(fn());
    return Number.isFinite(n) ? n : Math.random();
  }

  function pickEventId(state, randomFn) {
    const pool = EVENT_IDS.slice();
    // Skip employee_quit when nobody is hired — still manageable, just pick another.
    const employees = global.GameState.employeeCount
      ? global.GameState.employeeCount(state)
      : 0;
    if (employees <= 0) {
      const idx = pool.indexOf("employee_quit");
      if (idx >= 0) pool.splice(idx, 1);
    }
    const i = Math.floor(rand(randomFn) * pool.length);
    return pool[Math.min(pool.length - 1, Math.max(0, i))];
  }

  function applySupplyBump(state) {
    state.supplyPriceMult = SUPPLY_BUMP_MULT;
    state.supplyPriceDaysLeft = SUPPLY_EVENT_DAYS;
    const message =
      "Supply squeeze: ingredient buy prices are up about 25% for the next " +
      SUPPLY_EVENT_DAYS +
      " days. Stock up carefully — prices will settle again.";
    global.GameState.setEventBanner(state, message, "bad", state.day);
    return { id: "supply_bump", tone: "bad", message: message };
  }

  function applySupplyDrop(state) {
    state.supplyPriceMult = SUPPLY_DROP_MULT;
    state.supplyPriceDaysLeft = SUPPLY_EVENT_DAYS;
    const message =
      "Supplier sale: ingredient buy prices are down about 25% for the next " +
      SUPPLY_EVENT_DAYS +
      " days. A good time to restock!";
    global.GameState.setEventBanner(state, message, "good", state.day);
    return { id: "supply_drop", tone: "good", message: message };
  }

  function applyEmployeeQuit(state) {
    if (!global.GameState.ownsStand(state)) {
      return applyFootTraffic(state);
    }
    const staffed = state.stands.filter(function (s) {
      return s.staffedBy === global.GameState.STAFF_EMPLOYEE;
    });
    if (staffed.length === 0) {
      return applyFootTraffic(state);
    }
    const stand = staffed[Math.floor(rand() * staffed.length)];
    stand.staffedBy = null;
    const message =
      "An employee quit at " +
      stand.name +
      "! Hire again (or run it yourself) before Sell Day if you own 2+ stands. No cash lost.";
    global.GameState.setEventBanner(state, message, "bad", state.day);
    return {
      id: "employee_quit",
      tone: "bad",
      message: message,
      standId: stand.id,
    };
  }

  function applyFootTraffic(state) {
    state.demandMult = FOOT_TRAFFIC_MULT;
    const message =
      "Foot-traffic surge: expect about 40% more customers on your next Sell Day. Stock up!";
    global.GameState.setEventBanner(state, message, "good", state.day);
    return { id: "foot_traffic", tone: "good", message: message };
  }

  function applyEvent(state, eventId) {
    if (eventId === "supply_bump") return applySupplyBump(state);
    if (eventId === "supply_drop") return applySupplyDrop(state);
    if (eventId === "employee_quit") return applyEmployeeQuit(state);
    return applyFootTraffic(state);
  }

  /**
   * Morning of a new day: tick supply-price timers, then maybe roll an event.
   * Returns { rolled, event? } — event is null when nothing happened.
   */
  function onNewDay(state, randomFn) {
    if (global.GameState.tickSupplyPriceModifiers) {
      global.GameState.tickSupplyPriceModifiers(state);
    }

    if (rand(randomFn) >= EVENT_CHANCE_PER_DAY) {
      return { rolled: false, event: null };
    }

    const id = pickEventId(state, randomFn);
    const event = applyEvent(state, id);
    return { rolled: true, event: event };
  }

  /** Force a specific event (tests / previews). */
  function forceEvent(state, eventId) {
    const id = EVENT_IDS.indexOf(eventId) >= 0 ? eventId : "foot_traffic";
    return applyEvent(state, id);
  }

  global.GameEvents = {
    EVENT_CHANCE_PER_DAY,
    SUPPLY_BUMP_MULT,
    SUPPLY_DROP_MULT,
    SUPPLY_EVENT_DAYS,
    FOOT_TRAFFIC_MULT,
    EVENT_IDS,
    onNewDay,
    forceEvent,
    applyEvent,
  };
})(window);
