/* =========================================================
   iq-smart.js — 案例示范的「智能方法」区块（图为主）
   ---------------------------------------------------------
   版式：方法名 → 算法解剖图 → 本轮中间量 → 经验/智能对比 → 折叠说明

   设计原则（2026-11 改版）：
   1. 「方法在算什么」必须用图表达，不靠大段说明文字；
   2. 图里的每一个点、每一格都来自本轮 renderAll() 的计算结果；
   3. 输入/输出/原理/适用边界这类必须写清楚的内容收进 <details>，
      默认折叠，答辩需要时可展开，不占首屏。

   依赖：只生成 SVG 字符串，不依赖 D3；由 tools/build-cases.js
   复制到各案例包 demo/iq-smart.js。
   ========================================================= */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var C = {
    ink: '#242b2e', ink2: '#4a535a', ink3: '#79828a', ink4: '#9ba3a9',
    line: '#e9e4d8', line2: '#ddd6c6',
    jade: '#3a352d', clay: '#b26a39', ok: '#35785a', bad: '#a85249', warn: '#b58a34'
  };
  var MONO = 'ui-monospace,SFMono-Regular,Consolas,monospace';

  function txt(x, y, s, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-size="' + (o.s || 9) + '"' +
      ' fill="' + (o.f || C.ink3) + '"' +
      (o.w ? ' font-weight="' + o.w + '"' : '') +
      (o.a ? ' text-anchor="' + o.a + '"' : '') +
      (o.m ? ' font-family="' + MONO + '"' : '') +
      '>' + esc(s) + '</text>';
  }

  /* =========================================================
     图 1 · 决策矩阵热图（co1）
     5 方案 × 5 指标：格子的深浅 = 该指标归一化后的加权值，
     右侧条 = 贴近度。用来回答「TOPSIS 到底在算什么」。
     ========================================================= */
  function matrix(cfg) {
    var rows = cfg.rows || [], crit = cfg.crit || [], w = cfg.weights || [];
    var n = rows.length, m = crit.length;
    if (!n || !m) return '';
    var W = 640, x0 = 86, cw = 54, ch = 30, y0 = 46, H = y0 + n * ch + 26;
    var barX = x0 + m * cw + 26, barW = 150;
    var out = [];

    /* 列最大值：用于把不同量纲压到 0—1 */
    var maxv = [];
    for (var j = 0; j < m; j++) {
      maxv[j] = 1;
      for (var i = 0; i < n; i++) maxv[j] = Math.max(maxv[j], rows[i].vals[j] || 0);
    }

    /* 表头：指标名 + 权重 */
    for (var j2 = 0; j2 < m; j2++) {
      out.push(txt(x0 + j2 * cw + cw / 2, 22, crit[j2], { s: 9, a: 'middle', w: 600, f: C.ink2 }));
      out.push(txt(x0 + j2 * cw + cw / 2, 34,
        'w ' + (w[j2] != null ? (w[j2] * 100).toFixed(0) : '—') + '%',
        { s: 8, a: 'middle', m: true, f: C.ink4 }));
    }
    out.push(txt(barX + barW / 2, 22, 'TOPSIS 贴近度', { s: 9, a: 'middle', w: 600, f: C.ink2 }));
    out.push(txt(barX + barW / 2, 34, '0 — 100', { s: 8, a: 'middle', m: true, f: C.ink4 }));

    rows.forEach(function (r, i) {
      var y = y0 + i * ch;
      out.push(txt(12, y + ch / 2 + 3.5, r.name, { s: 9.5, f: C.ink, w: r.best ? 700 : 400 }));
      for (var j3 = 0; j3 < m; j3++) {
        var v = r.vals[j3] || 0, t = v / maxv[j3];
        var fill = 'rgba(178,106,57,' + (0.06 + 0.46 * t).toFixed(2) + ')';
        out.push('<rect x="' + (x0 + j3 * cw + 1) + '" y="' + (y + 2) + '" width="' + (cw - 3) +
          '" height="' + (ch - 4) + '" rx="3" fill="' + fill + '"/>');
        out.push(txt(x0 + j3 * cw + cw / 2, y + ch / 2 + 3.5, Math.round(v),
          { s: 9, m: true, a: 'middle', f: t > 0.55 ? '#fff' : C.ink2 }));
      }
      /* 贴近度条 */
      var bw = Math.max(2, r.score / 100 * barW);
      out.push('<rect x="' + barX + '" y="' + (y + 7) + '" width="' + barW + '" height="' + (ch - 14) +
        '" rx="2" fill="#f4f1e8"/>');
      out.push('<rect x="' + barX + '" y="' + (y + 7) + '" width="' + bw.toFixed(1) + '" height="' + (ch - 14) +
        '" rx="2" fill="' + (r.best ? C.jade : '#b9b3a2') + '"/>');
      out.push(txt(barX + barW + 6, y + ch / 2 + 3.5, r.score.toFixed(1),
        { s: 9, m: true, f: r.best ? C.ink : C.ink3, w: r.best ? 700 : 400 }));
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="决策矩阵热图与贴近度">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>' +
      out.join('') +
      txt(12, H - 8, '格子深浅 = 该指标在本轮归一化后的相对水平；右侧条 = 综合贴近度', { s: 8.5, f: C.ink4 }) +
      '</svg>';
  }

  /* =========================================================
     图 2 · 搜索散点（co2 / co4 / e1 / pr2）
     每个点 = 一组候选参数的真实计算结果；绿 = 满足约束，
     红 = 越界；圈 = 本轮被选中的解。用来回答
     「推荐值为什么是这一个」。
     ========================================================= */
  function scatter(cfg) {
    var pts = cfg.points || [];
    if (!pts.length) return '';
    var W = 640, H = cfg.height || 236;
    var M = { t: 24, r: 74, b: 34, l: 46 };
    var pw = W - M.l - M.r, ph = H - M.t - M.b;

    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var xmin = cfg.xMin != null ? cfg.xMin : Math.min.apply(null, xs);
    var xmax = cfg.xMax != null ? cfg.xMax : Math.max.apply(null, xs);
    var ymin = cfg.yMin != null ? cfg.yMin : Math.min.apply(null, ys);
    var ymax = cfg.yMax != null ? cfg.yMax : Math.max.apply(null, ys);
    if (xmax === xmin) xmax = xmin + 1;
    if (ymax === ymin) ymax = ymin + 1;
    var pad = (ymax - ymin) * 0.08;
    ymax += pad;

    function X(v) { return M.l + (v - xmin) / (xmax - xmin) * pw; }
    function Y(v) { return M.t + ph - (v - ymin) / (ymax - ymin) * ph; }

    var out = [];
    /* 网格 */
    for (var g = 0; g <= 4; g++) {
      var gy = M.t + ph * g / 4;
      out.push('<line x1="' + M.l + '" y1="' + gy.toFixed(1) + '" x2="' + (M.l + pw) + '" y2="' + gy.toFixed(1) +
        '" stroke="' + C.line + '" stroke-width=".8"/>');
    }
    /* 约束线 */
    if (cfg.yLine != null) {
      var ly = Y(cfg.yLine);
      out.push('<line x1="' + M.l + '" y1="' + ly.toFixed(1) + '" x2="' + (M.l + pw) + '" y2="' + ly.toFixed(1) +
        '" stroke="' + C.bad + '" stroke-width="1.2" stroke-dasharray="5 4"/>');
      out.push(txt(M.l + pw - 4, ly - 5, cfg.yLineLabel || '约束上限',
        { s: 8.5, a: 'end', f: C.bad }));
    }
    /* 点：先画越界，再画可行，保证绿色压在上层 */
    [false, true].forEach(function (wantOk) {
      pts.forEach(function (p) {
        if (!!p.ok !== wantOk) return;
        out.push('<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (p.ok ? 2.3 : 2.1) +
          '" fill="' + (p.ok ? 'rgba(53,120,90,.42)' : 'rgba(168,82,73,.30)') + '"/>');
      });
    });
    /* 选中解 */
    if (cfg.pick) {
      var px = X(cfg.pick.x), py = Y(cfg.pick.y);
      out.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="9" fill="none" stroke="' +
        C.jade + '" stroke-width="1.4"/>');
      out.push('<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.4" fill="' + C.jade + '"/>');
      out.push(txt(px + 13, py + 3.5, cfg.pickLabel || '本轮选中', { s: 9, f: C.ink, w: 700 }));
    }
    /* 轴 */
    out.push('<line x1="' + M.l + '" y1="' + (M.t + ph) + '" x2="' + (M.l + pw) + '" y2="' + (M.t + ph) +
      '" stroke="' + C.line2 + '" stroke-width="1"/>');
    out.push(txt(M.l, H - 12, cfg.xLabel || '', { s: 9, f: C.ink3 }));
    out.push(txt(M.l + pw, H - 12, xmax.toFixed(cfg.xDig == null ? 0 : cfg.xDig), { s: 8.5, a: 'end', m: true, f: C.ink4 }));
    out.push(txt(8, M.t + 4, cfg.yLabel || '', { s: 9, f: C.ink3 }));
    out.push(txt(M.l - 6, M.t + 10, ymax.toFixed(cfg.yDig == null ? 0 : cfg.yDig), { s: 8.5, a: 'end', m: true, f: C.ink4 }));

    /* 图例 */
    out.push('<circle cx="' + (M.l + pw - 128) + '" cy="' + (M.t + 10) + '" r="2.6" fill="rgba(53,120,90,.55)"/>');
    out.push(txt(M.l + pw - 121, M.t + 13, '满足约束', { s: 8.5, f: C.ink3 }));
    out.push('<circle cx="' + (M.l + pw - 66) + '" cy="' + (M.t + 10) + '" r="2.6" fill="rgba(168,82,73,.5)"/>');
    out.push(txt(M.l + pw - 59, M.t + 13, '越界', { s: 8.5, f: C.ink3 }));

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="候选参数搜索散点">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>' + out.join('') + '</svg>';
  }

  /* =========================================================
     图 3 · 扫描可行性带（co3）
     沿某个一维参数（下入速度）逐档试算，用色带显示
     「哪几档能过安全窗口」，并把选中档标出来。
     ========================================================= */
  function band(cfg) {
    var items = cfg.items || [];
    if (!items.length) return '';
    var W = 640, H = cfg.height || (cfg.series && cfg.series.length ? 178 : 132);
    var M = { l: 46, r: 18, t: 30, b: 40 };
    var pw = W - M.l - M.r;
    var bw = pw / items.length;
    var out = [];

    out.push(txt(M.l, 16, cfg.title || '', { s: 9, f: C.ink2, w: 600 }));
    items.forEach(function (it, i) {
      var x = M.l + i * bw;
      out.push('<rect x="' + x.toFixed(1) + '" y="' + M.t + '" width="' + Math.max(bw - 1, 1).toFixed(1) +
        '" height="22" rx="2" fill="' + (it.ok ? 'rgba(53,120,90,.55)' : 'rgba(168,82,73,.38)') + '"/>');
    });
    /* 选中档 */
    if (cfg.pickIdx != null && items[cfg.pickIdx]) {
      var px = M.l + cfg.pickIdx * bw;
      out.push('<rect x="' + (px - 1).toFixed(1) + '" y="' + (M.t - 3) + '" width="' + (bw + 2).toFixed(1) +
        '" height="28" rx="3" fill="none" stroke="' + C.jade + '" stroke-width="1.6"/>');
      out.push(txt(px + bw / 2, M.t - 8, cfg.pickLabel || '选中', { s: 8.5, a: 'middle', f: C.ink, w: 700 }));
    }
    /* 指标折线（可选） */
    if (cfg.series && cfg.series.length) {
      var sMin = Math.min.apply(null, cfg.series), sMax = Math.max.apply(null, cfg.series);
      if (sMax === sMin) sMax = sMin + 1;
      var base = M.t + 96, hh = 54;
      var d = cfg.series.map(function (v, i) {
        var x = M.l + i * bw + bw / 2;
        var y = base - (v - sMin) / (sMax - sMin) * hh;
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      out.push('<path d="' + d + '" fill="none" stroke="' + C.clay + '" stroke-width="1.5"/>');
      if (cfg.threshold != null) {
        var ty = base - (cfg.threshold - sMin) / (sMax - sMin) * hh;
        out.push('<line x1="' + M.l + '" y1="' + ty.toFixed(1) + '" x2="' + (M.l + pw) + '" y2="' + ty.toFixed(1) +
          '" stroke="' + C.bad + '" stroke-width="1" stroke-dasharray="4 3"/>');
        out.push(txt(M.l + pw, ty - 4, cfg.thresholdLabel || '阈值', { s: 8, a: 'end', f: C.bad }));
      }
      out.push(txt(M.l, H - 18, cfg.seriesLabel || '', { s: 8.5, f: C.ink4 }));
    }
    /* 轴 */
    out.push(txt(M.l, H - 6, cfg.xLabel ? cfg.xLabel[0] : '', { s: 8.5, f: C.ink4 }));
    out.push(txt(M.l + pw, H - 6, cfg.xLabel ? cfg.xLabel[1] : '', { s: 8.5, a: 'end', f: C.ink4 }));

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="参数扫描可行性带">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>' + out.join('') + '</svg>';
  }

  /* =========================================================
     区块渲染
     ========================================================= */
  function render(cfg) {
    cfg = cfg || {};

    /* 折叠区：必须讲清楚但不必占首屏的内容 */
    var cells = [
      ['输入数据', cfg.input],
      ['输出结果', cfg.output],
      ['解决的问题', cfg.problem],
      ['为什么适合', cfg.fit]
    ].filter(function (x) { return x[1]; }).map(function (x) {
      return '<div class="iq-s-cell"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>';
    }).join('');

    var flow = (cfg.flow || []).map(function (s) {
      return '<span>' + esc(s) + '</span>';
    }).join('<em>→</em>');

    var why = (cfg.why || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var bounds = (cfg.bounds || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');

    /* 本轮中间量 */
    var trace = '';
    if (cfg.trace && cfg.trace.length) {
      trace = '<div class="iq-smart-trace">' +
        '<span class="lb">本轮中间量</span>' +
        cfg.trace.map(function (t) {
          return '<i>' + esc(t[0]) + '<b>' + esc(t[1]) + '</b></i>';
        }).join('') +
        '</div>';
    }

    /* 算法解剖图：优先用图，没有图时退化为原有的对比表 */
    var algo = '';
    if (cfg.algoSvg) {
      algo = '<div class="iq-algo">' + cfg.algoSvg +
        (cfg.algoCap ? '<div class="iq-algo-cap">' + cfg.algoCap + '</div>' : '') +
        '</div>';
    }

    var cmp = '';
    if (cfg.compare && cfg.compare.rows && cfg.compare.rows.length) {
      var head = (cfg.compare.columns || []).map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
      var body = cfg.compare.rows.map(function (r) {
        return '<tr' + (r.hl ? ' class="hl"' : '') + '>' + r.cells.map(function (c) {
          if (c && typeof c === 'object') {
            return '<td' + (c.cls ? ' class="' + esc(c.cls) + '"' : '') + '>' + esc(c.v) + '</td>';
          }
          return '<td>' + esc(c) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      cmp = '<div class="iq-smart-sec iq-smart-cmp">' +
        '<h5>' + esc(cfg.compare.title || '经验方案 vs 智能方案') + '</h5>' +
        '<table class="iq-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
        (cfg.compare.note ? '<p class="iq-poll">' + esc(cfg.compare.note) + '</p>' : '') +
        '</div>';
    }

    var more = (cells || flow || why || bounds || cmp) ?
      '<details class="iq-smart-more"><summary>输入 / 经验对比 / 原理与适用边界（展开）</summary>' +
      (cells ? '<div class="iq-smart-grid">' + cells + '</div>' : '') +
      (flow ? '<div class="iq-flow iq-smart-flow"><span class="iq-mini" style="border:0;background:none;padding:0">流程</span><em>→</em>' + flow + '</div>' : '') +
      cmp +
      (why ? '<div class="iq-smart-sec"><h5>为什么这个结果是这样</h5><ul>' + why + '</ul></div>' : '') +
      (bounds ? '<div class="iq-smart-bound"><b>适用边界与复核要求</b><ul>' + bounds + '</ul></div>' : '') +
      '</details>' : '';

    return '<div class="iq-smart">' +
      '<div class="iq-smart-h">' +
        '<div><span class="iq-kicker">' + esc(cfg.kicker || 'SMART METHOD') + '</span>' +
          '<div class="t">' + esc(cfg.title || '智能方法') +
          (cfg.subtitle ? '<small>' + esc(cfg.subtitle) + '</small>' : '') + '</div></div>' +
        (cfg.badge ? '<span class="iq-tag jade">' + esc(cfg.badge) + '</span>' : '') +
      '</div>' +
      algo +
      trace +
      more +
      '</div>';
  }

  global.IQSmart = { render: render, esc: esc };
  global.IQAlgo = { matrix: matrix, scatter: scatter, band: band };

  /* =========================================================
     IQFrame — 示范页的「三栏固定」版式与图表放大
     ---------------------------------------------------------
     只在固定高度框架（demo.scroll=true）或单独打开时启用：
       左栏 = 结构示意/当前参数（固定不动）
       中栏 = 主图（自己滚动，到底后把滚动交给整页，
              三栏一起上滑，露出下面的方法与表格）
       右栏 = 输入参数 / 输出（固定不动）
     窄屏（<1024）自动退回单列堆叠。
     ========================================================= */
  var IQFrame = (function () {
    function zoomOpen(svg) {
      var old = document.querySelector('.iq-zoom');
      if (old) old.parentNode.removeChild(old);
      var ov = document.createElement('div');
      ov.className = 'iq-zoom';
      ov.innerHTML = '<div class="iq-zoom-box"><button type="button" class="iq-zoom-x" ' +
        'aria-label="关闭放大视图">✕</button><div class="iq-zoom-body"></div></div>';
      var c = svg.cloneNode(true);
      c.removeAttribute('width');
      c.removeAttribute('height');
      c.setAttribute('style', 'width:100%;height:auto;display:block');
      ov.querySelector('.iq-zoom-body').appendChild(c);
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        if (e.target === ov || (e.target.className || '').indexOf('iq-zoom-x') >= 0) {
          ov.parentNode.removeChild(ov);
        }
      });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') {
          if (ov.parentNode) ov.parentNode.removeChild(ov);
          document.removeEventListener('keydown', esc);
        }
      });
    }

    /* 给每个含图表的卡片挂一个「放大」按钮：不抢图表本身的点击（热力图点选等） */
    function addZoomButtons(root) {
      var cards = root.querySelectorAll('.iq-card');
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (card.querySelector('.iq-zoom-btn')) continue;
        var svg = card.querySelector('svg');
        if (!svg) continue;
        var r = svg.getBoundingClientRect();
        if (r.width < 120) continue;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'iq-zoom-btn';
        b.title = '点击放大查看';
        b.setAttribute('aria-label', '放大查看这张图');
        b.textContent = '⤢';
        (function (c) {
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            var s = c.querySelector('svg');
            if (s) zoomOpen(s);
          });
        })(card);
        card.appendChild(b);
        card.classList.add('has-zoom');
      }
    }

    function boot(root) {
      if (!root) return;
      addZoomButtons(root);
      /* 双击图表也能放大：单击留给图表本身的交互（热力图点选等） */
      root.addEventListener('dblclick', function (e) {
        var s = e.target && e.target.closest ? e.target.closest('svg') : null;
        if (!s || s.closest('.iq-zoom')) return;
        var r = s.getBoundingClientRect();
        if (r.width < 120) return;
        zoomOpen(s);
      });
      /* 图表是 D3 后渲染的，DOM 变化后补挂按钮（节流） */
      if (window.MutationObserver) {
        var t = null;
        var mo = new MutationObserver(function () {
          if (t) return;
          t = setTimeout(function () { t = null; addZoomButtons(root); }, 180);
        });
        mo.observe(root, { childList: true, subtree: true });
      }

      /* 生效条件：
         · 站点里模块模式（parent === self）—— 是；
         · 单独打开示范页 —— 是；
         · 固定高度 iframe（demo.scroll=true）—— 是；
         · 未知高度的自动拉伸 iframe —— 否（100dvh 没有意义）。 */
      var inFrame = window.parent !== window;
      var fixed = !!window.__FIXED_FRAME__;
      var standalone = !!window.__IQ_STANDALONE__;
      if (inFrame && !fixed && !standalone) return;
      if (window.innerWidth < 900) return;
      var grid = root.querySelector('.iq-grid');
      if (!grid) return;
      root.classList.add('iq-app');
      /* 模块模式下宿主给 root 设了 minHeight(=demo.height)，
         三栏改成自然高度后会留一片空白，这里清掉。 */
      root.style.minHeight = '0';
      grid.style.height = '';
    }

    return { boot: boot };
  })();
  global.IQFrame = IQFrame;
})(window);
