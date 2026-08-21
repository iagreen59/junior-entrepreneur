/**
 * Product recipe helpers + validation.
 * Phase 6: juice and cocoa recipes.
 * Phase 10: juice uses coldCups; cocoa uses hotCups (no shared cups).
 * Phase 11: burger and soup with unique ingredients (no cups).
 */
(function (global) {
  function describe(product, recipe) {
    if (!recipe) return "No recipe set yet.";
    const keys = global.GameState.recipeKeysFor(product);
    const labels = global.GameState.inventoryLabels();
    const parts = keys.map(function (key) {
      return recipe[key] + " " + labels[key].toLowerCase();
    });
    const unit =
      product === "burger" || product === "soup" ? "serving" : "cup";
    return (
      "Per " +
      unit +
      " of " +
      global.GameState.productLabel(product) +
      ": " +
      parts.join(", ") +
      "."
    );
  }

  /**
   * Normalize recipe draft from form inputs for a product.
   * Returns { ok: true, recipe } or { ok: false, message }.
   */
  function parseDraft(product, raw) {
    const keys = global.GameState.recipeKeysFor(product);
    const recipe = {};
    for (const key of keys) {
      const value = Number(raw && raw[key]);
      if (!Number.isFinite(value) || value < 0) {
        return {
          ok: false,
          message: "Recipe amounts must be zero or greater.",
        };
      }
      recipe[key] = Math.floor(value);
    }

    const cupKey = global.GameState.cupKeyFor(product);
    if (cupKey) {
      if (recipe[cupKey] < 1) {
        return {
          ok: false,
          message:
            product === "cocoa"
              ? "Each drink needs at least 1 hot cup."
              : "Each drink needs at least 1 cold cup.",
        };
      }
    } else {
      // Food items: require at least one ingredient so a serving is defined.
      let anyPositive = false;
      for (const key of keys) {
        if (recipe[key] >= 1) {
          anyPositive = true;
          break;
        }
      }
      if (!anyPositive) {
        return {
          ok: false,
          message:
            "Each " +
            global.GameState.productLabel(product) +
            " serving needs at least one ingredient.",
        };
      }
    }

    return { ok: true, recipe };
  }

  function apply(state, draft) {
    const product = global.GameState.normalizeProduct(
      state.activeProduct,
      "juice"
    );
    const parsed = parseDraft(product, draft);
    if (!parsed.ok) return parsed;
    state.recipes[product] = parsed.recipe;
    return {
      ok: true,
      product,
      recipe: parsed.recipe,
      message: "Recipe saved. " + describe(product, parsed.recipe),
    };
  }

  global.GameRecipe = {
    describe,
    parseDraft,
    apply,
  };
})(window);
