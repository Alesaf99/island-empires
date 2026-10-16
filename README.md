# Island Empires 🏝️

A browser-based multiplayer-style strategy prototype: build your base on one of 9 fixed
islands, train land, air and naval units, raid AI rivals, and trade oil, steel and gold
on a global market with moving prices.

## How to run

Open `index.html` in any modern browser. Progress is saved automatically in the
browser (localStorage), so troops keep moving and buildings keep producing in real
time, even while the tab is closed.

## Gameplay guide

- **Base view:** click an empty plot to construct a building; click a building to
  upgrade it or open its function (training, market).
- **World map:** 9 islands, 8 AI commanders (⚑). Click one to attack, click an
  unclaimed plot to buy land for a new base (level 3 for the 2nd base, +2 levels each).
- **Combat:** armies travel in real time (distance ÷ slowest unit speed). Battles
  auto-resolve; defenders get a bonus. Radar warns of incoming attacks; a Comms
  Tower lets you recall troops.
- **Market:** oil/steel prices drift and your trades move them. Market building
  level lowers your trade tax.
- **XP:** from battles and land purchases; levels gate empire expansion.

## Roadmap
- Real multiplayer with shared world & lobbies
- Friends & alliances
- iOS/Android packaging via Capacitor
