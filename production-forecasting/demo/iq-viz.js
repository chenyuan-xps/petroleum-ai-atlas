/* =========================================================
   iq-viz.js — 平台与案例共用的 D3 组件层
   ---------------------------------------------------------
   · 只依赖本地 assets/vendor/d3.v7.min.js（离线可用）
   · 颜色一律取自 CSS 设计令牌的同源色值，不引入新色相
   · 每个组件接收一个 DOM 容器与配置对象，内部负责清空重绘
   ========================================================= */
(function (global) {
  'use strict';

  var IQViz = {};
  var d3 = global.d3;

  /* 与 tokens.css 保持一致：cv / ts / nlp / opt / kg */
  var MC = {
    cv: '#4a443a',
    ts: '#b06a3b',
    nlp: '#78568a',
    opt: '#8a3040',
    kg: '#6f7430'
  };
  var C = {
    ink: '#151b1e', ink2: '#39434b', ink3: '#56616a', ink4: '#6f7a82',
    line: '#eae6da', line2: '#dbd5c3', line3: '#bcb49f',
    jade: '#4a443a', clay: '#b06a3b', ok: '#35785a', bad: '#a85249'
  };
  /* SVG 呈现属性不支持 var()，这里给出等价的等宽字体栈 */
  var MONO = 'ui-monospace, SFMono-Regular, Consolas, monospace';

  function methodColor(k) { return MC[k] || C.ink3; }

  function reduceMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ready(el, msg) {
    if (!d3) {
      el.innerHTML = '<div class="viz-empty">' + (msg || 'D3 未加载，图表不可用') + '</div>';
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------
     作业链 × 方法构成
     横向堆叠条：每行一个环节，段宽 = 该方法下的场景数
     --------------------------------------------------------- */
  IQViz.stageBars = function (el, o) {
    if (!el) return;
    if (!ready(el)) return;
    o = o || {};
    var stages = o.stages || [];
    var M = o.methods || {};
    var counts = o.counts || {};
    var keys = Object.keys(M);
    var cases = o.cases || [];

    /* 案例 → 环节 的映射（case 只给 sceneId，环节从场景表反查） */
    var sceneStage = {}, caseCodes = {};
    stages.forEach(function (st) {
      (st.scenes || []).forEach(function (sc) { sceneStage[sc.id] = st.id; });
    });
    cases.forEach(function (c) {
      (caseCodes[sceneStage[c.sceneId]] = caseCodes[sceneStage[c.sceneId]] || []).push(c.code);
    });

    el.innerHTML = '';
    var W = 620, left = 106, right = 40, rowH = 27, top = 30;
    var H = top + stages.length * rowH + 8;
    var max = d3.max(stages, function (st) { return st.scenes.length; }) || 1;
    var scale = d3.scaleLinear().domain([0, max]).range([0, W - left - right]);
    var svg = d3.select(el).append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('role', 'img')
      .attr('aria-label', '13 个作业环节的方法构成');

    /* 顶部刻度 */
    var gTop = svg.append('g');
    var ticks = scale.ticks(4).filter(function (t) { return t > 0; });
    ticks.forEach(function (t) {
      gTop.append('line')
        .attr('x1', left + scale(t)).attr('x2', left + scale(t))
        .attr('y1', top - 7).attr('y2', H - 6)
        .attr('stroke', C.line).attr('stroke-dasharray', '2 3');
      gTop.append('text')
        .attr('x', left + scale(t)).attr('y', top - 11)
        .attr('text-anchor', 'middle')
        .attr('font-family', MONO).attr('font-size', 9)
        .attr('fill', C.ink4).text(t);
    });

    var rows = svg.append('g').selectAll('g')
      .data(stages)
      .join('a')
      .attr('href', function (st) { return '#/stage/' + st.id; })
      .attr('class', 'iqv-row')
      .style('cursor', 'pointer');

    rows.append('rect')
      .attr('class', 'iqv-rowbg')
      .attr('x', 2).attr('y', function (d, i) { return top + i * rowH - 3; })
      .attr('width', W - 4).attr('height', rowH - 1).attr('rx', 4)
      .attr('fill', function (st) {
        return st.id === o.highlight ? 'rgba(58,53,45,.075)' : 'transparent';
      });

    /* 环节序号 + 名称 */
    rows.append('text')
      .attr('x', 6)
      .attr('y', function (d, i) { return top + i * rowH + 13; })
      .attr('font-family', MONO).attr('font-size', 8.5)
      .attr('fill', C.ink3)
      .text(function (st) { return ('0' + st.idx).slice(-2); });

    rows.append('text')
      .attr('x', 23)
      .attr('y', function (d, i) { return top + i * rowH + 13; })
      .attr('font-size', 11.5)
      .attr('fill', function (st) { return st.id === o.highlight ? C.jade : C.ink2; })
      .attr('font-weight', function (st) { return st.id === o.highlight ? 600 : 400; })
      .text(function (st) { return st.name; });

    /* 堆叠段 */
    var seg = rows.append('g');
    seg.each(function (st, i) {
      var g = d3.select(this);
      var y = top + i * rowH + 5;
      var x0 = left;
      keys.forEach(function (k) {
        var v = (counts[st.id] || {})[k] || 0;
        if (!v) return;
        var w = Math.max(2, scale(v) - 1.5);
        var bar = g.append('rect')
          .attr('x', x0).attr('y', y)
          .attr('width', reduceMotion() ? w : 0)
          .attr('height', rowH - 11).attr('rx', 1.5)
          .attr('fill', methodColor(k))
          .attr('fill-opacity', k === 'nlp' || k === 'kg' ? .7 : .8);
        bar.append('title').text((M[k] ? M[k].abbr : k) + ' · ' + v + ' 个场景');
        if (!reduceMotion()) {
          bar.transition().delay(60 + i * 16).duration(420).ease(d3.easeCubicOut)
            .attr('width', w);
        }
        x0 += w + 2;
      });
      /* 空白环节：留一条虚线占位 */
      if (!st.scenes.length) {
        g.append('line')
          .attr('x1', left).attr('x2', left + 26).attr('y1', y + 6).attr('y2', y + 6)
          .attr('stroke', C.line2).attr('stroke-dasharray', '3 3');
      }
    });

    /* 右侧场景数 + 案例编号 */
    rows.append('text')
      .attr('x', W - 8)
      .attr('y', function (d, i) { return top + i * rowH + 13; })
      .attr('text-anchor', 'end')
      .attr('font-family', MONO).attr('font-size', 10)
      .attr('fill', C.ink3)
      .text(function (st) { return st.scenes.length; });

    rows.append('text')
      .attr('x', left - 6)
      .attr('y', function (d, i) { return top + i * rowH + 13; })
      .attr('text-anchor', 'end')
      .attr('font-family', MONO).attr('font-size', 8)
      .attr('fill', C.clay)
      .attr('letter-spacing', .4)
      .text(function (st) { return (caseCodes[st.id] || []).join('/'); });

    rows.append('title')
      .text(function (st) {
        var parts = keys.map(function (k) {
          return (M[k] ? M[k].abbr : k) + ' ' + ((counts[st.id] || {})[k] || 0);
        });
        var cs = caseCodes[st.id];
        return st.idx + ' ' + st.name + ' · ' + st.scenes.length + ' 个场景\n' +
          parts.join(' / ') + (cs ? '\n案例：' + cs.join('、') : '');
      });

    /* 底部图例 */
    var lg = svg.append('g').attr('transform', 'translate(' + left + ',' + (H - 2) + ')');
    var lx = 0;
    keys.forEach(function (k) {
      if (!M[k]) return;
      lg.append('rect').attr('x', lx).attr('y', -5).attr('width', 6).attr('height', 6)
        .attr('rx', 1).attr('fill', methodColor(k)).attr('fill-opacity', .78);
      lg.append('text').attr('x', lx + 9).attr('y', 0)
        .attr('font-family', MONO).attr('font-size', 8.5)
        .attr('fill', C.ink4).text(M[k].abbr);
      lx += 38;
    });
  };

  /* ---------------------------------------------------------
     方法分布环图
     --------------------------------------------------------- */
  IQViz.methodDonut = function (el, o) {
    if (!el) return;
    if (!ready(el)) return;
    o = o || {};
    var M = o.methods || {};
    var byMethod = o.byMethod || {};
    var keys = Object.keys(M);
    var data = keys.map(function (k) {
      var n = (byMethod[k] || []).length;
      return { k: k, abbr: M[k].abbr, name: M[k].name, n: n, color: methodColor(k) };
    });
    var total = o.total || d3.sum(data, function (d) { return d.n; });
    var size = 188, r1 = 84, r0 = 57;

    el.innerHTML = '';
    var svg = d3.select(el).append('svg')
      .attr('viewBox', '0 0 ' + size + ' ' + size)
      .attr('role', 'img')
      .attr('aria-label', '五类方法的场景分布');
    var g = svg.append('g').attr('transform', 'translate(' + size / 2 + ',' + size / 2 + ')');

    var pie = d3.pie().value(function (d) { return d.n; }).sort(null).padAngle(.03);
    var arc = d3.arc().innerRadius(r0).outerRadius(r1).cornerRadius(3);

    g.selectAll('path').data(pie(data)).join('path')
      .attr('d', arc)
      .attr('fill', function (d) { return d.data.color; })
      .attr('fill-opacity', .82)
      .attr('stroke', '#fff').attr('stroke-width', 1.4)
      .attr('tabindex', 0)
      .attr('role', 'link')
      .attr('aria-label', function (d) { return d.data.name + ' ' + d.data.n + ' 个场景'; })
      .style('cursor', 'pointer')
      .on('mouseenter', function () {
        d3.select(this).attr('fill-opacity', 1);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill-opacity', .82);
      })
      .on('click', function (e, d) { global.location.hash = '#/method/' + d.data.k; })
      .on('keydown', function (e, d) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          global.location.hash = '#/method/' + d.data.k;
        }
      })
      .append('title')
      .text(function (d) { return d.data.name + ' · ' + d.data.n + ' 个场景'; });

    g.append('text').attr('y', -3).attr('text-anchor', 'middle')
      .attr('font-family', MONO).attr('font-size', 25)
      .attr('fill', C.ink).text(total);
    g.append('text').attr('y', 12).attr('text-anchor', 'middle')
      .attr('font-size', 9.5).attr('fill', C.ink4).text('候选场景');
  };

  /* ---------------------------------------------------------
     数字滚动（首页指标卡）
     --------------------------------------------------------- */
  IQViz.counters = function (root) {
    var els = (root || document).querySelectorAll('.countup[data-to]');
    if (!els.length) return;
    [].forEach.call(els, function (el) {
      var to = Number(el.dataset.to);
      if (!isFinite(to)) return;
      if (reduceMotion()) { el.textContent = to; return; }
      var t0 = 0, dur = 620;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e);
        if (p < 1) global.requestAnimationFrame(step);
      }
      el.textContent = '0';
      global.requestAnimationFrame(step);
    });
  };

  IQViz.methodColor = methodColor;
  IQViz.colors = { method: MC, base: C };

  global.IQViz = IQViz;
})(window);
