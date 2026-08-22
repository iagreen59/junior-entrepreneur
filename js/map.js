/**
 * Cartoon neighborhood map of owned stands / restaurants (Phases 13–17).
 * Shared inventory — map is location display only; active location is highlighted.
 * Phase 16: restaurant mode draws restaurant building(s) instead of stands.
 * Phase 17: up to 4 restaurants on the same slot layout as stands.
 */
(function (global) {
  /** Fixed slots on the cartoon map (max 4 stands / restaurants). */
  const SLOTS = [
    { x: 52, y: 128, labelX: 52, labelY: 178 },
    { x: 168, y: 118, labelX: 168, labelY: 168 },
    { x: 284, y: 128, labelX: 284, labelY: 178 },
    { x: 210, y: 58, labelX: 210, labelY: 28 },
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

    // Soft distant haze band.
    const haze = document.createElementNS(ns, "rect");
    haze.setAttribute("x", "0");
    haze.setAttribute("y", "70");
    haze.setAttribute("width", "340");
    haze.setAttribute("height", "55");
    haze.setAttribute("class", "map-city-haze");
    svg.appendChild(haze);

    const sun = document.createElementNS(ns, "circle");
    sun.setAttribute("cx", "300");
    sun.setAttribute("cy", "34");
    sun.setAttribute("r", "16");
    sun.setAttribute("class", "map-sun");
    svg.appendChild(sun);

    // Far skyline silhouettes.
    const farSkyline = document.createElementNS(ns, "path");
    farSkyline.setAttribute(
      "d",
      "M0 118 L18 118 L18 88 L34 88 L34 70 L48 70 L48 96 L62 96 L62 78 L78 78 L78 108 L96 108 L96 64 L112 64 L112 92 L128 92 L128 74 L146 74 L146 110 L162 110 L162 82 L180 82 L180 58 L198 58 L198 98 L214 98 L214 72 L232 72 L232 90 L250 90 L250 66 L268 66 L268 104 L286 104 L286 80 L304 80 L304 94 L322 94 L322 112 L340 112 L340 130 L0 130 Z"
    );
    farSkyline.setAttribute("class", "map-city-far");
    svg.appendChild(farSkyline);

    // Mid-ground buildings with simple windows.
    const buildings = [
      { x: 8, y: 102, w: 36, h: 58, tone: "a" },
      { x: 48, y: 88, w: 42, h: 72, tone: "b" },
      { x: 96, y: 110, w: 30, h: 50, tone: "c" },
      { x: 132, y: 78, w: 48, h: 82, tone: "a" },
      { x: 186, y: 96, w: 38, h: 64, tone: "b" },
      { x: 230, y: 84, w: 44, h: 76, tone: "c" },
      { x: 280, y: 106, w: 50, h: 54, tone: "a" },
    ];
    for (const b of buildings) {
      const body = document.createElementNS(ns, "rect");
      body.setAttribute("x", String(b.x));
      body.setAttribute("y", String(b.y));
      body.setAttribute("width", String(b.w));
      body.setAttribute("height", String(b.h));
      body.setAttribute("class", "map-city-building map-city-building-" + b.tone);
      svg.appendChild(body);

      const roof = document.createElementNS(ns, "rect");
      roof.setAttribute("x", String(b.x - 2));
      roof.setAttribute("y", String(b.y - 4));
      roof.setAttribute("width", String(b.w + 4));
      roof.setAttribute("height", "5");
      roof.setAttribute("class", "map-city-roof");
      svg.appendChild(roof);

      const cols = Math.max(2, Math.floor(b.w / 12));
      const rows = Math.max(2, Math.floor(b.h / 16));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const win = document.createElementNS(ns, "rect");
          win.setAttribute("x", String(b.x + 5 + col * 10));
          win.setAttribute("y", String(b.y + 8 + row * 14));
          win.setAttribute("width", "5");
          win.setAttribute("height", "7");
          win.setAttribute("class", "map-city-window");
          svg.appendChild(win);
        }
      }
    }

    // Street / sidewalk base.
    const street = document.createElementNS(ns, "rect");
    street.setAttribute("x", "0");
    street.setAttribute("y", "158");
    street.setAttribute("width", "340");
    street.setAttribute("height", "42");
    street.setAttribute("class", "map-city-street");
    svg.appendChild(street);

    const curb = document.createElementNS(ns, "rect");
    curb.setAttribute("x", "0");
    curb.setAttribute("y", "152");
    curb.setAttribute("width", "340");
    curb.setAttribute("height", "8");
    curb.setAttribute("class", "map-city-curb");
    svg.appendChild(curb);

    const lane = document.createElementNS(ns, "path");
    lane.setAttribute("d", "M12 180 H328");
    lane.setAttribute("class", "map-city-lane");
    lane.setAttribute("fill", "none");
    svg.appendChild(lane);
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
