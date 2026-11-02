/* =========================================================
   e1 压裂参数智能优化 · 交互示范
   ---------------------------------------------------------
   裂缝代理模型 + 压力/砂堵风险模型 + 约束网格搜索
   裂缝示意、增产热力图、风险等高线、施工压力曲线
   本示范使用合成数据，仅用于展示方法流程。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'fracturing-parameter-optimization';

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

    var PRESS_LIMIT = 66;
    var RISK_LIMIT = 55;
    var BASE_Q = 18;
    var RATE_MIN = 2, RATE_MAX = 8;
    var VOL_MIN = 200, VOL_MAX = 1200;
    var SAND_MIN = 5, SAND_MAX = 30;
    var CLOSURE_MIN = 26, CLOSURE_MAX = 46;
    var DEFAULTS = { rate: 4, vol: 400, sand: 18, closure: 34 };
    var EXPERIENCE = { rate: 4, vol: 400, sand: 18 };

    var state = { rate: DEFAULTS.rate, vol: DEFAULTS.vol, sand: DEFAULTS.sand, closure: DEFAULTS.closure };
    var mode = 'balance';
    var progress = 1;
    var playing = false;
    var timer = null;

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function netPressure(rate, sand) {
      return 3.2 * Math.pow(rate / 4, 0.62) * (1 + 0.012 * (sand - 15));
    }
    function frictionOf(rate, vol) {
      return 6.5 * Math.pow(rate / 4, 1.7) + 0.0018 * vol;
    }

    /* ---------------- 裂缝代理模型 ---------------- */
    function evalFrac(rate, vol, sand, closure) {
      var net = netPressure(rate, sand);
      var friction = frictionOf(rate, vol);
      var surface = closure + net + friction + 1.8;

      /* 泵注时间越长，累计滤失越多、液效率越低：3.5 h 以内基本无损，
         之后按每小时 4.5% 折减（下限 0.55）。这是「液量越大不一定越好」的来源：
         1200 m³ 在 2.0 m³/min 下要泵 10 h，滤失会把缝长吃回去。 */
      var pumpH = vol / rate / 60;
      var eta = clamp(1 - 0.045 * Math.max(0, pumpH - 3.5), 0.55, 1);
      var halfLen = 48 * Math.pow(vol / 400, 0.5) * Math.pow(4 / rate, 0.2) *
        (1 - 0.008 * (sand - 15)) * (1 - 0.012 * (closure - 34)) * eta;
      halfLen = clamp(halfLen, 8, 150);
      var height = 24 * (1 + 0.07 * (rate - 4)) * (1 + 0.006 * (closure - 34));
      height = clamp(height, 12, 62);
      var cond = clamp(0.5 + 0.5 * (1 - Math.abs(sand - 22) / 32), 0.2, 1);
      var q = BASE_Q * (0.45 + 1.3 * (halfLen / 48) * cond);
      var gain = (q / BASE_Q - 1) * 100;

      var screenRisk = clamp((sand - 24) * 5.5 + Math.max(0, rate - 6.5) * 7 +
        Math.max(0, (vol / rate / 60) - 2.5) * 5, 0, 100);
      var pressRisk = clamp((surface - 50) / (PRESS_LIMIT - 50) * 100, 0, 100);
      var risk = clamp(0.55 * pressRisk + 0.45 * screenRisk, 0, 100);
      var pumpMin = vol / rate;

      return {
        rate: rate, vol: vol, sand: sand, closure: closure,
        net: net, friction: friction, surface: surface,
        halfLen: halfLen, height: height, cond: cond, q: q, gain: gain,
        risk: risk, screenRisk: screenRisk, pressRisk: pressRisk,
        pumpMin: pumpMin, feasible: risk <= RISK_LIMIT && surface <= PRESS_LIMIT
      };
    }

    function pressureCurve(p) {
      var T = p.pumpMin;
      var pts = [];
      for (var i = 0; i <= 60; i++) {
        var frac = i / 60;
        var t = frac * T;
        var pr = p.closure + 1.8 + p.friction + p.net * (0.55 + 0.45 * Math.sqrt(frac)) + 0.22 * Math.sin(t / 5);
        pts.push({ frac: frac, t: t, p: pr });
      }
      return pts;
    }

    function optimize(st, m) {
      m = m || 'balance';
      var best = null, qmax = 0, nEval = 0, nFeas = 0;
      for (var rate = RATE_MIN; rate <= RATE_MAX + 0.001; rate += 0.25) {
        for (var vol = VOL_MIN; vol <= VOL_MAX; vol += 25) {
          for (var sand = SAND_MIN; sand <= SAND_MAX; sand += 1) {
            var mm = evalFrac(rate, vol, sand, st.closure);
            nEval++;
            if (mm.feasible) nFeas++;
            var score = mm.feasible
              ? mm.q
              : mm.q - (mm.risk - RISK_LIMIT) * 1.1 - Math.max(0, mm.surface - PRESS_LIMIT) * 1.6;
            if (!best || score > best.score) {
              best = { score: score, m: mm, feasible: mm.feasible };
            }
            if (mm.feasible && mm.q > qmax) qmax = mm.q;
          }
        }
      }
      if (m === 'balance') { best.m.evaluated = nEval; best.m.feasibleCount = nFeas; return best.m; }

      /* 高产能：只看日产，允许突破约束；低风险：日产不低于可行最优 85% 时风险最低 */
      var pick = null;
      for (var r2 = RATE_MIN; r2 <= RATE_MAX + 0.001; r2 += 0.25) {
        for (var v2 = VOL_MIN; v2 <= VOL_MAX; v2 += 25) {
          for (var s2 = SAND_MIN; s2 <= SAND_MAX; s2 += 1) {
            var c = evalFrac(r2, v2, s2, st.closure);
            var key;
            if (m === 'q') key = c.q;
            else { if (c.q < qmax * 0.85) continue; key = -c.risk; }
            if (!pick || key > pick.key) pick = { key: key, m: c };
          }
        }
      }
      var out = pick ? pick.m : best.m;
      out.evaluated = nEval;
      out.feasibleCount = nFeas;
      return out;
    }

    function surfaceOpt(st) {
      var best = null;
      for (var rate = RATE_MIN; rate <= RATE_MAX + 0.001; rate += 0.25) {
        for (var sand = SAND_MIN; sand <= SAND_MAX; sand += 1) {
          var m = evalFrac(rate, st.vol, sand, st.closure);
          var score = m.feasible ? m.q : m.q - (m.risk - RISK_LIMIT) * 2;
          if (!best || score > best.score) best = { score: score, m: m };
        }
      }
      return best.m;
    }

    function confidenceOf(opt) {
      var riskMargin = RISK_LIMIT - opt.risk;
      var pressMargin = PRESS_LIMIT - opt.surface;
      var gain = opt.q / BASE_Q - 1;
      var c = 50 + clamp(riskMargin, -10, 20) * 1.15 + clamp(pressMargin, -6, 12) * 1.2 +
        clamp(gain, 0, 1.5) * 7;
      if (!opt.feasible) c -= 16;
      if (opt.risk > RISK_LIMIT - 4) c -= 4;
      return clamp(Math.round(c), 34, 94);
    }

    /* ---------------- 骨架 ---------------- */
    root.innerHTML =
      '<div class="iq-head">' +
        '<div><span class="iq-kicker">SCENE e1 · 增采</span>' +
          '<h3>压裂参数智能优化：在设备极限与砂堵之间找增产点</h3>' +
          '</div>' +
        '<div class="iq-tags"><span class="iq-tag jade">多目标优化</span><span class="iq-tag">代理模型</span><span class="iq-tag blue">网格搜索</span><span class="iq-tag clay">风险分区</span></div>' +
      '</div>' +
      '<div class="iq-grid">' +
        '<div class="iq-figure">' +
          '<div class="iq-card"><div class="iq-card-h"><h4><i class="iq-dot"></i>裂缝扩展</h4><span class="iq-mini" id="e1-fig-mini">—</span></div><div id="e1-frac"></div>' +
            '<div class="iq-legend"><span><i style="background:#3a352d"></i>裂缝</span><span><i style="background:#a9852f"></i>支撑剂</span><span><i style="background:#efe9dc"></i>储层</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>当前施工参数</h4><span class="iq-mini" id="e1-detail-tag">—</span></div><div id="e1-detail"></div></div>' +
        '</div>' +
        '<div class="iq-main">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>增产热力图 · 排量 × 砂比</h4><span class="iq-mini" id="e1-heat-mini">—</span></div><div id="e1-heat"></div><div class="iq-legend" id="e1-heat-legend"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>风险等高线 · 阈值 ' + RISK_LIMIT + '</h4><span class="iq-mini">施工压力上限 ' + PRESS_LIMIT + ' MPa</span></div><div id="e1-risk"></div></div>' +
          '<div class="iq-card iq-timecard">' +
            '<div class="iq-card-h"><h4>泵注回放</h4><span class="iq-mini" id="e1-time-mini">—</span></div>' +
            '<div class="iq-timebar">' +
              '<button type="button" class="iq-btn sm" id="e1-tplay">▶ 播放</button>' +
              '<button type="button" class="iq-btn sm" id="e1-step">单步 →</button>' +
              '<input type="range" id="e1-progress" min="0" max="100" step="1" value="100" aria-label="泵注进度">' +
              '<span class="iq-day" id="e1-plab">100%</span>' +
            '</div>' +
            '<div class="iq-note slim" id="e1-time-note">拖动进度查看裂缝延伸与施工压力变化。</div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>施工压力预演</h4><span class="iq-mini">棕 = 当前，绿 = AI</span></div><div id="e1-pressure"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#b26a39"></i>当前参数</span><span><i class="line" style="background:#3a352d"></i>AI 参数</span><span><i class="line" style="background:#b05a51"></i>压力上限</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>参数敏感性 · Tornado</h4><span class="iq-mini" id="e1-tor-mini">—</span></div><div id="e1-tornado"></div></div>' +
        '</div>' +
        '<div class="iq-side">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>输入参数</h4><span class="iq-mini">4 项</span></div>' +
            '<div class="iq-mode">' +
              '<div class="iq-mode-k">优化口径 <span class="iq-mini">决定“最优”怎么定义</span></div>' +
              '<div class="iq-seg" id="e1-mode">' +
                '<button type="button" data-mode="balance" class="on" title="压力与风险约束内最大化日产">综合最优</button>' +
                '<button type="button" data-mode="q" title="不考虑约束，只看日产">高产能</button>' +
                '<button type="button" data-mode="risk" title="日产不低于可行最优 85% 时风险最低">低风险</button>' +
              '</div>' +
              '<div class="iq-note slim" id="e1-mode-note">当前口径：压力与风险约束内最大化日产。</div>' +
            '</div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>施工排量</span><output id="e1-o-rate">4.0 m³/min</output></div><input type="range" id="e1-rate" min="2" max="8" step="0.25" value="4"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>总液量</span><output id="e1-o-vol">400 m³</output></div><input type="range" id="e1-vol" min="200" max="1200" step="25" value="400"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>平均砂比</span><output id="e1-o-sand">18%</output></div><input type="range" id="e1-sand" min="5" max="30" step="1" value="18"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>闭合压力</span><output id="e1-o-closure">34 MPa</output></div><input type="range" id="e1-closure" min="26" max="46" step="1" value="34"></div>' +
            '<div class="iq-btns"><button class="iq-btn" id="e1-reset">重置</button><button class="iq-btn" id="e1-anim">泵注预演</button><button class="iq-btn primary" id="e1-ai">采用 AI 参数</button></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>AI 优化输出</h4><span class="iq-mini" id="e1-out-mini">—</span></div>' +
            '<div class="iq-kpis">' +
              '<div class="iq-kpi wide"><span>推荐施工参数</span><b class="hero" id="e1-k-plan">—</b></div>' +
              '<div class="iq-kpi"><span>有效半缝长</span><b id="e1-k-half">—</b></div>' +
              '<div class="iq-kpi"><span>预计日产</span><b id="e1-k-q">—</b></div>' +
              '<div class="iq-kpi"><span>较压前增产</span><b id="e1-k-gain">—</b></div>' +
              '<div class="iq-kpi"><span>峰值压力</span><b id="e1-k-press">—</b></div>' +
              '<div class="iq-kpi"><span>风险指数</span><b id="e1-k-risk">—</b></div>' +
              '<div class="iq-kpi"><span>推荐置信度</span><b id="e1-k-conf">—</b></div>' +
            '</div>' +
            '<div class="iq-meter"><i id="e1-conf-bar" style="width:0%"></i></div>' +
            '<div class="iq-meter-row"><span>置信度</span><span id="e1-conf-txt">—</span></div>' +
            '<div class="iq-cmp" id="e1-cmp"></div>' +
            '<div class="iq-note" id="e1-note">—</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-bottom">' +
        '<div class="iq-card"><div class="iq-card-h"><h4>经验参数 vs AI 参数</h4><span class="iq-mini">同一闭合压力</span></div><div id="e1-table"></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>结果解释与流程</h4><span class="iq-mini">可复核</span></div><div class="iq-note blue" id="e1-explain">—</div>' +
          '<div class="iq-flow" style="margin-top:8px"><span>储层数据</span><em>→</em><span>裂缝代理</span><em>→</em><span>压力校核</span><em>→</em><span>约束搜索</span><em>→</em><span>现场执行</span></div>' +
          '<div class="iq-poll">本示范使用合成数据，用于展示智能方法和可视化流程，不代表真实生产结果。</div>' +
        '</div>' +
      '</div>';

    /* 智能方法说明卡：插在头部下方，数值随参数实时重算 */
    var smartBox = document.createElement('div');
    smartBox.id = 'e1-smart';
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

    /* ---------------- 裂缝示意 ---------------- */
    function fracSvg(cur) {
      var W = 260, H = 330, cx = 130;
      var halfPx = 8 + cur.halfLen * 0.72 * progress;
      halfPx = Math.min(halfPx, 112);
      var hPx = 8 + cur.height * 0.55;
      var top = 176 - hPx / 2, bot = 176 + hPx / 2;
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="裂缝形态与支撑剂铺置">';
      s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
      s += '<rect x="8" y="44" width="' + (W - 16) + '" height="240" fill="#efe9dc"/>';
      s += '<rect x="8" y="132" width="' + (W - 16) + '" height="88" fill="#e3d6b8"/>';
      s += '<text x="14" y="62" font-size="8.5" fill="#9ba3a9">上部地层</text>';
      s += '<text x="14" y="148" font-size="8.5" fill="#8a744a">储层</text>';
      s += '<text x="14" y="232" font-size="8.5" fill="#8a744a">隔层</text>';
      /* 井筒 */
      s += '<line x1="' + cx + '" y1="18" x2="' + cx + '" y2="290" stroke="#8d979d" stroke-width="6"/>';
      s += '<rect x="' + (cx - 8) + '" y="12" width="16" height="8" rx="2" fill="#d4d0c8" stroke="#8d979d"/>';
      s += '<text x="' + (cx + 12) + '" y="20" font-size="8" fill="#9ba3a9">井口</text>';
      /* 裂缝翼 */
      var wingR = cx + 9, wingL = cx - 9;
      if (halfPx > 2) {
        s += '<path d="M' + wingL + ' 176 C' + (wingL - halfPx * 0.5) + ' ' + (top + 4) + ' ' + (wingL - halfPx * 0.8) + ' ' + (top - 2) + ' ' + (wingL - halfPx) + ' ' + (top - 6) +
          ' C' + (wingL - halfPx * 0.7) + ' ' + (top + 12) + ' ' + (wingL - halfPx * 0.35) + ' ' + (bot - 10) + ' ' + wingL + ' ' + bot + ' Z" fill="#3a352d" fill-opacity=".16" stroke="#3a352d" stroke-width="1.1"/>';
        s += '<path d="M' + wingR + ' 176 C' + (wingR + halfPx * 0.5) + ' ' + (top + 4) + ' ' + (wingR + halfPx * 0.8) + ' ' + (top - 2) + ' ' + (wingR + halfPx) + ' ' + (top - 6) +
          ' C' + (wingR + halfPx * 0.7) + ' ' + (top + 12) + ' ' + (wingR + halfPx * 0.35) + ' ' + (bot - 10) + ' ' + wingR + ' ' + bot + ' Z" fill="#3a352d" fill-opacity=".16" stroke="#3a352d" stroke-width="1.1"/>';
        /* 支撑剂 */
        var k;
        for (k = 1; k <= 10; k++) {
          var f = k / 11 * progress;
          var xx = wingR + halfPx * f;
          var yy = 176 - hPx * 0.32 * f + Math.sin(k * 2.1) * 3;
          s += '<circle cx="' + xx + '" cy="' + yy + '" r="1.7" fill="#a9852f"/>';
          s += '<circle cx="' + (cx * 2 - xx) + '" cy="' + yy + '" r="1.7" fill="#a9852f"/>';
        }
        /* 尺寸标注 */
        s += '<line x1="' + wingR + '" y1="' + (bot + 14) + '" x2="' + (wingR + halfPx) + '" y2="' + (bot + 14) + '" stroke="#9ba3a9" stroke-width="1" marker-end="url(#e1-ar)"/>';
        s += '<text x="' + (wingR + halfPx / 2) + '" y="' + (bot + 26) + '" text-anchor="middle" font-size="9" fill="#3a352d" font-family="monospace">半长 ' + cur.halfLen.toFixed(0) + ' m</text>';
        s += '<line x1="' + (cx + halfPx + 14) + '" y1="' + top + '" x2="' + (cx + halfPx + 14) + '" y2="' + bot + '" stroke="#9ba3a9" stroke-width="1"/>';
        s += '<text x="' + (cx + halfPx + 18) + '" y="' + ((top + bot) / 2 + 3) + '" font-size="8.5" fill="#4a545d">缝高 ' + cur.height.toFixed(0) + ' m</text>';
      }
      s += '<defs><marker id="e1-ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#9ba3a9"/></marker></defs>';
      s += '<text x="' + cx + '" y="' + (H - 18) + '" text-anchor="middle" font-size="8.5" fill="#9ba3a9">泵注进度 ' + Math.round(progress * 100) + '% · 导流指数 ' + cur.cond.toFixed(2) + '</text>';
      s += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle" font-size="8" fill="#9ba3a9">翼宽与缝高按模型结果缩放</text>';
      return s + '</svg>';
    }

    /* ---------------- 热力图 ---------------- */
    var HM = { W: 640, H: 300, t: 18, r: 18, b: 42, l: 48 };
    var RATE_STEP = 0.25, SAND_STEP = 1;
    var NX = Math.round((RATE_MAX - RATE_MIN) / RATE_STEP) + 1;
    var NY = Math.round((SAND_MAX - SAND_MIN) / SAND_STEP) + 1;

    function axes(svg, x, y, W, H) {
      svg.append('g').attr('transform', 'translate(0,' + (H - HM.b) + ')')
        .call(d3.axisBottom(x).tickValues([2, 3, 4, 5, 6, 7, 8]).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 9.5).attr('fill', '#4a545d').attr('dy', '1em');
      svg.append('g').attr('transform', 'translate(' + HM.l + ',0)')
        .call(d3.axisLeft(y).tickValues([5, 10, 15, 18, 22, 26, 30]).tickSize(0))
        .call(function (g) { g.select('.domain').remove(); })
        .selectAll('text').attr('font-size', 9.5).attr('fill', '#4a545d').attr('dx', '-0.4em');
      svg.append('text').attr('x', W - HM.r).attr('y', H - 6).attr('text-anchor', 'end')
        .attr('font-size', 9.5).attr('fill', '#9ba3a9').text('排量（m³/min）→');
      svg.append('text').attr('x', 12).attr('y', HM.t + 4).attr('font-size', 9.5).attr('fill', '#9ba3a9')
        .attr('transform', 'rotate(-90 12 ' + (HM.t + 4) + ')').text('砂比（%）');
    }

    function markers(svg, x, y, cur, opt) {
      svg.append('circle').attr('cx', x(cur.rate)).attr('cy', y(cur.sand)).attr('r', 5)
        .attr('fill', 'none').attr('stroke', '#b26a39').attr('stroke-width', 2);
      svg.append('text').attr('x', x(cur.rate) + 7).attr('y', y(cur.sand) - 6)
        .attr('font-size', 9).attr('fill', '#b26a39').text('当前');
      svg.append('circle').attr('cx', x(opt.rate)).attr('cy', y(opt.sand)).attr('r', 4.2)
        .attr('fill', '#3a352d').attr('stroke', '#fff').attr('stroke-width', 1.5);
      svg.append('text').attr('x', x(opt.rate) + 7).attr('y', y(opt.sand) + 12)
        .attr('font-size', 9).attr('fill', '#3a352d').text('本图最优');
    }

    function renderHeat(res) {
      var box = $('e1-heat');
      box.innerHTML = '';
      var W = HM.W, H = HM.H, M = HM;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '排量与砂比的增产热力图');
      var x = d3.scaleLinear().domain([RATE_MIN, RATE_MAX]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([SAND_MIN, SAND_MAX]).range([H - M.b, M.t]);
      var cw = (W - M.l - M.r) / (NX - 1);
      var ch = (H - M.t - M.b) / (NY - 1);
      var cells = [];
      for (var sand = SAND_MAX; sand >= SAND_MIN; sand -= SAND_STEP) {
        for (var rate = RATE_MIN; rate <= RATE_MAX + 0.001; rate += RATE_STEP) {
          var m = evalFrac(rate, state.vol, sand, state.closure);
          cells.push({ rate: rate, sand: sand, q: m.q, risk: m.risk, feasible: m.feasible, half: m.halfLen });
        }
      }
      var qmin = d3.min(cells, function (c) { return c.q; });
      var qmax = d3.max(cells, function (c) { return c.q; });
      var color = d3.scaleSequential(function (t) { return d3.interpolateRgb('#f7f5ee', '#3a352d')(t); }).domain([qmin, qmax]);
      svg.selectAll('.cell').data(cells).enter().append('rect')
        .attr('x', function (c) { return x(c.rate) - cw / 2; })
        .attr('y', function (c) { return y(c.sand) - ch / 2; })
        .attr('width', cw + 0.4).attr('height', ch + 0.4)
        .attr('fill', function (c) { return color(c.q); })
        .attr('opacity', function (c) { return c.feasible ? 1 : 0.45; })
        .style('cursor', 'crosshair')
        .on('mouseenter', function (ev, c) {
          tipShow('排量 <b>' + c.rate.toFixed(2) + '</b> · 砂比 <b>' + c.sand + '%</b><br>日产 <b>' + c.q.toFixed(1) + '</b> t/d · 半缝长 <b>' + c.half.toFixed(0) + '</b> m<br>风险 <b>' + c.risk.toFixed(0) + '</b>' + (c.feasible ? '' : ' · 超限'), ev);
        })
        .on('mousemove', function (ev, c) {
          tipShow('排量 <b>' + c.rate.toFixed(2) + '</b> · 砂比 <b>' + c.sand + '%</b><br>日产 <b>' + c.q.toFixed(1) + '</b> t/d · 半缝长 <b>' + c.half.toFixed(0) + '</b> m<br>风险 <b>' + c.risk.toFixed(0) + '</b>' + (c.feasible ? '' : ' · 超限'), ev);
        })
        .on('mouseleave', tipHide)
        .on('click', function (ev, c) {
          state.rate = c.rate; state.sand = c.sand;
          $('e1-rate').value = c.rate; $('e1-sand').value = c.sand;
          readState(); renderAll();
        });
      axes(svg, x, y, W, H);
      markers(svg, x, y, { rate: state.rate, sand: state.sand }, res.surfaceOpt);
      $('e1-heat-mini').textContent = '液量 ' + state.vol + ' m³ · 闭合 ' + state.closure + ' MPa';
      $('e1-heat-legend').innerHTML =
        '<span>低产 ' + qmin.toFixed(0) + '</span>' +
        '<span style="display:inline-block;width:90px;height:8px;border-radius:2px;background:linear-gradient(90deg,#f7f5ee,#3a352d)"></span>' +
        '<span>高产 ' + qmax.toFixed(0) + ' t/d</span>' +
        '<span style="margin-left:auto"><i style="background:#b26a39"></i>当前</span>' +
        '<span><i style="background:#3a352d"></i>本图最优</span>' +
        '<span><i style="background:#e6e1d3"></i>半透明 = 风险超限</span>';
    }

    function renderRisk(res) {
      var box = $('e1-risk');
      box.innerHTML = '';
      var W = HM.W, H = HM.H, M = HM;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '排量与砂比的风险等高线');
      var x = d3.scaleLinear().domain([RATE_MIN, RATE_MAX]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([SAND_MIN, SAND_MAX]).range([H - M.b, M.t]);
      var cw = (W - M.l - M.r) / (NX - 1);
      var ch = (H - M.t - M.b) / (NY - 1);
      var values = [], cells = [];
      for (var sand = SAND_MAX; sand >= SAND_MIN; sand -= SAND_STEP) {
        for (var rate = RATE_MIN; rate <= RATE_MAX + 0.001; rate += RATE_STEP) {
          var m = evalFrac(rate, state.vol, sand, state.closure);
          values.push(m.risk);
          cells.push({ rate: rate, sand: sand, risk: m.risk, q: m.q, pressure: m.surface });
        }
      }
      var color = d3.scaleSequential(function (t) { return d3.interpolateRgb('#fdf6ec', '#b05a51')(t); }).domain([0, 100]);
      svg.selectAll('.cell').data(cells).enter().append('rect')
        .attr('x', function (c) { return x(c.rate) - cw / 2; })
        .attr('y', function (c) { return y(c.sand) - ch / 2; })
        .attr('width', cw + 0.4).attr('height', ch + 0.4)
        .attr('fill', function (c) { return color(c.risk); })
        .attr('opacity', 0.9)
        .style('cursor', 'crosshair')
        .on('mouseenter', function (ev, c) {
          tipShow('排量 <b>' + c.rate.toFixed(2) + '</b> · 砂比 <b>' + c.sand + '%</b><br>风险 <b>' + c.risk.toFixed(0) + '</b> / 100 · 峰值压力 <b>' + c.pressure.toFixed(1) + '</b> MPa', ev);
        })
        .on('mousemove', function (ev, c) {
          tipShow('排量 <b>' + c.rate.toFixed(2) + '</b> · 砂比 <b>' + c.sand + '%</b><br>风险 <b>' + c.risk.toFixed(0) + '</b> / 100 · 峰值压力 <b>' + c.pressure.toFixed(1) + '</b> MPa', ev);
        })
        .on('mouseleave', tipHide)
        .on('click', function (ev, c) {
          state.rate = c.rate; state.sand = c.sand;
          $('e1-rate').value = c.rate; $('e1-sand').value = c.sand;
          readState(); renderAll();
        });
      var contours = d3.contours().size([NX, NY]).thresholds([30, RISK_LIMIT, 80])(values);
      contours.forEach(function (c) {
        var path = '';
        c.coordinates.forEach(function (poly) {
          poly.forEach(function (ring) {
            ring.forEach(function (p, i) {
              path += (i ? 'L' : 'M') + (M.l + p[0] * cw).toFixed(1) + ',' + (M.t + p[1] * ch).toFixed(1);
            });
            path += 'Z';
          });
        });
        var th = c.value;
        svg.append('path').attr('d', path).attr('fill', 'none')
          .attr('stroke', th === RISK_LIMIT ? '#b05a51' : '#8a6a3f')
          .attr('stroke-width', th === RISK_LIMIT ? 2 : 1)
          .attr('stroke-dasharray', th === RISK_LIMIT ? '5 3' : '2 3')
          .attr('opacity', th === RISK_LIMIT ? 1 : 0.7);
      });
      axes(svg, x, y, W, H);
      markers(svg, x, y, { rate: state.rate, sand: state.sand }, res.surfaceOpt);
      svg.append('text').attr('x', W - M.r - 4).attr('y', 30).attr('text-anchor', 'end')
        .attr('font-size', 9.5).attr('fill', '#b05a51').text('虚线 = 风险阈值 ' + RISK_LIMIT);
    }

    function renderPressure(res) {
      var box = $('e1-pressure');
      box.innerHTML = '';
      var W = 640, H = 236, M = { t: 20, r: 22, b: 42, l: 48 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '施工压力预演曲线');
      var curPts = pressureCurve(res.cur);
      var optPts = pressureCurve(res.opt);
      var x = d3.scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([26, 78]).range([H - M.b, M.t]);

      svg.append('rect').attr('x', M.l).attr('y', y(78)).attr('width', W - M.l - M.r)
        .attr('height', Math.max(0, y(PRESS_LIMIT) - y(78))).attr('fill', '#f9e9e5').attr('opacity', 0.65);
      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(PRESS_LIMIT)).attr('y2', y(PRESS_LIMIT))
        .attr('stroke', '#b05a51').attr('stroke-dasharray', '4 3').attr('stroke-width', 1.2);
      svg.append('text').attr('x', W - M.r - 4).attr('y', y(PRESS_LIMIT) - 4).attr('text-anchor', 'end')
        .attr('font-size', 9).attr('fill', '#b05a51').text('设备上限 ' + PRESS_LIMIT + ' MPa');

      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).ticks(5).tickFormat(function (v) { return Math.round(v * 100) + '%'; }).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 9).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 9).attr('fill', '#9ba3a9');
        });
      svg.append('text').attr('x', M.l).attr('y', 12).attr('font-size', 9).attr('fill', '#9ba3a9').text('施工压力 (MPa)');
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#9ba3a9').text('泵注进度 →');
      svg.append('text').attr('x', M.l).attr('y', H - 6).attr('font-size', 9).attr('fill', '#9ba3a9')
        .text('当前 ' + (res.cur.pumpMin / 60).toFixed(2) + ' h · AI ' + (res.opt.pumpMin / 60).toFixed(2) + ' h');

      function line(pts) {
        return d3.line().x(function (p) { return x(p.frac); }).y(function (p) { return y(p.p); })(pts);
      }
      svg.append('path').attr('d', line(curPts)).attr('fill', 'none').attr('stroke', '#b26a39').attr('stroke-width', 1.8).attr('stroke-dasharray', '4 3');
      svg.append('path').attr('d', line(optPts)).attr('fill', 'none').attr('stroke', '#3a352d').attr('stroke-width', 2.2);

      var lastC = curPts[curPts.length - 1], lastO = optPts[optPts.length - 1];
      svg.append('circle').attr('cx', x(1)).attr('cy', y(lastC.p)).attr('r', 3).attr('fill', '#b26a39');
      svg.append('text').attr('x', x(1) - 4).attr('y', y(lastC.p) - 6).attr('text-anchor', 'end')
        .attr('font-size', 9).attr('fill', '#b26a39').text(lastC.p.toFixed(1));
      svg.append('circle').attr('cx', x(1)).attr('cy', y(lastO.p)).attr('r', 3.2).attr('fill', '#3a352d').attr('stroke', '#fff').attr('stroke-width', 1.1);
      svg.append('text').attr('x', x(1) - 4).attr('y', y(lastO.p) + 12).attr('text-anchor', 'end')
        .attr('font-size', 9).attr('fill', '#3a352d').text(lastO.p.toFixed(1));
      /* 当前泵注进度标记 */
      svg.append('line').attr('x1', x(progress)).attr('x2', x(progress)).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#a03d4f').attr('stroke-width', 1).attr('stroke-dasharray', '3 3').attr('opacity', 0.6);

      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var fr = clamp(x.invert(mx), 0, 1);
        var a = curPts[Math.round(fr * 60)], b = optPts[Math.round(fr * 60)];
        tipShow('进度 <b>' + Math.round(fr * 100) + '%</b><br>当前 <b>' + a.p.toFixed(1) + '</b> MPa · AI <b>' + b.p.toFixed(1) + '</b> MPa', ev);
      }).on('mouseleave', tipHide);
    }

    /* ---------------- Tornado 敏感性 ---------------- */
    function varQ(key, scale) {
      var r = state.rate, v = state.vol, s = state.sand, c = state.closure;
      if (key === 'rate') r = clamp(state.rate * scale, RATE_MIN, RATE_MAX);
      if (key === 'vol') v = clamp(state.vol * scale, VOL_MIN, VOL_MAX);
      if (key === 'sand') s = clamp(state.sand * scale, SAND_MIN, SAND_MAX);
      if (key === 'closure') c = clamp(state.closure * scale, CLOSURE_MIN, CLOSURE_MAX);
      return evalFrac(r, v, s, c).q;
    }

    function renderTornado(cur) {
      var box = $('e1-tornado');
      box.innerHTML = '';
      var defs = [
        { k: 'rate', name: '排量', scope: 0.2 },
        { k: 'vol', name: '液量', scope: 0.2 },
        { k: 'sand', name: '砂比', scope: 0.2 },
        { k: 'closure', name: '闭合压力', scope: 0.1 }
      ];
      var rows = defs.map(function (d) {
        return {
          k: d.k, name: d.name, scope: d.scope,
          lo: varQ(d.k, 1 - d.scope) - cur.q,
          hi: varQ(d.k, 1 + d.scope) - cur.q
        };
      }).sort(function (a, b) {
        return Math.max(Math.abs(b.lo), Math.abs(b.hi)) - Math.max(Math.abs(a.lo), Math.abs(a.hi));
      });
      var maxAbs = Math.max(1, d3.max(rows, function (r) { return Math.max(Math.abs(r.lo), Math.abs(r.hi)); }));

      var W = 640, H = 34 + rows.length * 32 + 30;
      var M = { t: 22, r: 56, b: 28, l: 92 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '施工参数对日产的敏感性 Tornado 图');
      var cx0 = M.l + (W - M.l - M.r) / 2;
      var x = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([M.l, W - M.r]);
      var rowH = 32;

      svg.append('line').attr('x1', cx0).attr('x2', cx0).attr('y1', M.t - 6).attr('y2', H - M.b)
        .attr('stroke', '#9ba3a9').attr('stroke-width', 1).attr('stroke-dasharray', '3 3');
      svg.append('text').attr('x', cx0).attr('y', M.t - 10).attr('text-anchor', 'middle')
        .attr('font-size', 8.5).attr('fill', '#9ba3a9').text('基准 ' + cur.q.toFixed(1) + ' t/d');

      rows.forEach(function (r, i) {
        var y = M.t + i * rowH + rowH / 2;
        svg.append('text').attr('x', M.l - 10).attr('y', y + 1).attr('text-anchor', 'end')
          .attr('font-size', 9.5).attr('fill', '#4a545d')
          .text(r.name + ' ±' + Math.round(r.scope * 100) + '%');
        if (Math.abs(r.lo) > 0.6) {
          svg.append('rect').attr('x', Math.min(cx0, x(r.lo))).attr('y', y - 7)
            .attr('width', Math.abs(x(r.lo) - cx0)).attr('height', 14).attr('rx', 2)
            .attr('fill', '#b26a39').attr('opacity', 0.75);
          svg.append('text').attr('x', x(r.lo) - 5).attr('y', y + 3).attr('text-anchor', 'end')
            .attr('font-size', 8.5).attr('fill', '#8f5128').attr('font-family', 'ui-monospace,monospace')
            .text(r.lo.toFixed(1));
        }
        if (Math.abs(r.hi) > 0.6) {
          svg.append('rect').attr('x', cx0).attr('y', y - 7)
            .attr('width', Math.abs(x(r.hi) - cx0)).attr('height', 14).attr('rx', 2)
            .attr('fill', '#3a352d').attr('opacity', 0.8);
          svg.append('text').attr('x', x(r.hi) + 5).attr('y', y + 3)
            .attr('font-size', 8.5).attr('fill', '#3a352d').attr('font-family', 'ui-monospace,monospace')
            .text('+' + r.hi.toFixed(1));
        }
      });
      svg.append('text').attr('x', M.l).attr('y', H - 8).attr('font-size', 8.5).attr('fill', '#9ba3a9')
        .text('← 减产 t/d');
      svg.append('text').attr('x', W - M.r).attr('y', H - 8).attr('text-anchor', 'end')
        .attr('font-size', 8.5).attr('fill', '#9ba3a9').text('增产 t/d →');

      $('e1-tor-mini').textContent = '最敏感：' + rows[0].name + ' · 摆幅 ' +
        (Math.abs(rows[0].lo) + Math.abs(rows[0].hi)).toFixed(1) + ' t/d';
    }

    /* ---------------- 泵注回放 ---------------- */
    function renderTime(cur) {
      var pts = pressureCurve(cur);
      var idx = clamp(Math.round(progress * 60), 0, 60);
      var p = pts[idx].p;
      var halfNow = cur.halfLen * progress;
      $('e1-plab').textContent = Math.round(progress * 100) + '%';
      var tl = $('e1-progress');
      if (tl && Number(tl.value) !== Math.round(progress * 100)) tl.value = Math.round(progress * 100);
      $('e1-time-mini').textContent = '进度 ' + Math.round(progress * 100) + '%' + (playing ? ' · 泵注中' : '');
      var note = $('e1-time-note');
      if (p > PRESS_LIMIT) {
        note.className = 'iq-note slim red';
        note.innerHTML = '<b>压力越限：</b>进度 ' + Math.round(progress * 100) + '% 时施工压力 ' + p.toFixed(1) +
          ' MPa，超过设备上限 ' + PRESS_LIMIT + ' MPa，现场需降排量或提砂比节奏。';
      } else {
        note.className = 'iq-note slim';
        note.innerHTML = '<b>进度 ' + Math.round(progress * 100) + '%：</b>施工压力 ' + p.toFixed(1) + ' MPa · 已延伸半缝长 ≈ ' +
          halfNow.toFixed(0) + ' m · 余量 ' + (PRESS_LIMIT - p).toFixed(1) + ' MPa。';
      }
    }

    /* ---------------- 输出 ---------------- */
    function renderOutput(res) {
      var opt = res.opt, cur = res.cur, baseQ = BASE_Q;
      var conf = confidenceOf(opt);
      $('e1-k-plan').textContent = opt.rate.toFixed(2) + ' m³/min · ' + opt.vol + ' m³ · ' + Math.round(opt.sand) + '%';
      $('e1-k-half').innerHTML = opt.halfLen.toFixed(0) + '<small>m</small>';
      $('e1-k-q').innerHTML = opt.q.toFixed(1) + '<small>t/d</small>';
      $('e1-k-gain').innerHTML = '+' + opt.gain.toFixed(0) + '<small>%</small>';
      $('e1-k-gain').className = 'ok';
      var pEl = $('e1-k-press');
      pEl.innerHTML = cur.surface.toFixed(1) + '<small>MPa</small>';
      pEl.className = cur.surface <= PRESS_LIMIT ? 'ok' : 'bad';
      var rEl = $('e1-k-risk');
      rEl.textContent = cur.risk.toFixed(0);
      rEl.className = cur.risk < 35 ? 'ok' : (cur.risk <= RISK_LIMIT ? 'warn' : 'bad');
      $('e1-k-conf').innerHTML = conf + '<small>%</small>';
      $('e1-conf-bar').style.width = conf + '%';
      $('e1-conf-bar').className = conf >= 75 ? '' : (conf >= 55 ? 'warn' : 'bad');
      $('e1-conf-txt').textContent = '压力余量 ' + (PRESS_LIMIT - opt.surface).toFixed(1) + ' MPa · 风险余量 ' + (RISK_LIMIT - opt.risk).toFixed(0);
      $('e1-out-mini').textContent = opt.feasible ? '约束内最优' : '无可行解 · 风险最小';
      $('e1-fig-mini').textContent = '半长 ' + cur.halfLen.toFixed(0) + ' m';
      $('e1-detail-tag').textContent = cur.feasible ? '约束内' : '超出约束';

      $('e1-detail').innerHTML =
        '<table class="iq-table">' +
        '<tr><td>排量 / 液量</td><td class="num">' + cur.rate.toFixed(2) + ' m³/min · ' + cur.vol + ' m³</td></tr>' +
        '<tr><td>砂比</td><td class="num">' + Math.round(cur.sand) + '%</td></tr>' +
        '<tr><td>半缝长 / 缝高</td><td class="num">' + cur.halfLen.toFixed(0) + ' m · ' + cur.height.toFixed(0) + ' m</td></tr>' +
        '<tr><td>峰值压力</td><td class="num">' + cur.surface.toFixed(1) + ' MPa</td></tr>' +
        '<tr><td>泵注时长</td><td class="num">' + (cur.pumpMin / 60).toFixed(2) + ' h</td></tr>' +
        '</table>' +
        '<p class="iq-poll" style="margin-top:6px">点击热力图或等高线可切换参数。</p>';

      var note = $('e1-note');
      if (!opt.feasible) {
        /* 必须指出是哪一条约束卡住：只看“无可行解”四个字，现场无法决定先改什么 */
        var pOver = opt.surface > PRESS_LIMIT;
        var rOver = opt.risk > RISK_LIMIT;
        var bind = (pOver && rOver) ? '施工压力 ' + opt.surface.toFixed(1) + ' MPa 与砂堵风险 ' + opt.risk.toFixed(0) + ' 同时越界'
          : (pOver ? '施工压力 ' + opt.surface.toFixed(1) + ' MPa 超过上限 ' + PRESS_LIMIT + ' MPa'
            : '砂堵风险 ' + opt.risk.toFixed(0) + ' 超过阈值 ' + RISK_LIMIT);
        note.className = 'iq-note red';
        note.innerHTML = '<b>无可行解：</b>本轮搜索的 ' + opt.evaluated + ' 组参数全部越界，最接近的一组仍以 ' + bind +
          ' 卡住。模型退回风险最小方案作为参考，不可直接施工；建议降低排量、减少砂比或改为分两段施工后重搜。';
      } else if (opt.risk > RISK_LIMIT - 4) {
        note.className = 'iq-note clay';
        note.innerHTML = '<b>边界解：</b>推荐方案风险 ' + opt.risk.toFixed(0) + '，紧贴阈值 ' + RISK_LIMIT + '。现场压力波动可能导致砂堵，建议预留降砂比预案。';
      } else {
        note.className = 'iq-note';
        note.innerHTML = '<b>结论：</b>' + opt.rate.toFixed(2) + ' m³/min、' + opt.vol + ' m³、砂比 ' + Math.round(opt.sand) + '% 时，半缝长 ' + opt.halfLen.toFixed(0) + ' m，预计日产 ' + opt.q.toFixed(1) + ' t/d，峰值压力 ' + opt.surface.toFixed(1) + ' MPa。';
      }

      var ex = $('e1-explain');
      ex.innerHTML = '<b>为什么不是“液量越大越好”：</b>液量增加能延伸缝长，但排量不变时泵注时间变长、滤失增加，且摩阻随液量上升；砂比提高能改善导流，但超过 24% 后砂堵风险快速上升。' +
        'AI 解位于“压力上限”和“风险阈值”两条边界的交点附近，属于高增产、低余量的方案。' +
        '<br><b>风险构成：</b>当前压力风险 ' + cur.pressRisk.toFixed(0) + '、砂堵风险 ' + cur.screenRisk.toFixed(0) + '，加权后 ' + cur.risk.toFixed(0) + '。';

      var exp = evalFrac(EXPERIENCE.rate, EXPERIENCE.vol, EXPERIENCE.sand, state.closure);

      /* 前后对比条：邻井经验模板 vs AI 推荐，同一代理模型与闭合压力 */
      var gMax = Math.max(exp.q, opt.q, 1);
      var gGain = (opt.q - exp.q) / Math.max(exp.q, 0.01) * 100;
      $('e1-cmp').innerHTML =
        '<div class="iq-cmp-h"><span>前后对比 · 预计日产 (t/d)</span>' +
        '<span class="delta' + (gGain < 0 ? ' bad' : '') + '">' + (gGain >= 0 ? '+' : '') + gGain.toFixed(1) + '%</span></div>' +
        '<div class="iq-cmp-row"><span class="lb">邻井模板</span>' +
        '<div class="tr"><i style="width:' + (exp.q / gMax * 100).toFixed(1) + '%"></i></div>' +
        '<b>' + exp.q.toFixed(1) + '</b></div>' +
        '<div class="iq-cmp-row ai"><span class="lb">AI 推荐</span>' +
        '<div class="tr"><i class="ai" style="width:' + (opt.q / gMax * 100).toFixed(1) + '%"></i></div>' +
        '<b>' + opt.q.toFixed(1) + '</b></div>';

      $('e1-table').innerHTML =
        '<table class="iq-table">' +
        '<tr><th>参数 / 指标</th><th>经验参数</th><th>AI 参数</th><th>变化</th></tr>' +
        '<tr><td>排量</td><td class="num">' + EXPERIENCE.rate.toFixed(2) + ' m³/min</td><td class="num">' + opt.rate.toFixed(2) + '</td><td class="num">' + (opt.rate - EXPERIENCE.rate >= 0 ? '+' : '') + (opt.rate - EXPERIENCE.rate).toFixed(2) + '</td></tr>' +
        '<tr><td>总液量</td><td class="num">' + EXPERIENCE.vol + ' m³</td><td class="num">' + opt.vol + '</td><td class="num">' + (opt.vol - EXPERIENCE.vol >= 0 ? '+' : '') + (opt.vol - EXPERIENCE.vol) + '</td></tr>' +
        '<tr><td>砂比</td><td class="num">' + EXPERIENCE.sand + '%</td><td class="num">' + Math.round(opt.sand) + '%</td><td class="num">' + (opt.sand - EXPERIENCE.sand >= 0 ? '+' : '') + Math.round(opt.sand - EXPERIENCE.sand) + '</td></tr>' +
        '<tr><td>半缝长</td><td class="num">' + exp.halfLen.toFixed(0) + ' m</td><td class="num">' + opt.halfLen.toFixed(0) + ' m</td><td class="num">' + (opt.halfLen - exp.halfLen >= 0 ? '+' : '') + (opt.halfLen - exp.halfLen).toFixed(0) + ' m</td></tr>' +
        '<tr class="hl"><td>预计日产</td><td class="num">' + exp.q.toFixed(1) + ' t/d</td><td class="num">' + opt.q.toFixed(1) + ' t/d</td><td class="num">' + (opt.q - exp.q >= 0 ? '+' : '') + (opt.q - exp.q).toFixed(1) + '</td></tr>' +
        '<tr><td>峰值压力</td><td class="num">' + exp.surface.toFixed(1) + ' MPa</td><td class="num">' + opt.surface.toFixed(1) + '</td><td class="num">' + (opt.surface - exp.surface >= 0 ? '+' : '') + (opt.surface - exp.surface).toFixed(1) + '</td></tr>' +
        '<tr><td>风险指数</td><td class="num">' + exp.risk.toFixed(0) + '</td><td class="num">' + opt.risk.toFixed(0) + '</td><td class="num">' + (opt.risk - exp.risk >= 0 ? '+' : '') + (opt.risk - exp.risk).toFixed(0) + '</td></tr>' +
        '</table>' +
        '<p class="iq-poll">经验参数取邻井模板（4 m³/min、400 m³、18%）；两者使用同一代理模型与闭合压力。</p>';
    }

    /* ---------------- 状态 ---------------- */
    function readState() {
      state.rate = Number($('e1-rate').value);
      state.vol = Number($('e1-vol').value);
      state.sand = Number($('e1-sand').value);
      state.closure = Number($('e1-closure').value);
      $('e1-o-rate').textContent = state.rate.toFixed(2) + ' m³/min';
      $('e1-o-vol').textContent = state.vol + ' m³';
      $('e1-o-sand').textContent = state.sand + '%';
      $('e1-o-closure').textContent = state.closure + ' MPa';
    }

    function modeNote(opt) {
      var el = $('e1-mode-note');
      if (!el) return;
      if (mode === 'q') {
        el.innerHTML = '当前口径：<b>只看日产</b>，允许突破压力/风险约束。选中解风险 ' + opt.risk.toFixed(0) +
          (opt.feasible ? '（本次恰在可行域内）。' : '（已超限，现场不可直接执行）。');
      } else if (mode === 'risk') {
        el.innerHTML = '当前口径：日产不低于可行最优 85% 时，<b>风险最低</b>。选中解风险 ' + opt.risk.toFixed(0) +
          '、日产 ' + opt.q.toFixed(1) + ' t/d。';
      } else {
        el.innerHTML = '当前口径：<b>压力与风险约束内</b>最大化日产。';
      }
    }

    /* 智能方法说明：数值来自本轮裂缝代理模型与约束搜索 */
    function renderSmart(res) {
      if (!window.IQSmart || !smartBox) return;
      var cur = res.cur, opt = res.opt;
      var exp = evalFrac(EXPERIENCE.rate, EXPERIENCE.vol, EXPERIENCE.sand, state.closure);
      function num(a, b, unit, digits, lowerBetter) {
        var d = b - a, n = (digits == null ? 1 : digits);
        var good = lowerBetter ? d <= 0 : d >= 0;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(n) + (unit || ''), cls: good ? 'ok' : 'bad' };
      }
      var rows = [
        { cells: ['排量 (m³/min)', EXPERIENCE.rate.toFixed(2), opt.rate.toFixed(2), num(EXPERIENCE.rate, opt.rate, '', 2), '—'] },
        { cells: ['总液量 (m³)', String(EXPERIENCE.vol), String(opt.vol), num(EXPERIENCE.vol, opt.vol, '', 0), '—'] },
        { cells: ['砂比 (%)', String(EXPERIENCE.sand), Math.round(opt.sand) + '%', num(EXPERIENCE.sand, opt.sand, '', 0), '—'] },
        { cells: ['半缝长 (m)', exp.halfLen.toFixed(0), opt.halfLen.toFixed(0), num(exp.halfLen, opt.halfLen, '', 0), '—'] },
        { cells: ['预计日产 (t/d)', exp.q.toFixed(1), opt.q.toFixed(1), num(exp.q, opt.q, '', 1), '—'] },
        { cells: ['峰值压力 (MPa)', exp.surface.toFixed(1), opt.surface.toFixed(1), num(exp.surface, opt.surface, '', 1, true), { v: '上限 ' + PRESS_LIMIT + ' MPa', cls: opt.surface <= PRESS_LIMIT ? 'ok' : 'bad' }] },
        { cells: ['风险指数', exp.risk.toFixed(0), opt.risk.toFixed(0), num(exp.risk, opt.risk, '', 0, true), { v: '阈值 ' + RISK_LIMIT, cls: opt.feasible ? 'ok' : 'bad' }] },
        { cells: ['约束结论', exp.risk <= RISK_LIMIT && exp.surface <= PRESS_LIMIT ? '满足' : '不满足', opt.feasible ? '满足' : '无可行解', '—', '压力 + 砂堵双约束'], hl: true }
      ];
      var gain = (opt.q - exp.q) / Math.max(exp.q, 0.01) * 100;
      smartBox.innerHTML = window.IQSmart.render({
        kicker: 'SMART METHOD · SURROGATE + CONSTRAINTS',
        title: '裂缝代理模型 + 压力/砂堵双约束搜索',
        subtitle: '在排量、液量、砂比三维空间搜索，同时满足施工压力与砂堵风险',
        badge: '增益 ' + (gain >= 0 ? '+' : '') + gain.toFixed(0) + '%',
        /* 主视觉：当前砂比与闭合压力下，排量×液量 273 组组合的「日产—风险」散点 */
        algoSvg: window.IQAlgo ? (function () {
          var pts = [];
          for (var rt = RATE_MIN; rt <= RATE_MAX + 0.001; rt += 0.5) {
            for (var vv = VOL_MIN; vv <= VOL_MAX + 0.001; vv += 50) {
              var mm = evalFrac(rt, vv, state.sand, state.closure);
              pts.push({ x: mm.q, y: mm.risk, ok: mm.feasible });
            }
          }
          return window.IQAlgo.scatter({
            points: pts,
            xLabel: '预计日产 (t/d) →',
            yLabel: '综合风险',
            yLine: RISK_LIMIT,
            yLineLabel: '风险阈值 ' + RISK_LIMIT,
            pick: { x: opt.q, y: opt.risk },
            pickLabel: '推荐 ' + opt.rate.toFixed(2) + ' m³/min · ' + opt.vol + ' m³'
          });
        })() : '',
        algoCap: '<span><i style="background:rgba(53,120,90,.55)"></i>压力与砂堵双约束内</span>' +
          '<span><i style="background:rgba(168,82,73,.45)"></i>越界（超压或砂堵）</span>' +
          '<span>每个点 = 一组「排量 × 液量」的裂缝模型计算结果</span>',
        input: '排量、总液量、砂比、闭合压力',
        output: '半缝长、缝高、预计日产、峰值压力、砂堵风险与推荐参数',
        problem: '参数组合爆炸，邻井模板照搬常失效；只追液量会突破压力或引发砂堵',
        fit: '代理模型可快速评估数千组合，压力与风险两条约束直接把不可施工方案排除',
        flow: ['地质 / 闭合压力', '裂缝代理模型', '压力与砂堵风险', '双约束搜索', '推荐施工参数', '泵注现场复核'],
        trace: [
          ['评估组合', opt.evaluated + ' 组'],
          ['双约束内', opt.feasibleCount + ' 组'],
          ['可行率', (opt.feasibleCount / Math.max(opt.evaluated, 1) * 100).toFixed(1) + '%'],
          ['压力余量', (PRESS_LIMIT - opt.surface).toFixed(1) + ' MPa'],
          ['风险余量', (RISK_LIMIT - opt.risk).toFixed(0) + ' 分']
        ],
        compare: {
          title: '邻井经验模板 vs AI 推荐参数',
          columns: ['指标', '经验模板', 'AI 推荐', '变化', '约束 / 说明'],
          rows: rows,
          note: '经验模板取邻井常用值（4 m³/min、400 m³、18%）；两者使用同一代理模型与闭合压力。'
        },
        why: [
          '液量增加能延伸缝长，但排量不变时泵注时间变长、滤失与摩阻上升；砂比超过 24% 后砂堵风险快速上升，所以不能单看“液量越大越好”。',
          '导流能力在砂比 22% 附近最高，搜索会自动避开过低（导流不足）与过高（砂堵）的区间。',
          '最优解通常落在压力上限与风险阈值的交点附近：增产最大，但余量最小；因此模型同时给出压力余量 ' +
            (PRESS_LIMIT - opt.surface).toFixed(1) + ' MPa 与风险余量 ' + (RISK_LIMIT - opt.risk).toFixed(0) + '。'
        ],
        bounds: [
          '本示范使用简化的裂缝代理模型与合成数据，未用微地震、净压力反演或压后测试产量标定。',
          '模型用泵注时间近似滤失损失（3.5 h 后按每小时 4.5% 折减），未区分滤失系数、天然裂缝与多簇竞争；半缝长不能替代压裂模拟器结果。',
          '排量、砂比与加砂程序必须由工程师结合设备能力、套管强度与现场泵注曲线确认。'
        ]
      });
    }

    function renderAll() {
      var cur = evalFrac(state.rate, state.vol, state.sand, state.closure);
      var opt = optimize(state, mode);
      var surfOpt = surfaceOpt(state);
      var res = { cur: cur, opt: opt, surfaceOpt: surfOpt };
      renderSmart(res);
      $('e1-frac').innerHTML = fracSvg(cur);
      renderHeat(res);
      renderRisk(res);
      renderPressure(res);
      renderTornado(cur);
      renderTime(cur);
      renderOutput(res);
      modeNote(opt);
    }

    function syncPlayBtns() {
      var b1 = $('e1-anim'), b2 = $('e1-tplay');
      if (b1) b1.textContent = playing ? '暂停' : '泵注预演';
      if (b2) b2.textContent = playing ? '❚❚ 暂停' : '▶ 播放';
    }

    function stopAnim() {
      if (timer) { window.clearInterval(timer); timer = null; }
      playing = false;
      syncPlayBtns();
    }

    function startAnim() {
      if (playing) { stopAnim(); renderAll(); return; }
      if (progress >= 1) progress = 0;
      playing = true;
      syncPlayBtns();
      renderAll();
      timer = window.setInterval(function () {
        progress += 0.045;
        if (progress >= 1) {
          progress = 1;
          stopAnim();
          renderAll();
          return;
        }
        renderAll();
      }, 120);
    }

    /* ---------------- 事件 ---------------- */
    ['e1-rate', 'e1-vol', 'e1-sand', 'e1-closure'].forEach(function (id) {
      listen($(id), 'input', function () {
        stopAnim();
        progress = 1;
        readState();
        renderAll();
      });
    });
    listen($('e1-anim'), 'click', startAnim);
    listen($('e1-tplay'), 'click', startAnim);
    listen($('e1-step'), 'click', function () {
      stopAnim();
      progress = progress >= 1 ? 0 : Math.min(1, progress + 1 / 20);
      renderAll();
    });
    listen($('e1-progress'), 'input', function (ev) {
      stopAnim();
      progress = clamp(Number(ev.target.value) / 100, 0, 1);
      renderAll();
    });
    listen($('e1-mode'), 'click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('button[data-mode]') : null;
      if (!btn) return;
      mode = btn.getAttribute('data-mode');
      var btns = $('e1-mode').querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].getAttribute('data-mode') === mode ? 'on' : '';
      }
      renderAll();
    });
    listen($('e1-reset'), 'click', function () {
      stopAnim();
      progress = 1;
      state.rate = DEFAULTS.rate; state.vol = DEFAULTS.vol;
      state.sand = DEFAULTS.sand; state.closure = DEFAULTS.closure;
      $('e1-rate').value = state.rate; $('e1-vol').value = state.vol;
      $('e1-sand').value = state.sand; $('e1-closure').value = state.closure;
      readState(); renderAll();
    });
    listen($('e1-ai'), 'click', function () {
      stopAnim();
      progress = 1;
      var opt = optimize(state, mode);
      state.rate = Math.round(opt.rate * 4) / 4;
      state.vol = Math.round(opt.vol / 25) * 25;
      state.sand = Math.round(opt.sand);
      $('e1-rate').value = state.rate; $('e1-vol').value = state.vol; $('e1-sand').value = state.sand;
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
