/**
 * Typed daily weather + product preference helpers.
 * Five levels: steaming hot → bitter cold.
 *
 * Preference (applied in GameEconomy demand):
 *   steaming → strongly favors juice + burger; reduces cocoa + soup
 *   hot      → favors juice + burger; reduces cocoa + soup
 *   mild     → roughly even (factor 1.0 for all four)
 *   cold     → favors cocoa + soup; reduces juice + burger
 *   bitter   → strongly favors cocoa + soup; reduces juice + burger
 */
(function (global) {
  const TYPES = ["steaming", "hot", "mild", "cold", "bitter"];

  /** Demand multiplier when the active product matches the weather. */
  const MATCH_FACTOR = 1.35;
  /** Demand multiplier when the active product mismatches the weather. */
  const MISMATCH_FACTOR = 0.65;
  /** Mild days stay even for all products. */
  const MILD_FACTOR = 1.0;
  /** Extra-strong match / mismatch on extreme days. */
  const STRONG_MATCH_FACTOR = 1.5;
  const STRONG_MISMATCH_FACTOR = 0.5;

  function isType(value) {
    return TYPES.includes(value);
  }

  function label(weather) {
    if (weather === "steaming") return "Steaming hot";
    if (weather === "hot") return "Hot";
    if (weather === "cold") return "Cold";
    if (weather === "bitter") return "Bitter cold";
    return "Mild";
  }

  function tip(weather) {
    if (weather === "steaming") {
      return "Steaming hot — shoppers crave icy juice and grilled burgers; skip cocoa and soup.";
    }
    if (weather === "hot") {
      return "Hot day — juice and burgers sell well; cocoa and soup are a harder sell.";
    }
    if (weather === "cold") {
      return "Cold day — hot cocoa and hearty soup beat juice and burgers.";
    }
    if (weather === "bitter") {
      return "Bitter cold — rich cocoa and filling soup are in demand; cold drinks struggle.";
    }
    return "Mild day — juice, cocoa, burgers, and soup draw about the same interest.";
  }

  function isExtremeHot(weather) {
    return weather === "steaming" || weather === "hot";
  }

  function isExtremeCold(weather) {
    return weather === "bitter" || weather === "cold";
  }

  /**
   * Roll today's weather. Equal odds across all five levels.
   * Optional randomFn returns 0..1 for tests.
   */
  function roll(randomFn) {
    const r = typeof randomFn === "function" ? randomFn() : Math.random();
    const slot = Math.floor(r * TYPES.length);
    return TYPES[Math.min(TYPES.length - 1, Math.max(0, slot))];
  }

  function normalize(value, randomFn) {
    if (isType(value)) return value;
    return roll(randomFn);
  }

  /**
   * Whether the product is weather-favored.
   * Hot end: juice + burger. Cold end: cocoa + soup. Mild: neither (null).
   */
  function favorsProduct(weather, product) {
    const item =
      product === "cocoa" ||
      product === "burger" ||
      product === "soup"
        ? product
        : "juice";

    if (weather === "steaming" || weather === "hot") {
      if (item === "juice" || item === "burger") return true;
      return false;
    }
    if (weather === "bitter" || weather === "cold") {
      if (item === "cocoa" || item === "soup") return true;
      return false;
    }
    return null; // mild — none favored
  }

  function matchFactor(weather) {
    if (weather === "steaming" || weather === "bitter") {
      return STRONG_MATCH_FACTOR;
    }
    if (weather === "hot" || weather === "cold") {
      return MATCH_FACTOR;
    }
    return MILD_FACTOR;
  }

  function mismatchFactor(weather) {
    if (weather === "steaming" || weather === "bitter") {
      return STRONG_MISMATCH_FACTOR;
    }
    if (weather === "hot" || weather === "cold") {
      return MISMATCH_FACTOR;
    }
    return MILD_FACTOR;
  }

  /**
   * Demand multiplier for selling `product` under `weather`.
   */
  function preferenceFactor(weather, product) {
    const favor = favorsProduct(weather, product);
    if (favor === true) return matchFactor(weather);
    if (favor === false) return mismatchFactor(weather);
    return MILD_FACTOR;
  }

  global.GameWeather = {
    TYPES,
    MATCH_FACTOR,
    MISMATCH_FACTOR,
    MILD_FACTOR,
    STRONG_MATCH_FACTOR,
    STRONG_MISMATCH_FACTOR,
    isType,
    label,
    tip,
    roll,
    normalize,
    favorsProduct,
    preferenceFactor,
    isExtremeHot,
    isExtremeCold,
    matchFactor,
    mismatchFactor,
  };
})(window);
