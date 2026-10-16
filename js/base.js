/* ===== Base view: building grid, placement, upgrades, training ===== */

const BaseView = (() => {
  const GRID = 6;          // 6x6 base grid
  let canvas, ctx;
  let selectedSlot = null;
  let placing = null;      // building type being placed
  let showArmyPanel = false;

  function init() {
    canvas = document.getElementById("base-canvas");
    ctx = canvas.getContext("2d");
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);
    resize();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
  }

  function base() { return Game.state().bases[Game.state().activeBase]; }

  function cellRect(slot, w = canvas.width, h = canvas.height) {
    const size = Math.min(w, h - 20) / GRID;
    const offX = (w - size * GRID) / 2;
    const offY = (h - size * GRID) / 2;
    return { x: offX + (slot % GRID) * size, y: offY + Math.floor(slot / GRID) * size, size };
  }

  function slotAt(mx, my) {
    for (let s = 0; s < GRID * GRID; s++) {
      const r = cellRect(s);
      if (mx >= r.x && mx < r.x + r.size && my >= r.y && my < r.y + r.size) return s;
    }
    return null;
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const s = slotAt(e.clientX - rect.left, e.clientY - rect.top);
    if (placing) {
      if (s !== null) {
        if (Game.startBuild(Game.state().activeBase, placing, s)) placing = null;
        draw();
      }
      return;
    }
    selectedSlot = s;
    if (s !== null) showBuildingModal(s);
    draw();
  }

  function onMouseMove(e) { draw(); }

  /* ---------- building modal ---------- */
  function showBuildingModal(slot) {
    const b = base();
    const bld = b.buildings.find(x => x.slot === slot);
    if (bld) {
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
        stats.push(`⏳ Under construction — finishes in ${fmtRemaining(bld.upgradeEndsAt - t)}`);
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
          btn.onclick = () => { Game.upgradeBuild(Game.state().activeBase, slot); closeModal("building-modal"); };
          actions.appendChild(btn);
        }
      }
      openModal("building-modal");
    } else {
      // empty slot -> offer build menu
      showBuildMenu(slot);
    }
  }

  function showBuildMenu(slot) {
    const b = base();
    const cc = Game.ccOf(b);
    document.getElementById("building-name").textContent = "🏗️ Construct Building";
    document.getElementById("building-desc").textContent = `Empty plot. Command Center level ${cc} allows buildings up to level ${cc + 1}.`;
    const stats = document.getElementById("building-stats");
    stats.innerHTML = "";

    const actions = document.getElementById("building-actions");
    actions.innerHTML = "";
    Object.entries(BUILDINGS).forEach(([type, def]) => {
      if (def.unique && b.buildings.some(x => x.type === type)) return;
      const cost = Game.buildingCost(type, 1);
      const costStr = Object.entries(cost).map(([r, a]) => `${a} ${r}`).join(", ");
      const btn = document.createElement("button");
      btn.className = "action";
      btn.innerHTML = `${def.icon} ${def.name}<br><small>${costStr} — ${def.buildTime}s</small>`;
      btn.onclick = () => {
        if (Game.startBuild(Game.state().activeBase, type, slot)) closeModal("building-modal");
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
  function draw() {
    if (!ctx) return;
    const st = Game.state();
    const b = st.bases[st.activeBase];
    if (!b) return;
    const w = canvas.width, h = canvas.height;

    // background: grass
    ctx.fillStyle = "#3e7a3e";
    ctx.fillRect(0, 0, w, h);

    const size = Math.min(w, h - 20) / GRID;
    const offX = (w - size * GRID) / 2;
    const offY = (h - size * GRID) / 2;

    // ocean border effect
    ctx.fillStyle = "#2a6ea0";
    ctx.fillRect(0, 0, w, offY);
    ctx.fillRect(0, h - offY, w, offY);
    if (offX > 0) {
      ctx.fillRect(0, 0, offX, h);
      ctx.fillRect(w - offX, 0, offX, h);
    }

    // grid
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const slot = gy * GRID + gx;
        const x = offX + gx * size, y = offY + gy * size;
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
        const bld = b.buildings.find(bl => bl.slot === slot);
        if (bld) {
          const def = BUILDINGS[bld.type];
          ctx.font = `${Math.floor(size * 0.45)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(def.icon, x + size / 2, y + size * 0.45);
          ctx.font = `bold ${Math.floor(size * 0.18)}px sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.fillText(`L${bld.level}`, x + size / 2, y + size * 0.85);
          if (bld.upgradeEndsAt && bld.upgradeEndsAt > Game.now()) {
            ctx.fillStyle = "rgba(255,180,0,0.75)";
            ctx.fillRect(x, y, size, 5);
          }
          ctx.fillStyle = "#fff";
        }
      }
    }

    // selected highlight
    if (selectedSlot !== null) {
      const r = cellRect(selectedSlot, w, h);
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 2, r.y + 2, r.size - 4, r.size - 4);
      ctx.lineWidth = 1;
    }

    // base name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${b.name} — Island: ${islandName(b)}`, w / 2, offY - 6);

    renderQueue(b);
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
      const total = Game.buildingTime(x.type, x.level);
      const left = x.upgradeEndsAt - t;
      const pct = Math.min(100, ((total - left) / total) * 100);
      html += `<div class="queue-item">${BUILDINGS[x.type].icon} ${BUILDINGS[x.type].name} — ${fmtRemaining(left)}<div class="bar"><div class="fill" style="width:${pct}%"></div></div></div>`;
    });
    b.training.forEach(tr => {
      const left = tr.endsAt - t;
      html += `<div class="queue-item">${UNITS[tr.unit].icon} ×${tr.count} — ${fmtRemaining(left)}</div>`;
    });
    if (!html) html = `<div class="queue-item">No construction or training in progress. Click an empty plot to build.</div>`;
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
