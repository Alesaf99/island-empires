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
    window.addEventListener("resize", resize);
    resize();
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

  /* ---------- projection: world rotated 45 degrees, viewed tilted ----------
     tile (tx, ty) -> screen:
       sx = cam.x + (tx - ty) * k
       sy = cam.y + (tx + ty) * k * Y_SCALE
     where k = TILE * zoom / 2                                             */
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
      if (bld.type === "barracks" || bld.type === "airfield" || bld.type === "harbor") {
        const btn = document.createElement("button");
        btn.className = "action primary";
        btn.textContent = "🎖️ Train Units";
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
    document.getElementById("building-desc").textContent = `Choose a building, then click where to place it. Command Center level ${cc} allows buildings up to level ${cc + 1}.`;
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
        toast("📍 Click a location on the ground to place the building.");
        draw();
      };
      actions.appendChild(btn);
    });
    openModal("building-modal");
  }

  /* ---------- training modal ---------- */
  function showTrainModal(bldType) {
    const b = base();
    const domainMap = { barracks: "ground", airfield: "air", harbor: "naval" };
    const domain = domainMap[bldType];
    document.getElementById("building-name").textContent = `🎖️ Train Units — ${BUILDINGS[bldType].name}`;
    document.getElementById("building-desc").textContent = "Your garrison defends the base automatically.";
    const stats = document.getElementById("building-stats");
    stats.innerHTML = "";
    Object.entries(UNITS).forEach(([key, u]) => {
      if (u.domain !== domain) return;
      const row = document.createElement("div");
      row.innerHTML = `${u.icon} <b>${u.name}</b> — power ${u.power}, speed ${u.speed}/h — cost ${Object.entries(u.cost).map(([r, a]) => `${a} ${r}`).join(", ")} — <span id="train-count-${key}">0</span> owned`;
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

  /* ---------- drawing helpers ---------- */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
    const b2 = Math.max(0, Math.min(255, (n & 255) * f));
    return `rgb(${r | 0},${g | 0},${b2 | 0})`;
  }

  /* Projected corners of a building footprint, ordered so that
     [0]=north corner, [1]=east, [2]=south, [3]=west on screen. */
  function boxCorners(bld, def) {
    const x = bld.x, y = bld.y, w = def.size.w, h = def.size.h;
    const hpx = def.height * TILE * cam.zoom;
    const base = [proj(x, y), proj(x + w, y), proj(x + w, y + h), proj(x, y + h)];
    const top = base.map(p => ({ x: p.x, y: p.y - hpx }));
    return { base, top, hpx };
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

    // tile grid: lines along both axes
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    const lo = -4, hi = N + 4;
    for (let i = 0; i <= N; i++) {
      const a = proj(i, lo), bb = proj(i, hi);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
      const c = proj(lo, i), d = proj(hi, i);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }

    // buildings, painter's order: back (small x+y) to front (large x+y)
    const sorted = [...b.buildings].sort((a, c) => {
      const ad = BUILDINGS[a.type], cd = BUILDINGS[c.type];
      return (a.x + a.y + (ad.size.w + ad.size.h) / 2) - (c.x + c.y + (cd.size.w + cd.size.h) / 2);
    });
    sorted.forEach(bld => drawBuilding(bld, BUILDINGS[bld.type]));

    // hovered tile highlight (diamond outline)
    if (hover && hover.x >= 0 && hover.y >= 0 && hover.x < N && hover.y < N) {
      const t0 = proj(hover.x, hover.y), t1 = proj(hover.x + 1, hover.y),
            t2 = proj(hover.x + 1, hover.y + 1), t3 = proj(hover.x, hover.y + 1);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
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
      poly([bs[1], bs[2], top[2], top[1]], null, "#ffd700"); // right wall edge
      poly([bs[3], bs[2], top[2], top[3]], null, "#ffd700"); // left wall edge
      ctx.lineWidth = 1;
    }

    // base name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${b.name} — Island: ${islandName(b)}  (drag to pan, scroll to zoom)`, 12, 22);

    renderQueue(b);
  }

  function canAfford(def) {
    return Object.entries(def.cost).every(([r, a]) => Game.state().resources[r] >= a);
  }

  function drawBuilding(bld, def) {
    const t = Game.now();
    const underConstruction = bld.upgradeEndsAt && bld.upgradeEndsAt > t;
    const { base: bs, top, hpx } = boxCorners(bld, def);

    // ground shadow (offset toward south)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    poly([{ x: bs[0].x + 5, y: bs[0].y + 3 }, { x: bs[1].x + 5, y: bs[1].y + 3 },
          { x: bs[2].x + 5, y: bs[2].y + 3 }, { x: bs[3].x + 5, y: bs[3].y + 3 }], "rgba(0,0,0,0.18)");

    // left wall (west->south face)
    ctx.fillStyle = shade(def.color, 0.45);
    poly([bs[3], bs[2], top[2], top[3]], shade(def.color, 0.45));

    // right wall (south->east face)
    ctx.fillStyle = shade(def.color, 0.65);
    poly([bs[1], bs[2], top[2], top[1]], shade(def.color, 0.65));

    // roof
    const roofColor = underConstruction ? shade(def.color, 0.7) : def.color;
    poly(top, roofColor, "rgba(0,0,0,0.35)");

    // icon on the roof center
    const cx = (top[0].x + top[2].x) / 2;
    const cy = (top[0].y + top[2].y) / 2;
    const rw = Math.abs(top[1].x - top[3].x);
    const rh = Math.abs(top[2].y - top[0].y);
    ctx.font = `${Math.floor(Math.max(10, Math.min(rw, rh * 2) * 0.4))}px serif`;
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
    let html = "";
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
    if (!html) html = `<div class="queue-item">Click the ground to build. Drag to pan, scroll to zoom.</div>`;
    q.innerHTML = html;
  }

  function fmtRemaining(sec) {
    sec = Math.max(0, sec);
    if (sec < 60) return `${Math.ceil(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  return { init, draw, resize };
})();
