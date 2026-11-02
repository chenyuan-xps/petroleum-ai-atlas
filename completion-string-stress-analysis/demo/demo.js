/* =========================================================
   co3 完井管柱受力智能分析 · 交互示范
   ---------------------------------------------------------
   一维管柱力学代理模型 + 滑动平均异常检测 + 下入速度扫描
   井眼轨迹、钩载曲线、安全系数与风险热力带
   本示范使用合成数据，仅用于展示方法流程。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'completion-string-stress-analysis';

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

    var YIELD = 480;       /* 管材屈服强度 MPa */
    var AREA = 0.012;      /* 管柱截面积 m² */
    var LOWER = 120;       /* 最小钩载 kN（低于此值自锁风险） */
    var UPPER = 1100;      /* 最大钩载 kN */
    var SF_LIMIT = 2.0;    /* 安全系数阈值 */
    var STEP = 20;
    var DEFAULTS = { v: 0.8, mu: 0.20, inc: 40, w: 280, H: 4200 };
    var BASE_SPEED = 0.6;  /* 经验方案下入速度 */

    var state = { v: DEFAULTS.v, mu: DEFAULTS.mu, inc: DEFAULTS.inc, w: DEFAULTS.w, H: DEFAULTS.H };
    var depthNow = DEFAULTS.H;
    var playing = false;
    var timer = null;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* ---------------- 受力模型 ---------------- */
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
        arr.push({ s: s, inc: incDeg, disp: disp, F: F, sf: sf, dls: dls, axial: axial, bending: bending, risk: risk });
      }
      return arr;
    }

    function summarize(arr, st) {
      var minSF = 9, maxF = 0, sum = 0, cnt = 0;
      var highRuns = [], run = null, anomaly = null, smoothW = 7;
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        if (p.s > st.H * 0.05) minSF = Math.min(minSF, p.sf);
        maxF = Math.max(maxF, p.F);
        if (p.risk === 'high') {
          if (!run) run = { from: p.s, to: p.s };
          else run.to = p.s;
        } else if (run) { highRuns.push(run); run = null; }
        /* 滑动平均残差：识别局部钩载突降 */
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
        minSF: minSF,
        maxF: maxF,
        endF: arr[arr.length - 1].F,
        meanF: sum / Math.max(cnt, 1),
        highRuns: highRuns,
        anomaly: anomaly || { s: st.H * 0.62, res: 0, F: 0 }
      };
    }

    function riskText(runs) {
      if (!runs.length) return '无';
      var total = runs.reduce(function (a, r) { return a + (r.to - r.from); }, 0);
      var first = runs[0];
      return Math.round(first.from) + '—' + Math.round(first.to) + ' m' + (runs.length > 1 ? ' 等 ' + total + ' m' : '');
    }

    function scanSpeed(st) {
      var feasible = null, fallback = null, scanned = 0, nFeas = 0, sweep = [];
      for (var v = 0.2; v <= 2.001; v += 0.05) {
        var arr = buildProfile(st, v);
        var sum = summarize(arr, st);
        var ok = sum.minSF >= SF_LIMIT && sum.endF >= LOWER && sum.maxF <= UPPER;
        var score = Math.min(sum.minSF / SF_LIMIT, 1.4) * 2 + Math.min(sum.endF / LOWER, 1.2) - v * 0.04;
        scanned++;
        if (ok) nFeas++;
        sweep.push({ v: v, ok: ok, sf: sum.minSF });
        if (ok && (!feasible || v > feasible.v)) {
          feasible = { v: v, sum: sum, arr: arr };
        }
        if (!fallback || score > fallback.score) {
          fallback = { v: v, sum: sum, arr: arr, score: score };
        }
      }
      /* ok=false 表示整档扫描里没有一档同时满足安全系数、钩载下限与钩载上限，
         此时返回的是“最接近安全窗口”的参考解，界面上必须显式说明，不能当成推荐值。 */
      var pick = feasible || fallback;
      pick.ok = !!feasible;
      pick.scanned = scanned;
      pick.feasibleCount = nFeas;
      pick.sweep = sweep;
      return pick;
    }

    function confidenceOf(opt, cur) {
      var margin = opt.sum.minSF - SF_LIMIT;
      var hookMargin = (opt.sum.endF - LOWER) / LOWER;
      var c = 56 + clamp(margin, -0.6, 1.2) * 26 + clamp(hookMargin, -0.6, 1) * 14;
      if (opt.sum.highRuns.length) c -= 8;
      if (cur.sum.highRuns.length) c -= 4;
      return clamp(Math.round(c), 36, 94);
    }

    /* ---------------- 骨架 ---------------- */
    root.innerHTML =
      '<div class="iq-head">' +
        '<div><span class="iq-kicker">SCENE co3 · 完井</span>' +
          '<h3>完井管柱受力智能分析：把“能不能下得去”画出来</h3>' +
          '</div>' +
        '<div class="iq-tags"><span class="iq-tag jade">机理代理模型</span><span class="iq-tag">异常检测</span><span class="iq-tag blue">速度扫描</span><span class="iq-tag clay">安全窗口</span></div>' +
      '</div>' +
      '<div class="iq-grid">' +
        '<div class="iq-figure">' +
          '<div class="iq-card"><div class="iq-card-h"><h4><i class="iq-dot"></i>井眼轨迹</h4><span class="iq-mini" id="co3-tr-mini">—</span></div><div id="co3-trajectory"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#3a352d"></i>管柱</span><span><i style="background:#b26a39"></i>狗腿 / 遇阻</span><span><i style="background:#a03d4f"></i>当前深度</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>当前工况</h4><span class="iq-mini" id="co3-detail-tag">—</span></div><div id="co3-detail"></div></div>' +
        '</div>' +
        '<div class="iq-main">' +
          '<div class="iq-card iq-timecard">' +
            '<div class="iq-card-h"><h4>下入回放</h4><span class="iq-mini" id="co3-time-mini">—</span></div>' +
            '<div class="iq-timebar">' +
              '<button type="button" class="iq-btn sm" id="co3-tplay">▶ 播放</button>' +
              '<button type="button" class="iq-btn sm" id="co3-step">单步 →</button>' +
              '<input type="range" id="co3-depth" min="0" max="4200" step="20" value="4200" aria-label="下入深度">' +
              '<span class="iq-day" id="co3-depth-lab">4200 m</span>' +
            '</div>' +
            '<div class="iq-note slim" id="co3-depth-note">拖动深度轴查看每个井深处的井斜、钩载与安全系数。</div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>钩载曲线 · 大钩载荷随井深变化</h4><span class="iq-mini" id="co3-force-mini">—</span></div><div id="co3-force"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#3a352d"></i>预测钩载</span><span><i style="background:#f8f1e8"></i>安全窗口</span><span><i style="background:#b05a51"></i>高风险点</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>安全系数与风险热力带</h4><span class="iq-mini">阈值 ' + SF_LIMIT + ' / 1.6</span></div><div id="co3-safety"></div>' +
            '<div class="iq-legend"><span><i style="background:#3a352d"></i>低风险</span><span><i style="background:#a9852f"></i>中风险</span><span><i style="background:#b05a51"></i>高风险</span><span style="margin-left:auto">底部色带按井深分段</span></div></div>' +
        '</div>' +
        '<div class="iq-side">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>输入参数</h4><span class="iq-mini">5 项</span></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>下入速度</span><output id="co3-o-v">0.8 m/s</output></div><input type="range" id="co3-v" min="0.2" max="2" step="0.05" value="0.8"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>摩阻系数</span><output id="co3-o-mu">0.20</output></div><input type="range" id="co3-mu" min="0.05" max="0.40" step="0.01" value="0.20"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>最大井斜角</span><output id="co3-o-inc">40°</output></div><input type="range" id="co3-inc" min="0" max="90" step="1" value="40"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>管柱线重</span><output id="co3-o-w">280 N/m</output></div><input type="range" id="co3-w" min="150" max="450" step="10" value="280"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>完钻井深</span><output id="co3-o-H">4200 m</output></div><input type="range" id="co3-H" min="2000" max="6000" step="100" value="4200"></div>' +
            '<div class="iq-btns"><button class="iq-btn" id="co3-reset">重置</button><button class="iq-btn" id="co3-play">下入动画</button><button class="iq-btn primary" id="co3-ai">采用 AI 速度</button></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>AI 分析输出</h4><span class="iq-mini" id="co3-out-mini">—</span></div>' +
            '<div class="iq-reco" id="co3-reco"></div>' +
            '<div class="iq-kpis">' +
              '<div class="iq-kpi wide"><span>建议下入速度</span><b class="hero" id="co3-k-v">—</b></div>' +
              '<div class="iq-kpi"><span>最大钩载</span><b id="co3-k-f">—</b></div>' +
              '<div class="iq-kpi"><span>最小安全系数</span><b id="co3-k-sf">—</b></div>' +
              '<div class="iq-kpi"><span>预计用时</span><b id="co3-k-time">—</b></div>' +
              '<div class="iq-kpi"><span>高风险井段</span><b id="co3-k-risk">—</b></div>' +
              '<div class="iq-kpi wide"><span>异常检测 · 疑似遇阻点</span><b id="co3-k-anom">—</b></div>' +
            '</div>' +
            '<div class="iq-meter"><i id="co3-conf-bar" style="width:0%"></i></div>' +
            '<div class="iq-meter-row"><span>推荐置信度</span><span id="co3-conf-txt">—</span></div>' +
            '<div class="iq-cmp" id="co3-cmp"></div>' +
            '<div class="iq-note" id="co3-note">—</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-bottom">' +
        '<div class="iq-card"><div class="iq-card-h"><h4>经验速度 vs AI 速度</h4><span class="iq-mini">同一摩阻与井深</span></div><div id="co3-table"></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>结果解释与流程</h4><span class="iq-mini">可复核</span></div><div class="iq-note blue" id="co3-explain">—</div>' +
          '<div class="iq-flow" style="margin-top:8px"><span>测斜数据</span><em>→</em><span>受力积分</span><em>→</em><span>应力校核</span><em>→</em><span>异常检测</span><em>→</em><span>速度决策</span></div>' +
          '<div class="iq-poll">本示范使用合成数据，用于展示智能方法和可视化流程，不代表真实生产结果。</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-extra">' +
        '<div class="iq-card">' +
          '<div class="iq-card-h"><h4>下入速度 × 安全窗口扫描</h4><span class="iq-mini" id="co3-scan-mini">0.20—2.00 m/s</span></div>' +
          '<div id="co3-scan"></div>' +
          '<div class="iq-legend"><span><i class="line" style="background:#3a352d"></i>最小安全系数</span><span><i style="background:#b05a51"></i>低于阈值</span><span><i style="background:#a03d4f"></i>当前速度</span><span><i style="background:#a9852f"></i>AI 建议速度</span></div>' +
          '<div class="iq-note slim" id="co3-scan-note">—</div>' +
        '</div>' +
        '<div class="iq-card">' +
          '<div class="iq-card-h"><h4>关键深度风险清单</h4><span class="iq-mini">按当前参数</span></div>' +
          '<div id="co3-risk"></div>' +
        '</div>' +
      '</div>';

    /* 智能方法说明卡：插在头部下方，数值随参数实时重算 */
    var smartBox = document.createElement('div');
    smartBox.id = 'co3-smart';
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

    /* ---------------- 井眼轨迹 ---------------- */
    function renderTrajectory(cur, opt) {
      var box = $('co3-trajectory');
      box.innerHTML = '';
      var W = 300, H = 330, M = { t: 22, r: 16, b: 34, l: 40 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '井眼轨迹与管柱下入位置');
      var arr = cur.arr, st = state;
      var maxDisp = Math.max(d3.max(arr, function (p) { return p.disp; }), 100);
      var x = d3.scaleLinear().domain([0, maxDisp * 1.12]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([0, st.H]).range([M.t, H - M.b]);
      var grid = d3.range(0, st.H + 1, Math.max(500, Math.round(st.H / 7 / 500) * 500));
      svg.selectAll('.gl').data(grid).enter().append('line')
        .attr('x1', M.l).attr('x2', W - M.r).attr('y1', function (g) { return y(g); }).attr('y2', function (g) { return y(g); })
        .attr('stroke', '#f1eee6').attr('stroke-width', 1);
      svg.selectAll('.gt').data(grid).enter().append('text')
        .attr('x', M.l - 4).attr('y', function (g) { return y(g) + 3; })
        .attr('text-anchor', 'end').attr('font-size', 8).attr('fill', '#9ba3a9')
        .attr('font-family', 'ui-monospace,monospace')
        .text(function (g) { return g; });
      svg.append('text').attr('x', M.l).attr('y', 13).attr('font-size', 8.5).attr('fill', '#9ba3a9').text('井深 (m)');
      svg.append('text').attr('x', W - M.r).attr('y', H - 8).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', '#9ba3a9').text('水平位移 (m) →');

      var line = d3.line().x(function (p) { return x(p.disp); }).y(function (p) { return y(p.s); });
      /* 井眼（浅色，始终完整） */
      svg.append('path').attr('d', line(arr)).attr('fill', 'none')
        .attr('stroke', '#e9e6dc').attr('stroke-width', 6).attr('stroke-linecap', 'round');
      /* 已下入的管柱（深色，随深度增长） */
      var run = sliceTo(arr, depthNow);
      if (run.length > 1) {
        svg.append('path').attr('d', line(run)).attr('fill', 'none')
          .attr('stroke', '#3a352d').attr('stroke-width', 2.4).attr('stroke-linecap', 'round');
        /* 管柱底端（引鞋）画一个小方块，位置随深度下移 */
        var foot = run[run.length - 1];
        svg.append('rect').attr('x', x(foot.disp) - 3.4).attr('y', y(foot.s) - 3.4)
          .attr('width', 6.8).attr('height', 6.8).attr('rx', 1.2)
          .attr('fill', '#3a352d').attr('stroke', '#fff').attr('stroke-width', 1.2);
      }

      /* 高风险井段色带 */
      cur.sum.highRuns.forEach(function (r) {
        var y0 = y(r.from), y1 = y(r.to);
        svg.append('rect').attr('x', M.l).attr('y', y0).attr('width', W - M.l - M.r)
          .attr('height', Math.max(2, y1 - y0)).attr('fill', '#b05a51').attr('opacity', 0.12);
        svg.append('text').attr('x', M.l + 4).attr('y', (y0 + y1) / 2 + 3)
          .attr('font-size', 7.6).attr('fill', '#b05a51').text('高风险');
      });

      /* 狗腿 / 遇阻点 */
      var anom = cur.sum.anomaly;
      var anomPoint = arr.reduce(function (a, p) { return Math.abs(p.s - anom.s) < Math.abs(a.s - anom.s) ? p : a; }, arr[0]);
      svg.append('circle').attr('cx', x(anomPoint.disp)).attr('cy', y(anomPoint.s)).attr('r', 3.6)
        .attr('fill', '#b26a39').attr('stroke', '#fff').attr('stroke-width', 1.4);
      var ax = x(anomPoint.disp), ay = y(anomPoint.s);
      var aLeft = ax > W * 0.55;
      svg.append('text').attr('x', aLeft ? ax - 6 : ax + 6).attr('y', ay + 3)
        .attr('text-anchor', aLeft ? 'end' : 'start')
        .attr('font-size', 8).attr('fill', '#b26a39').text('遇阻 ' + Math.round(anom.s) + ' m');

      /* 当前下入深度 */
      var curPoint = arr.reduce(function (a, p) { return Math.abs(p.s - depthNow) < Math.abs(a.s - depthNow) ? p : a; }, arr[0]);
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r)
        .attr('y1', y(depthNow)).attr('y2', y(depthNow))
        .attr('stroke', '#a03d4f').attr('stroke-width', 1).attr('stroke-dasharray', '3 3').attr('opacity', 0.55);
      svg.append('circle').attr('cx', x(curPoint.disp)).attr('cy', y(curPoint.s)).attr('r', 4.2)
        .attr('fill', '#a03d4f').attr('stroke', '#fff').attr('stroke-width', 1.5);
      var cLeft = x(curPoint.disp) > W * 0.55;
      svg.append('text').attr('x', cLeft ? x(curPoint.disp) - 6 : x(curPoint.disp) + 6).attr('y', y(curPoint.s) - 5)
        .attr('text-anchor', cLeft ? 'end' : 'start')
        .attr('font-size', 8).attr('fill', '#a03d4f').text('当前 ' + Math.round(depthNow) + ' m');

      $('co3-tr-mini').textContent = st.H + ' m · ' + st.inc + '°';
    }

    /* ---------------- 钩载曲线 ---------------- */
    function renderForce(cur) {
      var box = $('co3-force');
      box.innerHTML = '';
      var W = 640, H = 264, M = { t: 18, r: 18, b: 36, l: 50 };
      var arr = cur.arr;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '钩载随井深变化曲线');
      var x = d3.scaleLinear().domain([0, state.H]).range([M.l, W - M.r]);
      var fmax = Math.max(d3.max(arr, function (p) { return p.F; }) * 1.16, UPPER * 0.6);
      var y = d3.scaleLinear().domain([0, fmax]).range([H - M.b, M.t]);

      /* 安全窗口 */
      svg.append('rect').attr('x', M.l).attr('y', y(UPPER)).attr('width', W - M.l - M.r)
        .attr('height', Math.max(0, y(LOWER) - y(UPPER))).attr('fill', '#f8f1e8').attr('opacity', 0.7);
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(LOWER)).attr('y2', y(LOWER))
        .attr('stroke', '#3a352d').attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
      svg.append('text').attr('x', W - M.r - 4).attr('y', y(LOWER) - 4).attr('text-anchor', 'end')
        .attr('font-size', 8.5).attr('fill', '#3a352d').text('最小钩载 ' + LOWER + ' kN');

      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(6).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('text').attr('x', M.l).attr('y', 11).attr('font-size', 9).attr('fill', '#9ba3a9').text('钩载 (kN)');
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#9ba3a9').text('井深 (m) →');

      var line = d3.line().x(function (p) { return x(p.s); }).y(function (p) { return y(p.F); });
      /* 未下入段：淡色参考线；已下入段：实色，随动画推进 */
      svg.append('path').attr('d', line(arr)).attr('fill', 'none')
        .attr('stroke', '#e9e6dc').attr('stroke-width', 1.8);
      var runF = sliceTo(arr, depthNow);
      if (runF.length > 1) {
        svg.append('path').attr('d', line(runF)).attr('fill', 'none')
          .attr('stroke', '#3a352d').attr('stroke-width', 2.2).attr('stroke-linecap', 'round');
      }
      /* 高风险点 */
      svg.selectAll('.riskdot').data(arr.filter(function (p) { return p.risk === 'high'; })).enter().append('circle')
        .attr('cx', function (p) { return x(p.s); }).attr('cy', function (p) { return y(p.F); }).attr('r', 1.9)
        .attr('fill', '#b05a51');
      /* 异常点 */
      var anom = cur.sum.anomaly;
      var ap = arr.reduce(function (a, p) { return Math.abs(p.s - anom.s) < Math.abs(a.s - anom.s) ? p : a; }, arr[0]);
      svg.append('circle').attr('cx', x(ap.s)).attr('cy', y(ap.F)).attr('r', 4.2)
        .attr('fill', 'none').attr('stroke', '#b26a39').attr('stroke-width', 2);
      svg.append('text').attr('x', x(ap.s)).attr('y', y(ap.F) - 9).attr('text-anchor', 'middle')
        .attr('font-size', 8.5).attr('fill', '#b26a39').text('遇阻残差 ' + anom.res.toFixed(0) + ' kN');
      /* 当前深度 */
      svg.append('line').attr('x1', x(depthNow)).attr('x2', x(depthNow)).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#a03d4f').attr('stroke-width', 1).attr('stroke-dasharray', '3 3');
      var cp = arr.reduce(function (a, p) { return Math.abs(p.s - depthNow) < Math.abs(a.s - depthNow) ? p : a; }, arr[0]);
      svg.append('circle').attr('cx', x(cp.s)).attr('cy', y(cp.F)).attr('r', 3.6)
        .attr('fill', '#a03d4f').attr('stroke', '#fff').attr('stroke-width', 1.2);

      /* 悬停提示 */
      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var depth = clamp(x.invert(mx), 0, state.H);
        var p = arr.reduce(function (a, q) { return Math.abs(q.s - depth) < Math.abs(a.s - depth) ? q : a; }, arr[0]);
        tipShow('井深 <b>' + Math.round(p.s) + '</b> m · 井斜 <b>' + p.inc.toFixed(1) + '</b>°<br>钩载 <b>' + p.F.toFixed(0) + '</b> kN · 安全系数 <b>' + p.sf.toFixed(2) + '</b>', ev);
      }).on('mouseleave', tipHide);

      $('co3-force-mini').textContent = '末钩载 ' + cur.sum.endF.toFixed(0) + ' kN · 峰值 ' + cur.sum.maxF.toFixed(0) + ' kN';
    }

    /* ---------------- 安全系数与热力带 ---------------- */
    function renderSafety(cur) {
      var box = $('co3-safety');
      box.innerHTML = '';
      var W = 640, H = 212, M = { t: 16, r: 16, b: 38, l: 44 };
      var arr = cur.arr;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '安全系数曲线与井深风险热力带');
      var x = d3.scaleLinear().domain([0, state.H]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([0, 8]).range([H - M.b - 20, M.t]);

      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(4).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(SF_LIMIT)).attr('y2', y(SF_LIMIT))
        .attr('stroke', '#b05a51').attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
      svg.append('text').attr('x', M.l + 4).attr('y', y(SF_LIMIT) - 4).attr('font-size', 8.5).attr('fill', '#b05a51')
        .text('安全阈值 ' + SF_LIMIT.toFixed(1));
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(1.6)).attr('y2', y(1.6))
        .attr('stroke', '#a9852f').attr('stroke-dasharray', '2 3').attr('stroke-width', 1);

      var line = d3.line().x(function (p) { return x(p.s); }).y(function (p) { return y(Math.min(p.sf, 8)); });
      svg.append('path').attr('d', line(arr)).attr('fill', 'none')
        .attr('stroke', '#e9e6dc').attr('stroke-width', 1.8);
      var runS = sliceTo(arr, depthNow);
      if (runS.length > 1) {
        svg.append('path').attr('d', line(runS)).attr('fill', 'none')
          .attr('stroke', '#3a352d').attr('stroke-width', 2).attr('stroke-linecap', 'round');
      }

      /* 热力带 */
      var bandY = H - M.b - 12, bandH = 10;
      var bw = (W - M.l - M.r) / arr.length;
      svg.selectAll('.hb').data(arr).enter().append('rect')
        .attr('x', function (p) { return x(p.s) - bw / 2; }).attr('y', bandY)
        .attr('width', bw + 0.5).attr('height', bandH)
        .attr('fill', function (p) { return p.risk === 'high' ? '#b05a51' : (p.risk === 'mid' ? '#a9852f' : '#cfe3d9'); });
      svg.append('text').attr('x', M.l - 6).attr('y', bandY + bandH - 1).attr('text-anchor', 'end')
        .attr('font-size', 8).attr('fill', '#9ba3a9').text('风险带');

      svg.append('line').attr('x1', x(depthNow)).attr('x2', x(depthNow)).attr('y1', M.t).attr('y2', bandY + bandH)
        .attr('stroke', '#a03d4f').attr('stroke-dasharray', '3 3').attr('stroke-width', 1);

      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(6).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('text').attr('x', M.l).attr('y', 11).attr('font-size', 9).attr('fill', '#9ba3a9').text('安全系数');
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#9ba3a9').text('井深 (m) →');
    }

    /* ---------------- 下入回放 ---------------- */
    /* 按当前下入深度截断曲线：折线只画到 depthNow，并补一个插值端点，
       这样播放动画时实线是“长出来”的，而不是整条曲线一直铺在那里。 */
    function sliceTo(arr, d) {
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].s <= d) out.push(arr[i]);
        else break;
      }
      if (out.length && out.length < arr.length) {
        var p0 = out[out.length - 1], p1 = arr[out.length];
        var t = clamp((d - p0.s) / Math.max(p1.s - p0.s, 1e-6), 0, 1);
        out.push({
          s: d,
          disp: p0.disp + (p1.disp - p0.disp) * t,
          inc: p0.inc + (p1.inc - p0.inc) * t,
          F: p0.F + (p1.F - p0.F) * t,
          sf: p0.sf + (p1.sf - p0.sf) * t,
          risk: p0.risk
        });
      }
      return out;
    }

    function depthPoint(arr) {
      return arr.reduce(function (a, p) { return Math.abs(p.s - depthNow) < Math.abs(a.s - depthNow) ? p : a; }, arr[0]);
    }

    function renderDepth(cur) {
      var cp = depthPoint(cur.arr);
      $('co3-depth-lab').textContent = Math.round(depthNow) + ' m';
      var tl = $('co3-depth');
      if (tl) {
        if (Number(tl.max) !== state.H) tl.max = state.H;
        if (Number(tl.value) !== Math.round(depthNow)) tl.value = Math.round(depthNow);
      }
      var note = $('co3-depth-note');
      var inHigh = cur.sum.highRuns.filter(function (r) { return depthNow >= r.from && depthNow <= r.to; })[0];
      var anom = cur.sum.anomaly;
      if (inHigh) {
        note.className = 'iq-note slim red';
        note.innerHTML = '<b>进入高风险井段 ' + Math.round(inHigh.from) + '—' + Math.round(inHigh.to) + ' m：</b>当前安全系数 ' +
          cp.sf.toFixed(2) + '，低于阈值 ' + SF_LIMIT.toFixed(1) + '。建议降低下放速度、增加短起下或更换高钢级管柱。';
      } else if (Math.abs(depthNow - anom.s) <= 40) {
        note.className = 'iq-note slim clay';
        note.innerHTML = '<b>接近疑似遇阻点 ' + Math.round(anom.s) + ' m：</b>钩载相对滑动平均下掉 ' +
          Math.abs(anom.res).toFixed(0) + ' kN，建议现场结合指重表复核。';
      } else {
        note.className = 'iq-note slim';
        note.innerHTML = '<b>当前 ' + Math.round(depthNow) + ' m：</b>井斜 ' + cp.inc.toFixed(1) + '° · 钩载 ' +
          cp.F.toFixed(0) + ' kN · 安全系数 ' + cp.sf.toFixed(2) + '（阈值 ' + SF_LIMIT.toFixed(1) + '）。';
      }
      $('co3-time-mini').textContent = Math.round(depthNow) + ' / ' + state.H + ' m' + (playing ? ' · 下入中' : '');
    }

    /* ---------------- 输出 ---------------- */
    function renderOutput(cur, opt, conf) {
      var st = state;
      $('co3-k-v').innerHTML = opt.v.toFixed(2) + '<small>m/s</small>';
      $('co3-k-f').innerHTML = cur.sum.maxF.toFixed(0) + '<small>kN</small>';
      var sfEl = $('co3-k-sf');
      sfEl.textContent = cur.sum.minSF.toFixed(2);
      sfEl.className = cur.sum.minSF >= 2.4 ? 'ok' : (cur.sum.minSF >= SF_LIMIT ? 'warn' : 'bad');
      $('co3-k-time').innerHTML = (st.H / st.v / 3600).toFixed(1) + '<small>h</small>';
      var rt = riskText(cur.sum.highRuns);
      var riskEl = $('co3-k-risk');
      riskEl.textContent = rt;
      riskEl.className = rt === '无' ? 'ok' : 'bad';
      riskEl.style.fontSize = rt === '无' ? '' : '11.5px';
      $('co3-k-anom').innerHTML = Math.round(cur.sum.anomaly.s) + '<small>m · 残差 ' + cur.sum.anomaly.res.toFixed(0) + ' kN</small>';
      $('co3-k-anom').style.fontSize = '13px';

      $('co3-conf-bar').style.width = conf + '%';
      $('co3-conf-bar').className = conf >= 75 ? '' : (conf >= 55 ? 'warn' : 'bad');
      $('co3-conf-txt').textContent = '最小系数余量 ' + (cur.sum.minSF - SF_LIMIT).toFixed(2) + ' · 末端钩载 ' + cur.sum.endF.toFixed(0) + ' kN';

      /* 推荐方案卡：把 AI 给出的速度、安全裕度与用时单独拎出来，作为可执行结论。
         扫描不到可行档位时不能打“AI 推荐”标签，只能标为参考解并说明卡在哪条约束。 */
      $('co3-reco').innerHTML =
        '<span class="tag">' + (opt.ok ? 'AI 推荐' : '参考解 · 不满足安全窗口') + '</span>' +
        '<b>' + opt.v.toFixed(2) + ' m/s</b>' +
        '<span>安全系数 ' + opt.sum.minSF.toFixed(2) + '（阈值 ' + SF_LIMIT.toFixed(1) + '）· 用时 ' +
        (st.H / opt.v / 3600).toFixed(1) + ' h</span>';

      /* 前后对比：经验速度 0.60 m/s 与 AI 速度的下入用时 */
      var expTime = st.H / BASE_SPEED / 3600, aiTime = st.H / opt.v / 3600;
      var tMax = Math.max(expTime, aiTime, 0.1);
      var save = (expTime - aiTime) / Math.max(expTime, 0.01) * 100;
      $('co3-cmp').innerHTML =
        '<div class="iq-cmp-h"><span>前后对比 · 下入用时 (h)</span>' +
        '<span class="delta' + (save < 0 ? ' bad' : '') + '">' + (save >= 0 ? '省 ' : '多 ') + Math.abs(save).toFixed(0) + '%</span></div>' +
        '<div class="iq-cmp-row"><span class="lb">经验速度</span>' +
        '<div class="tr"><i style="width:' + (expTime / tMax * 100).toFixed(1) + '%"></i></div>' +
        '<b>' + expTime.toFixed(1) + '</b></div>' +
        '<div class="iq-cmp-row ai"><span class="lb">AI 速度</span>' +
        '<div class="tr"><i class="ai" style="width:' + (aiTime / tMax * 100).toFixed(1) + '%"></i></div>' +
        '<b>' + aiTime.toFixed(1) + '</b></div>';
      $('co3-out-mini').textContent = '速度扫描 ' + opt.scanned + ' 组' + (opt.ok ? '' : ' · 无可行档');
      $('co3-detail-tag').textContent = cur.sum.minSF >= SF_LIMIT ? '安全窗口内' : '超出安全阈值';

      $('co3-detail').innerHTML =
        '<table class="iq-table">' +
        '<tr><td>下入速度</td><td class="num">' + st.v.toFixed(2) + ' m/s</td></tr>' +
        '<tr><td>末端钩载</td><td class="num">' + cur.sum.endF.toFixed(0) + ' kN</td></tr>' +
        '<tr><td>最小安全系数</td><td class="num ' + (cur.sum.minSF >= SF_LIMIT ? 'ok' : 'bad') + '">' + cur.sum.minSF.toFixed(2) + '</td></tr>' +
        '<tr><td>最大井斜</td><td class="num">' + st.inc + '°</td></tr>' +
        '<tr><td>预计用时</td><td class="num">' + (st.H / st.v / 3600).toFixed(1) + ' h</td></tr>' +
        '</table>' +
        '<p class="iq-poll" style="margin-top:6px">当前摩阻系数 ' + st.mu.toFixed(2) + '；AI 建议速度 ' + opt.v.toFixed(2) + ' m/s。</p>';

      var note = $('co3-note');
      if (!opt.ok) {
        var bind = opt.sum.minSF < SF_LIMIT ? '最小安全系数 ' + opt.sum.minSF.toFixed(2) + ' 低于阈值 ' + SF_LIMIT.toFixed(1)
          : (opt.sum.endF < LOWER ? '末端钩载 ' + opt.sum.endF.toFixed(0) + ' kN 低于下限 ' + LOWER + ' kN'
            : '最大钩载 ' + opt.sum.maxF.toFixed(0) + ' kN 超过上限 ' + UPPER + ' kN');
        note.className = 'iq-note red';
        note.innerHTML = '<b>无可行速度：</b>' + opt.scanned + ' 档速度全部越界——最接近的一档仍以 ' + bind +
          ' 卡住。下面的速度是“最接近安全窗口”的参考解，不能直接下达。建议减小狗腿、降摩阻（加润滑）或换高钢级管柱后重扫。';
      } else if (cur.sum.minSF < 1.6) {
        note.className = 'iq-note red';
        note.innerHTML = '<b>高风险：</b>最小安全系数 ' + cur.sum.minSF.toFixed(2) + '，低于 1.6，存在弯曲应力超限风险。建议降低下入速度、减小狗腿或更换高钢级管柱。';
      } else if (cur.sum.endF < LOWER) {
        note.className = 'iq-note red';
        note.innerHTML = '<b>自锁风险：</b>末端钩载仅 ' + cur.sum.endF.toFixed(0) + ' kN，低于下限 ' + LOWER + ' kN。大斜度段摩阻吃掉自重，继续下放可能无法到位。';
      } else if (cur.sum.highRuns.length) {
        note.className = 'iq-note clay';
        note.innerHTML = '<b>需关注：</b>存在高风险井段 ' + riskText(cur.sum.highRuns) + '，建议降低下放速度或增加短起下。AI 速度 ' + opt.v.toFixed(2) + ' m/s 可避开该风险。';
      } else {
        note.className = 'iq-note';
        note.innerHTML = '<b>结论：</b>当前参数下管柱受力在安全窗口内，最小安全系数 ' + cur.sum.minSF.toFixed(2) + '。AI 建议以 ' + opt.v.toFixed(2) + ' m/s 下入，用时 ' + (st.H / opt.v / 3600).toFixed(1) + ' h。';
      }

      var ex = $('co3-explain');
      var delta = opt.v - st.v;
      ex.innerHTML = '<b>速度为什么影响安全：</b>下入速度越高，经过狗腿时的弯曲与冲击越强，本模型把速度计入狗腿附加曲率，因此安全系数随速度下降。' +
        'AI 在 ' + opt.scanned + ' 个速度档中筛选“安全系数 ≥ ' + SF_LIMIT + ' 且钩载 ≥ ' + LOWER + ' kN”的最快档，得到 ' + opt.v.toFixed(2) + ' m/s，较当前 ' + st.v.toFixed(2) + ' m/s ' + (delta >= 0 ? '快 ' : '慢 ') + Math.abs(delta).toFixed(2) + ' m/s。' +
        '<br><b>异常检测：</b>井深 ' + Math.round(cur.sum.anomaly.s) + ' m 处钩载相对滑动平均下掉 ' + Math.abs(cur.sum.anomaly.res).toFixed(0) + ' kN，被标为疑似遇阻点，建议现场结合指重表复核。';

      var b = summarize(buildProfile(state, BASE_SPEED), state);
      $('co3-table').innerHTML =
        '<table class="iq-table">' +
        '<tr><th>指标</th><th>经验速度 ' + BASE_SPEED.toFixed(2) + ' m/s</th><th>AI 速度 ' + opt.v.toFixed(2) + ' m/s</th><th>变化</th></tr>' +
        '<tr><td>预计用时</td><td class="num">' + (st.H / BASE_SPEED / 3600).toFixed(1) + ' h</td><td class="num">' + (st.H / opt.v / 3600).toFixed(1) + ' h</td><td class="num">' + ((st.H / opt.v - st.H / BASE_SPEED) / 3600).toFixed(1) + ' h</td></tr>' +
        '<tr><td>最小安全系数</td><td class="num">' + b.minSF.toFixed(2) + '</td><td class="num">' + opt.sum.minSF.toFixed(2) + '</td><td class="num">' + (opt.sum.minSF - b.minSF >= 0 ? '+' : '') + (opt.sum.minSF - b.minSF).toFixed(2) + '</td></tr>' +
        '<tr><td>末端钩载</td><td class="num">' + b.endF.toFixed(0) + ' kN</td><td class="num">' + opt.sum.endF.toFixed(0) + ' kN</td><td class="num">' + (opt.sum.endF - b.endF).toFixed(0) + ' kN</td></tr>' +
        '<tr class="hl"><td>高风险井段</td><td class="num">' + riskText(b.highRuns) + '</td><td class="num">' + riskText(opt.sum.highRuns) + '</td><td class="num">' + (opt.sum.highRuns.length < b.highRuns.length ? '减少' : (opt.sum.highRuns.length > b.highRuns.length ? '增加' : '持平')) + '</td></tr>' +
        '</table>' +
        '<p class="iq-poll">经验速度取 0.60 m/s；两者使用同一受力模型与摩阻系数。</p>';
    }

    /* ---------------- 学习层：速度扫描安全窗口 ---------------- */
    function renderScan(cur, opt) {
      var box = $('co3-scan');
      box.innerHTML = '';
      var pts = [], vv;
      for (vv = 0.2; vv <= 2.001; vv += 0.05) {
        var a = buildProfile(state, vv);
        var sm = summarize(a, state);
        pts.push({
          v: Math.round(vv * 100) / 100, sf: sm.minSF, endF: sm.endF,
          ok: sm.minSF >= SF_LIMIT && sm.endF >= LOWER && sm.maxF <= UPPER
        });
      }
      var W = 640, H = 252, M = { t: 18, r: 20, b: 40, l: 48 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '下入速度与最小安全系数扫描');
      var x = d3.scaleLinear().domain([0.2, 2.0]).range([M.l, W - M.r]);
      var sfMax = Math.max(4, Math.ceil(d3.max(pts, function (p) { return p.sf; })));
      var y = d3.scaleLinear().domain([0, sfMax]).range([H - M.b, M.t]);

      svg.append('rect').attr('x', M.l).attr('y', M.t).attr('width', W - M.l - M.r)
        .attr('height', Math.max(0, y(SF_LIMIT) - M.t)).attr('fill', '#f8f1e8').attr('opacity', 0.6);
      svg.append('text').attr('x', M.l + 4).attr('y', M.t + 10).attr('font-size', 8.5)
        .attr('fill', '#3a352d').text('安全区：最小安全系数 ≥ ' + SF_LIMIT.toFixed(1));

      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(4).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(7).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('text').attr('x', M.l).attr('y', 12).attr('font-size', 9).attr('fill', '#9ba3a9').text('最小安全系数');
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#9ba3a9').text('下入速度 (m/s) →');

      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(SF_LIMIT)).attr('y2', y(SF_LIMIT))
        .attr('stroke', '#b05a51').attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(1.6)).attr('y2', y(1.6))
        .attr('stroke', '#a9852f').attr('stroke-dasharray', '2 3').attr('stroke-width', 1);

      var line = d3.line().x(function (p) { return x(p.v); }).y(function (p) { return y(Math.min(p.sf, sfMax)); });
      svg.append('path').attr('d', line(pts)).attr('fill', 'none').attr('stroke', '#3a352d').attr('stroke-width', 2.2);

      svg.selectAll('.bad').data(pts.filter(function (p) { return p.sf < SF_LIMIT; })).enter().append('circle')
        .attr('cx', function (p) { return x(p.v); }).attr('cy', function (p) { return y(Math.min(p.sf, sfMax)); })
        .attr('r', 2).attr('fill', '#b05a51');

      var bandY = H - M.b - 13, bw = (W - M.l - M.r) / pts.length;
      svg.selectAll('.okband').data(pts).enter().append('rect')
        .attr('x', function (p, i) { return M.l + i * bw; }).attr('y', bandY)
        .attr('width', Math.max(1, bw - 0.5)).attr('height', 7)
        .attr('fill', function (p) { return p.ok ? '#3a352d' : (p.sf >= SF_LIMIT ? '#a9852f' : '#d8b2ad'); })
        .attr('opacity', 0.85);
      svg.append('text').attr('x', M.l - 6).attr('y', bandY + 6).attr('text-anchor', 'end')
        .attr('font-size', 8).attr('fill', '#9ba3a9').text('可行');

      if (state.v >= 0.2 && state.v <= 2.0) {
        svg.append('line').attr('x1', x(state.v)).attr('x2', x(state.v)).attr('y1', M.t).attr('y2', bandY + 7)
          .attr('stroke', '#a03d4f').attr('stroke-width', 1.2).attr('stroke-dasharray', '3 3');
        svg.append('text').attr('x', x(state.v) + 4).attr('y', M.t + 24).attr('font-size', 8.5)
          .attr('fill', '#a03d4f').text('当前 ' + state.v.toFixed(2));
      }
      svg.append('line').attr('x1', x(opt.v)).attr('x2', x(opt.v)).attr('y1', M.t).attr('y2', bandY + 7)
        .attr('stroke', '#a9852f').attr('stroke-width', 1.6);
      svg.append('text').attr('x', x(opt.v) + 4).attr('y', M.t + 38).attr('font-size', 8.5)
        .attr('fill', '#a9852f').text('AI ' + opt.v.toFixed(2));

      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b - 14)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var vNear = clamp(x.invert(mx), 0.2, 2.0);
        var p = pts.reduce(function (a, q) { return Math.abs(q.v - vNear) < Math.abs(a.v - vNear) ? q : a; }, pts[0]);
        tipShow('速度 <b>' + p.v.toFixed(2) + '</b> m/s<br>最小安全系数 <b>' + p.sf.toFixed(2) + '</b><br>末端钩载 <b>' +
          p.endF.toFixed(0) + '</b> kN · ' + (p.ok ? '在安全窗口内' : '不满足全部约束'), ev);
      }).on('mouseleave', tipHide);

      var okN = pts.filter(function (p) { return p.ok; }).length;
      $('co3-scan-mini').textContent = pts.length + ' 档速度 · ' + okN + ' 档可行';
      $('co3-scan-note').innerHTML = '当前 <b>' + state.v.toFixed(2) + '</b> m/s 的最小安全系数 <b>' + cur.sum.minSF.toFixed(2) +
        '</b>；AI 建议 <b>' + opt.v.toFixed(2) + '</b> m/s，最小安全系数 <b>' + opt.sum.minSF.toFixed(2) +
        '</b>。绿色短条 = 同时满足安全系数、钩载上下限的可行档位。';
    }

    /* ---------------- 学习层：关键深度风险清单 ---------------- */
    function renderRiskList(cur, opt) {
      var rows = [];
      cur.sum.highRuns.forEach(function (r) {
        var seg = cur.arr.filter(function (p) { return p.s >= r.from && p.s <= r.to; });
        var mp = seg.reduce(function (a, p) { return p.sf < a.sf ? p : a; }, seg[0] || cur.arr[0]);
        rows.push(['<b>' + Math.round(r.from) + '—' + Math.round(r.to) + ' m</b>', '高风险井段 · 最低 SF ' +
          mp.sf.toFixed(2) + '（' + Math.round(mp.s) + ' m）', '降速 / 短起下 / 高钢级管柱']);
      });
      var anom = cur.sum.anomaly;
      rows.push(['<b>' + Math.round(anom.s) + ' m</b>', '疑似遇阻点 · 钩载残差 ' + Math.abs(anom.res).toFixed(0) + ' kN', '指重表复核，确认后短起下']);
      var valid = cur.arr.filter(function (p) { return p.s > state.H * 0.05; });
      var minP = valid.reduce(function (a, p) { return p.sf < a.sf ? p : a; }, valid[0] || cur.arr[0]);
      rows.push(['<b>' + Math.round(minP.s) + ' m</b>', '最小安全系数 ' + minP.sf.toFixed(2) + '（阈值 ' + SF_LIMIT.toFixed(1) + '）',
        minP.sf < 1.6 ? '已低于 1.6，必须调整参数' : (minP.sf < SF_LIMIT ? '低于阈值，建议降速' : '在安全窗口内，保持监控')]);
      $('co3-risk').innerHTML =
        '<table class="iq-table"><tr><th>深度</th><th>现象</th><th>处理建议</th></tr>' +
        rows.map(function (r) {
          return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
        }).join('') + '</table>' +
        '<p class="iq-poll">清单直接取自当前参数下的受力计算结果：' +
        (cur.sum.highRuns.length ? cur.sum.highRuns.length + ' 段高风险、' : '无高风险井段、') +
        '1 个疑似遇阻点。AI 速度 ' + opt.v.toFixed(2) + ' m/s 下最小 SF 为 ' + opt.sum.minSF.toFixed(2) + '。</p>';
    }

    /* ---------------- 状态与渲染 ---------------- */
    function readState() {
      state.v = Number($('co3-v').value);
      state.mu = Number($('co3-mu').value);
      state.inc = Number($('co3-inc').value);
      state.w = Number($('co3-w').value);
      state.H = Number($('co3-H').value);
      $('co3-o-v').textContent = state.v.toFixed(2) + ' m/s';
      $('co3-o-mu').textContent = state.mu.toFixed(2);
      $('co3-o-inc').textContent = state.inc + '°';
      $('co3-o-w').textContent = state.w + ' N/m';
      $('co3-o-H').textContent = state.H + ' m';
    }

    /* 智能方法说明：数值来自本轮受力模型与逐档速度扫描 */
    function renderSmart(cur, opt, conf) {
      if (!window.IQSmart || !smartBox) return;
      var b = summarize(buildProfile(state, BASE_SPEED), state);
      var expTime = state.H / BASE_SPEED / 3600, aiTime = state.H / opt.v / 3600;
      function up(a, bv, unit) {
        var d = bv - a;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(2) + (unit || ''), cls: d >= 0 ? 'ok' : 'bad' };
      }
      function down(a, bv, unit) {
        var d = bv - a;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(2) + (unit || ''), cls: d <= 0 ? 'ok' : 'bad' };
      }
      var rows = [
        { cells: ['下入速度 (m/s)', BASE_SPEED.toFixed(2), opt.v.toFixed(2), up(BASE_SPEED, opt.v), '经验速度取现场常用值'] },
        { cells: ['预计用时 (h)', expTime.toFixed(1), aiTime.toFixed(1), down(expTime, aiTime), '—'] },
        { cells: ['最小安全系数', b.minSF.toFixed(2), opt.sum.minSF.toFixed(2), up(b.minSF, opt.sum.minSF), { v: '阈值 ' + SF_LIMIT.toFixed(1), cls: opt.sum.minSF >= SF_LIMIT ? 'ok' : 'bad' }] },
        { cells: ['末端钩载 (kN)', b.endF.toFixed(0), opt.sum.endF.toFixed(0), up(b.endF, opt.sum.endF), { v: '下限 ' + LOWER + ' kN', cls: opt.sum.endF >= LOWER ? 'ok' : 'bad' }] },
        { cells: ['高风险井段', riskText(b.highRuns), riskText(opt.sum.highRuns), '—', { v: opt.sum.highRuns.length ? '仍有风险段' : '安全窗口内', cls: opt.sum.highRuns.length ? 'bad' : 'ok' }] },
        { cells: ['推荐置信度', '—', conf + '%', '—', opt.scanned + ' 档 · 可行 ' + opt.feasibleCount + ' 档'], hl: true }
      ];
      smartBox.innerHTML = window.IQSmart.render({
        kicker: 'SMART METHOD · MECHANICS + SCAN',
        title: '一维管柱力学代理模型 + 安全窗口扫描',
        subtitle: '沿井深逐段积分自重、摩阻与弯曲应力，再逐档扫描下入速度',
        badge: '可行档 ' + opt.feasibleCount + ' / ' + opt.scanned,
        /* 主视觉：37 档速度逐档试算的可行性带 + 安全系数曲线 */
        algoSvg: window.IQAlgo ? window.IQAlgo.band({
          title: '下入速度逐档试算：绿色 = 同时满足安全系数与钩载上下限',
          items: opt.sweep,
          pickIdx: Math.max(0, Math.round((opt.v - 0.2) / 0.05)),
          pickLabel: 'AI ' + opt.v.toFixed(2) + ' m/s',
          series: opt.sweep.map(function (x) { return x.sf; }),
          threshold: SF_LIMIT,
          thresholdLabel: '安全系数阈值 ' + SF_LIMIT.toFixed(1),
          seriesLabel: '下方曲线 = 该速度下的最小安全系数',
          xLabel: ['0.20 m/s', '2.00 m/s']
        }) : '',
        algoCap: '<span><i style="background:rgba(53,120,90,.55)"></i>可行档</span>' +
          '<span><i style="background:rgba(168,82,73,.38)"></i>越界档</span>' +
          '<span><i style="background:#b26a39"></i>最小安全系数曲线</span>' +
          '<span>越靠右速度越快、用时越短，但安全裕度越低</span>',
        input: '井深、井斜、摩阻系数、管柱线重、下入速度',
        output: '沿井深钩载、安全系数、高风险井段、疑似遇阻点与建议速度',
        problem: '工况组合多，逐工况商用软件计算慢；现场常按最保守速度下单，牺牲效率',
        fit: '机理模型可批量计算全部速度档，安全窗口与风险段自动识别，结果可逐段追溯',
        flow: ['测斜 / 管柱参数', '逐段受力积分', '弯曲应力与安全系数', '安全窗口约束', '建议下入速度', '指重表复核'],
        trace: [
          ['扫描档位', opt.scanned + ' 档'],
          ['安全窗口内', opt.feasibleCount + ' 档'],
          ['最小安全系数', opt.sum.minSF.toFixed(2) + ' / ' + SF_LIMIT.toFixed(1)],
          ['末端钩载', opt.sum.endF.toFixed(0) + ' kN'],
          ['计算井段', buildProfile(state, opt.v).length + ' 段']
        ],
        compare: {
          title: '经验速度 ' + BASE_SPEED.toFixed(2) + ' m/s vs AI 速度 ' + opt.v.toFixed(2) + ' m/s',
          columns: ['指标', '经验速度', 'AI 速度', '变化', '约束 / 说明'],
          rows: rows,
          note: '两者使用同一受力模型、同一摩阻系数与同一井深；只改变下入速度。'
        },
        why: [
          '速度被计入狗腿段的附加曲率：速度越高，经过狗腿时的弯曲与冲击越强，安全系数越低，所以不能简单“越快越好”。',
          '扫描 ' + opt.scanned + ' 档速度后，模型选取“安全系数 ≥ ' + SF_LIMIT.toFixed(1) + ' 且末端钩载 ≥ ' + LOWER + ' kN”的最快档，得到 ' + opt.v.toFixed(2) + ' m/s。',
          '异常检测用滑动平均残差定位钩载突降点：本次疑似遇阻点 ' + Math.round(cur.sum.anomaly.s) + ' m，残差 ' + Math.abs(cur.sum.anomaly.res).toFixed(0) + ' kN，提示现场结合指重表复核。'
        ],
        bounds: [
          '本示范使用合成井眼轨迹与简化的一维受力公式，未用真实测斜、摩阻实测或管柱厂家参数标定。',
          '模型未覆盖屈曲、接头强度、温度效应与井壁碰撞，安全系数只能作为筛查，不替代完整管柱力学设计。',
          '整档扫描若没有一档同时满足安全系数与钩载上下限，界面会标为「参考解」而不是推荐值——此时应调整井眼或管柱，而不是勉强选一个速度。',
          '下入速度与短起下策略必须由工程师结合现场指重表、摩阻实测与井况决定。'
        ]
      });
    }

    function renderAll() {
      var arr = buildProfile(state, state.v);
      var sum = summarize(arr, state);
      var cur = { arr: arr, sum: sum };
      var opt = scanSpeed(state);
      var conf = confidenceOf(opt, cur);

      renderSmart(cur, opt, conf);
      renderTrajectory(cur);
      renderForce(cur);
      renderSafety(cur);
      renderOutput(cur, opt, conf);
      renderDepth(cur);
      renderScan(cur, opt);
      renderRiskList(cur, opt);
    }

    function syncPlayBtns() {
      var b1 = $('co3-play'), b2 = $('co3-tplay');
      if (b1) b1.textContent = playing ? '暂停' : '下入动画';
      if (b2) b2.textContent = playing ? '❚❚ 暂停' : '▶ 播放';
    }

    function stopAnim() {
      if (timer) { window.clearInterval(timer); timer = null; }
      playing = false;
      syncPlayBtns();
    }

    function setDepth(d) {
      depthNow = clamp(Math.round(d / 10) * 10, 0, state.H);
      renderAll();
    }

    function startAnim() {
      if (playing) { stopAnim(); renderAll(); return; }
      if (depthNow >= state.H - 1) depthNow = 0;
      playing = true;
      syncPlayBtns();
      renderAll();
      timer = window.setInterval(function () {
        if (depthNow >= state.H) { stopAnim(); renderAll(); return; }
        depthNow += state.H / 70;
        if (depthNow >= state.H) { depthNow = state.H; stopAnim(); renderAll(); return; }
        renderAll();
      }, 140);
    }

    /* ---------------- 事件 ---------------- */
    ['co3-v', 'co3-mu', 'co3-inc', 'co3-w', 'co3-H'].forEach(function (id) {
      listen($(id), 'input', function () {
        stopAnim();
        depthNow = state.H;
        readState();
        renderAll();
      });
    });
    listen($('co3-play'), 'click', startAnim);
    listen($('co3-tplay'), 'click', startAnim);
    listen($('co3-step'), 'click', function () {
      stopAnim();
      setDepth(depthNow >= state.H ? 0 : depthNow + state.H / 40);
    });
    listen($('co3-depth'), 'input', function (ev) {
      stopAnim();
      setDepth(Number(ev.target.value));
    });
    listen($('co3-reset'), 'click', function () {
      stopAnim();
      state.v = DEFAULTS.v; state.mu = DEFAULTS.mu; state.inc = DEFAULTS.inc;
      state.w = DEFAULTS.w; state.H = DEFAULTS.H;
      $('co3-v').value = state.v; $('co3-mu').value = state.mu; $('co3-inc').value = state.inc;
      $('co3-w').value = state.w; $('co3-H').value = state.H;
      depthNow = state.H;
      readState(); renderAll();
    });
    listen($('co3-ai'), 'click', function () {
      stopAnim();
      var opt = scanSpeed(state);
      state.v = Math.round(opt.v * 20) / 20;
      $('co3-v').value = state.v;
      depthNow = state.H;
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

  if (window.__IQ_STANDALONE__ && document.getElementById('app')) {
    boot(document.getElementById('app'));
  }
})();
