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
    variantField: document.getElementById("variantField"),
    variant: document.getElementById("variant"),
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

  // variant選択を考慮した実効スペックを返す
  function getActiveSpec() {
    var spec = specs[els.machine.selectedIndex] || null;
    if (!spec) return null;
    if (!spec.variants || !spec.variants.length) return spec;
    var idx = els.variant ? Math.max(0, els.variant.selectedIndex) : 0;
    var v = spec.variants[idx] || spec.variants[0];
    return {
      id: spec.id,
      name: spec.name,
      ceilingG: v.ceilingG,
      ceilingPayout: v.ceilingPayout,
      gamePerMin: spec.gamePerMin || DEFAULT_GPM,
      evTable: (v.evTable != null) ? v.evTable : (spec.evTable || []),
      zones: v.zones || spec.zones,
      note: v.note || spec.note,
    };
  }

  // EVテーブルルックアップ（等価ベース→換金率補正）
  // evTable がある場合: データ点間を線形補間して ev_eq を算出
  // ない場合: ceilingPayout * exchange - cost（旧計算）
  function lookupEV(spec, g, exchange) {
    var remain = spec.ceilingG - g;
    var cost = remain * COIN_PER_GAME * RENTAL_YEN;
    var table = spec.evTable;
    if (!table || !table.length || g < table[0].g) {
      return spec.ceilingPayout * exchange - cost;
    }
    var lo = table[0];
    var hi = null;
    for (var i = 0; i < table.length; i++) {
      if (table[i].g <= g) {
        lo = table[i];
      } else {
        hi = table[i];
        break;
      }
    }
    var ev_eq;
    if (hi === null || lo.g === g) {
      ev_eq = lo.ev;
    } else {
      // lo.g < g < hi.g の範囲を線形補間
      var t = (g - lo.g) / (hi.g - lo.g);
      ev_eq = lo.ev + t * (hi.ev - lo.ev);
    }
    return (ev_eq + cost) * (exchange / RENTAL_YEN) - cost;
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
        if (z.startG <= spec.ceilingG) set[z.startG] = true;
        if (z.endG <= spec.ceilingG) set[z.endG] = true;
      });
    }
    set[spec.ceilingG] = true;
    return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  }

  function render() {
    var spec = getActiveSpec();
    if (!spec) return;

    var exchange = currentExchange;
    var gpm = spec.gamePerMin || DEFAULT_GPM;

    // サマリー更新
    els.ceilingSummary.textContent = spec.ceilingG.toLocaleString("ja-JP") + " G";
    els.payoutSummary.textContent = spec.ceilingPayout.toLocaleString("ja-JP") + " 枚";
    els.machineNote.textContent = spec.note || "";

    // 期待値転換G数
    var breakEven = spec.ceilingG - Math.round((spec.ceilingPayout * exchange) / (COIN_PER_GAME * RENTAL_YEN));
    if (breakEven < 0) breakEven = 0;
    els.breakEvenG.textContent = breakEven.toLocaleString("ja-JP") + " G〜";

    // テーブル生成
    var gList = buildGList(spec);
    var html = "";

    gList.forEach(function (g) {
      var remain = spec.ceilingG - g;
      var cost = remain * COIN_PER_GAME * RENTAL_YEN;
      var ev = lookupEV(spec, g, exchange);
      var minutes = remain / gpm;
      var hourlyRate = minutes > 0 ? Math.round(ev / (minutes / 60)) : 0;
      var zone = getZoneAtG(spec.zones, g);

      // 出率: (投資+EV)÷投資×100（100%がトントン、超えるとプラス）
      var roi = (cost > 0) ? Math.round((cost + ev) / cost * 1000) / 10 : 100;
      var roiStr = cost > 0 ? roi.toFixed(1) + "%" : "—";

      var evClass = ev >= 0 ? "ev-pos" : "ev-neg";
      var hourlyClass = hourlyRate >= 0 ? "ev-pos" : "ev-neg";
      var roiClass = roi >= 100 ? "ev-pos" : "ev-neg";
      var rowClass = zone ? " row-zone" : (ev >= 0 ? " row-pos" : "");
      var zoneName = zone ? zone.name : "—";

      html += "<tr class=\"" + rowClass.trim() + "\">";
      html += "<td class=\"g-cell\">" + g.toLocaleString("ja-JP") + "G</td>";
      html += "<td class=\"zone-cell\">" + zoneName + "</td>";
      html += "<td class=\"ev-cell " + evClass + "\">" + yen(ev) + "</td>";
      html += "<td class=\"roi-cell " + roiClass + "\">" + roiStr + "</td>";
      html += "<td class=\"time-cell\">" + Math.round(minutes) + "分</td>";
      html += "<td class=\"hourly-cell " + hourlyClass + "\">" + yen(hourlyRate) + "</td>";
      html += "</tr>";
    });

    els.evTbody.innerHTML = html;
  }

  // 機種変更時にvariant UIを更新
  function updateVariantUI() {
    var spec = specs[els.machine.selectedIndex] || null;
    if (!spec || !spec.variants || !spec.variants.length) {
      els.variantField.style.display = "none";
      if (els.variant) els.variant.innerHTML = "";
      return;
    }
    els.variantField.style.display = "";
    els.variant.innerHTML = "";
    spec.variants.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.name;
      els.variant.appendChild(opt);
    });
  }

  function initExchangeSelect() {
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

    els.machine.addEventListener("change", function () {
      updateVariantUI();
      render();
    });

    if (els.variant) {
      els.variant.addEventListener("change", render);
    }

    updateVariantUI();
    render();
  }

  init();
})();
