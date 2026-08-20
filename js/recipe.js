/**
 * Juice recipe helpers + validation.
 * Phase 2: edit fruit / sugar / ice / cups (units per cup).
 */
(function (global) {
  function describe(recipe) {
    if (!recipe) return "No recipe set yet.";
    return (
      "Per cup: " +
      recipe.fruit +
      " fruit, " +
      recipe.sugar +
      " sugar, " +
      recipe.ice +
      " ice, " +
      recipe.cups +
      " cup."
    );
  }

  /**
   * Normalize recipe draft from form inputs.
   * Returns { ok: true, recipe } or { ok: false, message }.
   */
  function parseDraft(raw) {
    const recipe = {};
    for (const key of global.GameState.INVENTORY_KEYS) {
      const value = Number(raw && raw[key]);
      if (!Number.isFinite(value) || value < 0) {
        return {
          ok: false,
          message: "Recipe amounts must be zero or greater.",
        };
      }
      // Keep whole units for inventory math later (Phase 3).
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
    const parsed = parseDraft(draft);
    if (!parsed.ok) return parsed;
    state.recipe = parsed.recipe;
    return {
      ok: true,
      recipe: parsed.recipe,
      message: "Recipe saved. " + describe(parsed.recipe),
    };
  }

  global.GameRecipe = {
    describe,
    parseDraft,
    apply,
  };
})(window);
