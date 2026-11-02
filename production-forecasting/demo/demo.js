/* =========================================================
   pr2 产量智能预测 · 交互示范
   ---------------------------------------------------------
   指数递减 + 注水支撑 + 含水耦合 + 残差区间
   历史/预测曲线与置信区间、情景累产对比、影响因素排序
   本示范使用合成数据，仅用于展示方法流程。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'production-forecasting';

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

    var HIST = 120;
    var LIQ_LIMIT = 320;
    var DEFAULTS = { inj: 300, choke: 9, wc0: 35, decl: 3.2, horizon: 90, wcLimit: 55 };
    var state = { inj: DEFAULTS.inj, choke: DEFAULTS.choke, wc0: DEFAULTS.wc0, decl: DEFAULTS.decl, horizon: DEFAULTS.horizon, wcLimit: DEFAULTS.wcLimit };
    var SCEN = { cons: 0.93, base: 1, opt: 1.07 };
    var SCEN_LABEL = { cons: '保守', base: '基准', opt: '积极' };
    var scen = 'base';
    var shown = DEFAULTS.horizon;
    var playing = false;
    var timer = null;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* ---------------- 预测模型 ---------------- */
    /* 历史段固定使用基准生产制度，避免调参时“历史”跟着重算 */
    var BASELINE = { inj: 300, choke: 9, wc0: 35, decl: 3.2 };
    var BASE_Q0 = (34 + 1.4 * (BASELINE.choke - 6));

    function chokeRatio(choke) {
      return (34 + 1.4 * (choke - 6)) / (34 + 1.4 * (BASELINE.choke - 6));
    }
    function declineOf(st, inj) {
      return clamp(st.decl / 100 / 30 * (1 - 0.30 * Math.log(inj / 300)), 0.00015, 0.006);
    }
    function wcAt(day, st, inj, choke) {
      /* 放大油嘴提高压差，也会加快含水上升 */
      var chokeLift = 0.0011 * (choke - BASELINE.choke) * Math.max(day, 0) / 30;
      return clamp(st.wc0 / 100 + 0.00085 * day * (1 + inj / 500) + chokeLift, 0, 0.92);
    }

    function forecast(st, inj, choke, horizon) {
      /* 预测从今天的实测产量起步，换油嘴只改变初期产能倍数 */
      var q0 = BASE_Q0 * chokeRatio(choke) * (SCEN[scen] || 1);
      var d = declineOf(st, inj);
      var arr = [], cumOil = 0, cumWater = 0;
      for (var day = 1; day <= horizon; day++) {
        var wc = wcAt(day, st, inj, choke);
        var potential = q0 * Math.exp(-d * day);
        var oil = Math.min(potential, LIQ_LIMIT * (1 - wc));
        var liquid = oil / Math.max(1 - wc, 0.08);
        var water = liquid - oil;
        cumOil += oil;
        cumWater += water;
        arr.push({ day: day, oil: oil, water: water, wc: wc, liquid: liquid, potential: potential });
      }
      var last = arr[arr.length - 1];
      return { series: arr, q0: q0, cumOil: cumOil, cumWater: cumWater, end: last, maxWc: last ? last.wc : 0 };
    }

    function history() {
      /* 历史 120 天是固定观测数据，不随右侧情景参数变化 */
      var q0 = BASE_Q0;
      var d = declineOf(BASELINE, BASELINE.inj);
      var arr = [];
      for (var age = HIST; age >= 1; age--) {
        var noise = 1 + 0.032 * Math.sin(age * 0.55) + 0.017 * Math.cos(age * 1.7);
        var oil = q0 * Math.exp(d * age) * noise;
        var wc = wcAt(-age, BASELINE, BASELINE.inj, BASELINE.choke);
        arr.push({ day: -age, oil: oil, wc: wc, liquid: oil / Math.max(1 - wc, 0.08) });
      }
      arr.push({ day: 0, oil: q0, wc: BASELINE.wc0 / 100, liquid: q0 / Math.max(1 - BASELINE.wc0 / 100, 0.08) });
      return arr;
    }

    function optimize(st) {
      var best = null, nEval = 0, nFeas = 0, all = [];
      for (var inj = 200; inj <= 600; inj += 25) {
        for (var choke = 6; choke <= 14 + 0.001; choke += 0.5) {
          var f = forecast(st, inj, choke, st.horizon);
          var feasible = f.maxWc * 100 <= st.wcLimit;
          var score = feasible ? f.cumOil : f.cumOil - (f.maxWc * 100 - st.wcLimit) * 40;
          nEval++;
          if (feasible) nFeas++;
          all.push({ x: f.cumOil, y: f.maxWc * 100, ok: feasible });
          if (!best || score > best.score) {
            best = { inj: inj, choke: choke, f: f, score: score, feasible: feasible };
          }
        }
      }
      best.evaluated = nEval;
      best.feasibleCount = nFeas;
      best.all = all;
      return best;
    }

    /* 历史拟合优度：用与预测同一套趋势（q0·e^(-d·day)）去解释 120 天观测，
       残差算出来的 R² 才能代表“这条趋势能不能解释历史”，不能写死。 */
    function fitR2() {
      var obs = history(), q0 = BASE_Q0, d = declineOf(BASELINE, BASELINE.inj);
      var n = obs.length, mean = 0, ssRes = 0, ssTot = 0;
      obs.forEach(function (p) { mean += p.oil; });
      mean /= Math.max(n, 1);
      obs.forEach(function (p) {
        var fit = q0 * Math.exp(-d * p.day);
        ssRes += Math.pow(p.oil - fit, 2);
        ssTot += Math.pow(p.oil - mean, 2);
      });
      return clamp(1 - ssRes / Math.max(ssTot, 1e-6), 0, 1);
    }

    /* 95% 区间：随预测天数按 sqrt 展宽，越远越不确定。
       系数按公开的递减曲线复盘结果标定：只有 12 个月历史时，外推结果可能落在
       真值的 0.53—2.13 倍之间；本示范只有 120 天历史，90 天末区间取 ±17% 并不保守。 */
    function bandAt(day, st) {
      var frac = clamp(day / Math.max(st.horizon, 1), 0, 1);
      return 3.05 * (0.035 + 0.020 * Math.sqrt(frac));
    }
    function bandPct(st) {
      return bandAt(st.horizon, st);
    }

    function confidenceOf(cur, st) {
      var c = 88 - st.horizon / 180 * 16;
      c -= Math.max(0, cur.maxWc * 100 - st.wcLimit) * 0.9;
      c -= Math.abs(st.inj - 300) / 300 * 4;
      return clamp(Math.round(c), 38, 93);
    }

    function cumulativeAt(series, day) {
      var sum = 0;
      for (var i = 0; i < series.length && series[i].day <= day; i++) sum += series[i].oil;
      return sum;
    }

    function factorsOf(st, base) {
      var list = [
        { key: 'inj', name: '注水量', desc: '注水 +10%：压力支撑增强、递减变缓，但含水上升加快' },
        { key: 'choke', name: '工作制度（油嘴）', desc: '油嘴 +10%：初期产能提高，液量与含水同步上升' },
        { key: 'wc0', name: '初始含水率', desc: '初始含水 +10%：液量上限更早压制产油' },
        { key: 'decl', name: '递减率', desc: '递减率 +10%：累产按指数下降' }
      ];
      return list.map(function (f) {
        var inj = st.inj, choke = st.choke, wc0 = st.wc0, decl = st.decl;
        if (f.key === 'inj') inj *= 1.1;
        if (f.key === 'choke') choke *= 1.1;
        if (f.key === 'wc0') wc0 *= 1.1;
        if (f.key === 'decl') decl *= 1.1;
        var s2 = { inj: inj, choke: choke, wc0: wc0, decl: decl, horizon: st.horizon, wcLimit: st.wcLimit };
        var f2 = forecast(s2, inj, choke, st.horizon);
        var delta = base.cumOil ? (f2.cumOil - base.cumOil) / base.cumOil * 100 : 0;
        return { name: f.name, desc: f.desc, delta: delta, cum: f2.cumOil };
      }).sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
    }

    /* ---------------- 骨架 ---------------- */
    root.innerHTML =
      '<div class="iq-head">' +
        '<div><span class="iq-kicker">SCENE pr2 · 采油</span>' +
          '<h3>产量智能预测：给配产一条曲线，也给它一个区间</h3>' +
          '</div>' +
        '<div class="iq-tags"><span class="iq-tag jade">指数递减</span><span class="iq-tag">置信区间</span><span class="iq-tag blue">情景分析</span><span class="iq-tag clay">因素排序</span></div>' +
      '</div>' +
      '<div class="iq-grid">' +
        '<div class="iq-figure">' +
          '<div class="iq-card"><div class="iq-card-h"><h4><i class="iq-dot"></i>注采井组</h4><span class="iq-mini">合成示例</span></div><div id="pr2-figure"></div>' +
            '<div class="iq-legend"><span><i style="background:#a03d4f"></i>注入水</span><span><i style="background:#b26a39"></i>产出液</span><span><i style="background:#3a352d"></i>预测</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>当前生产设置</h4><span class="iq-mini" id="pr2-set-tag">—</span></div><div id="pr2-detail"></div></div>' +
        '</div>' +
        '<div class="iq-main">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>历史与预测 · 日产油与含水率</h4><span class="iq-mini" id="pr2-fc-mini">—</span></div><div id="pr2-forecast"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#9ba3a9"></i>历史产量</span><span><i class="line" style="background:#3a352d"></i>预测产量</span><span><i style="background:#f8f1e8"></i>95% 区间</span><span><i class="line" style="background:#c58b62"></i>含水率</span><span><i class="line" style="background:#b05a51"></i>含水上限</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>情景对比 · 累产油</h4><span class="iq-mini">当前制度 vs AI 推荐</span></div><div id="pr2-scenario"></div><div class="iq-legend" id="pr2-scenario-legend"></div>' +
            '<div class="iq-note slim" id="pr2-scen-sum">—</div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>影响因素排序</h4><span class="iq-mini">各项 +10% 对 ' + state.horizon + ' 天累产的影响</span></div><div id="pr2-factors"></div>' +
            '<p class="iq-poll" style="margin-top:4px">正值表示提高累产，负值表示降低累产；条形长度 = 影响幅度。</p></div>' +
        '</div>' +
        '<div class="iq-side">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>输入参数</h4><span class="iq-mini">6 项</span></div>' +
            '<div class="iq-mode">' +
              '<div class="iq-mode-k">情景假设 <span class="iq-mini">预测起点的产量修正</span></div>' +
              '<div class="iq-seg" id="pr2-scen">' +
                '<button type="button" data-scen="cons" title="预测起点 ×0.93，偏向保守">保守</button>' +
                '<button type="button" data-scen="base" class="on" title="按历史拟合直接外推">基准</button>' +
                '<button type="button" data-scen="opt" title="预测起点 ×1.07，偏向积极">积极</button>' +
              '</div>' +
              '<div class="iq-note slim" id="pr2-scen-note">基准情景：按历史拟合趋势直接外推。</div>' +
            '</div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>日注水量</span><output id="pr2-o-inj">300 m³/d</output></div><input type="range" id="pr2-inj" min="200" max="600" step="25" value="300"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>工作制度 · 油嘴</span><output id="pr2-o-choke">9.0 mm</output></div><input type="range" id="pr2-choke" min="6" max="14" step="0.5" value="9"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>当前含水率</span><output id="pr2-o-wc0">35%</output></div><input type="range" id="pr2-wc0" min="20" max="60" step="1" value="35"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>月递减率</span><output id="pr2-o-decl">3.2%</output></div><input type="range" id="pr2-decl" min="0.5" max="6" step="0.1" value="3.2"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>预测周期</span><output id="pr2-o-horizon">90 天</output></div>' +
              '<div class="iq-quick"><div class="iq-seg" id="pr2-quick">' +
                '<button type="button" data-h="7">7 天</button>' +
                '<button type="button" data-h="15">15 天</button>' +
                '<button type="button" data-h="30">30 天</button>' +
                '<button type="button" data-h="90" class="on">90 天</button>' +
              '</div></div>' +
              '<input type="range" id="pr2-horizon" min="7" max="180" step="1" value="90">' +
            '</div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>含水率上限</span><output id="pr2-o-limit">55%</output></div><input type="range" id="pr2-limit" min="40" max="70" step="1" value="55"></div>' +
            '<div class="iq-btns"><button class="iq-btn" id="pr2-reset">重置</button><button class="iq-btn" id="pr2-play">播放预测</button><button class="iq-btn primary" id="pr2-ai">采用 AI 制度</button></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>AI 预测输出</h4><span class="iq-mini" id="pr2-out-mini">—</span></div>' +
            '<div class="iq-kpis">' +
              '<div class="iq-kpi wide"><span>推荐注水量 / 油嘴</span><b class="hero" id="pr2-k-plan">—</b></div>' +
              '<div class="iq-kpi"><span id="pr2-k-cum-label">90 天累产油</span><b id="pr2-k-cum">—</b></div>' +
              '<div class="iq-kpi"><span>期末日产油</span><b id="pr2-k-end">—</b></div>' +
              '<div class="iq-kpi"><span>期末含水率</span><b id="pr2-k-wc">—</b></div>' +
              '<div class="iq-kpi"><span>较当前累产</span><b id="pr2-k-gain">—</b></div>' +
              '<div class="iq-kpi"><span>预测区间</span><b id="pr2-k-band">—</b></div>' +
              '<div class="iq-kpi"><span>含水风险</span><b id="pr2-k-risk">—</b></div>' +
            '</div>' +
            '<div class="iq-meter"><i id="pr2-conf-bar" style="width:0%"></i></div>' +
            '<div class="iq-meter-row"><span>预测置信度</span><span id="pr2-conf-txt">—</span></div>' +
            '<div class="iq-note" id="pr2-note">—</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-bottom">' +
        '<div class="iq-card"><div class="iq-card-h"><h4>当前制度 vs AI 推荐制度</h4><span class="iq-mini">同一储层与历史</span></div><div id="pr2-table"></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>结果解释与流程</h4><span class="iq-mini">可复核</span></div><div class="iq-note blue" id="pr2-explain">—</div>' +
          '<div class="iq-flow" style="margin-top:8px"><span>生产历史</span><em>→</em><span>趋势拟合</span><em>→</em><span>响应叠加</span><em>→</em><span>区间预测</span><em>→</em><span>配产复核</span></div>' +
          '<div class="iq-poll">本示范使用合成数据，用于展示智能方法和可视化流程，不代表真实生产结果。</div>' +
        '</div>' +
      '</div>';

    /* 智能方法说明卡：插在头部下方，数值随参数实时重算 */
    var smartBox = document.createElement('div');
    smartBox.id = 'pr2-smart';
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

    /* ---------------- 注采示意 ---------------- */
    function figureSvg() {
      var W = 260, H = 312;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="注采井组与驱替示意">';
      s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
      s += '<rect x="8" y="58" width="' + (W - 16) + '" height="196" fill="#efe9dc"/>';
      s += '<rect x="8" y="58" width="' + (W - 16) + '" height="34" fill="#e8dfc9"/>';
      s += '<text x="14" y="54" font-size="8.5" fill="#9ba3a9">地面</text>';
      s += '<text x="14" y="80" font-size="8.5" fill="#8a744a">储层</text>';
      s += '<text x="14" y="252" font-size="8.5" fill="#9ba3a9">底水 / 隔层</text>';
      /* 井 */
      var xs = [56, 130, 204];
      s += '<g stroke="#8d979d" stroke-width="5">';
      xs.forEach(function (x) { s += '<line x1="' + x + '" y1="22" x2="' + x + '" y2="238"/>'; });
      s += '</g>';
      s += '<rect x="46" y="30" width="12" height="6" rx="1" fill="#d4d0c8"/>';
      s += '<rect x="120" y="30" width="12" height="6" rx="1" fill="#d4d0c8"/>';
      s += '<rect x="194" y="30" width="12" height="6" rx="1" fill="#d4d0c8"/>';
      s += '<text x="56" y="16" text-anchor="middle" font-size="8.5" fill="#a03d4f">注水井</text>';
      s += '<text x="130" y="16" text-anchor="middle" font-size="8.5" fill="#b26a39">采油井</text>';
      s += '<text x="204" y="16" text-anchor="middle" font-size="8.5" fill="#b26a39">采油井</text>';
      /* 注水层段 */
      var y;
      for (y = 96; y <= 150; y += 12) {
        s += '<circle cx="52" cy="' + y + '" r="2.2" fill="#a03d4f"/><circle cx="60" cy="' + y + '" r="2.2" fill="#a03d4f"/>';
      }
      /* 驱替前缘 */
      s += '<path d="M68 170 C90 150 104 138 126 132 C148 138 168 150 194 168" fill="none" stroke="#a03d4f" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += '<path d="M68 192 C94 172 108 162 130 158 C152 162 174 176 198 194" fill="none" stroke="#a03d4f" stroke-width="1.2" stroke-dasharray="4 3" opacity=".65"/>';
      s += '<text x="132" y="126" text-anchor="middle" font-size="8" fill="#a03d4f">注水前缘</text>';
      /* 采油箭头 */
      [130, 204].forEach(function (x, i) {
        s += '<line x1="' + x + '" y1="' + (178 + i * 6) + '" x2="' + x + '" y2="' + (158 + i * 6) + '" stroke="#b26a39" stroke-width="1.8" marker-end="url(#pr2-arr)"/>';
        s += '<circle cx="' + (x - 5) + '" cy="' + (188 + i * 6) + '" r="1.8" fill="#b26a39"/>';
        s += '<circle cx="' + (x + 4) + '" cy="' + (196 + i * 6) + '" r="1.8" fill="#b26a39"/>';
      });
      s += '<defs><marker id="pr2-arr" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#b26a39"/></marker></defs>';
      /* 地面管线 */
      s += '<path d="M56 26 L130 26 L204 26" fill="none" stroke="#c9c3b4" stroke-width="1.2" stroke-dasharray="2 2"/>';
      s += '<text x="130" y="276" text-anchor="middle" font-size="8.5" fill="#4a545d">油嘴 ' + state.choke.toFixed(1) + ' mm · 注水 ' + state.inj + ' m³/d</text>';
      s += '<text x="130" y="290" text-anchor="middle" font-size="8" fill="#9ba3a9">液量上限 ' + LIQ_LIMIT + ' t/d</text>';
      s += '<text x="130" y="304" text-anchor="middle" font-size="8" fill="#9ba3a9">注水支撑递减，含水上升压缩产油</text>';
      return s + '</svg>';
    }

    /* ---------------- 主预测图 ---------------- */
    function renderForecast(hist, cur, st) {
      var box = $('pr2-forecast');
      box.innerHTML = '';
      var W = 640, H = 300, M = { t: 24, r: 58, b: 40, l: 50 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '历史产量、预测产量与置信区间');
      var maxQ = d3.max(hist.concat(cur.series), function (p) { return p.oil; });
      var yL = d3.scaleLinear().domain([0, maxQ * 1.35]).range([H - M.b, M.t]);
      var yR = d3.scaleLinear().domain([0, 80]).range([H - M.b, M.t]);
      var x = d3.scaleLinear().domain([-HIST, st.horizon]).range([M.l, W - M.r]);

      var ticks = [-120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180].filter(function (v) { return v >= -HIST && v <= st.horizon; });
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).tickValues(ticks).tickFormat(function (v) { return v === 0 ? '今天' : v; }).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(yL).ticks(5).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('g').attr('transform', 'translate(' + (W - M.r) + ',0)')
        .call(d3.axisRight(yR).ticks(5).tickFormat(function (v) { return v + '%'; }).tickSize(0))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#c58b62');
        });
      svg.append('text').attr('x', M.l).attr('y', 13).attr('font-size', 9).attr('fill', '#9ba3a9').text('日产油 (t/d)');
      svg.append('text').attr('x', W - M.r).attr('y', 13).attr('font-size', 9).attr('fill', '#c58b62').attr('text-anchor', 'end').text('含水率');

      /* 今天分隔 */
      svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#a03d4f').attr('stroke-width', 1).attr('stroke-dasharray', '3 3').attr('opacity', 0.6);
      svg.append('text').attr('x', x(0) + 4).attr('y', M.t + 10).attr('font-size', 8.5).attr('fill', '#a03d4f').text('今天');

      /* 含水上限 */
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', yR(st.wcLimit)).attr('y2', yR(st.wcLimit))
        .attr('stroke', '#b05a51').attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
      svg.append('text').attr('x', W - M.r - 3).attr('y', yR(st.wcLimit) - 4).attr('text-anchor', 'end')
        .attr('font-size', 8.5).attr('fill', '#b05a51').text('上限 ' + st.wcLimit + '%');

      /* 历史 */
      var lineOil = d3.line().x(function (p) { return x(p.day); }).y(function (p) { return yL(p.oil); });
      var lineWc = d3.line().x(function (p) { return x(p.day); }).y(function (p) { return yR(p.wc * 100); });
      svg.append('path').datum(hist).attr('d', lineOil).attr('fill', 'none').attr('stroke', '#9ba3a9').attr('stroke-width', 1.6);
      svg.append('path').datum(hist).attr('d', lineWc).attr('fill', 'none').attr('stroke', '#d2b49d').attr('stroke-width', 1.1).attr('stroke-dasharray', '3 3');

      /* 预测区间与曲线（按 shown 展开） */
      var fc = cur.series.filter(function (p) { return p.day <= shown; });
      var anchor = hist[hist.length - 1];
      if (fc.length) {
        var band = [{ day: 0, lo: anchor.oil, hi: anchor.oil }];
        fc.forEach(function (p) {
          var w = p.oil * bandAt(p.day, st);
          band.push({ day: p.day, lo: Math.max(0, p.oil - w), hi: p.oil + w });
        });
        var area = d3.area().x(function (p) { return x(p.day); }).y0(function (p) { return yL(p.lo); }).y1(function (p) { return yL(p.hi); });
        svg.append('path').datum(band).attr('d', area).attr('fill', '#f8f1e8').attr('opacity', 0.85);
        /* 区间上下边界 */
        var loLine = d3.line().x(function (p) { return x(p.day); }).y(function (p) { return yL(p.lo); });
        var hiLine = d3.line().x(function (p) { return x(p.day); }).y(function (p) { return yL(p.hi); });
        svg.append('path').datum(band).attr('d', loLine).attr('fill', 'none')
          .attr('stroke', '#3a352d').attr('stroke-width', 0.9).attr('stroke-dasharray', '3 2').attr('opacity', 0.5);
        svg.append('path').datum(band).attr('d', hiLine).attr('fill', 'none')
          .attr('stroke', '#3a352d').attr('stroke-width', 0.9).attr('stroke-dasharray', '3 2').attr('opacity', 0.5);
        var bend = band[band.length - 1];
        svg.append('text').attr('x', x(bend.day) + 3).attr('y', yL(bend.hi) - 3)
          .attr('font-size', 8).attr('fill', '#5b9b87').attr('font-family', 'ui-monospace,monospace')
          .text(bend.hi.toFixed(1));
        svg.append('text').attr('x', x(bend.day) + 3).attr('y', yL(bend.lo) + 9)
          .attr('font-size', 8).attr('fill', '#5b9b87').attr('font-family', 'ui-monospace,monospace')
          .text(bend.lo.toFixed(1));
        var fcLine = [{ day: 0, oil: anchor.oil, wc: anchor.wc }].concat(fc);
        svg.append('path').datum(fcLine).attr('d', lineOil).attr('fill', 'none').attr('stroke', '#3a352d').attr('stroke-width', 2.2);
        svg.append('path').datum(fcLine).attr('d', lineWc).attr('fill', 'none').attr('stroke', '#c58b62').attr('stroke-width', 1.3);
        var last = fcLine[fcLine.length - 1];
        svg.append('circle').attr('cx', x(last.day)).attr('cy', yL(last.oil)).attr('r', 3.2).attr('fill', '#3a352d').attr('stroke', '#fff').attr('stroke-width', 1.2);
        svg.append('text').attr('x', x(last.day) - 4).attr('y', yL(last.oil) - 7).attr('text-anchor', 'end')
          .attr('font-size', 9).attr('fill', '#3a352d').text(last.oil.toFixed(1));
      }

      /* 悬停 */
      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var day = Math.round(clamp(x.invert(mx), -HIST, st.horizon));
        var p = day <= 0 ? hist.reduce(function (a, q) { return Math.abs(q.day - day) < Math.abs(a.day - day) ? q : a; }, hist[0])
          : cur.series[Math.min(day, cur.series.length) - 1];
        if (!p) return;
        var bw = bandAt(day, st);
        var bandTxt = day > 0 ? '<br>95% 区间 <b>' + (p.oil * (1 - bw)).toFixed(1) + ' — ' + (p.oil * (1 + bw)).toFixed(1) + '</b>（±' + (bw * 100).toFixed(0) + '%）' : '';
        var sc = SCEN[scen] || 1;
        var scenTxt = day > 0 ? '<br>情景 <b>' + SCEN_LABEL[scen] + '</b>（×' + sc.toFixed(2) + '）· 较基准 ' +
          ((sc - 1) * 100 >= 0 ? '+' : '') + ((sc - 1) * 100).toFixed(0) + '%' : '';
        tipShow((day > 0 ? '预测第 <b>' + day + '</b> 天' : '历史第 <b>' + day + '</b> 天') +
          '<br>日产油 <b>' + p.oil.toFixed(1) + '</b> t/d · 含水 <b>' + (p.wc * 100).toFixed(1) + '%</b>' + bandTxt + scenTxt, ev);
      }).on('mouseleave', tipHide);

      $('pr2-fc-mini').textContent = st.horizon + ' 天 · ' + SCEN_LABEL[scen] + '情景 · 终点区间 ±' + (bandPct(st) * 100).toFixed(0) + '%';
    }

    /* ---------------- 情景累产 ---------------- */
    function renderScenario(cur, ai) {
      var box = $('pr2-scenario');
      box.innerHTML = '';
      var W = 640, H = 226, M = { t: 24, r: 16, b: 42, l: 54 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '当前制度与 AI 推荐制度的累产油对比');
      var marks = [];
      [30, 90, state.horizon].forEach(function (d) {
        if (d <= state.horizon && marks.indexOf(d) < 0) marks.push(d);
      });
      marks.sort(function (a, b) { return a - b; });
      var data = marks.map(function (d) {
        return { day: d, cur: cumulativeAt(cur.series, d), ai: cumulativeAt(ai.f.series, d) };
      });
      var maxV = d3.max(data, function (d) { return Math.max(d.cur, d.ai); });
      var x0 = d3.scaleBand().domain(data.map(function (d) { return d.day; })).range([M.l, W - M.r]).padding(0.34);
      var x1 = d3.scaleBand().domain(['cur', 'ai']).range([0, x0.bandwidth()]).padding(0.18);
      var y = d3.scaleLinear().domain([0, maxV * 1.2]).range([H - M.b, M.t]);
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(4).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 9).attr('fill', '#9ba3a9');
        });
      svg.selectAll('.g').data(data).enter().append('g')
        .each(function (d) {
          var g = d3.select(this);
          g.append('rect').attr('x', x0(d.day) + x1('cur')).attr('y', y(d.cur))
            .attr('width', x1.bandwidth()).attr('height', H - M.b - y(d.cur)).attr('rx', 2)
            .attr('fill', '#b26a39');
          g.append('rect').attr('x', x0(d.day) + x1('ai')).attr('y', y(d.ai))
            .attr('width', x1.bandwidth()).attr('height', H - M.b - y(d.ai)).attr('rx', 2)
            .attr('fill', '#3a352d');
          g.append('text').attr('x', x0(d.day) + x1('cur') + x1.bandwidth() / 2).attr('y', y(d.cur) - 4)
            .attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#b26a39')
            .attr('font-family', 'ui-monospace,monospace').text(Math.round(d.cur));
          g.append('text').attr('x', x0(d.day) + x1('ai') + x1.bandwidth() / 2).attr('y', y(d.ai) - 4)
            .attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', '#3a352d')
            .attr('font-family', 'ui-monospace,monospace').text(Math.round(d.ai));
        });
      svg.selectAll('.hit').data(data).enter().append('rect')
        .attr('x', function (d) { return x0(d.day); }).attr('y', M.t)
        .attr('width', x0.bandwidth()).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent')
        .on('mouseenter', function (ev, d) {
          tipShow('<b>' + d.day + '</b> 天累产油<br>当前 <b>' + Math.round(d.cur) + '</b> t · AI <b>' + Math.round(d.ai) + '</b> t<br>差 <b>' + (d.ai - d.cur >= 0 ? '+' : '') + Math.round(d.ai - d.cur) + '</b> t', ev);
        })
        .on('mousemove', function (ev, d) {
          tipShow('<b>' + d.day + '</b> 天累产油<br>当前 <b>' + Math.round(d.cur) + '</b> t · AI <b>' + Math.round(d.ai) + '</b> t<br>差 <b>' + (d.ai - d.cur >= 0 ? '+' : '') + Math.round(d.ai - d.cur) + '</b> t', ev);
        })
        .on('mouseleave', tipHide);
      svg.selectAll('.xl').data(data).enter().append('text')
        .attr('x', function (d) { return x0(d.day) + x0.bandwidth() / 2; }).attr('y', H - M.b + 18)
        .attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#4a545d')
        .text(function (d) { return d.day + ' 天'; });
      svg.append('text').attr('x', M.l).attr('y', 13).attr('font-size', 9).attr('fill', '#9ba3a9').text('累产油 (t)');
      $('pr2-scenario-legend').innerHTML =
        '<span><i style="background:#b26a39"></i>当前制度</span>' +
        '<span><i style="background:#3a352d"></i>AI 推荐制度</span>' +
        '<span style="margin-left:auto">AI：注水 ' + ai.inj + ' m³/d · 油嘴 ' + ai.choke.toFixed(1) + ' mm</span>';

      /* 三种情景下 AI 制度的累产区间 */
      var keep = scen;
      var vals = ['cons', 'base', 'opt'].map(function (k) {
        scen = k;
        var v = forecast(state, ai.inj, ai.choke, state.horizon).cumOil;
        scen = keep;
        return v;
      });
      var span = vals[1] ? (vals[2] - vals[0]) / vals[1] * 100 : 0;
      $('pr2-scen-sum').innerHTML = '<b>AI 制度三情景累产：</b>保守 ' + Math.round(vals[0]) + ' t · 基准 ' +
        Math.round(vals[1]) + ' t · 积极 ' + Math.round(vals[2]) + ' t（极差 ' + span.toFixed(0) + '%）。' +
        '情景只修正预测起点，不改变参数可行域。';
    }

    /* ---------------- 影响因素 ---------------- */
    function renderFactors(factors) {
      var box = $('pr2-factors');
      box.innerHTML = '';
      var W = 640, H = 196, M = { t: 14, r: 52, b: 34, l: 112 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '各参数对累产油的影响排序');
      var lo = Math.min(0, d3.min(factors, function (f) { return f.delta; }));
      var hi = Math.max(0, d3.max(factors, function (f) { return f.delta; }));
      var pad = Math.max(0.6, (hi - lo) * 0.18);
      var x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([M.l, W - M.r]);
      var y = d3.scaleBand().domain(factors.map(function (f) { return f.name; })).range([M.t, H - M.b]).padding(0.34);
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).tickSize(0))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('text').attr('font-size', 9.5).attr('fill', '#4a545d');
        });
      svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', M.t - 4).attr('y2', H - M.b)
        .attr('stroke', '#b9b2a2').attr('stroke-width', 1);
      svg.selectAll('.b').data(factors).enter().append('rect')
        .attr('x', function (f) { return x(Math.min(0, f.delta)); })
        .attr('y', function (f) { return y(f.name); })
        .attr('width', function (f) { return Math.max(2, Math.abs(x(f.delta) - x(0))); })
        .attr('height', y.bandwidth()).attr('rx', 2)
        .attr('fill', function (f) { return f.delta >= 0 ? '#3a352d' : '#b26a39'; })
        .style('cursor', 'pointer')
        .on('mouseenter', function (ev, f) {
          tipShow(f.name + ' +10%<br>累产变化 <b>' + (f.delta >= 0 ? '+' : '') + f.delta.toFixed(1) + '%</b><br>' + f.desc, ev);
        })
        .on('mousemove', function (ev, f) {
          tipShow(f.name + ' +10%<br>累产变化 <b>' + (f.delta >= 0 ? '+' : '') + f.delta.toFixed(1) + '%</b><br>' + f.desc, ev);
        })
        .on('mouseleave', tipHide);
      svg.selectAll('.v').data(factors).enter().append('text')
        .attr('x', function (f) { return x(f.delta) + (f.delta >= 0 ? 5 : -5); })
        .attr('y', function (f) { return y(f.name) + y.bandwidth() / 2 + 3; })
        .attr('text-anchor', function (f) { return f.delta >= 0 ? 'start' : 'end'; })
        .attr('font-size', 9).attr('fill', function (f) { return f.delta >= 0 ? '#3a352d' : '#8f5128'; })
        .attr('font-family', 'ui-monospace,monospace')
        .text(function (f) { return (f.delta >= 0 ? '+' : '') + f.delta.toFixed(1) + '%'; });
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(5).tickFormat(function (v) { return (v > 0 ? '+' : '') + v.toFixed(0) + '%'; }).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
    }

    /* ---------------- 输出 ---------------- */
    function renderOutput(cur, ai, st, hist) {
      var conf = confidenceOf(cur, st);
      var curCum = cur.cumOil;
      var aiCum = ai.f.cumOil;
      var gain = curCum ? (aiCum - curCum) / curCum * 100 : 0;
      var endWc = ai.f.maxWc * 100;
      var risk = endWc > st.wcLimit ? '高' : (endWc > st.wcLimit - 3 ? '中' : '低');

      $('pr2-k-plan').textContent = ai.inj + ' m³/d · ' + ai.choke.toFixed(1) + ' mm';
      $('pr2-k-cum-label').textContent = st.horizon + ' 天累产油';
      $('pr2-k-cum').innerHTML = Math.round(aiCum) + '<small>t</small>';
      $('pr2-k-end').innerHTML = ai.f.end.oil.toFixed(1) + '<small>t/d</small>';
      var wcEl = $('pr2-k-wc');
      wcEl.innerHTML = endWc.toFixed(1) + '<small>%</small>';
      wcEl.className = risk === '低' ? 'ok' : (risk === '中' ? 'warn' : 'bad');
      $('pr2-k-gain').innerHTML = (gain >= 0 ? '+' : '') + gain.toFixed(1) + '<small>%</small>';
      $('pr2-k-gain').className = gain >= 0 ? 'ok' : 'bad';
      $('pr2-k-band').innerHTML = '±' + (bandPct(st) * 100).toFixed(0) + '<small>%</small>';
      var rEl = $('pr2-k-risk');
      rEl.textContent = risk;
      rEl.className = risk === '低' ? 'ok' : (risk === '中' ? 'warn' : 'bad');
      $('pr2-conf-bar').style.width = conf + '%';
      $('pr2-conf-bar').className = conf >= 75 ? '' : (conf >= 55 ? 'warn' : 'bad');
      $('pr2-conf-txt').textContent = '区间 ±' + (bandPct(st) * 100).toFixed(0) + '% · 期末含水 ' + endWc.toFixed(1) + '%';
      $('pr2-out-mini').textContent = ai.feasible ? '含水约束内最优' : '无可行解 · 风险最小';
      $('pr2-set-tag').textContent = st.horizon + ' 天预测';
      var sn = $('pr2-scen-note');
      if (sn) {
        sn.innerHTML = scen === 'cons' ? '<b>保守情景：</b>预测起点 ×0.93，用于配产下限与风险预案。'
          : (scen === 'opt' ? '<b>积极情景：</b>预测起点 ×1.07，用于上产潜力评估，不宜直接作为配产依据。'
            : '<b>基准情景：</b>按历史拟合趋势直接外推，用于常规配产。');
      }

      $('pr2-detail').innerHTML =
        '<table class="iq-table">' +
        '<tr><td>注水量</td><td class="num">' + st.inj + ' m³/d</td></tr>' +
        '<tr><td>油嘴</td><td class="num">' + st.choke.toFixed(1) + ' mm</td></tr>' +
        '<tr><td>初始含水</td><td class="num">' + st.wc0 + '%</td></tr>' +
        '<tr><td>月递减率</td><td class="num">' + st.decl.toFixed(1) + '%</td></tr>' +
        '<tr><td>预测期末含水</td><td class="num">' + endWc.toFixed(1) + '%</td></tr>' +
        '<tr><td>历史拟合 R²</td><td class="num">' + fitR2().toFixed(3) + '</td></tr>' +
        '</table>' +
        '<p class="iq-poll" style="margin-top:6px">历史 120 天为固定观测数据（合成），不随右侧参数重算；参数只改变预测段情景。</p>';

      var note = $('pr2-note');
      if (!ai.feasible) {
        note.className = 'iq-note red';
        note.innerHTML = '<b>无可行解：</b>在注水 200—600 m³/d、油嘴 6—14 mm 范围内，期末含水都超过 ' + st.wcLimit + '%。建议放宽含水上限或同步实施堵水。';
      } else if (endWc > st.wcLimit - 3) {
        note.className = 'iq-note clay';
        note.innerHTML = '<b>贴近约束：</b>AI 方案期末含水 ' + endWc.toFixed(1) + '%，已接近上限 ' + st.wcLimit + '%。实际含水波动可能导致超限，建议按月滚动更新。';
      } else {
        note.className = 'iq-note';
        note.innerHTML = '<b>结论：</b>AI 建议注水 ' + ai.inj + ' m³/d、油嘴 ' + ai.choke.toFixed(1) + ' mm，' + st.horizon + ' 天累产 ' + Math.round(aiCum) + ' t，期末含水 ' + endWc.toFixed(1) + '%，在含水约束内。';
      }

      var ex = $('pr2-explain');
      var factors = factorsOf(st, cur);
      ex.innerHTML = '<b>预测怎么来的：</b>历史 120 天作为固定观测数据，用指数递减拟合趋势；预测段叠加注水支撑（注水量越高、递减越慢）、油嘴产能倍数与含水耦合（含水上升通过液量上限 ' + LIQ_LIMIT + ' t/d 压制产油）。' +
        '95% 区间由历史残差估计，并按 √(预测天数/周期) 展宽，因此越远的预测区间越宽。' +
        '<br><b>最敏感因素：</b>' + factors[0].name + '（+10% 使累产变化 ' + (factors[0].delta >= 0 ? '+' : '') + factors[0].delta.toFixed(1) + '%）。' +
        '<br><b>AI 方案逻辑：</b>在注水与油嘴范围内搜索，先满足期末含水 ≤ ' + st.wcLimit + '%，再最大化 ' + st.horizon + ' 天累产；当前制度与 AI 制度的差异见左下表。';

      var m30c = cumulativeAt(cur.series, 30), m30a = cumulativeAt(ai.f.series, 30);
      var m90c = cumulativeAt(cur.series, Math.min(90, st.horizon)), m90a = cumulativeAt(ai.f.series, Math.min(90, st.horizon));
      $('pr2-table').innerHTML =
        '<table class="iq-table">' +
        '<tr><th>项目</th><th>当前制度</th><th>AI 推荐</th><th>变化</th></tr>' +
        '<tr><td>注水量</td><td class="num">' + st.inj + ' m³/d</td><td class="num">' + ai.inj + ' m³/d</td><td class="num">' + (ai.inj - st.inj >= 0 ? '+' : '') + (ai.inj - st.inj) + '</td></tr>' +
        '<tr><td>油嘴</td><td class="num">' + st.choke.toFixed(1) + ' mm</td><td class="num">' + ai.choke.toFixed(1) + ' mm</td><td class="num">' + (ai.choke - st.choke >= 0 ? '+' : '') + (ai.choke - st.choke).toFixed(1) + '</td></tr>' +
        '<tr><td>30 天累产油</td><td class="num">' + Math.round(m30c) + ' t</td><td class="num">' + Math.round(m30a) + ' t</td><td class="num">' + (m30a - m30c >= 0 ? '+' : '') + Math.round(m30a - m30c) + '</td></tr>' +
        '<tr><td>90 天累产油</td><td class="num">' + Math.round(m90c) + ' t</td><td class="num">' + Math.round(m90a) + ' t</td><td class="num">' + (m90a - m90c >= 0 ? '+' : '') + Math.round(m90a - m90c) + '</td></tr>' +
        '<tr class="hl"><td>' + st.horizon + ' 天累产油</td><td class="num">' + Math.round(curCum) + ' t</td><td class="num">' + Math.round(aiCum) + ' t</td><td class="num">' + (aiCum - curCum >= 0 ? '+' : '') + Math.round(aiCum - curCum) + '</td></tr>' +
        '<tr><td>期末日产油</td><td class="num">' + cur.end.oil.toFixed(1) + ' t/d</td><td class="num">' + ai.f.end.oil.toFixed(1) + ' t/d</td><td class="num">' + (ai.f.end.oil - cur.end.oil >= 0 ? '+' : '') + (ai.f.end.oil - cur.end.oil).toFixed(1) + '</td></tr>' +
        '<tr><td>期末含水率</td><td class="num">' + (cur.maxWc * 100).toFixed(1) + '%</td><td class="num">' + endWc.toFixed(1) + '%</td><td class="num">' + ((endWc - cur.maxWc * 100) >= 0 ? '+' : '') + (endWc - cur.maxWc * 100).toFixed(1) + '%</td></tr>' +
        '</table>' +
        '<p class="iq-poll">当前制度与 AI 制度使用同一预测模型；AI 方案在含水上限 ' + st.wcLimit + '% 内搜索累产最大。</p>';

      $('pr2-horizon').setAttribute('aria-valuetext', st.horizon + ' 天');
      $('pr2-k-cum-label').textContent = st.horizon + ' 天累产油';
    }

    /* ---------------- 渲染 ---------------- */
    function syncQuick() {
      var q = $('pr2-quick');
      if (q) {
        var btns = q.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          btns[i].className = Number(btns[i].getAttribute('data-h')) === state.horizon ? 'on' : '';
        }
      }
      var s = $('pr2-scen');
      if (s) {
        var sb = s.querySelectorAll('button');
        for (var j = 0; j < sb.length; j++) {
          sb[j].className = sb[j].getAttribute('data-scen') === scen ? 'on' : '';
        }
      }
    }

    /* 智能方法说明：数值来自本轮预测模型、情景搜索与因素排序 */
    function renderSmart(cur, ai, factors) {
      if (!window.IQSmart || !smartBox) return;
      var aiCum = ai.f.cumOil, curCum = cur.cumOil;
      var endWc = ai.f.maxWc * 100;
      function num(a, b, unit, digits, lowerBetter) {
        var d = b - a, n = (digits == null ? 1 : digits);
        var good = lowerBetter ? d <= 0 : d >= 0;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(n) + (unit || ''), cls: good ? 'ok' : 'bad' };
      }
      var rows = [
        { cells: ['日注水量 (m³/d)', String(state.inj), String(ai.inj), num(state.inj, ai.inj, '', 0), '—'] },
        { cells: ['油嘴 (mm)', state.choke.toFixed(1), ai.choke.toFixed(1), num(state.choke, ai.choke, '', 1), '—'] },
        { cells: [state.horizon + ' 天累产油 (t)', Math.round(curCum), Math.round(aiCum), num(curCum, aiCum, '', 0), '—'] },
        { cells: ['期末日产油 (t/d)', cur.end.oil.toFixed(1), ai.f.end.oil.toFixed(1), num(cur.end.oil, ai.f.end.oil, '', 1), '—'] },
        { cells: ['期末含水 (%)', (cur.maxWc * 100).toFixed(1), endWc.toFixed(1), num(cur.maxWc * 100, endWc, '%', 1, true), { v: '上限 ' + state.wcLimit + '%', cls: endWc <= state.wcLimit ? 'ok' : 'bad' }] },
        { cells: ['预测区间', '±' + (bandPct(state) * 100).toFixed(0) + '%', '±' + (bandPct(state) * 100).toFixed(0) + '%', '—', '95% 区间，随天数展宽'] },
        { cells: ['约束结论', cur.maxWc * 100 <= state.wcLimit ? '满足' : '不满足', ai.feasible ? '满足' : '无可行解', '—', '含水上限约束'], hl: true }
      ];
      smartBox.innerHTML = window.IQSmart.render({
        kicker: 'SMART METHOD · TIME SERIES + SEARCH',
        title: '指数递减拟合 + 注水/油嘴协变量情景搜索',
        subtitle: '历史趋势外推叠加注水支撑、油嘴产能与含水耦合，输出带区间的预测',
        badge: '区间 ±' + (bandPct(state) * 100).toFixed(0) + '%',
        /* 主视觉：289 组注水×油嘴制度的「累产—期末含水」散点，绿=含水达标 */
        algoSvg: window.IQAlgo ? window.IQAlgo.scatter({
          points: ai.all,
          xLabel: state.horizon + ' 天累产油 (t) →',
          yLabel: '期末含水 %',
          yLine: state.wcLimit,
          yLineLabel: '含水上限 ' + state.wcLimit + '%',
          pick: { x: ai.f.cumOil, y: endWc },
          pickLabel: '推荐 ' + ai.inj + ' m³/d · ' + ai.choke.toFixed(1) + ' mm',
          yDig: 0
        }) : '',
        algoCap: '<span><i style="background:rgba(53,120,90,.55)"></i>含水上限内的制度</span>' +
          '<span><i style="background:rgba(168,82,73,.45)"></i>期末含水超限的制度</span>' +
          '<span>每个点 = 一组「注水量 × 油嘴」的完整预测结果（不是拟合直线）</span>',
        input: '历史 120 天产量、注水量、油嘴、初始含水、递减率、预测周期、含水上限',
        output: '带 95% 区间的产量曲线、累产油、期末含水与推荐生产制度',
        problem: '递减曲线假设单一，措施与注水响应难刻画；新井历史短、拟合不稳定',
        fit: '历史拟合给趋势，协变量给注水/油嘴响应，区间给出不确定性；可在约束内搜索制度',
        flow: ['历史生产数据', '指数递减拟合', '注水 / 油嘴 / 含水耦合', '含水上限约束', '推荐生产制度', '按月滚动复核'],
        trace: [
          ['搜索组合', ai.evaluated + ' 组'],
          ['含水内可行', ai.feasibleCount + ' 组'],
          ['历史拟合 R²', fitR2().toFixed(3)],
          ['区间宽度', '±' + (bandPct(state) * 100).toFixed(0) + '%'],
          ['预测步长', state.horizon + ' 天']
        ],
        compare: {
          title: '当前生产制度 vs AI 推荐制度',
          columns: ['指标', '当前制度', 'AI 推荐', '变化', '约束 / 说明'],
          rows: rows,
          note: '两者使用同一历史段与同一预测模型；AI 在注水 200—600 m³/d、油嘴 6—14 mm 内搜索。'
        },
        why: [
          '预测不是把历史曲线简单延长：注水量改变递减速率，油嘴改变初期产能倍数，含水上升通过液量上限压制产油，三项都参与逐日计算。',
          '95% 区间由历史残差估计，并按 √(预测天数/周期) 展宽，所以预测期越长区间越宽；它不是确定值，不能当作单一配产指标。',
          '因素排序显示：' + factors[0].name + ' +10% 会使 ' + state.horizon + ' 天累产变化 ' +
            (factors[0].delta >= 0 ? '+' : '') + factors[0].delta.toFixed(1) + '%，这是当前最敏感的输入，现场应优先核实。'
        ],
        bounds: [
          '本示范使用合成的 120 天历史数据与简化递减模型，未用真实单井生产历史、压力与含水化验数据标定。',
          '模型未覆盖措施干预（压裂、酸化、堵水）、注采井网连通与季节影响，预测区间只反映模型残差，不等于完整不确定性。',
          '配产制度、注水量与油嘴必须由工程师结合配产计划、井口设备与含水监测确认，并按月滚动更新。'
        ]
      });
    }

    function renderAll() {
      var hist = history();
      var cur = forecast(state, state.inj, state.choke, state.horizon);
      var ai = optimize(state);
      var factors = factorsOf(state, cur);
      renderSmart(cur, ai, factors);
      $('pr2-figure').innerHTML = figureSvg();
      renderForecast(hist, cur, state);
      renderScenario(cur, ai);
      renderFactors(factors);
      renderOutput(cur, ai, state, hist);
      syncQuick();
      $('pr2-factors').parentNode.querySelector('.iq-mini').textContent = '各项 +10% 对 ' + state.horizon + ' 天累产的影响';
    }

    function readState() {
      state.inj = Number($('pr2-inj').value);
      state.choke = Number($('pr2-choke').value);
      state.wc0 = Number($('pr2-wc0').value);
      state.decl = Number($('pr2-decl').value);
      state.horizon = Number($('pr2-horizon').value);
      state.wcLimit = Number($('pr2-limit').value);
      $('pr2-o-inj').textContent = state.inj + ' m³/d';
      $('pr2-o-choke').textContent = state.choke.toFixed(1) + ' mm';
      $('pr2-o-wc0').textContent = state.wc0 + '%';
      $('pr2-o-decl').textContent = state.decl.toFixed(1) + '%';
      $('pr2-o-horizon').textContent = state.horizon + ' 天';
      $('pr2-o-limit').textContent = state.wcLimit + '%';
      if (shown > state.horizon) shown = state.horizon;
    }

    function stopAnim() {
      if (timer) { window.clearInterval(timer); timer = null; }
      playing = false;
      $('pr2-play').textContent = '播放预测';
    }

    function startAnim() {
      if (playing) { stopAnim(); renderAll(); return; }
      if (shown >= state.horizon) shown = 1;
      playing = true;
      $('pr2-play').textContent = '暂停';
      timer = window.setInterval(function () {
        shown = Math.min(shown + Math.max(1, Math.round(state.horizon / 50)), state.horizon);
        if (shown >= state.horizon) {
          shown = state.horizon;
          stopAnim();
          renderAll();
          return;
        }
        renderAll();
      }, 120);
      renderAll();
    }

    /* ---------------- 事件 ---------------- */
    ['pr2-inj', 'pr2-choke', 'pr2-wc0', 'pr2-decl', 'pr2-horizon', 'pr2-limit'].forEach(function (id) {
      listen($(id), 'input', function () {
        stopAnim();
        readState();
        shown = state.horizon;
        renderAll();
      });
    });
    listen($('pr2-play'), 'click', startAnim);
    listen($('pr2-quick'), 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-h]') : null;
      if (!btn) return;
      stopAnim();
      var h = Number(btn.getAttribute('data-h'));
      state.horizon = h;
      $('pr2-horizon').value = h;
      shown = h;
      readState();
      renderAll();
    });
    listen($('pr2-scen'), 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-scen]') : null;
      if (!btn) return;
      stopAnim();
      scen = btn.getAttribute('data-scen');
      shown = state.horizon;
      renderAll();
    });
    listen($('pr2-reset'), 'click', function () {
      stopAnim();
      state.inj = DEFAULTS.inj; state.choke = DEFAULTS.choke; state.wc0 = DEFAULTS.wc0;
      state.decl = DEFAULTS.decl; state.horizon = DEFAULTS.horizon; state.wcLimit = DEFAULTS.wcLimit;
      scen = 'base';
      $('pr2-inj').value = state.inj; $('pr2-choke').value = state.choke; $('pr2-wc0').value = state.wc0;
      $('pr2-decl').value = state.decl; $('pr2-horizon').value = state.horizon; $('pr2-limit').value = state.wcLimit;
      shown = state.horizon;
      readState(); renderAll();
    });
    listen($('pr2-ai'), 'click', function () {
      stopAnim();
      var ai = optimize(state);
      state.inj = ai.inj; state.choke = ai.choke;
      $('pr2-inj').value = state.inj; $('pr2-choke').value = state.choke;
      shown = state.horizon;
      readState(); renderAll();
    });

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
