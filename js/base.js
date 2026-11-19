/* ===== Base view: 64x64 tiles, 45° rotated camera (isometric-style), pan/zoom ===== */

const BaseView = (() => {
  const TILE = 18;        // tile edge in px at zoom 1
  const Y_SCALE = 0.5;   // vertical compression (60-degree tilt)
  let canvas, ctx;
  let cam = { x: 0, y: 0, zoom: 1 };
  let camInit = false;
  let dragging = false, dragMoved = false, lastPt = null, downPt = null;
  let hover = null;        // hovered tile {x, y}
  let placing = null;      // { type } — building awaiting placement
  let selected = null;    // selected building object
  let pinch = null;       // two-finger pinch state

  function init() {
    canvas = document.getElementById("base-canvas");
    ctx = canvas.getContext("2d");
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("contextmenu", onCancelPlace);
    window.addEventListener("keydown", e => {
      if (e.key === "Escape" && placing) onCancelPlace(e);
    });
    window.addEventListener("resize", resize);
    resize();
    addGarrisonButton();
    // smooth 30fps loop, only while base view is visible (phone friendly)
    startAnimLoop();
  }

  function onCancelPlace(e) {
    if (e) e.preventDefault();
    if (placing) {
      toast("❌ Placement cancelled.");
      placing = null;
      draw();
    }
  }

  let rafLast = 0;
  function startAnimLoop() {
    const loop = (ts) => {
      requestAnimationFrame(loop);
      if (ts - rafLast < 33) return;   // ~30 fps
      rafLast = ts;
      const baseView = document.getElementById("base-view");
      if (baseView.classList.contains("active")) draw();
    };
    requestAnimationFrame(loop);
  }

  /* Garrison button in the base HUD: lists all units stationed here */
  function addGarrisonButton() {
    const hud = document.getElementById("base-hud");
    const btn = document.createElement("button");
    btn.className = "action primary";
    btn.textContent = "🪖 Garrison";
    btn.onclick = showGarrisonModal;
    btn.style.marginLeft = "auto";
    hud.appendChild(btn);
  }

  function showGarrisonModal() {
    const b = base();
    document.getElementById("building-name").textContent = `🪖 Garrison — ${b.name}`;
    document.getElementById("building-desc").textContent = "Units stationed at this base. They defend automatically and can be dispatched to battle from the World Map.";
    const stats = document.getElementById("building-stats");
    const entries = Object.entries(b.army).filter(([, c]) => c > 0);
    if (!entries.length && (!b.training || !b.training.length)) {
      stats.innerHTML = "<div>No units stationed here. Train some in the Barracks, Factory, Heavy Factory, Airfield or Harbor.</div>";
    } else {
      stats.innerHTML = "";
      entries.forEach(([k, c]) => {
        const u = UNITS[k];
        const dmg = Object.entries(u.dmg || {}).map(([t, d]) => `${t}: ${d}`).join(", ") || "support";
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px dashed #2a3f55;";
        row.appendChild(iconCanvas(k));
        const txt = document.createElement("div");
        txt.innerHTML = `<b>${u.name}</b> ×${c} — HP ${u.hp}, dmg ${dmg}, speed ${u.speed}/h${u.stealth ? " | 🥷 stealth" : ""}`;
        row.appendChild(txt);
        stats.appendChild(row);
      });
      const tr = (b.training || []).map(t2 =>
        `<div style="opacity:0.7">⏳ ${UNITS[t2.unit].name} ×${t2.count} training…</div>`).join("");
      stats.innerHTML += tr;
    }
    const actions = document.getElementById("building-actions");
    actions.innerHTML = "";
    openModal("building-modal");
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (!camInit) { centerCamera(); camInit = true; }
    draw();
  }

  function centerCamera() {
    const c = Game.BASE_SIZE / 2;
    cam.zoom = Math.max(0.25, Math.min(1, canvas.width / (Game.BASE_SIZE * TILE * 1.1)));
    const p = proj(c, c);
    cam.x += canvas.width / 2 - p.x;
    cam.y += canvas.height / 2 - p.y;
  }

  /* ---------- projection: world rotated 45 degrees, viewed tilted ---------- */
  function k() { return TILE * cam.zoom / 2; }

  function proj(tx, ty) {
    const kk = k();
    return {
      x: cam.x + (tx - ty) * kk,
      y: cam.y + (tx + ty) * kk * Y_SCALE,
    };
  }
  function unproj(sx, sy) {
    const kk = k();
    const u = (sx - cam.x) / kk;
    const v = (sy - cam.y) / (kk * Y_SCALE);
    return { x: (v + u) / 2, y: (v - u) / 2 };
  }

  function base() { return Game.state().bases[Game.state().activeBase]; }

  /* ---------- mouse interaction ---------- */
  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    downPt = lastPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging = true;
    dragMoved = false;
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (dragging && lastPt) {
      const dx = mx - lastPt.x, dy = my - lastPt.y;
      if (Math.abs(mx - downPt.x) + Math.abs(my - downPt.y) > 5) dragMoved = true;
      if (dragMoved) {
        cam.x += dx;
        cam.y += dy;
      }
      lastPt = { x: mx, y: my };
    }
    const w = unproj(mx, my);
    hover = { x: Math.floor(w.x), y: Math.floor(w.y) };
    draw();
  }

  function onUp(e) {
    if (dragging && !dragMoved) {
      const rect = canvas.getBoundingClientRect();
      onClick(e.clientX - rect.left, e.clientY - rect.top);
    }
    dragging = false;
    lastPt = null;
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    zoomAt(mx, my, e.deltaY < 0 ? 1.15 : 0.87);
    const w = unproj(mx, my);
    hover = { x: Math.floor(w.x), y: Math.floor(w.y) };
    draw();
  }

  function zoomAt(sx, sy, factor) {
    const before = unproj(sx, sy);
    cam.zoom = Math.max(0.25, Math.min(2.5, cam.zoom * factor));
    // keep the world point under the cursor fixed while zooming
    const fix = proj(before.x, before.y);
    cam.x += (sx - fix.x);
    cam.y += (sy - fix.y);
  }

  /* ---------- touch interaction (pan + pinch + tap) ---------- */
  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      downPt = lastPt = { x: t.clientX, y: t.clientY };
      dragging = true; dragMoved = false;
    } else if (e.touches.length === 2) {
      dragging = false;
      pinch = {
        dist: touchDist(e.touches),
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }
  function touchDist(ts) {
    const dx = ts[0].clientX - ts[1].clientX, dy = ts[0].clientY - ts[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && dragging && lastPt) {
      const t = e.touches[0];
      const mx = t.clientX, my = t.clientY;
      if (Math.abs(mx - downPt.x) + Math.abs(my - downPt.y) > 8) dragMoved = true;
      if (dragMoved) { cam.x += mx - lastPt.x; cam.y += my - lastPt.y; }
      lastPt = { x: mx, y: my };
      draw();
    } else if (e.touches.length === 2 && pinch) {
      const rect = canvas.getBoundingClientRect();
      const d = touchDist(e.touches);
      const factor = d / pinch.dist;
      zoomAt(pinch.cx - rect.left, pinch.cy - rect.top, factor);
      pinch.dist = d;
      draw();
    }
  }
  function onTouchEnd(e) {
    if (dragging && !dragMoved) {
      const rect = canvas.getBoundingClientRect();
      onClick(downPt.x - rect.left, downPt.y - rect.top);
    }
    if (e.touches.length === 0) { dragging = false; pinch = null; }
  }

  /* ---------- click (tile select / placement) ---------- */
  function onClick(mx, my) {
    const w = unproj(mx, my);
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    const b = base();

    if (placing) {
      const def = BUILDINGS[placing.type];
      const x = tx - Math.floor((def.size.w - 1) / 2);
      const y = ty - Math.floor((def.size.h - 1) / 2);
      if (Game.startBuild(Game.state().activeBase, placing.type, x, y)) placing = null;
      draw();
      return;
    }

    if (tx < 0 || ty < 0 || tx >= Game.BASE_SIZE || ty >= Game.BASE_SIZE) return;
    const bld = Game.buildingAt(b, tx, ty);
    selected = bld;
    if (bld) showBuildingModal(bld);
    else showBuildMenu(tx, ty);
    draw();
  }

  /* ---------- building modal ---------- */
  function showBuildingModal(bld) {
    const b = base();
    const def = BUILDINGS[bld.type];
    document.getElementById("building-name").textContent = `${def.icon} ${def.name} — Level ${bld.level}`;
    document.getElementById("building-desc").textContent = def.desc;

    const t = Game.now();
    const stats = [];
    if (def.produces) {
      for (const [r, amt] of Object.entries(def.produces)) {
        stats.push(`Produces <b>${amt * bld.level}</b> ${r}/hour`);
      }
    }
    if (bld.upgradeEndsAt && bld.upgradeEndsAt > t) {
      stats.push(`⏳ Upgrading to ${bld.upgradeTo} — finishes in ${fmtRemaining(bld.upgradeEndsAt - t)}`);
    } else {
      stats.push(`Status: <b>Operational</b>`);
    }
    stats.push(`Max level: ${def.maxLevel}`);
    if (bld.type === "command_center") {
      stats.push(`👷 Construction teams: <b>${bld.level}</b> (one per Command Center level)`);
    }    
    document.getElementById("building-stats").innerHTML = stats.map(s => `<div>${s}</div>`).join("");

    const actions = document.getElementById("building-actions");
    actions.innerHTML = "";
    if (!bld.upgradeEndsAt || bld.upgradeEndsAt <= t) {
      if (bld.type === "market") {
        const btn = document.createElement("button");
        btn.className = "action primary";
        btn.textContent = "🌍 Open Market";
        btn.onclick = () => { closeModal("building-modal"); Market.open(); };
        actions.appendChild(btn);
      }
      if (["barracks", "factory", "heavy_factory", "airfield", "harbor"].includes(bld.type)) {
        const btn = document.createElement("button");
        btn.className = "action primary";
        btn.textContent = "🎖️ Train / Build Units";
        btn.onclick = () => { closeModal("building-modal"); showTrainModal(bld.type); };
        actions.appendChild(btn);
      }
      if (bld.level < def.maxLevel) {
        const cost = Game.buildingCost(bld.type, bld.level + 1);
        const costStr = Object.entries(cost).map(([r, a]) => `${a} ${r}`).join(", ");
        const btn = document.createElement("button");
        btn.className = "action";
        btn.textContent = `⬆️ Upgrade to ${bld.level + 1} (${costStr})`;
        btn.onclick = () => { Game.upgradeBuild(Game.state().activeBase, bld.x, bld.y); closeModal("building-modal"); };
        actions.appendChild(btn);
      }
    }
    openModal("building-modal");
  }

  function showBuildMenu(tx, ty) {
    const b = base();
    const cc = Game.ccOf(b);
    document.getElementById("building-name").textContent = "🏗️ Construct Building";
    document.getElementById("building-desc").textContent = `Choose a building, then click where to place it. Right-click or ESC cancels. Command Center level ${cc} allows buildings up to level ${cc + 1}.`;
    document.getElementById("building-stats").innerHTML = "";
    const actions = document.getElementById("building-actions");
    actions.innerHTML = "";
    Object.entries(BUILDINGS).forEach(([type, def]) => {
      if (def.unique && b.buildings.some(x => x.type === type)) return;
      const cost = Game.buildingCost(type, 1);
      const costStr = Object.entries(cost).map(([r, a]) => `${a} ${r}`).join(", ");
      const btn = document.createElement("button");
      btn.className = "action";
      btn.innerHTML = `${def.icon} ${def.name} <small>(${def.size.w}×${def.size.h})</small><br><small>${costStr} — ${def.buildTime}s</small>`;
      btn.onclick = () => {
        placing = { type };
        closeModal("building-modal");
        toast("📍 Click a location to place. ESC or right-click cancels.");
        draw();
      };
      actions.appendChild(btn);
    });
    openModal("building-modal");
  }

  /* ---------- training modal ---------- */
  function showTrainModal(bldType) {
    const b = base();
    const buildingClasses = {
      barracks: ["infantry"],
      factory: ["ground_veh"],
      heavy_factory: ["ground_veh"],
      airfield: ["jet", "bomber", "heli", "transport_heli"],
      harbor: ["ship", "submarine", "carrier", "transport_ship"],
    };
    const classes = buildingClasses[bldType] || [];
    document.getElementById("building-name").textContent = `🎖️ Train Units — ${BUILDINGS[bldType].name}`;
    document.getElementById("building-desc").textContent = "Your garrison defends the base automatically. Damage types: inf (infantry), gveh (ground vehicles), air (jets/bombers/helis), sea (ships), sub (submarines).";
    const stats = document.getElementById("building-stats");
    stats.innerHTML = "";
    Object.entries(UNITS).forEach(([key, u]) => {
      if (!classes.includes(u.cls)) return;
      if (bldType === "heavy_factory" && u.price < 3000) return;
      if (bldType === "factory" && u.price >= 3000) return;
      const dmgDesc = Object.entries(u.dmg || {}).map(([t, d]) => `${t}: ${d}`).join(", ") || "—";
      const stealthTag = u.stealth ? " | 🥷 stealth" : "";
      const transportTag = u.capacity ? ` | carries ${u.capacity}` : u.jetCapacity ? ` | ${u.jetCapacity} jets + 10 helis` : "";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:flex-start;";
      row.appendChild(iconCanvas(key));
      const reqStr = Object.entries(u.requires).map(([t, l]) => `${BUILDINGS[t].name} lvl ${l}`).join(", ");
      const txt = document.createElement("div");
      txt.innerHTML = `<b>${u.name}</b> — HP ${u.hp}, dmg ${dmgDesc}, speed ${u.speed}/h — ${u.price} gold${stealthTag}${transportTag} <small>(${reqStr})</small> — <span id="train-count-${key}">0</span> owned`;
      row.appendChild(txt);
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;align-items:center;margin:4px 0 8px 0;";
      const minus = mkBtn("−", () => adjustTrain(key, -1));
      const plus = mkBtn("+1", () => adjustTrain(key, 1));
      const plus5 = mkBtn("+5", () => adjustTrain(key, 5));
      const trainBtn = mkBtn(`Train`, () => {
        const n = trainCounts[key] || 0;
        if (n > 0) { Game.trainUnits(Game.state().activeBase, key, n); trainCounts[key] = 0; }
        closeModal("building-modal");
      });
      controls.append(minus, plus, plus5, document.createTextNode(" "), trainBtn);
      row.appendChild(controls);
      stats.appendChild(row);
    });
    document.getElementById("building-actions").innerHTML = "";
    openModal("building-modal");
  }

  const trainCounts = {};
  function adjustTrain(key, d) {
    const b = base();
    trainCounts[key] = Math.max(0, (trainCounts[key] || 0) + d);
    const el = document.getElementById("train-count-" + key);
    if (el) el.textContent = `${trainCounts[key]} (+${b.army[key] || 0} in base)`;
  }
    function mkBtn(label, fn) {
    const btn = document.createElement("button");
    btn.className = "action";
    btn.textContent = label;
    btn.onclick = fn;
    return btn;
  }

  /* small canvas showing a unit's vector icon — used in menus */
  function iconCanvas(unitKey) {
    const cv = document.createElement("canvas");
    cv.width = 44; cv.height = 44;
    cv.style.cssText = "flex:0 0 44px;background:rgba(255,255,255,0.05);border:1px solid #2e4a66;border-radius:6px;";
    const c2 = cv.getContext("2d");
    Icons.drawUnitByKey(c2, unitKey, 22, 22, 32, -Math.PI * 0.75, "#cfd8dc", "#1c2a3a");
    return cv;
  }

  /* ---------- drawing helpers ---------- */
  /* how many stacked floors each building shows */
  const STORIES = {
    command_center: 2, barracks: 2, market: 2, comms_tower: 3,
    factory: 2, heavy_factory: 1, oil_rig: 1, steel_mill: 2, gold_mine: 1,
    airfield: 1, harbor: 1, radar_station: 1,
  };

  /* deterministic hash so grass doesn't flicker between frames */
  function tileHash(x, y) {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >> 13)) * 1274126177 | 0;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

    /* pixel-art grass texture: small offscreen canvas, 1 pixel = 1 tile */
  let grassTexture = null;
  function ensureGrassTexture(N) {
    if (grassTexture) return;
    const cv = document.createElement("canvas");
    cv.width = N; cv.height = N;
    const g = cv.getContext("2d");
    // dithered green palette (base / dark / light / clump / dry)
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const h1 = tileHash(x, y);
        let c;
        if (h1 < 0.06) c = "#245c26";        // dark clump
        else if (h1 < 0.22) c = "#35703a";   // darker green speckle
        else if (h1 < 0.70) c = "#3e7a3e";   // base green
        else if (h1 < 0.90) c = "#4a8a48";   // lighter green speckle
        else if (h1 < 0.97) c = "#69924a";   // sunlit patch
        else c = "#8aa050";                  // rare dry spot
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    }
    grassTexture = cv;
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
    const b2 = Math.max(0, Math.min(255, (n & 255) * f));
    return `rgb(${r | 0},${g | 0},${b2 | 0})`;
  }

  function boxCorners(bld, def) {
    const x = bld.x, y = bld.y, w = def.size.w, h = def.size.h;
    const hpx = def.height * TILE * cam.zoom;
    const base = [proj(x, y), proj(x + w, y), proj(x + w, y + h), proj(x, y + h)];
    const top = base.map(p => ({ x: p.x, y: p.y - hpx }));
    return { base, top, hpx };
  }

  function roundRectBase(x, y, w2, h2, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w2, y, x + w2, y + h2, r);
    ctx.arcTo(x + w2, y + h2, x, y + h2, r);
    ctx.arcTo(x, y + h2, x, y, r);
    ctx.arcTo(x, y, x + w2, y, r);
    ctx.closePath();
  }

  function poly(pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!ctx) return;
    const st = Game.state();
    const b = st.bases[st.activeBase];
    if (!b) return;
    const w = canvas.width, h = canvas.height;
    const N = Game.BASE_SIZE;

    // ocean everywhere
    ctx.fillStyle = "#2a6ea0";
    ctx.fillRect(0, 0, w, h);

    // island: the rotated square is a diamond on screen
    const c0 = proj(0, 0), c1 = proj(N, 0), c2 = proj(N, N), c3 = proj(0, N);
    poly([c0, c1, c2, c3], "#3e7a3e", "#c2a878");
    ctx.lineWidth = 3;
    poly([c0, c1, c2, c3], null, "#c2a878");
    ctx.lineWidth = 1;

       // pixel-art grass: pre-rendered low-res texture, 1 chunky pixel per tile,
    // blitted through the isometric transform with smoothing off (crisp pixels)
    ensureGrassTexture(N);
    ctx.save();
    const kk0 = k();
    ctx.transform(kk0, kk0 * Y_SCALE, -kk0, kk0 * Y_SCALE, cam.x, cam.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grassTexture, 0, 0, N, N);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    
    // tile grid: lines along both axes
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    const lo = -4, hi = N + 4;
    for (let i = 0; i <= N; i++) {
      const a = proj(i, lo), bb = proj(i, hi);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
      const c = proj(lo, i), d = proj(hi, i);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }

    // buildings, painter's order: back to front
    const sorted = [...b.buildings].sort((a, c) => {
      const ad = BUILDINGS[a.type], cd = BUILDINGS[c.type];
      return (a.x + a.y + (ad.size.w + ad.size.h) / 2) - (c.x + c.y + (cd.size.w + cd.size.h) / 2);
    });
    sorted.forEach(bld => drawBuilding(bld, BUILDINGS[bld.type]));

    // hovered tile highlight
    if (hover && hover.x >= 0 && hover.y >= 0 && hover.x < N && hover.y < N) {
      const t0 = proj(hover.x, hover.y), t1 = proj(hover.x + 1, hover.y),
            t2 = proj(hover.x + 1, hover.y + 1), t3 = proj(hover.x, hover.y + 1);
      poly([t0, t1, t2, t3], null, "rgba(255,255,255,0.35)");
    }

    // placement ghost
    if (placing && hover) {
      const def = BUILDINGS[placing.type];
      const gx = hover.x - Math.floor((def.size.w - 1) / 2);
      const gy = hover.y - Math.floor((def.size.h - 1) / 2);
      const valid = Game.canPlace(b, placing.type, gx, gy) && canAfford(def);
      const ghost = { type: placing.type, x: gx, y: gy };
      drawGhost(ghost, def, valid);
    }

    // selected building outline
    if (selected) {
      const def = BUILDINGS[selected.type];
      const { base: bs, top } = boxCorners(selected, def);
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      poly(top, null, "#ffd700");
      poly([bs[1], bs[2], top[2], top[1]], null, "#ffd700");
      poly([bs[3], bs[2], top[2], top[3]], null, "#ffd700");
      ctx.lineWidth = 1;
    }

    // base name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${b.name} — Island: ${islandName(b)}  (drag to pan, scroll to zoom)`, 12, 22);

    // placement mode hint
    if (placing) {
      const def = BUILDINGS[placing.type];
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(10,20,35,0.75)";
      const msg = `Placing ${def.icon} ${def.name} (${def.size.w}×${def.size.h}) — click ground to build · ESC or right-click to cancel`;
      const tw = ctx.measureText(msg).width + 16;
      roundRectBase(w / 2 - tw / 2, h - 64, tw, 26, 6); ctx.fill();
      ctx.fillStyle = "#ffd700";
      ctx.fillText(msg, w / 2, h - 46);
    }

    renderQueue(b);
  }

  function canAfford(def) {
    return Object.entries(def.cost).every(([r, a]) => Game.state().resources[r] >= a);
  }

  function drawBuilding(bld, def) {
    const t = Game.now();
    const underConstruction = bld.upgradeEndsAt && bld.upgradeEndsAt > t;
    const stories = STORIES[bld.type] || 1;
    const { base: bs } = boxCorners(bld, def);
    const hpx = def.height * TILE * cam.zoom;

    // ground shadow (offset toward south)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    poly([{ x: bs[0].x + 5, y: bs[0].y + 3 }, { x: bs[1].x + 5, y: bs[1].y + 3 },
          { x: bs[2].x + 5, y: bs[2].y + 3 }, { x: bs[3].x + 5, y: bs[3].y + 3 }], "rgba(0,0,0,0.18)");

    // stacked stories: each floor is a slightly smaller box on top of the last
    const ccx = (bs[0].x + bs[2].x) / 2;
    const ccy = (bs[0].y + bs[2].y) / 2;
    const shrinkPt = (p, f) => ({ x: ccx + (p.x - ccx) * (1 - f), y: ccy + (p.y - ccy) * (1 - f) });
    const storyH = hpx / stories;
    let topFace = null;

    for (let i = 0; i < stories; i++) {
      const f = i * 0.09;               // each story pulls its footprint inward
      const c0 = shrinkPt(bs[0], f), c1 = shrinkPt(bs[1], f),
            c2 = shrinkPt(bs[2], f), c3 = shrinkPt(bs[3], f);
      const t0 = { x: c0.x, y: c0.y - storyH }, t1 = { x: c1.x, y: c1.y - storyH },
            t2 = { x: c2.x, y: c2.y - storyH }, t3 = { x: c3.x, y: c3.y - storyH };
      // left wall of this story
      poly([c3, c2, t2, t3], shade(def.color, 0.45 + i * 0.06));
      // right wall of this story
      poly([c1, c2, t2, t1], shade(def.color, 0.65 + i * 0.06));
      // roof slab (next story draws on top of it)
      const roofColor = (i < stories - 1)
        ? shade(def.color, 0.9)
        : (underConstruction ? shade(def.color, 0.7) : def.color);
      poly([t0, t1, t2, t3], roofColor, "rgba(0,0,0,0.35)");
      topFace = [t0, t1, t2, t3];
    }

    const top = topFace;

    // distinctive roof details per building type
    if (!underConstruction) drawRoofDetail(bld, top, def, t);

    // icon on the roof center (smaller now that roofs have detail)
    const cx = (top[0].x + top[2].x) / 2;
    const cy = (top[0].y + top[2].y) / 2;
    const rw = Math.abs(top[1].x - top[3].x);
    const rh = Math.abs(top[2].y - top[0].y);
    ctx.font = `${Math.floor(Math.max(10, Math.min(rw, rh * 2) * 0.3))}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.icon, cx, cy);

    // level badge on the right wall
    if (hpx > 12) {
      const wx = (bs[1].x + bs[2].x + top[1].x + top[2].x) / 4;
      const wy = (bs[1].y + bs[2].y + top[1].y + top[2].y) / 4;
      ctx.font = `bold ${Math.max(9, Math.floor(hpx * 0.35))}px sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(`Lv ${bld.level}`, wx, wy);
    }

    // construction progress bar on the left wall
    if (underConstruction) {
      const total = Game.buildingTime(bld.type, bld.upgradeTo || bld.level);
      const left = bld.upgradeEndsAt - t;
      const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
      const mx = (bs[3].x + bs[2].x) / 2, my = (bs[3].y + bs[2].y) / 2;
      const tw = Math.abs(bs[2].x - bs[3].x) * 0.9;
      const bw = Math.max(20, tw);
      ctx.fillStyle = "#0a141f";
      ctx.fillRect(mx - bw / 2, my - 3, bw, 5);
      ctx.fillStyle = "#ffb400";
      ctx.fillRect(mx - bw / 2, my - 3, bw * pct / 100, 5);
    }
  }

  /* ---------- distinctive roof details per building ---------- */
  function drawRoofDetail(bld, top, def, t) {
    const cx = (top[0].x + top[2].x) / 2;
    const cy = (top[0].y + top[2].y) / 2;
    const rw = Math.abs(top[1].x - top[3].x);
    const rh = Math.abs(top[2].y - top[0].y);
    const anim = Date.now() / 1000;

    switch (bld.type) {
      case "airfield": {
        // tarmac + proper runway with edges, centerline dashes and thresholds
        ctx.fillStyle = "#3d4652";
        poly(top, "#3d4652");
        const ax = top[0], bx2 = top[2];
        const dx2 = bx2.x - ax.x, dy2 = bx2.y - ax.y;
        const L = Math.hypot(dx2, dy2) || 1;
        const ux2 = dx2 / L, uy2 = dy2 / L;
        const pX = -uy2, pY = ux2;
        const off = Math.min(rw, rh * 2) * 0.13;
        // runway edges
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(1.5, rw * 0.02);
        for (const o of [-off, off]) {
          ctx.beginPath();
          ctx.moveTo(ax.x + pX * o, ax.y + pY * o);
          ctx.lineTo(bx2.x + pX * o, bx2.y + pY * o);
          ctx.stroke();
        }
        // centerline dashes
        ctx.setLineDash([rw * 0.07, rw * 0.06]);
        ctx.beginPath(); ctx.moveTo(ax.x, ax.y); ctx.lineTo(bx2.x, bx2.y); ctx.stroke();
        ctx.setLineDash([]);
        // threshold bars at both ends
        for (const end of [0.06, 0.94]) {
          const tx3 = ax.x + dx2 * end, ty3 = ax.y + dy2 * end;
          for (const o of [-off * 0.5, 0, off * 0.5]) {
            ctx.beginPath();
            ctx.moveTo(tx3 + pX * o - ux2 * rw * 0.05, ty3 + pY * o - uy2 * rw * 0.05);
            ctx.lineTo(tx3 + pX * o + ux2 * rw * 0.05, ty3 + pY * o + uy2 * rw * 0.05);
            ctx.stroke();
          }
        }
        ctx.lineWidth = 1;
        // helipad circle
        ctx.beginPath();
        ctx.arc(cx + rw * 0.28, cy + rh * 0.3, Math.min(rw, rh * 2) * 0.10, 0, Math.PI * 2);
        ctx.stroke();
        // parked jet silhouette
        ctx.fillStyle = "rgba(20,25,35,0.8)";
        ctx.beginPath();
        ctx.moveTo(cx - rw * 0.2, cy - rh * 0.1);
        ctx.lineTo(cx - rw * 0.34, cy - rh * 0.34);
        ctx.lineTo(cx - rw * 0.16, cy - rh * 0.12);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "harbor": {
        // dry dock: water pool + quay crane
        ctx.fillStyle = "#1d5a8a";
        poly(top, "#1d5a8a");
        ctx.strokeStyle = "#222";
        ctx.lineWidth = Math.max(1.5, rw * 0.025);
        ctx.beginPath();
        ctx.moveTo(cx - rw * 0.3, cy + rh * 0.1); ctx.lineTo(cx - rw * 0.3, cy - rh * 0.45);
        ctx.lineTo(cx + rw * 0.25, cy - rh * 0.25);
        ctx.moveTo(cx - rw * 0.3, cy - rh * 0.45); ctx.lineTo(cx - rw * 0.42, cy - rh * 0.2);
        ctx.stroke();
        ctx.lineWidth = 1;
        // hull in dock
        ctx.fillStyle = "#8a8f99";
        ctx.beginPath();
        ctx.ellipse(cx + rw * 0.15, cy + rh * 0.15, rw * 0.18, rh * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "oil_rig": {
        // animated pumpjack (nodding donkey): beam pivots on a post
        const bob = Math.sin(anim * 2.2) * 0.45;
        const px3 = cx, py3 = cy + rh * 0.25;
        const beamL = rw * 0.42;
        // post
        ctx.strokeStyle = "#3a3a3a";
        ctx.lineWidth = Math.max(2, rw * 0.04);
        ctx.beginPath(); ctx.moveTo(px3, cy + rh * 0.45); ctx.lineTo(px3, py3); ctx.stroke();
        // beam
        const hx = px3 + Math.cos(bob - Math.PI / 2) * beamL;
        const hy = py3 + Math.sin(bob - Math.PI / 2) * beamL;
        const cw2x = px3 - Math.cos(bob - Math.PI / 2) * beamL * 0.5;
        const cw2y = py3 - Math.sin(bob - Math.PI / 2) * beamL * 0.5;
        ctx.strokeStyle = "#2c2c2c";
        ctx.lineWidth = Math.max(2, rw * 0.035);
        ctx.beginPath(); ctx.moveTo(cw2x, cw2y); ctx.lineTo(hx, hy); ctx.stroke();
        // pump head (horse head)
        ctx.fillStyle = "#2c2c2c";
        ctx.beginPath(); ctx.arc(hx, hy, Math.max(2.5, rw * 0.055), 0, Math.PI * 2); ctx.fill();
        // counterweight disc
        ctx.fillStyle = "#4a4a4a";
        ctx.beginPath(); ctx.arc(cw2x, cw2y, Math.max(3, rw * 0.075), 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1;
        // well head + oil stain
        ctx.fillStyle = "#333";
        ctx.fillRect(hx - rw * 0.04, hy + rh * 0.1, rw * 0.08, rh * 0.12);
        ctx.fillStyle = "rgba(20,20,20,0.5)";
        ctx.beginPath(); ctx.arc(hx, hy + rh * 0.25, rw * 0.06, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "radar_station": {
        // rotating dish
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(anim);
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = Math.max(1.5, rw * 0.04);
        ctx.beginPath(); ctx.arc(0, 0, rw * 0.16, Math.PI * 0.2, Math.PI * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(rw * 0.14, 0); ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
        break;
      }
      case "comms_tower": {
        // antenna mast + blinking beacon
        ctx.strokeStyle = "#3a3a3a";
        ctx.lineWidth = Math.max(1.5, rw * 0.04);
        ctx.beginPath();
        ctx.moveTo(cx, cy + rh * 0.1); ctx.lineTo(cx, cy - rh * 0.7); ctx.stroke();
        ctx.lineWidth = 1;
        const on = Math.floor(anim * 2) % 2 === 0;
        if (on) {
          ctx.fillStyle = "#ff4040";
          ctx.beginPath(); ctx.arc(cx, cy - rh * 0.7, Math.max(2, rw * 0.05), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "factory":
      case "heavy_factory":
      case "steel_mill": {
        // chimneys + animated smoke puffs
        ctx.fillStyle = "#555b66";
        const chW = rw * 0.07, chH = rh * 0.35;
        ctx.fillRect(cx - rw * 0.25, cy - chH, chW, chH);
        ctx.fillRect(cx + rw * 0.12, cy - chH * 0.75, chW, chH * 0.75);
        for (let i = 0; i < 3; i++) {
          const ph = (anim * 0.4 + i / 3) % 1;
          ctx.fillStyle = `rgba(200,200,200,${0.4 * (1 - ph)})`;
          ctx.beginPath();
          ctx.arc(cx - rw * 0.21 + ph * rw * 0.08, cy - chH - ph * rh * 0.5, rw * 0.04 + ph * rw * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "command_center": {
        // colonnade + waving flag
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = Math.max(1, rw * 0.02);
        for (let i = -2; i <= 2; i++) {
          if (i === 0) continue;
          const px = cx + i * rw * 0.14;
          const py = cy + i * rh * 0.14;
          ctx.beginPath(); ctx.moveTo(px - rw * 0.03, py + rh * 0.05); ctx.lineTo(px - rw * 0.03, py - rh * 0.1); ctx.stroke();
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#333";
        ctx.beginPath(); ctx.moveTo(cx + rw * 0.35, cy + rh * 0.1); ctx.lineTo(cx + rw * 0.35, cy - rh * 0.45); ctx.stroke();
        ctx.fillStyle = "#d93b3b";
        ctx.beginPath();
        ctx.moveTo(cx + rw * 0.35, cy - rh * 0.45);
        ctx.lineTo(cx + rw * 0.55 + Math.sin(anim * 3) * rw * 0.03, cy - rh * 0.4);
        ctx.lineTo(cx + rw * 0.35, cy - rh * 0.28);
        ctx.closePath(); ctx.fill();
        break;
      }
      case "market": {
        // striped awning
        const stripes = 6;
        for (let i = 0; i < stripes; i++) {
          ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.55)" : "rgba(180,80,40,0.55)";
          const fx = top[3].x + (top[1].x - top[3].x) * (i / stripes);
          const fy = top[3].y + (top[1].y - top[3].y) * (i / stripes);
          const fx2 = top[3].x + (top[1].x - top[3].x) * ((i + 1) / stripes);
          const fy2 = top[3].y + (top[1].y - top[3].y) * ((i + 1) / stripes);
          const ux = (top[0].x - top[3].x) / stripes * 2;
          const uy = (top[0].y - top[3].y) / stripes * 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy); ctx.lineTo(fx2, fy2);
          ctx.lineTo(fx2 + ux, fy2 + uy);
          ctx.lineTo(fx + ux, fy + uy);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case "gold_mine": {
        // mine entrance + gold pile
        ctx.fillStyle = "#3a3226";
        ctx.beginPath();
        ctx.arc(cx, cy, rw * 0.12, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#ffd700";
        ctx.beginPath();
        ctx.arc(cx + rw * 0.22, cy + rh * 0.2, rw * 0.05, 0, Math.PI * 2);
        ctx.arc(cx + rw * 0.28, cy + rh * 0.25, rw * 0.04, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "barracks": {
        // drill yard + flag
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - rw * 0.3, cy - rh * 0.1, rw * 0.25, rh * 0.3);
        ctx.strokeRect(cx + rw * 0.05, cy - rh * 0.1, rw * 0.25, rh * 0.3);
        ctx.strokeStyle = "#333";
        ctx.beginPath(); ctx.moveTo(cx - rw * 0.35, cy + rh * 0.25); ctx.lineTo(cx - rw * 0.35, cy - rh * 0.25); ctx.stroke();
        ctx.fillStyle = "#3d6b3d";
        ctx.fillRect(cx - rw * 0.35, cy - rh * 0.25, rw * 0.12, rh * 0.1);
        break;
      }
      default:
        break;
    }
  }

  function drawGhost(bld, def, valid) {
    const { base: bs, top } = boxCorners(bld, def);
    const wall = valid ? "rgba(60,220,60,0.5)" : "rgba(220,60,60,0.5)";
    const roof = valid ? "rgba(95,255,95,0.55)" : "rgba(255,95,95,0.55)";
    ctx.globalAlpha = 0.8;
    poly([bs[3], bs[2], top[2], top[3]], wall);
    poly([bs[1], bs[2], top[2], top[1]], wall);
    poly(top, roof);
    ctx.globalAlpha = 1;
    const stroke = valid ? "#2f9f2f" : "#b02020";
    ctx.lineWidth = 2;
    poly(top, null, stroke);
    poly([bs[1], bs[2], top[2], top[1]], null, stroke);
    poly([bs[3], bs[2], top[2], top[3]], null, stroke);
    ctx.lineWidth = 1;
    const cx = (top[0].x + top[2].x) / 2;
    const cy = (top[0].y + top[2].y) / 2;
    const rw = Math.abs(top[1].x - top[3].x);
    const rh = Math.abs(top[2].y - top[0].y);
    ctx.font = `${Math.floor(Math.max(10, Math.min(rw, rh * 2) * 0.4))}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.icon, cx, cy);
  }

  function islandName(b) {
    const isl = Game.islandAt(b.gx, b.gy);
    return isl ? isl.name : "Unknown";
  }

  function renderQueue(b) {
    const q = document.getElementById("construction-queue");
    const t = Game.now();
       const teamHeader = `<div class="queue-item">👷 Teams: ${Game.busyTeams(b)}/${Game.constructionTeams(b)}</div>`;
    let html = teamHeader;
    b.buildings.filter(x => x.upgradeEndsAt && x.upgradeEndsAt > t).forEach(x => {
      const total = Game.buildingTime(x.type, x.upgradeTo || x.level);
      const left = x.upgradeEndsAt - t;
      const pct = Math.min(100, ((total - left) / total) * 100);
      const label = (x.upgradeTo || x.level) > x.level ? `→ Lv ${x.upgradeTo}` : "";
      html += `<div class="queue-item">${BUILDINGS[x.type].icon} ${BUILDINGS[x.type].name} ${label} — ${fmtRemaining(left)}<div class="bar"><div class="fill" style="width:${pct}%"></div></div></div>`;
    });
    b.training.forEach(tr => {
      const left = tr.endsAt - t;
      html += `<div class="queue-item">${UNITS[tr.unit].icon} ×${tr.count} — ${fmtRemaining(left)}</div>`;
    });
   if (html === teamHeader) html += `<div class="queue-item">Click the ground to build. Drag to pan, scroll to zoom.</div>`;
  }

  function fmtRemaining(sec) {
    sec = Math.max(0, sec);
    if (sec < 60) return `${Math.ceil(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  return { init, draw, resize };
})();
