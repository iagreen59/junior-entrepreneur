/**
 * Typed daily weather + product preference helpers.
 * Phase 7: hot / mild / cold replace anonymous weather noise.
 * Phase 11: food prefs — burger favored on hot; soup favored on cold.
 *
 * Preference (applied in GameEconomy demand):
 *   hot  → favors juice + burger (cold drink / hot-day food), reduces cocoa + soup
 *   cold → favors cocoa + soup (hot drink / cold-day food), reduces juice + burger
 *   mild → roughly even (factor 1.0 for all four)
 */
(function (global) {
  const TYPES = ["hot", "mild", "cold"];

  /** Demand multiplier when the active product matches the weather. */
  const MATCH_FACTOR = 1.35;
  /** Demand multiplier when the active product mismatches the weather. */
  const MISMATCH_FACTOR = 0.65;
  /** Mild days stay even for all products. */
  const MILD_FACTOR = 1.0;

  function isType(value) {
    return TYPES.includes(value);
  }

  function label(weather) {
    if (weather === "hot") return "Hot";
    if (weather === "cold") return "Cold";
    return "Mild";
  }

  function tip(weather) {
    if (weather === "hot") {
      return "Hot day — shoppers want juice and burgers more than cocoa or soup.";
    }
    if (weather === "cold") {
      return "Cold day — shoppers want hot cocoa and soup more than juice or burgers.";
    }
    return "Mild day — juice, cocoa, burgers, and soup draw about the same interest.";
  }

  /**
   * Roll today's weather. Equal odds hot / mild / cold.
   * Optional randomFn returns 0..1 for tests.
   */
  function roll(randomFn) {
    const r = typeof randomFn === "function" ? randomFn() : Math.random();
    if (r < 1 / 3) return "hot";
    if (r < 2 / 3) return "mild";
    return "cold";
  }

  function normalize(value, randomFn) {
    return isType(value) ? value : roll(randomFn);
  }

  /**
   * Whether the product is weather-favored.
   * Hot: juice + burger. Cold: cocoa + soup. Mild: neither (null).
   */
  function favorsProduct(weather, product) {
    const item =
      product === "cocoa" ||
      product === "burger" ||
      product === "soup"
        ? product
        : "juice";

    if (weather === "hot") {
      if (item === "juice" || item === "burger") return true;
      return false;
    }
    if (weather === "cold") {
      if (item === "cocoa" || item === "soup") return true;
      return false;
    }
    return null; // mild — none favored
  }

  /**
   * Demand multiplier for selling `product` under `weather`.
   */
  function preferenceFactor(weather, product) {
    const favor = favorsProduct(weather, product);
    if (favor === true) return MATCH_FACTOR;
    if (favor === false) return MISMATCH_FACTOR;
    return MILD_FACTOR;
  }

  global.GameWeather = {
    TYPES,
    MATCH_FACTOR,
    MISMATCH_FACTOR,
    MILD_FACTOR,
    isType,
    label,
    tip,
    roll,
    normalize,
    favorsProduct,
    preferenceFactor,
  };
})(window);
