/**
 * Customer taste preferences by product, weather, and recipe.
 * Drives demand multipliers, buy reactions, instructions copy, and day hints.
 */
(function (global) {
  const PRODUCT_KEYS = {
    juice: ["fruit", "sugar", "ice"],
    cocoa: ["chocolate", "milk", "whippedCream", "chocolateSprinkles"],
    burger: ["lettuce", "tomato", "cheese", "beefPatty"],
    soup: ["broth", "noodles", "carrot", "celery", "herbs"],
  };

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function ratioScore(actual, ideal) {
    const a = Number(actual) || 0;
    const i = Number(ideal) || 0;
    if (i <= 0) return 1;
    if (a <= 0) return 0;
    if (a >= i) return clamp01(1 - (a - i) * 0.08);
    return clamp01(a / i);
  }

  /**
   * Ideal ingredient amounts customers hope for on a given weather day.
   */
  function idealRecipe(product, weather) {
    if (product === "juice") {
      return {
        fruit: weather === "mild" ? 2 : 1,
        sugar: 1,
        ice:
          weather === "steaming" ? 3 : weather === "hot" ? 2 : 1,
      };
    }
    if (product === "cocoa") {
      return {
        chocolate:
          weather === "bitter" ? 3 : weather === "cold" ? 2 : 2,
        milk: 1,
        whippedCream: weather === "bitter" ? 2 : 1,
        chocolateSprinkles:
          weather === "bitter" || weather === "cold" ? 2 : 1,
      };
    }
    if (product === "burger") {
      return {
        beefPatty: 1,
        lettuce: global.GameWeather && global.GameWeather.isExtremeHot(weather) ? 1 : 1,
        tomato: global.GameWeather && global.GameWeather.isExtremeHot(weather) ? 1 : 1,
        cheese:
          weather === "steaming" || weather === "hot" ? 1 : 1,
      };
    }
    if (product === "soup") {
      return {
        broth: weather === "bitter" ? 2 : weather === "cold" ? 2 : 1,
        noodles: weather === "bitter" ? 2 : weather === "cold" ? 2 : 1,
        carrot: weather === "bitter" || weather === "cold" ? 1 : 1,
        celery: weather === "bitter" || weather === "cold" ? 1 : 1,
        herbs: 1,
      };
    }
    return {};
  }

  /**
   * 0..1 score for how well a recipe matches customer taste today.
   */
  function recipeScore(product, recipe, weather) {
    const ideals = idealRecipe(product, weather);
    const keys = PRODUCT_KEYS[product] || Object.keys(ideals);
    if (!keys.length) return 0.75;

    let sum = 0;
    let count = 0;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(ideals, key)) continue;
      sum += ratioScore(recipe && recipe[key], ideals[key]);
      count += 1;
    }
    return count ? sum / count : 0.75;
  }

  /** Demand multiplier from recipe fit (0.82 – 1.18). */
  function demandFactor(product, recipe, weather) {
    const score = recipeScore(product, recipe, weather);
    return +(0.82 + score * 0.36).toFixed(3);
  }

  function ingredientLabel(key) {
    const labels =
      global.GameState && global.GameState.inventoryLabels
        ? global.GameState.inventoryLabels()
        : {};
    return labels[key] || key;
  }

  function preferenceSummary(product) {
    if (product === "juice") {
      return "Extra ice on hot days; a fruit-forward blend on mild days.";
    }
    if (product === "cocoa") {
      return "Rich, chocolaty flavor — more chocolate, whipped cream, and sprinkles on cold days.";
    }
    if (product === "burger") {
      return "Loaded with fresh toppings (lettuce, tomato, cheese) on hot and steaming days.";
    }
    if (product === "soup") {
      return "Hearty bowl — extra broth, noodles, and veggies on cold and bitter-cold days.";
    }
    return "";
  }

  function weatherMenuSummary(weather) {
    const label = global.GameWeather ? global.GameWeather.label(weather) : weather;
    if (global.GameWeather && global.GameWeather.isExtremeHot(weather)) {
      return (
        label +
        " weather favors juice (icy) and loaded burgers; cocoa and soup are a tough sell."
      );
    }
    if (global.GameWeather && global.GameWeather.isExtremeCold(weather)) {
      return (
        label +
        " weather favors rich cocoa and hearty soup; juice and burgers cool off."
      );
    }
    if (weather === "hot") {
      return label + " weather favors juice and burgers over cocoa and soup.";
    }
    if (weather === "cold") {
      return label + " weather favors cocoa and soup over juice and burgers.";
    }
    return label + " weather — all four items draw similar foot traffic.";
  }

  /**
   * Actionable hints from a completed day report + current recipes.
   */
  function buildHints(report, state) {
    if (!report) return [];

    const weather = report.weather || "mild";
    const hints = [];
    const weatherLabel = global.GameWeather
      ? global.GameWeather.label(weather)
      : weather;
    hints.push(
      weatherMenuSummary(weather) +
        " Match your menu toggles and recipes to the day."
    );

    const products =
      report.products && report.products.length
        ? report.products
        : global.GameState && global.GameState.PRODUCTS
          ? global.GameState.PRODUCTS.slice()
          : ["juice", "cocoa", "burger", "soup"];

    const customers = report.customers || {};
    const byProduct = customers.byProduct || {};

    for (const product of products) {
      const row = byProduct[product] || {};
      const dislikes = (row.dislikes | 0) + (row.leftWeather | 0);
      if (dislikes <= 0 && (row.happy | 0) >= (row.likes | 0)) continue;

      const recipe =
        (state &&
          state.recipes &&
          state.recipes[product]) ||
        (report.recipes && report.recipes[product]) ||
        {};
      const ideals = idealRecipe(product, weather);
      const item =
        global.GameState && global.GameState.productLabel
          ? global.GameState.productLabel(product)
          : product;
      const tips = [];

      for (const key of Object.keys(ideals)) {
        const ideal = ideals[key];
        const actual = Number(recipe[key]) || 0;
        if (actual < ideal) {
          tips.push(
            "add more " +
              ingredientLabel(key).toLowerCase() +
              " (try " +
              ideal +
              ", you use " +
              actual +
              ")"
          );
        }
      }

      if (tips.length) {
        hints.push(
          item +
            " on " +
            weatherLabel +
            ": customers wanted " +
            preferenceSummary(product).split(";")[0].toLowerCase() +
            " — " +
            tips.slice(0, 2).join("; ") +
            "."
        );
      } else if ((row.leftWeather | 0) > 0) {
        hints.push(
          item +
            " saw weather walk-aways — consider turning it off on " +
            weatherLabel +
            " days or lowering the price."
        );
      } else if ((row.leftPrice | 0) > 0) {
        hints.push(
          item +
            " lost buyers on price — try a lower sell price or improve the recipe for happier reactions."
        );
      }
    }

    if (hints.length === 1) {
      hints.push(
        "Recipes look reasonable — tweak menu toggles for the weather and keep prices near $1.50–$2.00 to start."
      );
    }

    return hints;
  }

  global.GameRecipePrefs = {
    idealRecipe,
    recipeScore,
    demandFactor,
    preferenceSummary,
    weatherMenuSummary,
    buildHints,
  };
})(window);
