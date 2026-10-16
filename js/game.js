/* ===== Core game engine: state, resources, XP, battles, AI ===== */

const Game = (() => {
  const SAVE_KEY = "island-empires-save-v1";
  const TICK_MS = 1000;

  let state = null;
  let listeners = [];

  /* ---------- helpers ---------- */
  const now = () => Date.now() / 1000;

  function defaultState() {
    return {
      playerName: "Commander",
      createdAt: now(),
      lastTick: now(),
      resources: { oil: 400, steel: 600, gold: 150 },
      xp: 0,
      bases: [makeBase(0, 4, 8, "Home Base")], // start on Ironhold center island
      activeBase: 0,
      armies: {},              // armyId -> army
      battles: [],             // resolved battle reports
      detections: [],          // incoming attack warnings
      market: {
        prices: { ...MARKET_START },
        prev: { ...MARKET_START },
        volume: { oil: 0, steel: 0, gold: 0 },
      },
      ai: [],                  // AI players
      nextArmyId: 1,
      tutorialDone: false,
    };
  }

  function makeBase(id, gx, gy, name) {
    // 6x6 building grid; every base starts with a level-1 Command Center
    return {
      id, gx, gy, name,
      grid: [],        // 36 slots: null or { type, level, builtAt }
      buildings: [{ type: "command_center", level: 1, slot: 14, upgradeEndsAt: 0 }],
      level: 1,
      army: {},        // unitType -> count (garrison)
      training: [],    // { unit, count, endsAt }
    };
  }

  /* ---------- world helpers ---------- */
  function islandAt(gx, gy) {
    return ISLANDS.find(i =>
      gx >= i.x && gx < i.x + i.w && gy >= i.y && gy < i.y + i.h) || null;
  }
  function cellIsLand(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= WORLD.GRID_W || gy >= WORLD.GRID_H) return false;
    return !!islandAt(gx, gy);
  }

  /* Distance in grid cells between two points (chebyshev-ish, allows ocean crossing) */
  function distCells(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    return Math.max(dx, dy);
  }

  /* ---------- AI players ---------- */
  function makeAI(i, gx, gy) {
    const names = ["Admiral Nova", "General Krux", "Baron Vega", "Captain Rooke", "Marshal Dray", "Warlord Zahn", "Colonel Piper", "Duke Halvard"];
    return {
      id: "ai" + i,
      name: names[i % names.length],
      gx, gy,
      level: 1 + Math.floor(Math.random() * 3),
      power: 40 + Math.floor(Math.random() * 120),
      aggression: 0.15 + Math.random() * 0.5,
      nextAttackAt: now() + 600 + Math.random() * 1800, // first raid 10-50 min in
      ownerName: names[i % names.length],
    };
  }

  function initAI() {
    // Place 8 AI bases on islands, avoiding player start (Ironhold center = island 4)
    const spots = [];
    ISLANDS.forEach((isl, idx) => {
      if (idx === 4) return; // player island
      spots.push({ x: isl.x + Math.floor(isl.w / 2), y: isl.y + Math.floor(isl.h / 2), idx });
    });
    state.ai = spots.map((s, i) => makeAI(i, s.x, s.y));
  }

  /* ---------- resources & production ---------- */
  function tick() {
    const t = now();
    const dtHours = (t - state.lastTick) / 3600;
    state.lastTick = t;
    if (dtHours <= 0) return;

    // production per base
    state.bases.forEach(b => {
      b.buildings.forEach(bld => {
        if (bld.upgradeEndsAt && bld.upgradeEndsAt > t) return; // under construction
        const def = BUILDINGS[bld.type];
        if (def.produces) {
          const mult = bld.level;
          for (const [res, amt] of Object.entries(def.produces)) {
            state.resources[res] += amt * mult * dtHours;
          }
        }
      });
      // training completion
      b.training = b.training.filter(tr => {
        if (t >= tr.endsAt) {
          b.army[tr.unit] = (b.army[tr.unit] || 0) + tr.count;
          toast(`✅ ${tr.count} × ${UNITS[tr.unit].name} finished training at ${b.name}.`);
          return false;
        }
        return true;
      });
    });

    // market drift
    Market.tick(dtHours, t);

    // AI behaviour
    aiTick(t);

    // expire old detections (keep 30 min)
    state.detections = state.detections.filter(d => t - d.at < 1800);

    emit();
    save();
  }

  /* ---------- XP ---------- */
  function level() {
    let lvl = 1;
    for (let i = 1; i < XP_LEVELS.length; i++) {
      if (state.xp >= XP_LEVELS[i]) lvl = i + 1;
    }
    return lvl;
  }
  function addXP(amount) {
    const before = level();
    state.xp += amount;
    if (level() > before) toast(`🎉 Level up! You are now level ${level()}.`);
  }
  function xpProgress() {
    const lvl = level();
    const cur = XP_LEVELS[lvl - 1] || 0;
    const next = XP_LEVELS[lvl] || cur + 2500;
    return { cur: state.xp - cur, need: next - cur, lvl };
  }

  /* ---------- costs ---------- */
  function buildingCost(type, targetLevel) {
    const def = BUILDINGS[type];
    const cost = {};
    for (const [res, amt] of Object.entries(def.cost)) {
      cost[res] = Math.round(amt * Math.pow(def.costScale, targetLevel - 1));
    }
    return cost;
  }
  function buildingTime(type, targetLevel) {
    const def = BUILDINGS[type];
    return Math.round(def.buildTime * Math.pow(def.buildTimeScale, targetLevel - 1));
  }
  function canAfford(cost) {
    return Object.entries(cost).every(([r, a]) => state.resources[r] >= a);
  }
  function pay(cost) {
    if (!canAfford(cost)) return false;
    for (const [r, a] of Object.entries(cost)) state.resources[r] -= a;
    return true;
  }

  /* ---------- construction ---------- */
  function startBuild(baseIdx, type, slot) {
    const b = state.bases[baseIdx];
    const def = BUILDINGS[type];
    if (def.unique && b.buildings.some(x => x.type === type)) {
      toast.error(`You already have a ${def.name}.`, true);
      return false;
    }
    if (b.buildings.some(x => x.slot === slot)) {
      toast.error("That slot is occupied.", true);
      return false;
    }
    if (b.buildings.some(x => x.upgradeEndsAt && x.upgradeEndsAt > now())) {
      toast.error("Construction crew is busy. One project at a time per base.", true);
      return false;
    }
    const cost = buildingCost(type, 1);
    if (!pay(cost)) {
      toast.error("Not enough resources.", true);
      return false;
    }
    const bld = { type, level: 1, slot, upgradeEndsAt: now() + buildingTime(type, 1) };
    b.buildings.push(bld);
    toast(`🏗️ ${def.name} under construction at ${b.name}.`);
    emit(); save();
    return true;
  }

  function upgradeBuild(baseIdx, slot) {
    const b = state.bases[baseIdx];
    const bld = b.buildings.find(x => x.slot === slot);
    if (!bld) return false;
    const def = BUILDINGS[bld.type];
    if (bld.level >= def.maxLevel) {
      toast.error(`${def.name} is at max level.`, true);
      return false;
    }
    const ccLevel = ccOf(b);
    if (bld.level + 1 > ccLevel + 1) {
      toast.error(`Upgrade your Command Center first (needs level ${bld.level + 1}).`, true);
      return false;
    }
    if (b.buildings.some(x => x.upgradeEndsAt && x.upgradeEndsAt > now())) {
      toast.error("Construction crew is busy.", true);
      return false;
    }
    const cost = buildingCost(bld.type, bld.level + 1);
    if (!pay(cost)) {
      toast.error("Not enough resources.", true);
      return false;
    }
    bld.upgradeEndsAt = now() + buildingTime(bld.type, bld.level + 1);
    toast(`⬆️ Upgrading ${def.name} to level ${bld.level + 1}.`);
    emit(); save();
    return true;
  }

  function ccOf(base) {
    const cc = base.buildings.find(x => x.type === "command_center");
    return cc ? cc.level : 1;
  }

  /* ---------- training ---------- */
  function canTrain(base, unitType) {
    const def = UNITS[unitType];
    for (const [bld, lvl] of Object.entries(def.requires)) {
      const have = base.buildings.find(x => x.type === bld && x.level >= lvl &&
        !(x.upgradeEndsAt && x.upgradeEndsAt > now()));
      if (!have) return false;
    }
    return true;
  }

  function trainUnits(baseIdx, unitType, count) {
    const b = state.bases[baseIdx];
    const def = UNITS[unitType];
    if (!canTrain(b, unitType)) {
      toast.error(`Requires ${Object.entries(def.requires).map(([t, l]) => `${BUILDINGS[t].name} lvl ${l}`).join(", ")}.`, true);
      return false;
    }
    const cost = {};
    for (const [r, a] of Object.entries(def.cost)) cost[r] = a * count;
    if (!pay(cost)) {
      toast.error("Not enough resources.", true);
      return false;
    }
    b.training.push({ unit: unitType, count, endsAt: now() + def.trainTime * count });
    toast(`🎖️ Training ${count} × ${def.name}.`);
    emit(); save();
    return true;
  }

  /* ---------- armies & movement ---------- */
  function baseCenter(b) {
    return { x: b.gx + 0.5, y: b.gy + 0.5 };
  }

  function sendArmy(fromBaseIdx, toGx, toGy, units, targetId) {
    const from = state.bases[fromBaseIdx];
    const total = Object.values(units).reduce((a, b) => a + b, 0);
    if (total === 0) {
      toast.error("No units selected.", true);
      return false;
    }
    // check availability
    for (const [u, c] of Object.entries(units)) {
      if ((from.army[u] || 0) < c) {
        toast.error(`Not enough ${UNITS[u].name}.`, true);
        return false;
      }
    }
    // average speed of slowest domain present (ground 3-6, air 20-30, naval 10-12)
    let minSpeed = Infinity;
    for (const [u, c] of Object.entries(units)) {
      if (c > 0) minSpeed = Math.min(minSpeed, UNITS[u].speed);
    }
    const a = baseCenter(from);
    const dist = distCells(a.x, a.y, toGx + 0.5, toGy + 0.5);
    const travelHours = dist / minSpeed;
    const armyId = state.nextArmyId++;

    for (const [u, c] of Object.entries(units)) from.army[u] -= c;

    state.armies[armyId] = {
      id: armyId,
      owner: "player",
      fromBaseIdx: fromBaseIdx,
      from: { x: a.x, y: a.y },
      to: { x: toGx + 0.5, y: toGy + 0.5 },
      units,
      departedAt: now(),
      arrivesAt: now() + travelHours * 3600,
      target: targetId,       // ai id or "base:<idx>"
      recalled: false,
    };

    const hrs = Math.round(travelHours * 10) / 10;
    toast(`🚀 Army dispatched. Travel time: ${fmtHours(travelHours)}.`);
    emit(); save();
    return true;
  }

  function recallArmy(armyId) {
    const army = state.armies[armyId];
    if (!army || army.owner !== "player") return false;
    const hasComms = state.bases.some(b => b.buildings.some(x => x.type === "comms_tower" &&
      !(x.upgradeEndsAt && x.upgradeEndsAt > now())));
    if (!hasComms) {
      toast.error("Recall requires a Comms Tower.", true);
      return false;
    }
    if (army.recalled) return false;
    army.recalled = true;
    army.returnTo = { ...army.from };
    const elapsed = now() - army.departedAt;
    army.arrivesAt = now() + Math.max(60, elapsed * 0.8); // returns a bit faster
    army.target = null;
    toast("↩️ Army recalled. It is heading home.");
    emit(); save();
    return true;
  }

  /* ---------- AI ---------- */
  function aiTick(t) {
    if (!state.ai) return;
    state.ai.forEach(ai => {
      if (t < ai.nextAttackAt) return;
      ai.nextAttackAt = t + 900 + Math.random() * 2700; // next raid in 15-60 min
      if (Math.random() > ai.aggression) return;

      // pick a target: player base
      const target = state.bases[Math.floor(Math.random() * state.bases.length)];
      const strength = ai.power * (0.5 + Math.random());
      const units = {};
      if (strength > 150) units.tank = Math.floor(strength / 60);
      else if (strength > 60) units.ifv = Math.floor(strength / 25);
      else units.infantry = Math.floor(strength / 5);

      const from = { x: ai.gx + 0.5, y: ai.gy + 0.5 };
      const tc = baseCenter(target);
      const dist = distCells(from.x, from.y, tc.x, tc.y);
      const speed = units.tank ? 4 : units.ifv ? 6 : 3;
      const travelSec = dist / speed * 3600;

      const armyId = state.nextArmyId++;
      state.armies[armyId] = {
        id: armyId,
        owner: ai.id,
        from, to: tc,
        units,
        departedAt: t,
        arrivesAt: t + travelSec,
        target: "base:" + state.bases.indexOf(target),
        ownerName: ai.name,
      };

      // radar detection: fraction of travel detected early based on radar level
      let detectionLead = 0.25; // default notice
      state.bases.forEach(b => {
        const radar = b.buildings.find(x => x.type === "radar_station" &&
          !(x.upgradeEndsAt && x.upgradeEndsAt > now()));
        if (radar) detectionLead = Math.max(detectionLead,
          BUILDINGS.radar_station.detection.base + BUILDINGS.radar_station.detection.perLevel * (radar.level - 1));
      });
      const detectableAt = t + travelSec * (1 - detectionLead);
      state.detections.push({
        at: detectableAt,           // when warning appears
        arrivesAt: t + travelSec,
        attacker: ai.name,
        from: ai.name + "'s territory",
        strength: Math.round(Object.entries(units).reduce((s, [u, c]) => s + UNITS[u].power * c, 0)),
      });
    });
  }

  /* ---------- battle resolution ---------- */
  function armyPower(units) {
    return Object.entries(units).reduce((s, [u, c]) => s + UNITS[u].power * c, 0);
  }

  function resolveArrival(armyId) {
    const army = state.armies[armyId];
    if (!army) return;
    delete state.armies[armyId];

    if (army.owner === "player") {
      if (army.recalled) {
        // returned home
        const b = state.bases[army.fromBaseIdx];
        if (b) mergeArmy(b, army.units);
        else state.bases.forEach(x => mergeArmy(x, army.units));
        toast("↩️ Your army has returned home.");
        return;
      }
      if (typeof army.target === "string" && army.target.startsWith("base:")) {
        // attack on own base - ignore
        return;
      }
      // attack AI
      const ai = state.ai.find(a => a.id === army.target);
      if (!ai) return;
      const attackerPower = armyPower(army.units);
      const defenderPower = ai.power * (0.8 + Math.random() * 0.6);
      fightAI(army, ai, attackerPower, defenderPower);
    } else {
      // AI attacks player base
      const idx = typeof army.target === "string" ? parseInt(army.target.split(":")[1]) : state.activeBase;
      const b = state.bases[idx];
      if (!b) return;
      const defender = garrisonPower(b);
      const attacker = armyPower(army.units);
      const report = fight(b, army, attacker, defender);
      state.battles.unshift(report);
      state.battles = state.battles.slice(0, 20);
    }
  }

  function mergeArmy(base, units) {
    for (const [u, c] of Object.entries(units)) base.army[u] = (base.army[u] || 0) + c;
  }

  function garrisonPower(base) {
    return Object.entries(base.army).reduce((s, [u, c]) => s + UNITS[u].power * c, 0);
  }

  /* Simple auto-resolve: power ratio with random variance, loser loses most units */
  function fight(base, enemyArmy, attackerPower, defenderPower) {
    const t = now();
    const atkEff = attackerPower * (0.85 + Math.random() * 0.3);
    const defEff = defenderPower * (0.85 + Math.random() * 0.3) * 1.15; // defender bonus
    const playerWon = defEff >= atkEff;

    const report = {
      at: t,
      attacker: enemyArmy.ownerName || "Enemy",
      defender: base.name,
      playerWon,
      attackerLossPct: playerWon ? 1 : 0.4 + Math.random() * 0.3,
      defenderLossPct: playerWon ? Math.min(0.9, atkEff / defEff * 0.5) : 0.7 + Math.random() * 0.3,
      loot: null,
    };

    applyLosses(base.army, report.defenderLossPct);
    if (playerWon) addXP(30 + Math.round(attackerPower / 10));

    toast(report.playerWon
      ? `🛡️ Your base ${base.name} repelled an attack from ${report.attacker}!`
      : `💥 Your base ${base.name} was raided by ${report.attacker}. Losses taken.`,
      !report.playerWon);

    // raiders steal resources if they win
    if (!playerWon) {
      const steal = {};
      for (const r of ["oil", "steel", "gold"]) {
        const amt = Math.floor(state.resources[r] * 0.1);
        state.resources[r] -= amt;
        steal[r] = amt;
      }
      report.loot = steal;
    }
    return report;
  }

  function fightAI(army, ai, attackerPower, defenderPower) {
    const won = attackerPower * (0.85 + Math.random() * 0.3) >= defenderPower * (0.85 + Math.random() * 0.3);
    if (won) {
      ai.power = Math.max(10, ai.power * 0.5);
      const loot = {};
      for (const r of ["oil", "steel", "gold"]) {
        loot[r] = 50 + Math.floor(Math.random() * 150);
        state.resources[r] += loot[r];
      }
      addXP(40 + Math.round(defenderPower / 8));
      toast(`⚔️ Victory! You raided ${ai.name} and looted oil, steel and gold.`);
    } else {
      toast(`⚔️ Your attack on ${ai.name} was repelled. Army lost.`, true);
    }
    emit(); save();
  }

  function applyLosses(armyObj, pct) {
    for (const u of Object.keys(armyObj)) {
      armyObj[u] = Math.max(0, Math.floor(armyObj[u] * (1 - pct)));
      if (armyObj[u] === 0) delete armyObj[u];
    }
  }

  /* ---------- land purchase ---------- */
  function canBuyLand() {
    const lvl = level();
    const owned = state.bases.length;
    // need level 3 for 2nd base, +2 levels each additional
    const reqLevel = 1 + (owned) * 2; // 2nd base -> 3, 3rd -> 5, ...
    return { ok: lvl >= reqLevel, reqLevel, owned };
  }

  function buyLand(gx, gy) {
    const { ok, reqLevel } = canBuyLand();
    if (!ok) {
      toast.error(`You need level ${reqLevel} to buy another piece of land.`, true);
      return false;
    }
    if (!cellIsLand(gx, gy)) {
      toast.error("You can only build on land (island grids).", true);
      return false;
    }
    const occupied = state.bases.some(b => b.gx === gx && b.gy === gy) ||
      state.ai.some(a => a.gx === gx && a.gy === gy);
    if (occupied) {
      toast.error("That land is already occupied.", true);
      return false;
    }
    const cost = baseLandCost(state.bases.length + 1);
    if (!pay(cost)) {
      toast.error("Not enough resources to buy this land.", true);
      return false;
    }
    const b = makeBase(state.bases.length, gx, gy, `Base ${state.bases.length + 1}`);
    state.bases.push(b);
    addXP(100);
    toast(`🏝️ New land acquired at (${gx}, ${gy})! Build a Command Center to develop it.`);
    emit(); save();
    return true;
  }

  /* ---------- save / load ---------- */
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) { /* storage may be unavailable */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.bases) {
          // migrate: recompute lastTick against now
          state = parsed;
          state.lastTick = parsed.lastTick || now();
          return true;
        }
      }
    } catch (e) { /* corrupt save -> fresh start */ }
    return false;
  }

  function reset() {
    state = defaultState();
    initAI();
    save();
    emit();
  }

  /* ---------- events ---------- */
  function emit() {
    listeners.forEach(fn => fn(state));
  }
  function onChange(fn) { listeners.push(fn); }

  function fmtHours(h) {
    if (h < 1 / 60) return `${Math.round(h * 3600)}s`;
    if (h < 1) return `${Math.round(h * 60)} min`;
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return hrs > 0 ? `${hrs}h ${min}m` : `${min}m`;
  }

  /* ---------- army arrivals processing ---------- */
  function processArrivals() {
    const t = now();
    Object.keys(state.armies).forEach(id => {
      if (state.armies[id].arrivesAt <= t) resolveArrival(id);
    });
    // detections that become visible
    state.detections.forEach(d => {
      if (!d.shown && t >= d.at) {
        d.shown = true;
        toast(`⚠️ ${d.attacker}'s forces detected heading for your base! Strength ~${d.strength}. They arrive in ${fmtHours((d.arrivesAt - t) / 3600)}.`, true);
      }
    });
  }

  /* ---------- init ---------- */
  function init() {
    if (!load()) {
      reset();
    }
    setInterval(() => { tick(); processArrivals(); emit(); }, TICK_MS);
    tick();
  }

  return {
    init, state: () => state, save, reset, onChange, emit,
    level, addXP, xpProgress,
    islandAt, cellIsLand, distCells, fmtHours,
    buildingCost, buildingTime, canAfford, pay,
    startBuild, upgradeBuild, ccOf, canTrain, trainUnits,
    sendArmy, recallArmy, garrisonPower, armyPower,
    canBuyLand, buyLand, now,
  };
})();
