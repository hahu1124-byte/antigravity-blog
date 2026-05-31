(function () {
  "use strict";

  var COIN_PER_GAME = 3;
  var RENTAL_YEN = 20;
  var DEFAULT_GPM = 13.3;

  var specs = window.HYENA_SPECS || [];

  var els = {
    machine: document.getElementById("machine"),
    machineNote: document.getElementById("machineNote"),
    currentG: document.getElementById("currentG"),
    ceiling: document.getElementById("ceiling"),
    exchange: document.getElementById("exchange"),
    badge: document.getElementById("badge"),
    ev: document.getElementById("ev"),
    remainG: document.getElementById("remainG"),
    invest: document.getElementById("invest"),
    payout: document.getElementById("payout"),
    time: document.getElementById("time"),
    zoneSection: document.getElementById("zoneSection"),
    currentZoneName: document.getElementById("currentZoneName"),
    currentZoneNote: document.getElementById("currentZoneNote"),
    nextZoneName: document.getElementById("nextZoneName"),
    nextZoneDist: document.getElementById("nextZoneDist"),
    nextZoneEv: document.getElementById("nextZoneEv"),
    nextZoneNote: document.getElementById("nextZoneNote"),
  };

  function yen(n) {
    var sign = n > 0 ? "+" : n < 0 ? "-" : "";
    var v = Math.round(Math.abs(n)).toLocaleString("ja-JP");
    return "¥" + sign + v;
  }

  function getSpec() {
    return specs[els.machine.selectedIndex] || null;
  }

  function findCurrentZone(currentG, zones) {
    if (!zones) return null;
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (currentG >= z.startG && currentG <= z.endG) return z;
    }
    return null;
  }

  function findNextZone(currentG, zones) {
    if (!zones) return null;
    var best = null;
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (z.startG > currentG) {
        if (!best || z.startG < best.startG) best = z;
      }
    }
    return best;
  }

  function calcZoneEv(zone, currentG, exchange) {
    var dist = Math.max(0, zone.startG - currentG);
    var invest = dist * COIN_PER_GAME * RENTAL_YEN;
    var ret = zone.hitPct * zone.avgPayout * exchange;
    return ret - invest;
  }

  function calc() {
    var spec = getSpec();
    if (!spec) return;

    var current = parseInt(els.currentG.value, 10);
    if (isNaN(current) || current < 0) current = 0;

    var exchange = parseFloat(els.exchange.value) || RENTAL_YEN;
    var gpm = spec.gamePerMin || DEFAULT_GPM;

    var remain = Math.max(0, spec.ceilingG - current);
    var invest = remain * COIN_PER_GAME * RENTAL_YEN;
    var ret = spec.ceilingPayout * exchange;
    var ev = ret - invest;
    var minutes = remain / gpm;

    els.ceiling.textContent = spec.ceilingG.toLocaleString("ja-JP") + " G";
    els.machineNote.textContent = spec.note || "";
    els.remainG.textContent = remain.toLocaleString("ja-JP") + " G";
    els.invest.textContent = yen(invest);
    els.payout.textContent = spec.ceilingPayout.toLocaleString("ja-JP") + " 枚";
    els.time.textContent = Math.round(minutes).toLocaleString("ja-JP") + " 分";

    els.ev.textContent = yen(ev);
    els.ev.className = "result-ev " + (ev >= 0 ? "ev-pos" : "ev-neg");

    setBadge(ev);
    updateZoneInfo(spec, current, exchange);
  }

  function setBadge(ev) {
    var label, cls;
    if (ev >= 5000) {
      label = "✅ 好条件";
      cls = "badge-great";
    } else if (ev >= 1000) {
      label = "👍 狙い目";
      cls = "badge-good";
    } else if (ev > 0) {
      label = "🤔 様子見";
      cls = "badge-watch";
    } else {
      label = "🚫 非推奨";
      cls = "badge-no";
    }
    els.badge.textContent = label;
    els.badge.className = "result-badge " + cls;
  }

  function updateZoneInfo(spec, currentG, exchange) {
    if (!spec.zones || !spec.zones.length) {
      els.zoneSection.style.display = "none";
      return;
    }
    els.zoneSection.style.display = "";

    var curZone = findCurrentZone(currentG, spec.zones);
    var nextZone = findNextZone(currentG, spec.zones);

    if (curZone) {
      els.currentZoneName.textContent = "🎯 " + curZone.name + " 滞在中！";
      els.currentZoneName.className = "zone-in-label zone-in-active";
      els.currentZoneNote.textContent = curZone.note;
    } else {
      els.currentZoneName.textContent = "ゾーン外";
      els.currentZoneName.className = "zone-in-label";
      els.currentZoneNote.textContent = "現在はゾーン外です";
    }

    if (nextZone) {
      var dist = nextZone.startG - currentG;
      var zev = calcZoneEv(nextZone, currentG, exchange);
      els.nextZoneName.textContent = nextZone.name;
      els.nextZoneDist.textContent = "あと " + dist.toLocaleString("ja-JP") + " G";
      els.nextZoneEv.textContent = yen(zev);
      els.nextZoneEv.className = "zone-ev-val " + (zev >= 0 ? "ev-pos" : "ev-neg");
      els.nextZoneNote.textContent = "当選率 " + Math.round(nextZone.hitPct * 100) + "% / 平均 " + nextZone.avgPayout.toLocaleString("ja-JP") + "枚 — " + nextZone.note;
    } else {
      els.nextZoneName.textContent = "（なし）";
      els.nextZoneDist.textContent = "—";
      els.nextZoneEv.textContent = "—";
      els.nextZoneEv.className = "zone-ev-val";
      els.nextZoneNote.textContent = "天井に向かって投資継続";
    }
  }

  function init() {
    if (!specs.length) {
      els.machineNote.textContent = "機種データが読み込めませんでした。";
      return;
    }
    specs.forEach(function (s) {
      var opt = document.createElement("option");
      opt.textContent = s.name;
      els.machine.appendChild(opt);
    });

    els.machine.addEventListener("change", calc);
    els.currentG.addEventListener("input", calc);
    els.exchange.addEventListener("change", calc);

    calc();
  }

  init();
})();
