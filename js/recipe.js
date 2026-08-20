/**
 * Juice recipe helpers.
 * Phase 1: stub only — full editor arrives in Phase 2.
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

  function stubMessage() {
    return "Recipe editor comes in Phase 2. Using the default juice mix for now.";
  }

  global.GameRecipe = {
    describe,
    stubMessage,
  };
})(window);
