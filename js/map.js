/**
 * Cartoon neighborhood map of owned stands / restaurants (Phases 13–17).
 * Shared inventory — map is location display only; active location is highlighted.
 * Phase 16: restaurant mode draws restaurant building(s) instead of stands.
 * Phase 17: up to 4 restaurants on the same slot layout as stands.
 */
(function (global) {
  /** Fixed slots on the cartoon map (max 4 stands / restaurants). */
  const SLOTS = [
    { x: 52, y: 118, labelX: 52, labelY: 178 },
    { x: 168, y: 98, labelX: 168, labelY: 158 },
    { x: 284, y: 118, labelX: 284, labelY: 178 },
    { x: 210, y: 48, labelX: 210, labelY: 28 },
  ];

  function standBoothSvg(ns, x, y, active) {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "map-booth" + (active ? " is-active" : ""));
    g.setAttribute("transform", "translate(" + x + " " + y + ")");

    const roof = document.createElementNS(ns, "path");
    roof.setAttribute("d", "M-28 -8 L0 -28 L28 -8 Z");
    roof.setAttribute("class", "map-booth-roof");
    g.appendChild(roof);

    const body = document.createElementNS(ns, "rect");
    body.setAttribute("x", "-22");
    body.setAttribute("y", "-8");
    body.setAttribute("width", "44");
    body.setAttribute("height", "36");
    body.setAttribute("rx", "4");
    body.setAttribute("class", "map-booth-body");
    g.appendChild(body);

    const window = document.createElementNS(ns, "rect");
    window.setAttribute("x", "-14");
    window.setAttribute("y", "2");
    window.setAttribute("width", "28");
    window.setAttribute("height", "14");
    window.setAttribute("rx", "2");
    window.setAttribute("class", "map-booth-window");
    g.appendChild(window);

    const legL = document.createElementNS(ns, "rect");
    legL.setAttribute("x", "-18");
    legL.setAttribute("y", "28");
    legL.setAttribute("width", "6");
    legL.setAttribute("height", "10");
    legL.setAttribute("class", "map-booth-leg");
    g.appendChild(legL);
    const legR = document.createElementNS(ns, "rect");
    legR.setAttribute("x", "12");
    legR.setAttribute("y", "28");
    legR.setAttribute("width", "6");
    legR.setAttribute("height", "10");
    legR.setAttribute("class", "map-booth-leg");
    g.appendChild(legR);

    if (active) {
      const ring = document.createElementNS(ns, "circle");
      ring.setAttribute("cx", "0");
      ring.setAttribute("cy", "8");
      ring.setAttribute("r", "34");
      ring.setAttribute("class", "map-booth-ring");
      g.insertBefore(ring, g.firstChild);
    }

    return g;
  }

  function emptySlotSvg(ns, x, y) {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "map-slot-empty");
    g.setAttribute("transform", "translate(" + x + " " + y + ")");

    const pad = document.createElementNS(ns, "ellipse");
    pad.setAttribute("cx", "0");
    pad.setAttribute("cy", "20");
    pad.setAttribute("rx", "26");
    pad.setAttribute("ry", "10");
    pad.setAttribute("class", "map-slot-pad");
    g.appendChild(pad);

    const mark = document.createElementNS(ns, "text");
    mark.setAttribute("x", "0");
    mark.setAttribute("y", "8");
    mark.setAttribute("text-anchor", "middle");
    mark.setAttribute("class", "map-slot-mark");
    mark.textContent = "?";
    g.appendChild(mark);

    return g;
  }

  /** Compact storefront for multi-restaurant map slots (Phase 17). */
  function restaurantBoothSvg(ns, x, y, restaurant, active) {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "map-restaurant" + (active ? " is-active" : ""));
    g.setAttribute("transform", "translate(" + x + " " + y + ")");

    if (active) {
      const ring = document.createElementNS(ns, "circle");
      ring.setAttribute("cx", "0");
      ring.setAttribute("cy", "8");
      ring.setAttribute("r", "38");
      ring.setAttribute("class", "map-booth-ring");
      g.appendChild(ring);
    }

    const roof = document.createElementNS(ns, "path");
    roof.setAttribute("d", "M-30 -6 L0 -30 L30 -6 Z");
    roof.setAttribute("class", "map-restaurant-roof");
    g.appendChild(roof);

    const body = document.createElementNS(ns, "rect");
    body.setAttribute("x", "-24");
    body.setAttribute("y", "-6");
    body.setAttribute("width", "48");
    body.setAttribute("height", "34");
    body.setAttribute("rx", "3");
    body.setAttribute("class", "map-restaurant-body");
    g.appendChild(body);

    const door = document.createElementNS(ns, "rect");
    door.setAttribute("x", "-5");
    door.setAttribute("y", "12");
    door.setAttribute("width", "10");
    door.setAttribute("height", "16");
    door.setAttribute("class", "map-restaurant-door");
    g.appendChild(door);

    const winL = document.createElementNS(ns, "rect");
    winL.setAttribute("x", "-18");
    winL.setAttribute("y", "2");
    winL.setAttribute("width", "10");
    winL.setAttribute("height", "10");
    winL.setAttribute("rx", "1");
    winL.setAttribute("class", "map-restaurant-window");
    g.appendChild(winL);

    const winR = document.createElementNS(ns, "rect");
    winR.setAttribute("x", "8");
    winR.setAttribute("y", "2");
    winR.setAttribute("width", "10");
    winR.setAttribute("height", "10");
    winR.setAttribute("rx", "1");
    winR.setAttribute("class", "map-restaurant-window");
    g.appendChild(winR);

    const sign = document.createElementNS(ns, "rect");
    sign.setAttribute("x", "-14");
    sign.setAttribute("y", "-2");
    sign.setAttribute("width", "28");
    sign.setAttribute("height", "9");
    sign.setAttribute("rx", "1");
    sign.setAttribute("class", "map-restaurant-sign");
    g.appendChild(sign);

    const signText = document.createElementNS(ns, "text");
    signText.setAttribute("x", "0");
    signText.setAttribute("y", "5");
    signText.setAttribute("text-anchor", "middle");
    signText.setAttribute("class", "map-restaurant-sign-text");
    const staff = restaurant ? Number(restaurant.employeeCount) || 0 : 0;
    signText.textContent = staff > 0 ? "EAT·" + staff : "EAT";
    g.appendChild(signText);

    return g;
  }

  function drawBackground(ns, svg) {
    const sky = document.createElementNS(ns, "rect");
    sky.setAttribute("width", "340");
    sky.setAttribute("height", "200");
    sky.setAttribute("class", "map-sky");
    svg.appendChild(sky);

    const hill = document.createElementNS(ns, "path");
    hill.setAttribute(
      "d",
      "M0 130 Q60 100 120 120 T240 110 T340 125 L340 200 L0 200 Z"
    );
    hill.setAttribute("class", "map-hill");
    svg.appendChild(hill);

    const road = document.createElementNS(ns, "path");
    road.setAttribute("d", "M20 170 Q100 150 170 155 T320 165");
    road.setAttribute("class", "map-road");
    road.setAttribute("fill", "none");
    svg.appendChild(road);

    const sun = document.createElementNS(ns, "circle");
    sun.setAttribute("cx", "300");
    sun.setAttribute("cy", "36");
    sun.setAttribute("r", "18");
    sun.setAttribute("class", "map-sun");
    svg.appendChild(sun);

    const treeTrunk = document.createElementNS(ns, "rect");
    treeTrunk.setAttribute("x", "28");
    treeTrunk.setAttribute("y", "88");
    treeTrunk.setAttribute("width", "8");
    treeTrunk.setAttribute("height", "28");
    treeTrunk.setAttribute("class", "map-tree-trunk");
    svg.appendChild(treeTrunk);
    const treeTop = document.createElementNS(ns, "circle");
    treeTop.setAttribute("cx", "32");
    treeTop.setAttribute("cy", "78");
    treeTop.setAttribute("r", "18");
    treeTop.setAttribute("class", "map-tree-top");
    svg.appendChild(treeTop);
  }

  function render(state) {
    const host = document.getElementById("stand-map");
    if (!host) return;

    const ns = "http://www.w3.org/2000/svg";
    const isRestaurant =
      global.GameState &&
      typeof global.GameState.isRestaurantMode === "function" &&
      global.GameState.isRestaurantMode(state);
    const restaurants =
      isRestaurant && Array.isArray(state && state.restaurants)
        ? state.restaurants
        : [];
    const activeRestaurantId = state && state.activeRestaurantId;
    const stands = Array.isArray(state && state.stands) ? state.stands : [];
    const activeId = state && state.activeStandId;
    const max =
      (global.GameState &&
        (isRestaurant
          ? global.GameState.MAX_RESTAURANTS
          : global.GameState.MAX_STANDS)) ||
      SLOTS.length;

    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 340 200");
    svg.setAttribute("class", "stand-map-svg");
    svg.setAttribute("role", "img");

    if (isRestaurant && restaurants.length > 0) {
      svg.setAttribute(
        "aria-label",
        "Neighborhood map showing " +
          restaurants.length +
          " restaurant" +
          (restaurants.length === 1 ? "" : "s")
      );
      drawBackground(ns, svg);

      for (let i = 0; i < max && i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const restaurant = restaurants[i];
        if (restaurant) {
          const active = restaurant.id === activeRestaurantId;
          svg.appendChild(
            restaurantBoothSvg(ns, slot.x, slot.y, restaurant, active)
          );
          const label = document.createElementNS(ns, "text");
          label.setAttribute("x", String(slot.labelX));
          label.setAttribute("y", String(slot.labelY));
          label.setAttribute("text-anchor", "middle");
          label.setAttribute(
            "class",
            "map-restaurant-label" + (active ? " is-active" : "")
          );
          const n = Number(restaurant.employeeCount) || 0;
          label.textContent =
            restaurant.name +
            (active ? " ★" : "") +
            " · " +
            n +
            " staff";
          svg.appendChild(label);
        } else {
          svg.appendChild(emptySlotSvg(ns, slot.x, slot.y));
        }
      }

      const caption = document.createElementNS(ns, "text");
      caption.setAttribute("x", "170");
      caption.setAttribute("y", "196");
      caption.setAttribute("text-anchor", "middle");
      caption.setAttribute("class", "map-caption");
      caption.textContent =
        restaurants.length +
        " of " +
        max +
        " restaurants · shared supply bag";
      svg.appendChild(caption);
    } else {
      svg.setAttribute(
        "aria-label",
        stands.length === 0
          ? "Neighborhood map with no stands yet"
          : "Neighborhood map showing " +
              stands.length +
              " owned stand" +
              (stands.length === 1 ? "" : "s")
      );
      drawBackground(ns, svg);

      for (let i = 0; i < max && i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const stand = stands[i];
        if (stand) {
          const active = stand.id === activeId;
          svg.appendChild(standBoothSvg(ns, slot.x, slot.y, active));
          const label = document.createElementNS(ns, "text");
          label.setAttribute("x", String(slot.labelX));
          label.setAttribute("y", String(slot.labelY));
          label.setAttribute("text-anchor", "middle");
          label.setAttribute(
            "class",
            "map-booth-label" + (active ? " is-active" : "")
          );
          label.textContent = stand.name + (active ? " ★" : "");
          svg.appendChild(label);
        } else {
          svg.appendChild(emptySlotSvg(ns, slot.x, slot.y));
        }
      }

      const caption = document.createElementNS(ns, "text");
      caption.setAttribute("x", "170");
      caption.setAttribute("y", "196");
      caption.setAttribute("text-anchor", "middle");
      caption.setAttribute("class", "map-caption");
      if (stands.length === 0) {
        caption.textContent = "Buy a stand to appear on the map";
      } else {
        caption.textContent =
          stands.length + " of " + max + " stands · shared supply bag";
      }
      svg.appendChild(caption);
    }

    host.innerHTML = "";
    host.appendChild(svg);
  }

  global.GameMap = {
    render,
    SLOTS,
  };
})(window);
