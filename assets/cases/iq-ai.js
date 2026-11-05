﻿/* =========================================================
   iq-ai.js — 「AI 方法解构」共享模块（2D 平面版）
   ---------------------------------------------------------
   把案例里的 AI 应用拆成 WHAT / WHY / HOW 三段，
   全部用平面 SVG 呈现，不再使用 3D 透视：

   · WHAT：分层结构图（数据 → 表示 → 模型 → 决策）
   · WHY ：二维必要性散点图（横纵轴 + 气泡大小）
   · HOW ：案例专属平面图
            topsis      指标热力矩阵 → 排序条形图
            perforation 参数热力图 + 风险等高线
            sleeve      分层产液剖面 + 30 天累计曲线

   数据契约：case.json 的 ai 字段（可选）。没有 ai 的案例
   不渲染本模块，旧案例包不受影响。
   ========================================================= */
(function (global) {
  'use strict';

  var SPEC = {};
  var ENG = [];

  var SANS = 'Inter, Segoe UI, Microsoft YaHei, sans-serif';
  var MONO = 'Consolas, Courier New, monospace';

  var DK = {
    ink: '#f2e9da',
    ink2: '#c3b8a4',
    ink3: '#8e8473',
    ink4: '#6d6455',
    line: 'rgba(216,196,166,.22)',
    grid: 'rgba(216,196,166,.10)',
    copper: '#c9763f',
    copperD: '#8e4f28',
    gold: '#d8a33e',
    ox: '#a85249',
    purple: '#9a7cc0',
    olive: '#a49a4a',
    stone: '#7a7263'
  };

  var MT = {
    cv: '#c9763f',
    ts: '#d8a33e',
    nlp: '#9a7cc0',
    opt: '#b0524a',
    kg: '#a49a4a'
  };
  var MTN = { cv: 'CV 视觉', ts: 'TS 时序', nlp: 'NLP 文本', opt: 'OPT 优化', kg: 'KG 图谱' };
  var PAL = ['#c9763f', '#d8a33e', '#a85249', '#9a7cc0', '#a49a4a'];
  var LAYER_TONE = ['#8b8070', '#c9763f', '#b0524a', '#d8a33e'];

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function rich(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' +
      parseInt(h.slice(4, 6), 16) + ',' + (a == null ? 1 : a) + ')';
  }

  /* SVG 片段 */
  function rect(x, y, w, h, fill, o) {
    o = o || {};
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0, w).toFixed(1) +
      '" height="' + Math.max(0, h).toFixed(1) + '" rx="' + (o.r || 0) + '" fill="' + fill + '"' +
      (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.sw || 1) + '"' : '') +
      (o.tip ? ' data-tip="' + esc(o.tip) + '" data-sub="' + esc(o.sub || '') + '"' : '') + '></rect>';
  }
  function text(x, y, s, o) {
    o = o || {};
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="' + (o.c || DK.ink2) +
      '" font-size="' + (o.size || 11) + '" font-family="' + (o.mono ? MONO : SANS) +
      '" font-weight="' + (o.weight || 400) + '" text-anchor="' + (o.anchor || 'start') +
      '" dominant-baseline="middle"' +
      (o.ls ? ' letter-spacing="' + o.ls + '"' : '') +
      (o.op != null ? ' opacity="' + o.op + '"' : '') +
      (o.tip ? ' data-tip="' + esc(o.tip) + '" data-sub="' + esc(o.sub || '') + '"' : '') +
      '>' + esc(s) + '</text>';
  }
  function line(x1, y1, x2, y2, c, o) {
    o = o || {};
    return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
      '" y2="' + y2.toFixed(1) + '" stroke="' + c + '" stroke-width="' + (o.sw || 1) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '></line>';
  }
  function circle(cx, cy, r, fill, o) {
    o = o || {};
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) +
      '" fill="' + fill + '"' + (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.sw || 1) + '"' : '') +
      (o.tip ? ' data-tip="' + esc(o.tip) + '" data-sub="' + esc(o.sub || '') + '"' : '') + '></circle>';
  }
  function polyline(pts, c, o) {
    o = o || {};
    return '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') +
      '" fill="none" stroke="' + c + '" stroke-width="' + (o.sw || 2) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + ' opacity="' + (o.op == null ? 1 : o.op) + '"></polyline>';
  }
  function heatFill(v) {
    return 'rgba(201,118,63,' + (0.08 + 0.84 * clamp(v, 0, 1)).toFixed(2) + ')';
  }
  function heatText(v) { return v > 0.62 ? '#fff3e2' : '#d8cbb4'; }
  function riskFill(r, a) {
    if (r < 55) return 'rgba(143,138,74,' + a + ')';
    if (r < 64) return 'rgba(192,138,46,' + a + ')';
    return 'rgba(168,82,73,' + a + ')';
  }

  /* ---------------- 与示范同源的模型 ---------------- */
  var TM = [
    { id: 'open', name: '裸眼完井', short: '裸眼', cost: 280, sand: 8, easy: 82, relBonus: 6 },
    { id: 'perf', name: '射孔完井', short: '射孔', cost: 520, sand: 38, easy: 70, relBonus: 8 },
    { id: 'screen', name: '筛管完井', short: '筛管', cost: 760, sand: 82, easy: 58, relBonus: 10 },
    { id: 'gravel', name: '砾石充填', short: '砾石', cost: 1080, sand: 96, easy: 38, relBonus: 12 },
    { id: 'frac', name: '压裂充填', short: '压裂', cost: 1460, sand: 88, easy: 30, relBonus: 10 }
  ];
  var TC = ['产能', '防砂', '经济', '可靠', '施工'];
  var TW = [0.28, 0.22, 0.20, 0.20, 0.10];

  function buildTopsis() {
    var perm = 80, pressure = 32, sandRisk = 0.55, budget = 900;
    var pl = clamp(Math.log(perm / 5) / Math.log(100), 0, 1);
    var req = sandRisk * 100;
    var pf = (pressure - 10) / 50;
    var raw = TM.map(function (m) {
      var prod;
      if (m.id === 'frac') prod = 56 + 24 * (1 - pl);
      else prod = { open: 50, perf: 42, screen: 48, gravel: 34 }[m.id] + 45 * pl;
      prod += (pf - 0.5) * 12;
      prod = clamp(prod, 5, 100);
      var eco = clamp(100 * (1.25 - 0.75 * (m.cost / budget)), 0, 100);
      var rel = clamp(30 + 0.55 * m.sand - 0.35 * req + (pressure - 30) * 0.4 + m.relBonus, 0, 100);
      return [prod, m.sand, eco, rel, m.easy];
    });
    var norm = [], j, i, s;
    for (j = 0; j < 5; j++) {
      s = 0;
      for (i = 0; i < raw.length; i++) s += raw[i][j] * raw[i][j];
      norm[j] = Math.sqrt(s) || 1;
    }
    var wv = raw.map(function (r) {
      return r.map(function (x, k) { return (x / norm[k]) * TW[k]; });
    });
    var best = [], worst = [];
    for (j = 0; j < 5; j++) {
      var col = wv.map(function (r) { return r[j]; });
      best[j] = Math.max.apply(null, col);
      worst[j] = Math.min.apply(null, col);
    }
    var scores = wv.map(function (r) {
      var dp = 0, dn = 0;
      for (var k = 0; k < 5; k++) {
        dp += Math.pow(r[k] - best[k], 2);
        dn += Math.pow(r[k] - worst[k], 2);
      }
      var d1 = Math.sqrt(dp), d2 = Math.sqrt(dn);
      return (d1 + d2) ? (d2 / (d1 + d2)) * 100 : 0;
    });
    var wMax = 0;
    wv.forEach(function (r) { r.forEach(function (x) { if (x > wMax) wMax = x; }); });
    var order = scores.map(function (v, k) { return { v: v, k: k }; })
      .sort(function (a, b) { return b.v - a.v; });
    return { raw: raw, wv: wv, wMax: wMax || 1, scores: scores, order: order };
  }

  function perfCalc(n, phase, d, L, p) {
    var dn = 1 - Math.exp(-n / 7);
    var pfs = { 0: 0.72, 45: 0.9, 60: 1, 90: 0.95, 120: 0.89, 180: 0.8 }[phase] || 0.9;
    var pen = d <= 10 ? 1 : (d <= 11 ? 0.96 : 0.96 - 0.055 * (d - 11));
    var df = (0.55 + 0.45 * Math.pow(d / 10, 0.6)) * pen;
    var lf = 0.45 + 0.55 * (1 - Math.exp(-L / 6));
    var press = 0.75 + 0.35 * (p - 15) / 35;
    var pi = 3.0 * dn * pfs * df * lf * press;
    var drawdown = Math.max(5, (p - 8) * 0.9);
    var q = pi * drawdown;
    var sand = 4 + 1.15 * n + 2.0 * d + 1.1 * (p - 20) + 0.55 * L;
    var casing = 5 + 1.55 * n + 0.6 * d + ({ 0: 20, 45: 12, 60: 8, 90: 0, 120: 2, 180: 6 }[phase] || 8);
    return { q: q, risk: clamp(0.62 * sand + 0.38 * casing, 0, 100) };
  }

  function buildPerf() {
    var NS = 21, LS = 19, phase = 60, p = 32;
    var q10 = [], q14 = [], rk = [], rk14 = [], qMax = 0;
    for (var i = 0; i < NS; i++) {
      q10[i] = []; q14[i] = []; rk[i] = []; rk14[i] = [];
      for (var j = 0; j < LS; j++) {
        var a = perfCalc(4 + i, phase, 10, 2 + j, p);
        var b = perfCalc(4 + i, phase, 14, 2 + j, p);
        q10[i][j] = a.q; rk[i][j] = a.risk;
        q14[i][j] = b.q; rk14[i][j] = b.risk;
        if (a.q > qMax) qMax = a.q;
      }
    }
    return { NS: NS, LS: LS, q10: q10, q14: q14, risk: rk, risk14: rk14, qMax: qMax || 1 };
  }

  /* 风险等值线：对网格做简化 marching squares */
  function contour(values, cols, rows, level, pt) {
    var segs = [];
    function cross(p1, p2, i1, j1, i2, j2, pts) {
      if ((p1 < level) !== (p2 < level)) {
        var t = (level - p1) / (p2 - p1);
        pts.push(pt(lerp(i1, i2, t), lerp(j1, j2, t)));
      }
    }
    for (var i = 0; i < cols - 1; i++) {
      for (var j = 0; j < rows - 1; j++) {
        var a = values[i][j], b = values[i + 1][j];
        var c = values[i + 1][j + 1], d = values[i][j + 1];
        var pts = [];
        cross(a, b, i, j, i + 1, j, pts);
        cross(b, c, i + 1, j, i + 1, j + 1, pts);
        cross(c, d, i + 1, j + 1, i, j + 1, pts);
        cross(d, a, i, j + 1, i, j, pts);
        if (pts.length >= 2) {
          segs.push([pts[0], pts[1]]);
          if (pts.length === 4) segs.push([pts[2], pts[3]]);
        }
      }
    }
    return segs;
  }

  /* =========================================================
     2D 视图
     ========================================================= */
  function View(el, spec, id) {
    this.el = el;
    this.id = id;
    this.spec = spec || {};
    this.stageEl = el.querySelector('.ai-dec-stage') || el;
    this.host = this.stageEl.querySelector('[data-ai-svg]');
    this.mode = 'what';
    this.stage = 0;
    this.clock = 0;
    this.alt = 0;
    this.altTarget = 0;
    this.w = 0;
    this.h = 0;
    this.on = false;
    this.timer = 0;
    this.heat = null;
    this.geo = null;

    var kind = this.spec.how && this.spec.how.kind;
    if (kind === 'topsis') this.model = buildTopsis();
    if (kind === 'perforation') this.pmodel = buildPerf();
  }

  View.prototype.init = function () {
    var self = this;
    this.resize();
    this.bindTabs();
    this.bindTips();

    if (global.ResizeObserver) {
      this.ro = new global.ResizeObserver(function () { self.resize(); });
      this.ro.observe(this.host);
    }
    if (global.IntersectionObserver) {
      this.io = new global.IntersectionObserver(function (es) {
        self.on = !!es[0].isIntersecting;
      }, { threshold: 0.18 });
      this.io.observe(this.host);
    }
    this.setMode('what');
    this.timer = global.setInterval(function () { self.tick(); }, 200);
  };

  View.prototype.resize = function () {
    /* 场景条占据视口底部，图表尺寸以它上方的 SVG 容器为准 */
    var r = this.host.getBoundingClientRect();
    var w = Math.round(r.width), h = Math.round(r.height);
    if (w < 40 || h < 40) return;
    this.w = w;
    this.h = h;
    this.paint();
  };

  View.prototype.destroy = function () {
    if (this.timer) global.clearInterval(this.timer);
    this.timer = 0;
    if (this.ro) this.ro.disconnect();
    if (this.io) this.io.disconnect();
    this.ro = this.io = null;
    if (this._onMove && this.host) {
      this.host.removeEventListener('pointermove', this._onMove);
      this.host.removeEventListener('pointerleave', this._onLeave);
    }
  };

  View.prototype.tick = function () {
    if (!this.on || this.mode !== 'how') return;
    var kind = this.spec.how && this.spec.how.kind;
    if (kind === 'topsis') {
      this.clock += 0.2;
      var s = Math.floor(this.clock / 5) % 3;
      if (s !== this.stage) {
        this.stage = s;
        this.paint();
        this.hudTopsis();
        this.syncDots();
      }
    } else if (kind === 'sleeve') {
      this.clock += 0.2;
      this.updateSleeve();
    }
  };

  View.prototype.ariaLabel = function () {
    var m = this.spec[this.mode] || {};
    return (m.title || '') + ' · 平面可视化';
  };

  View.prototype.paint = function () {
    if (!this.w || !this.h) return;
    var inner = '', kind = this.spec.how && this.spec.how.kind;
    if (this.mode === 'what') inner = this.svgWhat();
    else if (this.mode === 'why') inner = this.svgWhy();
    else if (kind === 'topsis') inner = this.svgTopsis();
    else if (kind === 'perforation') inner = this.svgPerf();
    else if (kind === 'sleeve') inner = this.svgSleeve();

    this.host.innerHTML = '<svg viewBox="0 0 ' + this.w + ' ' + this.h + '" width="100%" height="100%"' +
      ' role="img" aria-label="' + esc(this.ariaLabel()) + '" xmlns="http://www.w3.org/2000/svg">' +
      inner + '</svg>';

    if (kind === 'sleeve' && this.mode === 'how') this.updateSleeve(true);
  };

  /* ---------------- WHAT：分层结构图 ---------------- */
  View.prototype.svgWhat = function () {
    var layers = (this.spec.what && this.spec.what.layers) || [];
    if (!layers.length) return '';
    var w = this.w, h = this.h, n = layers.length, out = [];
    var top = 62, bot = h - 14, gap = 7;
    var rowH = (bot - top - gap * (n - 1)) / n;
    var bandX = 108, bandW = w - bandX - 16;

    out.push(text(w - 16, top - 8, '自下而上：数据 → 决策', {
      anchor: 'end', size: 8.5, c: DK.ink4, mono: true, ls: '.06em'
    }));

    for (var r = 0; r < n; r++) {
      var idx = n - 1 - r;
      var L = layers[idx];
      var y = top + r * (rowH + gap);
      var tone = LAYER_TONE[idx % LAYER_TONE.length];

      out.push(text(14, y + 16, pad2(idx + 1), { size: 9.5, c: DK.ink4, mono: true }));
      out.push(text(14, y + 34, L.t || '', { size: 11.5, c: DK.ink, weight: 600 }));
      out.push(text(14, y + 50, L.en || '', { size: 8, c: DK.ink4, mono: true, ls: '.1em' }));

      out.push(rect(bandX, y, bandW, rowH, 'rgba(255,255,255,.035)',
        { r: 8, stroke: 'rgba(216,196,166,.16)' }));
      out.push(rect(bandX, y, 3.5, rowH, tone, { r: 2 }));

      var items = L.items || [];
      var pad = 10, cgap = 7;
      var cw = (bandW - pad * 2 - (items.length - 1) * cgap) / Math.max(items.length, 1);
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var col = MT[it.m] || tone;
        var cx = bandX + pad + k * (cw + cgap);
        var cy = y + rowH / 2 - 16;
        out.push('<g data-tip="' + esc(it.n || '') + '" data-sub="' +
          esc((L.t || '') + ' · ' + (it.d || '')) + '">');
        out.push(rect(cx, cy, cw, 32, 'rgba(255,255,255,.045)', { r: 6, stroke: rgba(col, .42) }));
        out.push(rect(cx, cy, 2.5, 32, col, { r: 1 }));
        out.push(text(cx + cw / 2 + 1, cy + 16, it.n || '',
          { size: 9.2, anchor: 'middle', weight: 600, c: DK.ink }));
        out.push('</g>');
      }
    }

    /* 左侧向上引导线 */
    out.push(line(100, bot - 6, 100, top + 2, rgba(DK.copper, .22), { dash: '3 4' }));
    out.push('<polygon points="96,' + (top + 7) + ' 104,' + (top + 7) + ' 100,' + (top - 1) +
      '" fill="' + rgba(DK.copper, .5) + '"></polygon>');

    return '<g class="ai-scene">' + out.join('') + '</g>';
  };

  /* ---------------- WHY：二维必要性散点 ---------------- */
  View.prototype.svgWhy = function () {
    var W = this.spec.why || {};
    var tasks = W.tasks || [];
    var base = W.baseline || { x: .15, y: .15, z: .15 };
    var w = this.w, h = this.h, out = [];
    var x0 = 62, x1 = w - 26, y0 = 92, y1 = h - 74;
    function X(v) { return x0 + clamp(v, 0, 1) * (x1 - x0); }
    function Y(v) { return y1 - clamp(v, 0, 1) * (y1 - y0); }

    /* 网格与坐标轴 */
    for (var g = 0; g <= 4; g++) {
      out.push(line(X(g / 4), y0, X(g / 4), y1, DK.grid));
      out.push(line(x0, Y(g / 4), x1, Y(g / 4), DK.grid));
    }
    out.push(line(x0, y1, x1, y1, DK.line, { sw: 1.2 }));
    out.push(line(x0, y0, x0, y1, DK.line, { sw: 1.2 }));

    var ax = W.axes || [];
    out.push(text(x1, y1 + 46, '→ ' + (ax[0] && ax[0].n || '非结构化程度'),
      { anchor: 'end', size: 9.5, c: DK.ink3 }));
    out.push(text(x0 + 2, y0 - 12, '↑ ' + (ax[1] && ax[1].n || '决策维度'),
      { size: 9.5, c: DK.ink3 }));

    /* 经验覆盖区 */
    var bx = X(base.x), by = Y(base.y);
    var rx = 0.20 * (x1 - x0), ry = 0.18 * (y1 - y0);
    out.push('<ellipse cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" rx="' + rx.toFixed(1) +
      '" ry="' + ry.toFixed(1) + '" fill="rgba(255,255,255,.04)" stroke="rgba(216,196,166,.26)"' +
      ' stroke-dasharray="4 4"></ellipse>');
    out.push(text(bx, by + ry - 11, '经验可覆盖区', { anchor: 'middle', size: 8.5, c: DK.ink4 }));
    out.push(circle(bx, by, 3.5, '#9a8f7c', { stroke: 'rgba(242,233,218,.5)', sw: 1 }));
    out.push(text(bx, by + 14, base.t || '人工经验', { anchor: 'middle', size: 9.5, c: DK.ink3, weight: 600 }));

    /* 任务气泡 */
    tasks.forEach(function (t, i) {
      var cx = X(t.x), cy = Y(t.y);
      var rad = 6 + clamp(t.z, 0, 1) * 15;
      var col = MT[t.m] || DK.copper;
      var end = t.x > 0.60;
      var lx = cx + (end ? -rad - 8 : rad + 8);
      var ly = Math.max(y0 + 12, cy - rad - 9 - (i % 2) * 2);
      out.push('<g>');
      out.push(circle(cx, cy, rad, rgba(col, .82), {
        stroke: rgba(col, .95), sw: 1.2,
        tip: t.t || '', sub: t.d || ''
      }));
      out.push(text(lx, ly, t.t || '', {
        anchor: end ? 'end' : 'start', size: 11, c: DK.ink, weight: 600
      }));
      out.push(text(lx, ly + 13, MTN[t.m] || '', {
        anchor: end ? 'end' : 'start', size: 8, c: col, mono: true
      }));
      out.push('</g>');
    });

    /* 气泡大小图例 */
    var ly = y1 + 24;
    var sizeName = (ax[2] && ax[2].n) || '试错成本';
    out.push(text(x0, ly, '气泡大小 = ' + sizeName, { size: 9, c: DK.ink4 }));
    [0.2, 0.55, 0.9].forEach(function (v, k) {
      out.push(circle(x0 + 118 + k * 30, ly, 4 + v * 7, 'rgba(201,118,63,.7)'));
    });
    out.push(text(x0 + 118, ly + 14, '低', { size: 8, c: DK.ink4, anchor: 'middle', mono: true }));
    out.push(text(x0 + 178, ly + 14, '高', { size: 8, c: DK.ink4, anchor: 'middle', mono: true }));

    return '<g class="ai-scene">' + out.join('') + '</g>';
  };

  /* ---------------- HOW 1：TOPSIS 热力矩阵 / 排序条 ---------------- */
  View.prototype.svgTopsis = function () {
    var M = this.model;
    if (!M) return '';
    var st = this.stage, w = this.w, h = this.h, out = [];

    if (st < 2) {
      var x0 = 128, x1 = w - 30, y0 = 128, y1 = h - 52;
      var cw = (x1 - x0) / 5, ch = (y1 - y0) / 5;
      var cap = st === 0 ? '01 原始指标 · 量纲不可比' : '02 归一化 + 加权 · 压到 0—1';
      out.push(text(x0, y0 - 38, cap, { size: 9.5, c: st === 1 ? DK.gold : DK.ink2, mono: true }));

      TC.forEach(function (nm, j) {
        out.push(text(x0 + j * cw + cw / 2, y0 - 12, nm,
          { anchor: 'middle', size: 9.5, c: PAL[j], weight: 600 }));
      });

      for (var i = 0; i < 5; i++) {
        out.push(text(x0 - 10, y0 + i * ch + ch / 2, TM[i].short,
          { anchor: 'end', size: 10, c: DK.ink2 }));
        for (var j = 0; j < 5; j++) {
          var v = st === 0 ? M.raw[i][j] : M.wv[i][j];
          var nv = st === 0 ? v / 100 : v / M.wMax;
          out.push(rect(x0 + j * cw + 1.5, y0 + i * ch + 1.5, cw - 3, ch - 3, heatFill(nv),
            { r: 3, stroke: 'rgba(12,10,8,.25)' }));
          out.push(text(x0 + j * cw + cw / 2, y0 + i * ch + ch / 2,
            st === 0 ? String(Math.round(v)) : v.toFixed(2),
            { anchor: 'middle', size: st === 0 ? 10.5 : 9.5, c: heatText(nv), mono: true, weight: 600 }));
        }
      }
      out.push(text(x0, y1 + 22, '颜色越亮 = 指标值越高', { size: 9, c: DK.ink4 }));
      out.push(text(w - 30, y1 + 22, '5 方案 × 5 指标', { anchor: 'end', size: 9, c: DK.ink4, mono: true }));
    } else {
      var bx0 = 152, bx1 = w - 86, by0 = 112, by1 = h - 62, rowH = (by1 - by0) / 5;
      out.push(text(bx0, by0 - 34, '03 贴近度排序 · 离理想解越近得分越高',
        { size: 9.5, c: DK.gold, mono: true }));
      M.order.forEach(function (o, q) {
        var idx = o.k, sc = o.v;
        var y = by0 + q * rowH + rowH * 0.24, bh = rowH * 0.5;
        var bw = (sc / 100) * (bx1 - bx0);
        var col = q === 0 ? DK.copper : '#7a7263';
        out.push(rect(bx0, y, bw, bh, rgba(col, .82), { r: 3 }));
        out.push(text(24, y + bh / 2, '#' + (q + 1),
          { size: 10, mono: true, c: q === 0 ? DK.copper : DK.ink4 }));
        out.push(text(bx0 - 10, y + bh / 2, TM[idx].short,
          { anchor: 'end', size: 11, weight: q === 0 ? 600 : 400, c: q === 0 ? DK.ink : DK.ink2 }));
        out.push(text(bx0 + bw + 8, y + bh / 2, sc.toFixed(1),
          { size: 10.5, mono: true, c: DK.ink }));
      });
      [0, 50, 100].forEach(function (v) {
        var x = bx0 + v / 100 * (bx1 - bx0);
        out.push(line(x, by1 + 4, x, by1 + 10, DK.line));
        out.push(text(x, by1 + 22, String(v), { anchor: 'middle', size: 9, c: DK.ink4, mono: true }));
      });
    }
    return '<g class="ai-scene">' + out.join('') + '</g>';
  };

  /* ---------------- HOW 2：射孔参数热力图 ---------------- */
  View.prototype.svgPerf = function () {
    var P = this.pmodel;
    if (!P) return '';
    var alt = this.alt, w = this.w, h = this.h, out = [];
    var x0 = 92, x1 = w - 28, y0 = 106, y1 = h - 96;
    var cols = P.NS, rows = P.LS, cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    var q = [], risk = [], qMin = P.qMax;

    for (var i = 0; i < cols; i++) {
      q[i] = []; risk[i] = [];
      for (var j = 0; j < rows; j++) {
        q[i][j] = lerp(P.q10[i][j], P.q14[i][j], alt);
        risk[i][j] = lerp(P.risk[i][j], P.risk14[i][j], alt);
        if (q[i][j] < qMin) qMin = q[i][j];
      }
    }
    var qSpan = Math.max(0.1, P.qMax - qMin);

    for (i = 0; i < cols; i++) {
      for (j = 0; j < rows; j++) {
        out.push(rect(x0 + i * cw, y1 - (j + 1) * ch, cw + 0.5, ch + 0.5,
          heatFill((q[i][j] - qMin) / qSpan)));
      }
    }

    /* 网格线 */
    [4, 8, 12, 16, 20, 24].forEach(function (n) {
      var xx = x0 + (n - 4 + 0.5) * cw;
      out.push(line(xx, y0, xx, y1, 'rgba(18,14,10,.28)'));
    });
    [2, 6, 10, 14, 18, 20].forEach(function (l) {
      var yy = y1 - (l - 2 + 0.5) * ch;
      out.push(line(x0, yy, x1, yy, 'rgba(18,14,10,.28)'));
    });

    /* 风险阈值等值线 */
    var segs = contour(risk, cols, rows, 64, function (ii, jj) {
      return [x0 + (ii + 0.5) * cw, y1 - (jj + 0.5) * ch];
    });
    segs.forEach(function (s) {
      out.push(line(s[0][0], s[0][1], s[1][0], s[1][1], 'rgba(232,120,86,.95)', { sw: 2 }));
    });

    /* 热区悬停层 */
    out.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) +
      '" fill="rgba(16,12,8,.01)" pointer-events="all" data-heat="1"></rect>');

    /* 标记点 */
    var dNow = 10 + 4 * alt;
    var qAi = perfCalc(21, 60, dNow, 19, 32).q;
    var qExp = perfCalc(16, 60, dNow, 8, 32).q;
    function pin(ii, jj, col, label, anchor, below) {
      var px = x0 + (ii + 0.5) * cw, py = y1 - (jj + 0.5) * ch;
      var tx = px + (anchor === 'end' ? -10 : 10);
      var lw = label.length * 5.6 + 12;
      var ly = below ? py + 18 : py - 13;
      out.push(rect(anchor === 'end' ? tx - lw : tx, ly - 8, lw, 16, 'rgba(18,14,10,.86)',
        { r: 3, stroke: 'rgba(242,233,218,.16)' }));
      out.push(circle(px, py, 5.5, '#fff', { stroke: col, sw: 2.4 }));
      out.push(text(tx, ly, label, { anchor: anchor, size: 9.5, c: col, weight: 600 }));
    }
    pin(17, 17, DK.copper, (alt > .5 ? '14 mm ' : '10 mm ') + 'AI ' + qAi.toFixed(1), 'end', true);
    pin(12, 6, '#c3b8a4', (alt > .5 ? '14 mm ' : '10 mm ') + '经验 ' + qExp.toFixed(1), 'start', false);

    /* 坐标刻度 */
    [4, 8, 12, 16, 20, 24].forEach(function (n) {
      out.push(text(x0 + (n - 4 + 0.5) * cw, y1 + 14, String(n),
        { anchor: 'middle', size: 8.5, c: DK.ink4, mono: true }));
    });
    [2, 6, 10, 14, 18, 20].forEach(function (l) {
      out.push(text(x0 - 8, y1 - (l - 2 + 0.5) * ch, String(l),
        { anchor: 'end', size: 8.5, c: DK.ink4, mono: true }));
    });
    out.push(text(x1, y1 + 30, '孔密 n 孔/m →', { anchor: 'end', size: 9.5, c: DK.ink3 }));
    out.push('<text x="' + (x0 - 34) + '" y="' + ((y0 + y1) / 2) + '" fill="' + DK.ink3 +
      '" font-size="9.5" font-family="' + SANS + '" text-anchor="middle" dominant-baseline="middle"' +
      ' transform="rotate(-90 ' + (x0 - 34) + ' ' + ((y0 + y1) / 2) + ')">段长 L m →</text>');

    /* 图例 */
    var ly = y1 + 58;
    for (var k = 0; k < 12; k++) {
      out.push(rect(x0 + k * 9, ly - 4, 9, 8, heatFill((k + 0.5) / 12)));
    }
    out.push(text(x0 + 116, ly, '日产 q  低 → 高', { size: 9, c: DK.ink4 }));
    out.push(line(x0 + 236, ly, x0 + 258, ly, 'rgba(232,120,86,.95)', { sw: 2 }));
    out.push(text(x0 + 264, ly, '风险 64 阈值', { size: 9, c: DK.ink4 }));

    this.heat = { x0: x0, x1: x1, y0: y0, y1: y1, cw: cw, ch: ch, cols: cols, rows: rows, q: q, risk: risk };

    this.hud([
      { v: '55.3', l: '推荐日产 t/d' },
      { v: '64', l: '风险阈值' },
      { v: qAi.toFixed(1), l: alt > 0.5 ? '14 mm 时日产' : '10 mm 时日产' }
    ]);

    this.note(alt > 0.5
      ? '孔径顶到 14 mm：穿深被折减，整片热区变浅，风险红线向内收 —— 孔径与穿深不能同时取最大。'
      : '孔径 10 mm：深穿透弹的真实工况；红色等值线是风险 64 的可行边界。');

    return '<g class="ai-scene">' + out.join('') + '</g>';
  };

  /* ---------------- HOW 3：滑套剖面 + 30 天累计曲线 ---------------- */
  View.prototype.svgSleeve = function () {
    var H = this.spec.how || {};
    var w = this.w, h = this.h, out = [];
    var aiPlan = H.ai || [1, 1, 0.05];
    var manPlan = H.manual || [0.7, 0.7, 0.6];
    var mix = 1 - this.alt;
    var plan = mix > 0.5 ? aiPlan : manPlan;
    var aiOil = H.cumAi ? H.cumAi[0] : 3401;
    var aiWater = H.cumAi ? H.cumAi[1] : 1250;
    var fxOil = H.cumManual ? H.cumManual[0] : 3121;
    var fxWater = H.cumManual ? H.cumManual[1] : 2094;

    var lx0 = 16, lx1 = Math.round(w * 0.53), ly0 = 84, ly1 = h - 14;
    var gap = 9, bandH = (ly1 - ly0 - gap * 2) / 3;
    var wellCX = lx1 - 30;
    var lay = [
      { y: ly0, t: 'A · 主力油层', wc: 16, open: plan[0], col: '#b8622f' },
      { y: ly0 + bandH + gap, t: 'B · 接替层', wc: 32, open: plan[1], col: '#9e8a68' },
      { y: ly0 + 2 * (bandH + gap), t: 'C · 含水层', wc: 72, open: plan[2], col: '#964a54' }
    ];

    /* 井筒 */
    out.push(rect(wellCX, ly0 - 8, 12, ly1 - ly0 + 14, 'rgba(236,226,206,.42)',
      { stroke: 'rgba(240,230,210,.35)' }));
    out.push(text(wellCX + 6, ly0 - 18, '井筒', { anchor: 'middle', size: 8, c: DK.ink4, mono: true }));

    lay.forEach(function (L) {
      out.push(rect(lx0, L.y, lx1 - lx0, bandH, rgba(L.col, .13),
        { r: 8, stroke: rgba(L.col, .42) }));
      out.push(text(lx0 + 12, L.y + 18, L.t, { size: 11, c: DK.ink, weight: 600 }));
      out.push(text(lx0 + 12, L.y + 34, '含水 ' + L.wc + '%', { size: 8.5, c: DK.ink4, mono: true }));
      out.push(text(lx0 + 12, L.y + bandH - 13, '策略开度 ' + Math.round(L.open * 100) + '%',
        { size: 9, c: DK.copper, mono: true, weight: 600 }));

      /* 滑套 */
      var vh = 8 + Math.round(L.open * 28);
      out.push(rect(wellCX - 2, L.y + bandH / 2 - vh / 2, 16, vh, '#c9763f',
        { r: 2, stroke: 'rgba(20,12,8,.4)' }));

      /* 产液箭头 */
      for (var k = 0; k < 2; k++) {
        var yy = L.y + bandH * (0.36 + k * 0.24);
        var sx = lx0 + 74, ex = wellCX - 9;
        var water = L.wc >= 60 && k === 1;
        var col = water ? '#a85249' : '#c9763f';
        out.push(line(sx, yy, ex - 5, yy, rgba(col, .55), { sw: 1.4, dash: '3 3' }));
        out.push('<polygon points="' + (ex - 7) + ',' + (yy - 3) + ' ' + ex + ',' + yy + ' ' +
          (ex - 7) + ',' + (yy + 3) + '" fill="' + rgba(col, .8) + '"></polygon>');
      }
    });

    /* 水锥 */
    var cLayer = lay[2];
    out.push('<polygon id="ai-cone" points="' +
      [wellCX - 18, cLayer.y + 8,
        wellCX - 44, cLayer.y + bandH - 4,
        wellCX + 34, cLayer.y + bandH - 4,
        wellCX + 14, cLayer.y + 8].join(' ') +
      '" fill="rgba(150,74,84,.14)" stroke="rgba(150,74,84,.3)"></polygon>');

    /* 右侧两张累计曲线 */
    var rx0 = Math.round(w * 0.59), rx1 = w - 18;
    var ch1 = { x0: rx0, x1: rx1, y0: 138, y1: Math.round(h * 0.58) };
    var ch2 = { x0: rx0, x1: rx1, y0: Math.round(h * 0.70), y1: h - 26 };
    var activeAI = mix > 0.5;

    function chart(cfg, title, aiT, fxT, key) {
      var max = Math.max(aiT, fxT) * 1.10;
      var o = [];
      o.push(text(cfg.x0, cfg.y0 - 9, title, { size: 8.5, c: DK.ink4, mono: true }));
      for (var g = 0; g <= 3; g++) {
        var yy = cfg.y1 - g * (cfg.y1 - cfg.y0) / 3;
        o.push(line(cfg.x0, yy, cfg.x1, yy, g === 0 ? DK.line : DK.grid));
      }
      o.push(text(cfg.x0, cfg.y1 + 11, '0', { size: 7.5, c: DK.ink4, mono: true }));
      o.push(text(cfg.x1, cfg.y1 + 11, '30 天', { anchor: 'end', size: 7.5, c: DK.ink4, mono: true }));

      function pts(total) {
        var arr = [];
        for (var d = 0; d <= 30; d += 5) {
          arr.push([cfg.x0 + d / 30 * (cfg.x1 - cfg.x0),
            cfg.y1 - (total * d / 30) / max * (cfg.y1 - cfg.y0)]);
        }
        return arr;
      }
      o.push(polyline(pts(aiT), '#c9763f', { sw: activeAI ? 2.4 : 1.3, op: activeAI ? 1 : .6 }));
      o.push(polyline(pts(fxT), '#8f8573', { sw: activeAI ? 1.3 : 2.2, dash: activeAI ? '4 3' : '', op: activeAI ? .6 : 1 }));
      o.push('<line data-play="' + key + '" x1="' + cfg.x0 + '" y1="' + cfg.y0 + '" x2="' + cfg.x0 +
        '" y2="' + cfg.y1 + '" stroke="rgba(242,233,218,.4)" stroke-dasharray="3 3"></line>');
      o.push('<circle data-dot="ai-' + key + '" cx="' + cfg.x0 + '" cy="' + cfg.y1 +
        '" r="3" fill="#c9763f"></circle>');
      o.push('<circle data-dot="fx-' + key + '" cx="' + cfg.x0 + '" cy="' + cfg.y1 +
        '" r="3" fill="#8f8573"></circle>');
      o.push(text(cfg.x1, cfg.y1 - 14, String(Math.round(aiT)), { anchor: 'end', size: 8.5, c: '#c9763f', mono: true }));
      o.push(text(cfg.x1, cfg.y1 - 2, String(Math.round(fxT)), { anchor: 'end', size: 8.5, c: '#8f8573', mono: true }));
      return { cfg: cfg, max: max, aiT: aiT, fxT: fxT, key: key, out: o };
    }

    var cA = chart(ch1, '累产油 t', aiOil, fxOil, 'oil');
    var cB = chart(ch2, '累产水 t', aiWater, fxWater, 'water');
    out = out.concat(cA.out, cB.out);
    out.push('<text id="ai-days" x="' + rx1 + '" y="' + (ch1.y0 - 9) + '" fill="' + DK.copper +
      '" font-size="9" font-family="' + MONO + '" text-anchor="end" dominant-baseline="middle">第 0 天</text>');

    this.geo = {
      oil: cA, water: cB, wellCX: wellCX,
      coneTop: cLayer.y + 8, coneBot: cLayer.y + bandH - 4, coneW: 44,
      plan: plan
    };

    return '<g class="ai-scene">' + out.join('') + '</g>';
  };

  View.prototype.updateSleeve = function (force) {
    if (!this.geo) return;
    var g = this.geo;
    var day = (this.clock % 12) / 12 * 30;
    var mix = 1 - this.alt;
    var aiOil = g.oil.aiT, fxOil = g.oil.fxT;
    var aiWater = g.water.aiT, fxWater = g.water.fxT;

    function setChart(ch) {
      var cfg = ch.cfg;
      var x = cfg.x0 + day / 30 * (cfg.x1 - cfg.x0);
      var play = this.host.querySelector('[data-play="' + ch.key + '"]');
      if (play) {
        play.setAttribute('x1', x);
        play.setAttribute('x2', x);
      }
      var da = this.host.querySelector('[data-dot="ai-' + ch.key + '"]');
      var df = this.host.querySelector('[data-dot="fx-' + ch.key + '"]');
      if (da) {
        da.setAttribute('cx', x);
        da.setAttribute('cy', cfg.y1 - (ch.aiT * day / 30) / ch.max * (cfg.y1 - cfg.y0));
      }
      if (df) {
        df.setAttribute('cx', x);
        df.setAttribute('cy', cfg.y1 - (ch.fxT * day / 30) / ch.max * (cfg.y1 - cfg.y0));
      }
    }
    setChart.call(this, g.oil);
    setChart.call(this, g.water);

    /* 水锥随天数与 C 层开度变化 */
    var cone = this.host.querySelector('#ai-cone');
    if (cone) {
      var frac = day / 30;
      var half = 22 + 18 * frac + 16 * g.plan[2];
      var cx = g.wellCX + 6;
      cone.setAttribute('points', [
        [cx - half * 0.45, g.coneTop],
        [cx - half, g.coneBot],
        [cx + half * 0.9, g.coneBot],
        [cx + half * 0.45, g.coneTop]
      ].map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
    }

    var dl = this.host.querySelector('#ai-days');
    if (dl) dl.textContent = '第 ' + Math.round(day) + ' 天';

    var cumOil = (mix > 0.5 ? aiOil : fxOil) * day / 30;
    var cumWater = (mix > 0.5 ? aiWater : fxWater) * day / 30;
    var dailyOil = 104 + 9.3 * (day / 30) * (mix > 0.5 ? 1 : 0);
    this.hud([
      { v: '第 ' + Math.round(day) + ' 天', l: mix > 0.5 ? 'AI 滚动优化' : '固定开度' },
      { v: String(Math.round(cumOil)), l: '累产油 t' },
      { v: String(Math.round(cumWater)), l: '累产水 t' },
      { v: dailyOil.toFixed(0), l: '日产油 t/d' }
    ]);
    this.note(mix > 0.5
      ? 'AI 每 7 天按最新含水分层重算开度：C 层关到 5%，把液量让给 A/B 两层。'
      : '固定开度 70/70/60：C 层含水 72%，开度越大产水越快，挤占井筒液量上限。');
  };

  /* ---------------- HUD / 提示 ---------------- */
  View.prototype.hud = function (cells) {
    var box = this.el.querySelector('[data-ai-hud]');
    if (!box) return;
    if (!cells || !cells.length) {
      if (this.hudKey !== '') { box.innerHTML = ''; this.hudKey = ''; }
      return;
    }
    var key = cells.map(function (c) { return c.v + c.l; }).join('|');
    if (key === this.hudKey) return;
    this.hudKey = key;
    box.innerHTML = cells.map(function (c) {
      return '<span class="h"><b>' + esc(c.v) + '</b><span>' + esc(c.l) + '</span></span>';
    }).join('');
  };

  View.prototype.hudTopsis = function () {
    var cells = [
      [{ v: '5 × 5', l: '原始指标矩阵' }, { v: '不可比', l: '量纲不同' }, { v: '10 组', l: '权重扰动' }],
      [{ v: '0—1', l: '归一化量纲' }, { v: '加权', l: '五项权重' }, { v: '正/负', l: '理想解' }],
      [{ v: '71.3', l: '筛管完井贴近度' }, { v: '10.4', l: '领先第二名' }, { v: '10 / 10', l: '排序稳定' }]
    ][this.stage];
    this.hud(cells);
  };

  View.prototype.note = function (txt) {
    if (this.noteKey === txt) return;
    this.noteKey = txt;
    var el = this.el.querySelector('[data-ai-note]');
    if (el) el.textContent = txt || '';
  };

  View.prototype.syncDots = function () {
    var lab = this.el.querySelector('[data-ai-phase]');
    if (lab) lab.textContent = ['01 原始指标', '02 归一化 + 加权', '03 贴近度排序'][this.stage];
    var dots = this.el.querySelectorAll('[data-ai-stage]');
    for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('on', d === this.stage);
  };

  View.prototype.bindTips = function () {
    var self = this;
    var tip = this.el.querySelector('[data-ai-tip]');

    function show(html, e) {
      if (!tip) return;
      var r = self.stageEl.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      tip.innerHTML = html;
      tip.style.left = Math.min(r.width - 210, Math.max(8, x + 14)) + 'px';
      tip.style.top = Math.min(r.height - 76, Math.max(8, y + 14)) + 'px';
      tip.classList.add('on');
    }
    function hide() { if (tip) tip.classList.remove('on'); }

    this._onMove = function (e) {
      var target = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (target) {
        var t = target.getAttribute('data-tip');
        var s = target.getAttribute('data-sub');
        show('<b>' + esc(t) + '</b>' + (s ? '<span>' + esc(s) + '</span>' : ''), e);
        return;
      }
      if (e.target.getAttribute && e.target.getAttribute('data-heat') && self.heat) {
        var h = self.heat;
        var r = self.stageEl.getBoundingClientRect();
        var px = e.clientX - r.left, py = e.clientY - r.top;
        var i = Math.floor((px - h.x0) / h.cw);
        var j = Math.floor((h.y1 - py) / h.ch);
        if (i >= 0 && i < h.cols && j >= 0 && j < h.rows) {
          show('<b>孔密 ' + (i + 4) + ' 孔/m · 段长 ' + (j + 2) + ' m</b>' +
            '<span>日产 ' + h.q[i][j].toFixed(1) + ' t/d · 风险 ' + h.risk[i][j].toFixed(1) + '</span>', e);
          return;
        }
      }
      hide();
    };
    this._onLeave = hide;

    this.host.addEventListener('pointermove', this._onMove);
    this.host.addEventListener('pointerleave', this._onLeave);
  };

  /* =========================================================
     DOM：文本 / 图例 / 控件
     ========================================================= */
  var MODES = [
    { k: 'what', en: 'WHAT', cn: '用了什么方法', em: '方法构成' },
    { k: 'why', en: 'WHY', cn: '为什么非它不可', em: '必要性' },
    { k: 'how', en: 'HOW', cn: '它在哪里起作用', em: '计算过程' }
  ];

  function legendOf(view) {
    var kind = view.spec.how && view.spec.how.kind;
    if (view.mode === 'what') {
      return (view.spec.what && view.spec.what.layers || []).map(function (l, i) {
        return { t: l.t, c: LAYER_TONE[i % LAYER_TONE.length] };
      });
    }
    if (view.mode === 'why') {
      var keys = {};
      (view.spec.why && view.spec.why.tasks || []).forEach(function (t) { keys[t.m] = 1; });
      return Object.keys(keys).map(function (k) { return { t: MTN[k] || k, c: MT[k] }; });
    }
    if (kind === 'topsis') return TC.map(function (t, i) { return { t: t, c: PAL[i] }; });
    if (kind === 'perforation') return [
      { t: '日产低 → 高', c: '#8a5a34' }, { t: '风险 64 阈值', c: '#e07856' }
    ];
    if (kind === 'sleeve') return [
      { t: 'AI 滚动累计', c: '#c9763f' }, { t: '固定开度累计', c: '#8f8573' },
      { t: '滑套开度', c: '#d8a33e' }
    ];
    return [];
  }

  function textHTML(view) {
    var m = view.spec[view.mode] || {};
    var meta = MODES.filter(function (x) { return x.k === view.mode; })[0];
    var out = '<span class="ai-kicker"><b>' + meta.en + '</b>' + meta.cn + '</span>';
    out += '<h4>' + esc(m.title || '') + '</h4>';
    if (m.lead) out += '<p class="ai-lead">' + rich(m.lead) + '</p>';
    if (m.read) out += '<div class="ai-read"><b>看图要点</b><span>' + rich(m.read) + '</span></div>';
    if (m.bullets && m.bullets.length) {
      out += '<ul class="ai-list">' + m.bullets.map(function (b) {
        return '<li>' + rich(b) + '</li>';
      }).join('') + '</ul>';
    }
    if (m.stats && m.stats.length) {
      out += '<div class="ai-nums">' + m.stats.map(function (s) {
        return '<div class="ai-num"><b>' + esc(s.v) + '</b><span>' + esc(s.l) + '</span></div>';
      }).join('') + '</div>';
    }
    if (m.foot) out += '<p class="ai-src">' + rich(m.foot) + '</p>';
    return out;
  }

  function stageTitle(view) {
    var m = view.spec[view.mode] || {};
    return m.scene || {
      what: '方法是如何分层协作的',
      why: '任务为什么超出人工经验',
      how: '模型在这一步做了什么'
    }[view.mode];
  }

  View.prototype.bindTabs = function () {
    var self = this;
    this.el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-ai-tab]') : null;
      if (!b) return;
      self.setMode(b.getAttribute('data-ai-tab'));
    });
  };

  View.prototype.setMode = function (k) {
    if (!MODES.some(function (m) { return m.k === k; })) return;
    this.mode = k;
    this.stage = 0;
    this.clock = 0;
    this.alt = 0;
    this.altTarget = 0;
    this.hudKey = '';
    this.noteKey = '';
    this.heat = null;
    var hb = this.el.querySelector('[data-ai-hud]');
    if (hb) hb.innerHTML = '';
    var nb = this.el.querySelector('[data-ai-note]');
    if (nb) nb.textContent = '';
    var self = this;

    var tabs = this.el.querySelectorAll('[data-ai-tab]');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-ai-tab') === k;
      tabs[i].classList.toggle('on', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var tx = this.el.querySelector('[data-ai-text]');
    if (tx) tx.innerHTML = textHTML(this);

    var meta = MODES.filter(function (m) { return m.k === k; })[0];
    var top = this.el.querySelector('[data-ai-top]');
    if (top) {
      top.innerHTML = '<span class="en">' + meta.en + ' · ' + meta.em + '</span>' +
        '<b>' + esc(stageTitle(this)) + '</b><em>2D · 平面图</em>';
    }
    /* 现场场景条：同一张剖面图，按分段切换“看图对应”的一句话 */
    var sc = this.spec.scene;
    var capEl = this.el.querySelector('[data-ai-scene-cap]');
    if (capEl) capEl.textContent = (sc && sc.cap && sc.cap[k]) || '';

    var leg = this.el.querySelector('[data-ai-leg]');
    if (leg) {
      leg.innerHTML = legendOf(this).map(function (l) {
        return '<span class="ai-leg"><i style="background:' + esc(l.c) + '"></i>' + esc(l.t) + '</span>';
      }).join('');
    }

    var ctl = this.el.querySelector('[data-ai-ctl]');
    if (ctl) {
      ctl.innerHTML = '';
      ctl.style.display = (k === 'how') ? '' : 'none';
      if (k === 'how') {
        var kind = this.spec.how && this.spec.how.kind;
        if (kind === 'topsis') {
          var dots = '<span class="ai-dots">';
          for (var d = 0; d < 3; d++) {
            dots += '<button class="ai-dot" data-ai-stage="' + d + '" type="button" aria-label="跳到第 ' +
              (d + 1) + ' 阶段">' + (d + 1) + '</button>';
          }
          dots += '</span><span class="ai-phase" data-ai-phase>01 原始指标</span>';
          ctl.innerHTML = dots;
          [].forEach.call(ctl.querySelectorAll('[data-ai-stage]'), function (b2) {
            b2.addEventListener('click', function () {
              self.stage = Number(b2.getAttribute('data-ai-stage'));
              self.clock = self.stage * 5 + 0.01;
              self.paint();
              self.hudTopsis();
              self.syncDots();
            });
          });
        } else if (kind === 'perforation') {
          ctl.innerHTML = '<button class="ai-cbtn on" data-ai-alt type="button">孔径 10 mm</button>';
          ctl.querySelector('[data-ai-alt]').addEventListener('click', function () {
            self.altTarget = self.altTarget ? 0 : 1;
            self.alt = self.altTarget;
            this.textContent = self.altTarget ? '孔径 14 mm' : '孔径 10 mm';
            this.classList.toggle('on', !self.altTarget);
            self.paint();
          });
        } else if (kind === 'sleeve') {
          ctl.innerHTML = '<button class="ai-cbtn on" data-ai-alt type="button">AI 滚动优化</button>';
          ctl.querySelector('[data-ai-alt]').addEventListener('click', function () {
            self.altTarget = self.altTarget ? 0 : 1;
            self.alt = self.altTarget;
            this.textContent = self.altTarget ? '固定开度' : 'AI 滚动优化';
            this.classList.toggle('on', !self.altTarget);
            self.paint();
          });
        }
      }
    }

    this.paint();
    if (k === 'how') {
      var kind2 = this.spec.how && this.spec.how.kind;
      if (kind2 === 'topsis') this.hudTopsis();
      if (kind2 === 'sleeve') this.updateSleeve(true);
    }
    this.syncDots();
  };

  /* =========================================================
     对外接口
     ========================================================= */
  function block(c) {
    var ai = c && c.ai;
    if (!ai) return '';
    SPEC[c.id] = ai;

    var tabs = MODES.map(function (m, i) {
      return '<button class="ai-tab' + (i === 0 ? ' on' : '') + '" data-ai-tab="' + m.k + '" type="button"' +
        ' role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' +
        '<b>' + m.en + '</b><span>' + m.cn + '</span><em>' + m.em + '</em></button>';
    }).join('');

    return '<section class="ai-dec" data-ai-dec="' + esc(c.id) + '" aria-label="AI 方法解构">' +
      '<div class="ai-dec-hd">' +
        '<span class="kicker clay">AI METHOD DECONSTRUCTION</span>' +
        '<h3>' + esc(ai.title || 'AI 在这个案例里怎么起作用') + '</h3>' +
        '<p class="ai-dec-sub">' + rich(ai.sub || 'WHAT 用了什么方法 · WHY 为什么非它不可 · HOW 它究竟在哪一步起效') + '</p>' +
        '<div class="ai-tabs" role="tablist">' + tabs + '</div>' +
      '</div>' +
      '<div class="ai-dec-main">' +
        '<div class="ai-dec-text" data-ai-text></div>' +
        '<div class="ai-dec-stage">' +
          '<div class="ai-svg" data-ai-svg role="img" aria-label="2D 方法示意图"></div>' +
          '<div class="ai-stage-top" data-ai-top></div>' +
          '<div class="ai-stage-ctl" data-ai-ctl></div>' +
          '<div class="ai-hud" data-ai-hud></div>' +
          '<div class="ai-tip" data-ai-tip></div>' +
          (ai.scene ? '<div class="ai-scene-strip">' +
            '<img src="' + esc(ai.scene.img) + '" alt="' + esc(ai.scene.alt || '油田现场卡通示意') + '" loading="lazy">' +
            '<div class="ai-scene-cap"><b>现场对应</b><span data-ai-scene-cap></span></div>' +
          '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ai-dec-foot">' +
        '<div class="ai-stage-leg" data-ai-leg></div>' +
        '<span class="ai-foot-txt"><b>数据口径</b>' + esc(ai.source ||
          '平面图与案例示范使用同一套模型函数，按示范默认参数实时计算；图中的位置与形状是方法示意，不是新的实测结论。') + '</span>' +
        '<div class="ai-foot-note" data-ai-note></div>' +
      '</div>' +
      '</section>';
  }

  function gc() {
    for (var i = ENG.length - 1; i >= 0; i--) {
      var v = ENG[i];
      if (!v.el || !v.el.isConnected) {
        v.destroy();
        ENG.splice(i, 1);
      }
    }
  }

  function bind(root) {
    root = root || document;
    gc();
    var nodes = root.querySelectorAll ? root.querySelectorAll('[data-ai-dec]') : [];
    [].forEach.call(nodes, function (el) {
      if (el.__iqai) return;
      var id = el.getAttribute('data-ai-dec');
      var spec = SPEC[id];
      if (!spec) return;
      var v = new View(el, spec, id);
      el.__iqai = v;
      ENG.push(v);
      v.init();
    });
  }

  global.IQAI = { block: block, bind: bind, gc: gc, spec: SPEC };
})(window);



