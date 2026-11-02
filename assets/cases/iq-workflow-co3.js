/* =========================================================
   co3 完井管柱受力智能分析 · 案例流程页的逐步动态图
   ---------------------------------------------------------
   模型（分段受力积分 + 滑动平均残差 + 速度扫描）与概念图随案例
   一起复用；参数取 demo/demo.js 的示范默认值。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'completion-string-stress-analysis';

  /* ---------------- 模型（与 demo/demo.js 完全一致） ---------------- */
  var YIELD = 480, AREA = 0.012, LOWER = 120, UPPER = 1100, SF_LIMIT = 2.0, STEP = 20;
  var DEFAULTS = { v: 0.8, mu: 0.20, inc: 40, w: 280, H: 4200 };
  var BASE_SPEED = 0.6;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function buildProfile(st, speed) {
    var v = (speed == null) ? st.v : speed;
    var H = st.H, buildEnd = H * 0.35, dogC = H * 0.62, dogW = 35;
    var dogAmp = 1.5 + st.inc / 90 * 5 + v * 6;
    var n = Math.round(H / STEP);
    var arr = [], F = 0, disp = 0;
    for (var i = 0; i <= n; i++) {
      var s = i * STEP;
      var bump = dogAmp * Math.exp(-Math.pow((s - dogC) / dogW, 2));
      var incDeg = st.inc * Math.min(1, s / buildEnd) + bump;
      var incRad = incDeg * Math.PI / 180;
      var dragExtra = 1 + 0.42 * Math.exp(-Math.pow((s - dogC) / 70, 2));
      var dF = st.w * (Math.cos(incRad) - st.mu * Math.sin(incRad) * dragExtra) * STEP / 1000;
      F = Math.max(0, F + dF);
      disp += Math.sin(incRad) * STEP;
      var slope = s < buildEnd ? st.inc / buildEnd : 0;
      var dBump = dogAmp * (-2 * (s - dogC) / (dogW * dogW)) * Math.exp(-Math.pow((s - dogC) / dogW, 2));
      var dls = Math.abs(slope + dBump) * 30;
      var axial = (F * 1000 / AREA) / 1e6;
      var bending = 6.98 * dls * 1.2 * 2.4;
      var stress = axial + bending;
      var sf = YIELD / Math.max(stress, 1);
      var risk = (sf < 1.6 || (s > buildEnd && F < LOWER)) ? 'high' : (sf < 2.2 ? 'mid' : 'low');
      arr.push({ s: s, inc: incDeg, disp: disp, F: F, sf: sf, dls: dls, risk: risk });
    }
    return arr;
  }

  function summarize(arr, st) {
    var minSF = 9, maxF = 0, sum = 0, cnt = 0, highRuns = [], run = null, anomaly = null, smoothW = 7;
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (p.s > st.H * 0.05) minSF = Math.min(minSF, p.sf);
      maxF = Math.max(maxF, p.F);
      if (p.risk === 'high') {
        if (!run) run = { from: p.s, to: p.s };
        else run.to = p.s;
      } else if (run) { highRuns.push(run); run = null; }
      if (i >= smoothW && i < arr.length - smoothW && p.s > st.H * 0.2) {
        var sm = 0;
        for (var k = i - smoothW; k <= i + smoothW; k++) sm += arr[k].F;
        sm /= (2 * smoothW + 1);
        var res = p.F - sm;
        if (!anomaly || res < anomaly.res) anomaly = { s: p.s, res: res, F: p.F };
      }
      sum += p.F; cnt++;
    }
    if (run) highRuns.push(run);
    return {
      minSF: minSF, maxF: maxF, endF: arr[arr.length - 1].F,
      meanF: sum / Math.max(cnt, 1), highRuns: highRuns,
      anomaly: anomaly || { s: st.H * 0.62, res: 0, F: 0 }
    };
  }

  function scanSpeed(st) {
    var feasible = null, fallback = null;
    for (var v = 0.2; v <= 2.001; v += 0.05) {
      var arr = buildProfile(st, v);
      var sum = summarize(arr, st);
      var ok = sum.minSF >= SF_LIMIT && sum.endF >= LOWER && sum.maxF <= UPPER;
      var score = Math.min(sum.minSF / SF_LIMIT, 1.4) * 2 + Math.min(sum.endF / LOWER, 1.2) - v * 0.04;
      if (ok && (!feasible || v > feasible.v)) feasible = { v: v, sum: sum, arr: arr };
      if (!fallback || score > fallback.score) fallback = { v: v, sum: sum, arr: arr, score: score };
    }
    return feasible || fallback;
  }

  /* ---------------- 概念图 ---------------- */
  var CONCEPTS = [
    { t: '管柱', prof: '下入井内的钢管柱，靠自重与井口钩载完成起下。', life: '像一根很长的吸管，越深越沉，也越容易被弯折卡住。', see: '左图：管柱从上到下穿过地层；右图是同一根管柱算出的受力曲线。' },
    { t: '钩载', prof: '井口大钩承受的拉力，等于管柱自重减去摩阻与井壁支撑。', life: '像提着一串很长的钥匙，手感到的重量就是钩载。', see: '钩载曲线往右下走；低于 120 kN 说明管柱可能“顶不进去”。' },
    { t: '安全系数', prof: '管材屈服强度除以实际应力，衡量还有多少余量。', life: '像桥的承重余量：设计承重 5 吨，现在只压 2 吨，安全系数 2.5。', see: '安全系数低于 2.0 的井段被标红，是重点风险段。' }
  ];

  function conceptSvg() {
    var s = '<svg viewBox="0 0 700 332" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="管柱受力概念图解：长吸管与井眼轨迹">';
    s += '<rect width="700" height="332" fill="#fff"/>';
    /* 左：生活比喻 */
    s += '<rect x="8" y="8" width="306" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += '<text x="22" y="27" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">生活比喻 · 一根很长的吸管</text>';
    s += '<rect x="26" y="40" width="120" height="22" fill="#f3efe3"/>';
    s += '<text x="32" y="55" font-size="8" fill="#9ba3a9">井口大钩</span></text>';
    s += '<line x1="70" y1="62" x2="70" y2="264" stroke="#8d979d" stroke-width="4"/>';
    s += '<line x1="80" y1="62" x2="80" y2="264" stroke="#b8c2be" stroke-width="2"/>';
    s += '<text x="92" y="80" font-size="8.5" fill="#4a545d">管柱 = 长吸管</text>';
    s += '<path d="M64 72 L64 96" stroke="#b26a39" stroke-width="1.3"/><path d="M60 92 L64 100 L68 92 z" fill="#b26a39"/>';
    s += '<text x="30" y="104" font-size="8" fill="#b26a39">自重 ↓</text>';
    s += '<rect x="24" y="150" width="150" height="46" rx="4" fill="#e9dfc7" stroke="#d8c9a3"/>';
    s += '<text x="30" y="166" font-size="8.5" fill="#8a744a">弯曲井段（狗腿）</text>';
    s += '<text x="30" y="182" font-size="7.5" fill="#8a744a">吸管在这里被弯住，更容易卡</text>';
    s += '<text x="22" y="286" font-size="9" fill="#9ba3a9">越深越沉；弯得越急，越容易被井壁“咬住”。</text>';
    s += '<text x="22" y="304" font-size="8.5" fill="#3a352d">所以下入前要先算：哪里受力大、哪里会卡。</text>';
    /* 右：专业结构 */
    s += '<rect x="322" y="8" width="370" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += '<text x="336" y="27" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">专业结构 · 轨迹 + 钩载 + 安全系数</text>';
    s += '<line x1="352" y1="42" x2="352" y2="268" stroke="#d2ccbf"/>';
    s += '<line x1="352" y1="42" x2="666" y2="42" stroke="#d2ccbf"/>';
    s += '<text x="356" y="38" font-size="8" fill="#7e8894">井深 →</text>';
    s += '<path d="M352 46 C392 60 400 150 430 190 C456 226 470 240 486 246" fill="none" stroke="#3a352d" stroke-width="2"/>';
    s += '<text x="500" y="250" font-size="8" fill="#3a352d">井眼轨迹</text>';
    s += '<path d="M430 214 C436 232 444 246 452 258" fill="none" stroke="#b26a39" stroke-width="1.4"/>';
    s += '<text x="458" y="268" font-size="8" fill="#b26a39">狗腿处弯曲应力</text>';
    s += '<path d="M500 60 C540 96 560 160 600 200 C620 220 636 228 652 232" fill="none" stroke="#a03d4f" stroke-width="1.6" stroke-dasharray="4 3"/>';
    s += '<text x="560" y="150" font-size="8" fill="#a03d4f">钩载 kN</text>';
    s += '<path d="M500 70 C520 88 536 112 552 140" fill="none" stroke="#a9852f" stroke-width="1.6"/>';
    s += '<text x="556" y="120" font-size="8" fill="#8a744a">安全系数</text>';
    s += '<line x1="544" y1="196" x2="668" y2="196" stroke="#b05a51" stroke-width="1" stroke-dasharray="3 3"/>';
    s += '<text x="668" y="192" font-size="7.5" fill="#b05a51" text-anchor="end">阈值 2.0</text>';
    s += '<rect x="336" y="272" width="342" height="44" rx="6" fill="#fff" stroke="#f3f0e7"/>';
    s += '<text x="346" y="290" font-size="8.5" fill="#3a352d">把看不见的井下受力，变成可定位的风险曲线。</text>';
    s += '<text x="346" y="306" font-size="8" fill="#4a545d">黄线看余量、蓝线看拉力、红线看红线以下的风险段。</text>';
    return s + '</svg>';
  }

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

  function render(i, el) {
    var st = DEFAULTS;
    var arr = buildProfile(st);
    var sum = summarize(arr, st);
    var cur = scanSpeed(st);

    /* ---------- 0 测斜与管柱数据整理 ---------- */
    if (i === 0) {
      var s = rc(0, 0, 640, 330, { f: '#fff' });
      s += tx(16, 22, '井眼轨迹侧视图 · 井斜角随井深变化', { s: 10, b: 1, f: '#3a352d' });
      var py = function (s0) { return 40 + s0 / st.H * 240; };
      var px = function (d) { return 88 + d / 700 * 250; };
      s += ln(88, 40, 88, 280, '#d2ccbf');
      s += ln(88, 280, 344, 280, '#d2ccbf');
      s += tx(88, 296, '垂深 0', { s: 8, f: '#7e8894', a: 'middle' });
      s += tx(88, 312, '', { s: 8 });
      s += tx(30, 160, '垂深 ↑', { s: 8, f: '#7e8894', a: 'middle' });
      s += tx(344, 296, st.H + ' m', { s: 8, f: '#7e8894', a: 'middle' });
      var path = '';
      arr.forEach(function (p, k) { path += (k ? ' L' : 'M') + px(p.disp).toFixed(1) + ' ' + py(p.s).toFixed(1); });
      s += '<path d="' + path + '" fill="none" stroke="#3a352d" stroke-width="2.4"/>';
      /* 井斜角小刻度 */
      [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
        var s0 = st.H * f, y = py(s0);
        var p = arr[Math.min(arr.length - 1, Math.round(s0 / STEP))];
        s += ln(82, y.toFixed(1), 88, y.toFixed(1), '#9ba3a9');
        s += tx(78, y + 3, fmt(p.inc, 0) + '°', { s: 7.5, f: '#7e8894', a: 'end' });
      });
      s += tx(px(arr[Math.round(arr.length * 0.35)].disp), py(st.H * 0.35) - 8, '造斜段', { s: 8.5, f: '#3a352d' });
      s += rc(366, 40, 254, 210, { f: '#faf9f5', st: '#e4e0d6' });
      s += tx(380, 62, '整理后的数据表', { s: 9.5, b: 1, f: '#3a352d' });
      var cols = ['深度 m', '井斜 °', '线重 kN/m'];
      cols.forEach(function (c, j) { s += tx(380 + j * 82, 84, c, { s: 7.5, f: '#7e8894' }); });
      [0, 0.4, 0.8, 1].forEach(function (f, k) {
        var p = arr[Math.min(arr.length - 1, Math.round(arr.length * f))];
        var y = 100 + k * 32;
        s += tx(380, y, fmt(p.s, 0), { s: 9, m: 1 });
        s += tx(462, y, fmt(p.inc, 1), { s: 9, m: 1 });
        s += tx(544, y, (st.w / 1000).toFixed(3), { s: 9, m: 1 });
        s += ln(372, y + 8, 610, y + 8, '#efece4');
      });
      s += tx(380, 238, '步长 20 m · 单位 m / kN / MPa', { s: 8, f: '#7e8894' });
      s += tx(16, 316, '测斜点稀疏不插值，狗腿度会被严重低估——弯曲应力与风险段都会漏判。', { s: 9, f: '#7e8894' });
      el.innerHTML = svg(s, 330);
      return '<b>怎么看：</b>左边是井眼的侧面形状：越往下越往右偏，曲线越陡表示井斜角越大。' +
        '右边把测斜点插值成每 20 m 一行的表，后面所有积分都基于这张表。';
    }

    /* ---------- 1 受力积分与应力计算 ---------- */
    if (i === 1) {
      var s2 = rc(0, 0, 640, 330, { f: '#fff' });
      s2 += tx(16, 22, '钩载（kN）与安全系数随井深剖面', { s: 10, b: 1, f: '#3a352d' });
      var y2 = function (s0) { return 44 + s0 / st.H * 236; };
      s2 += ln(300, 40, 300, 286, '#d2ccbf');
      s2 += ln(44, 40, 44, 286, '#d2ccbf');
      s2 += ln(378, 40, 378, 286, '#d2ccbf');
      s2 += tx(172, 304, '钩载 kN', { s: 8, f: '#a03d4f', a: 'middle' });
      s2 += tx(490, 304, '安全系数', { s: 8, f: '#a9852f', a: 'middle' });
      s2 += tx(20, 168, '井深 ↑', { s: 8, f: '#7e8894', a: 'middle' });
      var xF = function (F) { return 44 + F / (UPPER * 0.4) * 240; };
      var xS = function (v) { return 378 + v / 4 * 210; };
      var qF = '', qS = '';
      arr.forEach(function (p, k) {
        qF += (k ? ' L' : 'M') + xF(p.F).toFixed(1) + ' ' + y2(p.s).toFixed(1);
        qS += (k ? ' L' : 'M') + xS(p.sf).toFixed(1) + ' ' + y2(p.s).toFixed(1);
      });
      s2 += '<path d="' + qF + '" fill="none" stroke="#a03d4f" stroke-width="2"/>';
      s2 += '<path d="' + qS + '" fill="none" stroke="#a9852f" stroke-width="2"/>';
      s2 += ln(xF(LOWER), 40, xF(LOWER), 286, '#b05a51', 1, '3 3');
      s2 += tx(xF(LOWER) + 3, 268, '最小钩载 120', { s: 7.5, f: '#b05a51' });
      s2 += ln(xS(SF_LIMIT), 40, xS(SF_LIMIT), 286, '#b05a51', 1, '3 3');
      s2 += tx(xS(SF_LIMIT) + 3, 268, '阈值 2.0', { s: 7.5, f: '#b05a51' });
      s2 += rc(16, 292, 608, 30, { f: '#faf9f5', st: '#e4e0d6' });
      s2 += tx(28, 312, '末端钩载 ' + fmt(sum.endF, 0) + ' kN · 最小安全系数 ' + fmt(sum.minSF, 2) +
        ' · 最大值 ' + fmt(sum.maxF, 0) + ' kN', { s: 9.5, f: '#333f4b' });
      el.innerHTML = svg(s2, 330);
      return '<b>怎么看：</b>两条曲线都以井深为纵轴。蓝线越往下越小，因为摩阻在“吃掉”自重；' +
        '黄线越往下越小，表示余量越来越少。任何一条穿过左边红色虚线，就说明这一段不该按当前速度下。';
    }

    /* ---------- 2 异常检测与风险分段 ---------- */
    if (i === 2) {
      var W = 7, res = [];
      for (var k = W; k < arr.length - W; k++) {
        var sm = 0;
        for (var m2 = k - W; m2 <= k + W; m2++) sm += arr[m2].F;
        sm /= (2 * W + 1);
        res.push({ s: arr[k].s, r: arr[k].F - sm });
      }
      var mxR = Math.max.apply(null, res.map(function (p) { return Math.abs(p.r); })) || 1;
      var s3 = rc(0, 0, 640, 330, { f: '#fff' });
      s3 += tx(16, 22, '滑动平均残差（kN） · 越往下越负表示钩载突降', { s: 10, b: 1, f: '#3a352d' });
      var y0 = 158, yR = function (r) { return y0 - r / (mxR * 1.2) * 96; };
      var xD = function (s0) { return 64 + s0 / st.H * 540; };
      s3 += ln(64, y0, 604, y0, '#9ba3a9', 1);
      s3 += ln(64, 62, 64, 262, '#d2ccbf');
      s3 += ln(64, 254, 604, 254, '#d2ccbf');
      var qRes = '';
      res.forEach(function (p, idx) { qRes += (idx ? ' L' : 'M') + xD(p.s).toFixed(1) + ' ' + yR(p.r).toFixed(1); });
      s3 += '<path d="' + qRes + '" fill="none" stroke="#3a352d" stroke-width="1.6"/>';
      s3 += ln(64, yR(-mxR * 0.5), 604, yR(-mxR * 0.5), '#b23a34', 1, '3 3');
      s3 += tx(64, yR(-mxR * 0.5) - 4, '疑似遇阻阈值', { s: 7.5, f: '#b23a34' });
      s3 += '<circle cx="' + xD(sum.anomaly.s) + '" cy="' + yR(sum.anomaly.res) + '" r="4.5" fill="#b23a34" stroke="#fff" stroke-width="1.5"/>';
      s3 += tx(xD(sum.anomaly.s) + 8, yR(sum.anomaly.res) + 4, '疑似遇阻 ' + fmt(sum.anomaly.s, 0) + ' m', { s: 8.5, f: '#b23a34' });
      s3 += tx(16, 286, '风险段（安全系数或钩载越界）', { s: 9, b: 1, f: '#56616d' });
      s3 += rc(64, 294, 540, 20, { f: '#f1f4f2', st: '#e4e0d6', r: 4 });
      if (sum.highRuns.length) {
        sum.highRuns.forEach(function (r) {
          var x1 = xD(r.from), x2 = Math.max(xD(r.to), x1 + 3);
          s3 += rc(x1, 294, x2 - x1, 20, { f: 'rgba(178,58,52,.35)', r: 3 });
        });
      }
      s3 += tx(16, 322, '风险段 ' + (sum.highRuns.length ? sum.highRuns.map(function (r) { return fmt(r.from, 0) + '—' + fmt(r.to, 0) + ' m'; }).join('、') : '无') +
        ' · 最小安全系数 ' + fmt(sum.minSF, 2), { s: 9, f: '#56616d' });
      el.innerHTML = svg(s3, 330);
      return '<b>怎么看：</b>残差曲线是“实际钩载减去滑动平均值”。正常是贴着 0 的小幅波动；' +
        '明显往下掉说明这一段阻力突然变大，可能是遇阻或缩径。下方红条是把安全系数低于 2.0 的井段标出来。';
    }

    /* ---------- 3 下入速度优化 ---------- */
    if (i === 3) {
      var pts = [], feas = [];
      for (var v = 0.2; v <= 2.001; v += 0.05) {
        var a2 = buildProfile(st, v), sm2 = summarize(a2, st);
        var ok = sm2.minSF >= SF_LIMIT && sm2.endF >= LOWER && sm2.maxF <= UPPER;
        var o = { v: v, sf: sm2.minSF, t: st.H / 1000 / v };
        pts.push(o);
        if (ok) feas.push(o);
      }
      var vmin = feas.length ? feas[0].v : 0, vmax = feas.length ? feas[feas.length - 1].v : 0;
      var maxT = Math.max.apply(null, pts.map(function (p) { return p.t; }));
      var s4 = rc(0, 0, 640, 330, { f: '#fff' });
      s4 += tx(16, 22, '速度扫描：安全系数 与 下入用时', { s: 10, b: 1, f: '#3a352d' });
      var xv = function (vv) { return 64 + (vv - 0.2) / 1.8 * 520; };
      if (vmax) s4 += rc(xv(vmin), 40, Math.max(4, xv(vmax) - xv(vmin)), 238, { f: 'rgba(58,53,45,.10)', st: 'none' });
      s4 += ln(64, 40, 64, 278, '#d2ccbf');
      s4 += ln(64, 278, 604, 278, '#d2ccbf');
      s4 += tx(604, 292, '速度 m/s', { s: 8, f: '#7e8894', a: 'end' });
      var yS = function (v2) { return 278 - Math.min(v2, 4) / 4 * 230; };
      var yT = function (t2) { return 278 - t2 / (maxT * 1.05) * 230; };
      var pS = '', pT = '';
      pts.forEach(function (p, idx) {
        pS += (idx ? ' L' : 'M') + xv(p.v).toFixed(1) + ' ' + yS(p.sf).toFixed(1);
        pT += (idx ? ' L' : 'M') + xv(p.v).toFixed(1) + ' ' + yT(p.t).toFixed(1);
      });
      s4 += '<path d="' + pS + '" fill="none" stroke="#a03d4f" stroke-width="2"/>';
      s4 += '<path d="' + pT + '" fill="none" stroke="#b26a39" stroke-width="1.8" stroke-dasharray="4 3"/>';
      s4 += ln(64, yS(SF_LIMIT), 604, yS(SF_LIMIT), '#b23a34', 1, '3 3');
      s4 += tx(64, yS(SF_LIMIT) - 4, '安全系数 2.0', { s: 7.5, f: '#b23a34' });
      s4 += tx(560, 60, '安全系数', { s: 8.5, f: '#a03d4f' });
      s4 += tx(560, 74, '下入用时', { s: 8.5, f: '#b26a39' });
      s4 += rc(16, 292, 608, 30, { f: '#faf9f5', st: '#e4e0d6' });
      s4 += tx(28, 312, '可行速度窗口 ' + fmt(vmin, 2) + '—' + fmt(vmax, 2) + ' m/s → 选用 ' + fmt(cur.v, 2) +
        ' m/s，用时约 ' + fmt(st.H / 1000 / cur.v, 1) + ' h，最小安全系数 ' + fmt(cur.sum.minSF, 2), { s: 9.5, f: '#3a352d' });
      el.innerHTML = svg(s4, 330);
      return '<b>怎么看：</b>横轴是下入速度。蓝线是安全系数，速度越快越往下掉；橙虚线是用时，速度越快越短。' +
        '浅绿底色是可行窗口——两条约束都满足的区间，窗口内取最快的那一档。';
    }

    /* ---------- 4 现场复核与指重表校验 ---------- */
    var s5 = rc(0, 0, 640, 330, { f: '#fff' });
    s5 += tx(16, 22, '预测钩载 vs 现场指重表（读数待录入）', { s: 10, b: 1, f: '#3a352d' });
    var depths = [0.25, 0.5, 0.75, 1];
    s5 += tx(16, 48, '深度', { s: 8, f: '#7e8894' });
    s5 += tx(110, 48, '预测钩载 kN', { s: 8, f: '#7e8894' });
    s5 += tx(240, 48, '实测读数 kN', { s: 8, f: '#7e8894' });
    s5 += tx(370, 48, '偏差', { s: 8, f: '#7e8894' });
    s5 += tx(470, 48, '复核', { s: 8, f: '#7e8894' });
    depths.forEach(function (f, k) {
      var p = arr[Math.min(arr.length - 1, Math.round(arr.length * f))];
      var y = 58 + k * 40;
      s5 += rc(16, y, 300, 32, { f: k % 2 ? '#faf9f5' : '#fff', st: '#efece4', r: 3 });
      s5 += tx(24, y + 20, fmt(p.s, 0) + ' m', { s: 9.5, m: 1 });
      s5 += tx(118, y + 20, fmt(p.F, 0), { s: 9.5, m: 1, f: '#a03d4f' });
      s5 += tx(248, y + 20, '____', { s: 9.5, m: 1, f: '#9ba3a9' });
      s5 += tx(378, y + 20, '待算', { s: 9.5, f: '#9ba3a9' });
      s5 += rc(452, y + 7, 14, 14, { f: '#fff', st: '#d2ccbf', r: 3 });
      s5 += tx(476, y + 19, '指重表复核', { s: 8.5, f: '#7e8894' });
    });
    s5 += tx(16, 238, '偏差超限时的处理', { s: 9.5, b: 1, f: '#3a352d' });
    [
      '反演摩阻系数，再重算钩载曲线',
      '高风险段降低下放速度或增加短起下',
      '复核井眼清洁度与缩径段'
    ].forEach(function (t, k) {
      var y = 258 + k * 22;
      s5 += rc(18, y - 10, 10, 10, { f: '#fff', st: '#3a352d', r: 2 });
      s5 += tx(38, y, t, { s: 9.5, f: '#56616d' });
    });
    s5 += tx(330, 238, '当前预测：末端 ' + fmt(sum.endF, 0) + ' kN · 最小安全系数 ' + fmt(sum.minSF, 2), { s: 9.5, f: '#333f4b' });
    s5 += tx(330, 258, '风险段：' + (sum.highRuns.length ? sum.highRuns.map(function (r) { return fmt(r.from, 0) + '—' + fmt(r.to, 0) + ' m'; }).join('、') : '无'), { s: 9, f: '#b23a34' });
    s5 += rc(330, 272, 294, 42, { f: '#faf9f5', st: '#e4e0d6', r: 5 });
    s5 += tx(342, 290, '实测值不由示范编造：现场读数录入后，', { s: 8.5, f: '#56616d' });
    s5 += tx(342, 305, '这里才会出现散点与偏差直方图。', { s: 8.5, f: '#56616d' });
    el.innerHTML = svg(s5, 330);
    return '<b>怎么看：</b>左侧表格是预测钩载；实测列留空，等现场指重表读数录入后再比对。' +
      '偏差大不是“模型错了”，通常说明摩阻系数需要按本井反演，或者井眼状况与设计不一致。';
  }

  window.__IQ_WF__ = window.__IQ_WF__ || {};
  window.__IQ_WF__[KEY] = {
    model: { buildProfile: buildProfile, summarize: summarize, scanSpeed: scanSpeed, DEFAULTS: DEFAULTS, SF_LIMIT: SF_LIMIT },
    conceptSvg: conceptSvg,
    CONCEPTS: CONCEPTS
  };
  window.__IQ_WF_RENDER__ = window.__IQ_WF_RENDER__ || {};
  window.__IQ_WF_RENDER__[KEY] = render;
})();
