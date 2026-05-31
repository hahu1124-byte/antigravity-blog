(function () {
  "use strict";

  var COIN_PER_GAME = 3;
  var RENTAL_YEN = 20;
  var DEFAULT_GPM = 13.3;
  var LS_KEY_EXCHANGE = "slot_hyena_exchange";
  var LS_KEY_STEP = "slot_hyena_step";

  var specs = window.HYENA_SPECS || [];

  var els = {
    machine: document.getElementById("machine"),
    machineNote: document.getElementById("machineNote"),
    exchange: document.getElementById("exchange"),
    step: document.getElementById("step"),
    ceilingSummary: document.getElementById("ceilingSummary"),
    payoutSummary: document.getElementById("payoutSummary"),
    breakEvenG: document.getElementById("breakEvenG"),
    evTbody: document.getElementById("evTbody"),
  };

  var currentExchange = parseFloat(localStorage.getItem(LS_KEY_EXCHANGE)) || 20;
  var currentStep = parseInt(localStorage.getItem(LS_KEY_STEP), 10) || 50;

  function yen(n) {
    var sign = n > 0 ? "+" : n < 0 ? "-" : "";
    var v = Math.round(Math.abs(n)).toLocaleString("ja-JP");
    return "¥" + sign + v;
  }

  function getSpec() {
    return specs[els.machine.selectedIndex] || null;
  }

  function getZoneAtG(zones, g) {
    if (!zones) return null;
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (g >= z.startG && g <= z.endG) return z;
    }
    return null;
  }

  function buildGList(spec) {
    var set = {};
    for (var g = 0; g <= spec.ceilingG; g += currentStep) {
      set[g] = true;
    }
    if (spec.zones) {
      spec.zones.forEach(function (z) {
        set[z.startG] = true;
        set[z.endG] = true;
      });
    }
    set[spec.ceilingG] = true;
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }

  function render() {
    var spec = getSpec();
    if (!spec) return;

    var exchange = currentExchange;
    var gpm = spec.gamePerMin || DEFAULT_GPM;

    // サマリー更新
    els.ceilingSummary.textContent = spec.ceilingG.toLocaleString("ja-JP") + " G";
    els.payoutSummary.textContent = spec.ceilingPayout.toLocaleString("ja-JP") + " 枚";
    els.machineNote.textContent = spec.note || "";

    // EV転換G数（EV=0になるG数）
    var breakEven = spec.ceilingG - Math.round((spec.ceilingPayout * exchange) / (COIN_PER_GAME * RENTAL_YEN));
    if (breakEven < 0) breakEven = 0;
    els.breakEvenG.textContent = breakEven.toLocaleString("ja-JP") + " G〜";

    // テーブル生成
    var gList = buildGList(spec);
    var html = "";

    gList.forEach(function (g) {
      var remain = spec.ceilingG - g;
      var invest = remain * COIN_PER_GAME * RENTAL_YEN;
      var ret = spec.ceilingPayout * exchange;
      var ev = ret - invest;
      var minutes = remain / gpm;
      var hourlyRate = minutes > 0 ? Math.round(ev / (minutes / 60)) : 0;
      var zone = getZoneAtG(spec.zones, g);

      var evClass = ev >= 0 ? "ev-pos" : "ev-neg";
      var hourlyClass = hourlyRate >= 0 ? "ev-pos" : "ev-neg";
      var rowClass = zone ? " row-zone" : (ev >= 0 ? " row-pos" : "");
      var zoneName = zone ? zone.name : "—";

      html += "<tr class=\"" + rowClass.trim() + "\">";
      html += "<td class=\"g-cell\">" + g.toLocaleString("ja-JP") + "G</td>";
      html += "<td class=\"zone-cell\">" + zoneName + "</td>";
      html += "<td class=\"ev-cell " + evClass + "\">" + yen(ev) + "</td>";
      html += "<td class=\"time-cell\">" + Math.round(minutes) + "分</td>";
      html += "<td class=\"hourly-cell " + hourlyClass + "\">" + yen(hourlyRate) + "/時</td>";
      html += "</tr>";
    });

    els.evTbody.innerHTML = html;
  }

  function initExchangeSelect() {
    // localStorageの値に合わせてoptionを選択
    var opts = els.exchange.options;
    for (var i = 0; i < opts.length; i++) {
      if (parseFloat(opts[i].value) === currentExchange) {
        els.exchange.selectedIndex = i;
        break;
      }
    }
    els.exchange.addEventListener("change", function () {
      currentExchange = parseFloat(els.exchange.value);
      localStorage.setItem(LS_KEY_EXCHANGE, String(currentExchange));
      render();
    });
  }

  function initStepSelect() {
    // localStorageの値に合わせてoptionを選択
    var opts = els.step.options;
    for (var i = 0; i < opts.length; i++) {
      if (parseInt(opts[i].value, 10) === currentStep) {
        els.step.selectedIndex = i;
        break;
      }
    }
    els.step.addEventListener("change", function () {
      currentStep = parseInt(els.step.value, 10);
      localStorage.setItem(LS_KEY_STEP, String(currentStep));
      render();
    });
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

    initExchangeSelect();
    initStepSelect();
    els.machine.addEventListener("change", render);
    render();
  }

  init();
})();
