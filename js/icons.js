/* ===== Vector unit icons — drawn procedurally, no image files needed.
   Every icon draws inside a box of `size` centered at (cx, cy).
   F-22-style delta jets, swept bombers, helicopters, tanks, ships etc. */

const Icons = (() => {

  /* helper: draw in a rotated, centered frame */
  function frame(ctx, cx, cy, size, heading, fn) {
    ctx.save();
    ctx.translate(cx, cy);
    if (heading !== undefined) ctx.rotate(heading);
    const s = size / 2;
    fn(s);
    ctx.restore();
  }

  function strokeFill(ctx, fill, stroke) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, size_hint * 0.06); ctx.stroke(); ctx.lineWidth = 1; }
  }
  let size_hint = 10;

  /* ---- fighter jet: dart silhouette (F-22 style delta wings) ---- */
    /* ---- fighter jet: F-22 Raptor planform (blended diamond wing, twin canted tails, two engine nozzles) ---- */
  function jet(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      ctx.beginPath();
      ctx.moveTo(s, 0);                          // pointed nose
      ctx.lineTo(s * 0.35, s * 0.10);           // chine
      ctx.lineTo(s * 0.25, s * 0.16);           // wing root
      ctx.lineTo(-s * 0.45, s * 0.72);          // starboard wingtip
      ctx.lineTo(-s * 0.52, s * 0.50);          // trailing-edge kink
      ctx.lineTo(-s * 0.95, s * 0.46);          // stabilator tip
      ctx.lineTo(-s * 0.95, 0);                 // rear center
      ctx.lineTo(-s * 0.95, -s * 0.46);
      ctx.lineTo(-s * 0.52, -s * 0.50);
      ctx.lineTo(-s * 0.45, -s * 0.72);
      ctx.lineTo(s * 0.25, -s * 0.16);
      ctx.lineTo(s * 0.35, -s * 0.10);
      ctx.closePath();
      strokeFill(ctx, fill, stroke);
      // twin canted vertical stabilizers (seen edge-on from above)
      ctx.fillStyle = shadeLocal(fill, 0.7);
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.14); ctx.lineTo(-s * 0.62, s * 0.34); ctx.lineTo(-s * 0.70, s * 0.30); ctx.lineTo(-s * 0.42, s * 0.10);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 0.14); ctx.lineTo(-s * 0.62, -s * 0.34); ctx.lineTo(-s * 0.70, -s * 0.30); ctx.lineTo(-s * 0.42, -s * 0.10);
      ctx.closePath(); ctx.fill();
      // two rectangular engine nozzles
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-s * 0.95, -s * 0.16, s * 0.18, s * 0.13);
      ctx.fillRect(-s * 0.95, s * 0.03, s * 0.18, s * 0.13);
      // cockpit canopy
      ctx.beginPath();
      ctx.moveTo(s * 0.72, 0);
      ctx.lineTo(s * 0.30, s * 0.09);
      ctx.lineTo(s * 0.12, 0);
      ctx.lineTo(s * 0.30, -s * 0.09);
      ctx.closePath();
      ctx.fillStyle = "rgba(140,200,255,0.9)";
      ctx.fill();
    });
  }
  

  /* ---- bomber: wide straight wings, long fuselage ---- */
  function bomber(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s * 0.35, s * 0.12);
      ctx.lineTo(s * 0.25, s * 0.95);   // left wingtip
      ctx.lineTo(-s * 0.1, s * 0.95);
      ctx.lineTo(-s * 0.2, s * 0.2);
      ctx.lineTo(-s * 0.95, s * 0.35);  // left tailplane
      ctx.lineTo(-s * 0.95, -s * 0.35);
      ctx.lineTo(-s * 0.2, -s * 0.2);
      ctx.lineTo(-s * 0.1, -s * 0.95);
      ctx.lineTo(s * 0.25, -s * 0.95);
      ctx.lineTo(s * 0.35, -s * 0.12);
      ctx.closePath();
      strokeFill(ctx, fill, stroke);
      // engine dots
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (const ex of [0.05, 0.35]) {
        ctx.beginPath(); ctx.arc(-s * ex, s * 0.5, s * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-s * ex, -s * 0.5, s * 0.07, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  /* ---- helicopter: body, tail boom, rotors ---- */
  function heli(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // tail boom
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, 0);
      ctx.lineTo(-s * 0.1, -s * 0.12);
      ctx.lineTo(-s * 0.1, s * 0.12);
      ctx.closePath();
      strokeFill(ctx, shadeLocal(fill, 0.8), stroke);
      // body
      ctx.beginPath();
      ctx.ellipse(s * 0.15, 0, s * 0.45, s * 0.3, 0, 0, Math.PI * 2);
      strokeFill(ctx, fill, stroke);
      // cockpit glass
      ctx.beginPath();
      ctx.ellipse(s * 0.4, 0, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(140,200,255,0.9)";
      ctx.fill();
      // main rotor
      ctx.strokeStyle = stroke || "#222";
      ctx.lineWidth = Math.max(1, s * 0.09);
      ctx.beginPath(); ctx.moveTo(-s * 0.95, 0); ctx.lineTo(s * 0.85, 0); ctx.stroke();
      ctx.lineWidth = 1;
      // tail rotor
      ctx.beginPath(); ctx.moveTo(-s * 0.85, -s * 0.2); ctx.lineTo(-s * 0.85, s * 0.2); ctx.stroke();
    });
  }

  /* ---- transport helicopter: heli + cargo bay ---- */
  function transportHeli(ctx, cx, cy, size, heading, fill, stroke) {
    heli(ctx, cx, cy, size, heading, fill, stroke);
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // cargo box under body
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(-s * 0.1, -s * 0.22, s * 0.5, s * 0.44);
    });
  }

  /* ---- tank: hull + turret + barrel ---- */
  function tank(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // tracks
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      roundRectLocal(ctx, -s * 0.9, -s * 0.55, s * 1.8, s * 0.35, s * 0.15);
      ctx.fill();
      roundRectLocal(ctx, -s * 0.9, s * 0.2, s * 1.8, s * 0.35, s * 0.15);
      ctx.fill();
      // hull
      ctx.beginPath();
      ctx.moveTo(s * 0.95, 0);
      ctx.lineTo(s * 0.5, -s * 0.42);
      ctx.lineTo(-s * 0.85, -s * 0.42);
      ctx.lineTo(-s * 0.85, s * 0.42);
      ctx.lineTo(s * 0.5, s * 0.42);
      ctx.closePath();
      strokeFill(ctx, fill, stroke);
      // turret
      ctx.beginPath();
      ctx.arc(-s * 0.1, 0, s * 0.32, Math.PI, 0);
      ctx.closePath();
      strokeFill(ctx, shadeLocal(fill, 0.8), stroke);
      // barrel
      ctx.strokeStyle = stroke || "#222";
      ctx.lineWidth = Math.max(1.5, s * 0.12);
      ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.95, 0); ctx.stroke();
      ctx.lineWidth = 1;
    });
  }

  /* ---- IFV: smaller hull, small turret, wheels ---- */
  function ifv(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // wheels
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      for (const wx of [-0.6, -0.2, 0.2, 0.6]) {
        ctx.beginPath(); ctx.arc(s * wx, -s * 0.48, s * 0.13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * wx, s * 0.48, s * 0.13, 0, Math.PI * 2); ctx.fill();
      }
      // hull
      roundRectLocal(ctx, -s * 0.85, -s * 0.4, s * 1.7, s * 0.8, s * 0.15);
      strokeFill(ctx, fill, stroke);
      // small turret + autocannon
      ctx.beginPath(); ctx.arc(-s * 0.15, 0, s * 0.22, 0, Math.PI * 2);
      strokeFill(ctx, shadeLocal(fill, 0.8), stroke);
      ctx.strokeStyle = stroke || "#222";
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath(); ctx.moveTo(-s * 0.15, 0); ctx.lineTo(s * 0.8, 0); ctx.stroke();
      ctx.lineWidth = 1;
    });
  }

  /* ---- soldier: helmet + shoulders + rifle ---- */
  function soldier(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // shoulders
      ctx.beginPath();
      ctx.ellipse(0, s * 0.35, s * 0.55, s * 0.35, 0, 0, Math.PI * 2);
      strokeFill(ctx, shadeLocal(fill, 0.85), stroke);
      // head
      ctx.beginPath();
      ctx.arc(0, -s * 0.25, s * 0.3, 0, Math.PI * 2);
      strokeFill(ctx, fill, stroke);
      // helmet brim
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(0, -s * 0.25, s * 0.3, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();
      // rifle
      ctx.strokeStyle = "#333";
      ctx.lineWidth = Math.max(1, s * 0.09);
      ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.2); ctx.lineTo(s * 0.85, s * 0.25); ctx.stroke();
      ctx.lineWidth = 1;
    });
  }

  /* ---- warship: hull + superstructure + gun ---- */
  function ship(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // hull
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.45, -s * 0.75, -s * 0.4);
      ctx.lineTo(-s * 0.95, 0);
      ctx.lineTo(-s * 0.75, s * 0.4);
      ctx.quadraticCurveTo(s * 0.5, s * 0.45, s, 0);
      ctx.closePath();
      strokeFill(ctx, fill, stroke);
      // deckhouse
      roundRectLocal(ctx, -s * 0.45, -s * 0.28, s * 0.7, s * 0.56, s * 0.08);
      strokeFill(ctx, shadeLocal(fill, 0.75), stroke);
      // bridge
      roundRectLocal(ctx, -s * 0.1, -s * 0.16, s * 0.35, s * 0.32, s * 0.05);
      strokeFill(ctx, shadeLocal(fill, 0.6), stroke);
      // gun
      ctx.strokeStyle = stroke || "#222";
      ctx.lineWidth = Math.max(1.5, s * 0.1);
      ctx.beginPath(); ctx.moveTo(s * 0.3, 0); ctx.lineTo(s * 0.85, 0); ctx.stroke();
      ctx.lineWidth = 1;
      // VLS dots
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.arc(-s * 0.6, 0, s * 0.06, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-s * 0.7, 0, s * 0.06, 0, Math.PI * 2); ctx.fill();
    });
  }

  /* ---- submarine: cigar + sail ---- */
  function sub(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // hull
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.95, s * 0.3, 0, 0, Math.PI * 2);
      strokeFill(ctx, fill, stroke);
      // sail
      roundRectLocal(ctx, -s * 0.2, -s * 0.55, s * 0.4, s * 0.3, s * 0.08);
      strokeFill(ctx, shadeLocal(fill, 0.8), stroke);
      // rudder
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, 0);
      ctx.lineTo(-s * 1.05, -s * 0.35);
      ctx.lineTo(-s * 0.85, 0);
      ctx.closePath();
      strokeFill(ctx, shadeLocal(fill, 0.7), stroke);
    });
  }

  /* ---- aircraft carrier: long deck + island tower ---- */
  function carrier(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // deck
      roundRectLocal(ctx, -s, -s * 0.32, s * 2, s * 0.64, s * 0.2);
      strokeFill(ctx, fill, stroke);
      // angled landing strip
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.setLineDash([s * 0.15, s * 0.12]);
      ctx.beginPath(); ctx.moveTo(-s * 0.9, -s * 0.28); ctx.lineTo(s * 0.9, s * 0.28); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      // island tower
      roundRectLocal(ctx, -s * 0.15, s * 0.05, s * 0.35, s * 0.35, s * 0.05);
      strokeFill(ctx, shadeLocal(fill, 0.6), stroke);
      // parked jet silhouette
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.1);
      ctx.lineTo(-s * 0.75, -s * 0.35);
      ctx.lineTo(-s * 0.5, -s * 0.12);
      ctx.closePath();
      ctx.fill();
    });
  }

  /* ---- transport ship: hull + containers ---- */
  function transportShip(ctx, cx, cy, size, heading, fill, stroke) {
    size_hint = size;
    frame(ctx, cx, cy, size, heading, s => {
      // hull
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.4, -s * 0.75, -s * 0.35);
      ctx.lineTo(-s * 0.95, 0);
      ctx.lineTo(-s * 0.75, s * 0.35);
      ctx.quadraticCurveTo(s * 0.5, s * 0.4, s, 0);
      ctx.closePath();
      strokeFill(ctx, shadeLocal(fill, 0.7), stroke);
      // containers
      const cols = ["#c0504d", "#4f81bd", "#9bbb59"];
      for (let row = 0; row < 2; row++) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = cols[(i + row) % 3];
          ctx.fillRect(-s * 0.7 + i * s * 0.36, -s * 0.28 + row * s * 0.26, s * 0.3, s * 0.22);
        }
      }
    });
  }

  /* ---- utilities ---- */
  function roundRectLocal(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shadeLocal(color, f) {
    if (!color || color[0] !== "#") return color || "#666";
    const n = parseInt(color.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f));
    const b = Math.max(0, Math.min(255, (n & 255) * f));
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  /* Map a unit class to its icon draw function */
  const BY_CLASS = {
    jet,
    bomber,
    heli,
    transport_heli: transportHeli,
    infantry: soldier,
    ground_veh: ifv,
    ship,
    submarine: sub,
    carrier,
    transport_ship: transportShip,
  };

  /* Pick the dominant unit class in an army (by count, vehicles weigh more) */
  function dominantClass(units) {
    let best = null, bestScore = -1;
    for (const [k, c] of Object.entries(units)) {
      const d = UNITS[k];
      if (!d) continue;
      const score = c * (d.cls === "infantry" ? 1 : 3);
      if (score > bestScore) { bestScore = score; best = d.cls; }
    }
    return best || "infantry";
  }

  /* Public API */
  function drawUnit(ctx, cls, cx, cy, size, heading, fill, stroke) {
    const fn = BY_CLASS[cls] || soldier;
    fn(ctx, cx, cy, size, heading, fill, stroke);
  }

  function drawArmy(ctx, cls, cx, cy, size, heading, friendly) {
    const fill = friendly ? "#2e7d32" : "#b02020";
    // disc
    ctx.fillStyle = fill;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, size / 2 + 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1;
    drawUnit(ctx, cls, cx, cy, size, heading, "#e8e8e8", friendly ? "#1b4d1b" : "#5c1010");
  }

  return { drawUnit, drawArmy, dominantClass };
})();
