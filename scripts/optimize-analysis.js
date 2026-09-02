/**
 * Optimum recipe + price analysis per item per weather scenario.
 * Mirrors js/recipePreferences.js, js/weather.js, js/economy.js, js/customers.js logic.
 */
const UNIT_PRICES = {
  fruit: 0.5, sugar: 0.25, ice: 0.1, chocolate: 0.4, milk: 0.3,
  whippedCream: 0.25, chocolateSprinkles: 0.15, coldCups: 0.15, hotCups: 0.15,
  bun: 0.35, beefPatty: 0.8, cheese: 0.3, lettuce: 0.15, tomato: 0.2,
  broth: 0.4, noodles: 0.25, carrot: 0.15, celery: 0.15, herbs: 0.2,
};

const PRODUCTS = ["juice", "cocoa", "burger", "soup"];
const WEATHERS = ["steaming", "hot", "mild", "cold", "bitter"];

const PRODUCT_REF_PRICES = { juice: 1.5, cocoa: 2.0, burger: 4.0, soup: 3.5 };
const REF_PRICE = 1.5;
const HAPPY_MULT_BASE = 1.25;
const HIGH_MULT_BASE = 1.6;
const FAVORED_HAPPY_MULT = {
  steaming: { juice: 1.5, burger: 1.3 },
  hot: { juice: 1.35, burger: 1.25 },
  cold: { cocoa: 1.35, soup: 1.3 },
  bitter: { cocoa: 1.75, soup: 1.3 },
};
const FAVORED_DEMAND_REF_BOOST = {
  steaming: { juice: 1.5, burger: 1.1 },
  hot: { juice: 1.2, burger: 1.05 },
  cold: { cocoa: 1.2, soup: 1.1 },
  bitter: { cocoa: 1.75, soup: 1.15 },
};

const BASE_INTEREST = 22;
const ELASTICITY = 1.05;

function favorsProduct(weather, product) {
  if (weather === "steaming" || weather === "hot") {
    return product === "juice" || product === "burger" ? true : false;
  }
  if (weather === "bitter" || weather === "cold") {
    return product === "cocoa" || product === "soup" ? true : false;
  }
  return null;
}

function favoredPriceMults(weather, product) {
  const favor = favorsProduct(weather, product);
  if (favor !== true) {
    return { happyMult: HAPPY_MULT_BASE, demandRefBoost: 1 };
  }
  const happyMap = FAVORED_HAPPY_MULT[weather] || {};
  const demandMap = FAVORED_DEMAND_REF_BOOST[weather] || {};
  return {
    happyMult: happyMap[product] != null ? happyMap[product] : HAPPY_MULT_BASE,
    demandRefBoost: demandMap[product] != null ? demandMap[product] : 1,
  };
}

function happyPriceMax(weather, product) {
  const ref = PRODUCT_REF_PRICES[product] || REF_PRICE;
  return +(ref * favoredPriceMults(weather, product).happyMult).toFixed(2);
}

function demandRefPrice(weather, product) {
  const ref = PRODUCT_REF_PRICES[product] || REF_PRICE;
  return +(ref * favoredPriceMults(weather, product).demandRefBoost).toFixed(3);
}

function preferenceFactor(weather, product) {
  const favor = favorsProduct(weather, product);
  if (favor === true) {
    if (weather === "steaming" || weather === "bitter") return 1.5;
    return 1.35;
  }
  if (favor === false) {
    if (weather === "steaming" || weather === "bitter") return 0.5;
    return 0.65;
  }
  return 1.0;
}

function idealTasteRecipe(product, weather) {
  if (product === "juice") {
    return {
      fruit: weather === "mild" ? 2 : 1,
      sugar: 1,
      ice: weather === "steaming" ? 3 : weather === "hot" ? 2 : 1,
    };
  }
  if (product === "cocoa") {
    return {
      chocolate: weather === "bitter" ? 3 : 2,
      milk: 1,
      whippedCream: weather === "bitter" ? 2 : 1,
      chocolateSprinkles: weather === "bitter" || weather === "cold" ? 2 : 1,
    };
  }
  if (product === "burger") return { beefPatty: 1, lettuce: 1, tomato: 1, cheese: 1 };
  if (product === "soup") {
    return {
      broth: weather === "bitter" || weather === "cold" ? 2 : 1,
      noodles: weather === "bitter" || weather === "cold" ? 2 : 1,
      carrot: 1, celery: 1, herbs: 1,
    };
  }
  return {};
}

function fullIdealRecipe(product, weather) {
  const taste = idealTasteRecipe(product, weather);
  if (product === "juice") return { ...taste, coldCups: 1 };
  if (product === "cocoa") return { ...taste, hotCups: 1 };
  if (product === "burger") return { bun: 1, ...taste };
  return { ...taste };
}

function costOfGoods(recipe) {
  let total = 0;
  for (const [key, qty] of Object.entries(recipe)) {
    total += (Number(qty) || 0) * (UNIT_PRICES[key] || 0);
  }
  return +total.toFixed(2);
}

function demandForPrice(price, weather, product) {
  const preference = preferenceFactor(weather, product);
  const taste = 1.18;
  const ref = demandRefPrice(weather, product);
  if (!Number.isFinite(price) || price <= 0) {
    return Math.floor(BASE_INTEREST * 4 * preference * taste);
  }
  return Math.max(0, Math.floor(BASE_INTEREST * Math.pow(ref / price, ELASTICITY) * preference * taste));
}

console.log("Margin parity check — favored items at happy max price, ideal recipe:\n");
for (const [weather, product] of [
  ["steaming", "juice"],
  ["bitter", "cocoa"],
  ["cold", "soup"],
  ["hot", "burger"],
]) {
  const recipe = fullIdealRecipe(product, weather);
  const cogs = costOfGoods(recipe);
  const price = happyPriceMax(weather, product);
  const demand = demandForPrice(price, weather, product);
  const margin = +(price - cogs).toFixed(2);
  const gross = +(demand * margin).toFixed(2);
  console.log(
    `${weather} ${product}: price $${price}, COGS $${cogs}, margin $${margin}, demand ${demand}, gross $${gross}`
  );
}
