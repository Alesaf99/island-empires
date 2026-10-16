/* ===== Core game engine: state, resources, XP, class-based battles, AI ===== */

const Game = (() => {
  const SAVE_KEY = "island-empires-save-v3";
  const TICK_MS = 1000;
  const BASE_SIZE = 64;

  let state = null;
  let listeners = [];

  const now = () => Date.now() / 1000;

  function defaultState() {
    return {
      playerName: "Commander",
      createdAt: now(),
      lastTick: now(),
      resources: { oil: 400, steel: 600, gold: 150 },
      xp: 0,
      bases: [makeBase(0, 4, 8, "Home Base")],
      activeBase: 0,
      armies: {},
      battles: [],
      detections: [],
      market: {
        prices: { ...MARKET_START },
        prev: { ...MARKET_START },
        volume: { oil: 0, steel: 0, gold: 0 },
      },
      ai: [],
      nextArmyId: 1,
      tutorialDone: false,
    };
  }

  function makeBase(id, gx, gy, name) {
    const c = Math.floor(BASE_SIZE / 2) - 2;
    return {
      id, gx, gy, name,
      size: BASE_SIZE,
      buildings: [{ type: "command_center", level: 1, x: c, y: c, upgradeEndsAt: 0, upgradeTo: 1 }],
      level: 1,
      army: {},
      training: [],
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
      power: 300 + Math.floor(Math.random() * 900),
      aggression: 0.15 + Math.random() * 0.5,
      nextAttackAt: now() + 600 + Math.random() * 1800,
      ownerName: names[i % names.length],
    };
  }

  function initAI() {
    const spots = [];
    ISLANDS.forEach((isl, idx) => {
      if (idx === 4) return;
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

    state.bases.forEach(b => {
      b.buildings.forEach(bld => {
        if (bld.upgradeEndsAt && bld.upgradeEndsAt <= t) {
          if (bld.upgradeTo && bld.upgradeTo > bld.level) {
            bld.level = bld.upgradeTo;
            addXP(15 + bld.level * 5);
            toast(`✅ ${BUILDINGS[bld.type].name} upgraded to level ${bld.level} at ${b.name}.`);
          } else {
            toast(`✅ ${BUILDINGS[bld.type].name} completed at ${b.name}.`);
          }
          bld.upgradeEndsAt = 0;
          bld.upgradeTo = bld.level;
        }
        if (bld.upgradeEndsAt && bld.upgradeEndsAt > t) return;
        const def = BUILDINGS[bld.type];
        if (def.produces) {
          for (const [res, amt] of Object.entries(def.produces)) {
            state.resources[res] += amt * bld.level * dtHours;
          }
        }
      });
      b.training = b.training.filter(tr => {
        if (t >= tr.endsAt) {
          b.army[tr.unit] = (b.army[tr.unit] || 0) + tr.count;
          toast(`✅ ${tr.count} × ${UNITS[tr.unit].name} ready at ${b.name}.`);
          return false;
        }
        return true;
      });
    });

    Market.tick(dtHours, t);
    aiTick(t);
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

  /* ---------- building footprints ---------- */
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function canPlace(base, type, x, y) {
    const def = BUILDINGS[type];
    if (x < 0 || y < 0 || x + def.size.w > BASE_SIZE || y + def.size.h > BASE_SIZE) return false;
    return !base.buildings.some(b => {
      const bd = BUILDINGS[b.type];
      return rectsOverlap(x, y, def.size.w, def.size.h, b.x, b.y, bd.size.w, bd.size.h);
    });
  }
  function buildingAt(base, tx, ty) {
    return base.buildings.find(b => {
      const bd = BUILDINGS[b.type];
      return tx >= b.x && tx < b.x + bd.size.w && ty >= b.y && ty < b.y + bd.size.h;
    }) || null;
  }

  /* ---------- construction ---------- */
  function startBuild(baseIdx, type, x, y) {
    const b = state.bases[baseIdx];
    const def = BUILDINGS[type];
    if (def.unique && b.buildings.some(x2 => x2.type === type)) {
      toast.error(`You already have a ${def.name}.`, true);
      return false;
    }
    if (!canPlace(b, type, x, y)) {
      toast.error("Cannot build there — out of bounds or overlapping.", true);
      return false;
    }
    if (b.buildings.some(x2 => x2.upgradeEndsAt && x2.upgradeEndsAt > now())) {
      toast.error("Construction crew is busy. One project at a time per base.", true);
      return false;
    }
    const cost = buildingCost(type, 1);
    if (!pay(cost)) {
      toast.error("Not enough resources.", true);
      return false;
    }
    b.buildings.push({ type, level: 1, x, y, upgradeEndsAt: now() + buildingTime(type, 1), upgradeTo: 1 });
    toast(`🏗️ ${def.name} under construction at ${b.name}.`);
    emit(); save();
    return true;
  }

  function upgradeBuild(baseIdx, x, y) {
    const b = state.bases[baseIdx];
    const bld = b.buildings.find(bl => bl.x === x && bl.y === y);
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
    if (b.buildings.some(bl => bl.upgradeEndsAt && bl.upgradeEndsAt > now())) {
      toast.error("Construction crew is busy.", true);
      return false;
    }
    const cost = buildingCost(bld.type, bld.level + 1);
    if (!pay(cost)) {
      toast.error("Not enough resources.", true);
      return false;
    }
    bld.upgradeTo = bld.level + 1;
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
    if (state.resources.gold < def.price * count) {
      toast.error(`Not enough gold (${def.price * count} needed).`, true);
      return false;
    }
    state.resources.gold -= def.price * count;
    b.training.push({ unit: unitType, count, endsAt: now() + def.trainTime * count });
    toast(`🎖️ Training ${count} × ${def.name}.`);
    emit(); save();
    return true;
  }

  /* ---------- unit class helpers ---------- */
  const CLASS_KEY = {
    infantry: "inf", ground_veh: "gveh", jet: "air", bomber: "air",
    heli: "air", transport_heli: "air", ship: "sea", carrier: "sea",
    transport_ship: "sea", submarine: "sub",
  };
  function classOf(unitKey) { return CLASS_KEY[UNITS[unitKey].cls]; }

  function isTransport(u) { return (u.capacity || 0) > 0 || (u.jetCapacity || 0) > 0; }
  function isCarrier(u) { return (u.jetCapacity || 0) > 0; }

  /* Cargo slots: infantry = 1 slot, ground vehicle = 4 slots */
  function cargoSlots(units) {
    let slots = 0;
    for (const [k, c] of Object.entries(units)) {
      if (UNITS[k].cls === "infantry") slots += c;
      else if (UNITS[k].cls === "ground_veh") slots += c * 4;
    }
    return slots;
  }
  function transportCapacity(units) {
    let cap = 0;
    for (const [k, c] of Object.entries(units)) cap += (UNITS[k].capacity || 0) * c;
    return cap;
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
    for (const [u, c] of Object.entries(units)) {
      if ((from.army[u] || 0) < c) {
        toast.error(`Not enough ${UNITS[u].name}.`, true);
        return false;
      }
    }

    // cross-water rule: ground units need transports when crossing the ocean
    const fromIsland = islandAt(from.gx, from.gy);
    const toIsland = islandAt(toGx, toGy);
    const crossesWater = !fromIsland || !toIsland || fromIsland.id !== toIsland.id;

    const slotsNeeded = cargoSlots(units);
    const slotsAvail = transportCapacity(units);
    if (crossesWater && slotsNeeded > slotsAvail) {
      toast.error(`Ground units need transports to cross water (need ${slotsNeeded} cargo slots, have ${slotsAvail}).`, true);
      return false;
    }

    // army speed = slowest unit (loaded cargo rides with its transports)
    let minSpeed = Infinity;
    for (const [u, c] of Object.entries(units)) {
      if (c > 0) minSpeed = Math.min(minSpeed, UNITS[u].speed);
    }

    const a = baseCenter(from);
    const dist = distCells(a.x, a.y, toGx + 0.5, toGy + 0.5);
    const travelHours = Math.max(0.05, dist / minSpeed);
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
      target: targetId,
      recalled: false,
    };

    toast(`🚀 Army dispatched (${total} units). Travel time: ${fmtHours(travelHours)}.`);
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
    const elapsed = now() - army.departedAt;
    army.arrivesAt = now() + Math.max(60, elapsed * 0.8);
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
      ai.nextAttackAt = t + 900 + Math.random() * 2700;
      if (Math.random() > ai.aggression) return;

      const target = state.bases[Math.floor(Math.random() * state.bases.length)];
      const strength = ai.power * (0.5 + Math.random());
      const units = {};
      if (strength > 2000) { units.abrams = Math.max(1, Math.floor(strength / 4000)); units.at_soldier = Math.floor(strength / 500); }
      else if (strength > 800) { units.btr90 = Math.max(1, Math.floor(strength / 1900)); units.soldier = Math.floor(strength / 150); }
      else { units.soldier = Math.max(1, Math.floor(strength / 150)); units.at_soldier = Math.floor(strength / 250); }
      if (strength > 4000) units.hind = Math.floor(strength / 13000);
      if (strength > 8000) units.mig29 = Math.floor(strength / 19000);

      const from = { x: ai.gx + 0.5, y: ai.gy + 0.5 };
      const tc = baseCenter(target);
      const dist = distCells(from.x, from.y, tc.x, tc.y);
      let minSpeed = Infinity;
      for (const k of Object.keys(units)) minSpeed = Math.min(minSpeed, UNITS[k].speed);
      const travelSec = dist / minSpeed * 3600;

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

      let detectionLead = 0.25;
      state.bases.forEach(b => {
        const radar = b.buildings.find(x => x.type === "radar_station" &&
          !(x.upgradeEndsAt && x.upgradeEndsAt > now()));
        if (radar) detectionLead = Math.max(detectionLead,
          BUILDINGS.radar_station.detection.base + BUILDINGS.radar_station.detection.perLevel * (radar.level - 1));
        // SIGINT aircraft add early warning
        const sigint = b.buildings.some(x => x.type === "airfield" && x.level >= 3) &&
          Object.keys(b.army).some(k => UNITS[k].sigint);
        if (sigint) detectionLead = Math.max(detectionLead, 0.6);
      });
      const detectableAt = t + travelSec * (1 - detectionLead);
      state.detections.push({
        at: detectableAt,
        arrivesAt: t + travelSec,
        attacker: ai.name,
        strength: Math.round(estimatePower(units)),
      });
    });
  }

  /* Rough power estimate for display */
  function estimatePower(units) {
    return Object.entries(units).reduce((s, [u, c]) => {
      const d = UNITS[u].dmg || {};
      const best = Math.max(0, ...Object.values(d));
      return s + best * c;
    }, 0);
  }

  /* ---------- battle engine (class-based, rounds) ----------
     Rules implemented:
     - ground can't hit sea/sub; ships can't hit ground; jets only hit air;
       bombers can't hit jets; air-vs-ship damage ×0.7; stealth takes 50% less
     - transports destroyed -> their cargo is destroyed            */
  function dmgOf(unitKey, targetClass) {
    const def = UNITS[unitKey];
    let base = (def.dmg || {})[targetClass] || 0;
    // bombers hit ships with their general bomb load at 70%
    if (base === 0 && targetClass === "sea" && def.seaCapable) {
      base = ((def.dmg || {}).gveh || 0) * 0.7;
    }
    if (base > 0 && targetClass === "sea" && def.seaCapable) base *= 0.7;
    return base;
  }

  function armyPools(units) {
    const pools = {};
    for (const [k, c] of Object.entries(units)) {
      if (c > 0) pools[k] = { count: c, hp: UNITS[k].hp * c, def: UNITS[k] };
    }
    return pools;
  }

  function totalDamage(units, targetClass, pools) {
    let dmg = 0;
    for (const [k, c] of Object.entries(units)) {
      const alive = pools[k] ? pools[k].count : 0;
      if (alive > 0) dmg += dmgOf(k, targetClass) * alive;
    }
    return dmg;
  }

  function applyDamage(pools, targetClass, dmg) {
    const inClass = Object.keys(pools).filter(k => classOf(k) === targetClass && pools[k].count > 0);
    if (!inClass.length || dmg <= 0) return 0;
    const totalHp = inClass.reduce((s, k) => s + pools[k].hp, 0);
    for (const k of inClass) {
      const share = dmg * (pools[k].hp / totalHp);
      const u = pools[k];
      u.hp -= share;
      const dead = Math.max(0, Math.floor((u.def.hp * u.count - u.hp) / u.def.hp));
      u.count = Math.max(0, u.count - dead);
      u.hp = Math.min(u.hp, u.def.hp * u.count);
    }
    return dmg;
  }

  function poolsToUnits(pools) {
    const out = {};
    for (const [k, p] of Object.entries(pools)) {
      if (p.count > 0) out[k] = p.count;
    }
    return out;
  }

  function simulateBattle(atkUnits, defUnits) {
    const atkP = armyPools(atkUnits);
    const defP = armyPools(defUnits);
    const classes = ["inf", "gveh", "air", "sea", "sub"];
    let rounds = 0;

    while (rounds < 50) {
      rounds++;
      const atkShots = {}, defShots = {};
      for (const cls of classes) {
        atkShots[cls] = totalDamage(atkUnits, cls, atkP);
        defShots[cls] = totalDamage(defUnits, cls, defP);
      }
      for (const cls of classes) {
        if (atkShots[cls] > 0) applyDamage(defP, cls, atkShots[cls] * stealthFactor(defP, cls));
        if (defShots[cls] > 0) applyDamage(atkP, cls, defShots[cls] * stealthFactor(atkP, cls));
      }
      const atkAlive = Object.values(atkP).some(p => p.count > 0);
      const defAlive = Object.values(defP).some(p => p.count > 0);
      if (!atkAlive || !defAlive) break;
    }

    return { atk: poolsToUnits(atkP), def: poolsToUnits(defP), rounds };
  }

  /* average damage reduction from stealth units within a class */
  function stealthFactor(pools, cls) {
    const inClass = Object.keys(pools).filter(k => classOf(k) === cls && pools[k].count > 0);
    if (!inClass.length) return 1;
    const totalHp = inClass.reduce((s, k) => s + pools[k].hp, 0);
    let weighted = 0;
    for (const k of inClass) {
      const f = pools[k].def.stealth ? 0.5 : 1;
      weighted += f * pools[k].hp;
    }
    return weighted / totalHp;
  }

  /* If transports died, destroy cargo that no longer fits */
  function enforceCargo(unitsBefore, unitsAfter) {
    const capBefore = transportCapacity(unitsBefore);
    const capAfter = transportCapacity(unitsAfter);
    if (capAfter >= capBefore) return unitsAfter;
    const slots = cargoSlots(unitsAfter);
    const overflow = slots - capAfter;
    if (overflow <= 0) return unitsAfter;
    const out = { ...unitsAfter };
    let toKill = overflow;
    for (const k of Object.keys(out)) {
      if (toKill <= 0) break;
      if (UNITS[k].cls === "infantry") {
        const kill = Math.min(out[k], toKill);
        out[k] -= kill; toKill -= kill;
      }
    }
    for (const k of Object.keys(out)) {
      if (toKill <= 0) break;
      if (UNITS[k].cls === "ground_veh") {
        const killVeh = Math.min(out[k], Math.ceil(toKill / 4));
        out[k] -= killVeh; toKill -= killVeh * 4;
      }
    }
    for (const k of Object.keys(out)) if (out[k] <= 0) delete out[k];
    return out;
  }

  /* If carriers died, destroy their loaded aircraft */
  function enforceCarrierLoad(unitsBefore, unitsAfter) {
    const carriersBefore = Object.entries(unitsBefore)
      .filter(([k]) => isCarrier(UNITS[k])).reduce((s, [k, c]) => s + c, 0);
    const carriersAfter = Object.entries(unitsAfter)
      .filter(([k]) => isCarrier(UNITS[k])).reduce((s, [k, c]) => s + c, 0);
    if (carriersAfter >= carriersBefore || carriersBefore === 0) return unitsAfter;

    let jetCapBefore = 0, heliCapBefore = 0;
    for (const [k, c] of Object.entries(unitsBefore)) {
      if (isCarrier(UNITS[k])) { jetCapBefore += UNITS[k].jetCapacity * c; heliCapBefore += 10 * c; }
    }
    let jetCapAfter = 0, heliCapAfter = 0;
    for (const [k, c] of Object.entries(unitsAfter)) {
      if (isCarrier(UNITS[k])) { jetCapAfter += UNITS[k].jetCapacity * c; heliCapAfter += 10 * c; }
    }
    const out = { ...unitsAfter };
    const jetLoss = (jetCapBefore - jetCapAfter) / Math.max(1, jetCapBefore);
    const heliLoss = (heliCapBefore - heliCapAfter) / Math.max(1, heliCapBefore);
    for (const [k, c] of Object.entries(out)) {
      if (UNITS[k].carrierCapable) {
        out[k] = Math.max(0, Math.floor(c * (1 - jetLoss)));
      } else if (UNITS[k].cls === "heli" || UNITS[k].cls === "transport_heli") {
        out[k] = Math.max(0, Math.floor(c * (1 - heliLoss)));
      }
    }
    for (const k of Object.keys(out)) if (out[k] <= 0) delete out[k];
    return out;
  }

  /* ---------- battle resolution ---------- */
  function resolveArrival(armyId) {
    const army = state.armies[armyId];
    if (!army) return;
    delete state.armies[armyId];

    if (army.owner === "player") {
      if (army.recalled) {
        const b = state.bases[army.fromBaseIdx];
        if (b) mergeArmy(b, army.units);
        else state.bases.forEach(x => mergeArmy(x, army.units));
        toast("↩️ Your army has returned home.");
        emit(); save();
        return;
      }
      if (typeof army.target === "string" && army.target.startsWith("base:")) return;
      const ai = state.ai.find(a => a.id === army.target);
      if (!ai) return;

      // AI defense garrison
      const defUnits = aiGarrison(ai);
      const res = simulateBattle(army.units, defUnits);
      const survivors = enforceCarrierLoad(army.units, enforceCargo(army.units, res.atk));

      const attackerWon = Object.keys(survivors).length > 0 && !Object.keys(res.def).length;
      if (attackerWon) {
        ai.power = Math.max(100, ai.power * 0.6);
        const loot = {};
        for (const r of ["oil", "steel", "gold"]) {
          loot[r] = 200 + Math.floor(Math.random() * 600);
          state.resources[r] += loot[r];
        }
        addXP(40 + Math.round(estimatePower(defUnits) / 100));
        const b = state.bases[army.fromBaseIdx];
        if (b) mergeArmy(b, survivors);
        toast(`⚔️ Victory! You defeated ${ai.name}'s garrison and looted resources.`);
      } else {
        if (Object.keys(survivors).length > 0) {
          const b = state.bases[army.fromBaseIdx];
          if (b) mergeArmy(b, survivors);
          toast(`⚔️ Your attack on ${ai.name} was repelled. ${Object.values(survivors).reduce((a, c) => a + c, 0)} survivors limped home.`, true);
        } else {
          toast(`⚔️ Your attack on ${ai.name} was repelled. Army lost.`, true);
        }
      }
      emit(); save();
    } else {
      // AI attacks player base
      const idx = typeof army.target === "string" ? parseInt(army.target.split(":")[1]) : state.activeBase;
      const b = state.bases[idx];
      if (!b) return;

      const garrison = { ...b.army };
      const res = simulateBattle(army.units, garrison);
      const garrisonAfter = enforceCarrierLoad(garrison, enforceCargo(garrison, res.def));
      const raidersAfter = enforceCargo(army.units, res.atk);
      const playerWon = Object.keys(raidersAfter).length === 0;

      b.army = garrisonAfter;
      if (playerWon) {
        addXP(30 + Math.round(estimatePower(army.units) / 100));
        toast(`🛡️ Your base ${b.name} repelled ${army.ownerName}!`);
      } else {
        const steal = {};
        for (const r of ["oil", "steel", "gold"]) {
          const amt = Math.floor(state.resources[r] * 0.1);
          state.resources[r] -= amt;
          steal[r] = amt;
        }
        toast(`💥 ${b.name} was raided by ${army.ownerName}. 10% of each resource stolen.`, true);
      }
      state.battles.unshift({
        at: now(),
        attacker: army.ownerName,
        defender: b.name,
        playerWon,
      });
      state.battles = state.battles.slice(0, 20);
      emit(); save();
    }
  }

  function aiGarrison(ai) {
    const g = {};
    g.soldier = Math.max(2, Math.floor(ai.power / 150));
    g.at_soldier = Math.max(1, Math.floor(ai.power / 500));
    if (ai.power > 800) g.btr90 = Math.floor(ai.power / 1900);
    if (ai.power > 2000) g.abrams = Math.floor(ai.power / 4000);
    if (ai.power > 3000) g.aa_soldier = Math.floor(ai.power / 600);
    return g;
  }

  function mergeArmy(base, units) {
    for (const [u, c] of Object.entries(units)) base.army[u] = (base.army[u] || 0) + c;
  }

  function garrisonPower(base) {
    return estimatePower(base.army);
  }
  function armyPower(units) {
    return estimatePower(units);
  }

  /* ---------- land purchase ---------- */
  function canBuyLand() {
    const lvl = level();
    const owned = state.bases.length;
    const reqLevel = 1 + (owned) * 2;
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
    toast(`🏝️ New land acquired at (${gx}, ${gy})!`);
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
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) raw = localStorage.getItem("island-empires-save-v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.bases) {
          state = parsed;
          state.lastTick = parsed.lastTick || now();
          state.bases.forEach(b => { b.size = BASE_SIZE; });
          // prune units that no longer exist in the roster
          state.bases.forEach(b => {
            for (const k of Object.keys(b.army)) if (!UNITS[k]) delete b.army[k];
            b.training = b.training.filter(tr => UNITS[tr.unit]);
          });
          return true;
        }
      }
    } catch (e) { }
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
    state.detections.forEach(d => {
      if (!d.shown && t >= d.at) {
        d.shown = true;
        toast(`⚠️ ${d.attacker}'s forces detected heading for your base! Est. strength ~${d.strength}. Arrives in ${fmtHours((d.arrivesAt - t) / 3600)}.`, true);
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
    canPlace, buildingAt,
    startBuild, upgradeBuild, ccOf, canTrain, trainUnits,
    sendArmy, recallArmy, garrisonPower, armyPower,
    canBuyLand, buyLand, now, BASE_SIZE,
    classOf, cargoSlots, transportCapacity, simulateBattle, estimatePower,
  };
})();
