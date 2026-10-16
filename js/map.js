/* ===== World map view: 9 islands, armies in motion, land purchase ===== */

const MapView = (() => {
  let canvas, ctx;
  let selected = null;      // {gx, gy}
  let sendMode = null;     // { toGx, toGy, targetId, targetName }
  let sendUnits = {};

  function init() {
    canvas = document.getElementById("map-canvas");
    ctx = canvas.getContext("2d");
    canvas.addEventListener("click", onClick);
    window.addEventListener("resize", resize);
    resize();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
  }

  function cellAt(mx, my) {
    const st = Game.state();
    const scale = Math.min(canvas.width / WORLD.GRID_W, canvas.height / WORLD.GRID_H);
    const offX = (canvas.width - WORLD.GRID_W * scale) / 2;
    const offY = (canvas.height - WORLD.GRID_H * scale) / 2;
    const gx = Math.floor((mx - offX) / scale);
    const gy = Math.floor((my - offY) / scale);
    if (gx < 0 || gy < 0 || gx >= WORLD.GRID_W || gy >= WORLD.GRID_H) return null;
    return { gx, gy };
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const c = cellAt(e.clientX - rect.left, e.clientY - rect.top);
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
    if (!selected) { el.innerHTML = "<h3>World Map</h3><p>Click a grid cell to inspect it.</p>"; return; }

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
      html += `<p><b>⚠️ ${ai.name}</b> (AI, level ${ai.level}, power ~${Math.round(ai.power)}) occupies this territory.</p>`;
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
      html += `<p>Open ocean — ships and submarines travel here.</p>`;
    }
    el.innerHTML = html;
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
    sendMode = { targetId, targetName, gx, gy };
    sendUnits = {};
    const b = Game.state().bases[Game.state().activeBase];
    document.getElementById("building-name").textContent = `⚔️ Attack ${targetName}`;
    document.getElementById("building-desc").textContent = "Select units from your active base garrison. Travel time depends on the slowest unit.";
    const stats = document.getElementById("building-stats");
    stats.innerHTML = "";
    let any = false;
    Object.entries(b.army).forEach(([key, count]) => {
      if (count <= 0) return;
      any = true;
      const u = UNITS[key];
      const row = document.createElement("div");
      row.innerHTML = `${u.icon} <b>${u.name}</b> ×${count} — power ${u.power}, speed ${u.speed}/h — send <b id="send-${key}">0</b>`;
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;margin:4px 0 8px 0;";
      const all = mkBtn("All", () => { sendUnits[key] = count; upd(key); });
      const plus = mkBtn("+1", () => { sendUnits[key] = Math.min(count, (sendUnits[key] || 0) + 1); upd(key); });
      const minus = mkBtn("−", () => { sendUnits[key] = Math.max(0, (sendUnits[key] || 0) - 1); upd(key); });
      controls.append(all, plus, minus);
      row.appendChild(controls);
      stats.appendChild(row);
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

  function upd(key) {
    const el = document.getElementById("send-" + key);
    if (el) el.textContent = sendUnits[key] || 0;
  }

  /* ---------- drawing ---------- */
  function draw() {
    if (!ctx) return;
    const st = Game.state();
    const w = canvas.width, h = canvas.height;
    const scale = Math.min(w / WORLD.GRID_W, h / WORLD.GRID_H);
    const offX = (w - WORLD.GRID_W * scale) / 2;
    const offY = (h - WORLD.GRID_H * scale) / 2;

    // ocean
    ctx.fillStyle = "#1b4f72";
    ctx.fillRect(0, 0, w, h);
    // subtle waves
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 100; i++) {
      const x = (i * 137) % w, y = (i * 89) % h;
      ctx.fillRect(x, y, 20, 2);
    }

    // islands
    ISLANDS.forEach(isl => {
      ctx.fillStyle = "#5d9b4f";
      ctx.fillRect(offX + isl.x * scale, offY + isl.y * scale, isl.w * scale, isl.h * scale);
      ctx.strokeStyle = "#c2a878"; // beach
      ctx.lineWidth = 2;
      ctx.strokeRect(offX + isl.x * scale + 1, offY + isl.y * scale + 1, isl.w * scale - 2, isl.h * scale - 2);
      ctx.lineWidth = 1;
      // island name
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(10, scale * 0.6)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(isl.name, offX + (isl.x + isl.w / 2) * scale, offY + (isl.y + isl.h / 2) * scale);
    });

    // grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let x = 0; x <= WORLD.GRID_W; x++) ctx.strokeRect(offX + x * scale, offY, 0.5, WORLD.GRID_H * scale);
    for (let y = 0; y <= WORLD.GRID_H; y++) ctx.strokeRect(offX, offY + y * scale, WORLD.GRID_W * scale, 0.5);

    // player bases
    st.bases.forEach(b => {
      const x = offX + b.gx * scale, y = offY + b.gy * scale;
      ctx.font = `${scale * 0.8}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🏠", x + scale / 2, y + scale / 2);
      ctx.fillStyle = "#ffd700";
      ctx.strokeStyle = "#000";
      ctx.strokeRect(x + 1, y + 1, scale - 2, scale - 2);
    });

    // AI bases
    st.ai.forEach(a => {
      const x = offX + a.gx * scale, y = offY + a.gy * scale;
      ctx.font = `${scale * 0.8}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚑", x + scale / 2, y + scale / 2);
    });

    // armies in transit
    const t = Game.now();
    Object.values(st.armies).forEach(army => {
      const p = armyProgress(army, t);
      const x = offX + p.x * scale, y = offY + p.y * scale;
      ctx.font = `${scale * 0.9}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = army.owner === "player" ? "🚩" : "⚔️";
      ctx.fillText(icon, x, y);
      if (army.owner !== "player" && p.progress > 0.5) {
        ctx.fillStyle = "rgba(255,80,80,0.9)";
        ctx.font = `bold ${Math.max(9, scale * 0.4)}px sans-serif`;
        ctx.fillText("⚠", x, y - scale * 0.5);
      }
    });

    // selection
    if (selected) {
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      ctx.strokeRect(offX + selected.gx * scale + 2, offY + selected.gy * scale + 2, scale - 4, scale - 4);
      ctx.lineWidth = 1;
    }
  }

  function armyProgress(army, t) {
    const total = army.arrivesAt - army.departedAt;
    const elapsed = Math.min(total, Math.max(0, t - army.departedAt));
    const progress = total > 0 ? elapsed / total : 1;
    let tx = army.to.x, ty = army.to.y;
    let fx = army.from.x, fy = army.from.y;
    if (army.recalled) { fx = army.to.x; fy = army.to.y; tx = army.from.x; ty = army.from.y; }
    return { x: fx + (tx - fx) * progress, y: fy + (ty - fy) * progress, progress };
  }

  return { init, draw, resize, renderInfo, armyProgress };
})();
