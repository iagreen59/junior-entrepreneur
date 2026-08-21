/**
 * Typed daily weather + drink preference helpers.
 * Phase 7: hot / mild / cold replace anonymous weather noise.
 *
 * Preference (applied in GameEconomy demand):
 *   hot  → favors juice (cold drink), reduces cocoa
 *   cold → favors cocoa (hot drink), reduces juice
 *   mild → roughly even (factor 1.0 for both)
 */
(function (global) {
  const TYPES = ["hot", "mild", "cold"];

  /** Demand multiplier when the active drink matches the weather. */
  const MATCH_FACTOR = 1.35;
  /** Demand multiplier when the active drink mismatches the weather. */
  const MISMATCH_FACTOR = 0.65;
  /** Mild days stay even for juice and cocoa. */
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
      return "Hot day — shoppers want cold juice more than cocoa.";
    }
    if (weather === "cold") {
      return "Cold day — shoppers want hot cocoa more than juice.";
    }
    return "Mild day — juice and cocoa draw about the same interest.";
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
   * Whether the product is the weather-favored drink.
   * Juice = cold drink; cocoa = hot drink.
   */
  function favorsProduct(weather, product) {
    const drink = product === "cocoa" ? "cocoa" : "juice";
    if (weather === "hot") return drink === "juice";
    if (weather === "cold") return drink === "cocoa";
    return null; // mild — neither favored
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
