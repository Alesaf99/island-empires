/* ===== Game data: buildings, units, world layout ===== */

const WORLD = {
  GRID_W: 24,   // world grid columns
  GRID_H: 16,   // world grid rows
  CELL: 40,     // pixels per grid cell on the world map
};

/* Fixed island layout.
   Each island is a rectangle {x, y, w, h} in grid coordinates. */
const ISLANDS = [
  { id: 0, name: "Northhelm",    x: 2,  y: 1,  w: 4, h: 3 },
  { id: 1, name: "Ishgard",      x: 9,  y: 1,  w: 4, h: 3 },
  { id: 2, name: "Stormrock",    x: 17, y: 1,  w: 4, h: 3 },
  { id: 3, name: "Westmere",     x: 2,  y: 6,  w: 4, h: 4 },
  { id: 4, name: "Ironhold",     x: 9,  y: 6,  w: 5, h: 4 }, // center island, slightly larger
  { id: 5, name: "Eastwatch",    x: 17, y: 6,  w: 4, h: 4 },
  { id: 6, name: "Southbay",     x: 2,  y: 11, w: 4, h: 3 },
  { id: 7, name: "Cinderfall",   x: 9,  y: 11, w: 4, h: 3 },
  { id: 8, name: "Tidesong",     x: 17, y: 11, w: 4, h: 3 },
];

/* Buildings the player can construct in their base.
   size: footprint in tiles {w, h} on the 64x64 base grid.
   height: visual height in tiles (pseudo-3D).
   color: roof color. */
const BUILDINGS = {
  command_center: {
    name: "Command Center",
    icon: "🏛️",
    desc: "The heart of your base. Upgrading it unlocks higher building levels and earns XP.",
    maxLevel: 10,
    cost: { steel: 500, gold: 100 },
    costScale: 1.6,
    buildTime: 60,
    buildTimeScale: 1.7,
    produces: null,
    unique: true,
    size: { w: 4, h: 4 },
    height: 0.8,
    color: "#d9c9a3",
  },
  oil_rig: {
    name: "Oil Rig",
    icon: "🛢️",
    desc: "Pumps crude oil from underground reserves. Your economy's lifeblood.",
    maxLevel: 12,
    cost: { steel: 150 },
    costScale: 1.5,
    buildTime: 45,
    buildTimeScale: 1.6,
    produces: { oil: 60 },
    unique: false,
    size: { w: 3, h: 3 },
    height: 0.5,
    color: "#8a7a55",
  },
  steel_mill: {
    name: "Steel Mill",
    icon: "🏭",
    desc: "Refines iron into structural steel for buildings and vehicles.",
    maxLevel: 12,
    cost: { oil: 100 },
    costScale: 1.5,
    buildTime: 45,
    buildTimeScale: 1.6,
    produces: { steel: 50 },
    unique: false,
    size: { w: 3, h: 3 },
    height: 0.6,
    color: "#7d8a99",
  },
  gold_mine: {
    name: "Gold Mine",
    icon: "⛏️",
    desc: "Digs gold out of the rock. Everyone loves gold.",
    maxLevel: 12,
    cost: { steel: 200, oil: 100 },
    costScale: 1.55,
    buildTime: 50,
    buildTimeScale: 1.6,
    produces: { gold: 20 },
    unique: false,
    size: { w: 3, h: 3 },
    height: 0.5,
    color: "#c9a84c",
  },
  barracks: {
    name: "Barracks",
    icon: "🎖️",
    desc: "Trains ground units: infantry, IFVs, and tanks.",
    maxLevel: 8,
    cost: { steel: 250, oil: 100 },
    costScale: 1.5,
    buildTime: 60,
    buildTimeScale: 1.7,
    produces: null,
    unique: false,
    size: { w: 3, h: 3 },
    height: 0.5,
    color: "#6b8a4f",
  },
  airfield: {
    name: "Airfield",
    icon: "🛫",
    desc: "Operates fighter jets, transport aircraft, helicopters and SIGINT planes.",
    maxLevel: 8,
    cost: { steel: 400, oil: 200 },
    costScale: 1.5,
    buildTime: 75,
    buildTimeScale: 1.7,
    produces: null,
    unique: false,
    size: { w: 5, h: 4 },
    height: 0.25,
    color: "#5f6b7a",
  },
  harbor: {
    name: "Harbor",
    icon: "⚓",
    desc: "Builds and services ships and submarines.",
    maxLevel: 8,
    cost: { steel: 400, oil: 150 },
    costScale: 1.5,
    buildTime: 75,
    buildTimeScale: 1.7,
    produces: null,
    unique: false,
    size: { w: 4, h: 4 },
    height: 0.3,
    color: "#4f7d99",
  },
  radar_station: {
    name: "Radar Station",
    icon: "📡",
    desc: "Detects incoming troop movements earlier, giving you time to prepare.",
    maxLevel: 5,
    cost: { steel: 300, gold: 50 },
    costScale: 1.7,
    buildTime: 90,
    buildTimeScale: 1.8,
    produces: null,
    unique: false,
    detection: { base: 0.35, perLevel: 0.12 },
    size: { w: 2, h: 2 },
    height: 0.9,
    color: "#99a3b8",
  },
  market: {
    name: "Market",
    icon: "🏪",
    desc: "Trade oil, steel and gold on the global market. Higher level = lower trade tax.",
    maxLevel: 5,
    cost: { steel: 300, gold: 100 },
    costScale: 1.6,
    buildTime: 60,
    buildTimeScale: 1.6,
    produces: null,
    unique: false,
    taxBase: 0.10,
    taxPerLevel: 0.015,
    size: { w: 3, h: 3 },
    height: 0.6,
    color: "#c98a4f",
  },
  comms_tower: {
    name: "Comms Tower",
    icon: "🗼",
    desc: "Lets you recall troops that are en route. Higher level = faster recall.",
    maxLevel: 5,
    cost: { steel: 250, gold: 75 },
    costScale: 1.6,
    buildTime: 60,
    buildTimeScale: 1.6,
    produces: null,
    unique: false,
    size: { w: 2, h: 2 },
    height: 1.3,
    color: "#b8c0c9",
  },
};

/* Units.
   domain: ground | air | naval
   speed: map cells per hour
   power: combat strength
   cost: resources to train one unit
   trainTime: seconds to train
   requires: building type (with min level) needed to train */
const UNITS = {
  infantry:    { name: "Infantry",        icon: "🪖", domain: "ground", power: 5,   hp: 10,   speed: 3,   cost: { steel: 40, oil: 10 },  trainTime: 30,  requires: { barracks: 1 } },
  at_team:     { name: "AT Team",         icon: "🎯", domain: "ground", power: 12,  hp: 8,    speed: 3,   cost: { steel: 70, oil: 20 },  trainTime: 45,  requires: { barracks: 1 } },
  ifv:         { name: "IFV",             icon: "🚙", domain: "ground", power: 25,  hp: 30,   speed: 6,   cost: { steel: 120, oil: 40 }, trainTime: 70,  requires: { barracks: 2 } },
  tank:        { name: "Tank",            icon: "🔒", domain: "ground", power: 60,  hp: 80,   speed: 4,   cost: { steel: 250, oil: 80 }, trainTime: 120, requires: { barracks: 3 } },
  fighter_jet: { name: "Fighter Jet",     icon: "✈️", domain: "air",    power: 45,  hp: 25,   speed: 30,  cost: { steel: 300, oil: 150 }, trainTime: 150, requires: { airfield: 2 } },
  helicopter:  { name: "Helicopter",      icon: "🚁", domain: "air",    power: 30,  hp: 35,   speed: 20,  cost: { steel: 220, oil: 120 }, trainTime: 130, requires: { airfield: 1 } },
  transport:   { name: "Transport Plane", icon: "🛩️", domain: "air",  power: 2,   hp: 50,   speed: 25,  cost: { steel: 200, oil: 100 }, trainTime: 100, requires: { airfield: 1 }, capacity: 8 },
  sigint:      { name: "SIGINT Plane",    icon: "🛰️", domain: "air",    power: 0,   hp: 15,   speed: 28,  cost: { steel: 400, gold: 100 }, trainTime: 180, requires: { airfield: 3 } },
  ship:        { name: "Warship",         icon: "🚢", domain: "naval",  power: 55,  hp: 90,   speed: 12,  cost: { steel: 350, oil: 120 }, trainTime: 160, requires: { harbor: 2 } },
  submarine:   { name: "Submarine",       icon: "🌊", domain: "naval",  power: 40,  hp: 60,   speed: 10,  cost: { steel: 400, oil: 100 }, trainTime: 170, requires: { harbor: 3 } },
};

/* Player XP thresholds per level */
const XP_LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500, 8300, 10500, 13000, 16000];

/* Base (land plot) price scaling: n-th base costs */
function baseLandCost(n) {
  return { gold: 500 * Math.pow(2, n - 1), steel: 500 * Math.pow(2, n - 1) };
}

/* Market starting prices and drift */
const MARKET_START = { oil: 1.0, steel: 1.2, gold: 8.0 };
