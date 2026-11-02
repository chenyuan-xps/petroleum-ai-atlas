/* =========================================================
   co1 完井方式智能优选 · 案例流程页的逐步动态图
   ---------------------------------------------------------
   复用 completion-method-selection/demo/demo.js 暴露的
   window.__IQ_WF__[KEY].model（同一套 TOPSIS 与扰动逻辑），
   每一步只换图形，不改算法结论。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'completion-method-selection';

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
      '" fill="' + (o.f || '#333f4b') + '"' +
      (o.a ? ' text-anchor="' + o.a + '"' : '') +
      (o.b ? ' font-weight="600"' : '') +
      (o.m ? ' font-family="ui-monospace,monospace"' : '') +
      (o.ls ? ' letter-spacing="' + o.ls + '"' : '') + '>' + esc(s) + '</text>';
  }
  function rc(x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (o.r || 4) +
      '" fill="' + (o.f || '#fff') + '"' + (o.st ? ' stroke="' + o.st + '"' : '') +
      (o.sw ? ' stroke-width="' + o.sw + '"' : '') + '/>';
  }
  function ln(x1, y1, x2, y2, st, w, d) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + (st || '#d2ccbf') + '" stroke-width="' + (w || 1) + '"' +
      (d ? ' stroke-dasharray="' + d + '"' : '') + '/>';
  }
  function num(v, d) { return Number(v).toFixed(d == null ? 1 : d); }

  function render(i, el, WF) {
    if (!WF || !WF.model) {
      el.innerHTML = '<div class="wf-empty">模型未加载（需先加载案例示范脚本）</div>';
      return '';
    }
    var M = WF.model;
    var st = M.DEFAULTS;
    var rows = M.evaluate(st);
    var ranked = rows.ranked;

    /* ---------- 0 数据采集与口径统一 ---------- */
    if (i === 0) {
      var s = rc(0, 0, 640, 330, { f: '#fff' });
      s += tx(16, 22, '原始参数（示范默认值）', { s: 10, b: 1, f: '#3a352d' });
      s += tx(360, 22, '统一口径后的可比值', { s: 10, b: 1, f: '#3a352d' });
      var params = [
        ['储层渗透率', st.perm + ' mD', '0.08 μm²（1 mD = 10⁻³ μm²）'],
        ['地层压力', st.pressure + ' MPa', '32 MPa = 32,000 kPa'],
        ['出砂风险指数', num(st.sandRisk, 2) + '（0—1）', '无因次，0 低 / 1 高'],
        ['完井预算', st.budget + ' 万元', '只算管材 + 作业费，同一口径'],
        ['目标日产', st.target + ' t/d', '统一为日产油，不用月产']
      ];
      params.forEach(function (p, k) {
        var y = 38 + k * 54;
        s += rc(16, y, 232, 44, { f: '#fbfaf6', st: '#e4e0d6' });
        s += tx(28, y + 18, p[0], { s: 9, f: '#56616d' });
        s += tx(28, y + 35, p[1], { s: 11, b: 1, f: '#333f4b', m: 1 });
        s += '<line x1="256" y1="' + (y + 22) + '" x2="286" y2="' + (y + 22) + '" stroke="#b8622f" stroke-width="1.2"/>';
        s += '<path d="M280 ' + (y + 17) + ' L288 ' + (y + 22) + ' L280 ' + (y + 27) + ' z" fill="#b8622f"/>';
        s += rc(296, y, 328, 44, { f: '#faf3ea', st: 'rgba(58,53,45,.28)' });
        s += tx(308, y + 27, p[2], { s: 10.5, f: '#3a352d' });
      });
      s += tx(16, 322, '同一列必须同单位、同基准；混用 mD 与 μm² 会让低渗井的产能被系统性高估。', { s: 9.5, f: '#7e8894' });
      el.innerHTML = svg(s, 330);
      return '<b>怎么看：</b>左边是采集到的原始值，右边是换成统一口径后的值。' +
        '箭头表示“换算”，不是“变好”。渗透率 80 mD 与 0.08 μm² 是同一个数，只是单位不同；' +
        '不统一，后面的评分表就没法直接比较。';
    }

    /* ---------- 1 候选方案集构建 ---------- */
    if (i === 1) {
      var all = M.METHODS.length;
      var budgetOk = ranked.filter(function (r) { return r.cost <= st.budget; });
      var relOk = budgetOk.filter(function (r) { return r.rel >= 50; });
      var top3 = (relOk.length ? relOk : ranked).slice(0, 3);
      var stages = [
        { t: '全部完井方式', v: all, d: '5 种候选', c: '#9ba3a9', set: ranked },
        { t: '预算内', v: budgetOk.length, d: '≤ ' + st.budget + ' 万元', c: '#5b9b87', set: budgetOk },
        { t: '可靠性达标', v: relOk.length, d: '可靠性 ≥ 50 分', c: '#3a352d', set: relOk },
        { t: '进入复核', v: top3.length, d: '得分前 3', c: '#3a352d', set: top3 }
      ];
      var s2 = rc(0, 0, 640, 330, { f: '#fff' });
      stages.forEach(function (g, k) {
        var y = 40 + k * 62;
        var w = Math.max(26, (g.v / all) * 330);
        s2 += tx(16, y + 12, g.t, { s: 10, b: 1 });
        s2 += tx(16, y + 28, g.d, { s: 8.5, f: '#7e8894' });
        s2 += rc(140, y, 340, 32, { f: '#faf9f5', st: '#e4e0d6' });
        s2 += rc(140, y, w, 32, { f: g.c, r: 4 });
        s2 += tx(148 + w, y + 21, g.v + ' 个', { s: 13, b: 1, f: g.c === '#9ba3a9' ? '#56616d' : '#3a352d', m: 1 });
        s2 += tx(492, y + 21, g.set.map(function (r) { return r.short; }).join(' / '), { s: 9, f: '#56616d' });
      });
      s2 += tx(16, 306, '被筛掉 ≠ 不能施工；只是本轮预算、可靠性或排序不占优。', { s: 9.5, f: '#7e8894' });
      s2 += tx(16, 324, '推荐集：' + top3.map(function (r) { return r.name; }).join('、') + '；其余保留为备选。', { s: 9.5, f: '#3a352d' });
      el.innerHTML = svg(s2, 330);
      return '<b>怎么看：</b>从上到下每过一层，候选就少一批（' + all + ' → ' + budgetOk.length +
        ' → ' + relOk.length + ' → ' + top3.length + '）。漏斗的作用是把“无限组合”收敛到能落地的几个方案。' +
        '如果候选集里混进不可施工的方案，排序会给出纸面最优。';
    }

    /* ---------- 2 指标计算与归一化 ---------- */
    if (i === 2) {
      var raw = M.buildRows(st);
      var maxv = M.CRIT.map(function (c, j) {
        return Math.max.apply(null, raw.map(function (r) { return r.vals[j]; }));
      });
      var s3 = rc(0, 0, 640, 330, { f: '#fff' });
      s3 += tx(52, 20, '原始分（0—100，量纲不同）', { s: 9.5, b: 1, f: '#56616d' });
      s3 += tx(376, 20, '归一化后（0—1，可加权）', { s: 9.5, b: 1, f: '#3a352d' });
      M.CRIT.forEach(function (c, j) {
        s3 += tx(70 + j * 42 + 20, 40, c.short, { s: 8.5, f: '#7e8894', a: 'middle' });
        s3 += tx(394 + j * 42 + 20, 40, c.short, { s: 8.5, f: '#7e8894', a: 'middle' });
      });
      raw.forEach(function (r, k) {
        var y = 50 + k * 38;
        s3 += tx(60, y + 18, r.short, { s: 9.5, b: 1, a: 'end' });
        s3 += tx(386, y + 18, r.short, { s: 9.5, b: 1, a: 'end' });
        r.vals.forEach(function (v, j) {
          var nx = 70 + j * 42, ny = 376 + j * 42;
          var a = 0.10 + 0.55 * (v / 100);
          s3 += rc(nx, y, 38, 26, { f: 'rgba(58,53,45,' + a.toFixed(3) + ')', st: '#e4e0d6', r: 3 });
          s3 += tx(nx + 19, y + 17, Math.round(v) + '', { s: 9.5, a: 'middle', f: v > 62 ? '#fff' : '#333f4b', m: 1 });
          var nv = v / maxv[j];
          s3 += rc(ny, y, 38, 26, { f: 'rgba(184,98,47,' + (0.10 + 0.5 * nv).toFixed(3) + ')', st: '#e4e0d6', r: 3 });
          s3 += tx(ny + 19, y + 17, nv.toFixed(2), { s: 9, a: 'middle', f: nv > 0.65 ? '#fff' : '#333f4b', m: 1 });
        });
      });
      s3 += tx(16, 300, '左：产能/防砂/经济/可靠/施工的原始分；右：压到 0—1。', { s: 9.5, f: '#7e8894' });
      s3 += tx(16, 320, '颜色越深 = 该项越强。压量纲后再加权，大数才不会压死小数。', { s: 9.5, f: '#3a352d' });
      el.innerHTML = svg(s3, 330);
      return '<b>怎么看：</b>每个方格里是同一方案在同一指标上的得分。左边原始分量纲不同（成本是万元、' +
        '产量是 t/d），右边按该指标最大值压到 0—1。只有压到同一把尺子上，加权求和才有意义。';
    }

    /* ---------- 3 TOPSIS 排序与敏感性 ---------- */
    if (i === 3) {
      var best = rows.best;
      var baseW = M.WEIGHTS[st.pref].w;
      var pert = M.perturbList(st, baseW);
      var stable = pert.filter(function (p) { return p.top.id === best.id; }).length;
      var s4 = rc(0, 0, 640, 330, { f: '#fff' });
      s4 += tx(16, 22, 'TOPSIS 贴近度（越接近 100 越优）', { s: 10, b: 1, f: '#3a352d' });
      ranked.forEach(function (r, k) {
        var y = 40 + k * 34;
        var w = Math.max(4, (r.score / 100) * 360);
        s4 += tx(76, y + 18, r.short, { s: 10, b: 1, a: 'end' });
        s4 += rc(84, y, 368, 26, { f: '#faf9f5', st: '#e4e0d6' });
        s4 += rc(84, y, w, 26, { f: k === 0 ? '#3a352d' : '#7ba99b', r: 4 });
        s4 += tx(84 + w + 8, y + 18, num(r.score, 1) + ' 分', { s: 9.5, f: k === 0 ? '#3a352d' : '#56616d', m: 1 });
        s4 += tx(560, y + 18, k === 0 ? '推荐' : (k === 1 ? '备选' : ''), { s: 8.5, f: k === 0 ? '#b8622f' : '#7e8894' });
      });
      s4 += tx(16, 250, '权重逐项 ±25% 扰动 10 组：', { s: 9.5, f: '#56616d', b: 1 });
      pert.forEach(function (p, k) {
        var x = 196 + k * 42;
        var same = p.top.id === best.id;
        s4 += rc(x, 232, 34, 24, { f: same ? '#efe9df' : '#fbe9e7', st: same ? '#3a352d' : '#b23a34', r: 3 });
        s4 += tx(x + 17, 248, p.top.short, { s: 8, a: 'middle', f: same ? '#3a352d' : '#b23a34' });
        s4 += tx(x + 17, 270, p.crit.slice(0, 2) + (p.dir === 'up' ? '↑' : '↓'), { s: 7, a: 'middle', f: '#7e8894' });
      });
      s4 += rc(16, 286, 608, 36, { f: '#faf9f5', st: '#e4e0d6' });
      s4 += tx(28, 309, '稳定率 ' + stable + ' / 10 · 首选 ' + best.name + ' 得分 ' + num(best.score, 1) +
        ' · 与第二名 ' + rows.second.name + ' 相差 ' + num(rows.gap, 1) + ' 分', { s: 10, f: '#333f4b' });
      el.innerHTML = svg(s4, 330);
      return '<b>怎么看：</b>条形是综合得分，第一名推荐、第二名备选。下方 10 个筹码是逐项把权重调 ±25% 后重新排序的结果：' +
        '绿色表示第一名没翻，红色表示翻了。稳定率 ' + stable + '/10，分差只有 ' + num(rows.gap, 1) +
        ' 分——这说明结论可用，但不宜当成“唯一正确答案”。';
    }

    /* ---------- 4 工程复核与定稿 ---------- */
    var b1 = ranked[0], b2 = ranked[1], b3 = ranked[ranked.length - 1];
    var s5 = rc(0, 0, 640, 330, { f: '#fff' });
    var cards = [
      { t: '推荐', r: b1, c: '#3a352d', bg: '#faf3ea', why: '得分最高且约束内' },
      { t: '备选', r: b2, c: '#b8622f', bg: '#fdf6ec', why: '分差小，可作为回退' },
      { t: '不推荐', r: b3, c: '#b23a34', bg: '#fbeceb', why: '本轮得分靠后' }
    ];
    cards.forEach(function (c, k) {
      var x = 16 + k * 204;
      s5 += rc(x, 24, 192, 160, { f: c.bg, st: c.c, r: 8 });
      s5 += tx(x + 14, 46, c.t, { s: 11, b: 1, f: c.c });
      s5 += tx(x + 14, 78, c.r.name, { s: 15, b: 1 });
      s5 += tx(x + 14, 100, '综合得分 ' + num(c.r.score, 1), { s: 9.5, f: '#56616d' });
      s5 += tx(x + 14, 118, '预测日产 ' + num(c.r.q, 1) + ' t/d', { s: 9.5, f: '#56616d' });
      s5 += tx(x + 14, 136, '投资 ' + c.r.cost + ' 万元', { s: 9.5, f: '#56616d' });
      s5 += tx(x + 14, 160, c.why, { s: 8.8, f: c.c });
    });
    s5 += tx(16, 214, '签字前复核清单', { s: 10, b: 1, f: '#3a352d' });
    [
      '射孔 / 筛管器材库存与到货周期',
      '套管强度与水泥环封固质量',
      '甲方强制条款与层间隔离要求',
      '邻井实际产量与出砂反馈'
    ].forEach(function (t, k) {
      var y = 236 + k * 22;
      s5 += rc(18, y - 10, 10, 10, { f: '#fff', st: '#3a352d', r: 2 });
      s5 += tx(38, y, t, { s: 9.5, f: '#56616d' });
    });
    el.innerHTML = svg(s5, 330);
    return '<b>怎么看：</b>推荐 / 备选 / 不推荐是按得分与约束自动分的三档，不是三套模型。' +
      '下方清单是签字前必须逐项核对的现场条件——模型只负责排序，能不能执行由工程复核决定。';
  }

  window.__IQ_WF_RENDER__ = window.__IQ_WF_RENDER__ || {};
  window.__IQ_WF_RENDER__[KEY] = render;
})();
