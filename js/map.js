/* ===== World map view: 9 islands, pan/zoom camera, armies in motion ===== */

const MapView = (() => {
  let canvas, ctx;
  let cam = { x: 0, y: 0, zoom: 1 };
  let camInit = false;
  let selected = null;      // {gx, gy}
  let dragging = false, dragMoved = false, lastPt = null, downPt = null;
  let pinch = null;
  let mouse = null;
  let animT = 0;            // animation clock

  function init() {
    canvas = document.getElementById("map-canvas");
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
    
        startAnimLoop();
  }

  /* Smooth animation loop — capped at ~30fps and only while the map is visible,
     so phones stay lag-free and battery-friendly. */
  let rafLast = 0;
  function startAnimLoop() {
    const loop = (ts) => {
      requestAnimationFrame(loop);
      if (ts - rafLast < 33) return;   // ~30 fps
      rafLast = ts;
      const mapView = document.getElementById("map-view");
      if (mapView.classList.contains("active")) draw();
    };
    requestAnimationFrame(loop);
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (!camInit) { centerCamera(); camInit = true; }
    draw();
  }

  function centerCamera() {
    const cx = WORLD.GRID_W / 2, cy = WORLD.GRID_H / 2;
    cam.zoom = Math.min(canvas.width / (WORLD.GRID_W * 28), canvas.height / (WORLD.GRID_H * 28)) * 1.1;
    cam.zoom = Math.max(0.4, Math.min(2.0, cam.zoom));
    const p = proj(cx, cy);
    cam.x += canvas.width / 2 - p.x;
    cam.y += canvas.height / 2 - p.y;
  }

  /* ---------- projection ---------- */
  function proj(gx, gy) {
    const s = scale();
    return { x: cam.x + gx * s, y: cam.y + gy * s };
  }
  function unproj(sx, sy) {
    const s = scale();
    return { x: (sx - cam.x) / s, y: (sy - cam.y) / s };
  }
  function scale() { return 28 * cam.zoom; }

  function gridAt(sx, sy) {
    const w = unproj(sx, sy);
    const gx = Math.floor(w.x), gy = Math.floor(w.y);
    if (gx < 0 || gy < 0 || gx >= WORLD.GRID_W || gy >= WORLD.GRID_H) return null;
    return { gx, gy };
  }

  /* ---------- interaction ---------- */
  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    downPt = lastPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging = true; dragMoved = false;
  }
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    mouse = { x: mx, y: my };
    if (dragging && lastPt) {
      if (Math.abs(mx - downPt.x) + Math.abs(my - downPt.y) > 5) dragMoved = true;
      if (dragMoved) { cam.x += mx - lastPt.x; cam.y += my - lastPt.y; }
      lastPt = { x: mx, y: my };
    }
    draw();
  }
  function onUp(e) {
    if (dragging && !dragMoved) {
      const rect = canvas.getBoundingClientRect();
      onClick(e.clientX - rect.left, e.clientY - rect.top);
    }
    dragging = false; lastPt = null;
  }
  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.18 : 0.85);
    draw();
  }
  function zoomAt(sx, sy, factor) {
    const before = unproj(sx, sy);
    cam.zoom = Math.max(0.35, Math.min(3.5, cam.zoom * factor));
    const fix = proj(before.x, before.y);
    cam.x += (sx - fix.x);
    cam.y += (sy - fix.y);
  }

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
      zoomAt(pinch.cx - rect.left, pinch.cy - rect.top, d / pinch.dist);
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

  function onClick(mx, my) {
    const c = gridAt(mx, my);
    if (!c) return;
    selected = c;
    renderInfo();
    draw();
  }

  /* ---------- info panel ---------- */
  function renderInfo() {
    const el = document.getElementById("selected-grid-info");
    const actions = document.getElementById("map-actions");
    actions.innerHTML = "";
    if (!selected) { el.innerHTML = "<h3>World Map</h3><p>Drag to pan, scroll to zoom. Click a grid cell to inspect it.</p>"; return; }

    const st = Game.state();
    const isl = Game.islandAt(selected.gx, selected.gy);
    const myBase = st.bases.find(b => b.gx === selected.gx && b.gy === selected.gy);
    const ai = st.ai.find(a => a.gx === selected.gx && a.gy === selected.gy);

    let html = `<h3>${isl ? "🏝️ " + isl.name : "🌊 Ocean"}</h3>`;
    html += `<p>Grid (${selected.gx}, ${selected.gy})${isl ? ` — ${isl.name} island` : " — open water"}</p>`;

    if (myBase) {
      html += `<p><b>Your base:</b> ${myBase.name} — click Base view to manage it.</p>`;
      el.innerHTML = html;
      return;
    }
    if (ai) {
      html += `<p><b>⚠️ ${ai.name}</b> (AI, level ${ai.level}, power ~${Math.round(Game.armyPower(aiGarrisonView(ai)))}) occupies this territory.</p>`;
      const atk = mkBtn("⚔️ Attack", () => openSendModal(ai.id, ai.name, ai.gx, ai.gy), "danger");
      actions.appendChild(atk);
      el.innerHTML = html;
      return;
    }
    if (isl) {
      const { ok, reqLevel } = Game.canBuyLand();
      html += `<p>Unclaimed land. ${ok ? "You can purchase this plot." : `Requires level ${reqLevel}.`}</p>`;
      const cost = baseLandCostStr(st.bases.length + 1);
      html += `<p><b>Price:</b> ${cost}</p>`;
      const buy = mkBtn("🏝️ Buy Land", () => {
        if (Game.buyLand(selected.gx, selected.gy)) renderInfo();
      }, "primary");
      if (!ok) buy.disabled = true;
      actions.appendChild(buy);
    } else {
      html += `<p>Open ocean — ships, submarines and aircraft travel here.</p>`;
    }
    el.innerHTML = html;
  }

  function aiGarrisonView(ai) {
    return { soldier: Math.max(2, Math.floor(ai.power / 150)), at_soldier: Math.max(1, Math.floor(ai.power / 500)) };
  }

  function baseLandCostStr(n) {
    const c = baseLandCost(n);
    return Object.entries(c).map(([r, a]) => `${a} ${r}`).join(", ");
  }

  function mkBtn(label, fn, cls) {
    const btn = document.createElement("button");
    btn.className = "action" + (cls ? " " + cls : "");
    btn.textContent = label;
    btn.onclick = fn;
    return btn;
  }

  /* ---------- send army modal ---------- */
  function openSendModal(targetId, targetName, gx, gy) {
    const sendUnits = {};
    const b = Game.state().bases[Game.state().activeBase];
    document.getElementById("building-name").textContent = `⚔️ Attack ${targetName}`;
    document.getElementById("building-desc").textContent = "Select units from your active base garrison. Ground units need transports to cross water. Travel time depends on the slowest unit.";
    const stats = document.getElementById("building-stats");
    stats.innerHTML = "";
    let any = false;
    Object.entries(b.army).forEach(([key, count]) => {
      if (count <= 0) return;
      any = true;
      const u = UNITS[key];
      const row = document.createElement("div");
      row.innerHTML = `${u.icon} <b>${u.name}</b> ×${count} — send <b id="send-${key}">0</b>`;
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;margin:4px 0 8px 0;";
      const all = mkBtn("All", () => { sendUnits[key] = count; upd(); });
      const plus = mkBtn("+1", () => { sendUnits[key] = Math.min(count, (sendUnits[key] || 0) + 1); upd(); });
      const minus = mkBtn("−", () => { sendUnits[key] = Math.max(0, (sendUnits[key] || 0) - 1); upd(); });
      controls.append(all, plus, minus);
      row.appendChild(controls);
      stats.appendChild(row);
      function upd() {
        const el = document.getElementById("send-" + key);
        if (el) el.textContent = sendUnits[key] || 0;
      }
    });
    if (!any) stats.innerHTML = "<div>No units in garrison. Train some in the Base view first.</div>";

    const actions = document.getElementById("building-actions");
    actions.innerHTML = "";
    const send = mkBtn("🚀 Dispatch", () => {
      const units = Object.fromEntries(Object.entries(sendUnits).filter(([, c]) => c > 0));
      if (Game.sendArmy(Game.state().activeBase, gx, gy, units, targetId)) {
        closeModal("building-modal");
        renderInfo();
      }
    }, "primary");
    actions.appendChild(send);
    openModal("building-modal");
  }

  /* ---------- drawing ---------- */
  function armyProgress(army, t) {
    const total = army.arrivesAt - army.departedAt;
    const elapsed = Math.min(total, Math.max(0, t - army.departedAt));
    const progress = total > 0 ? elapsed / total : 1;
    let tx = army.to.x, ty = army.to.y;
    let fx = army.from.x, fy = army.from.y;
    if (army.recalled) { fx = army.to.x; fy = army.to.y; tx = army.from.x; ty = army.from.y; }
    return { x: fx + (tx - fx) * progress, y: fy + (ty - fy) * progress, progress };
  }

  function draw() {
    if (!ctx) return;
    const st = Game.state();
    if (!st) return;
    const w = canvas.width, h = canvas.height;
    const s = scale();
    animT = Date.now() / 1000;

    // deep ocean gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#123a5c");
    grad.addColorStop(0.5, "#17527e");
    grad.addColorStop(1, "#123a5c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // animated waves
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1.5;
    const waveStep = Math.max(40, s * 2);
    for (let wy = ((animT * 6) % waveStep) - waveStep; wy < h; wy += waveStep) {
      ctx.beginPath();
      for (let wx = 0; wx <= w; wx += 12) {
        const y = wy + Math.sin((wx + animT * 30) * 0.02) * 3;
        if (wx === 0) ctx.moveTo(wx, y); else ctx.lineTo(wx, y);
      }
      ctx.stroke();
    }

    // visible grid range
    const vis0 = unproj(0, 0), vis1 = unproj(w, h);
    const gx0 = Math.max(0, Math.floor(vis0.x)), gx1 = Math.min(WORLD.GRID_W, Math.ceil(vis1.x));
    const gy0 = Math.max(0, Math.floor(vis0.y)), gy1 = Math.min(WORLD.GRID_H, Math.ceil(vis1.y));

    // islands with beach + terrain
    ISLANDS.forEach(isl => {
      const x = cam.x + isl.x * s, y = cam.y + isl.y * s;
      const iw = isl.w * s, ih = isl.h * s;
      // shallow water halo
      ctx.fillStyle = "rgba(90,190,220,0.25)";
      roundRect(x - 6, y - 6, iw + 12, ih + 12, 10); ctx.fill();
      // beach
      ctx.fillStyle = "#e8d5a3";
      roundRect(x, y, iw, ih, 6); ctx.fill();
      // grass
      ctx.fillStyle = "#4e8f47";
      roundRect(x + s * 0.18, y + s * 0.18, iw - s * 0.36, ih - s * 0.36, 5); ctx.fill();
      // grass shading
      const g2 = ctx.createLinearGradient(x, y, x + iw, y + ih);
      g2.addColorStop(0, "rgba(255,255,255,0.10)");
      g2.addColorStop(1, "rgba(0,0,0,0.15)");
      roundRect(x + s * 0.18, y + s * 0.18, iw - s * 0.36, ih - s * 0.36, 5);
      ctx.fillStyle = g2; ctx.fill();
      // terrain decorations (deterministic per island)
      drawIslandDecor(isl, x, y, iw, ih, s);
      // island name
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.font = `bold ${Math.max(11, s * 0.55)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText(isl.name, x + iw / 2, y + ih / 2);
      ctx.fillText(isl.name, x + iw / 2, y + ih / 2);
      ctx.lineWidth = 1;
    });

    // grid lines (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let gx = gx0; gx <= gx1; gx++) {
      const p = proj(gx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, cam.y); ctx.lineTo(p.x, cam.y + WORLD.GRID_H * s); ctx.stroke();
    }
    for (let gy = gy0; gy <= gy1; gy++) {
      const p = proj(0, gy);
      ctx.beginPath(); ctx.moveTo(cam.x, p.y); ctx.lineTo(cam.x + WORLD.GRID_W * s, p.y); ctx.stroke();
    }

    const t = Game.now();

    // incoming-attack warning rings on player bases
    Object.values(st.armies).forEach(army => {
      if (army.owner === "player") return;
      const idx = typeof army.target === "string" ? parseInt(army.target.split(":")[1]) : st.activeBase;
      const b = st.bases[idx];
      if (!b) return;
      const p = proj(b.gx + 0.5, b.gy + 0.5);
      const pulse = 0.5 + 0.5 * Math.sin(animT * 4);
      ctx.strokeStyle = `rgba(255,70,70,${0.25 + pulse * 0.45})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * (0.8 + pulse * 0.35), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    });

    // travel paths + armies in transit
    Object.values(st.armies).forEach(army => {
      const p0 = proj(army.from.x, army.from.y);
      const p1 = proj(army.to.x, army.to.y);
      const mine = army.owner === "player";
      // dashed path
      ctx.strokeStyle = mine ? "rgba(120,255,120,0.35)" : "rgba(255,90,90,0.4)";
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -((animT * 20) % 12);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.setLineDash([]);
      // army marker
        // army marker: vector icon rotated to direction of travel
      const p = armyProgress(army, t);
      const sp = proj(p.x, p.y);
      const r = Math.max(8, s * 0.32);
      const dir = army.recalled
        ? { x: army.from.x - army.to.x, y: army.from.y - army.to.y }
        : { x: army.to.x - army.from.x, y: army.to.y - army.from.y };
      const heading = Math.atan2(dir.y, dir.x);
            const unitKey = Icons.dominantUnit(army.units) || Icons.dominantClass(army.units);
      Icons.drawArmy(ctx, unitKey, sp.x, sp.y, r * 2.4, heading, mine);
      // ETA label
      const eta = Math.max(0, army.arrivesAt - t);
      const label = Game.fmtHours(eta / 3600);
      ctx.font = `bold ${Math.max(10, s * 0.4)}px sans-serif`;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = "rgba(10,20,35,0.8)";
      roundRect(sp.x - tw / 2, sp.y - r - s * 0.75, tw, s * 0.55, 4); ctx.fill();
      ctx.fillStyle = mine ? "#9cff9c" : "#ff9c9c";
      ctx.fillText(label, sp.x, sp.y - r - s * 0.75 + s * 0.28);
    });

    // player bases
    st.bases.forEach(b => {
      const p = proj(b.gx + 0.5, b.gy + 0.5);
      const r = Math.max(10, s * 0.4);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.35, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // home plate
      ctx.fillStyle = "#2e7d32";
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.font = `${r * 1.1}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🏠", p.x, p.y);
      // name
      ctx.font = `bold ${Math.max(10, s * 0.38)}px sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(b.name, p.x, p.y + r + s * 0.35);
      ctx.fillText(b.name, p.x, p.y + r + s * 0.35);
      ctx.lineWidth = 1;
    });

    // AI bases
    st.ai.forEach(a => {
      const p = proj(a.gx + 0.5, a.gy + 0.5);
      const r = Math.max(9, s * 0.36);
      ctx.fillStyle = "#b02020";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.font = `${r * 1.1}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚑", p.x, p.y);
      // hover tooltip for AI
      if (mouse) {
        const mp = unproj(mouse.x, mouse.y);
        if (Math.floor(mp.x) === a.gx && Math.floor(mp.y) === a.gy) {
          ctx.font = `bold ${Math.max(10, s * 0.4)}px sans-serif`;
          ctx.fillStyle = "rgba(10,20,35,0.85)";
          const txt = `${a.name} — lvl ${a.level}`;
          const tw2 = ctx.measureText(txt).width + 10;
          roundRect(p.x - tw2 / 2, p.y - r - s * 0.7, tw2, s * 0.55, 4); ctx.fill();
          ctx.fillStyle = "#ffb0b0";
          ctx.fillText(txt, p.x, p.y - r - s * 0.7 + s * 0.28);
        }
      }
    });

    // selection highlight
    if (selected) {
      const p = proj(selected.gx, selected.gy);
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x + 2, p.y + 2, s - 4, s - 4);
      ctx.lineWidth = 1;
    }

    // zoom hint
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("drag to pan · scroll to zoom", 12, h - 10);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* deterministic terrain decorations per island */
  function drawIslandDecor(isl, x, y, iw, ih, s) {
    // simple hash-based scatter
    let seed = (isl.id + 1) * 7919;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = isl.w * 2;
    for (let i = 0; i < n; i++) {
      const dx = x + s * 0.3 + rnd() * (iw - s * 0.6);
      const dy = y + s * 0.3 + rnd() * (ih - s * 0.6);
      const kind = rnd();
      if (kind < 0.5) {
        // tree
        ctx.fillStyle = "#2d6a2d";
        ctx.beginPath(); ctx.arc(dx, dy, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5c3d24";
        ctx.fillRect(dx - 1, dy, 2, Math.max(2, s * 0.1));
      } else if (kind < 0.75) {
        // hill
        ctx.fillStyle = "rgba(60,110,60,0.8)";
        ctx.beginPath();
        ctx.ellipse(dx, dy, s * 0.25, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // rock
        ctx.fillStyle = "rgba(120,120,120,0.6)";
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(1.5, s * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return { init, draw, resize, renderInfo, armyProgress };
})();
