/* =========================================================
   co2 射孔参数智能设计 · 案例流程页的逐步动态图
   ---------------------------------------------------------
   模型（产能代理 + 风险规则 + 网格搜索）与概念图随案例包一起
   在流程页复用；参数取 demo/demo.js 的示范默认值。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'perforation-parameter-design';

  /* ---------------- 模型（与 demo/demo.js 完全一致） ---------------- */
  var PHASES = [0, 45, 60, 90, 120, 180];
  var PHASE_FACTOR = { 0: 0.72, 45: 0.90, 60: 1.0, 90: 0.95, 120: 0.89, 180: 0.80 };
  var PHASE_PENALTY = { 0: 20, 45: 12, 60: 8, 90: 0, 120: 2, 180: 6 };
  var PHASE_HOLES = { 0: 1, 45: 8, 60: 6, 90: 4, 120: 3, 180: 2 };
  var RISK_LIMIT = 64;
  var DEFAULTS = { n: 16, phase: 60, d: 10, len: 8, pressure: 32 };
  var N_MIN = 4, N_MAX = 24, L_MIN = 2, L_MAX = 20;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function calc(n, phase, d, L, p) {
    var dn = 1 - Math.exp(-n / 7);
    var pf = PHASE_FACTOR[phase] || 0.9;
    var df = 0.55 + 0.45 * Math.pow(d / 10, 0.6);
    var lf = 0.45 + 0.55 * (1 - Math.exp(-L / 6));
    var press = 0.75 + 0.35 * (p - 15) / 35;
    var pi = 3.0 * dn * pf * df * lf * press;
    var drawdown = Math.max(5, (p - 8) * 0.9);
    var q = pi * drawdown;
    var sand = 4 + 1.15 * n + 2.0 * d + 1.1 * (p - 20) + 0.55 * L;
    var casing = 5 + 1.55 * n + 0.6 * d + (PHASE_PENALTY[phase] || 0);
    var risk = clamp(0.62 * sand + 0.38 * casing, 0, 100);
    return { q: q, risk: risk, sand: clamp(sand, 0, 100), casing: clamp(casing, 0, 100), pi: pi };
  }

  function optimize(st) {
    var all = [], qmax = 0;
    PHASES.forEach(function (ph) {
      [6, 7, 8, 9, 10, 11, 12, 13, 14].forEach(function (d) {
        for (var n = N_MIN; n <= N_MAX; n++) {
          for (var L = L_MIN; L <= L_MAX; L++) {
            var m = calc(n, ph, d, L, st.pressure);
            all.push({ n: n, phase: ph, d: d, len: L, q: m.q, risk: m.risk, feasible: m.risk <= RISK_LIMIT });
            if (m.q > qmax) qmax = m.q;
          }
        }
      });
    });
    var best = null;
    all.forEach(function (c) {
      var key = c.feasible ? c.q : c.q - (c.risk - RISK_LIMIT) * 2.2;
      if (!best || key > best.key) {
        best = { key: key, n: c.n, phase: c.phase, d: c.d, len: c.len, q: c.q, risk: c.risk, feasible: c.feasible };
      }
    });
    return best;
  }

  /* ---------------- 概念图 ---------------- */
  var CONCEPTS = [
    { t: '射孔', prof: '在套管和水泥环上制造孔眼，让储层流体进入井筒。', life: '像给一瓶油扎几个小窗口，油才流得出来。', see: '左边两个瓶子：封住 vs 开窗；右边是井筒剖面上的孔眼。' },
    { t: '孔密 / 相位', prof: '孔密是每米开多少孔，相位是孔眼在圆周上的分布角度。', life: '像在瓶壁上开孔：开得密出油快，但瓶壁更容易裂。', see: '相位 60° 表示圆周每 60° 一个孔，一圈共 6 孔。' },
    { t: '风险指数', prof: '出砂与套管损伤的综合评分，越高越容易出砂或损坏套管。', life: '像窗户开太大，墙就不结实了。', see: '风险超过 64 的组合在热力图上被罩白，视为不可行。' }
  ];

  function conceptSvg() {
    var s = '<svg viewBox="0 0 700 332" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="射孔概念图解：瓶子开窗与井筒剖面">';
    s += '<rect width="700" height="332" fill="#fff"/>';
    s += '<defs>' +
      '<marker id="co2-c-ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#b26a39"/></marker>' +
      '<marker id="co2-c-oil" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#a03d4f"/></marker>' +
      '</defs>';
    s += '<rect x="8" y="8" width="306" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += '<text x="22" y="27" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">生活比喻 · 给瓶子打几个小窗口</text>';
    s += '<rect x="36" y="86" width="86" height="150" rx="10" fill="#e9dfc7" stroke="#d8c9a3"/>';
    s += '<rect x="68" y="72" width="22" height="16" rx="3" fill="#d4d0c8" stroke="#8d979d"/>';
    s += '<line x1="40" y1="110" x2="118" y2="110" stroke="#cbbd99" stroke-dasharray="2 3"/>';
    s += '<line x1="126" y1="144" x2="138" y2="156" stroke="#b05a51" stroke-width="1.4"/>';
    s += '<line x1="138" y1="144" x2="126" y2="156" stroke="#b05a51" stroke-width="1.4"/>';
    s += '<text x="79" y="252" font-size="8.5" fill="#8a744a" text-anchor="middle">封住：油出不来</text>';
    s += '<line x1="132" y1="160" x2="164" y2="160" stroke="#4a545d" stroke-width="1.2" marker-end="url(#co2-c-ar)"/>';
    s += '<text x="148" y="176" font-size="8" fill="#4a545d" text-anchor="middle">打孔</text>';
    s += '<rect x="176" y="86" width="106" height="150" rx="10" fill="#e9dfc7" stroke="#d8c9a3"/>';
    s += '<rect x="218" y="72" width="22" height="16" rx="3" fill="#d4d0c8" stroke="#8d979d"/>';
    [104, 126, 148, 170, 192].forEach(function (yy) {
      s += '<circle cx="279" cy="' + yy + '" r="2.6" fill="#b26a39"/>';
      s += '<line x1="284" y1="' + yy + '" x2="304" y2="' + yy + '" stroke="#b26a39" stroke-width="1.2" marker-end="url(#co2-c-ar)"/>';
    });
    s += '<text x="229" y="252" font-size="8.5" fill="#3a352d" text-anchor="middle">开窗：油从小孔流出</text>';
    s += '<text x="22" y="286" font-size="9" fill="#9ba3a9">同一个瓶子，只是墙上多了几个孔。</text>';
    s += '<text x="22" y="304" font-size="8.5" fill="#3a352d">开几个孔、开多大 = 射孔参数设计。</text>';
    s += '<rect x="322" y="8" width="370" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += '<text x="336" y="27" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">专业结构 · 井筒剖面与射孔孔眼</text>';
    s += '<rect x="336" y="56" width="230" height="64" fill="#f2ece0"/>';
    s += '<rect x="336" y="120" width="230" height="120" fill="#e9dfc7"/>';
    s += '<rect x="336" y="240" width="230" height="44" fill="#f2ece0"/>';
    s += '<text x="342" y="76" font-size="8.5" fill="#9ba3a9">上部地层</text>';
    s += '<text x="342" y="136" font-size="8.5" fill="#8a744a">储层（含油）</text>';
    s += '<text x="342" y="258" font-size="8.5" fill="#9ba3a9">下部地层</text>';
    s += '<line x1="430" y1="42" x2="430" y2="282" stroke="#d8d2c4" stroke-width="18"/>';
    s += '<line x1="418" y1="42" x2="418" y2="282" stroke="#c9c3b4" stroke-width="1.6"/>';
    s += '<line x1="442" y1="42" x2="442" y2="282" stroke="#c9c3b4" stroke-width="1.6"/>';
    s += '<line x1="423" y1="42" x2="423" y2="282" stroke="#8d979d" stroke-width="2.4"/>';
    s += '<line x1="437" y1="42" x2="437" y2="282" stroke="#8d979d" stroke-width="2.4"/>';
    s += '<rect x="420" y="34" width="20" height="12" rx="2" fill="#d4d0c8" stroke="#8d979d"/>';
    [148, 172, 196, 220].forEach(function (yy) {
      s += '<line x1="423" y1="' + yy + '" x2="402" y2="' + yy + '" stroke="#b26a39" stroke-width="2.2" stroke-linecap="round"/>';
      s += '<line x1="437" y1="' + yy + '" x2="458" y2="' + yy + '" stroke="#b26a39" stroke-width="2.2" stroke-linecap="round"/>';
      s += '<circle cx="402" cy="' + yy + '" r="1.6" fill="#b26a39"/><circle cx="458" cy="' + yy + '" r="1.6" fill="#b26a39"/>';
    });
    [160, 184, 208].forEach(function (yy) {
      s += '<line x1="398" y1="' + yy + '" x2="416" y2="' + yy + '" stroke="#a03d4f" stroke-width="1.2" marker-end="url(#co2-c-oil)"/>';
    });
    s += '<line x1="430" y1="238" x2="430" y2="62" stroke="#a03d4f" stroke-width="1.4" stroke-dasharray="3 3" marker-end="url(#co2-c-oil)"/>';
    s += '<text x="342" y="274" font-size="8.5" fill="#3a352d">孔眼越密 → 产能高，但出砂与套管损伤风险也高</text>';
    var LEG = [['#8d979d', '套管'], ['#c9c3b4', '水泥环'], ['#b26a39', '射孔孔眼'], ['#a03d4f', '油流']];
    LEG.forEach(function (l, i) {
      var lx = 344 + i * 78;
      s += '<rect x="' + lx + '" y="296" width="6" height="6" rx="1" fill="' + l[0] + '"/>';
      s += '<text x="' + (lx + 10) + '" y="302" font-size="8.5" fill="#4a545d">' + l[1] + '</text>';
    });
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
      '" fill="' + (o.f || '#fff') + '"' + (o.st ? ' stroke="' + o.st + '"' : '') +
      (o.sw ? ' stroke-width="' + o.sw + '"' : '') + '/>';
  }
  function ln(x1, y1, x2, y2, st, w, d) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + (st || '#d2ccbf') + '" stroke-width="' + (w || 1) + '"' + (d ? ' stroke-dasharray="' + d + '"' : '') + '/>';
  }
  function fmt(v, d) { return Number(v).toFixed(d == null ? 1 : d); }

  function render(i, el) {
    var st = DEFAULTS;
    var opt = optimize(st);
    var cur = calc(st.n, st.phase, st.d, st.len, st.pressure);

    /* ---------- 0 数据采集与清洗 ---------- */
    if (i === 0) {
      var s = rc(0, 0, 640, 330, { f: '#fff' });
      s += tx(16, 22, '数据质量热力图 · 缺失 / 重复 / 单位异常', { s: 10, b: 1, f: '#3a352d' });
      var cols = ['井深', '孔密', '相位', '孔径', '段长', '压力'];
      var rowsq = ['A 井', 'B 井', 'C 井', 'D 井', 'E 井'];
      var flags = [
        [0, 0, 1, 0, 2, 0],
        [0, 2, 0, 0, 0, 1],
        [1, 0, 0, 2, 0, 0],
        [0, 0, 2, 0, 0, 0],
        [0, 1, 0, 0, 0, 2]
      ];
      var COL = { 0: '#efe9df', 1: '#fbf0d6', 2: '#f4e9e4' };
      var BOR = { 0: '#3a352d', 1: '#a9711a', 2: '#a03d4f' };
      cols.forEach(function (c, j) { s += tx(112 + j * 64 + 26, 48, c, { s: 8.5, a: 'middle', f: '#7e8894' }); });
      rowsq.forEach(function (r, k) {
        s += tx(104, 68 + k * 42, r, { s: 9.5, a: 'end', f: '#56616d' });
        cols.forEach(function (c, j) {
          var f = flags[k][j];
          s += rc(112 + j * 64, 52 + k * 42, 52, 30, { f: COL[f], st: BOR[f], r: 3 });
          s += tx(138 + j * 64, 72 + k * 42, f === 0 ? 'ok' : (f === 1 ? '缺' : (f === 2 ? '重' : '单')), { s: 9, a: 'middle', f: BOR[f] });
        });
      });
      var leg = [['#3a352d', '正常', '#efe9df'], ['#a9711a', '缺失', '#fbf0d6'], ['#a03d4f', '重复', '#f4e9e4']];
      leg.forEach(function (l, k) {
        s += rc(24 + k * 118, 274, 11, 11, { f: l[2], st: l[0], r: 2 });
        s += tx(40 + k * 118, 284, l[1], { s: 9, f: '#56616d' });
      });
      s += tx(16, 318, '清洗后保留：' + (rowsq.length * cols.length - 4) + ' / ' + (rowsq.length * cols.length) + ' 个有效值', { s: 9.5, f: '#3a352d' });
      el.innerHTML = svg(s, 330);
      return '<b>怎么看：</b>每一格是一种参数在某一口井上的状态。绿色可用，黄色缺失要补，蓝色重复要去重，红色单位异常要换算。' +
        '不清洗直接建模，孔径与穿深混用不同厂家的标称值，产能会被系统性高估。';
    }

    /* ---------- 1 特征构造 ---------- */
    if (i === 1) {
      var dn = 1 - Math.exp(-st.n / 7);
      var pf = PHASE_FACTOR[st.phase] || 0.9;
      var df = 0.55 + 0.45 * Math.pow(st.d / 10, 0.6);
      var lf = 0.45 + 0.55 * (1 - Math.exp(-st.len / 6));
      var s2 = rc(0, 0, 640, 330, { f: '#fff' });
      s2 += tx(88, 30, '原始列', { s: 10, b: 1, f: '#56616d', a: 'middle' });
      s2 += tx(400, 30, '特征列（无因次 0—1）', { s: 10, b: 1, f: '#3a352d', a: 'middle' });
      var pairs = [
        ['孔密 ' + st.n + ' 孔/m', '孔密因子 dn = 1−e^(−n/7)', dn],
        ['相位 ' + st.phase + '°', '相位因子 pf = 6 档查表', pf],
        ['孔径 ' + st.d + ' mm', '孔径因子 df = 0.55 + 0.45(d/10)^0.6', df],
        ['段长 ' + st.len + ' m', '段长因子 lf = 0.45 + 0.55(1−e^(−L/6))', lf]
      ];
      pairs.forEach(function (p, k) {
        var y = 56 + k * 62;
        s2 += rc(16, y, 144, 40, { f: '#fbfaf6', st: '#e4e0d6' });
        s2 += tx(88, y + 25, p[0], { s: 10, a: 'middle' });
        s2 += '<path d="M172 ' + (y + 20) + ' L196 ' + (y + 20) + '" stroke="#b8622f" stroke-width="1.3"/>';
        s2 += '<path d="M190 ' + (y + 15) + ' L198 ' + (y + 20) + ' L190 ' + (y + 25) + ' z" fill="#b8622f"/>';
        s2 += rc(208, y, 248, 40, { f: '#faf3ea', st: 'rgba(58,53,45,.25)' });
        s2 += tx(220, y + 17, p[1], { s: 8.5, f: '#56616d' });
        s2 += tx(220, y + 33, p[2].toFixed(2), { s: 11, b: 1, f: '#3a352d', m: 1 });
        s2 += rc(470, y + 10, 130, 20, { f: '#faf9f5', st: '#e4e0d6', r: 10 });
        s2 += rc(470, y + 10, Math.max(6, p[2] * 130), 20, { f: '#7ba99b', r: 10 });
      });
      s2 += tx(16, 316, '相位不是连续变量：0° 与 180° 的物理分布完全不同，用查表因子而不是线性插值。', { s: 9.5, f: '#7e8894' });
      el.innerHTML = svg(s2, 330);
      return '<b>怎么看：</b>左边是工程上填的原始参数，右边是换算出来的 0—1 特征，条形长度就是特征值。' +
        '孔密越高，dn 越接近 1（但边际递减）；相位是 6 档查表，不能当连续变量硬插值。';
    }

    /* ---------- 2 代理模型与风险模型 ---------- */
    if (i === 2) {
      var pts = [];
      for (var n = N_MIN; n <= N_MAX; n++) pts.push(calc(n, st.phase, st.d, st.len, st.pressure));
      var maxQ = Math.max.apply(null, pts.map(function (p) { return p.q; }));
      var s3 = rc(0, 0, 640, 330, { f: '#fff' });
      s3 += tx(16, 22, '响应面切片：孔密 → 日产 q 与风险指数', { s: 10, b: 1, f: '#3a352d' });
      s3 += ln(56, 48, 56, 250, '#d2ccbf');
      s3 += ln(56, 250, 560, 250, '#d2ccbf');
      s3 += tx(56, 268, N_MIN + ' 孔/m', { s: 8.5, f: '#7e8894', a: 'middle' });
      s3 += tx(560, 268, N_MAX + ' 孔/m', { s: 8.5, f: '#7e8894', a: 'middle' });
      s3 += ln(56, 48 + (1 - RISK_LIMIT / 100) * 202, 560, 48 + (1 - RISK_LIMIT / 100) * 202, '#b23a34', 1, '4 3');
      s3 += tx(564, 48 + (1 - RISK_LIMIT / 100) * 202 + 3, '风险阈值 64', { s: 8.5, f: '#b23a34' });
      var xq = function (nn) { return 56 + (nn - N_MIN) / (N_MAX - N_MIN) * 504; };
      var yq = function (q) { return 250 - q / (maxQ * 1.15) * 202; };
      var yr = function (r) { return 250 - r / 100 * 202; };
      var pathQ = '', pathR = '';
      pts.forEach(function (p, k) {
        var nn = N_MIN + k;
        pathQ += (k ? ' L' : 'M') + xq(nn) + ' ' + yq(p.q);
        pathR += (k ? ' L' : 'M') + xq(nn) + ' ' + yr(p.risk);
      });
      s3 += '<path d="' + pathQ + '" fill="none" stroke="#3a352d" stroke-width="2"/>';
      s3 += '<path d="' + pathR + '" fill="none" stroke="#b26a39" stroke-width="1.6" stroke-dasharray="4 3"/>';
      var cq = calc(st.n, st.phase, st.d, st.len, st.pressure);
      s3 += '<circle cx="' + xq(st.n) + '" cy="' + yq(cq.q) + '" r="4.5" fill="#3a352d" stroke="#fff" stroke-width="1.5"/>';
      s3 += '<circle cx="' + xq(st.n) + '" cy="' + yr(cq.risk) + '" r="4" fill="#b26a39" stroke="#fff" stroke-width="1.5"/>';
      s3 += tx(60, 44, '日产 ' + fmt(maxQ, 1) + ' t/d', { s: 9, f: '#3a352d' });
      s3 += tx(560, 44, '风险 100', { s: 9, f: '#b26a39', a: 'end' });
      s3 += rc(16, 284, 608, 36, { f: '#faf9f5', st: '#e4e0d6' });
      s3 += tx(28, 307, '当前 16 孔/m：日产 ' + fmt(cq.q, 1) + ' t/d · 风险 ' + fmt(cq.risk, 0) +
        '（' + (cq.risk <= RISK_LIMIT ? '可行' : '超限') + '）；虚线越压过阈值线，越不可施工。', { s: 9.5, f: '#333f4b' });
      el.innerHTML = svg(s3, 330);
      return '<b>怎么看：</b>实线是日产，虚线是风险。孔密越大，两条线都往上走——这就是“产能与风险同向增长”。' +
        '虚线穿过红色阈值线的位置，就是不能再用更密孔眼的分界。';
    }

    /* ---------- 3 约束搜索与帕累托 ---------- */
    if (i === 3) {
      var all = [];
      for (var nn = N_MIN; nn <= N_MAX; nn++) {
        for (var LL = L_MIN; LL <= L_MAX; LL++) {
          all.push(calc(nn, st.phase, st.d, LL, st.pressure));
        }
      }
      var mx = Math.max.apply(null, all.map(function (p) { return p.q; }));
      var mr = Math.max.apply(null, all.map(function (p) { return p.risk; }));
      var s4 = rc(0, 0, 640, 330, { f: '#fff' });
      s4 += tx(16, 22, '产能—风险散点（孔密 × 段长），虚线为阈值 64', { s: 10, b: 1, f: '#3a352d' });
      s4 += ln(56, 40, 56, 268, '#d2ccbf');
      s4 += ln(56, 268, 588, 268, '#d2ccbf');
      s4 += tx(56, 284, '风险 0', { s: 8, f: '#7e8894' });
      s4 += tx(588, 284, '风险 ' + fmt(mr, 0), { s: 8, f: '#7e8894', a: 'end' });
      s4 += tx(20, 156, '日产', { s: 8.5, f: '#7e8894', a: 'middle' });
      var yx = function (r) { return 268 - r / (mr * 1.08) * 228; };
      var xx = function (q) { return 56 + q / (mx * 1.05) * 532; };
      all.forEach(function (p) {
        var ok = p.risk <= RISK_LIMIT;
        s4 += '<circle cx="' + xx(p.q).toFixed(1) + '" cy="' + yx(p.risk).toFixed(1) + '" r="2.1" fill="' + (ok ? '#3a352d' : '#c9a3a0') + '" opacity="' + (ok ? '.75' : '.6') + '"/>';
      });
      s4 += ln(56, yx(RISK_LIMIT), 588, yx(RISK_LIMIT), '#b23a34', 1, '4 3');
      s4 += tx(590, yx(RISK_LIMIT) + 3, '64', { s: 8, f: '#b23a34' });
      s4 += '<circle cx="' + xx(opt.q) + '" cy="' + yx(opt.risk) + '" r="5.5" fill="#b8622f" stroke="#fff" stroke-width="2"/>';
      s4 += tx(xx(opt.q) - 8, yx(opt.risk) - 9, '最优 ' + opt.n + ' 孔/m · ' + opt.len + ' m', { s: 8.5, f: '#97571a', a: 'end' });
      s4 += rc(16, 292, 608, 30, { f: '#faf9f5', st: '#e4e0d6' });
      s4 += tx(28, 312, '推荐 ' + opt.n + ' 孔/m · 相位 ' + opt.phase + '° · 孔径 ' + opt.d + ' mm · 段长 ' + opt.len +
        ' m → 日产 ' + fmt(opt.q, 1) + ' t/d，风险 ' + fmt(opt.risk, 0) + '（≤64）', { s: 9.5, f: '#3a352d' });
      el.innerHTML = svg(s4, 330);
      return '<b>怎么看：</b>每个点是一组参数组合，横轴风险、纵轴日产。绿色点在阈值内，红色点超限不能施工。' +
        '橙圈是搜索出的推荐组合：在红线以下，尽量往右上靠。只看最高日产会落在红区，所以必须带约束搜。';
    }

    /* ---------- 4 工程复核与试射 ---------- */
    var s5 = rc(0, 0, 640, 330, { f: '#fff' });
    s5 += tx(16, 22, '射孔段俯视 · 相位 ' + st.phase + '° 共 ' + (PHASE_HOLES[st.phase] || 6) + ' 孔/圈', { s: 10, b: 1, f: '#3a352d' });
    var cx = 170, cy = 160, r0 = 46, r1 = 88;
    s5 += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r0 + '" fill="#faf9f5" stroke="#8d979d" stroke-width="2"/>';
    s5 += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1 + '" fill="none" stroke="#c9c3b4" stroke-width="1.4" stroke-dasharray="2 3"/>';
    var holes = PHASE_HOLES[st.phase] || 6;
    for (var h = 0; h < holes; h++) {
      var ang = (h / holes) * Math.PI * 2 - Math.PI / 2;
      var x1 = cx + Math.cos(ang) * r0, y1 = cy + Math.sin(ang) * r0;
      var x2 = cx + Math.cos(ang) * (r1 + 6), y2 = cy + Math.sin(ang) * (r1 + 6);
      s5 += ln(x1.toFixed(1), y1.toFixed(1), x2.toFixed(1), y2.toFixed(1), '#b26a39', 4);
      s5 += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="2.6" fill="#b26a39"/>';
    }
    s5 += tx(cx, cy + 4, '套管', { s: 9, a: 'middle', f: '#56616d' });
    s5 += tx(cx, cy + r1 + 30, '圆周均布，孔眼朝储层', { s: 8.5, a: 'middle', f: '#7e8894' });
    s5 += tx(312, 44, '强度校核', { s: 10, b: 1, f: '#3a352d' });
    var checks = [
      ['套管剩余强度', (100 - cur.risk).toFixed(0) + ' / 100', cur.risk <= RISK_LIMIT],
      ['出砂风险分', cur.sand.toFixed(0), cur.sand < 62],
      ['套管损伤分', cur.casing.toFixed(0), cur.casing < 60],
      ['推荐参数可行', opt.feasible ? '是' : '否', opt.feasible]
    ];
    checks.forEach(function (c, k) {
      var y = 60 + k * 46;
      s5 += rc(312, y, 312, 38, { f: c[2] ? '#faf3ea' : '#fbeceb', st: c[2] ? '#3a352d' : '#b23a34', r: 5 });
      s5 += tx(326, y + 24, c[0], { s: 10, f: '#333f4b' });
      s5 += tx(610, y + 24, c[1], { s: 11, b: 1, a: 'end', f: c[2] ? '#3a352d' : '#b23a34', m: 1 });
    });
    s5 += tx(16, 300, '现场还要核对：射孔枪库存 / 相位器规格 / 口袋长度 / 邻井试射结果', { s: 9, f: '#7e8894' });
    s5 += tx(16, 318, '纸面最优但枪型做不出来，设计只能作废——这一步就是把模型结果落到器材上。', { s: 9, f: '#3a352d' });
    el.innerHTML = svg(s5, 330);
    return '<b>怎么看：</b>左边是射孔段俯视图：内圈套管、外圈水泥环，橙色短线是孔眼，按相位角均匀分布。' +
      '右边是强度校核表，绿色通过、红色不通过。任何一项红了，都要回到上一步换参数。';
  }

  window.__IQ_WF__ = window.__IQ_WF__ || {};
  window.__IQ_WF__[KEY] = {
    model: { calc: calc, optimize: optimize, DEFAULTS: DEFAULTS, RISK_LIMIT: RISK_LIMIT, N_MIN: N_MIN, N_MAX: N_MAX },
    conceptSvg: conceptSvg,
    CONCEPTS: CONCEPTS
  };
  window.__IQ_WF_RENDER__ = window.__IQ_WF_RENDER__ || {};
  window.__IQ_WF_RENDER__[KEY] = render;
})();
