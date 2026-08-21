/**
 * Product recipe helpers + validation.
 * Phase 6: juice (fruit/sugar/ice/cups) and cocoa
 * (chocolate/milk/whippedCream/chocolateSprinkles/cups) recipes.
 */
(function (global) {
  function describe(product, recipe) {
    if (!recipe) return "No recipe set yet.";
    const keys = global.GameState.recipeKeysFor(product);
    const labels = global.GameState.inventoryLabels();
    const parts = keys.map(function (key) {
      return recipe[key] + " " + labels[key].toLowerCase();
    });
    return (
      "Per cup of " +
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

    if (recipe.cups < 1) {
      return {
        ok: false,
        message: "Each drink needs at least 1 cup.",
      };
    }

    return { ok: true, recipe };
  }

  function apply(state, draft) {
    const product = state.activeProduct === "cocoa" ? "cocoa" : "juice";
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
