/* =========================================================
   co4 智能完井滑套控制 · 案例流程页的逐步动态图
   ---------------------------------------------------------
   分层产能 + 约束网格优化 + 30 天滚动调控，与 demo/demo.js
   使用同一套公式与默认参数；本文件只负责画图，不新增结论。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'intelligent-sleeve-control';

  /* ---------------- 模型（与 demo/demo.js 完全一致） ---------------- */
  var LAYERS = [
    { id: 'A', name: 'A 层 · 主力油层', short: 'A', oilMax: 76, wc0: 0.16 },
    { id: 'B', name: 'B 层 · 接替层', short: 'B', oilMax: 50, wc0: 0.32 },
    { id: 'C', name: 'C 层 · 含水层', short: 'C', oilMax: 34, wc0: 0.72 }
  ];
  var WHP = 16, LIQ_LIMIT = 270, DAYS = 30;
  var DEFAULTS = { ua: 70, ub: 70, uc: 60, target: 115, wct: 40, cycle: 7 };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pf() { return clamp(1 - (WHP - 10) * 0.012, 0.8, 1); }

  function rates(plan, wcs, pressure) {
    var oil = [0, 0, 0], water = [0, 0, 0], liquid = 0;
    for (var i = 0; i < 3; i++) {
      var u = plan[i];
      oil[i] = LAYERS[i].oilMax * Math.pow(u, 0.85) * pressure;
      water[i] = LAYERS[i].oilMax * Math.pow(u, 1.25) * pressure * wcs[i] / Math.max(1 - wcs[i], 0.05);
      liquid += oil[i] + water[i];
    }
    if (liquid > LIQ_LIMIT) {
      var f = LIQ_LIMIT / liquid;
      for (var j = 0; j < 3; j++) { oil[j] *= f; water[j] *= f; }
      liquid = LIQ_LIMIT;
    }
    var oilT = oil[0] + oil[1] + oil[2], waterT = water[0] + water[1] + water[2];
    return {
      oil: oil, water: water, oilT: oilT, waterT: waterT,
      liquid: oilT + waterT, wc: waterT / Math.max(oilT + waterT, 1)
    };
  }

  function optimizeOpen(wcs, st, pressure) {
    var pfv = (pressure == null) ? pf() : pressure;
    var best = null;
    for (var a = 0; a <= 20; a++) {
      for (var b = 0; b <= 20; b++) {
        for (var c = 0; c <= 20; c++) {
          var plan = [a / 20, b / 20, c / 20];
          var r = rates(plan, wcs, pfv);
          var deficit = Math.max(0, st.target - r.oilT);
          var excess = Math.max(0, r.oilT - st.target);
          var wcOver = Math.max(0, r.wc * 100 - st.wct);
          var feasible = r.oilT >= st.target * 0.985;
          var score = feasible
            ? (r.waterT + excess * 0.4 + wcOver * 0.8)
            : (1000 + deficit * 10 + r.waterT * 0.05);
          if (!best || score < best.score) {
            best = { plan: plan, rates: r, score: score, feasible: feasible };
          }
        }
      }
    }
    return best;
  }

  function simulate(fixed, mode, st) {
    var wcs = LAYERS.map(function (l) { return l.wc0; });
    var pressure = pf();
    var plan = fixed.slice();
    var series = [], cumOil = 0, cumWater = 0, optCount = 0;
    for (var day = 1; day <= DAYS; day++) {
      if (mode === 'ai' && (day - 1) % st.cycle === 0) {
        plan = optimizeOpen(wcs, st, pressure).plan;
        optCount++;
      }
      var r = rates(plan, wcs, pressure);
      cumOil += r.oilT;
      cumWater += r.waterT;
      series.push({
        day: day, oil: r.oilT, water: r.waterT, wc: r.wc, wcPct: r.wc * 100,
        liquid: r.liquid, plan: plan.slice(), layerOil: r.oil.slice(), layerWater: r.water.slice()
      });
      for (var i = 0; i < 3; i++) {
        wcs[i] = clamp(wcs[i] + 0.0032 * plan[i] * (1 - wcs[i]) + 0.00025, 0, 0.95);
      }
      pressure *= 0.9982;
    }
    var hit = series.filter(function (p) { return p.oil >= st.target * 0.98; }).length;
    var wcOk = series.filter(function (p) { return p.wc * 100 <= st.wct; }).length;
    return { series: series, cumOil: cumOil, cumWater: cumWater, hit: hit, wcOk: wcOk, choices: optCount };
  }

  /* ---------------- 概念卡 ---------------- */
  var CONCEPTS = [
    { t: '滑套', prof: '装在完井管柱上的可调阀门，用开度控制每一层出多少液。', life: '像每个房间装一个独立水龙头：开大出水多，关小出水少。', see: '第 1 步图：每层水平段中间的绿色槽，亮得越多表示开度越大。' },
    { t: '分层产液', prof: '各层产能与含水不同，合采时强势层会挤占井筒液量。', life: '像三个水龙头接同一根水管，开最大的那个会把流量抢走。', see: '第 1 步右侧堆叠条：每层油（绿）与水（蓝）各占多高。' },
    { t: '含水率', prof: '产出液里水的占比，越高说明油越少、地面处理负担越重。', life: '像冲咖啡水加太多，味道会越来越淡。', see: '第 5 步下图：绿线 AI、橙线固定开度，越过 40% 红线就超限。' }
  ];

  /* ---------------- 绘图小工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function svg(inner, h) {
    return '<svg viewBox="0 0 640 ' + h + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }
  function tx(x, y, s, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-size="' + ((o.s || 10) * 1.15).toFixed(1) +
      '" fill="' + (o.f || '#333f4b') + '"' + (o.a ? ' text-anchor="' + o.a + '"' : '') +
      (o.b ? ' font-weight="600"' : '') + (o.m ? ' font-family="ui-monospace,monospace"' : '') + '>' + esc(s) + '</text>';
  }
  function rc(x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (o.r || 4) +
      '" fill="' + (o.f || '#fff') + '"' + (o.st ? ' stroke="' + o.st + '"' : '') + '/>';
  }
  function ln(x1, y1, x2, y2, st, w, d) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + (st || '#d2ccbf') + '" stroke-width="' + (w || 1) + '"' + (d ? ' stroke-dasharray="' + d + '"' : '') + '/>';
  }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 1 : d); }
  function mix(c1, c2, t) {
    t = clamp(t, 0, 1);
    return 'rgb(' + Math.round(c1[0] + (c2[0] - c1[0]) * t) + ',' +
      Math.round(c1[1] + (c2[1] - c1[1]) * t) + ',' +
      Math.round(c1[2] + (c2[2] - c1[2]) * t) + ')';
  }
  function alpha(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /* ---------------- 概念图 ---------------- */
  function conceptSvg() {
    var s = '<svg viewBox="0 0 700 332" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="滑套与分层产液概念图解：三个水龙头接同一根水管">';
    s += '<rect width="700" height="332" fill="#fff"/>';

    /* 左：生活比喻 */
    s += '<rect x="8" y="8" width="306" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += tx(22, 27, '生活比喻 · 三个水龙头接同一根水管', { s: 9, f: '#9ba3a9' });
    s += rc(30, 112, 268, 18, { f: '#e6dfd0', st: '#d8c9a3', r: 9 });
    var taps = [{ x: 74, u: 0.8, t: 'A 80%' }, { x: 164, u: 0.7, t: 'B 70%' }, { x: 254, u: 0.3, t: 'C 30%' }];
    taps.forEach(function (p) {
      s += ln(p.x, 70, p.x, 112, '#b8c2be', 6);
      s += rc(p.x - 15, 56, 30, 14, { f: mix([207, 214, 217], [47, 125, 107], p.u), st: '#8d979d', r: 3 });
      s += tx(p.x, 46, p.t, { s: 8, f: '#4a545d', a: 'middle' });
    });
    s += '<path d="M 40 128 L 40 132" stroke="#a03d4f" stroke-width="3"/>';
    s += tx(30, 152, '开度大 → 出液多；开度小 → 几乎不出', { s: 8.5, f: '#4a545d' });
    s += tx(30, 172, '三个龙头共用一根管，流量会自动流向“最通”的那一路。', { s: 8, f: '#7e8894' });
    s += rc(30, 196, 262, 90, { f: '#fff', st: '#f0ece1', r: 6 });
    s += tx(42, 216, '这三层就像三种房间：', { s: 8.5, b: 1, f: '#3a352d' });
    s += tx(42, 234, 'A 层油多水少、B 层一般、C 层水多油少。', { s: 8.5, f: '#56616d' });
    s += tx(42, 252, '把 C 层龙头关小，总液量里水就少了。', { s: 8.5, f: '#56616d' });
    s += tx(42, 270, '这就是“调开度、控含水”的全部直觉。', { s: 8.5, f: '#56616d' });
    s += tx(22, 304, '所以要先知道每层各出多少油和水，', { s: 8.5, f: '#9ba3a9' });
    s += tx(22, 318, '再决定每个龙头开多大。', { s: 8.5, f: '#9ba3a9' });

    /* 右：专业结构 */
    s += '<rect x="322" y="8" width="370" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += tx(336, 27, '专业结构 · 三层滑套 + 分层产液', { s: 9, f: '#9ba3a9' });
    var bands = [
      { y: 56, h: 62, fill: '#efe9dc', name: 'A 主力油层 含水 16%' },
      { y: 118, h: 62, fill: '#e9dfc7', name: 'B 接替层 含水 32%' },
      { y: 180, h: 62, fill: '#e3d6b8', name: 'C 含水层 含水 72%' }
    ];
    bands.forEach(function (b) {
      s += rc(330, b.y, 330, b.h, { f: b.fill, r: 3 });
      s += tx(336, b.y + 12, b.name, { s: 7.5, f: '#8a744a' });
    });
    s += ln(360, 42, 360, 236, '#8d979d', 5);
    s += rc(353, 36, 14, 7, { f: '#d4d0c8', st: '#8d979d', r: 2 });
    var ys = [87, 149, 211];
    var us = [0.8, 0.7, 0.3];
    for (var i = 0; i < 3; i++) {
      var y = ys[i];
      s += ln(360, y, 470, y, '#8d979d', 4);
      for (var k = 0; k < 6; k++) {
        var on = (k + 0.5) / 6 <= us[i];
        s += rc(392 + k * 7, y - 5, 5, 10, { f: on ? '#3a352d' : '#d4d0c8', r: 1 });
      }
      s += rc(390, y - 7, 44, 14, { f: 'none', st: '#5d6470', r: 3 });
      s += tx(444, y - 8, LAYERS[i].short + ' ' + Math.round(us[i] * 100) + '%', { s: 8.5, f: '#3a352d' });
      s += '<path d="M 478 ' + (y + 2) + ' l 18 0" stroke="#b26a39" stroke-width="2"/>';
      s += '<path d="M 496 ' + (y + 2) + ' l -5 -3 l 0 6 z" fill="#b26a39"/>';
      if (i === 2) {
        s += '<circle cx="510" cy="' + (y + 8) + '" r="2" fill="#a03d4f"/>';
        s += '<circle cx="520" cy="' + (y + 8) + '" r="2" fill="#a03d4f"/>';
        s += '<circle cx="515" cy="' + (y + 16) + '" r="2" fill="#a03d4f"/>';
      }
    }
    s += tx(478, 78, '油', { s: 7.5, f: '#b26a39' });
    s += tx(506, 94, '水', { s: 7.5, f: '#a03d4f' });
    s += rc(334, 250, 344, 62, { f: '#fff', st: '#f3f0e7', r: 6 });
    s += tx(344, 268, '三层合采：强势层抢液量，含水层越开越出水。', { s: 8.5, f: '#3a352d' });
    s += tx(344, 284, '滑套 = 给每层单独装一个可调水龙头。', { s: 8, f: '#4a545d' });
    s += tx(344, 300, '调控目标：产油达标，同时把产水压到最低。', { s: 8, f: '#4a545d' });
    return s + '</svg>';
  }

  /* ---------------- 逐步动态图 ---------------- */
  function render(i, el) {
    var st = DEFAULTS;
    var wcs0 = LAYERS.map(function (l) { return l.wc0; });
    var P = pf();
    var plan0 = [st.ua / 100, st.ub / 100, st.uc / 100];
    var r0 = rates(plan0, wcs0, P);
    var opt = optimizeOpen(wcs0, st, P);
    var sims = { ai: simulate(plan0, 'ai', st), fixed: simulate(plan0, 'manual', st) };

    /* ---------- 0 层段数据与产液剖面 ---------- */
    if (i === 0) {
      var s = rc(0, 0, 640, 330, { f: '#fff' });
      s += tx(16, 22, '三层井身剖面：每层一个滑套，开度决定出液多少', { s: 10, b: 1, f: '#3a352d' });
      var bands = [
        { y: 64, h: 64, fill: '#efe9dc', name: 'A 层 · 主力油层' },
        { y: 128, h: 64, fill: '#e9dfc7', name: 'B 层 · 接替层' },
        { y: 192, h: 64, fill: '#e3d6b8', name: 'C 层 · 含水层' }
      ];
      bands.forEach(function (b) {
        s += rc(12, b.y, 338, b.h, { f: b.fill, r: 4 });
        s += tx(20, b.y + 13, b.name, { s: 8, f: '#8a744a' });
      });
      s += ln(60, 40, 60, 268, '#8d979d', 5);
      s += rc(52, 32, 16, 8, { f: '#d4d0c8', st: '#8d979d', r: 2 });
      s += tx(74, 40, '井口', { s: 8, f: '#9ba3a9' });
      var ys = [96, 160, 224];
      for (var i0 = 0; i0 < 3; i0++) {
        var y0 = ys[i0], u0 = plan0[i0];
        s += ln(60, y0, 250, y0, '#8d979d', 4);
        for (var k0 = 0; k0 < 6; k0++) {
          var on0 = (k0 + 0.5) / 6 <= u0;
          s += rc(124 + k0 * 7, y0 - 5, 5, 10, { f: on0 ? '#3a352d' : '#d4d0c8', r: 1 });
        }
        s += rc(122, y0 - 7, 44, 14, { f: 'none', st: '#5d6470', r: 3 });
        s += tx(176, y0 - 8, LAYERS[i0].short + ' ' + Math.round(u0 * 100) + '%', { s: 9, f: '#3a352d' });
        var oilLen = 6 + r0.oil[i0] * 0.42;
        s += ln(210, y0 + 2, 210, y0 + 2 - oilLen, '#b26a39', 2);
        s += '<path d="M 207 ' + (y0 + 3 - oilLen) + ' l 3 -6 l 3 6 z" fill="#b26a39"/>';
        var wcL = r0.water[i0] / Math.max(r0.oil[i0] + r0.water[i0], 0.001);
        var drops = Math.round(wcL * 5);
        for (var d0 = 0; d0 < drops; d0++) {
          s += '<circle cx="' + (224 + (d0 % 2) * 7) + '" cy="' + (y0 + 4 + Math.floor(d0 / 2) * 7) + '" r="1.9" fill="#a03d4f"/>';
        }
      }
      s += tx(16, 282, '槽越绿 = 开度越大；棕箭头 = 产油量级；蓝点 = 水相。', { s: 8.5, f: '#7e8894' });
      s += tx(16, 300, '默认开度 70 / 70 / 60%，这是人工经验值，也是后面优化要比较的基线。', { s: 8.5, f: '#56616d' });

      /* 右侧：分层贡献堆叠条 */
      s += tx(382, 40, '分层贡献（默认开度）', { s: 9.5, b: 1, f: '#3a352d' });
      var bx = [396, 470, 544], bw = 52, base = 270, kk = 1.85;
      s += ln(384, base, 620, base, '#d2ccbf', 1);
      for (var b0 = 0; b0 < 3; b0++) {
        var oilH = r0.oil[b0] * kk, watH = r0.water[b0] * kk;
        s += rc(bx[b0], base - oilH, bw, oilH, { f: '#3a352d', r: 2 });
        s += rc(bx[b0], base - oilH - watH, bw, watH, { f: '#a03d4f', r: 2 });
        s += tx(bx[b0] + bw / 2, base - oilH - watH - 5, fmt(r0.oil[b0] + r0.water[b0], 0), { s: 9, m: 1, a: 'middle' });
        s += tx(bx[b0] + bw / 2, base + 13, LAYERS[b0].short + ' ' + Math.round(plan0[b0] * 100) + '%', { s: 8.5, a: 'middle', f: '#56616d' });
      }
      s += rc(384, 302, 9, 9, { f: '#3a352d', r: 2 });
      s += tx(398, 310, '油 t/d', { s: 8, f: '#7e8894' });
      s += rc(446, 302, 9, 9, { f: '#a03d4f', r: 2 });
      s += tx(460, 310, '水 t/d', { s: 8, f: '#7e8894' });
      s += tx(510, 310, '合采液量 ' + fmt(r0.liquid, 0) + ' / 上限 ' + LIQ_LIMIT + ' t/d', { s: 8, f: '#56616d' });
      s += tx(382, 292, '每层含水：' + LAYERS.map(function (l, k) { return l.short + ' ' + Math.round(l.wc0 * 100) + '%'; }).join(' · '), { s: 8, f: '#7e8894' });
      el.innerHTML = svg(s, 330);
      return '<b>怎么看：</b>左边是三层水平井，每层水平段中间那排小槽就是滑套——亮起几格就是开了几成。' +
        '右边把三层的油（绿）和水（蓝）堆在一起：C 层开度只有 60%，可它的蓝色部分却最高，说明它是“出水大户”。';
    }

    /* ---------- 1 分层产能与含水预测 ---------- */
    if (i === 1) {
      var s1 = rc(0, 0, 640, 330, { f: '#fff' });
      s1 += tx(16, 22, '开度—产油 / 产水 响应曲线族（每层一组）', { s: 10, b: 1, f: '#3a352d' });
      var yMax1 = 90;
      var xU = function (u) { return 64 + u * 540; };
      var yV = function (v) { return 280 - Math.min(v, yMax1) / yMax1 * 230; };
      s1 += ln(64, 280, 604, 280, '#d2ccbf', 1);
      s1 += ln(64, 50, 64, 280, '#d2ccbf', 1);
      [0, 30, 60, 90].forEach(function (v) {
        s1 += ln(64, yV(v), 604, yV(v), '#f1f4f2', 1);
        s1 += tx(58, yV(v) + 3, v, { s: 7.5, f: '#9ba3a9', a: 'end' });
      });
      [0, 25, 50, 75, 100].forEach(function (u) {
        s1 += tx(xU(u / 100), 296, u + '%', { s: 7.5, f: '#9ba3a9', a: 'middle' });
      });
      s1 += tx(604, 312, '滑套开度', { s: 8, f: '#7e8894', a: 'end' });
      s1 += tx(30, 150, 't/d', { s: 8, f: '#7e8894' });
      var oilC = ['#3a352d', '#4f8f7c', '#7fae9e'];
      var watC = ['#a03d4f', '#6b8ab3', '#9aadc9'];
      for (var li = 0; li < 3; li++) {
        var po = '', pw = '';
        for (var uu = 0; uu <= 1.0001; uu += 0.04) {
          var ov = LAYERS[li].oilMax * Math.pow(uu, 0.85) * P;
          var wv = LAYERS[li].oilMax * Math.pow(uu, 1.25) * P * LAYERS[li].wc0 / Math.max(1 - LAYERS[li].wc0, 0.05);
          po += (po ? ' L' : 'M') + xU(uu).toFixed(1) + ' ' + yV(ov).toFixed(1);
          pw += (pw ? ' L' : 'M') + xU(uu).toFixed(1) + ' ' + yV(wv).toFixed(1);
        }
        s1 += '<path d="' + po + '" fill="none" stroke="' + oilC[li] + '" stroke-width="' + (li === 0 ? 2.2 : 1.8) + '"/>';
        s1 += '<path d="' + pw + '" fill="none" stroke="' + watC[li] + '" stroke-width="' + (li === 0 ? 2 : 1.6) + '" stroke-dasharray="4 3"/>';
        s1 += tx(608, yV(LAYERS[li].oilMax * P) + 3, LAYERS[li].short, { s: 9, b: 1, f: oilC[li] });
        var endW = LAYERS[li].oilMax * P * LAYERS[li].wc0 / Math.max(1 - LAYERS[li].wc0, 0.05);
        s1 += tx(608, yV(endW) + 3, LAYERS[li].short, { s: 9, b: 1, f: watC[li] });
      }
      /* 默认开度圆点 */
      for (var lj = 0; lj < 3; lj++) {
        var uj = plan0[lj];
        var oj = LAYERS[lj].oilMax * Math.pow(uj, 0.85) * P;
        var wj = LAYERS[lj].oilMax * Math.pow(uj, 1.25) * P * LAYERS[lj].wc0 / Math.max(1 - LAYERS[lj].wc0, 0.05);
        s1 += '<circle cx="' + xU(uj).toFixed(1) + '" cy="' + yV(oj).toFixed(1) + '" r="3.6" fill="' + oilC[lj] + '" stroke="#fff" stroke-width="1.4"/>';
        s1 += '<circle cx="' + xU(uj).toFixed(1) + '" cy="' + yV(wj).toFixed(1) + '" r="3.6" fill="' + watC[lj] + '" stroke="#fff" stroke-width="1.4"/>';
      }
      s1 += rc(16, 302, 404, 22, { f: '#faf9f5', st: '#e4e0d6', r: 4 });
      s1 += tx(26, 317, '实线 = 产油 · 虚线 = 产水 · 圆点 = 默认开度 · A/B/C 用深浅区分', { s: 8.5, f: '#56616d' });
      el.innerHTML = svg(s1, 330);
      return '<b>怎么看：</b>横轴是滑套开度，纵轴是每天出多少吨。实线是油、虚线是水。' +
        '所有曲线都是往上弯的，但水的指数 1.25 比油的 0.85 更陡：开度开到很大时，水涨得比油快。' +
        'C 层（最浅的蓝）虚线最陡，所以它是最该被“关小”的一层。';
    }

    /* ---------- 2 约束优化 ---------- */
    if (i === 2) {
      var s2 = rc(0, 0, 640, 330, { f: '#fff' });
      s2 += tx(16, 22, '开度组合寻优：在 (A, B) 平面上找产水最少的可行格', { s: 10, b: 1, f: '#3a352d' });
      var cell = 16, gx = 90, gy = 52;
      var grid = [], minW = 1e9, maxW = -1e9;
      for (var bi = 0; bi <= 10; bi++) {
        for (var ai = 0; ai <= 10; ai++) {
          var rp = rates([ai / 10, bi / 10, opt.plan[2]], wcs0, P);
          var okp = rp.oilT >= st.target * 0.985;
          grid.push({ ai: ai, bi: bi, w: rp.waterT, ok: okp });
          if (okp) { minW = Math.min(minW, rp.waterT); maxW = Math.max(maxW, rp.waterT); }
        }
      }
      if (minW === 1e9) { minW = 0; maxW = 1; }
      grid.forEach(function (g) {
        var px = gx + g.ai * cell;
        var py = gy + (10 - g.bi) * cell;
        var col = g.ok ? mix([47, 125, 107], [176, 90, 81], (g.w - minW) / Math.max(maxW - minW, 0.001)) : '#efece4';
        s2 += '<rect x="' + px + '" y="' + py + '" width="' + (cell - 1) + '" height="' + (cell - 1) + '" fill="' + col + '"/>';
      });
      s2 += rc(gx, gy, cell * 11, cell * 11, { f: 'none', st: '#e1ddd3' });
      s2 += ln(gx, gy + cell * 11, gx + cell * 11, gy + cell * 11, '#9ba3a9', 1);
      s2 += ln(gx, gy, gx, gy + cell * 11, '#9ba3a9', 1);
      [0, 50, 100].forEach(function (v) {
        s2 += tx(gx + v / 100 * cell * 10, gy + cell * 11 + 14, v, { s: 7.5, f: '#9ba3a9', a: 'middle' });
        s2 += tx(gx - 6, gy + (10 - v / 10) * cell + 4, v, { s: 7.5, f: '#9ba3a9', a: 'end' });
      });
      s2 += tx(gx + cell * 5, gy + cell * 11 + 30, 'A 层开度 %', { s: 8, f: '#7e8894', a: 'middle' });
      s2 += tx(78, gy + cell * 5, 'B 层', { s: 8, f: '#7e8894', a: 'middle' });
      s2 += tx(78, gy + cell * 5 + 12, '开度 %', { s: 8, f: '#7e8894', a: 'middle' });
      /* 最优点白圈 */
      var opx = gx + opt.plan[0] * cell * 10, opy = gy + (1 - opt.plan[1]) * cell * 10;
      s2 += '<circle cx="' + opx.toFixed(1) + '" cy="' + opy.toFixed(1) + '" r="5.5" fill="none" stroke="#fff" stroke-width="2"/>';
      s2 += '<circle cx="' + opx.toFixed(1) + '" cy="' + opy.toFixed(1) + '" r="5.5" fill="none" stroke="#333f4b" stroke-width="1"/>';
      /* 渐变色标 */
      for (var gi = 0; gi < 22; gi++) {
        s2 += rc(gx + gi * 8, 292, 8, 8, { f: mix([47, 125, 107], [176, 90, 81], gi / 21), r: 0 });
      }
      s2 += tx(gx, 314, '低产水', { s: 7.5, f: '#3a352d' });
      s2 += tx(gx + 176, 314, '高产水', { s: 7.5, f: '#b05a51', a: 'end' });
      s2 += tx(gx, 306, 'C 层固定为最优值 ' + Math.round(opt.plan[2] * 100) + '%', { s: 8, f: '#7e8894' });

      /* 右侧结果 */
      s2 += tx(300, 52, '最优开度组合（三层全空间搜索）', { s: 9.5, b: 1, f: '#3a352d' });
      for (var bj = 0; bj < 3; bj++) {
        var by = 68 + bj * 40;
        s2 += tx(300, by + 10, LAYERS[bj].short + ' 层', { s: 9, f: '#56616d' });
        s2 += rc(342, by, 190, 12, { f: '#efece4', r: 3 });
        s2 += rc(342, by, Math.max(2, 190 * opt.plan[bj]), 12, { f: opt.plan[bj] > 0.01 ? '#3a352d' : '#d4d0c8', r: 3 });
        s2 += tx(540, by + 10, Math.round(opt.plan[bj] * 100) + '%', { s: 9, m: 1 });
      }
      s2 += tx(300, 198, '产油 ' + fmt(opt.rates.oilT, 0) + ' t/d · 产水 ' + fmt(opt.rates.waterT, 0) + ' t/d', { s: 9, f: '#333f4b' });
      s2 += tx(300, 214, '含水率 ' + fmt(opt.rates.wc * 100, 0) + '% · 目标 ' + st.target + ' t/d', { s: 9, f: '#333f4b' });
      s2 += tx(300, 230, '合采液量 ' + fmt(opt.rates.liquid, 0) + ' / 上限 ' + LIQ_LIMIT + ' t/d', { s: 9, f: '#56616d' });
      s2 += rc(300, 242, 316, 74, { f: '#faf9f5', st: '#e4e0d6', r: 5 });
      s2 += tx(312, 260, '网格一格 = 10% 开度；灰色格 = 产油不达标，直接排除。', { s: 8.5, f: '#56616d' });
      s2 += tx(312, 276, '可行格里颜色越绿，产水越少。', { s: 8.5, f: '#56616d' });
      s2 += tx(312, 292, '白圈 = 三层一起搜出来的最优组合，', { s: 8.5, f: '#56616d' });
      s2 += tx(312, 306, '所以它不一定落在最绿的格子里——那格只代表 C 固定时的解。', { s: 8.5, f: '#7e8894' });
      el.innerHTML = svg(s2, 330);
      return '<b>怎么看：</b>横轴是 A 层开度、纵轴是 B 层开度，C 层先固定在最优值。' +
        '每个格子是一组开度，颜色越绿表示越少出水，灰格是“产量不达标、直接淘汰”。' +
        '白圈是最终推荐的三层组合，右边三条绿条就是它对应的开度。';
    }

    /* ---------- 3 滚动调控 ---------- */
    if (i === 3) {
      var s3 = rc(0, 0, 640, 330, { f: '#fff' });
      s3 += tx(16, 22, '30 天滚动调控：每 7 天按最新含水重算一次开度', { s: 10, b: 1, f: '#3a352d' });
      var xDay = function (d) { return 72 + (d - 1) / (DAYS - 1) * 524; };
      var rows = [44, 62, 80];
      for (var r3 = 0; r3 < 3; r3++) {
        s3 += tx(64, rows[r3] + 9, LAYERS[r3].short, { s: 8.5, f: '#56616d', a: 'end' });
      }
      s3 += tx(72, 36, '开度计划', { s: 8, f: '#7e8894' });
      sims.ai.series.forEach(function (p) {
        for (var r4 = 0; r4 < 3; r4++) {
          s3 += rc(xDay(p.day) - 8, rows[r4], 16, 12, { f: alpha('#3a352d', 0.10 + 0.80 * p.plan[r4]), r: 1 });
        }
      });
      [1, 8, 15, 22, 29].forEach(function (d) {
        s3 += ln(xDay(d), 40, xDay(d), 276, '#b26a39', 1, '3 3');
      });
      s3 += tx(xDay(8) + 2, 58, '重算', { s: 7, f: '#b26a39' });
      s3 += tx(xDay(29) - 2, 58, '重算', { s: 7, f: '#b26a39', a: 'end' });
      s3 += ln(72, 276, 596, 276, '#d2ccbf', 1);
      [1, 8, 15, 22, 29, 30].forEach(function (d) {
        s3 += tx(xDay(d), 288, 'D' + d, { s: 7.5, f: '#9ba3a9', a: 'middle' });
      });
      /* 产油曲线 */
      var oMax = Math.max.apply(null, sims.ai.series.concat(sims.fixed.series).map(function (p) { return p.oil; }));
      var oTop = Math.ceil(Math.max(oMax, st.target) / 10) * 10;
      var yOil = function (v) { return 260 - Math.min(v, oTop) / oTop * 110; };
      s3 += ln(72, 150, 72, 260, '#e1ddd3', 1);
      var pa = '', pfm = '';
      sims.ai.series.forEach(function (p, k) {
        pa += (k ? ' L' : 'M') + xDay(p.day).toFixed(1) + ' ' + yOil(p.oil).toFixed(1);
        pfm += (k ? ' L' : 'M') + xDay(p.day).toFixed(1) + ' ' + yOil(sims.fixed.series[k].oil).toFixed(1);
      });
      s3 += '<path d="' + pfm + '" fill="none" stroke="#b26a39" stroke-width="1.6" stroke-dasharray="4 3"/>';
      s3 += '<path d="' + pa + '" fill="none" stroke="#3a352d" stroke-width="2"/>';
      s3 += ln(72, yOil(st.target), 596, yOil(st.target), '#9ba3a9', 1, '3 3');
      s3 += tx(596, yOil(st.target) - 4, '目标 ' + st.target, { s: 8, f: '#7e8894', a: 'end' });
      s3 += tx(72, 146, '日产油 t/d', { s: 8, f: '#7e8894' });
      s3 += rc(72, 302, 9, 9, { f: '#3a352d', r: 2 });
      s3 += tx(86, 310, 'AI 动态', { s: 8, f: '#7e8894' });
      s3 += rc(146, 302, 9, 9, { f: '#b26a39', r: 2 });
      s3 += tx(160, 310, '固定开度', { s: 8, f: '#7e8894' });
      s3 += tx(300, 310, 'AI 达标 ' + sims.ai.hit + ' / ' + DAYS + ' 天 · 固定 ' + sims.fixed.hit + ' / ' + DAYS + ' 天', { s: 8.5, f: '#56616d' });
      el.innerHTML = svg(s3, 330);
      return '<b>怎么看：</b>上面三行是每天三层滑套的开度，颜色越深开得越大；橙色虚线是“重算”的日子。' +
        '下面两条曲线是日产油：绿线按周期重算、橙线一套开度用到底。看绿线在重算后如何把产量重新拉回目标线。';
    }

    /* ---------- 4 现场执行与复核 ---------- */
    var s4 = rc(0, 0, 640, 380, { f: '#fff' });
    s4 += tx(16, 22, 'AI 策略 vs 固定开度：逐日产油与含水对比', { s: 10, b: 1, f: '#3a352d' });
    var xD = function (d) { return 64 + (d - 1) / (DAYS - 1) * 540; };
    var oM = Math.max.apply(null, sims.ai.series.concat(sims.fixed.series).map(function (p) { return p.oil; }));
    var oT = Math.ceil(Math.max(oM, st.target) / 10) * 10;
    var yO = function (v) { return 170 - Math.min(v, oT) / oT * 118; };
    s4 += ln(64, 170, 604, 170, '#d2ccbf', 1);
    s4 += ln(64, 52, 64, 170, '#e1ddd3', 1);
    var qa = '', qf = '';
    sims.ai.series.forEach(function (p, k) {
      qa += (k ? ' L' : 'M') + xD(p.day).toFixed(1) + ' ' + yO(p.oil).toFixed(1);
      qf += (k ? ' L' : 'M') + xD(p.day).toFixed(1) + ' ' + yO(sims.fixed.series[k].oil).toFixed(1);
    });
    s4 += '<path d="' + qf + '" fill="none" stroke="#b26a39" stroke-width="1.6" stroke-dasharray="4 3"/>';
    s4 += '<path d="' + qa + '" fill="none" stroke="#3a352d" stroke-width="2.2"/>';
    s4 += ln(64, yO(st.target), 604, yO(st.target), '#9ba3a9', 1, '3 3');
    s4 += tx(604, yO(st.target) - 4, '目标 ' + st.target, { s: 8, f: '#7e8894', a: 'end' });
    s4 += tx(16, 48, '日产油 t/d', { s: 8, f: '#7e8894' });

    var wM = Math.max.apply(null, sims.ai.series.concat(sims.fixed.series).map(function (p) { return p.wcPct; }));
    var wT = Math.max(Math.ceil(wM / 10) * 10, st.wct + 10);
    var yW = function (v) { return 292 - Math.min(v, wT) / wT * 96; };
    s4 += ln(64, 292, 604, 292, '#d2ccbf', 1);
    s4 += ln(64, 196, 64, 292, '#e1ddd3', 1);
    var wa = '', wf = '';
    sims.ai.series.forEach(function (p, k) {
      wa += (k ? ' L' : 'M') + xD(p.day).toFixed(1) + ' ' + yW(p.wcPct).toFixed(1);
      wf += (k ? ' L' : 'M') + xD(p.day).toFixed(1) + ' ' + yW(sims.fixed.series[k].wcPct).toFixed(1);
    });
    s4 += '<path d="' + wf + '" fill="none" stroke="#b26a39" stroke-width="1.6" stroke-dasharray="4 3"/>';
    s4 += '<path d="' + wa + '" fill="none" stroke="#3a352d" stroke-width="2.2"/>';
    s4 += ln(64, yW(st.wct), 604, yW(st.wct), '#b05a51', 1, '3 3');
    s4 += tx(604, yW(st.wct) - 4, '含水上限 ' + st.wct + '%', { s: 8, f: '#b05a51', a: 'end' });
    s4 += tx(16, 192, '含水率 %', { s: 8, f: '#7e8894' });
    s4 += tx(64, 308, 'D1', { s: 7.5, f: '#9ba3a9', a: 'middle' });
    s4 += tx(604, 308, 'D' + DAYS, { s: 7.5, f: '#9ba3a9', a: 'middle' });

    /* 对比指标 */
    var fx = sims.fixed, ai = sims.ai;
    var lastA = ai.series[DAYS - 1], lastF = fx.series[DAYS - 1];
    var boxes = [
      { t: '累产油 t', a: fmt(ai.cumOil, 0), f: fmt(fx.cumOil, 0) },
      { t: '累产水 t', a: fmt(ai.cumWater, 0), f: fmt(fx.cumWater, 0) },
      { t: '期末含水', a: fmt(lastA.wcPct, 1) + '%', f: fmt(lastF.wcPct, 1) + '%' },
      { t: '达标天数', a: ai.hit + '/' + DAYS, f: fx.hit + '/' + DAYS }
    ];
    boxes.forEach(function (b, k) {
      var bx2 = 16 + k * 152;
      s4 += rc(bx2, 312, 144, 54, { f: '#faf9f5', st: '#e4e0d6', r: 5 });
      s4 += tx(bx2 + 10, 328, b.t, { s: 7.5, f: '#7e8894' });
      s4 += tx(bx2 + 10, 346, 'AI ' + b.a, { s: 11, b: 1, f: '#3a352d' });
      s4 += tx(bx2 + 10, 360, '固定 ' + b.f, { s: 8.5, f: '#b26a39' });
    });
    el.innerHTML = svg(s4, 380);
    return '<b>怎么看：</b>上图是日产油、下图是含水率，绿线 AI、橙虚线固定开度。' +
      '固定开度用久了含水会一路爬过红线；AI 在重算日把 C 层关小，把水压回去，产油仍贴着目标线。' +
      '下面的四个格子是累计账：AI 不是“产量更高”，而是“同样产量下少产水”。' +
      '上线前必须复核：滑套实际开度反馈、砂堵与结垢、地面液处理能力，异常时按预案人工干预。';
  }

  window.__IQ_WF__ = window.__IQ_WF__ || {};
  window.__IQ_WF__[KEY] = {
    model: { LAYERS: LAYERS, DEFAULTS: DEFAULTS, LIQ_LIMIT: LIQ_LIMIT, DAYS: DAYS, rates: rates, optimizeOpen: optimizeOpen, simulate: simulate },
    conceptSvg: conceptSvg,
    CONCEPTS: CONCEPTS
  };
  window.__IQ_WF_RENDER__ = window.__IQ_WF_RENDER__ || {};
  window.__IQ_WF_RENDER__[KEY] = render;
})();
