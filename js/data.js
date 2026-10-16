/* ===== Game data: buildings, units, world layout ===== */

const WORLD = {
  GRID_W: 24,   // world grid columns
  GRID_H: 16,   // world grid rows
  CELL: 40,     // pixels per grid cell on the world map
};

/* Fixed island layout. */
const ISLANDS = [
  { id: 0, name: "Northhelm",    x: 2,  y: 1,  w: 4, h: 3 },
  { id: 1, name: "Ishgard",      x: 9,  y: 1,  w: 4, h: 3 },
  { id: 2, name: "Stormrock",    x: 17, y: 1,  w: 4, h: 3 },
  { id: 3, name: "Westmere",     x: 2,  y: 6,  w: 4, h: 4 },
  { id: 4, name: "Ironhold",     x: 9,  y: 6,  w: 5, h: 4 },
  { id: 5, name: "Eastwatch",    x: 17, y: 6,  w: 4, h: 4 },
  { id: 6, name: "Southbay",     x: 2,  y: 11, w: 4, h: 3 },
  { id: 7, name: "Cinderfall",   x: 9,  y: 11, w: 4, h: 3 },
  { id: 8, name: "Tidesong",     x: 17, y: 11, w: 4, h: 3 },
];

/* Buildings. size: footprint tiles. height: pseudo-3D height. */
const BUILDINGS = {
  command_center: {
    name: "Command Center", icon: "🏛️",
    desc: "The heart of your base. Its level caps the levels of other buildings.",
    maxLevel: 10, cost: { steel: 500, gold: 100 }, costScale: 1.6,
    buildTime: 60, buildTimeScale: 1.7, produces: null, unique: true,
    size: { w: 4, h: 4 }, height: 0.8, color: "#d9c9a3",
  },
  oil_rig: {
    name: "Oil Rig", icon: "🛢️",
    desc: "Pumps crude oil. Your economy's lifeblood.",
    maxLevel: 12, cost: { steel: 150 }, costScale: 1.5,
    buildTime: 45, buildTimeScale: 1.6, produces: { oil: 60 }, unique: false,
    size: { w: 3, h: 3 }, height: 0.5, color: "#8a7a55",
  },
  steel_mill: {
    name: "Steel Mill", icon: "🏭",
    desc: "Refines iron into structural steel.",
    maxLevel: 12, cost: { oil: 100 }, costScale: 1.5,
    buildTime: 45, buildTimeScale: 1.6, produces: { steel: 50 }, unique: false,
    size: { w: 3, h: 3 }, height: 0.6, color: "#7d8a99",
  },
  gold_mine: {
    name: "Gold Mine", icon: "⛏️",
    desc: "Digs gold out of the rock.",
    maxLevel: 12, cost: { steel: 200, oil: 100 }, costScale: 1.55,
    buildTime: 50, buildTimeScale: 1.6, produces: { gold: 20 }, unique: false,
    size: { w: 3, h: 3 }, height: 0.5, color: "#c9a84c",
  },
  barracks: {
    name: "Barracks", icon: "🎖️",
    desc: "Trains infantry: soldiers, anti-tank, anti-air, rangers and special forces.",
    maxLevel: 8, cost: { steel: 250, oil: 100 }, costScale: 1.5,
    buildTime: 60, buildTimeScale: 1.7, produces: null, unique: false,
    size: { w: 3, h: 3 }, height: 0.5, color: "#6b8a4f",
  },
  factory: {
    name: "Factory", icon: "🔧",
    desc: "Builds IFVs and armoured fighting vehicles.",
    maxLevel: 8, cost: { steel: 800, oil: 300 }, costScale: 1.5,
    buildTime: 90, buildTimeScale: 1.7, produces: null, unique: false,
    size: { w: 4, h: 4 }, height: 0.6, color: "#8a6d4f",
  },
  heavy_factory: {
    name: "Heavy Factory", icon: "⚙️",
    desc: "Builds main battle tanks.",
    maxLevel: 8, cost: { steel: 1500, oil: 500, gold: 200 }, costScale: 1.5,
    buildTime: 120, buildTimeScale: 1.7, produces: null, unique: false,
    size: { w: 5, h: 4 }, height: 0.7, color: "#5f5f6b",
  },
  airfield: {
    name: "Airfield", icon: "🛫",
    desc: "Operates fighter jets, bombers, helicopters and SIGINT aircraft.",
    maxLevel: 8, cost: { steel: 400, oil: 200 }, costScale: 1.5,
    buildTime: 75, buildTimeScale: 1.7, produces: null, unique: false,
    size: { w: 5, h: 4 }, height: 0.25, color: "#5f6b7a",
  },
  harbor: {
    name: "Harbor", icon: "⚓",
    desc: "Builds ships, submarines, carriers and transport ships.",
    maxLevel: 8, cost: { steel: 400, oil: 150 }, costScale: 1.5,
    buildTime: 75, buildTimeScale: 1.7, produces: null, unique: false,
    size: { w: 4, h: 4 }, height: 0.3, color: "#4f7d99",
  },
  radar_station: {
    name: "Radar Station", icon: "📡",
    desc: "Detects incoming troop movements earlier, giving you time to prepare.",
    maxLevel: 5, cost: { steel: 300, gold: 50 }, costScale: 1.7,
    buildTime: 90, buildTimeScale: 1.8, produces: null, unique: false,
    detection: { base: 0.35, perLevel: 0.12 },
    size: { w: 2, h: 2 }, height: 0.9, color: "#99a3b8",
  },
  market: {
    name: "Market", icon: "🏪",
    desc: "Trade oil, steel and gold on the global market. Higher level = lower tax.",
    maxLevel: 5, cost: { steel: 300, gold: 100 }, costScale: 1.6,
    buildTime: 60, buildTimeScale: 1.6, produces: null, unique: false,
    taxBase: 0.10, taxPerLevel: 0.015,
    size: { w: 3, h: 3 }, height: 0.6, color: "#c98a4f",
  },
  comms_tower: {
    name: "Comms Tower", icon: "🗼",
    desc: "Lets you recall troops that are en route.",
    maxLevel: 5, cost: { steel: 250, gold: 75 }, costScale: 1.6,
    buildTime: 60, buildTimeScale: 1.6, produces: null, unique: false,
    size: { w: 2, h: 2 }, height: 1.3, color: "#b8c0c9",
  },
};

/* ===== UNITS =====
   cls: unit class — infantry, ground_veh, jet, bomber, heli, transport_heli,
        ship, submarine, carrier, transport_ship
   dmg: damage per unit against target classes:
        inf (infantry), gveh (ground vehicles), air (jets/bombers/helicopters),
        sea (surface ships), sub (submarines)
   stealth: incoming damage reduced 50%
   speed: world map cells per hour
   price: gold cost
   capacity: transport slots (1 infantry = 1 slot, 1 ground vehicle = 4 slots)
   carrierCapable: may be loaded onto an aircraft carrier
   seaCapable: bomber anti-ship damage allowed (dealt at 70%)
   sigint: fraction of extra early warning provided */
const UNITS = {
  /* ---- Infantry (Barracks) ---- */
  soldier:    { name: "Soldier",            icon: "🪖", cls: "infantry", domain: "ground", hp: 200,  dmg: { inf: 100, gveh: 10 },  stealth: false, speed: 2,  price: 150,   trainTime: 30,  requires: { barracks: 1 } },
  at_soldier: { name: "Anti-tank Soldier", icon: "🎯", cls: "infantry", domain: "ground", hp: 200,  dmg: { inf: 100, gveh: 500 }, stealth: false, speed: 2,  price: 250,   trainTime: 40,  requires: { barracks: 1 } },
  aa_soldier: { name: "Anti-air Soldier",  icon: "🚩", cls: "infantry", domain: "ground", hp: 200,  dmg: { inf: 50, air: 700 },   stealth: false, speed: 2,  price: 300,   trainTime: 45,  requires: { barracks: 1 } },
  ranger:     { name: "Ranger",            icon: "🏕️", cls: "infantry", domain: "ground", hp: 350,  dmg: { inf: 300, gveh: 50 },  stealth: false, speed: 2,  price: 600,   trainTime: 60,  requires: { barracks: 2 } },
  delta:      { name: "Delta Operator",    icon: "🕶️", cls: "infantry", domain: "ground", hp: 600,  dmg: { inf: 500, gveh: 100 }, stealth: true,  speed: 3,  price: 850,   trainTime: 90,  requires: { barracks: 3 } },
  devgru:     { name: "DEVGRU Operator",   icon: "🥷", cls: "infantry", domain: "ground", hp: 1000, dmg: { inf: 750, gveh: 100 }, stealth: true,  speed: 3,  price: 1150,  trainTime: 120, requires: { barracks: 4 } },

  /* ---- IFVs (Factory) ---- */
  cv90:    { name: "CV90",       icon: "🚙", cls: "ground_veh", domain: "ground", hp: 1200, dmg: { inf: 1300, gveh: 800 }, stealth: false, speed: 25, price: 1900, trainTime: 180, requires: { factory: 1 } },
  bradley: { name: "M2 Bradley", icon: "🚐", cls: "ground_veh", domain: "ground", hp: 1400, dmg: { inf: 1100, gveh: 700 }, stealth: false, speed: 24, price: 2200, trainTime: 180, requires: { factory: 1 } },
  btr90:   { name: "BTR-90",    icon: "🛻", cls: "ground_veh", domain: "ground", hp: 1600, dmg: { inf: 700, gveh: 900 },  stealth: false, speed: 22, price: 1900, trainTime: 180, requires: { factory: 1 } },

  /* ---- Main battle tanks (Heavy Factory) ---- */
  leopard2a8: { name: "Leopard 2A8", icon: "🛡️", cls: "ground_veh", domain: "ground", hp: 2000, dmg: { inf: 1000, gveh: 1000 }, stealth: false, speed: 22, price: 4100, trainTime: 240, requires: { heavy_factory: 1 } },
  abrams:     { name: "M1 Abrams",  icon: "⚙️", cls: "ground_veh", domain: "ground", hp: 1900, dmg: { inf: 900, gveh: 1100 },  stealth: false, speed: 20, price: 4000, trainTime: 240, requires: { heavy_factory: 1 } },

  /* ---- Fighter jets (Airfield) — ONLY hit jets, bombers, helicopters ---- */
  jas39:  { name: "JAS 39 Gripen", icon: "✈️", cls: "jet", domain: "air", hp: 3000, dmg: { air: 5200 }, stealth: false, speed: 301, price: 24000, trainTime: 600, requires: { airfield: 2 } },
  f16:    { name: "F-16",          icon: "✈️", cls: "jet", domain: "air", hp: 3000, dmg: { air: 5000 }, stealth: false, speed: 310, price: 21000, trainTime: 600, requires: { airfield: 2 } },
  mig29:  { name: "MiG-29",       icon: "✈️", cls: "jet", domain: "air", hp: 4300, dmg: { air: 4700 }, stealth: false, speed: 360, price: 19000, trainTime: 600, requires: { airfield: 2 } },
  viggen: { name: "JA 37 Viggen", icon: "✈️", cls: "jet", domain: "air", hp: 4800, dmg: { air: 4500 }, stealth: false, speed: 410, price: 17500, trainTime: 600, requires: { airfield: 2 } },
  fa18:   { name: "F/A-18",       icon: "🛩️", cls: "jet", domain: "air", hp: 5000, dmg: { air: 5100 }, stealth: false, speed: 370, price: 28000, trainTime: 600, requires: { airfield: 3 }, carrierCapable: true },
  rafale: { name: "Rafale",       icon: "🛩️", cls: "jet", domain: "air", hp: 3200, dmg: { air: 3200 }, stealth: false, speed: 305, price: 17000, trainTime: 600, requires: { airfield: 3 }, carrierCapable: true },
  rc135:  { name: "RC-135U (SIGINT)", icon: "🛰️", cls: "jet", domain: "air", hp: 2000, dmg: {}, stealth: false, speed: 350, price: 16000, trainTime: 600, requires: { airfield: 3 }, sigint: 0.15 },

  /* ---- Bombers (Airfield) — CANNOT hit jets; anti-ship damage at 70% ---- */
  b52:   { name: "B-52",       icon: "🦅", cls: "bomber", domain: "air", hp: 6000, dmg: { inf: 3000, gveh: 9000 }, stealth: false, speed: 210, price: 42000, trainTime: 900, requires: { airfield: 2 }, seaCapable: true },
  su34:  { name: "Su-34",      icon: "🦅", cls: "bomber", domain: "air", hp: 4500, dmg: { inf: 8000, gveh: 6000 }, stealth: false, speed: 270, price: 34000, trainTime: 900, requires: { airfield: 2 }, seaCapable: true },
  b1:    { name: "B-1 Lancer", icon: "🦅", cls: "bomber", domain: "air", hp: 4700, dmg: { inf: 2000, gveh: 7000 }, stealth: false, speed: 295, price: 37000, trainTime: 900, requires: { airfield: 3 }, seaCapable: true },
  tu160: { name: "Tu-160",     icon: "🦅", cls: "bomber", domain: "air", hp: 6000, dmg: { inf: 2000, gveh: 3000 }, stealth: false, speed: 250, price: 33000, trainTime: 900, requires: { airfield: 3 }, seaCapable: true },
  tu22m: { name: "Tu-22M",    icon: "🦅", cls: "bomber", domain: "air", hp: 3200, dmg: { inf: 3000, gveh: 5000 }, stealth: false, speed: 260, price: 32000, trainTime: 900, requires: { airfield: 3 }, seaCapable: true },
  b2:    { name: "B-2 Spirit", icon: "🛸", cls: "bomber", domain: "air", hp: 2600, dmg: { inf: 2900, gveh: 8000 }, stealth: true,  speed: 235, price: 69000, trainTime: 900, requires: { airfield: 4 }, seaCapable: true },

  /* ---- Attack helicopters (Airfield) ---- */
  apache:   { name: "AH-64 Apache",    icon: "🚁", cls: "heli", domain: "air", hp: 1300, dmg: { inf: 1300, gveh: 3000 }, stealth: false, speed: 110, price: 13000, trainTime: 300, requires: { airfield: 1 } },
  comanche: { name: "RAH-66 Comanche", icon: "🚁", cls: "heli", domain: "air", hp: 1300, dmg: { inf: 1300, gveh: 3000 }, stealth: true,  speed: 100, price: 22000, trainTime: 300, requires: { airfield: 2 } },
  hind:     { name: "Mi-24 Hind",     icon: "🚁", cls: "heli", domain: "air", hp: 2100, dmg: { inf: 1800, gveh: 1200 }, stealth: false, speed: 95,  price: 13000, trainTime: 300, requires: { airfield: 1 } },
  havoc:    { name: "Mi-28 Havoc",    icon: "🚁", cls: "heli", domain: "air", hp: 2200, dmg: { inf: 2300, gveh: 1300 }, stealth: false, speed: 95,  price: 15600, trainTime: 300, requires: { airfield: 2 } },
  heli9a:  { name: "Helikopter 9A",   icon: "🚁", cls: "heli", domain: "air", hp: 1400, dmg: { gveh: 3200 },               stealth: false, speed: 65,  price: 9800,  trainTime: 300, requires: { airfield: 1 } },

  /* ---- Anti-submarine helicopters (Airfield) ---- */
  nh90:  { name: "NH90",   icon: "🚁", cls: "heli", domain: "air", hp: 1400, dmg: { sub: 500 }, stealth: false, speed: 60, price: 14000, trainTime: 300, requires: { airfield: 2 } },
  mh60r: { name: "MH-60R", icon: "🚁", cls: "heli", domain: "air", hp: 1400, dmg: { sub: 470 }, stealth: false, speed: 55, price: 12100, trainTime: 300, requires: { airfield: 2 } },

  /* ---- Transport helicopters (Airfield) — carry ground units ---- */
  uh60: { name: "UH-60 Blackhawk",   icon: "🚁", cls: "transport_heli", domain: "air", hp: 1800, dmg: { inf: 300 }, stealth: false, speed: 50, price: 5100,  trainTime: 240, requires: { airfield: 1 }, capacity: 8 },
  sh60: { name: "SH-60 Seahawk",    icon: "🚁", cls: "transport_heli", domain: "air", hp: 1800, dmg: { inf: 300 }, stealth: false, speed: 50, price: 5600,  trainTime: 240, requires: { airfield: 1 }, capacity: 8 },
  mhx:  { name: "MH-X Stealthhawk", icon: "🚁", cls: "transport_heli", domain: "air", hp: 1400, dmg: { inf: 150 }, stealth: true,  speed: 48, price: 18000, trainTime: 240, requires: { airfield: 3 }, capacity: 8 },

  /* ---- Ships (Harbor) — deal NO damage to ground ---- */
  arleigh:     { name: "Arleigh Burke-class",       icon: "🚢", cls: "ship", domain: "naval", hp: 35000, dmg: { air: 6000, sea: 12900, sub: 900 },  stealth: false, speed: 10, price: 142000, trainTime: 1800, requires: { harbor: 2 } },
  daring:      { name: "Daring-class",              icon: "🚢", cls: "ship", domain: "naval", hp: 28000, dmg: { air: 7000, sea: 9800, sub: 600 },   stealth: false, speed: 13, price: 121000, trainTime: 1800, requires: { harbor: 2 } },
  lulea:       { name: "Luleå-class",               icon: "🚢", cls: "ship", domain: "naval", hp: 31000, dmg: { air: 7200, sea: 10900, sub: 900 }, stealth: false, speed: 14, price: 109500, trainTime: 1800, requires: { harbor: 2 } },
  type26:      { name: "Type 26 frigate",           icon: "🚢", cls: "ship", domain: "naval", hp: 26000, dmg: { air: 5200, sea: 9900, sub: 500 },  stealth: false, speed: 11, price: 114200, trainTime: 1800, requires: { harbor: 2 } },
  ticonderoga: { name: "Ticonderoga-class",         icon: "⛴️", cls: "ship", domain: "naval", hp: 42000, dmg: { air: 8000, sea: 13900, sub: 600 }, stealth: false, speed: 10, price: 159000, trainTime: 1800, requires: { harbor: 3 } },
  udaloy:      { name: "Udaloy-class",              icon: "🚢", cls: "ship", domain: "naval", hp: 31000, dmg: { air: 1200, sea: 10900, sub: 1600 }, stealth: false, speed: 9,  price: 133000, trainTime: 1800, requires: { harbor: 3 } },
  kirov:       { name: "Kirov-class battlecruiser", icon: "⛴️", cls: "ship", domain: "naval", hp: 71000, dmg: { air: 4000, sea: 16200, sub: 2300 }, stealth: false, speed: 11, price: 264000, trainTime: 1800, requires: { harbor: 4 } },
  katanpaa:    { name: "Katanpää-class minehunter", icon: "🛥️", cls: "ship", domain: "naval", hp: 3800,  dmg: { air: 2000, sea: 7100, sub: 1000 },  stealth: false, speed: 11, price: 62000,  trainTime: 1800, requires: { harbor: 1 } },

  /* ---- Submarines (Harbor) ---- */
  seawolf: { name: "Seawolf-class submarine", icon: "🌊", cls: "submarine", domain: "naval", hp: 1700, dmg: { sea: 26000, sub: 26000 }, stealth: true, speed: 7, price: 324000, trainTime: 2400, requires: { harbor: 3 } },

  /* ---- Aircraft carriers (Harbor) — come WITHOUT aircraft ---- */
  nimitz: { name: "Nimitz-class carrier",         icon: "🛫", cls: "carrier", domain: "naval", hp: 121000, dmg: { air: 4000 }, stealth: false, speed: 12, price: 624000, trainTime: 7200, requires: { harbor: 5 }, jetCapacity: 68 },
  ford:   { name: "Gerald R. Ford-class carrier", icon: "🛫", cls: "carrier", domain: "naval", hp: 163000, dmg: { air: 4000 }, stealth: false, speed: 13, price: 860000, trainTime: 7200, requires: { harbor: 6 }, jetCapacity: 75 },

  /* ---- Transport ship (Harbor) — carries ground units across the ocean ---- */
  bobhope: { name: "Transport Ship", icon: "🚢", cls: "transport_ship", domain: "naval", hp: 20000, dmg: {}, stealth: false, speed: 12, price: 95000, trainTime: 1200, requires: { harbor: 2 }, capacity: 100 },
};

/* XP thresholds per level */
const XP_LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500, 8300, 10500, 13000, 16000];

/* n-th base costs */
function baseLandCost(n) {
  return { gold: 500 * Math.pow(2, n - 1), steel: 500 * Math.pow(2, n - 1) };
}

/* Market starting prices */
const MARKET_START = { oil: 1.0, steel: 1.2, gold: 8.0 };
