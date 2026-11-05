/* =========================================================
   co2 射孔参数智能设计 · 交互示范
   ---------------------------------------------------------
   产能代理模型 + 风险规则 + 四维网格搜索
   热力图（孔密 × 段长）、风险等高线、相位敏感性
   本示范使用合成数据，仅用于展示方法流程。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'perforation-parameter-design';

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

    var PHASES = [0, 45, 60, 90, 120, 180];
    var PHASE_FACTOR = { 0: 0.72, 45: 0.90, 60: 1.0, 90: 0.95, 120: 0.89, 180: 0.80 };
    var PHASE_PENALTY = { 0: 20, 45: 12, 60: 8, 90: 0, 120: 2, 180: 6 };
    var PHASE_HOLES = { 0: 1, 45: 8, 60: 6, 90: 4, 120: 3, 180: 2 };
    var RISK_LIMIT = 64;
    var DEFAULTS = { n: 16, phase: 60, d: 10, len: 8, pressure: 32 };
    var EXPERIENCE = { n: 16, phase: 60, d: 10, len: 8 };
    var N_MIN = 4, N_MAX = 24, L_MIN = 2, L_MAX = 20;

    var state = { n: DEFAULTS.n, phase: DEFAULTS.phase, d: DEFAULTS.d, len: DEFAULTS.len, pressure: DEFAULTS.pressure };
    var mode = 'balance';

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* ---------------- 代理模型 ---------------- */
    function calc(n, phase, d, L, p) {
      var dn = 1 - Math.exp(-n / 7);
      var pf = PHASE_FACTOR[phase] || 0.9;
      /* 孔径与穿深此消彼长：API RP 19B 样本里 10 mm 孔径对应 90—127 cm 穿深，
         14 mm 以上只有大孔径弹能做到、穿深仅 12—16 cm。超过 11 mm 后按孔径折减穿透能力，
         否则搜索会把孔径一路顶到上限，给出井下做不到的组合。 */
      var pen = d <= 10 ? 1 : (d <= 11 ? 0.96 : 0.96 - 0.055 * (d - 11));
      var df = (0.55 + 0.45 * Math.pow(d / 10, 0.6)) * pen;
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

    /* 三种搜索口径：
       balance = 风险阈值内最大化日产；q = 只看日产（可能越过阈值）；
       risk = 在日产不低于全局最优 85% 的前提下最小化风险 */
    function optimize(st, opts) {
      opts = opts || {};
      var fixedNL = !!opts.fixed;
      var m = opts.mode || 'balance';
      var phases = fixedNL ? [st.phase] : PHASES;
      var ds = fixedNL ? [st.d] : [6, 7, 8, 9, 10, 11, 12, 13, 14];
      var all = [], qmax = 0, nEval = 0, nFeas = 0;
      phases.forEach(function (ph) {
        ds.forEach(function (d) {
          for (var n = N_MIN; n <= N_MAX; n++) {
            for (var L = L_MIN; L <= L_MAX; L++) {
              var mm = calc(n, ph, d, L, st.pressure);
              all.push({ n: n, phase: ph, d: d, len: L, q: mm.q, risk: mm.risk, sand: mm.sand, casing: mm.casing, feasible: mm.risk <= RISK_LIMIT });
              nEval++;
              if (mm.risk <= RISK_LIMIT) nFeas++;
              if (mm.q > qmax) qmax = mm.q;
            }
          }
        });
      });
      var best = null;
      all.forEach(function (c) {
        var key;
        if (m === 'q') key = c.q;
        else if (m === 'risk') {
          if (c.q < qmax * 0.85) return;
          key = -c.risk;
        } else {
          key = c.feasible ? c.q : c.q - (c.risk - RISK_LIMIT) * 2.2;
        }
        if (!best || key > best.key) {
          best = { key: key, n: c.n, phase: c.phase, d: c.d, len: c.len, q: c.q, risk: c.risk, sand: c.sand, casing: c.casing, feasible: c.feasible };
        }
      });
      if (best) { best.evaluated = nEval; best.feasibleCount = nFeas; }
      return best;
    }

    function surface(st, metric) {
      var out = [];
      for (var L = L_MAX; L >= L_MIN; L--) {
        for (var n = N_MIN; n <= N_MAX; n++) {
          var m = calc(n, st.phase, st.d, L, st.pressure);
          out.push(metric === 'risk' ? m.risk : m.q);
        }
      }
      return out;
    }

    function confidence(opt, base) {
      var slack = RISK_LIMIT - opt.risk;
      var gain = (opt.q - base.q) / Math.max(base.q, 1);
      var c = 58 + clamp(slack, -15, 15) * 0.9 + clamp(gain, -0.25, 0.4) * 35;
      if (!opt.feasible) c -= 18;
      return clamp(Math.round(c), 38, 92);
    }

    /* ---------------- 骨架 ---------------- */
    root.innerHTML =
      '<div class="iq-head">' +
        '<div><span class="iq-kicker">SCENE co2 · 完井</span>' +
          '<h3>射孔参数智能设计：在产能与风险之间找可行最优</h3>' +
          '</div>' +
        '<div class="iq-tags"><span class="iq-tag jade">代理模型</span><span class="iq-tag">网格搜索</span><span class="iq-tag blue">约束优化</span><span class="iq-tag clay">风险等高线</span></div>' +
      '</div>' +
      '<div class="iq-grid">' +
        '<div class="iq-figure">' +
          '<div class="iq-card">' +
            '<div class="iq-card-h"><h4>三方案对比</h4><span class="iq-mini">可套用</span></div>' +
            '<div class="iq-tri" id="co2-scheme" style="grid-template-columns:minmax(0,1fr)"></div>' +
            '<div class="iq-note slim" id="co2-scheme-note">三张卡使用同一代理模型，只改变参数组合。</div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4><i class="iq-dot"></i>当前方案</h4><span class="iq-mini" id="co2-rank">—</span></div><div id="co2-detail"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>工程图例 · 射孔风险</h4><span class="iq-mini">co2</span></div>' +
            '<div class="iq-legend" style="flex-direction:column;align-items:flex-start;gap:6px">' +
              '<span><i style="background:#8d979d"></i>套管 / 水泥环</span>' +
              '<span><i style="background:#b26a39"></i>射孔孔道</span>' +
              '<span><i style="background:#a9852f"></i>近井污染带</span>' +
              '<span><i style="background:#b05a51"></i>套管损伤 / 水层沟通风险</span>' +
              '<span><i style="background:#7d9dc4"></i>含水层（蓝色）</span>' +
            '</div>' +
            '<div class="iq-note slim" id="co2-fig-note">左侧为沿井筒的纵向射孔段，右侧为径向放大视图；孔数随孔密、方向随相位、长度随孔径实时变化。</div>' +
          '</div>' +
        '</div>' +
        '<div class="iq-main">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>套管射孔现场示意 · 参数与风险联动</h4><span class="iq-mini" id="co2-figlabel">—</span></div><div id="co2-figure"></div>' +
            '<div class="iq-legend"><span><i style="background:#8d979d"></i>套管</span><span><i style="background:#c9c3b4"></i>水泥环</span><span><i style="background:#e9dfc7"></i>目的层</span><span><i style="background:#b26a39"></i>射孔孔道</span><span><i style="background:#a9852f"></i>近井污染带</span><span><i style="background:#7d9dc4"></i>含水层</span><span><i style="background:#b05a51"></i>风险标注</span></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>产能热力图（辅助）· 孔密 × 段长</h4><span class="iq-mini" id="co2-hm-mini">—</span></div><div id="co2-heat"></div><div class="iq-legend" id="co2-heat-legend"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>风险等高线 · 阈值 ' + RISK_LIMIT + '</h4><span class="iq-mini">红虚线为约束边界</span></div><div id="co2-risk"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>孔密 × 日产 / 风险 双轴扫描</h4><span class="iq-mini" id="co2-scan-mini">4—24 孔/m</span></div><div id="co2-scan"></div>' +
            '<div class="iq-legend"><span><i class="line" style="background:#3a352d"></i>预测日产</span><span><i class="line" style="background:#c58b62"></i>风险指数</span><span><i class="line" style="background:#b05a51"></i>风险阈值 ' + RISK_LIMIT + '</span></div>' +
            '<div class="iq-note slim" id="co2-scan-note">—</div></div>' +
        '</div>' +
        '<div class="iq-side">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>输入参数</h4><span class="iq-mini">5 项</span></div>' +
            '<div class="iq-mode">' +
              '<div class="iq-mode-k">搜索口径 <span class="iq-mini">决定“最优”怎么定义</span></div>' +
              '<div class="iq-seg" id="co2-mode">' +
                '<button type="button" data-mode="balance" class="on" title="风险阈值内日产最高">综合最优</button>' +
                '<button type="button" data-mode="q" title="不考虑阈值，只看日产">最高产能</button>' +
                '<button type="button" data-mode="risk" title="日产不低于最优 85% 时风险最低">最低风险</button>' +
              '</div>' +
              '<div class="iq-note slim" id="co2-mode-note">当前口径：在风险阈值内最大化日产。</div>' +
            '</div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>射孔孔密</span><output id="co2-o-n">16 孔/m</output></div><input type="range" id="co2-n" min="4" max="24" step="1" value="16"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>射孔相位</span><output id="co2-o-phase">60° · 6 孔</output></div><select id="co2-phase"><option value="0">0°（1 孔）</option><option value="45">45°（8 孔）</option><option value="60" selected>60°（6 孔）</option><option value="90">90°（4 孔）</option><option value="120">120°（3 孔）</option><option value="180">180°（2 孔）</option></select></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>射孔孔径</span><output id="co2-o-d">10 mm</output></div><input type="range" id="co2-d" min="6" max="14" step="1" value="10"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>射孔段长</span><output id="co2-o-len">8 m</output></div><input type="range" id="co2-len" min="2" max="20" step="1" value="8"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>地层压力</span><output id="co2-o-p">32 MPa</output></div><input type="range" id="co2-pressure" min="15" max="50" step="1" value="32"></div>' +
            '<div class="iq-btns"><button class="iq-btn" id="co2-reset">重置</button><button class="iq-btn" id="co2-exp">套用经验方案</button><button class="iq-btn primary" id="co2-ai">采用 AI 方案</button></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>AI 设计输出</h4><span class="iq-mini" id="co2-out-mini">—</span></div>' +
            '<div class="iq-kpis">' +
              '<div class="iq-kpi wide"><span>推荐参数组合</span><b id="co2-k-combo">—</b></div>' +
              '<div class="iq-kpi"><span>预测日产</span><b class="hero" id="co2-k-q">—</b></div>' +
              '<div class="iq-kpi"><span>风险指数</span><b id="co2-k-risk">—</b></div>' +
              '<div class="iq-kpi"><span>较经验增产</span><b id="co2-k-gain">—</b></div>' +
              '<div class="iq-kpi"><span>推荐置信度</span><b id="co2-k-conf">—</b></div>' +
            '</div>' +
            '<div class="iq-meter"><i id="co2-conf-bar" style="width:0%"></i></div>' +
            '<div class="iq-meter-row"><span>置信度</span><span id="co2-conf-txt">—</span></div>' +
            '<div class="iq-cmp" id="co2-cmp"></div>' +
            '<div class="iq-note" id="co2-note">—</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-bottom">' +
        '<div class="iq-card"><div class="iq-card-h"><h4>经验方案 vs AI 方案</h4><span class="iq-mini">同一地层压力</span></div><div id="co2-table"></div></div>' +
        '<div class="iq-card"><div class="iq-card-h"><h4>结果解释与流程</h4><span class="iq-mini">可复核</span></div><div class="iq-note blue" id="co2-explain">—</div>' +
          '<div class="iq-flow" style="margin-top:8px"><span>数据采集</span><em>→</em><span>特征构造</span><em>→</em><span>代理模型</span><em>→</em><span>约束搜索</span><em>→</em><span>工程复核</span></div>' +
          '<div class="iq-poll">本示范使用合成数据，用于展示智能方法和可视化流程，不代表真实生产结果。</div>' +
        '</div>' +
        '</div>';

    /* 智能方法说明卡：插在头部下方，数值随参数实时重算 */
    var smartBox = document.createElement('div');
    smartBox.id = 'co2-smart';
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

    /* ---------------- 套管射孔现场示意 ---------------- */
    function figureSvg(st, opt) {
      var mm = calc(st.n, st.phase, st.d, st.len, st.pressure);
      var dirs = PHASE_HOLES[st.phase] || 4;
      var s = '<svg viewBox="0 0 780 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="套管射孔纵向剖面与径向相位示意">';
      s += '<rect width="780" height="430" fill="#fff"/>';

      /* ---- 左：沿井筒的纵向射孔段 ---- */
      var wx = 200, resT = 150, resB = 310, waterT = 310, waterB = 386;
      s += '<text x="16" y="22" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">① 纵向剖面 · 射孔段 2850—2860 m</text>';
      s += '<rect x="70" y="38" width="268" height="112" fill="#efe9dc" stroke="#e3ddcd"/>';
      s += '<rect x="70" y="150" width="268" height="160" fill="#e9dfc7" stroke="#cbbd99"/>';
      s += '<rect x="70" y="310" width="268" height="76" fill="#dbe5ee" stroke="#c3d3e6"/>';
      s += '<text x="78" y="58" font-size="8.5" fill="#9ba3a9">上部井段（0—2850 m 压缩显示）</text>';
      s += '<text x="78" y="166" font-size="9" fill="#8a744a">目的层 · 储层</text>';
      s += '<text x="78" y="328" font-size="9" fill="#5b7899">含水层 · 2870 m</text>';
      for (var po = 0; po < 24; po++) {
        s += '<circle cx="' + (84 + (po % 12) * 19 + (po % 4)) + '" cy="' + (182 + Math.floor(po / 12) * 62 + (po % 3) * 3) + '" r="1.5" fill="#b26a39" opacity=".45"/>';
      }
      /* 深度刻度 */
      s += '<text x="60" y="42" text-anchor="end" font-size="8" fill="#9ba3a9" font-family="ui-monospace,monospace">0 m</text>';
      s += '<text x="60" y="148" text-anchor="end" font-size="8" fill="#9ba3a9" font-family="ui-monospace,monospace">2850</text>';
      s += '<text x="60" y="314" text-anchor="end" font-size="8" fill="#8a744a" font-family="ui-monospace,monospace">2860</text>';
      s += '<text x="60" y="382" text-anchor="end" font-size="8" fill="#5b7899" font-family="ui-monospace,monospace">2870</text>';
      /* 盖层 / 目的层 / 水层与井筒 */
      s += '<rect x="' + (wx - 24) + '" y="38" width="48" height="' + (waterB - 38) + '" fill="#ece8dc" stroke="#ddd6c6"/>';
      s += '<rect x="' + (wx - 16) + '" y="38" width="32" height="' + (waterB - 38) + '" fill="#d4d0c8" stroke="#8d979d"/>';
      s += '<rect x="' + (wx - 8) + '" y="38" width="16" height="' + (waterB - 38) + '" fill="#fbfaf6"/>';
      s += '<text x="' + (wx - 30) + '" y="110" text-anchor="end" font-size="8" fill="#9ba3a9">套管 + 水泥环</text>';
      /* 射孔段与孔道 */
      var yTop = resT + 8, yEnd = Math.min(resT + 8 + st.len * 16, resB - 4);
      var rows = clamp(Math.round(st.n * st.len / 3), 4, 24);
      var tunnelPx = 13 + st.d * 1.9;
      s += '<rect x="' + (wx - 28) + '" y="' + yTop + '" width="56" height="' + (yEnd - yTop) + '" fill="#a9852f" opacity=".14"/>';
      s += '<rect x="' + (wx - 28) + '" y="' + yTop + '" width="56" height="' + (yEnd - yTop) + '" fill="none" stroke="#a9852f" stroke-dasharray="3 2" opacity=".7"/>';
      var tilt = st.phase >= 90 ? 0 : 10;
      for (var k = 0; k < rows; k++) {
        var yy = yTop + 3 + k * (yEnd - yTop - 6) / Math.max(rows - 1, 1);
        var dy = (k % 2 ? 1 : -1) * tilt;
        s += '<line x1="' + (wx - 16) + '" y1="' + yy + '" x2="' + (wx - 16 - tunnelPx) + '" y2="' + (yy + dy) + '" stroke="#b26a39" stroke-width="2" stroke-linecap="round"/>';
        s += '<line x1="' + (wx + 16) + '" y1="' + yy + '" x2="' + (wx + 16 + tunnelPx) + '" y2="' + (yy + dy) + '" stroke="#b26a39" stroke-width="2" stroke-linecap="round"/>';
        s += '<circle cx="' + (wx - 16 - tunnelPx) + '" cy="' + (yy + dy) + '" r="1.6" fill="#b26a39"/>';
        s += '<circle cx="' + (wx + 16 + tunnelPx) + '" cy="' + (yy + dy) + '" r="1.6" fill="#b26a39"/>';
      }
      s += '<text x="' + (wx + 36) + '" y="' + (yTop + 18) + '" font-size="8" fill="#a9852f">近井污染带</text>';
      s += '<text x="' + (wx + 36) + '" y="' + (yTop + 44) + '" font-size="8" fill="#b26a39">' + st.n + ' 孔/m · 共 ' + Math.round(st.n * st.len) + ' 孔</text>';
      s += '<text x="' + (wx + 36) + '" y="' + (yTop + 56) + '" font-size="8" fill="#9ba3a9">孔道长 ' + (0.4 + st.d / 14 * 1.0).toFixed(1) + ' m（按孔径折算）</text>';
      /* 射孔段标注 */
      s += '<line x1="' + (wx - 64) + '" y1="' + yTop + '" x2="' + (wx - 64) + '" y2="' + yEnd + '" stroke="#3a352d" stroke-width="1"/>';
      s += '<line x1="' + (wx - 68) + '" y1="' + yTop + '" x2="' + (wx - 60) + '" y2="' + yTop + '" stroke="#3a352d" stroke-width="1"/>';
      s += '<line x1="' + (wx - 68) + '" y1="' + yEnd + '" x2="' + (wx - 60) + '" y2="' + yEnd + '" stroke="#3a352d" stroke-width="1"/>';
      s += '<text x="' + (wx - 72) + '" y="' + ((yTop + yEnd) / 2) + '" text-anchor="end" font-size="8.5" fill="#3a352d">' +
        '射孔段 2850—' + (2850 + st.len) + ' m（' + st.len + ' m）</text>';
      /* 套管损伤风险 */
      if (mm.casing > 55) {
        s += '<text x="' + (wx - 30) + '" y="' + (yTop - 10) + '" text-anchor="end" font-size="8" fill="#b05a51">套管损伤风险 ' + mm.casing.toFixed(0) + '</text>';
        s += '<line x1="' + (wx - 22) + '" y1="' + (yTop - 6) + '" x2="' + (wx - 16) + '" y2="' + yTop + '" stroke="#b05a51" stroke-width="1.4"/>';
      }
      /* 水层沟通风险 */
      if (yEnd > resB - 12 || st.len >= 12) {
        s += '<line x1="' + (wx + 16) + '" y1="' + yEnd + '" x2="' + (wx + 74) + '" y2="' + (waterT + 14) + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="3 2"/>';
        s += '<text x="' + (wx + 78) + '" y="' + (waterT + 12) + '" font-size="8" fill="#b05a51">沟通水层风险</text>';
      } else {
        s += '<text x="' + (wx + 78) + '" y="' + (waterT + 12) + '" font-size="8" fill="#5b7899">距水层 ' + (2870 - (2850 + st.len)) + ' m</text>';
      }
      /* 流体流入 */
      s += '<defs><marker id="co2-flow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#a03d4f"/></marker></defs>';
      s += '<line x1="' + (wx - 64) + '" y1="' + (yTop + 34) + '" x2="' + (wx - 30) + '" y2="' + (yTop + 34) + '" stroke="#a03d4f" stroke-width="1.3" marker-end="url(#co2-flow)"/>';
      s += '<line x1="' + (wx + 64) + '" y1="' + (yTop + 34) + '" x2="' + (wx + 30) + '" y2="' + (yTop + 34) + '" stroke="#a03d4f" stroke-width="1.3" marker-end="url(#co2-flow)"/>';

      /* ---- 右：径向放大视图 ---- */
      var cx = 588, cy = 208, rIn = 44, rCem = 56, rFor = 124;
      s += '<text x="382" y="22" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">② 径向放大 · 相位 ' + st.phase + '°</text>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rFor + '" fill="#e9dfc7" stroke="#d8d2c4"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rCem + 2) + '" fill="#ece8dc"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rCem + '" fill="none" stroke="#c9c3b4" stroke-width="1.6"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rIn + '" fill="#fff" stroke="#8d979d" stroke-width="4"/>';
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rIn + '" fill="none" stroke="#d4d0c8" stroke-width="2"/>';
      s += '<text x="' + cx + '" y="' + (cy + 3) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle">井筒</text>';
      /* 近井污染环 */
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rIn + 24 + st.d * 2.4) + '" fill="none" stroke="#a9852f" stroke-width="1.2" stroke-dasharray="4 3" opacity=".8"/>';
      s += '<text x="' + (cx + 86) + '" y="' + (cy - 96) + '" font-size="8" fill="#a9852f">近井污染带</text>';
      /* 孔道 */
      var tp = 36 + st.d * 3.6;
      for (var j = 0; j < dirs; j++) {
        var a = (-90 + j * 360 / dirs) * Math.PI / 180;
        var x1 = cx + Math.cos(a) * (rIn + 4), y1 = cy + Math.sin(a) * (rIn + 4);
        var x2 = cx + Math.cos(a) * (rIn + 4 + tp), y2 = cy + Math.sin(a) * (rIn + 4 + tp);
        s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#b26a39" stroke-width="3" stroke-linecap="round"/>';
        s += '<circle cx="' + x2 + '" cy="' + y2 + '" r="2.2" fill="#b26a39"/>';
      }
      s += '<text x="' + cx + '" y="' + (cy + rFor + 20) + '" font-size="9.5" fill="#4a545d" text-anchor="middle">相位 ' + st.phase + '° · 每排 ' + dirs + ' 孔</text>';
      s += '<text x="' + cx + '" y="' + (cy + rFor + 34) + '" font-size="9" fill="#9ba3a9" text-anchor="middle">孔径 ' + st.d + ' mm · 孔道长度随孔径变化（示意）</text>';
      s += '<text x="' + cx + '" y="' + (cy + rFor + 48) + '" font-size="8.5" fill="#9ba3a9" text-anchor="middle">套管 ' + (rCem - rIn) + ' mm 壁厚示意 · 水泥环充填</text>';

      /* ---- AI 推荐同步说明 ---- */
      if (opt) {
        s += '<rect x="382" y="360" width="368" height="26" rx="4" fill="#f8f1e8" stroke="#d8d2c4"/>';
        s += '<text x="392" y="377" font-size="9" fill="#3a352d">AI 推荐：' + opt.n + ' 孔/m · ' + opt.phase + '° · ' +
          opt.d + ' mm · ' + opt.len + ' m　（日产 ' + opt.q.toFixed(1) + ' t/d · 风险 ' + opt.risk.toFixed(0) + '）</text>';
      }

      /* ---- 风险状态条 ---- */
      var chipY = 408;
      var sandR = mm.sand, caseR = mm.casing;
      var waterGap = 2870 - (2850 + st.len);
      s += '<circle cx="24" cy="' + (chipY - 3) + '" r="3.2" fill="' + (sandR > 55 ? '#b05a51' : '#a9852f') + '"/>';
      s += '<text x="33" y="' + chipY + '" font-size="8.5" fill="#4a545d">近井污染风险 ' + sandR.toFixed(0) + '</text>';
      s += '<circle cx="204" cy="' + (chipY - 3) + '" r="3.2" fill="' + (caseR > 55 ? '#b05a51' : '#35785a') + '"/>';
      s += '<text x="213" y="' + chipY + '" font-size="8.5" fill="#4a545d">套管损伤风险 ' + caseR.toFixed(0) + '</text>';
      s += '<circle cx="384" cy="' + (chipY - 3) + '" r="3.2" fill="' + (waterGap < 4 ? '#b05a51' : '#7d9dc4') + '"/>';
      s += '<text x="393" y="' + chipY + '" font-size="8.5" fill="#4a545d">' + (waterGap < 4 ? '沟通水层风险 高（余 ' + Math.max(0, waterGap) + ' m）' : '水层沟通风险 低（余 ' + waterGap + ' m）') + '</text>';
      s += '<text x="764" y="' + chipY + '" text-anchor="end" font-size="8" fill="#9ba3a9">合成数据示意</text>';
      return s + '</svg>';
    }

    /* ---------------- 热力图与等高线 ---------------- */
    var GRID = { n: N_MAX - N_MIN + 1, l: L_MAX - L_MIN + 1 };
    var HM = { W: 640, H: 306, t: 16, r: 18, b: 42, l: 46 };

    function heatmapAxes(svg, x, y, W, H, M) {
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).tickValues([4, 8, 12, 16, 20, 24]).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 9.5).attr('fill', '#4a545d').attr('dy', '1em');
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).tickValues([2, 5, 8, 11, 14, 17, 20]).tickSize(0))
        .call(function (g) { g.select('.domain').remove(); })
        .selectAll('text').attr('font-size', 9.5).attr('fill', '#4a545d').attr('dx', '-0.4em');
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end')
        .attr('font-size', 9.5).attr('fill', '#9ba3a9').text('孔密（孔/m）→');
      svg.append('text').attr('x', 12).attr('y', M.t + 4).attr('font-size', 9.5).attr('fill', '#9ba3a9')
        .attr('transform', 'rotate(-90 12 ' + (M.t + 4) + ')').text('射孔段长（m）');
    }

    function drawMarkers(svg, x, y, cur, opts, tag) {
      /* opts: {n, len, mode} */
      svg.append('circle').attr('cx', x(cur.n)).attr('cy', y(cur.len)).attr('r', 5.2)
        .attr('fill', 'none').attr('stroke', '#b26a39').attr('stroke-width', 2);
      svg.append('text').attr('x', x(cur.n) + 7).attr('y', y(cur.len) - 6)
        .attr('font-size', 9).attr('fill', '#b26a39').text('当前');
      if (opts) {
        var col = opts.mode === 'q' ? '#b05a51' : (opts.mode === 'risk' ? '#a03d4f' : '#3a352d');
        svg.append('circle').attr('cx', x(opts.n)).attr('cy', y(opts.len)).attr('r', 4.4)
          .attr('fill', col).attr('stroke', '#fff').attr('stroke-width', 1.5);
        svg.append('text').attr('x', x(opts.n) + 7).attr('y', y(opts.len) + 12)
          .attr('font-size', 9).attr('fill', col).text(tag || '推荐');
      }
    }

    function renderHeat(res) {
      var box = $('co2-heat');
      box.innerHTML = '';
      var M = HM, W = M.W, H = M.H;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '孔密与段长的产能热力图');
      var x = d3.scaleLinear().domain([N_MIN, N_MAX]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([L_MIN, L_MAX]).range([H - M.b, M.t]);
      var cw = (W - M.l - M.r) / (GRID.n - 1);
      var ch = (H - M.t - M.b) / (GRID.l - 1);
      var qs = res.gridQ;
      var qmin = d3.min(qs), qmax = d3.max(qs);
      var color = d3.scaleSequential(function (t) { return d3.interpolateRgb('#f7f5ee', '#3a352d')(t); }).domain([qmin, qmax]);
      var cells = [];
      for (var L = L_MIN; L <= L_MAX; L++) {
        for (var n = N_MIN; n <= N_MAX; n++) {
          var m = calc(n, state.phase, state.d, L, state.pressure);
          cells.push({ n: n, len: L, q: m.q, risk: m.risk });
        }
      }
      svg.selectAll('.cell').data(cells).enter().append('rect')
        .attr('x', function (c) { return x(c.n) - cw / 2; })
        .attr('y', function (c) { return y(c.len) - ch / 2; })
        .attr('width', cw + 0.4).attr('height', ch + 0.4)
        .attr('fill', function (c) { return color(c.q); })
        .attr('opacity', function (c) { return c.risk > RISK_LIMIT ? 1 : 1; })
        .style('cursor', 'crosshair')
        .on('mouseenter', function (ev, c) {
          tipShow('孔密 <b>' + c.n + '</b> 孔/m · 段长 <b>' + c.len + '</b> m<br>预测日产 <b>' + c.q.toFixed(1) + '</b> t/d · 风险 <b>' + c.risk.toFixed(0) + '</b>' +
            (c.risk > RISK_LIMIT ? '<br><span style="color:#e8a49b">超出阈值 ' + (c.risk - RISK_LIMIT).toFixed(0) + '，不可行</span>' : ''), ev);
        })
        .on('mousemove', function (ev, c) {
          tipShow('孔密 <b>' + c.n + '</b> 孔/m · 段长 <b>' + c.len + '</b> m<br>预测日产 <b>' + c.q.toFixed(1) + '</b> t/d · 风险 <b>' + c.risk.toFixed(0) + '</b>' +
            (c.risk > RISK_LIMIT ? '<br><span style="color:#e8a49b">超出阈值 ' + (c.risk - RISK_LIMIT).toFixed(0) + '，不可行</span>' : ''), ev);
        })
        .on('mouseleave', tipHide)
        .on('click', function (ev, c) {
          state.n = c.n; state.len = c.len;
          $('co2-n').value = c.n; $('co2-len').value = c.len;
          readState(); renderAll();
        });
      /* 不可行区罩一层暖白：让“能做的范围”一眼可见 */
      svg.selectAll('.cellmask').data(cells.filter(function (c) { return c.risk > RISK_LIMIT; }))
        .enter().append('rect')
        .attr('x', function (c) { return x(c.n) - cw / 2; })
        .attr('y', function (c) { return y(c.len) - ch / 2; })
        .attr('width', cw + 0.4).attr('height', ch + 0.4)
        .attr('fill', '#fbfaf6').attr('opacity', 0.62).attr('pointer-events', 'none');
      heatmapAxes(svg, x, y, W, H, M);
      drawMarkers(svg, x, y, { n: state.n, len: state.len }, { n: res.opt.n, len: res.opt.len, mode: mode }, '推荐');
      var feasible = cells.filter(function (c) { return c.risk <= RISK_LIMIT; }).length;
      $('co2-hm-mini').textContent = '相位 ' + state.phase + '° · 孔径 ' + state.d + ' mm · 可行 ' + feasible + '/' + cells.length;
      $('co2-heat-legend').innerHTML =
        '<span>低产 ' + qmin.toFixed(0) + '</span>' +
        '<span style="display:inline-block;width:90px;height:8px;border-radius:2px;background:linear-gradient(90deg,#f7f5ee,#3a352d)"></span>' +
        '<span>高产 ' + qmax.toFixed(0) + ' t/d</span>' +
        '<span style="margin-left:auto"><i style="background:#f0eeE6;opacity:.5;border:1px solid #ddd7c8"></i>色块变淡 = 超风险阈值</span>' +
        '<span><i style="background:#b26a39"></i>当前方案</span>';
    }

    function renderRisk(res) {
      var box = $('co2-risk');
      box.innerHTML = '';
      var M = HM, W = M.W, H = M.H;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '射孔风险等高线图');
      var x = d3.scaleLinear().domain([N_MIN, N_MAX]).range([M.l, W - M.r]);
      var y = d3.scaleLinear().domain([L_MIN, L_MAX]).range([H - M.b, M.t]);
      var cw = (W - M.l - M.r) / (GRID.n - 1);
      var ch = (H - M.t - M.b) / (GRID.l - 1);
      var values = [];
      var cells = [];
      for (var L = L_MAX; L >= L_MIN; L--) {
        for (var n = N_MIN; n <= N_MAX; n++) {
          var m = calc(n, state.phase, state.d, L, state.pressure);
          values.push(m.risk);
          cells.push({ n: n, len: L, risk: m.risk, q: m.q });
        }
      }
      /* 色阶按本图实际风险范围拉伸，避免“整片都红”看不出层次 */
      var color = d3.scaleSequential(function (t) { return d3.interpolateRgb('#fdf6ec', '#b05a51')(t); })
        .domain([d3.min(values), d3.max(values) || 100]);
      svg.selectAll('.cell').data(cells).enter().append('rect')
        .attr('x', function (c) { return x(c.n) - cw / 2; })
        .attr('y', function (c) { return y(c.len) - ch / 2; })
        .attr('width', cw + 0.4).attr('height', ch + 0.4)
        .attr('fill', function (c) { return color(c.risk); })
        .attr('fill-opacity', 0.9)
        .style('cursor', 'crosshair')
        .on('mouseenter', function (ev, c) {
          tipShow('孔密 <b>' + c.n + '</b> · 段长 <b>' + c.len + '</b> m<br>风险指数 <b>' + c.risk.toFixed(0) + '</b> / 100', ev);
        })
        .on('mousemove', function (ev, c) {
          tipShow('孔密 <b>' + c.n + '</b> · 段长 <b>' + c.len + '</b> m<br>风险指数 <b>' + c.risk.toFixed(0) + '</b> / 100', ev);
        })
        .on('mouseleave', tipHide)
        .on('click', function (ev, c) {
          state.n = c.n; state.len = c.len;
          $('co2-n').value = c.n; $('co2-len').value = c.len;
          readState(); renderAll();
        });
      /* 等高线 */
      var contours = d3.contours().size([GRID.n, GRID.l]).thresholds([45, RISK_LIMIT, 80])(values);
      var toX = function (i) { return M.l + i * cw; };
      var toY = function (j) { return M.t + j * ch; };
      contours.forEach(function (c) {
        var dpath = '';
        c.coordinates.forEach(function (poly) {
          poly.forEach(function (ring) {
            ring.forEach(function (p, i) {
              dpath += (i ? 'L' : 'M') + toX(p[0]).toFixed(1) + ',' + toY(p[1]).toFixed(1);
            });
            dpath += 'Z';
          });
        });
        var th = c.value;
        svg.append('path').attr('d', dpath).attr('fill', 'none')
          .attr('stroke', th === RISK_LIMIT ? '#b05a51' : '#8a6a3f')
          .attr('stroke-width', th === RISK_LIMIT ? 2 : 1)
          .attr('stroke-dasharray', th === RISK_LIMIT ? '5 3' : '2 3')
          .attr('opacity', th === RISK_LIMIT ? 1 : 0.7);
      });
      heatmapAxes(svg, x, y, W, H, M);
      drawMarkers(svg, x, y, { n: state.n, len: state.len }, { n: res.opt.n, len: res.opt.len, mode: mode }, '推荐');
      /* 不可行区：在阈值之外再压一层斜线，避免只靠虚线判断内外 */
      svg.append('rect')
        .attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'none').attr('stroke', '#b05a51').attr('stroke-opacity', '.28')
        .attr('stroke-dasharray', '1 4');
      var over = cells.filter(function (c) { return c.risk > RISK_LIMIT; }).length;
      /* 标注放左上角：右上角被阈值等高线穿过，文字会看不清 */
      svg.append('rect').attr('x', M.l - 2).attr('y', M.t - 6)
        .attr('width', 132).attr('height', 30).attr('rx', 3)
        .attr('fill', '#fff').attr('opacity', .82);
      svg.append('text').attr('x', M.l + 4).attr('y', M.t + 4)
        .attr('font-size', 9.5).attr('fill', '#b05a51')
        .text('虚线 = 风险阈值 ' + RISK_LIMIT);
      svg.append('text').attr('x', M.l + 4).attr('y', M.t + 17)
        .attr('font-size', 9).attr('fill', '#79828a')
        .text('超阈值组合 ' + over + ' / ' + cells.length);
    }

    /* ---------------- 输出 ---------------- */
    function renderOutput(res) {
      var opt = res.opt, base = res.base, cur = res.cur;
      $('co2-k-combo').textContent = opt.n + ' 孔/m · ' + opt.phase + '° · ' + opt.d + ' mm · ' + opt.len + ' m';
      $('co2-k-q').innerHTML = opt.q.toFixed(1) + '<small>t/d</small>';
      var riskEl = $('co2-k-risk');
      riskEl.innerHTML = opt.risk.toFixed(0) + '<small>/100</small>';
      riskEl.className = opt.risk < 45 ? 'ok' : (opt.risk <= RISK_LIMIT ? 'warn' : 'bad');
      var gain = (opt.q - base.q) / Math.max(base.q, 1) * 100;
      $('co2-k-gain').innerHTML = (gain >= 0 ? '+' : '') + gain.toFixed(1) + '<small>%</small>';
      $('co2-k-gain').className = gain > 0 ? 'ok' : 'bad';
      /* 前后对比条：经验方案 vs AI 推荐方案，同一地层压力、同一代理模型 */
      var cmpMax = Math.max(base.q, opt.q, 1);
      $('co2-cmp').innerHTML =
        '<div class="iq-cmp-h"><span>前后对比 · 预测日产 (t/d)</span>' +
        '<span class="delta' + (gain < 0 ? ' bad' : '') + '">' + (gain >= 0 ? '+' : '') + gain.toFixed(1) + '%</span></div>' +
        '<div class="iq-cmp-row"><span class="lb">经验方案</span>' +
        '<div class="tr"><i style="width:' + (base.q / cmpMax * 100).toFixed(1) + '%"></i></div>' +
        '<b>' + base.q.toFixed(1) + '</b></div>' +
        '<div class="iq-cmp-row ai"><span class="lb">AI 方案</span>' +
        '<div class="tr"><i class="ai" style="width:' + (opt.q / cmpMax * 100).toFixed(1) + '%"></i></div>' +
        '<b>' + opt.q.toFixed(1) + '</b></div>';
      $('co2-k-conf').innerHTML = res.conf + '<small>%</small>';
      $('co2-conf-bar').style.width = res.conf + '%';
      $('co2-conf-bar').className = res.conf >= 75 ? '' : (res.conf >= 55 ? 'warn' : 'bad');
      $('co2-conf-txt').textContent = '风险余量 ' + (RISK_LIMIT - opt.risk).toFixed(0) + ' 分 · 搜索 ' + (21 * 19 * 6 * 9) + ' 组参数';
      $('co2-out-mini').textContent = (mode === 'q' ? '极限产能' : mode === 'risk' ? '最低风险' : '约束内最优') + (opt.feasible ? '' : ' · 超阈值');
      $('co2-figlabel').textContent = '当前参数';
      $('co2-rank').textContent = '风险 ' + cur.risk.toFixed(0) + ' / 100';

      var modeNote = $('co2-mode-note');
      if (mode === 'q') {
        modeNote.className = 'iq-note slim clay';
        modeNote.innerHTML = '<b>最高产能口径：</b>只追日产，不看风险阈值。推荐解风险 ' + opt.risk.toFixed(0) + '，' +
          (opt.feasible ? '恰好仍在阈值内。' : '已超阈值 ' + (opt.risk - RISK_LIMIT).toFixed(0) + '，属于“看上限”的参考解，不建议直接施工。');
      } else if (mode === 'risk') {
        modeNote.className = 'iq-note slim blue';
        modeNote.innerHTML = '<b>最低风险口径：</b>要求日产不低于全局最优的 85%，再取风险最低的组合。日产 ' + opt.q.toFixed(1) +
          ' t/d、风险 ' + opt.risk.toFixed(0) + '，余量 ' + (RISK_LIMIT - opt.risk).toFixed(0) + ' 分。';
      } else {
        modeNote.className = 'iq-note slim';
        modeNote.innerHTML = '<b>综合最优口径：</b>风险 ≤ ' + RISK_LIMIT + ' 的前提下最大化日产；推荐解风险 ' + opt.risk.toFixed(0) +
          '，余量 ' + (RISK_LIMIT - opt.risk).toFixed(0) + ' 分。';
      }

      $('co2-detail').innerHTML =
        '<table class="iq-table">' +
        '<tr><td>孔密 / 相位</td><td class="num">' + state.n + ' 孔/m · ' + state.phase + '°</td></tr>' +
        '<tr><td>孔径 / 段长</td><td class="num">' + state.d + ' mm · ' + state.len + ' m</td></tr>' +
        '<tr><td>预测日产</td><td class="num">' + cur.q.toFixed(1) + ' t/d</td></tr>' +
        '<tr><td>风险指数</td><td class="num">' + cur.risk.toFixed(0) + ' / 100</td></tr>' +
        '<tr><td>当前搜索口径</td><td class="num">' + (mode === 'q' ? '最高产能' : mode === 'risk' ? '最低风险' : '综合最优') + '</td></tr>' +
        '<tr><td>推荐方案</td><td class="num">' + res.opt.n + ' 孔/m · ' + res.opt.len + ' m</td></tr>' +
        '</table>' +
        '<p class="iq-poll" style="margin-top:6px">点击热力图或等高线中的单元格可直接切换参数。</p>';

      var note = $('co2-note');
      if (!opt.feasible) {
        note.className = 'iq-note red';
        note.innerHTML = '<b>无可行解：</b>当前地层压力下所有组合的风险都超过阈值，模型退回“风险最小”方案。建议降低孔密或缩短射孔段。';
      } else if (opt.risk > RISK_LIMIT - 3) {
        note.className = 'iq-note clay';
        note.innerHTML = '<b>边界解：</b>推荐组合风险 ' + opt.risk.toFixed(0) + '，已贴近阈值 ' + RISK_LIMIT + '。现场参数波动可能导致超限，建议保留低一档孔密的备选方案。';
      } else {
        note.className = 'iq-note';
        note.innerHTML = '<b>结论：</b>在当前地层压力下，' + opt.n + ' 孔/m、' + opt.phase + '° 相位、' + opt.d + ' mm 孔径、' + opt.len + ' m 段长可在风险阈值内取得最高日产。';
      }

      var ex = $('co2-explain');
      ex.innerHTML = '<b>为什么不是“孔密越高越好”：</b>孔密从 ' + N_MIN + ' 提到 ' + N_MAX + ' 孔/m，日产增幅逐渐饱和，但出砂与套管损伤风险近似线性上升；' +
        '本图最优点落在风险约束边界附近。相位 ' + opt.phase + '° 的产能因子为 ' + (PHASE_FACTOR[opt.phase]).toFixed(2) + '，在四孔/六孔分散与单孔产能之间取得平衡。' +
        '<br>当前方案日产 ' + cur.q.toFixed(1) + ' t/d、风险 ' + cur.risk.toFixed(0) + '；AI 方案日产 ' + opt.q.toFixed(1) + ' t/d、风险 ' + opt.risk.toFixed(0) + '。';

      var b = calc(EXPERIENCE.n, EXPERIENCE.phase, EXPERIENCE.d, EXPERIENCE.len, state.pressure);
      $('co2-table').innerHTML =
        '<table class="iq-table">' +
        '<tr><th>参数 / 指标</th><th>经验方案</th><th>AI 方案</th><th>差异</th></tr>' +
        '<tr><td>孔密</td><td class="num">' + EXPERIENCE.n + ' 孔/m</td><td class="num">' + opt.n + ' 孔/m</td><td class="num">' + (opt.n - EXPERIENCE.n >= 0 ? '+' : '') + (opt.n - EXPERIENCE.n) + '</td></tr>' +
        '<tr><td>相位</td><td class="num">' + EXPERIENCE.phase + '°</td><td class="num">' + opt.phase + '°</td><td class="num">' + (opt.phase - EXPERIENCE.phase >= 0 ? '+' : '') + (opt.phase - EXPERIENCE.phase) + '°</td></tr>' +
        '<tr><td>孔径</td><td class="num">' + EXPERIENCE.d + ' mm</td><td class="num">' + opt.d + ' mm</td><td class="num">' + (opt.d - EXPERIENCE.d >= 0 ? '+' : '') + (opt.d - EXPERIENCE.d) + ' mm</td></tr>' +
        '<tr><td>段长</td><td class="num">' + EXPERIENCE.len + ' m</td><td class="num">' + opt.len + ' m</td><td class="num">' + (opt.len - EXPERIENCE.len >= 0 ? '+' : '') + (opt.len - EXPERIENCE.len) + ' m</td></tr>' +
        '<tr class="hl"><td>预测日产</td><td class="num">' + b.q.toFixed(1) + ' t/d</td><td class="num">' + opt.q.toFixed(1) + ' t/d</td><td class="num">' + (opt.q - b.q >= 0 ? '+' : '') + (opt.q - b.q).toFixed(1) + '</td></tr>' +
        '<tr><td>风险指数</td><td class="num">' + b.risk.toFixed(0) + '</td><td class="num">' + opt.risk.toFixed(0) + '</td><td class="num">' + (opt.risk - b.risk <= 0 ? '' : '+') + (opt.risk - b.risk).toFixed(0) + '</td></tr>' +
        '</table>' +
        '<p class="iq-poll">经验方案取行业常见的 16 孔/m、60°、10 mm、8 m；两者使用同一代理模型计算。</p>';
    }

    /* ---------------- 学习层：孔密双轴扫描 ---------------- */
    function renderScanN(res) {
      var box = $('co2-scan');
      box.innerHTML = '';
      var pts = [], n;
      for (n = N_MIN; n <= N_MAX; n++) {
        var m = calc(n, state.phase, state.d, state.len, state.pressure);
        pts.push({ n: n, q: m.q, risk: m.risk, feasible: m.risk <= RISK_LIMIT });
      }
      var W = 640, H = 252, M = { t: 18, r: 44, b: 40, l: 46 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '孔密与日产、风险的双轴扫描');
      var x = d3.scaleLinear().domain([N_MIN, N_MAX]).range([M.l, W - M.r]);
      var qmax = Math.max(1, d3.max(pts, function (p) { return p.q; }) * 1.15);
      var yq = d3.scaleLinear().domain([0, qmax]).range([H - M.b, M.t]);
      var yr = d3.scaleLinear().domain([0, 100]).range([H - M.b, M.t]);

      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(yq).ticks(4).tickSize(-(W - M.l - M.r)))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick line').attr('stroke', '#f1eee6');
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#9ba3a9');
        });
      svg.append('g').attr('transform', 'translate(' + (W - M.r) + ',0)')
        .call(d3.axisRight(yr).ticks(4).tickSize(0))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('.tick text').attr('font-size', 8.5).attr('fill', '#c58b62');
        });
      svg.append('g').attr('transform', 'translate(0,' + (H - M.b) + ')')
        .call(d3.axisBottom(x).tickValues([4, 8, 12, 16, 20, 24]).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 8.5).attr('fill', '#9ba3a9').attr('dy', '1em');
      svg.append('text').attr('x', M.l).attr('y', 12).attr('font-size', 9).attr('fill', '#9ba3a9').text('日产 t/d');
      svg.append('text').attr('x', W - M.r).attr('y', 12).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#c58b62').text('风险');
      svg.append('text').attr('x', W - M.r).attr('y', H - 6).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#9ba3a9').text('孔密（孔/m）→');

      svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', yr(RISK_LIMIT)).attr('y2', yr(RISK_LIMIT))
        .attr('stroke', '#b05a51').attr('stroke-dasharray', '4 3').attr('stroke-width', 1);
      svg.append('text').attr('x', M.l + 4).attr('y', yr(RISK_LIMIT) - 5)
        .attr('font-size', 8.5).attr('fill', '#b05a51').text('风险阈值 ' + RISK_LIMIT);

      var lq = d3.line().x(function (p) { return x(p.n); }).y(function (p) { return yq(p.q); });
      var lr = d3.line().x(function (p) { return x(p.n); }).y(function (p) { return yr(p.risk); });
      svg.append('path').attr('d', lq(pts)).attr('fill', 'none').attr('stroke', '#3a352d').attr('stroke-width', 2.2);
      svg.append('path').attr('d', lr(pts)).attr('fill', 'none').attr('stroke', '#c58b62').attr('stroke-width', 1.6).attr('stroke-dasharray', '4 3');
      svg.selectAll('.pq').data(pts).enter().append('circle')
        .attr('cx', function (p) { return x(p.n); }).attr('cy', function (p) { return yq(p.q); })
        .attr('r', 2.6).attr('fill', '#fff').attr('stroke', '#3a352d').attr('stroke-width', 1.4);
      svg.selectAll('.pr').data(pts.filter(function (p) { return p.risk > RISK_LIMIT; })).enter().append('circle')
        .attr('cx', function (p) { return x(p.n); }).attr('cy', function (p) { return yr(p.risk); })
        .attr('r', 2.2).attr('fill', '#b05a51');

      svg.append('line').attr('x1', x(state.n)).attr('x2', x(state.n)).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#a03d4f').attr('stroke-width', 1.2).attr('stroke-dasharray', '3 3');
      svg.append('text').attr('x', x(state.n) - 4).attr('y', H - M.b - 8).attr('text-anchor', 'end')
        .attr('font-size', 8.5).attr('fill', '#a03d4f').text('当前 ' + state.n);
      svg.append('line').attr('x1', x(res.opt.n)).attr('x2', x(res.opt.n)).attr('y1', M.t).attr('y2', H - M.b)
        .attr('stroke', '#a9852f').attr('stroke-width', 1.6);
      svg.append('text').attr('x', x(res.opt.n) + 4).attr('y', H - M.b - 8)
        .attr('font-size', 8.5).attr('fill', '#a9852f').text('AI ' + res.opt.n);

      var overlay = svg.append('rect').attr('x', M.l).attr('y', M.t)
        .attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .attr('fill', 'transparent').style('cursor', 'crosshair');
      overlay.on('mousemove', function (ev) {
        var mx = d3.pointer(ev, svg.node())[0];
        var nNear = Math.round(clamp(x.invert(mx), N_MIN, N_MAX));
        var p = pts.reduce(function (a, q2) { return Math.abs(q2.n - nNear) < Math.abs(a.n - nNear) ? q2 : a; }, pts[0]);
        tipShow('孔密 <b>' + p.n + '</b> 孔/m<br>日产 <b>' + p.q.toFixed(1) + '</b> t/d · 风险 <b>' + p.risk.toFixed(0) + '</b>' +
          (p.feasible ? '<br>在风险阈值内' : '<br><span style="color:#e8a49b">超出阈值，不可行</span>'), ev);
      }).on('mouseleave', tipHide);

      var firstOver = pts.filter(function (p) { return p.risk > RISK_LIMIT; })[0];
      $('co2-scan-mini').textContent = '相位 ' + state.phase + '° · 孔径 ' + state.d + ' mm · 段长 ' + state.len + ' m';
      $('co2-scan-note').innerHTML = '当前孔密 <b>' + state.n + '</b>：日产 <b>' + res.cur.q.toFixed(1) + '</b> t/d、风险 <b>' +
        res.cur.risk.toFixed(0) + '</b>。' + (firstOver ? '从 <b>' + firstOver.n + '</b> 孔/m 起风险超过 ' + RISK_LIMIT + '。' : '整段孔密都在阈值内。') +
        '日产随孔密上升但逐渐饱和，风险近似直线上升——这就是要“在约束内找最优”的原因。';
    }

    /* ---------------- 学习层：三方案卡 ---------------- */
    function renderScheme(res) {
      var base = res.base, cur = res.cur, opt = res.opt;
      var cards = [
        { k: 'exp', cap: '经验 EXPERIENCE', cls: 'alt', nm: EXPERIENCE.n + ' 孔/m · ' + EXPERIENCE.phase + '° · ' + EXPERIENCE.d + ' mm · ' + EXPERIENCE.len + ' m', q: base.q, risk: base.risk },
        { k: 'cur', cap: '当前 CURRENT', cls: 'alt', nm: state.n + ' 孔/m · ' + state.phase + '° · ' + state.d + ' mm · ' + state.len + ' m', q: cur.q, risk: cur.risk },
        { k: 'ai', cap: '推荐 RECOMMEND', cls: 'reco', nm: opt.n + ' 孔/m · ' + opt.phase + '° · ' + opt.d + ' mm · ' + opt.len + ' m', q: opt.q, risk: opt.risk }
      ];
      $('co2-scheme').innerHTML = cards.map(function (c) {
        return '<div class="iq-tcard ' + c.cls + '" data-k="' + c.k + '">' +
          '<div class="cap">' + c.cap + '</div><div class="nm">' + c.nm + '</div>' +
          '<div class="val">' + c.q.toFixed(1) + '<small>t/d</small></div>' +
          '<div class="sub">风险 ' + c.risk.toFixed(0) + ' / 100 · 余量 ' + (RISK_LIMIT - c.risk).toFixed(0) + ' 分</div></div>';
      }).join('');
      var gain = (opt.q - base.q) / Math.max(base.q, 1) * 100;
      $('co2-scheme-note').innerHTML = '推荐方案较经验方案日产 <b>' + (gain >= 0 ? '+' : '') + gain.toFixed(1) +
        '%</b>，风险 <b>' + opt.risk.toFixed(0) + '</b>（阈值 ' + RISK_LIMIT + '）。点击“经验”或“推荐”卡可直接套用参数。';
    }

    function applyScheme(k) {
      if (k === 'cur') return;
      var src = k === 'exp' ? EXPERIENCE : optimize(state, { mode: mode });
      state.n = src.n; state.phase = src.phase; state.d = src.d; state.len = src.len;
      $('co2-n').value = state.n; $('co2-phase').value = String(state.phase);
      $('co2-d').value = state.d; $('co2-len').value = state.len;
      readState(); renderAll();
    }

    /* ---------------- 状态 ---------------- */
    function readState() {
      state.n = Number($('co2-n').value);
      state.phase = Number($('co2-phase').value);
      state.d = Number($('co2-d').value);
      state.len = Number($('co2-len').value);
      state.pressure = Number($('co2-pressure').value);
      $('co2-o-n').textContent = state.n + ' 孔/m';
      $('co2-o-phase').textContent = state.phase + '° · ' + PHASE_HOLES[state.phase] + ' 孔';
      $('co2-o-d').textContent = state.d + ' mm';
      $('co2-o-len').textContent = state.len + ' m';
      $('co2-o-p').textContent = state.pressure + ' MPa';
    }

    function setPhase(ph) {
      state.phase = Number(ph);
      $('co2-phase').value = String(ph);
      readState();
      renderAll();
    }

    /* 智能方法说明：数值来自本轮代理模型与网格搜索结果 */
    function renderSmart(res) {
      if (!window.IQSmart || !smartBox) return;
      var base = res.base, opt = res.opt, cur = res.cur;
      function dlt(a, b, unit) {
        var d = b - a;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(1) + (unit || ''), cls: d >= 0 ? 'ok' : 'bad' };
      }
      var gain = (opt.q - base.q) / Math.max(base.q, 1) * 100;
      var rd = opt.risk - base.risk;
      var riskDelta = { v: (rd >= 0 ? '+' : '') + rd.toFixed(0), cls: rd <= 0 ? 'ok' : 'bad' };
      var rows = [
        { cells: ['射孔参数', EXPERIENCE.n + ' 孔/m · ' + EXPERIENCE.phase + '° · ' + EXPERIENCE.d + ' mm · ' + EXPERIENCE.len + ' m', opt.n + ' 孔/m · ' + opt.phase + '° · ' + opt.d + ' mm · ' + opt.len + ' m', '—', '同一地层压力'] },
        { cells: ['预测日产 (t/d)', base.q.toFixed(1), opt.q.toFixed(1), dlt(base.q, opt.q), '—'] },
        { cells: ['风险指数 (0—100)', base.risk.toFixed(0), opt.risk.toFixed(0), riskDelta, { v: opt.feasible ? '≤ 阈值 ' + RISK_LIMIT : '超阈值', cls: opt.feasible ? 'ok' : 'bad' }] },
        { cells: ['较经验增产', '0%', (gain >= 0 ? '+' : '') + gain.toFixed(1) + '%', '—', '—'], hl: true },
        { cells: ['当前输入方案', cur.q.toFixed(1) + ' t/d', cur.risk.toFixed(0) + ' 风险', '—', { v: cur.risk <= RISK_LIMIT ? '当前可行' : '当前超阈值', cls: cur.risk <= RISK_LIMIT ? 'ok' : 'bad' }] }
      ];
      smartBox.innerHTML = window.IQSmart.render({
        kicker: 'SMART METHOD · SURROGATE + SEARCH',
        title: '产能代理模型 + 风险约束网格搜索',
        subtitle: '约 2 万组参数组合中，先筛掉不可施工的，再选日产最高的',
        badge: '搜索 ' + opt.evaluated + ' 组',
        /* 主视觉：当前相位/孔径下，孔密×段长 399 组组合的「日产—风险」散点，
           绿点=风险阈值内，圈=本轮被选中的组合。 */
        algoSvg: window.IQAlgo ? (function () {
          var pts = [];
          for (var nn = N_MIN; nn <= N_MAX; nn++) {
            for (var LL = L_MIN; LL <= L_MAX; LL++) {
              var mm = calc(nn, state.phase, state.d, LL, state.pressure);
              pts.push({ x: mm.q, y: mm.risk, ok: mm.risk <= RISK_LIMIT });
            }
          }
          return window.IQAlgo.scatter({
            points: pts,
            xLabel: '预测日产 (t/d) →',
            yLabel: '风险指数',
            yLine: RISK_LIMIT,
            yLineLabel: '风险阈值 ' + RISK_LIMIT,
            pick: { x: opt.q, y: opt.risk },
            pickLabel: '推荐 ' + opt.n + ' 孔/m · ' + opt.len + ' m'
          });
        })() : '',
        algoCap: '<span><i style="background:rgba(53,120,90,.55)"></i>风险阈值内的可行组合</span>' +
          '<span><i style="background:rgba(168,82,73,.45)"></i>越界组合</span>' +
          '<span>每个点 = 一组「孔密 × 段长」的真实试算结果；沿右上方走是"更产能、更高风险"的取舍</span>',
        input: '孔密、相位、孔径、段长、地层压力 5 个参数',
        output: '风险阈值内的参数组合、预测日产、风险指数与推荐置信度',
        problem: '参数组合多，现场标准方案未必适应当前地层压力；靠试错成本高',
        fit: '代理模型可毫秒级评估组合，风险模型把出砂/套管损伤超限的组合直接排除',
        flow: ['储层 / 压力参数', '代理模型估算日产与风险', '四维网格搜索', '风险 ≤ ' + RISK_LIMIT + ' 约束', '推荐参数组合', '工程师复核'],
        trace: [
          ['评估组合', opt.evaluated + ' 组'],
          ['风险内可行', opt.feasibleCount + ' 组'],
          ['可行率', (opt.feasibleCount / Math.max(opt.evaluated, 1) * 100).toFixed(1) + '%'],
          ['当前方案风险', cur.risk.toFixed(0) + ' / ' + RISK_LIMIT],
          ['搜索口径', mode === 'q' ? '极限产能' : (mode === 'risk' ? '最低风险' : '约束内最优')]
        ],
        compare: {
          title: '经验标准方案 vs AI 推荐方案',
          columns: ['指标', '经验方案', '智能方案', '变化', '约束 / 说明'],
          rows: rows,
          note: '经验方案取现场常用标准组合；AI 方案在同一代理模型、同一地层压力下搜索得到。'
        },
        why: [
          '孔密从 ' + N_MIN + ' 提到 ' + N_MAX + ' 孔/m，日产增幅逐渐饱和，但出砂与套管损伤风险近似线性上升，所以最优点落在风险约束边界附近。',
          '相位 ' + opt.phase + '° 的产能因子为 ' + (PHASE_FACTOR[opt.phase]).toFixed(2) + '，在“孔眼分散均匀”和“单孔产能”之间取得平衡，这是规则搜索能自动比较的部分。',
          '推荐解的风险余量为 ' + (RISK_LIMIT - opt.risk).toFixed(0) + ' 分，置信度 ' + res.conf + '%；余量越小，现场参数波动导致超限的可能性越大。'
        ],
        bounds: [
          '本示范的产能与风险公式是简化的代理模型，使用合成数据，未用真实靶试、试油或出砂监测数据标定。',
          '模型只比较孔密/相位/孔径/段长：孔径已按 API RP 19B 器材样本做穿深折减，但未区分具体弹型、储层非均质性与井壁稳定等现场因素。',
          '若所有组合都超风险阈值，模型会退回风险最小方案；此时必须由工程师决定降孔密、缩短段长或更换完井方式。'
        ]
      });
    }

    function renderAll() {
      var cur = calc(state.n, state.phase, state.d, state.len, state.pressure);
      var base = calc(EXPERIENCE.n, EXPERIENCE.phase, EXPERIENCE.d, EXPERIENCE.len, state.pressure);
      var opt = optimize(state, { mode: mode });
      var conf = confidence(opt, base);
      var res = {
        cur: cur, base: base, opt: opt, conf: conf,
        gridQ: surface(state, 'q')
      };
      renderSmart(res);
      $('co2-figure').innerHTML = figureSvg(state, opt);
      $('co2-figlabel').textContent = state.n + ' 孔/m · ' + state.phase + '° · ' + state.d + ' mm · ' + state.len + ' m';
      renderHeat(res);
      renderRisk(res);
      renderOutput(res);
      renderScanN(res);
      renderScheme(res);
    }

    /* ---------------- 事件 ---------------- */
    ['co2-n', 'co2-d', 'co2-len', 'co2-pressure'].forEach(function (id) {
      listen($(id), 'input', function () { readState(); renderAll(); });
    });
    listen($('co2-phase'), 'change', function () { readState(); renderAll(); });
    listen($('co2-reset'), 'click', function () {
      state.n = DEFAULTS.n; state.phase = DEFAULTS.phase; state.d = DEFAULTS.d;
      state.len = DEFAULTS.len; state.pressure = DEFAULTS.pressure;
      $('co2-n').value = state.n; $('co2-phase').value = String(state.phase);
      $('co2-d').value = state.d; $('co2-len').value = state.len; $('co2-pressure').value = state.pressure;
      readState(); renderAll();
    });
    listen($('co2-exp'), 'click', function () {
      state.n = EXPERIENCE.n; state.phase = EXPERIENCE.phase; state.d = EXPERIENCE.d; state.len = EXPERIENCE.len;
      $('co2-n').value = state.n; $('co2-phase').value = String(state.phase);
      $('co2-d').value = state.d; $('co2-len').value = state.len;
      readState(); renderAll();
    });
    listen($('co2-ai'), 'click', function () {
      var opt = optimize(state, { mode: mode });
      state.n = opt.n; state.phase = opt.phase; state.d = opt.d; state.len = opt.len;
      $('co2-n').value = state.n; $('co2-phase').value = String(state.phase);
      $('co2-d').value = state.d; $('co2-len').value = state.len;
      readState(); renderAll();
    });
    $('co2-mode').querySelectorAll('button').forEach(function (btn) {
      listen(btn, 'click', function () {
        mode = btn.getAttribute('data-mode');
        $('co2-mode').querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('on', b === btn);
        });
        renderAll();
      });
    });

    /* 方案卡交互 */
    listen($('co2-scheme'), 'click', function (ev) {
      var c = ev.target.closest ? ev.target.closest('.iq-tcard') : null;
      if (!c) return;
      applyScheme(c.getAttribute('data-k'));
    });

    readState();
    renderAll();

    return {
      unmount: function () {
        cleanups.forEach(function (fn) { try { fn(); } catch (e) { } });
        cleanups.length = 0;
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
