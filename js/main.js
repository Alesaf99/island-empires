/* ===== Main: init, UI wiring, top bar updates ===== */

/* ---------- modal helpers (global) ---------- */
function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

/* ---------- toast (global, used by Game) ---------- */
function toast(msg, isError) {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
toast.error = (msg) => toast(msg, true);

/* ---------- app bootstrap ---------- */
(function main() {
  Game.init();

  const baseView = document.getElementById("base-view");
  const mapView = document.getElementById("map-view");

  BaseView.init();
  MapView.init();

  // view switching
  document.getElementById("btn-base").onclick = () => {
    baseView.classList.add("active");
    mapView.classList.remove("active");
    document.getElementById("btn-base").classList.add("active");
    document.getElementById("btn-map").classList.remove("active");
    BaseView.resize();
  };
  document.getElementById("btn-map").onclick = () => {
    mapView.classList.add("active");
    baseView.classList.remove("active");
    document.getElementById("btn-map").classList.add("active");
    document.getElementById("btn-base").classList.remove("active");
    MapView.resize();
  };

  // modal close buttons
  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.onclick = () => btn.closest(".modal").classList.add("hidden");
  });
  document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  });

  /* ---------- production-per-hour panel (toggle by clicking the resource bar) ---------- */
  const resBar = document.getElementById("resources");
  const prodPanel = document.createElement("div");
  prodPanel.id = "prod-panel";
  prodPanel.classList.add("hidden");
  document.getElementById("topbar").appendChild(prodPanel);
  let prodOpen = false;
  resBar.style.cursor = "pointer";
  resBar.title = "Click to show production per hour";
  resBar.onclick = () => {
    prodOpen = !prodOpen;
    prodPanel.classList.toggle("hidden", !prodOpen);
    updateProdPanel();
  };

  function updateProdPanel() {
    if (!prodOpen) return;
    const st = Game.state();
    const prod = Game.productionPerHour();
    let html = `<div class="pp-row">
      <span title="Oil">🛢 +${Math.floor(prod.oil)}/h</span>
      <span title="Steel">🔩 +${Math.floor(prod.steel)}/h</span>
      <span title="Gold">💰 +${Math.floor(prod.gold)}/h</span></div>`;
    // per-building breakdown
    const t = Game.now();
    const lines = [];
    st.bases.forEach(b => b.buildings.forEach(x => {
      const def = BUILDINGS[x.type];
      if (!def.produces) return;
      if (x.upgradeEndsAt && x.upgradeEndsAt > t) return;
      for (const [r, amt] of Object.entries(def.produces)) {
        lines.push(`<div>${b.name}: ${def.icon} ${def.name} Lv${x.level} → +${amt * x.level} ${r}/h</div>`);
      }
    }));
    html += `<div class="pp-detail">${lines.length ? lines.join("") : "No production buildings yet — build Oil Rigs, Steel Mills and Gold Mines."}</div>`;
    prodPanel.innerHTML = html;
  }

  // top bar refresh (also refreshes the production panel while open)
  Game.onChange(() => { updateTopbar(); updateProdPanel(); });
  updateTopbar();

  // redraw canvases every second (timers, progress)
  setInterval(() => {
    if (baseView.classList.contains("active")) BaseView.draw();
    if (mapView.classList.contains("active")) MapView.draw();
  }, 1000);

  if (!Game.state().tutorialDone) {
    toast("👋 Welcome, Commander! Click an empty plot in your base to build. Drag to pan, scroll to zoom.");
    toast("💡 Build Oil Rigs and Steel Mills to grow your economy, then a Barracks to train troops.");
    Game.state().tutorialDone = true;
    Game.save();
  }
})();

function updateTopbar() {
  const st = Game.state();
  document.getElementById("res-oil").textContent = Math.floor(st.resources.oil);
  document.getElementById("res-steel").textContent = Math.floor(st.resources.steel);
  document.getElementById("res-gold").textContent = Math.floor(st.resources.gold);
  const xp = Game.xpProgress();
  document.getElementById("player-level").textContent = `Level ${xp.lvl}`;
  document.getElementById("player-xp").textContent = `XP ${xp.cur}/${xp.need}`;
}
