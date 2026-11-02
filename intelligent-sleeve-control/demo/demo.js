/* =========================================================
   co4 智能完井滑套控制策略 · 交互示范
   ---------------------------------------------------------
   分层产能模型 + 带约束网格优化 + 30 天滚动调控模拟
   多层井示意图、开度分配、产油曲线、含水率曲线
   本示范使用合成数据，仅用于展示方法流程。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'intelligent-sleeve-control';

  if (!window.__IQ_STANDALONE__ && !window.__IQ_CSS_SHARED__ && document.currentScript && document.currentScript.src) {
    var cssHref = document.currentScript.src.replace(/demo\.js(\?.*)?$/, 'demo.css');
    if (!document.querySelector('link[data-iq-css="' + KEY + '"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      link.setAttribute('data-iq-css', KEY);
      document.head.appendChild(link);
    }
  }

  function boot(root) {
    if (!root) return null;
    if (!window.d3) {
      root.innerHTML = '<div class="iq-miss"><b>D3 未加载</b><br>请确认 demo/index.html 中已引入 d3.v7.min.js。</div>';
      return null;
    }
    var d3 = window.d3;

    /* 版式与「测井曲线智能分层」示范一致：整块面板 + 头部标题带 + 左图区 / 右控制栏 */
    /* 不再套用 iq-unified 的两栏版式：它与三栏（概念/图表/控制）冲突，
       六个案例统一走 .iq-grid 的三栏栅格。 */

    var LAYERS = [
      { id: 'A', name: 'A 层 · 主力油层', short: 'A', oilMax: 76, wc0: 0.16 },
      { id: 'B', name: 'B 层 · 接替层', short: 'B', oilMax: 50, wc0: 0.32 },
      { id: 'C', name: 'C 层 · 含水层', short: 'C', oilMax: 34, wc0: 0.72 }
    ];
    var WHP = 16;          /* 井口压力 MPa */
    var LIQ_LIMIT = 270;   /* 井筒液量上限 t/d */
    var DAYS = 30;
    var DEFAULTS = { ua: 70, ub: 70, uc: 60, target: 115, wct: 40, cycle: 7 };
    var EXPERIENCE = { ua: 70, ub: 70, uc: 60 };

    var state = { ua: DEFAULTS.ua, ub: DEFAULTS.ub, uc: DEFAULTS.uc, target: DEFAULTS.target, wct: DEFAULTS.wct, cycle: DEFAULTS.cycle };
    var simDay = DAYS;
    var view = 'ai';          /* ai = AI 动态；fixed = 固定开度 */
    var playing = false;
    var timer = null;
    var cache = { key: '', sims: null };

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function pf() { return clamp(1 - (WHP - 10) * 0.012, 0.8, 1); }

    /* ---------------- 分层产能 ---------------- */
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
      var best = null, nFeas = 0, nEval = 0;
      for (var a = 0; a <= 20; a++) {
        for (var b = 0; b <= 20; b++) {
          for (var c = 0; c <= 20; c++) {
            var plan = [a / 20, b / 20, c / 20];
            var r = rates(plan, wcs, pfv);
            var deficit = Math.max(0, st.target - r.oilT);
            var excess = Math.max(0, r.oilT - st.target);
            var wcOver = Math.max(0, r.wc * 100 - st.wct);
            var feasible = r.oilT >= st.target * 0.985;
            nEval++;
            if (feasible) nFeas++;
            /* 先保证产油目标，再在可行解中最小化产水 */
            var score = feasible
              ? (r.waterT + excess * 0.4 + wcOver * 0.8)
              : (1000 + deficit * 10 + r.waterT * 0.05);
            if (!best || score < best.score) {
              best = { plan: plan, rates: r, score: score, feasible: feasible };
            }
          }
        }
      }
      best.evaluated = nEval;
      best.feasibleCount = nFeas;
      return best;
    }

    function simulate(fixed, mode, st) {
      var wcs = LAYERS.map(function (l) { return l.wc0; });
      var pressure = pf();
      var plan = fixed.slice();
      var series = [], cumOil = 0, cumWater = 0, optCount = 0;
      var lastFeas = 0, lastEval = 0, planOk = true;
      for (var day = 1; day <= DAYS; day++) {
        if (mode === 'ai' && (day - 1) % st.cycle === 0) {
          var o = optimizeOpen(wcs, st, pressure);
          plan = o.plan;
          lastFeas = o.feasibleCount;
          lastEval = o.evaluated;
          planOk = o.feasible;
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
      return {
        series: series, cumOil: cumOil, cumWater: cumWater, hit: hit, wcOk: wcOk, choices: optCount,
        feas: lastFeas, evaluated: lastEval, planOk: planOk
      };
    }

    function getSims() {
      var key = [state.ua, state.ub, state.uc, state.target, state.wct, state.cycle].join('|');
      if (cache.key !== key) {
        var fixed = [state.ua / 100, state.ub / 100, state.uc / 100];
        cache.sims = { manual: simulate(fixed, 'manual', state), ai: simulate(fixed, 'ai', state) };
        cache.key = key;
      }
      return cache.sims;
    }

    function confidenceOf(sim, isManual) {
      var c = 46 + sim.hit / DAYS * 30 + sim.wcOk / DAYS * 16;
      if (sim.hit < DAYS * 0.8) c -= 8;
      c -= Math.max(0, (sim.choices || 0) - 6) * 1.2;
      if (isManual) c -= 6;   /* 固定开度为人工经验方案，置信度略低 */
      return clamp(Math.round(c), 34, 94);
    }

    /* 当前回放口径下的逐日指标（随 simDay 截断） */
    function viewData(sims) {
      var src = view === 'fixed' ? sims.manual : sims.ai;
      var series = src.series.slice(0, simDay);
      var point = series[series.length - 1];
      var cumOil = 0, cumWater = 0;
      series.forEach(function (p) { cumOil += p.oil; cumWater += p.water; });
      var hit = series.filter(function (p) { return p.oil >= state.target * 0.98; }).length;
      var wcOk = series.filter(function (p) { return p.wc * 100 <= state.wct; }).length;
      return {
        key: view, series: series, point: point, plan: point.plan,
        cumOil: cumOil, cumWater: cumWater, hit: hit, wcOk: wcOk,
        conf: confidenceOf({ hit: hit, wcOk: wcOk, choices: src.choices }, view === 'fixed')
      };
    }

    /* ---------------- 骨架 ---------------- */
    root.innerHTML =
      '<div class="iq-head">' +
        '<div><span class="iq-kicker">SCENE co4 · 完井</span>' +
          '<h3>智能完井滑套控制：把开度分配成一条可执行的曲线</h3>' +
          '</div>' +
        '<div class="iq-tags"><span class="iq-tag jade">约束优化</span><span class="iq-tag">滚动调控</span><span class="iq-tag blue">逐日仿真</span><span class="iq-tag clay">多目标</span></div>' +
      '</div>' +
      '<div class="iq-grid">' +
        '<div class="iq-figure">' +
          '<div class="iq-card"><div class="iq-card-h"><h4><i class="iq-dot"></i>多层水平井</h4><span class="iq-mini" id="co4-fig-mini">—</span></div><div id="co4-figure"></div>' +
            '<div class="iq-legend"><span><i style="background:#3a352d"></i>滑套开启</span><span><i style="background:#d4d0c8"></i>关闭段</span><span><i style="background:#a03d4f"></i>水相</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>当前设定</h4><span class="iq-mini" id="co4-set-tag">—</span></div><div id="co4-detail"></div></div>' +
        '</div>' +
        '<div class="iq-main">' +
      '<div class="iq-card"><div class="iq-card-h"><h4>滑套开度分配</h4><span class="iq-mini" id="co4-open-mini">—</span></div><div id="co4-openchart"></div>' +
            '<div class="iq-legend"><span><i style="background:#ddd7c8"></i>当前设定</span><span><i style="background:#3a352d"></i>AI 动态</span></div></div>' +
          '<div class="iq-card iq-timecard">' +
            '<div class="iq-card-h"><h4>30 天调控回放</h4><span class="iq-mini" id="co4-time-mini">第 30 天</span></div>' +
            '<div class="iq-timebar">' +
              '<div class="iq-seg mini" id="co4-view">' +
                '<button type="button" data-view="ai" class="on" title="AI 每周期按最新含水重算开度">AI 动态</button>' +
                '<button type="button" data-view="fixed" title="沿用右侧当前设定，30 天不调整">固定开度</button>' +
              '</div>' +
              '<button type="button" class="iq-btn sm" id="co4-tplay">▶ 播放</button>' +
              '<button type="button" class="iq-btn sm" id="co4-step">单步 →</button>' +
              '<input type="range" id="co4-timeline" min="1" max="30" step="1" value="30" aria-label="调控日">' +
              '<span class="iq-day" id="co4-day">D30</span>' +
            '</div>' +
            '<div class="iq-note slim" id="co4-time-note">拖动时间轴查看每天的滑套开度、分层产液与曲线位置。</div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>30 天产油曲线</h4><span class="iq-mini" id="co4-oil-mini">目标 ' + state.target + ' t/d</span></div><div id="co4-oil"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#b26a39"></i>固定开度</span><span><i class="line" style="background:#3a352d"></i>AI 动态调控</span><span><i class="line" style="background:#9ba3a9"></i>目标线</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>30 天含水率曲线</h4><span class="iq-mini" id="co4-wc-mini">目标 ≤ ' + state.wct + '%</span></div><div id="co4-wc"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#b26a39"></i>固定开度</span><span><i class="line" style="background:#3a352d"></i>AI 动态调控</span><span><i class="line" style="background:#b05a51"></i>含水目标</span></div></div>' +
        '</div>' +
        '<div class="iq-side">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>输入参数</h4><span class="iq-mini">6 项</span></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>A 层滑套开度</span><output id="co4-o-ua">70%</output></div><input type="range" id="co4-ua" min="0" max="100" step="1" value="70"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>B 层滑套开度</span><output id="co4-o-ub">70%</output></div><input type="range" id="co4-ub" min="0" max="100" step="1" value="70"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>C 层滑套开度</span><output id="co4-o-uc">60%</output></div><input type="range" id="co4-uc" min="0" max="100" step="1" value="60"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>目标日产油</span><output id="co4-o-target">115 t/d</output></div><input type="range" id="co4-target" min="90" max="170" step="5" value="115"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>目标含水率</span><output id="co4-o-wct">40%</output></div><input type="range" id="co4-wct" min="25" max="60" step="1" value="40"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>调控周期</span><output id="co4-o-cycle">7 天</output></div><input type="range" id="co4-cycle" min="3" max="15" step="1" value="7"></div>' +
            '<div class="iq-btns"><button class="iq-btn" id="co4-reset">重置</button><button class="iq-btn" id="co4-play">30 天动画</button><button class="iq-btn primary" id="co4-ai">采用 AI 开度</button></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>AI 调控输出</h4><span class="iq-mini" id="co4-out-mini">—</span></div>' +
            '<div class="iq-kpis">' +
              '<div class="iq-kpi wide"><span>推荐开度 A / B / C</span><b class="hero" id="co4-k-plan">—</b></div>' +
              '<div class="iq-kpi"><span>日产油</span><b id="co4-k-oil">—</b></div>' +
              '<div class="iq-kpi"><span>含水率</span><b id="co4-k-wc">—</b></div>' +
              '<div class="iq-kpi"><span>累产油</span><b id="co4-k-cum">—</b></div>' +
              '<div class="iq-kpi"><span>累产水</span><b id="co4-k-water">—</b></div>' +
              '<div class="iq-kpi wide"><span>达标天数（产油 / 含水）</span><b id="co4-k-hit">—</b></div>' +
              '<div class="iq-kpi wide"><span>风险等级 · 含水超标与失配</span><b id="co4-k-risk">—</b></div>' +
            '</div>' +
            '<div class="iq-meter"><i id="co4-conf-bar" style="width:0%"></i></div>' +
            '<div class="iq-meter-row"><span>推荐置信度</span><span id="co4-conf-txt">—</span></div>' +
            '<div class="iq-note" id="co4-note">—</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-extra">' +
        '<div class="iq-card"><div class="iq-card-h"><h4>分层产液构成 · 面积</h4><span class="iq-mini" id="co4-stack-mini">—</span></div><div id="co4-stack"></div>' +
          '<div class="iq-legend"><span><i style="background:#3a352d"></i>油 A</span><span><i style="background:#5b9b87"></i>油 B</span><span><i style="background:#9fc4b8"></i>油 C</span><span><i style="background:#a03d4f"></i>水 A</span><span><i style="background:#7d9dc4"></i>水 B</span><span><i style="background:#c3d3e6"></i>水 C</span></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>三层流量分配对比</h4><span class="iq-mini" id="co4-split-mini">—</span></div><div id="co4-split"></div>' +
          '<div class="iq-legend"><span><i style="background:#b26a39"></i>固定 油</span><span><i style="background:#e2c9b5"></i>固定 水</span><span><i style="background:#3a352d"></i>AI 油</span><span><i style="background:#9fc4b8"></i>AI 水</span></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>滑套开度时间轴 · 30 天 × 3 层</h4><span class="iq-mini" id="co4-strip-mini">—</span></div>' +
          '<div id="co4-strip" class="iq-strip"></div><div class="iq-strip-note" id="co4-strip-note"></div>' +
          '<p class="iq-poll">每一格是一天：颜色越深，滑套开得越大；变暗的是还没播放到的天数，橙框是当前回放日。</p></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>自动控制闭环 · 监测 → 判断 → 控制 → 反馈</h4><span class="iq-mini" id="co4-loop-mini">—</span></div>' +
          '<div id="co4-loop"></div>' +
          '<p class="iq-poll">四个节点里的数字都来自本轮模拟结果，随右侧参数与时间轴实时更新。</p></div>' +
      '</div>' +
      '<div class="iq-bottom">' +
        '<div class="iq-card"><div class="iq-card-h"><h4>固定开度 vs AI 动态</h4><span class="iq-mini">30 天模拟</span></div><div id="co4-table"></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>结果解释与流程</h4><span class="iq-mini">可复核</span></div><div class="iq-note blue" id="co4-explain">—</div>' +
          '<div class="iq-flow" style="margin-top:8px"><span>分层数据</span><em>→</em><span>产能预测</span><em>→</em><span>约束优化</span><em>→</em><span>滚动调控</span><em>→</em><span>现场执行</span></div>' +
          '<div class="iq-poll">本示范使用合成数据，用于展示智能方法和可视化流程，不代表真实生产结果。</div>' +
        '</div>' +
      '</div>';

    /* 智能方法说明卡：插在头部下方，数值随参数实时重算 */
    var smartBox = document.createElement('div');
    smartBox.id = 'co4-smart';
    var smartHead = root.querySelector('.iq-head');
    /* 方法卡放在示范页最前面（标题之后、三栏之前）：先讲方法，再看三栏。 */
    if (smartHead && smartHead.parentNode) smartHead.parentNode.insertBefore(smartBox, smartHead.nextSibling);

    /* 三栏固定版式 + 图表放大（仅在固定高度框架/单独打开时生效） */
    if (window.IQFrame) window.IQFrame.boot(root);

    var tip = document.createElement('div');
    tip.className = 'iq-tip';
    root.appendChild(tip);
    var cleanups = [];
    function listen(el, ev, fn) {
      if (!el) return;
      el.addEventListener(ev, fn);
      cleanups.push(function () { el.removeEventListener(ev, fn); });
    }
    function $(id) { return root.querySelector('#' + id); }
    function tipShow(html, ev) {
      var r = root.getBoundingClientRect();
      tip.innerHTML = html;
      tip.style.left = (ev.clientX - r.left) + 'px';
      tip.style.top = (ev.clientY - r.top) + 'px';
      tip.classList.add('on');
    }
    function tipHide() { tip.classList.remove('on'); }

    /* ---------------- 多层井示意 ---------------- */
    function figureSvg(plan, point) {
      var W = 260, H = 312;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多层水平井滑套开度示意">';
      s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
      var bands = [
        { y: 58, h: 58, fill: '#efe9dc', name: 'A 层 · 主力油层', idx: 0 },
        { y: 116, h: 58, fill: '#e9dfc7', name: 'B 层 · 接替层', idx: 1 },
        { y: 174, h: 62, fill: '#e3d6b8', name: 'C 层 · 含水层', idx: 2 }
      ];
      bands.forEach(function (b) {
        s += '<rect x="8" y="' + b.y + '" width="' + (W - 16) + '" height="' + b.h + '" fill="' + b.fill + '"/>';
        s += '<text x="14" y="' + (b.y + 12) + '" font-size="8.2" fill="#8a744a">' + b.name + '</text>';
      });
      /* 主井眼 */
      s += '<line x1="34" y1="22" x2="34" y2="236" stroke="#8d979d" stroke-width="6"/>';
      s += '<rect x="26" y="14" width="16" height="8" rx="2" fill="#d4d0c8" stroke="#8d979d"/>';
      s += '<text x="42" y="20" font-size="8" fill="#9ba3a9">井口</text>';
      var ys = [88, 146, 206];
      for (var i = 0; i < 3; i++) {
        var y = ys[i];
        s += '<line x1="34" y1="' + y + '" x2="228" y2="' + y + '" stroke="#8d979d" stroke-width="4"/>';
        /* 滑套：6 个槽，按开度点亮 */
        var u = plan[i];
        for (var k = 0; k < 6; k++) {
          var on = (k + 0.5) / 6 <= u;
          s += '<rect x="' + (98 + k * 7) + '" y="' + (y - 5) + '" width="5" height="10" rx="1" fill="' + (on ? '#3a352d' : '#d4d0c8') + '"/>';
        }
        s += '<rect x="96" y="' + (y - 7) + '" width="44" height="14" rx="3" fill="none" stroke="#5d6470" stroke-width=".8"/>';
        s += '<text x="' + 152 + '" y="' + (y - 8) + '" font-size="9" fill="#3a352d">' + LAYERS[i].short + ' ' + Math.round(u * 100) + '%</text>';
        /* 产油箭头 */
        var oilLen = 6 + point.layerOil[i] * 0.42;
        s += '<line x1="196" y1="' + (y + 2) + '" x2="196" y2="' + (y + 2 - oilLen) + '" stroke="#b26a39" stroke-width="2" marker-end="url(#co4-ar)"/>';
        /* 水相：按层含水率画水滴数 */
        var wc = point.layerOil[i] > 0 ? (point.layerWater[i] / (point.layerOil[i] + point.layerWater[i] + 0.001)) : 0;
        var drops = Math.round(wc * 5);
        for (var d = 0; d < drops; d++) {
          s += '<circle cx="' + (210 + (d % 2) * 7) + '" cy="' + (y + 6 + Math.floor(d / 2) * 7) + '" r="1.9" fill="#a03d4f"/>';
        }
      }
      s += '<defs><marker id="co4-ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#b26a39"/></marker></defs>';
      s += '<text x="' + W / 2 + '" y="' + (H - 16) + '" text-anchor="middle" font-size="8.5" fill="#9ba3a9">第 ' + point.day + ' 天 · AI 开度与分层产液</text>';
      s += '<text x="' + W / 2 + '" y="' + (H - 4) + '" text-anchor="middle" font-size="8" fill="#9ba3a9">棕箭头 = 产油量级，蓝点 = 水相</text>';
      return s + '</svg>';
    }

    /* ---------------- 开度分配 ---------------- */
    function renderOpenChart(plan) {
      var box = $('co4-openchart');
      box.innerHTML = '';
      var W = 640, H = 226, M = { t: 22, r: 18, b: 44, l: 46 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '三层滑套开度对比');
      var cur = [state.ua / 100, state.ub / 100, state.uc / 100];
      var data = LAYERS.map(function (l, i) {
        return { name: l.short, full: l.name, cur: cur[i] * 100, ai: plan[i] * 100, wc0: l.wc0 * 100 };
      });
      var x0 = d3.scaleBand().domain(data.map(function (d) { return d.name; })).range([M.l, W - M.r]).padding(0.36);
      var x1 = d3.scaleBand().domain(['cur', 'ai']).range([0, x0.bandwidth()]).padding(0.22);
      var y = d3.scaleLinear().domain([0, 100]).range([H - M.b, M.t]);
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 9).attr('fill', '#9ba3a9');
        });
      svg.selectAll('.g').data(data).enter().append('g')
        .each(function (d) {
          var g = d3.select(this);
          g.append('rect').attr('x', x0(d.name) + x1('cur')).attr('y', y(d.cur))
            .attr('width', x1.bandwidth()).attr('height', H - M.b - y(d.cur)).attr('rx', 2)
            .attr('fill', '#ddd7c8').attr('opacity', view === 'fixed' ? 1 : 0.4);
          g.append('rect').attr('x', x0(d.name) + x1('ai')).attr('y', y(d.ai))
            .attr('width', x1.bandwidth()).attr('height', H - M.b - y(d.ai)).attr('rx', 2)
            .attr('fill', d.ai >= 99 ? '#3a352d' : (d.ai <= 1 ? '#c9c3b4' : '#5b9b87'))
            .attr('opacity', view === 'ai' ? 1 : 0.4);
          g.append('text').attr('x', x0(d.name) + x1('cur') + x1.bandwidth() / 2).attr('y', y(d.cur) - 5)
            .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#9ba3a9')
            .attr('font-family', 'ui-monospace,monospace').text(Math.round(d.cur) + '%');
          g.append('text').attr('x', x0(d.name) + x1('ai') + x1.bandwidth() / 2).attr('y', y(d.ai) - 5)
            .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#3a352d')
            .attr('font-family', 'ui-monospace,monospace').text(Math.round(d.ai) + '%');
        });
      svg.selectAll('.hover').data(data).enter().append('rect')
        .attr('x', function (d) { return x0(d.name); }).attr('y', M.t)
        .attr('width', x0.bandwidth()).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent')
        .on('mouseenter', function (ev, d) {
          tipShow(d.full + '<br>当前开度 <b>' + Math.round(d.cur) + '%</b> → AI <b>' + Math.round(d.ai) + '%</b><br>初始含水 ' + d.wc0.toFixed(0) + '%', ev);
        })
        .on('mousemove', function (ev, d) {
          tipShow(d.full + '<br>当前开度 <b>' + Math.round(d.cur) + '%</b> → AI <b>' + Math.round(d.ai) + '%</b><br>初始含水 ' + d.wc0.toFixed(0) + '%', ev);
        })
        .on('mouseleave', tipHide);
      svg.selectAll('.xl').data(data).enter().append('text')
        .attr('x', function (d) { return x0(d.name) + x0.bandwidth() / 2; })
        .attr('y', H - M.b + 16).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#4a545d')
        .text(function (d) { return d.name + ' 层'; });
      svg.selectAll('.wc').data(data).enter().append('text')
        .attr('x', function (d) { return x0(d.name) + x0.bandwidth() / 2; })
        .attr('y', H - M.b + 30).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#9ba3a9')
        .text(function (d) { return '含水 ' + d.wc0.toFixed(0) + '%'; });
      $('co4-open-mini').textContent = '第 ' + simDay + ' 天 · ' + (view === 'ai' ? 'AI 动态' : '固定开度') + ' · 网格 21³';
    }

    /* ---------------- 时间序列 ---------------- */
    function lineChart(boxId, series, key, yMax, targetVal, targetLabel, fmt) {
      var box = $(boxId);
      box.innerHTML = '';
      var W = 640, H = 226, M = { t: 20, r: 58, b: 38, l: 48 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', boxId === 'co4-oil' ? '30 天产油曲线' : '30 天含水率曲线');
      var x = d3.scaleLinear().domain([1, DAYS]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([0, yMax]).range([H - M.b, M.t]);
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(6).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end')
        .attr('font-size', 9).attr('fill', '#9ba3a9').text('时间（天）→');
      svg.append('text').attr('x', M.l - 34).attr('y', 12).attr('font-size', 9).attr('fill', '#9ba3a9').text(fmt.unit);

      /* 目标线 */
      if (targetVal != null) {
        svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(targetVal)).attr('y2', y(targetVal))
          .attr('stroke', '#b05a51').attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
        svg.append('text').attr('x', M.l + 4).attr('y', y(targetVal) - 5).attr('text-anchor', 'start')
          .attr('font-size', 8.5).attr('fill', '#b05a51').text(targetLabel);
      }

      var line = d3.line().x(function (p) { return x(p.day); }).y(function (p) { return y(p[key]); });
      var aiOn = view === 'ai', fxOn = view === 'fixed';

      /* 活动曲线下方淡色面积：让 0 起的空白区变成“产量体量”而不是空画布 */
      if (boxId === 'co4-oil') {
        var area = d3.area()
          .x(function (p) { return x(p.day); })
          .y0(H - M.b)
          .y1(function (p) { return y(p[key]); });
        svg.append('path').datum(aiOn ? series.ai : series.manual)
          .attr('d', area).attr('fill', aiOn ? '#3a352d' : '#b26a39').attr('opacity', 0.085);
      }

      svg.append('path').datum(series.manual).attr('d', line).attr('fill', 'none')
        .attr('stroke', '#b26a39').attr('stroke-width', fxOn ? 2.4 : 1.3)
        .attr('opacity', fxOn ? 1 : 0.5)
        .attr('stroke-dasharray', fxOn ? null : '4 3');
      svg.append('path').datum(series.ai).attr('d', line).attr('fill', 'none')
        .attr('stroke', '#3a352d').attr('stroke-width', aiOn ? 2.4 : 1.3)
        .attr('opacity', aiOn ? 1 : 0.5);

      /* 播放头：当前回放日 */
      var px = x(simDay);
      svg.append('line').attr('x1', px).attr('x2', px).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#242a32').attr('stroke-width', 1).attr('stroke-dasharray', '2 2').attr('opacity', 0.38);
      var curM = series.manual[simDay - 1];
      var curA = series.ai[simDay - 1];
      var nearEnd = px > W - M.r - 48;   /* 靠右时把数值标到左侧，避免压住目标线标签 */
      if (curM) {
        svg.append('circle').attr('cx', px).attr('cy', y(curM[key])).attr('r', fxOn ? 3.4 : 2.6)
          .attr('fill', '#b26a39').attr('opacity', fxOn ? 1 : 0.55);
        svg.append('text').attr('x', nearEnd ? px - 6 : px + 5).attr('y', y(curM[key]) + 12)
          .attr('text-anchor', nearEnd ? 'end' : 'start')
          .attr('font-size', 8.5).attr('fill', '#b26a39').attr('opacity', fxOn ? 1 : 0.7).text(fmt.text(curM[key]));
      }
      if (curA) {
        svg.append('circle').attr('cx', px).attr('cy', y(curA[key])).attr('r', aiOn ? 3.6 : 2.6)
          .attr('fill', '#3a352d').attr('stroke', '#fff').attr('stroke-width', 1.2).attr('opacity', aiOn ? 1 : 0.55);
        svg.append('text').attr('x', nearEnd ? px - 6 : px + 5).attr('y', y(curA[key]) + 3)
          .attr('text-anchor', nearEnd ? 'end' : 'start')
          .attr('font-size', 8.5).attr('fill', '#3a352d').attr('opacity', aiOn ? 1 : 0.7).text(fmt.text(curA[key]));
      }

      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var day = Math.round(clamp(x.invert(mx), 1, series.ai.length));
        var a = series.ai[day - 1], m = series.manual[day - 1];
        if (!a || !m) return;
        tipShow('第 <b>' + day + '</b> 天<br>AI：' + fmt.text(a[key]) + '<br>固定：' + fmt.text(m[key]), ev);
      }).on('mouseleave', tipHide);
    }

    /* ---------------- 分层产液堆叠面积 ---------------- */
    function renderStack(sims) {
      var box = $('co4-stack');
      box.innerHTML = '';
      var W = 640, H = 214, M = { t: 16, r: 58, b: 34, l: 46 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '分层产液构成面积图');
      var all = view === 'fixed' ? sims.manual.series : sims.ai.series;
      var rows = all.map(function (p) {
        return {
          day: p.day,
          oA: p.layerOil[0], oB: p.layerOil[1], oC: p.layerOil[2],
          wA: p.layerWater[0], wB: p.layerWater[1], wC: p.layerWater[2],
          total: p.oil + p.water
        };
      });
      var yMax = Math.max(50, Math.ceil(d3.max(rows, function (r) { return r.total; }) / 50) * 50);
      var x = d3.scaleLinear().domain([1, DAYS]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([0, yMax]).range([H - M.b, M.t]);

      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(6).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(4).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('text').attr('x', M.l - 34).attr('y', 12).attr('font-size', 9).attr('fill', '#9ba3a9').text('t/d');

      /* 未来区间：尚未执行 */
      if (simDay < DAYS) {
        svg.append('rect').attr('x', x(simDay)).attr('y', M.t).attr('width', Math.max(0, x(DAYS) - x(simDay)))
          .attr('height', H - M.t - M.b).attr('fill', '#faf8f2');
        svg.append('text').attr('x', x(DAYS) - 4).attr('y', M.t + 12).attr('text-anchor', 'end')
          .attr('font-size', 8.5).attr('fill', '#c0b7a4').text('待执行');
      }

      var bands = [
        { k: 'oA', c: '#3a352d' }, { k: 'oB', c: '#5b9b87' }, { k: 'oC', c: '#9fc4b8' },
        { k: 'wA', c: '#a03d4f' }, { k: 'wB', c: '#7d9dc4' }, { k: 'wC', c: '#c3d3e6' }
      ];
      var shown = rows.slice(0, simDay);
      var lower = shown.map(function () { return 0; });
      bands.forEach(function (b) {
        var upper = shown.map(function (d, i) { return lower[i] + d[b.k]; });
        var area = d3.area()
          .x(function (d) { return x(d.day); })
          .y0(function (d, i) { return y(lower[i]); })
          .y1(function (d, i) { return y(upper[i]); })
          .curve(d3.curveMonotoneX);
        svg.append('path').datum(shown).attr('d', area).attr('fill', b.c).attr('opacity', 0.82);
        lower = upper;
      });

      var cur = shown[shown.length - 1];
      svg.append('line').attr('x1', x(simDay)).attr('x2', x(simDay)).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#242a32').attr('stroke-width', 1).attr('stroke-dasharray', '2 2').attr('opacity', 0.35);
      if (cur) {
        svg.append('circle').attr('cx', x(simDay)).attr('cy', y(cur.total)).attr('r', 3.2)
          .attr('fill', '#fff').attr('stroke', '#242a32').attr('stroke-width', 1.2);
        svg.append('text').attr('x', x(simDay) - 5).attr('y', y(cur.total) - 5).attr('text-anchor', 'end')
          .attr('font-size', 9).attr('fill', '#242a32').attr('font-family', 'ui-monospace,monospace')
          .text(Math.round(cur.total) + ' t/d');
      }

      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var day = Math.round(clamp(x.invert(mx), 1, DAYS));
        var r = rows[day - 1];
        if (!r) return;
        tipShow('第 <b>' + day + '</b> 天 · 总液 ' + r.total.toFixed(1) + ' t/d<br>' +
          '油 A/B/C：' + r.oA.toFixed(1) + ' / ' + r.oB.toFixed(1) + ' / ' + r.oC.toFixed(1) + '<br>' +
          '水 A/B/C：' + r.wA.toFixed(1) + ' / ' + r.wB.toFixed(1) + ' / ' + r.wC.toFixed(1), ev);
      }).on('mouseleave', tipHide);

      $('co4-stack-mini').textContent = '第 ' + simDay + ' 天 · ' + (view === 'ai' ? 'AI' : '固定') +
        ' · 总液 ' + (cur ? Math.round(cur.total) : 0) + ' t/d';
    }

    /* ---------------- 三层流量分配对比 ---------------- */
    function renderSplit(sims) {
      var box = $('co4-split');
      box.innerHTML = '';
      var ma = sims.manual.series[simDay - 1];
      var ai = sims.ai.series[simDay - 1];
      if (!ma || !ai) return;
      var W = 640, H = 214, M = { t: 20, r: 22, b: 44, l: 44 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '固定开度与 AI 动态的三层流量分配对比');
      var data = LAYERS.map(function (l, i) {
        return {
          name: l.short, full: l.name, idx: i,
          mOil: ma.layerOil[i], mWater: ma.layerWater[i], aOil: ai.layerOil[i], aWater: ai.layerWater[i],
          mTotal: ma.layerOil[i] + ma.layerWater[i], aTotal: ai.layerOil[i] + ai.layerWater[i]
        };
      });
      var maxV = d3.max(data, function (d) { return Math.max(d.mTotal, d.aTotal); }) || 1;
      var yMax = Math.max(20, Math.ceil(maxV / 20) * 20);
      var x0 = d3.scaleBand().domain(data.map(function (d) { return d.name; })).range([M.l, W - M.r]).padding(0.34);
      var x1 = d3.scaleBand().domain(['m', 'a']).range([0, x0.bandwidth()]).padding(0.2);
      var y = d3.scaleLinear().domain([0, yMax]).range([H - M.b, M.t]);

      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(4).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });

      data.forEach(function (d) {
        var groups = [
          { k: 'm', oil: d.mOil, water: d.mWater, oc: '#b26a39', wc: '#e2c9b5', label: '固定' },
          { k: 'a', oil: d.aOil, water: d.aWater, oc: '#3a352d', wc: '#9fc4b8', label: 'AI' }
        ];
        groups.forEach(function (g) {
          var xb = x0(d.name) + x1(g.k);
          var yOil = y(g.oil);
          svg.append('rect').attr('x', xb).attr('y', yOil).attr('width', x1.bandwidth())
            .attr('height', Math.max(0, H - M.b - yOil)).attr('rx', 1.5).attr('fill', g.oc)
            .attr('opacity', view === 'fixed' ? (g.k === 'm' ? 1 : 0.45) : (g.k === 'a' ? 1 : 0.45));
          if (g.water > 0.05) {
            var yWat = y(g.oil + g.water);
            svg.append('rect').attr('x', xb).attr('y', yWat).attr('width', x1.bandwidth())
              .attr('height', Math.max(0, yOil - yWat)).attr('rx', 1.5).attr('fill', g.wc)
              .attr('opacity', view === 'fixed' ? (g.k === 'm' ? 0.95 : 0.4) : (g.k === 'a' ? 0.95 : 0.4));
          }
          svg.append('text').attr('x', xb + x1.bandwidth() / 2).attr('y', y(g.oil + g.water) - 4)
            .attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', g.oc)
            .attr('font-family', 'ui-monospace,monospace')
            .text(Math.round(g.oil + g.water));
        });
        svg.append('text').attr('x', x0(d.name) + x0.bandwidth() / 2).attr('y', H - M.b + 15)
          .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#4a545d').text(d.name + ' 层');
        svg.append('text').attr('x', x0(d.name) + x0.bandwidth() / 2).attr('y', H - M.b + 29)
          .attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#9ba3a9')
          .text('含水 ' + ((ai.layerWater[d.idx] / Math.max(d.aTotal, 0.01)) * 100).toFixed(0) + '%');
      });

      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end')
        .attr('font-size', 9).attr('fill', '#9ba3a9').text('第 ' + simDay + ' 天 · t/d');

      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var idx = Math.max(0, Math.min(2, Math.floor((mx - M.l) / (x0.step()))));
        var d = data[idx];
        if (!d) return;
        tipShow('<b>' + d.full + '</b><br>固定：油 ' + d.mOil.toFixed(1) + ' / 水 ' + d.mWater.toFixed(1) + '<br>' +
          'AI：油 ' + d.aOil.toFixed(1) + ' / 水 ' + d.aWater.toFixed(1), ev);
      }).on('mouseleave', tipHide);

      var aTotal = ai.oil + ai.water;
      $('co4-split-mini').textContent = '第 ' + simDay + ' 天 · AI 总液 ' + Math.round(aTotal) + ' t/d';
    }

    /* ---------------- 输出 ---------------- */
    function renderOutput(sims) {
      var vw = viewData(sims);
      var point = vw.point;
      var plan = vw.plan;
      var conf = vw.conf;

      $('co4-k-plan').textContent = Math.round(plan[0] * 100) + '% / ' + Math.round(plan[1] * 100) + '% / ' + Math.round(plan[2] * 100) + '%';
      $('co4-k-oil').innerHTML = point.oil.toFixed(1) + '<small>t/d</small>';
      var wcEl = $('co4-k-wc');
      wcEl.innerHTML = (point.wc * 100).toFixed(1) + '<small>%</small>';
      wcEl.className = point.wc * 100 <= state.wct ? 'ok' : 'bad';
      $('co4-k-cum').innerHTML = Math.round(vw.cumOil) + '<small>t</small>';
      $('co4-k-water').innerHTML = Math.round(vw.cumWater) + '<small>t</small>';
      $('co4-k-hit').innerHTML = vw.hit + '<small> 天</small> · ' + vw.wcOk + '<small> 天</small>';

      /* 风险等级：含水越限幅度 + 月度不达标天数，两项加权 */
      var over = Math.max(0, point.wc * 100 - state.wct) / Math.max(state.wct, 1);
      var badDays = (30 - vw.wcOk) / 30;
      var rScore = Math.min(100, over * 62 + badDays * 38 + (vw.hit < 30 ? 8 : 0));
      var rLv = rScore < 20 ? ['低', 'ok'] : (rScore < 45 ? ['中', 'warn'] : ['高', 'bad']);
      var riskKpi = $('co4-k-risk');
      riskKpi.innerHTML = rLv[0] + '<small> 风险 · ' + rScore.toFixed(0) + ' 分</small>';
      riskKpi.className = rLv[1];

      $('co4-conf-bar').style.width = conf + '%';
      $('co4-conf-bar').className = conf >= 75 ? '' : (conf >= 55 ? 'warn' : 'bad');
      $('co4-conf-txt').textContent = (view === 'ai' ? 'AI 调控 ' + sims.ai.choices + ' 次' : '人工设定 · 不调整') +
        ' · 产油达标 ' + vw.hit + ' 天 · 含水达标 ' + vw.wcOk + ' 天';
      $('co4-out-mini').textContent = '第 ' + simDay + ' 天 · ' + (view === 'ai' ? 'AI 动态' : '固定开度');
      $('co4-fig-mini').textContent = '第 ' + simDay + ' 天 · ' + (view === 'ai' ? 'AI' : '固定');
      $('co4-set-tag').textContent = playing ? '回放中' : '第 ' + simDay + ' 天';

      var note = $('co4-note');
      if (view === 'ai' && !sims.ai.planOk) {
        note.className = 'iq-note red';
        note.innerHTML = '<b>无可行开度组合：</b>本轮枚举的 ' + sims.ai.evaluated + ' 组开度里，没有一组能让三层合计产油达到 ' +
          state.target + ' t/d（液量上限 ' + LIQ_LIMIT + ' t/d 与各层最大产能共同卡住）。下面显示的是“缺口最小”的参考组合，' +
          '不能当作达标方案；建议下调配产目标或先做堵水、提压措施。';
      } else if (view === 'ai' && sims.ai.hit / DAYS < 0.7) {
        note.className = 'iq-note red';
        note.innerHTML = '<b>目标不可达：</b>30 天中仅 ' + sims.ai.hit + ' 天达到 ' + state.target + ' t/d。三层最大产能与液量上限不足以支撑该目标，建议下调目标或提高井口压差。';
      } else if (point.wc * 100 > state.wct) {
        note.className = 'iq-note clay';
        note.innerHTML = '<b>含水超限（' + (view === 'ai' ? 'AI 动态' : '固定开度') + '）：</b>第 ' + simDay + ' 天含水 ' + (point.wc * 100).toFixed(1) + '%，高于目标 ' + state.wct + '%。' +
          (view === 'ai' ? 'AI 已优先开 A/B 层，但 C 层含水上升仍推高整体含水。' : '固定开度不调整，C 层高含水持续挤占液量上限。');
      } else {
        note.className = 'iq-note';
        note.innerHTML = '<b>结论（' + (view === 'ai' ? 'AI 动态' : '固定开度') + '）：</b>第 ' + simDay + ' 天开度为 A ' +
          Math.round(plan[0] * 100) + '%、B ' + Math.round(plan[1] * 100) + '%、C ' + Math.round(plan[2] * 100) +
          '%，日产油 ' + point.oil.toFixed(1) + ' t/d、含水 ' + (point.wc * 100).toFixed(1) + '%。';
      }

      var m30 = sims.manual.series[DAYS - 1], a30 = sims.ai.series[DAYS - 1];
      var dOil = sims.ai.cumOil - sims.manual.cumOil;
      var dWater = sims.ai.cumWater - sims.manual.cumWater;
      $('co4-table').innerHTML =
        '<table class="iq-table">' +
        '<tr><th>30 天指标</th><th>固定开度</th><th>AI 动态</th><th>变化</th></tr>' +
        '<tr><td>累产油</td><td class="num">' + Math.round(sims.manual.cumOil) + ' t</td><td class="num">' + Math.round(sims.ai.cumOil) + ' t</td><td class="num">' + (dOil >= 0 ? '+' : '') + Math.round(dOil) + ' t</td></tr>' +
        '<tr><td>累产水</td><td class="num">' + Math.round(sims.manual.cumWater) + ' t</td><td class="num">' + Math.round(sims.ai.cumWater) + ' t</td><td class="num">' + (dWater >= 0 ? '+' : '') + Math.round(dWater) + ' t</td></tr>' +
        '<tr class="hl"><td>期末含水</td><td class="num">' + (m30.wc * 100).toFixed(1) + '%</td><td class="num">' + (a30.wc * 100).toFixed(1) + '%</td><td class="num">' + ((a30.wc - m30.wc) * 100 >= 0 ? '+' : '') + ((a30.wc - m30.wc) * 100).toFixed(1) + '%</td></tr>' +
        '<tr><td>产油达标天数</td><td class="num">' + sims.manual.hit + ' / 30</td><td class="num">' + sims.ai.hit + ' / 30</td><td class="num">' + (sims.ai.hit - sims.manual.hit >= 0 ? '+' : '') + (sims.ai.hit - sims.manual.hit) + '</td></tr>' +
        '<tr><td>含水达标天数</td><td class="num">' + sims.manual.wcOk + ' / 30</td><td class="num">' + sims.ai.wcOk + ' / 30</td><td class="num">' + (sims.ai.wcOk - sims.manual.wcOk >= 0 ? '+' : '') + (sims.ai.wcOk - sims.manual.wcOk) + '</td></tr>' +
        '</table>' +
        '<p class="iq-poll">固定开度沿用右侧当前三层设定，30 天不调整；AI 每 ' + state.cycle + ' 天按最新含水率重算一次。</p>';

      var curPlan = [state.ua / 100, state.ub / 100, state.uc / 100];
      $('co4-detail').innerHTML =
        '<table class="iq-table">' +
        '<tr><td>A 层开度</td><td class="num">' + Math.round(curPlan[0] * 100) + '%</td></tr>' +
        '<tr><td>B 层开度</td><td class="num">' + Math.round(curPlan[1] * 100) + '%</td></tr>' +
        '<tr><td>C 层开度</td><td class="num">' + Math.round(curPlan[2] * 100) + '%</td></tr>' +
        '<tr><td>井口压力</td><td class="num">' + WHP + ' MPa</td></tr>' +
        '<tr><td>液量上限</td><td class="num">' + LIQ_LIMIT + ' t/d</td></tr>' +
        '</table>' +
        '<p class="iq-poll" style="margin-top:6px">当前设定作为固定开度情景；AI 方案单独计算。</p>';

      var ex = $('co4-explain');
      var aiPlan = sims.ai.series[simDay - 1].plan;
      ex.innerHTML = '<b>为什么要“压 C 层”：</b>C 层含水 ' + (LAYERS[2].wc0 * 100).toFixed(0) + '%，开度增加时产水增长快于产油（指数 1.25 对 0.85），会挤占液量上限。' +
        'AI 第 ' + simDay + ' 天把 C 层定在 ' + Math.round(aiPlan[2] * 100) + '%（人工设定 ' + Math.round(curPlan[2] * 100) + '%），把液量让给 A/B 层。' +
        '<br><b>滚动调控：</b>每 ' + state.cycle + ' 天用最新含水重算，30 天共调控 ' + sims.ai.choices + ' 次；固定开度情景不调整，含水持续上升。' +
        '<br><b>注意：</b>合成数据未包含层间窜流与滑套砂堵，实际执行前需用产液剖面与滑套反馈校准。';
    }

    /* ---------------- 学习层：滑套开度时间轴 ---------------- */
    function renderStrip(sims) {
      var src = view === 'fixed' ? sims.manual : sims.ai;
      var rows = LAYERS.map(function (l, li) {
        var cells = src.series.map(function (p) {
          var v = p.plan[li];
          var alpha = (0.06 + v * 0.86).toFixed(2);
          var edge = p.day === simDay ? ';box-shadow:0 0 0 1.5px #b26a39 inset' : (p.day > simDay ? ';opacity:.4' : '');
          return '<i data-d="' + p.day + '" data-i="' + li + '" data-v="' + v + '" style="background:rgba(58,53,45,' + alpha + ')' + edge + '"></i>';
        }).join('');
        return '<div class="iq-strip-row"><span class="lb">' + l.short + '</span><div class="iq-strip-cells">' + cells + '</div></div>';
      });
      $('co4-strip').innerHTML = rows.join('');
      $('co4-strip-note').innerHTML = '<span>第 1 天</span><span>当前 D' + simDay + ' · 越绿开度越大</span><span>第 30 天</span>';
      $('co4-strip-mini').textContent = (view === 'fixed' ? '固定开度' : 'AI 动态') + ' · 3 层 × 30 天';
    }

    /* ---------------- 学习层：自动控制闭环 ---------------- */
    function renderLoop(sims, vw) {
      var pt = vw.point;
      var wc = pt.wc * 100;
      var okWc = wc <= state.wct;
      var plan = vw.plan;
      var choices = view === 'ai' ? sims.ai.choices : 0;
      var nodes = [
        { x: 26, y: 16, t: '① 监测', a: '第 ' + simDay + ' 天产油 ' + pt.oil.toFixed(1) + ' t/d', b: '含水 ' + wc.toFixed(1) + '%', c: '#a03d4f' },
        { x: 384, y: 16, t: '② 判断', a: '含水目标 ≤ ' + state.wct + '%', b: okWc ? '当前达标，维持开度' : '当前超限，压 C 层', c: (okWc ? '#3a352d' : '#b05a51') },
        { x: 384, y: 148, t: '③ 控制', a: '开度 A ' + Math.round(plan[0] * 100) + '% · B ' + Math.round(plan[1] * 100) + '%', b: 'C 层 ' + Math.round(plan[2] * 100) + '% · 下发井下', c: '#3a352d' },
        { x: 26, y: 148, t: '④ 反馈', a: '产油达标 ' + vw.hit + ' 天 / 30', b: '含水达标 ' + vw.wcOk + ' 天 / 30', c: '#a9852f' }
      ];
      var s = '<svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="滑套自动控制闭环：监测、判断、控制、反馈">';
      s += '<rect width="640" height="240" fill="#fff"/>';
      s += '<defs><marker id="co4-l-ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#8d979d"/></marker></defs>';
      nodes.forEach(function (n) {
        s += '<rect x="' + n.x + '" y="' + n.y + '" width="230" height="76" rx="7" fill="#fff" stroke="' + n.c + '" stroke-width="1.1" stroke-opacity=".55"/>';
        s += '<text x="' + (n.x + 12) + '" y="' + (n.y + 21) + '" font-size="10.5" font-weight="650" fill="#2b3338">' + n.t + '</text>';
        s += '<text x="' + (n.x + 12) + '" y="' + (n.y + 40) + '" font-size="9.5" fill="#4a545d">' + n.a + '</text>';
        s += '<text x="' + (n.x + 12) + '" y="' + (n.y + 57) + '" font-size="9.5" fill="' + (n.t === '② 判断' && !okWc ? '#a85249' : '#4a545d') + '">' + n.b + '</text>';
      });
      s += '<line x1="256" y1="54" x2="384" y2="54" stroke="#8d979d" stroke-width="1.3" marker-end="url(#co4-l-ar)"/>';
      s += '<text x="320" y="47" text-anchor="middle" font-size="8" fill="#9ba3a9">监测数据</text>';
      s += '<line x1="499" y1="92" x2="499" y2="148" stroke="#8d979d" stroke-width="1.3" marker-end="url(#co4-l-ar)"/>';
      s += '<text x="506" y="124" font-size="8" fill="#9ba3a9">决策</text>';
      s += '<line x1="384" y1="186" x2="256" y2="186" stroke="#8d979d" stroke-width="1.3" marker-end="url(#co4-l-ar)"/>';
      s += '<text x="320" y="179" text-anchor="middle" font-size="8" fill="#9ba3a9">控制指令</text>';
      s += '<line x1="141" y1="148" x2="141" y2="92" stroke="#8d979d" stroke-width="1.3" marker-end="url(#co4-l-ar)"/>';
      s += '<text x="148" y="124" font-size="8" fill="#9ba3a9">反馈</text>';
      s += '<text x="320" y="124" text-anchor="middle" font-size="8.5" fill="#9ba3a9">每 ' + state.cycle + ' 天循环 · 已调控 ' + choices + ' 次</text>';
      s += '<text x="320" y="137" text-anchor="middle" font-size="8" fill="#9ba3a9">' + (view === 'fixed' ? '固定开度：不循环' : 'AI 动态：自动循环') + '</text>';
      $('co4-loop').innerHTML = s + '</svg>';
      $('co4-loop-mini').textContent = view === 'fixed' ? '固定开度 · 不调整' : 'AI · ' + choices + ' 次调控';
    }

    /* 智能方法说明：数值来自本轮分层产能模型与滚动优化结果 */
    function renderSmart(sims, vw) {
      if (!window.IQSmart || !smartBox) return;
      var m30 = sims.manual.series[DAYS - 1], a30 = sims.ai.series[DAYS - 1];
      var aiPlan = vw.plan;
      function delta(a, b, unit, lowerBetter) {
        var d = b - a;
        var good = lowerBetter ? d <= 0 : d >= 0;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(1) + (unit || ''), cls: good ? 'ok' : 'bad' };
      }
      var rows = [
        { cells: ['滑套开度 A/B/C', Math.round(state.ua) + '% / ' + Math.round(state.ub) + '% / ' + Math.round(state.uc) + '%',
          Math.round(aiPlan[0] * 100) + '% / ' + Math.round(aiPlan[1] * 100) + '% / ' + Math.round(aiPlan[2] * 100) + '%', '—', '第 ' + simDay + ' 天'] },
        { cells: ['30 天累产油 (t)', Math.round(sims.manual.cumOil), Math.round(sims.ai.cumOil), delta(sims.manual.cumOil, sims.ai.cumOil, '', false), '—'] },
        { cells: ['30 天累产水 (t)', Math.round(sims.manual.cumWater), Math.round(sims.ai.cumWater), delta(sims.manual.cumWater, sims.ai.cumWater, '', true), '越低越好'] },
        { cells: ['期末含水 (%)', (m30.wc * 100).toFixed(1), (a30.wc * 100).toFixed(1), delta(m30.wc * 100, a30.wc * 100, '%', true), { v: '目标 ≤ ' + state.wct + '%', cls: a30.wc * 100 <= state.wct ? 'ok' : 'bad' }] },
        { cells: ['产油达标天数', sims.manual.hit + ' / 30', sims.ai.hit + ' / 30', { v: (sims.ai.hit - sims.manual.hit >= 0 ? '+' : '') + (sims.ai.hit - sims.manual.hit), cls: sims.ai.hit >= sims.manual.hit ? 'ok' : 'bad' }, '目标 ' + state.target + ' t/d'] },
        { cells: ['调控次数', '0 次（不调整）', sims.ai.choices + ' 次', '—', '每 ' + state.cycle + ' 天重算'], hl: true }
      ];
      smartBox.innerHTML = window.IQSmart.render({
        kicker: 'SMART METHOD · CONSTRAINED CONTROL',
        title: '分层产能模型 + 带约束滚动优化',
        subtitle: '每 ' + state.cycle + ' 天用最新含水与压力重算三层滑套开度',
        badge: '枚举 ' + (sims.ai.evaluated || Math.pow(21, 3)) + ' 组开度',
        /* 主视觉：开度组合的「产油—含水」散点。用当前第 N 天的分层含水，
           对 6×6×6 组开度抽样重算，绿=达到产油目标，圈=当前 AI 开度。 */
        algoSvg: window.IQAlgo ? (function () {
          var p0 = sims.ai.series[Math.min(simDay, sims.ai.series.length) - 1];
          var wcs = [0, 1, 2].map(function (i) {
            var o = p0.layerOil[i], w = p0.layerWater[i];
            return w / Math.max(o + w, 1e-6);
          });
          var pts = [];
          for (var a = 0; a <= 20; a += 2) {
            for (var b = 0; b <= 20; b += 2) {
              for (var c = 0; c <= 20; c += 2) {
                var r = rates([a / 20, b / 20, c / 20], wcs, pf());
                pts.push({ x: r.oilT, y: r.wc * 100, ok: r.oilT >= state.target * 0.985 });
              }
            }
          }
          var cur = rates(aiPlan, wcs, pf());
          return window.IQAlgo.scatter({
            points: pts,
            xLabel: '三层合计产油 (t/d) →',
            yLabel: '含水率 %',
            yLine: state.wct,
            yLineLabel: '含水上限 ' + state.wct + '%',
            pick: { x: cur.oilT, y: cur.wc * 100 },
            pickLabel: '当前开度 ' + Math.round(aiPlan[0] * 100) + '/' + Math.round(aiPlan[1] * 100) + '/' + Math.round(aiPlan[2] * 100),
            yDig: 0
          });
        })() : '',
        algoCap: '<span><i style="background:rgba(53,120,90,.55)"></i>达到产油目标的组合</span>' +
          '<span><i style="background:rgba(168,82,73,.45)"></i>产油不达标的组合</span>' +
          '<span>每个点 = 一组三层开度的真实产液计算结果；右侧是"多产油"，下方是"少产水"</span>',
        input: '三层最大产能、初始含水、目标产油、含水上限、调控周期',
        output: '各层滑套开度序列、30 天产油/产水、达标天数与调控次数',
        problem: '固定开度无法应对含水上升；层间干扰使“局部最优”不等于全井最优',
        fit: '分层产能模型可快速枚举开度组合，带约束优化在产油目标下最小化产水，并支持滚动重算',
        flow: ['分层产能 / 含水', '枚举 21³ 组开度', '产油目标 + 含水约束', '滚动重算', '滑套开度序列', '现场调控复核'],
        trace: [
          ['每轮枚举', (sims.ai.evaluated || Math.pow(21, 3)) + ' 组'],
          ['达标组合', sims.ai.feas + ' 组'],
          ['调控轮次', sims.ai.choices + ' 次'],
          ['产油达标', sims.ai.hit + ' / ' + DAYS + ' 天'],
          ['期末含水', (a30.wc * 100).toFixed(1) + '%']
        ],
        compare: {
          title: '固定开度（经验） vs AI 动态调控',
          columns: ['指标', '固定开度', 'AI 动态', '变化', '约束 / 说明'],
          rows: rows,
          note: '固定开度沿用右侧当前设定、30 天不调整；AI 每 ' + state.cycle + ' 天按最新含水重算一次。'
        },
        why: [
          '模型里产油随开度按 0.85 次方增长，产水按 1.25 次方增长，且高含水层的水油比更大；因此把 C 层压小、把液量让给 A/B 层能同时保住产油并少产水。',
          '每个调控周期枚举 21³ = ' + Math.pow(21, 3) + ' 组开度组合，先满足产油目标，再在可行解中最小化产水，避免“只看单层”的局部最优。',
          '滚动重算使用最新含水率：含水上升后模型会自动收窄高含水层开度，而不是一套开度用满 30 天。'
        ],
        bounds: [
          '本示范使用合成的三层产能与含水模型，未用真实分层测试、产液剖面或数值模拟结果标定。',
          '模型未考虑层间窜流、滑套摩阻、井筒压降与设备动作寿命，开度序列不能直接下发现场。',
          '目标产油与含水上限需由工程师结合配产计划、堵水措施与井口条件确认；调控策略必须现场复核。'
        ]
      });
    }

    /* ---------------- 渲染 ---------------- */
    function renderAll() {
      var sims = getSims();
      var vw = viewData(sims);
      var point = vw.point;
      var aiSeries = sims.ai.series.slice(0, simDay);
      var manualSeries = sims.manual.series.slice(0, simDay);
      $('co4-figure').innerHTML = figureSvg(point.plan, point);
      renderOpenChart(point.plan);
      var oilMax = Math.max(state.target * 1.25, 100);
      lineChart('co4-oil', { manual: manualSeries, ai: aiSeries }, 'oil', oilMax, state.target, '目标 ' + state.target, {
        unit: '产油 t/d', text: function (v) { return v.toFixed(0); }
      });
      lineChart('co4-wc', { manual: manualSeries, ai: aiSeries }, 'wcPct', 80, state.wct, '目标 ' + state.wct + '%', {
        unit: '含水 %', text: function (v) { return v.toFixed(0) + '%'; }
      });
      renderStack(sims);
      renderSplit(sims);
      renderSmart(sims, vw);
      renderOutput(sims);
      renderStrip(sims);
      renderLoop(sims, vw);
      $('co4-oil-mini').textContent = '目标 ' + state.target + ' t/d';
      $('co4-wc-mini').textContent = '目标 ≤ ' + state.wct + '%';

      $('co4-time-mini').textContent = '第 ' + simDay + ' 天 · ' + (playing ? '播放中' : (simDay >= DAYS ? '已完成' : '已暂停'));
      $('co4-day').textContent = 'D' + simDay;
      var tl = $('co4-timeline');
      if (tl && Number(tl.value) !== simDay) tl.value = simDay;
      var tn = $('co4-time-note');
      var pct = [0, 1, 2].map(function (i) { return Math.round(point.plan[i] * 100) + '%'; });
      if (view === 'ai') {
        tn.innerHTML = '<b>AI 动态：</b>每 ' + state.cycle + ' 天按最新含水重算；第 ' + simDay + ' 天 A/B/C = ' +
          pct.join(' / ') + '，日产油 ' + point.oil.toFixed(1) + ' t/d。';
      } else {
        tn.innerHTML = '<b>固定开度：</b>沿用右侧当前设定、30 天不调整；第 ' + simDay + ' 天日产油 ' +
          point.oil.toFixed(1) + ' t/d、含水 ' + (point.wc * 100).toFixed(1) + '%。';
      }
    }

    function readState() {
      state.ua = Number($('co4-ua').value);
      state.ub = Number($('co4-ub').value);
      state.uc = Number($('co4-uc').value);
      state.target = Number($('co4-target').value);
      state.wct = Number($('co4-wct').value);
      state.cycle = Number($('co4-cycle').value);
      $('co4-o-ua').textContent = state.ua + '%';
      $('co4-o-ub').textContent = state.ub + '%';
      $('co4-o-uc').textContent = state.uc + '%';
      $('co4-o-target').textContent = state.target + ' t/d';
      $('co4-o-wct').textContent = state.wct + '%';
      $('co4-o-cycle').textContent = state.cycle + ' 天';
      cache.key = '';
    }

    function syncPlayBtns() {
      var b1 = $('co4-play'), b2 = $('co4-tplay');
      if (b1) b1.textContent = playing ? '暂停' : '30 天动画';
      if (b2) b2.textContent = playing ? '❚❚ 暂停' : '▶ 播放';
    }

    function stopAnim() {
      if (timer) { window.clearInterval(timer); timer = null; }
      playing = false;
      syncPlayBtns();
    }

    function setDay(d) {
      simDay = clamp(Math.round(d), 1, DAYS);
      renderAll();
    }

    function startAnim() {
      if (playing) { stopAnim(); renderAll(); return; }
      if (simDay >= DAYS) simDay = 1;
      playing = true;
      syncPlayBtns();
      renderAll();
      timer = window.setInterval(function () {
        if (simDay >= DAYS) { stopAnim(); renderAll(); return; }
        simDay++;
        if (simDay >= DAYS) { simDay = DAYS; stopAnim(); renderAll(); return; }
        renderAll();
      }, 150);
    }

    /* ---------------- 事件 ---------------- */
    ['co4-ua', 'co4-ub', 'co4-uc', 'co4-target', 'co4-wct', 'co4-cycle'].forEach(function (id) {
      listen($(id), 'input', function () {
        stopAnim();
        simDay = DAYS;
        readState();
        renderAll();
      });
    });
    listen($('co4-play'), 'click', startAnim);
    listen($('co4-tplay'), 'click', startAnim);
    listen($('co4-step'), 'click', function () {
      stopAnim();
      setDay(simDay >= DAYS ? 1 : simDay + 1);
    });
    listen($('co4-timeline'), 'input', function (ev) {
      stopAnim();
      setDay(Number(ev.target.value));
    });
    listen($('co4-view'), 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-view]') : null;
      if (!btn) return;
      stopAnim();
      view = btn.getAttribute('data-view');
      var btns = $('co4-view').querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].getAttribute('data-view') === view ? 'on' : '';
      }
      renderAll();
    });
    listen($('co4-reset'), 'click', function () {
      stopAnim();
      state.ua = DEFAULTS.ua; state.ub = DEFAULTS.ub; state.uc = DEFAULTS.uc;
      state.target = DEFAULTS.target; state.wct = DEFAULTS.wct; state.cycle = DEFAULTS.cycle;
      $('co4-ua').value = state.ua; $('co4-ub').value = state.ub; $('co4-uc').value = state.uc;
      $('co4-target').value = state.target; $('co4-wct').value = state.wct; $('co4-cycle').value = state.cycle;
      simDay = DAYS;
      readState(); renderAll();
    });
    listen($('co4-ai'), 'click', function () {
      stopAnim();
      var opt = optimizeOpen(LAYERS.map(function (l) { return l.wc0; }), state);
      state.ua = Math.round(opt.plan[0] * 100);
      state.ub = Math.round(opt.plan[1] * 100);
      state.uc = Math.round(opt.plan[2] * 100);
      $('co4-ua').value = state.ua; $('co4-ub').value = state.ub; $('co4-uc').value = state.uc;
      simDay = DAYS;
      readState(); renderAll();
    });

    listen($('co4-strip'), 'mouseover', function (ev) {
      var c = ev.target && ev.target.closest ? ev.target.closest('i') : null;
      if (!c) return;
      var d = Number(c.getAttribute('data-d')), li = Number(c.getAttribute('data-i')), v = Number(c.getAttribute('data-v'));
      tipShow('<b>第 ' + d + ' 天 · ' + LAYERS[li].name + '</b><br>滑套开度 ' + Math.round(v * 100) + '%', ev);
    });
    listen($('co4-strip'), 'mouseleave', tipHide);

    readState();
    renderAll();

    return {
      unmount: function () {
        stopAnim();
        cleanups.forEach(function (fn) { try { fn(); } catch (e) { } });
        cleanups.length = 0;
        tipHide();
        root.innerHTML = '';
      }
    };
  }

  window.__IQ_DEMOS__ = window.__IQ_DEMOS__ || {};
  window.__IQ_DEMOS__[KEY] = boot;
  if (window.__IQ_STANDALONE__ && document.getElementById('app')) boot(document.getElementById('app'));
})();
