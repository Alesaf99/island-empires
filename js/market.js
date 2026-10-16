/* ===== Global market: dynamic prices, buy/sell with tax ===== */

const Market = (() => {
  const RESOURCES = ["oil", "steel", "gold"];

  function price(res) { return Game.state().market.prices[res]; }
  function prevPrice(res) { return Game.state().market.prev[res]; }

  /* Tax depends on player's best Market building level */
  function taxRate() {
    const st = Game.state();
    let best = 0;
    st.bases.forEach(b => b.buildings.forEach(x => {
      if (x.type === "market" && !(x.upgradeEndsAt && x.upgradeEndsAt > Game.now())) {
        best = Math.max(best, x.level);
      }
    }));
    const def = BUILDINGS.market;
    if (best === 0) return def.taxBase + 0.05; // no market built: worse rate
    return Math.max(0.01, def.taxBase - def.taxPerLevel * (best - 1));
  }

  function sell(res, amount) {
    const st = Game.state();
    amount = Math.floor(amount);
    if (amount <= 0) return false;
    if ((st.resources[res] || 0) < amount) {
      toast.error("Not enough resources to sell.", true);
      return false;
    }
    // Gold is the currency — you trade oil/steel FOR gold, and spend gold to BUY oil/steel.
    st.resources[res] -= amount;
    st.market.volume[res] += amount;
    if (res === "gold") {
      // selling gold converts to oil+steel at market rates (rarely used)
      st.resources.oil += Math.floor(amount * price("gold") / price("oil") * 0.5);
      st.resources.steel += Math.floor(amount * price("gold") / price("steel") * 0.5);
    } else {
      const gross = amount * price(res);
      const net = gross * (1 - taxRate());
      st.resources.gold += Math.floor(net);
    }
    st.market.prev[res] = price(res);
    st.market.prices[res] = Math.max(0.2, price(res) * (1 - Math.min(0.05, amount / 20000)));
    toast(`Sold ${amount} ${res}.`);
    Game.emit(); Game.save();
    return true;
  }

  function buy(res, amount) {
    const st = Game.state();
    amount = Math.floor(amount);
    if (amount <= 0) return false;
    if (res === "gold") {
      toast.error("Gold is the currency — buy oil or steel instead.", true);
      return false;
    }
    const gross = amount * price(res);
    const total = Math.ceil(gross * (1 + taxRate()));
    if (st.resources.gold < total) {
      toast.error(`Not enough gold (need ${total}).`, true);
      return false;
    }
    st.resources.gold -= total;
    st.resources[res] += amount;
    st.market.volume[res] += amount;
    st.market.prev[res] = price(res);
    st.market.prices[res] = Math.min(20, price(res) * (1 + Math.min(0.05, amount / 20000)));
    toast(`Bought ${amount} ${res}.`);
    Game.emit(); Game.save();
    return true;
  }

  /* Price drift: random walk plus mean reversion, runs every tick */
  function tick(dtHours, t) {
    const st = Game.state();
    RESOURCES.forEach(res => {
      st.market.prev[res] = st.market.prices[res];
      const base = MARKET_START[res];
      const cur = st.market.prices[res];
      const drift = (Math.random() - 0.5) * 0.04 * Math.min(1, dtHours * 60);
      const revert = (base - cur) * 0.01 * Math.min(1, dtHours * 60);
      st.market.prices[res] = Math.max(0.2, cur + drift + revert);
    });
  }

  /* ---------- UI ---------- */
  function open() {
    render();
    document.getElementById("market-modal").classList.remove("hidden");
  }

  function render() {
    const tbody = document.querySelector("#market-table tbody");
    const tax = taxRate();
    tbody.innerHTML = "";
    RESOURCES.forEach(res => {
      const p = price(res);
      const prev = prevPrice(res);
      const trend = p > prev ? "▲" : p < prev ? "▼" : "—";
      const cls = p > prev ? "trend-up" : p < prev ? "trend-down" : "";
      const icons = { oil: "🛢", steel: "🔩", gold: "💰" };
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${icons[res]} ${res.charAt(0).toUpperCase() + res.slice(1)}</td>
        <td>${p.toFixed(2)} g</td>
        <td class="${cls}">${trend}</td>
        <td></td>`;
      const td = tr.querySelector("td:last-child");
      if (res !== "gold") {
        const buyBtn = mkBtn("Buy 100", () => { buy(res, 100); render(); });
        const sellBtn = mkBtn("Sell 100", () => { sell(res, 100); render(); });
        td.append(buyBtn, sellBtn);
      } else {
        td.textContent = "—";
      }
      tbody.appendChild(tr);
    });
    // tax note
    const hint = document.querySelector("#market-modal .hint");
    hint.textContent = `Prices move with supply and demand. Trade tax: ${(tax * 100).toFixed(1)}% (build/upgrade Market to reduce).`;
  }

  function mkBtn(label, fn) {
    const btn = document.createElement("button");
    btn.className = "action";
    btn.textContent = label;
    btn.onclick = fn;
    return btn;
  }

  return { open, render, tick, sell, buy, price, taxRate };
})();
