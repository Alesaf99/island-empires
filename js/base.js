/* ===== Base view: 64x64 tiles, pan/zoom camera, pseudo-3D (60°) rendering ===== */

const BaseView = (() => {
  const TILE = 18;        // tile width in px at zoom 1
  const Y_SCALE = 0.5;   // 60-degree camera: vertical axis compressed 2:1
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
    cam.zoom = Math.max(0.35, Math.min(1, canvas.width / (Game.BASE_SIZE * TILE * 1.4)));
    const p = proj(c, c);
    cam.x += canvas.width / 2 - p.x;
    cam.y += canvas.height / 2 - p.y;
  }

  /* ---------- projection (60° look: y axis scaled) ---------- */
  function proj(tx, ty) {
    return {
      x: cam.x + tx * TILE * cam.zoom,
      y: cam.y + ty * TILE * cam.zoom * Y_SCALE,
    };
  }
  function unproj(sx, sy) {
    return {
      x: (sx - cam.x) / (TILE * cam.zoom),
      y: (sy - cam.y) / (TILE * cam.zoom * Y_SCALE),
    };
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
    cam.zoom = Math.max(0.3, Math.min(2.5, cam.zoom * factor));
    const after = unproj(sx, sy);
    cam.x += (after.x - before.x) * TILE * cam.zoom;
    cam.y += (after.y - before.y) * TILE * cam.zoom * Y_SCALE;
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

  /* ---------- drawing ---------- */
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
    const b2 = Math.max(0, Math.min(255, (n & 255) * f));
    return `rgb(${r | 0},${g | 0},${b2 | 0})`;
  }

  function buildingScreenRect(bld, def) {
    const p0 = proj(bld.x, bld.y);
    const p1 = proj(bld.x + def.size.w, bld.y + def.size.h);
    const hpx = def.height * TILE * cam.zoom;
    return { x: p0.x, y: p0.y - hpx, w: p1.x - p0.x, h: p1.y - p0.y, hpx };
  }

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

    // island grass (projected square of the whole base)
    const p00 = proj(0, 0);
    const p11 = proj(N, N);
    ctx.fillStyle = "#3e7a3e";
    ctx.fillRect(p00.x, p00.y, p11.x - p00.x, p11.y - p00.y);
    // beach edge
    ctx.strokeStyle = "#c2a878";
    ctx.lineWidth = 3;
    ctx.strokeRect(p00.x, p00.y, p11.x - p00.x, p11.y - p00.y);
    ctx.lineWidth = 1;

    // tile grid (only visible range)
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    const vis0 = unproj(0, 0), vis1 = unproj(w, h);
    const tx0 = Math.max(0, Math.floor(vis0.x)), tx1 = Math.min(N, Math.ceil(vis1.x));
    const ty0 = Math.max(0, Math.floor(vis0.y)), ty1 = Math.min(N, Math.ceil(vis1.y));
    for (let tx = tx0; tx <= tx1; tx++) {
      const p = proj(tx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, p00.y); ctx.lineTo(p.x, p11.y); ctx.stroke();
    }
    for (let ty = ty0; ty <= ty1; ty++) {
      const p = proj(0, ty);
      ctx.beginPath(); ctx.moveTo(p00.x, p.y); ctx.lineTo(p11.x, p.y); ctx.stroke();
    }

    // buildings, sorted back-to-front
    const sorted = [...b.buildings].sort((a, c) => {
      const ad = BUILDINGS[a.type], cd = BUILDINGS[c.type];
      return (a.y + ad.size.h) - (c.y + cd.size.h) || a.x - c.x;
    });
    sorted.forEach(bld => drawBuilding(bld, BUILDINGS[bld.type], b));

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
      const r = buildingScreenRect(selected, def);
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h + r.hpx);
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

  function drawBuilding(bld, def, base) {
    const r = buildingScreenRect(bld, def);
    const t = Game.now();
    const underConstruction = bld.upgradeEndsAt && bld.upgradeEndsAt > t;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(r.x + 4, r.y + r.hpx + 4, r.w, r.h);

    // front wall (darker)
    ctx.fillStyle = shade(def.color, 0.55);
    ctx.fillRect(r.x, r.y + r.h, r.w, r.hpx);

    // roof / top face
    ctx.fillStyle = underConstruction ? shade(def.color, 0.7) : def.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    // icon on the roof
    ctx.font = `${Math.floor(Math.min(r.w, r.h) * 0.55)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.icon, r.x + r.w / 2, r.y + r.h / 2);

    // level badge on the wall
    ctx.font = `bold ${Math.max(9, Math.floor(r.w * 0.16))}px sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.fillText(`Lv ${bld.level}`, r.x + r.w / 2, r.y + r.h + r.hpx / 2);

    // construction progress on the wall
    if (underConstruction) {
      const total = Game.buildingTime(bld.type, bld.upgradeTo || bld.level);
      const left = bld.upgradeEndsAt - t;
      const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
      ctx.fillStyle = "#0a141f";
      ctx.fillRect(r.x, r.y + r.h + r.hpx - 6, r.w, 5);
      ctx.fillStyle = "#ffb400";
      ctx.fillRect(r.x, r.y + r.h + r.hpx - 6, r.w * pct / 100, 5);
    }
  }

  function drawGhost(bld, def, valid) {
    const r = buildingScreenRect(bld, def);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = valid ? "#5fff5f" : "#ff5f5f";
    ctx.fillRect(r.x, r.y + r.h, r.w, r.hpx);     // wall
    ctx.fillRect(r.x, r.y, r.w, r.h);             // roof
    ctx.globalAlpha = 1;
    ctx.strokeStyle = valid ? "#2f9f2f" : "#b02020";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h + r.hpx);
    ctx.lineWidth = 1;
    ctx.font = `${Math.floor(Math.min(r.w, r.h) * 0.5)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.icon, r.x + r.w / 2, r.y + r.h / 2);
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
