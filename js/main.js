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

  // top bar refresh
  Game.onChange(() => updateTopbar());
  updateTopbar();

  // redraw canvases every second (timers, progress)
  setInterval(() => {
    if (baseView.classList.contains("active")) BaseView.draw();
    if (mapView.classList.contains("active")) MapView.draw();
  }, 1000);

  if (!Game.state().tutorialDone) {
    toast("👋 Welcome, Commander! Click the ground in your base to build. Drag to pan, scroll to zoom.");
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
