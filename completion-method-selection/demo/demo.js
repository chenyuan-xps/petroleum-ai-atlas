/* =========================================================
   co1 完井方式智能优选 · 交互示范
   ---------------------------------------------------------
   参数化评分 + TOPSIS + 权重敏感性
   页面模式与站点插件模式共用同一份代码：
     window.__IQ_DEMOS__['completion-method-selection'] = boot
   本示范使用合成数据，仅用于展示方法流程。
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'completion-method-selection';

  /* =========================================================
     以下模型与概念图形移到模块作用域：
     站点「案例流程」页直接复用同一套公式与图形，避免另写一份。
     ========================================================= */
  var METHODS = [
    { id: 'open', name: '裸眼完井', short: '裸眼', cost: 280, sand: 8, easy: 82, relBonus: 6 },
    { id: 'perf', name: '射孔完井', short: '射孔', cost: 520, sand: 38, easy: 70, relBonus: 8 },
    { id: 'screen', name: '筛管完井', short: '筛管', cost: 760, sand: 82, easy: 58, relBonus: 10 },
    { id: 'gravel', name: '砾石充填', short: '砾石', cost: 1080, sand: 96, easy: 38, relBonus: 12 },
    { id: 'frac', name: '压裂充填', short: '压裂', cost: 1460, sand: 88, easy: 30, relBonus: 10 }
  ];
  var CRIT = [
    { key: 'prod', name: '产能潜力', short: '产能' },
    { key: 'sand', name: '防砂能力', short: '防砂' },
    { key: 'eco', name: '经济性', short: '经济' },
    { key: 'rel', name: '可靠性', short: '可靠' },
    { key: 'easy', name: '施工便利', short: '施工' }
  ];
  var WEIGHTS = {
    balanced: { name: '均衡', w: [0.28, 0.22, 0.20, 0.20, 0.10] },
    sand: { name: '防砂优先', w: [0.18, 0.38, 0.14, 0.20, 0.10] },
    cost: { name: '投资优先', w: [0.20, 0.14, 0.38, 0.18, 0.10] },
    stim: { name: '增产优先', w: [0.34, 0.16, 0.14, 0.26, 0.10] }
  };
  var DEFAULTS = { perm: 80, pressure: 32, sandRisk: 0.55, budget: 900, target: 40, pref: 'balanced' };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function buildRows(st) {
    var pl = clamp(Math.log(st.perm / 5) / Math.log(100), 0, 1);
    var req = st.sandRisk * 100;
    var pf = (st.pressure - 10) / 50;
    return METHODS.map(function (m) {
      var prod;
      if (m.id === 'frac') prod = 56 + 24 * (1 - pl);
      else prod = { open: 50, perf: 42, screen: 48, gravel: 34 }[m.id] + 45 * pl;
      prod += (pf - 0.5) * 12;
      prod = clamp(prod, 5, 100);

      var ratio = m.cost / st.budget;
      var eco = clamp(100 * (1.25 - 0.75 * ratio), 0, 100);
      var rel = clamp(30 + 0.55 * m.sand - 0.35 * req + (st.pressure - 30) * 0.4 + m.relBonus, 0, 100);
      var q = 8 + prod * 0.45;
      return {
        id: m.id, name: m.name, short: m.short, cost: m.cost,
        vals: [prod, m.sand, eco, rel, m.easy],
        prod: prod, sand: m.sand, eco: eco, rel: rel, easy: m.easy, q: q
      };
    });
  }

  function rankedRows(st, w) {
    var rows = buildRows(st);
    var scores = topsis(rows, w);
    rows.forEach(function (r, i) { r.score = scores[i]; });
    rows.sort(function (a, b) { return b.score - a.score; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }

  function evaluate(st, wOverride) {
    var w = wOverride || WEIGHTS[st.pref].w;
    var ranked = rankedRows(st, w);
    var rows = ranked.slice().sort(function (a, b) { return METHODS.map(function (m) { return m.id; }).indexOf(a.id) - METHODS.map(function (m) { return m.id; }).indexOf(b.id); });
    var best = ranked[0], second = ranked[1];
    var gap = best.score - second.score;
    var stable = stabilityCount(st, best.id);

    var conf = 48 + 32 * clamp(gap / 10, 0, 1) + 15 * ((stable / 10) - 0.5);
    conf += (best.cost <= st.budget ? 6 : -8);
    conf += (best.rel >= 55 ? 5 : -6);
    conf = clamp(Math.round(conf), 32, 96);

    var risk = best.rel >= 70 ? '低' : (best.rel >= 50 ? '中' : '高');
    var base = rows.filter(function (r) { return r.id === 'perf'; })[0];

    return {
      rows: rows, ranked: ranked, best: best, second: second,
      gap: gap, stable: stable, conf: conf, risk: risk,
      baseline: base, weights: w, req: st.sandRisk * 100, pl: clamp(Math.log(st.perm / 5) / Math.log(100), 0, 1)
    };
  }

  function topsis(rows, w) {
    var n = CRIT.length, sum2 = [];
    var i, j;
    for (j = 0; j < n; j++) {
      var s = 0;
      for (i = 0; i < rows.length; i++) s += rows[i].vals[j] * rows[i].vals[j];
      sum2[j] = Math.sqrt(s) || 1;
    }
    var v = rows.map(function (r) {
      return r.vals.map(function (x, j2) { return (x / sum2[j2]) * w[j2]; });
    });
    var best = [], worst = [];
    for (j = 0; j < n; j++) {
      var col = v.map(function (r) { return r[j]; });
      best[j] = Math.max.apply(null, col);
      worst[j] = Math.min.apply(null, col);
    }
    return v.map(function (r) {
      var dp = 0, dn = 0;
      for (var j2 = 0; j2 < n; j2++) {
        dp += Math.pow(r[j2] - best[j2], 2);
        dn += Math.pow(r[j2] - worst[j2], 2);
      }
      var d1 = Math.sqrt(dp), d2 = Math.sqrt(dn);
      return (d1 + d2) ? (d2 / (d1 + d2)) * 100 : 0;
    });
  }

  function topIdFor(st, w) {
    var rows = rankedRows(st, w);
    return rows[0].id;
  }

  function stabilityCount(st, id) {
    var baseW = WEIGHTS[st.pref].w, count = 0;
    perturbList(st, baseW).forEach(function (p) {
      if (p.top.id === id) count++;
    });
    return count;
  }

  /* 权重扰动清单：五项指标各 ±25%，共 10 组 */
  function perturbList(st, baseW) {
    var out = [];
    CRIT.forEach(function (c, j) {
      [1.25, 0.75].forEach(function (f) {
        var w = baseW.slice();
        w[j] *= f;
        var sum = w.reduce(function (a, b) { return a + b; }, 0);
        w = w.map(function (x) { return x / sum; });
        var rows = rankedRows(st, w);
        out.push({ crit: c.name, dir: f > 1 ? 'up' : 'down', w: w, top: rows[0], gap: rows[0].score - rows[1].score });
      });
    });
    return out;
  }

  /* ---------------- 概念图解（案例流程左侧复用） ---------------- */
  var CONCEPTS = [
    { t: '完井', prof: '把地下储层与地面生产设备连接起来，形成油气流出的通道。', life: '像给一块吸饱油的海绵插一根吸管。', see: '右图：油从储层经孔眼/筛管进入井筒，再沿井筒流向地面。' },
    { t: '储层', prof: '岩石孔隙中储存油和气，孔隙越大、连通越好，油越容易流动。', life: '像一块有很多小孔的海绵。', see: '黄色层里的圆点就是孔隙中的油。' },
    { t: '完井方式优选', prof: '在多种完井方式之间比较产能、防砂、投资与风险，再排序。', life: '像买手机比价格、性能、续航，再按你最在意的项排序。', see: '下方对比图里五种方式各有取舍，没有绝对最好，只有当前更合适。' }
  ];

  function conceptSvg() {
    var s = '<svg viewBox="0 0 700 332" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="完井概念图解：生活比喻与五种专业结构">';
    s += '<rect width="700" height="332" fill="#fff"/>';
    /* 左：生活比喻 */
    s += '<rect x="8" y="8" width="306" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += '<text x="22" y="27" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">生活比喻 · 海绵与吸管</text>';
    s += '<rect x="22" y="36" width="278" height="34" fill="#f3efe3"/>';
    s += '<text x="30" y="57" font-size="8.5" fill="#9ba3a9">地面 · 生产设备</text>';
    s += '<line x1="22" y1="70" x2="300" y2="70" stroke="#d8d2c4"/>';
    s += '<rect x="150" y="40" width="14" height="14" rx="2" fill="#d4d0c8" stroke="#8d979d"/>';
    s += '<line x1="152" y1="54" x2="152" y2="248" stroke="#8d979d" stroke-width="3.6"/>';
    s += '<line x1="162" y1="54" x2="162" y2="248" stroke="#8d979d" stroke-width="3.6"/>';
    s += '<text x="176" y="62" font-size="8.5" fill="#4a545d">井筒 = 吸管</text>';
    s += '<line x1="146" y1="80" x2="146" y2="46" stroke="#b26a39" stroke-width="1.2" marker-end="url(#co1-c-ar)"/>';
    s += '<defs><marker id="co1-c-ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#b26a39"/></marker>' +
      '<marker id="co1-c-ar2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#a03d4f"/></marker>' +
      '<marker id="co1-r-ar" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 L5 2.5 L0 5 z" fill="#b26a39"/></marker></defs>';
    s += '<text x="22" y="92" font-size="8.5" fill="#b26a39">箭头：石油沿井筒流向地面</text>';
    s += '<rect x="22" y="196" width="278" height="96" rx="10" fill="#e9dfc7" stroke="#d8c9a3"/>';
    s += '<text x="34" y="214" font-size="9.5" fill="#8a744a">储层 = 吸饱油的海绵</text>';
    for (var i = 0; i < 22; i++) {
      s += '<circle cx="' + (40 + (i % 11) * 23 + ((i * 7) % 5)) + '" cy="' + (228 + Math.floor(i / 11) * 26 + ((i * 3) % 4)) +
        '" r="1.7" fill="#b26a39" opacity=".78"/>';
    }
    s += '<line x1="118" y1="236" x2="146" y2="236" stroke="#a03d4f" stroke-width="1.3" marker-end="url(#co1-c-ar2)"/>';
    s += '<line x1="157" y1="248" x2="157" y2="120" stroke="#a03d4f" stroke-width="1.4" stroke-dasharray="3 3" marker-end="url(#co1-c-ar2)"/>';
    s += '<text x="166" y="286" font-size="8.5" fill="#3a352d">吸管口怎么接 = 完井方式</text>';
    s += '<text x="22" y="312" font-size="9" fill="#9ba3a9">没有吸管油出不来；接得不好，油出得慢还会出砂。</text>';
    /* 右：专业结构 · 完井把储层接到地面 */
    s += '<rect x="322" y="8" width="370" height="316" rx="7" fill="#fcfbf7" stroke="#f0ece1"/>';
    s += '<text x="336" y="27" font-size="9" fill="#9ba3a9" font-family="ui-monospace,monospace" letter-spacing=".8">专业结构 · 完井把储层接到地面</text>';
    s += '<rect x="336" y="36" width="342" height="24" fill="#f3efe3"/>';
    s += '<text x="344" y="52" font-size="8.5" fill="#9ba3a9">地面 · 生产设备（采油树）</text>';
    /* 储层（海绵状孔隙） */
    s += '<rect x="336" y="182" width="182" height="58" rx="4" fill="#e9dfc7" stroke="#d8c9a3"/>';
    s += '<text x="344" y="198" font-size="9" fill="#8a744a">储层 · 像海绵</text>';
    for (var po = 0; po < 14; po++) {
      s += '<circle cx="' + (348 + (po % 7) * 22 + ((po * 5) % 7)) + '" cy="' + (208 + Math.floor(po / 7) * 22 + ((po * 3) % 6)) + '" r="1.6" fill="#b26a39" opacity=".8"/>';
    }
    /* 水泥环 → 套管 → 井筒通道 */
    s += '<line x1="440" y1="156" x2="440" y2="248" stroke="#ddd6c6" stroke-width="19" stroke-linecap="round"/>';
    s += '<line x1="440" y1="60" x2="440" y2="250" stroke="#d4d0c8" stroke-width="12" stroke-linecap="round"/>';
    s += '<line x1="440" y1="60" x2="440" y2="250" stroke="#3a352d" stroke-width="3" stroke-linecap="round"/>';
    /* 射孔孔眼：穿过套管进入储层 */
    for (var hy = 198; hy <= 228; hy += 10) {
      s += '<line x1="424" y1="' + hy + '" x2="456" y2="' + hy + '" stroke="#b26a39" stroke-width="2" stroke-linecap="round"/>';
    }
    /* 油从储层进入孔眼，再沿井筒上返 */
    s += '<line x1="392" y1="232" x2="426" y2="232" stroke="#b26a39" stroke-width="1.5" marker-end="url(#co1-r-ar)"/>';
    s += '<text x="336" y="254" font-size="8" fill="#8a744a">油从孔眼进入井筒</text>';
    s += '<line x1="440" y1="244" x2="440" y2="70" stroke="#a03d4f" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#co1-c-ar2)"/>';
    /* 标注 */
    s += '<text x="462" y="86" font-size="9" fill="#4a545d">井筒 + 套管</text>';
    s += '<text x="462" y="112" font-size="9" fill="#3a352d">油沿井筒流向地面</text>';
    s += '<line x1="457" y1="163" x2="449" y2="170" stroke="#c9c3b4" stroke-width=".9"/>';
    s += '<text x="462" y="166" font-size="9" fill="#8f8f8a">水泥环：固定套管</text>';
    s += '<text x="462" y="214" font-size="9" fill="#8a744a">孔眼 / 筛管：流体入口</text>';
    /* 一句话结论 */
    s += '<rect x="336" y="266" width="342" height="46" rx="6" fill="#fff" stroke="#f3f0e7"/>';
    s += '<text x="348" y="284" font-size="9" fill="#3a352d">完井 = 把地下储层与地面生产设备连通起来。</text>';
    s += '<text x="348" y="301" font-size="9" fill="#4a545d">路径：储层 → 孔眼/筛管 → 井筒 → 地面；还要防砂与分层隔离。</text>';
    return s + '</svg>';
  }

  window.__IQ_WF__ = window.__IQ_WF__ || {};
  window.__IQ_WF__[KEY] = {
    model: {
      METHODS: METHODS, CRIT: CRIT, WEIGHTS: WEIGHTS, DEFAULTS: DEFAULTS,
      clamp: clamp, buildRows: buildRows, rankedRows: rankedRows,
      evaluate: evaluate, topsis: topsis, perturbList: perturbList
    },
    conceptSvg: conceptSvg,
    CONCEPTS: CONCEPTS
  };

  /* 站点插件模式下，把本包的 demo.css 注入主站（样式均带 .iq 前缀） */
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

    var state = {};
    for (var dk in DEFAULTS) state[dk] = DEFAULTS[dk];
    var selectedId = null;
    var aiPicked = false;

    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ---------------- 界面骨架 ---------------- */
    root.innerHTML =
      '<div class="iq-head">' +
        '<div>' +
          '<span class="iq-kicker">SCENE co1 · 完井</span>' +
          '<h3>完井方式智能优选：从“拍脑袋”到可复核的排序</h3>' +
        '</div>' +
        '<div class="iq-tags">' +
          '<span class="iq-tag jade">TOPSIS</span>' +
          '<span class="iq-tag">多指标评分</span>' +
          '<span class="iq-tag blue">候选漏斗</span>' +
          '<span class="iq-tag clay">规则约束</span>' +
        '</div>' +
      '</div>' +
      '<div class="iq-link">' +
        '<div class="lk"><span>① 输入参数</span><b id="co1-lk-param">—</b></div><i>›</i>' +
        '<div class="lk"><span>② 决策偏好</span><b id="co1-lk-pref">—</b></div><i>›</i>' +
        '<div class="lk"><span>③ TOPSIS 排序</span><b id="co1-lk-rank">—</b></div><i>›</i>' +
        '<div class="lk on"><span>④ 当前查看</span><b id="co1-lk-cur">—</b></div>' +
      '</div>' +
      '<div class="iq-grid">' +
        '<div class="iq-figure">' +
          '<div class="iq-card">' +
            '<div class="iq-card-h"><h4><i class="iq-dot"></i>完井方式选择</h4><span class="iq-mini" id="co1-figlabel">—</span></div>' +
            '<div id="co1-picks"></div>' +
          '</div>' +
          '<div class="iq-card">' +
            '<div class="iq-card-h"><h4>工程图例 · 井筒符号</h4><span class="iq-mini">co1</span></div>' +
            '<div class="iq-legend" style="flex-direction:column;align-items:flex-start;gap:6px">' +
              '<span><i style="background:#d4d0c8"></i>套管 / 水泥环</span>' +
              '<span><i style="background:#3a352d"></i>油管 / 完井管柱</span>' +
              '<span><i style="background:#b26a39"></i>射孔孔眼 / 工具</span>' +
              '<span><i style="background:#a9852f"></i>砾石 / 支撑剂</span>' +
              '<span><i style="background:#cfe3d9"></i>推荐生产段</span>' +
              '<span><i style="background:#e5b6ae"></i>不适用段（斜线）</span>' +
            '</div>' +
            '<div class="iq-note slim" id="co1-figure-note">点击方案卡片或得分柱形，井筒结构与工程维度评分同步切换。</div>' +
          '</div>' +
        '</div>' +
        '<div class="iq-main">' +
          '<div class="iq-card">' +
            '<div class="iq-card-h"><h4>井筒剖面 · 完井方式对比</h4><span class="iq-mini" id="co1-compare-mini">—</span></div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;align-items:start">' +
              '<div id="co1-figure"></div>' +
              '<div><div class="iq-card-h" style="padding:0 0 4px"><h4>工程维度评分</h4><span class="iq-mini" id="co1-detail-rank">—</span></div><div id="co1-detail"></div></div>' +
            '</div>' +
            '<div class="iq-note slim" id="co1-compare-note">—</div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>前 3 名方案 · 五维雷达</h4><span class="iq-mini">0—100 分</span></div><div id="co1-radar"></div><div class="iq-legend" id="co1-radar-legend"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>TOPSIS 综合得分</h4><span class="iq-mini">越接近 100 越优</span></div><div id="co1-bar"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>推荐理由分解</h4><span class="iq-mini">加权贡献</span></div><div id="co1-reasons"></div></div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>候选筛选漏斗 · 5 → 1</h4><span class="iq-mini">按本轮排序</span></div>' +
            '<div id="co1-funnel"></div>' +
            '<div class="iq-note slim" id="co1-funnel-note">漏斗只按“预算 / 可靠性底线 / 综合得分”逐步收窄，被淘汰的方案不是不能施工，只是本轮排序靠后。</div>' +
          '</div>' +
        '</div>' +
        '<div class="iq-side">' +
          '<div class="iq-card">' +
            '<div class="iq-card-h"><h4>输入参数</h4><span class="iq-mini">5 项</span></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>储层渗透率</span><output id="co1-o-perm">80 mD</output></div><input type="range" id="co1-perm" min="1" max="500" step="1" value="80"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>地层压力</span><output id="co1-o-pressure">32 MPa</output></div><input type="range" id="co1-pressure" min="10" max="60" step="1" value="32"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>出砂风险指数</span><output id="co1-o-sand">0.55</output></div><input type="range" id="co1-sand" min="0" max="1" step="0.01" value="0.55"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>完井预算</span><output id="co1-o-budget">900 万元</output></div><input type="range" id="co1-budget" min="200" max="2000" step="10" value="900"></div>' +
            '<div class="iq-ctl"><div class="iq-ctl-top"><span>目标日产</span><output id="co1-o-target">40 t/d</output></div><input type="range" id="co1-target" min="10" max="100" step="1" value="40"></div>' +
            '<div style="margin-top:10px"><div class="iq-ctl-top"><span>决策偏好</span></div><div class="iq-seg" id="co1-pref">' +
              '<button data-pref="balanced" class="on">均衡</button><button data-pref="sand">防砂优先</button><button data-pref="cost">投资优先</button><button data-pref="stim">增产优先</button>' +
            '</div></div>' +
            '<div class="iq-btns"><button class="iq-btn" id="co1-reset">重置参数</button><button class="iq-btn primary" id="co1-pick">选中 AI 方案</button></div>' +
            '<div class="iq-note slim" id="co1-pick-note">AI 方案是按当前参数与偏好算出的第 1 名；点击可把它设为当前选中方案。</div>' +
          '</div>' +
          '<div class="iq-card">' +
            '<div class="iq-card-h"><h4>AI 决策输出</h4><span class="iq-mini" id="co1-conf-mini">—</span></div>' +
            '<div class="iq-note slim" id="co1-side-cur">当前查看：—</div>' +
            '<div class="iq-kpis">' +
              '<div class="iq-kpi wide"><span>推荐完井方式</span><b class="hero" id="co1-k-best">—</b></div>' +
              '<div class="iq-kpi"><span>综合得分</span><b id="co1-k-score">—</b></div>' +
              '<div class="iq-kpi"><span>预测日产</span><b id="co1-k-q">—</b></div>' +
              '<div class="iq-kpi"><span>风险等级</span><b id="co1-k-risk">—</b></div>' +
              '<div class="iq-kpi"><span>推荐置信度</span><b id="co1-k-conf">—</b></div>' +
            '</div>' +
            '<div class="iq-meter"><i id="co1-conf-bar" style="width:0%"></i></div>' +
            '<div class="iq-meter-row"><span>置信度</span><span id="co1-conf-txt">—</span></div>' +
            '<div class="iq-note" id="co1-note">—</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="iq-bottom">' +
        '<div class="iq-card">' +
          '<div class="iq-card-h"><h4>经验方案 vs 当前查看</h4><span class="iq-mini" id="co1-table-mini">同一套参数下</span></div>' +
          '<div id="co1-table"></div>' +
        '</div>' +
        '<div class="iq-card">' +
          '<div class="iq-card-h"><h4>结果解释与决策流程</h4><span class="iq-mini">可复核</span></div>' +
          '<div class="iq-note blue" id="co1-explain">—</div>' +
          '<div class="iq-flow" style="margin-top:8px">' +
            '<span>数据采集</span><em>→</em><span>口径统一</span><em>→</em><span>指标计算</span><em>→</em><span>TOPSIS 排序</span><em>→</em><span>人工复核</span>' +
          '</div>' +
          '<div class="iq-poll">本示范使用合成数据，用于展示智能方法和可视化流程，不代表真实生产结果。</div>' +
        '</div>' +
      '</div>';

    /* 智能方法说明卡：插在头部下方，数值随参数实时重算 */
    var smartBox = document.createElement('div');
    smartBox.id = 'co1-smart';
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

    /* ---------------- 井筒剖面示意 ---------------- */
    function dimsOf(row, id) {
      var stim = { open: 38, perf: 72, screen: 62, gravel: 78, frac: 96 }[id] || 50;
      return [
        { k: '井壁稳定性', v: clamp(row.rel, 0, 100), low: false, note: '可靠性评分 ' + row.rel.toFixed(0) },
        { k: '出砂风险', v: clamp(100 - row.sand, 0, 100), low: true, note: '防砂能力 ' + row.sand + ' 分' },
        { k: '改造适应性', v: stim, low: false, note: stim >= 70 ? '可压裂 / 可酸化改造' : '改造空间有限' },
        { k: '施工复杂度', v: clamp(100 - row.easy, 0, 100), low: true, note: '施工便利 ' + row.easy + ' 分' },
        { k: '产能潜力', v: clamp(row.prod, 0, 100), low: false, note: '预测日产 ' + row.q.toFixed(1) + ' t/d' }
      ];
    }

    function dimColor(v, low) {
      var good = low ? v <= 30 : v >= 70;
      var mid = low ? v <= 55 : v >= 45;
      return good ? '#35785a' : (mid ? '#b26a39' : '#b05a51');
    }

    function completionSvg(id, row, res) {
      var g = [];
      var cx = 198, resT = 272, resB = 336, td = 356, ground = 44;
      var isBest = id === res.best.id;
      g.push('<svg viewBox="0 0 400 484" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(row.name) + '完井井筒剖面">');
      g.push('<rect width="400" height="484" fill="#fff"/>');
      g.push('<defs>' +
        '<marker id="co1-flow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#a03d4f"/></marker>' +
        '<marker id="co1-up" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#a03d4f"/></marker>' +
        '<pattern id="co1-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 L6 0" stroke="#b05a51" stroke-width="1.1" opacity=".5"/></pattern>' +
        '</defs>');
      /* 地层 */
      g.push('<rect x="16" y="44" width="368" height="228" fill="#efe9dc"/>');
      g.push('<rect x="16" y="272" width="368" height="64" fill="#e9dfc7"/>');
      g.push('<rect x="16" y="336" width="368" height="112" fill="#efe9dc"/>');
      g.push('<line x1="16" y1="272" x2="384" y2="272" stroke="#cbbd99" stroke-dasharray="4 3"/>');
      g.push('<line x1="16" y1="336" x2="384" y2="336" stroke="#cbbd99" stroke-dasharray="4 3"/>');
      g.push('<text x="24" y="62" font-size="8.5" fill="#9ba3a9">上部地层</text>');
      g.push('<text x="24" y="354" font-size="8.5" fill="#9ba3a9">下部地层</text>');
      g.push('<text x="24" y="290" font-size="9" fill="#8a744a">目的层 · 储层</text>');
      for (var po = 0; po < 26; po++) {
        g.push('<circle cx="' + (32 + (po % 13) * 27 + (po % 5)) + '" cy="' + (294 + Math.floor(po / 13) * 26 + (po % 3)) + '" r="1.5" fill="#b26a39" opacity=".5"/>');
      }
      /* 地面与深度标注 */
      g.push('<rect x="16" y="36" width="368" height="8" fill="#f3efe3" stroke="#e3ddcd"/>');
      g.push('<text x="24" y="30" font-size="8" fill="#9ba3a9">地面 · 井口</text>');
      g.push('<path d="M' + (cx - 10) + ',36 L' + (cx - 4) + ',16 L' + (cx + 4) + ',16 L' + (cx + 10) + ',36" fill="none" stroke="#9ba3a9" stroke-width="1.2"/>');
      g.push('<text x="388" y="48" text-anchor="end" font-size="8" fill="#9ba3a9" font-family="ui-monospace,monospace">0 m</text>');
      g.push('<text x="388" y="264" text-anchor="end" font-size="8" fill="#9ba3a9" font-family="ui-monospace,monospace">2850 m</text>');
      g.push('<text x="388" y="350" text-anchor="end" font-size="8" fill="#8a744a" font-family="ui-monospace,monospace">2860 m</text>');

      /* 生产段与不适用段 */
      g.push('<rect x="' + (cx - 34) + '" y="' + resT + '" width="68" height="' + (resB - resT) + '" fill="#cfe3d9" opacity=".6"/>');
      g.push('<text x="' + (cx + 40) + '" y="' + (resT + 14) + '" font-size="8.5" fill="#35785a">' + (isBest ? 'AI 推荐生产段' : '生产段（对比）') + '</text>');
      var bad = [];
      if (id === 'open' && state.sandRisk >= 0.45) bad.push('出砂风险偏高，裸眼段不宜长期裸露');
      if (row.rel < 50) bad.push('可靠性评分低于 50');
      if (row.cost > state.budget) bad.push('投资超出预算 ' + Math.round(row.cost - state.budget) + ' 万元');
      if (row.sand < state.sandRisk * 100 && (id === 'open' || id === 'perf')) bad.push('防砂能力低于需求 ' + Math.round(state.sandRisk * 100) + ' 分');
      if (bad.length) {
        g.push('<rect x="16" y="' + resT + '" width="' + (cx - 34 - 16) + '" height="64" fill="url(#co1-hatch)"/>');
        g.push('<rect x="' + (cx + 34) + '" y="' + resT + '" width="' + (384 - cx - 34) + '" height="64" fill="url(#co1-hatch)"/>');
        g.push('<text x="24" y="' + (resT + 12) + '" font-size="8" fill="#b05a51">不适用段</text>');
      }

      /* 井口、水泥环、套管、油管 */
      g.push('<rect x="' + (cx - 11) + '" y="30" width="22" height="8" rx="1.5" fill="#b26a39"/>');
      g.push('<rect x="' + (cx - 19) + '" y="' + ground + '" width="38" height="' + (resT - ground) + '" fill="#e6e1d3" stroke="#ddd6c6"/>');
      g.push('<rect x="' + (cx - 12) + '" y="' + ground + '" width="24" height="' + (resT - ground) + '" fill="#d4d0c8" stroke="#b7b3a8"/>');
      g.push('<rect x="' + (cx - 6) + '" y="' + ground + '" width="12" height="' + (resT - ground) + '" fill="#fbfaf6"/>');
      g.push('<line x1="' + (cx - 4) + '" y1="' + ground + '" x2="' + (cx - 4) + '" y2="' + (resT - 8) + '" stroke="#3a352d" stroke-width="1.6"/>');
      g.push('<line x1="' + (cx + 4) + '" y1="' + ground + '" x2="' + (cx + 4) + '" y2="' + (resT - 8) + '" stroke="#3a352d" stroke-width="1.6"/>');
      g.push('<text x="' + (cx - 26) + '" y="132" text-anchor="end" font-size="8" fill="#9ba3a9">套管 + 水泥环</text>');

      if (id === 'open') {
        g.push('<rect x="' + (cx - 10) + '" y="' + resT + '" width="20" height="' + (td - resT) + '" fill="#fbfaf6" stroke="#d8d2c4" stroke-dasharray="3 2"/>');
        g.push('<path d="M' + (cx - 10) + ',' + resT + ' l4,4 l-4,5 l4,5 l-4,5 l4,5 l-4,5 l4,5" fill="none" stroke="#cbbd99" stroke-width="1"/>');
        g.push('<path d="M' + (cx + 10) + ',' + resT + ' l-4,4 l4,5 l-4,5 l4,5 l-4,5 l4,5 l-4,5" fill="none" stroke="#cbbd99" stroke-width="1"/>');
        g.push('<text x="' + (cx + 22) + '" y="310" font-size="8" fill="#3a352d">裸眼段</text>');
        g.push('<text x="' + (cx + 22) + '" y="322" font-size="8" fill="#9ba3a9">无套管遮挡</text>');
      }

      if (id === 'perf') {
        g.push('<rect x="' + (cx - 19) + '" y="' + resT + '" width="38" height="' + (resB - resT) + '" fill="#e6e1d3"/>');
        g.push('<rect x="' + (cx - 12) + '" y="' + resT + '" width="24" height="' + (resB - resT) + '" fill="#d4d0c8" stroke="#b7b3a8"/>');
        g.push('<rect x="' + (cx - 6) + '" y="' + resT + '" width="12" height="' + (resB - resT) + '" fill="#fbfaf6"/>');
        for (var py = resT + 10; py <= resB - 6; py += 8) {
          g.push('<line x1="' + (cx - 12) + '" y1="' + py + '" x2="' + (cx - 21) + '" y2="' + py + '" stroke="#b26a39" stroke-width="1.4"/>');
          g.push('<line x1="' + (cx + 12) + '" y1="' + py + '" x2="' + (cx + 21) + '" y2="' + py + '" stroke="#b26a39" stroke-width="1.4"/>');
          g.push('<circle cx="' + (cx - 22) + '" cy="' + py + '" r="1.4" fill="#b26a39"/>');
          g.push('<circle cx="' + (cx + 22) + '" cy="' + py + '" r="1.4" fill="#b26a39"/>');
        }
        g.push('<text x="' + (cx + 26) + '" y="300" font-size="8" fill="#b26a39">射孔孔道</text>');
        g.push('<text x="' + (cx + 26) + '" y="312" font-size="8" fill="#9ba3a9">相位 60°</text>');
      }

      if (id === 'screen' || id === 'gravel' || id === 'frac') {
        g.push('<rect x="' + (cx - 17) + '" y="' + (resT - 4) + '" width="34" height="9" fill="#3a352d"/>');
        g.push('<text x="' + (cx + 22) + '" y="' + (resT + 2) + '" font-size="8" fill="#3a352d">封隔器</text>');
        g.push('<rect x="' + (cx - 8) + '" y="' + resT + '" width="16" height="' + (resB - resT + 8) + '" fill="#fbfaf6" stroke="#3a352d" stroke-width="1"/>');
        var ky;
        for (ky = resT + 4; ky <= resB + 4; ky += 5) {
          g.push('<line x1="' + (cx - 8) + '" y1="' + ky + '" x2="' + (cx + 8) + '" y2="' + ky + '" stroke="#3a352d" stroke-width=".8" opacity=".75"/>');
        }
        g.push('<text x="' + (cx + 22) + '" y="325" font-size="8" fill="#3a352d">筛管</text>');
      }
      if (id === 'gravel') {
        for (var gy = resT + 6; gy <= resB - 4; gy += 7) {
          g.push('<circle cx="' + (cx - 15) + '" cy="' + gy + '" r="1.3" fill="#a9852f"/>');
          g.push('<circle cx="' + (cx + 15) + '" cy="' + gy + '" r="1.3" fill="#a9852f"/>');
          g.push('<circle cx="' + (cx - 12) + '" cy="' + (gy + 3) + '" r="1.2" fill="#a9852f"/>');
          g.push('<circle cx="' + (cx + 12) + '" cy="' + (gy + 3) + '" r="1.2" fill="#a9852f"/>');
        }
        g.push('<text x="' + (cx + 22) + '" y="337" font-size="8" fill="#a9852f">砾石充填</text>');
      }
      if (id === 'frac') {
        g.push('<path d="M' + (cx - 8) + ',300 C' + (cx - 40) + ',292 ' + (cx - 70) + ',286 24,282 C36,296 60,306 ' + (cx - 8) + ',308 Z" fill="#3a352d" opacity=".2" stroke="#3a352d" stroke-width="1"/>');
        g.push('<path d="M' + (cx + 8) + ',300 C' + (cx + 40) + ',292 ' + (cx + 70) + ',286 376,282 C364,296 340,306 ' + (cx + 8) + ',308 Z" fill="#3a352d" opacity=".2" stroke="#3a352d" stroke-width="1"/>');
        var fs;
        for (fs = 1; fs <= 4; fs++) {
          g.push('<circle cx="' + (cx - 8 - fs * 15) + '" cy="' + (296 + (fs % 2) * 8) + '" r="1.3" fill="#a9852f"/>');
          g.push('<circle cx="' + (cx + 8 + fs * 15) + '" cy="' + (296 + (fs % 2) * 8) + '" r="1.3" fill="#a9852f"/>');
        }
        g.push('<text x="' + (cx + 22) + '" y="286" font-size="8" fill="#a9852f">压裂缝</text>');
      }

      /* 流体流入与上升 */
      var ay = 314;
      g.push('<line x1="' + (cx - 52) + '" y1="' + ay + '" x2="' + (cx - 22) + '" y2="' + ay + '" stroke="#a03d4f" stroke-width="1.4" marker-end="url(#co1-flow)"/>');
      g.push('<line x1="' + (cx + 52) + '" y1="' + ay + '" x2="' + (cx + 22) + '" y2="' + ay + '" stroke="#a03d4f" stroke-width="1.4" marker-end="url(#co1-flow)"/>');
      g.push('<line x1="' + (cx + 28) + '" y1="245" x2="' + (cx + 28) + '" y2="' + (ground + 30) + '" stroke="#a03d4f" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#co1-up)"/>');
      g.push('<text x="' + (cx + 34) + '" y="150" font-size="8" fill="#a03d4f">油气流向地面</text>');
      g.push('<text x="200" y="466" text-anchor="middle" font-size="9" fill="#4a545d">' +
        ({ open: '裸眼完井：储层直接裸露，无套管遮挡', perf: '套管射孔完井：套管 + 射孔孔道建立通道', screen: '筛管完井：筛管挡砂，封隔器分段', gravel: '砾石充填完井：筛管外充填砾石层挡砂', frac: '压裂充填完井：裂缝 + 充填改造储层' }[id] || '') + '</text>');
      g.push('<text x="200" y="478" text-anchor="middle" font-size="8" fill="#9ba3a9">井深 2850—2860 m · 合成数据示意</text>');
      return g.join('') + '</svg>';
    }

    /* ---------------- 学习层：漏斗与三态卡 ---------------- */
    function renderFunnel(res) {
      var box = $('co1-funnel');
      box.innerHTML = '';
      var rows = res.ranked.slice();
      var budgetOk = rows.filter(function (r) { return r.cost <= state.budget; });
      var relOk = budgetOk.filter(function (r) { return r.rel >= 50; });
      var top3 = (relOk.length ? relOk : rows).slice(0, 3);
      var stages = [
        { t: '候选方案', v: rows.length, sub: rows.length + ' 套完井方式', set: rows },
        { t: '预算内', v: budgetOk.length, sub: '投资 ≤ ' + state.budget + ' 万元', set: budgetOk },
        { t: '可靠性达标', v: relOk.length, sub: '可靠性 ≥ 50 分', set: relOk },
        { t: '得分前 3', v: top3.length, sub: '进入人工复核', set: top3 },
        { t: '推荐 1 个', v: 1, sub: rows[0].name, set: [rows[0]] }
      ];
      var W = 640, H = 250, cx = 336, maxW = 316, minW = 48, stageH = 38, gap = 8, top = 14;
      var maxV = stages[0].v || 1;
      function wv(v) { return minW + (maxW - minW) * Math.min(1, v / maxV); }
      var COL = ['#cfe3d9', '#a9cdbf', '#79ad9a', '#4f8c77', '#3a352d'];
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '候选方案筛选漏斗：5 套方案逐步收窄到 1 套推荐');
      stages.forEach(function (st, i) {
        var y = top + i * (stageH + gap);
        var w1 = wv(st.v);
        var w2 = i < stages.length - 1 ? wv(stages[i + 1].v) : w1 * 0.86;
        var path = 'M' + (cx - w1 / 2) + ' ' + y + ' L' + (cx + w1 / 2) + ' ' + y +
          ' L' + (cx + w2 / 2) + ' ' + (y + stageH) + ' L' + (cx - w2 / 2) + ' ' + (y + stageH) + ' Z';
        var g = svg.append('g').style('cursor', 'pointer');
        g.append('path').attr('d', path).attr('fill', COL[i]).attr('fill-opacity', .96)
          .attr('stroke', i === stages.length - 1 ? '#241f19' : '#ffffff')
          .attr('stroke-width', 1)
          .on('mouseenter', function (ev) {
            tipShow(st.t + '：<b>' + st.v + '</b> 个<br>' + st.set.map(function (r) { return r.short; }).join(' · '), ev);
          })
          .on('mousemove', function (ev) {
            tipShow(st.t + '：<b>' + st.v + '</b> 个<br>' + st.set.map(function (r) { return r.short; }).join(' · '), ev);
          })
          .on('mouseleave', tipHide);
        g.append('text').attr('x', cx).attr('y', y + stageH / 2 + 5)
          .attr('text-anchor', 'middle').attr('font-family', 'ui-monospace,monospace')
          .attr('font-size', 15).attr('font-weight', 700)
          .attr('fill', i >= 2 ? '#ffffff' : '#2a322b').text(st.v);
        g.append('text').attr('x', 8).attr('y', y + 16)
          .attr('font-size', 10.5).attr('font-weight', 600).attr('fill', '#242a32').text(st.t);
        g.append('text').attr('x', 8).attr('y', y + 29)
          .attr('font-size', 8).attr('fill', '#9ba3a9').text(st.sub);
      });
      $('co1-funnel-note').innerHTML = '当前参数下：预算内 <b>' + budgetOk.length + '</b> 个、可靠性达标 <b>' + relOk.length +
        '</b> 个、进入复核 <b>' + top3.length + '</b> 个。淘汰不是“不能做”，而是本轮排序靠后。';
    }

    /* ---------------- 雷达图 ---------------- */
    function renderRadar(res) {
      var box = $('co1-radar');
      box.innerHTML = '';
      var W = 640, H = 246, cx = 320, cy = 118, R = 84;
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '前 3 名方案五维雷达图');
      var ang = function (i) { return -Math.PI / 2 + i * 2 * Math.PI / CRIT.length; };
      var rScale = d3.scaleLinear().domain([0, 100]).range([0, R]);
      var pt = function (i, v) {
        var a = ang(i), r = rScale(v);
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      };
      var j, i;
      for (j = 1; j <= 5; j++) {
        var pts = [];
        for (i = 0; i < CRIT.length; i++) pts.push(pt(i, j * 20).join(','));
        svg.append('polygon').attr('points', pts.join(' '))
          .attr('fill', j === 5 ? '#f7f5ee' : 'none').attr('stroke', '#e6e1d3').attr('stroke-width', 1);
      }
      for (i = 0; i < CRIT.length; i++) {
        var p = pt(i, 100);
        svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', p[0]).attr('y2', p[1])
          .attr('stroke', '#e0dbcd').attr('stroke-width', 1);
        var lp = pt(i, 118);
        var anchor = Math.abs(lp[0] - cx) < 4 ? 'middle' : (lp[0] > cx ? 'start' : 'end');
        svg.append('text').attr('x', lp[0]).attr('y', lp[1] + 3).attr('text-anchor', anchor)
          .attr('font-size', 10.5).attr('fill', '#79828a').text(CRIT[i].name);
      }
      var colors = ['#3a352d', '#b26a39', '#a03d4f'];
      res.ranked.slice(0, 3).forEach(function (r, idx) {
        var pts2 = r.vals.map(function (v, i2) { return pt(i2, v).join(','); });
        svg.append('polygon').attr('points', pts2.join(' '))
          .attr('fill', colors[idx]).attr('fill-opacity', idx === 0 ? 0.13 : 0.06)
          .attr('stroke', colors[idx]).attr('stroke-width', idx === 0 ? 2 : 1.2)
          .attr('stroke-opacity', idx === 0 ? 1 : 0.7);
        r.vals.forEach(function (v, i2) {
          var q = pt(i2, v);
          svg.append('circle').attr('cx', q[0]).attr('cy', q[1]).attr('r', idx === 0 ? 2.8 : 2)
            .attr('fill', '#fff').attr('stroke', colors[idx]).attr('stroke-width', 1.2)
            .style('cursor', 'pointer')
            .on('mouseenter', function (ev) {
              tipShow(r.name + ' · ' + CRIT[i2].name + ' <b>' + v.toFixed(0) + '</b> 分', ev);
            })
            .on('mousemove', function (ev) { tipShow(r.name + ' · ' + CRIT[i2].name + ' <b>' + v.toFixed(0) + '</b> 分', ev); })
            .on('mouseleave', tipHide);
        });
      });
      /* 图例在 HTML 中渲染，避免 SVG 内文字过多 */
      var lg = $('co1-radar-legend');
      lg.innerHTML = res.ranked.slice(0, 3).map(function (r, idx) {
        return '<span><i class="line" style="background:' + colors[idx] + '"></i>' + r.name + ' · ' + r.score.toFixed(1) + ' 分</span>';
      }).join('');
    }

    /* ---------------- 得分柱状图（排序变化会平移，扫权重时可看翻转） ---------------- */
    var barSvg = null, barX = null, barY = null, barAxisX = null, barNote = null;

    function renderBar(res, opt) {
      opt = opt || {};
      var data = res.ranked.slice();
      var W = 640, H = 224, M = { t: 22, r: 14, b: 46, l: 42 };
      if (!barSvg) {
        var box = $('co1-bar');
        box.innerHTML = '';
        barSvg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
          .attr('role', 'img').attr('aria-label', 'TOPSIS 综合得分柱状图');
        barY = d3.scaleLinear().domain([0, 100]).range([H - M.b, M.t]);
        barSvg.append('g').attr('class', 'axis-y').attr('transform', 'translate(' + M.l + ',0)')
          .call(d3.axisLeft(barY).ticks(5).tickSize(-(W - M.l - M.r)))
          .call(function (g) {
            g.select('.domain').remove();
            g.selectAll('.tick line').attr('stroke', '#f1eee6');
            g.selectAll('.tick text').attr('font-size', 9).attr('fill', '#9ba3a9');
          });
        barAxisX = barSvg.append('g').attr('class', 'axis-x').attr('transform', 'translate(0,' + (H - M.b) + ')');
        barSvg.append('g').attr('class', 'bars');
        barSvg.append('g').attr('class', 'vals');
        barNote = barSvg.append('text').attr('x', M.l).attr('y', 12)
          .attr('font-size', 9.5).attr('fill', '#9ba3a9');
        barNote.text('■ 绿色 = AI 推荐　■ 陶土 = 经验方案（射孔）　点击柱形查看结构');
      }
      barX = d3.scaleBand().domain(data.map(function (r) { return r.name; }))
        .range([M.l, W - M.r]).padding(0.34);
      barAxisX.call(d3.axisBottom(barX).tickSize(0))
        .call(function (g) { g.select('.domain').attr('stroke', '#d8d2c4'); })
        .selectAll('text').attr('font-size', 10.5).attr('fill', '#4a545d').attr('dy', '1.1em');
      var dur = opt.fast ? 220 : 460;
      var bestId = res.best.id;

      barSvg.select('.bars').selectAll('rect.bar').data(data, function (r) { return r.id; })
        .join(
          function (enter) {
            return enter.append('rect').attr('class', 'bar')
              .attr('x', function (r) { return barX(r.name) + barX.bandwidth() / 2; })
              .attr('width', 0)
              .attr('y', function (r) { return barY(r.score); })
              .attr('height', function (r) { return H - M.b - barY(r.score); });
          },
          function (update) { return update; },
          function (exit) { return exit.transition().duration(160).attr('width', 0).remove(); }
        )
        .attr('rx', 3)
        .attr('fill', function (r) {
          if (r.id === bestId) return '#3a352d';
          if (r.id === 'perf') return '#c58b62';
          return '#ddd7c8';
        })
        .attr('stroke', function (r) { return r.id === selectedId ? '#242a32' : 'none'; })
        .attr('stroke-width', 1.4)
        .style('cursor', 'pointer')
        .on('click', function (ev, r) { selectedId = r.id; aiPicked = false; renderAll(); })
        .on('mouseenter', function (ev, r) { barTip(r, ev); })
        .on('mousemove', function (ev, r) { barTip(r, ev); })
        .on('mouseleave', tipHide)
        .transition().duration(dur).ease(d3.easeCubicOut)
        .attr('x', function (r) { return barX(r.name); })
        .attr('width', barX.bandwidth())
        .attr('y', function (r) { return barY(r.score); })
        .attr('height', function (r) { return H - M.b - barY(r.score); });

      barSvg.select('.vals').selectAll('text').data(data, function (r) { return r.id; })
        .join('text')
        .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#4a545d')
        .attr('font-family', 'ui-monospace,monospace')
        .text(function (r) { return r.score.toFixed(1); })
        .transition().duration(dur).ease(d3.easeCubicOut)
        .attr('x', function (r) { return barX(r.name) + barX.bandwidth() / 2; })
        .attr('y', function (r) { return barY(r.score) - 6; });

      barSvg.select('.bars').selectAll('rect.bar').selectAll('title')
        .data(data, function (r) { return r.id; });

      if (opt.label) {
        barNote.text(opt.label).attr('fill', '#b26a39');
      } else {
        barNote.text('■ 绿色 = AI 推荐　■ 陶土 = 经验方案（射孔）　点击柱形查看结构').attr('fill', '#9ba3a9');
      }
      function barTip(r, ev) {
        tipShow(r.name + '<br>综合得分 <b>' + r.score.toFixed(1) + '</b><br>预测日产 <b>' + r.q.toFixed(1) + '</b> t/d · 投资 <b>' + r.cost + '</b> 万元', ev);
      }
    }

    /* ---------------- 推荐理由 ---------------- */
    function renderReasons(res) {
      var box = $('co1-reasons');
      box.innerHTML = '';
      var best = res.best;
      var contrib = best.vals.map(function (v, i) {
        return { name: CRIT[i].name, w: res.weights[i], metric: v, v: v / 100 * res.weights[i] };
      });
      var total = contrib.reduce(function (a, b) { return a + b.v; }, 0) || 1;
      contrib.forEach(function (c) { c.pct = c.v / total * 100; });
      contrib.sort(function (a, b) { return b.pct - a.pct; });

      var W = 640, H = 176, M = { t: 12, r: 56, b: 8, l: 78 };
      var svg = d3.select(box).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H)
        .attr('role', 'img').attr('aria-label', '推荐理由加权贡献');
      var x = d3.scaleLinear().domain([0, d3.max(contrib, function (c) { return c.pct; }) * 1.15]).range([M.l, W - M.r]);
      var y = d3.scaleBand().domain(contrib.map(function (c) { return c.name; }))
        .range([M.t, H - M.b]).padding(0.32);
      svg.append('g').attr('transform', 'translate(' + M.l + ',0)')
        .call(d3.axisLeft(y).tickSize(0))
        .call(function (g) {
          g.select('.domain').remove();
          g.selectAll('text').attr('font-size', 10).attr('fill', '#4a545d');
        });
      svg.selectAll('.rb').data(contrib).enter().append('rect')
        .attr('x', M.l).attr('y', function (c) { return y(c.name); })
        .attr('width', function (c) { return Math.max(2, x(c.pct) - M.l); })
        .attr('height', y.bandwidth()).attr('rx', 2)
        .attr('fill', function (c, i) { return i === 0 ? '#3a352d' : '#b9cbbc'; })
        .style('cursor', 'pointer')
        .on('mouseenter', function (ev, c) {
          tipShow(c.name + '：贡献 <b>' + c.pct.toFixed(1) + '%</b><br>指标 ' + c.metric.toFixed(0) + ' 分 × 权重 ' + (c.w * 100).toFixed(0) + '%', ev);
        })
        .on('mousemove', function (ev, c) {
          tipShow(c.name + '：贡献 <b>' + c.pct.toFixed(1) + '%</b><br>指标 ' + c.metric.toFixed(0) + ' 分 × 权重 ' + (c.w * 100).toFixed(0) + '%', ev);
        })
        .on('mouseleave', tipHide);
      svg.selectAll('.rl').data(contrib).enter().append('text')
        .attr('x', function (c) { return x(c.pct) + 5; })
        .attr('y', function (c) { return y(c.name) + y.bandwidth() / 2 + 3.5; })
        .attr('font-size', 10).attr('fill', '#4a545d').attr('font-family', 'ui-monospace,monospace')
        .text(function (c) { return c.pct.toFixed(1) + '%'; });
    }

    /* ---------------- 输出与解释 ---------------- */
    function renderKpis(res) {
      var best = res.best;
      $('co1-k-best').textContent = best.name;
      $('co1-k-score').textContent = best.score.toFixed(1);
      $('co1-k-q').innerHTML = best.q.toFixed(1) + '<small>t/d</small>';
      var riskEl = $('co1-k-risk');
      riskEl.textContent = res.risk;
      riskEl.className = res.risk === '低' ? 'ok' : (res.risk === '中' ? 'warn' : 'bad');
      $('co1-k-conf').innerHTML = res.conf + '<small>%</small>';
      $('co1-conf-bar').style.width = res.conf + '%';
      $('co1-conf-bar').className = res.conf >= 75 ? '' : (res.conf >= 55 ? 'warn' : 'bad');
      $('co1-conf-txt').textContent = '排序稳定性 ' + res.stable + '/10 · 与第 2 名差 ' + res.gap.toFixed(1) + ' 分';
      $('co1-conf-mini').textContent = WEIGHTS[state.pref].name + '权重';

      var nm = $('co1-note');
      if (best.rel < 50) {
        nm.className = 'iq-note red';
        nm.innerHTML = '<b>风险提示：</b>推荐方案在当前出砂风险下的可靠性仅 ' + best.rel.toFixed(0) + ' 分，建议提高防砂等级或复核出砂预测。';
      } else if (best.cost > state.budget) {
        nm.className = 'iq-note clay';
        nm.innerHTML = '<b>预算提示：</b>' + best.name + '投资约 ' + best.cost + ' 万元，超出预算 ' + Math.round(best.cost - state.budget) + ' 万元；模型仍按指标排序给出，需人工决策。';
      } else {
        nm.className = 'iq-note';
        nm.innerHTML = '<b>结论：</b>按“' + WEIGHTS[state.pref].name + '”权重，' + best.name + '贴近度最高（' + best.score.toFixed(1) + '），领先第 2 名 ' + res.gap.toFixed(1) + ' 分。';
      }
    }

    function renderLink(res) {
      var id = selectedId || res.best.id;
      var cur = res.rows.filter(function (r) { return r.id === id; })[0];
      var pname = WEIGHTS[state.pref].name;
      if ($('co1-lk-param')) $('co1-lk-param').textContent = '渗透 ' + state.perm + 'mD · 出砂 ' + state.sandRisk.toFixed(2) + ' · 预算 ' + state.budget + '万';
      if ($('co1-lk-pref')) $('co1-lk-pref').textContent = pname;
      if ($('co1-lk-rank')) $('co1-lk-rank').textContent = res.ranked.map(function (r) { return r.short; }).join(' > ');
      if ($('co1-lk-cur')) $('co1-lk-cur').textContent = cur.name + ' · 第 ' + cur.rank + ' 名 · ' + cur.score.toFixed(1);
      var sc = $('co1-side-cur');
      if (sc) {
        var isBest = cur.id === res.best.id;
        sc.innerHTML = '当前查看：<b>' + esc(cur.name) + '</b> · 第 ' + cur.rank + ' 名 · ' + cur.score.toFixed(1) + ' 分' +
          (isBest ? '（即 AI 推荐）' : '（AI 推荐 ' + esc(res.best.name) + '）');
      }
      var tm = $('co1-table-mini');
      if (tm) tm.textContent = pname + '口径 · 当前参数';
    }

    function renderPickState(res) {
      var btn = $('co1-pick'), note = $('co1-pick-note');
      if (btn) btn.textContent = aiPicked ? '已采用 AI 方案 ✓' : '选中 AI 方案';
      if (!note) return;
      if (aiPicked) {
        note.className = 'iq-note blue slim';
        note.innerHTML = '已采用 AI 推荐：<b>' + esc(res.best.name) + '</b>（' + res.best.score.toFixed(1) +
          ' 分 · 第 1 名）。左侧井筒剖面与工程维度评分已切换到该方案。';
      } else {
        note.className = 'iq-note slim';
        note.innerHTML = 'AI 方案 = 按当前参数与“' + WEIGHTS[state.pref].name + '”口径算出的第 1 名；点击可把它设为选中方案。';
      }
    }

    function renderPicks(res) {
      var box = $('co1-picks');
      if (!box) return;
      box.innerHTML = res.ranked.map(function (r, i) {
        var cls = r.id === res.best.id ? 'reco' : (i < 3 ? 'alt' : 'no');
        return '<div class="iq-tcard ' + cls + (r.id === selectedId ? ' on' : '') + '" data-id="' + r.id + '" style="padding:7px 9px;margin-bottom:6px">' +
          '<div class="cap">' + (i === 0 ? '推荐' : (i < 3 ? '备选' : '参考')) + ' · 第 ' + (i + 1) + '</div>' +
          '<div class="nm" style="font-size:12.5px">' + esc(r.name) + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
            '<span class="val" style="font-size:12px">' + r.score.toFixed(1) + '<small>分</small></span>' +
            '<span style="font-size:10px;color:#9ba3a9">日产 ' + r.q.toFixed(1) + '</span></div></div>';
      }).join('') + '<p class="iq-poll">点击任一方案查看井筒结构与工程维度评分。</p>';
    }

    function renderFigure(res) {
      var id = selectedId || res.best.id;
      var row = res.rows.filter(function (r) { return r.id === id; })[0];
      var isBest = id === res.best.id;
      $('co1-figure').innerHTML = completionSvg(id, row, res);
      $('co1-figlabel').textContent = '第 ' + row.rank + ' 名 · ' + WEIGHTS[state.pref].name;
      $('co1-compare-mini').textContent = row.name + ' · ' + (isBest ? 'AI 推荐' : '对比方案');
      $('co1-detail-rank').textContent = '第 ' + row.rank + ' 名';
      var dims = dimsOf(row, id);
      $('co1-detail').innerHTML = dims.map(function (d) {
        return '<div style="margin-bottom:7px">' +
          '<div style="display:flex;justify-content:space-between;font-size:11px;color:#4a545d">' +
            '<span>' + d.k + '</span><b style="font-family:ui-monospace,monospace;font-weight:600">' + d.v.toFixed(0) + '</b></div>' +
          '<div style="height:6px;background:#f1eee6;border-radius:3px;margin-top:3px">' +
            '<i style="display:block;height:6px;width:' + d.v.toFixed(0) + '%;background:' + dimColor(d.v, d.low) + ';border-radius:3px"></i></div>' +
          '<div style="font-size:9.5px;color:#9ba3a9;margin-top:2px">' + d.note + '</div></div>';
      }).join('') +
      '<div class="iq-kpis" style="grid-template-columns:1fr 1fr 1fr;margin-top:8px">' +
        '<div class="iq-kpi"><span>综合得分</span><b>' + row.score.toFixed(1) + '</b></div>' +
        '<div class="iq-kpi"><span>预测日产</span><b>' + row.q.toFixed(1) + '<small>t/d</small></b></div>' +
        '<div class="iq-kpi"><span>投资</span><b>' + row.cost + '<small>万</small></b></div>' +
      '</div>' +
      '<p class="iq-poll">风险类指标（出砂风险、施工复杂度）越低越好，绿色 = 安全区间。</p>';

      var reasons = CRIT.map(function (c, i) { return { n: c.name, v: row.vals[i] / 100 * res.weights[i] }; })
        .sort(function (a, b) { return b.v - a.v; }).slice(0, 2).map(function (x) { return x.n; }).join('、');
      var msgs = [];
      if (id === 'open' && state.sandRisk >= 0.45) msgs.push('出砂风险指数 ' + state.sandRisk.toFixed(2) + ' 偏高，裸眼段不宜长期裸露');
      if (row.rel < 50) msgs.push('可靠性评分 ' + row.rel.toFixed(0) + ' 低于 50');
      if (row.cost > state.budget) msgs.push('投资 ' + row.cost + ' 万元超出预算 ' + state.budget + ' 万元');
      if (row.sand < state.sandRisk * 100 && (id === 'open' || id === 'perf')) msgs.push('防砂能力 ' + row.sand + ' 分低于需求 ' + Math.round(state.sandRisk * 100) + ' 分');
      var note = $('co1-compare-note');
      if (isBest) {
        note.className = 'iq-note slim';
        note.innerHTML = '<b>为什么推荐 ' + row.name + '：</b>它在「' + reasons + '」上的加权贡献最大，综合得分 ' +
          row.score.toFixed(1) + '，领先第 2 名 ' + res.gap.toFixed(1) + ' 分；10 组权重扰动中 ' + res.stable +
          ' 组仍排第一，置信度 ' + res.conf + '%。井筒图中绿色区间为推荐生产段。' +
          (msgs.length ? '<br><b>现场约束：</b>' + msgs.join('；') + '。' : '');
      } else {
        note.className = 'iq-note slim' + (msgs.length ? ' clay' : '');
        note.innerHTML = '<b>当前查看 ' + row.name + '（第 ' + row.rank + ' 名 · ' + row.score.toFixed(1) + ' 分）：</b>' +
          (msgs.length ? '图中红色斜线为不适用段——' + msgs.join('；') + '。' : '当前参数与权重下满足约束，可作为备选方案。') +
          '<br>AI 推荐 <b>' + res.best.name + '</b>（' + res.best.score.toFixed(1) + ' 分），点击方案卡片可对比井筒结构。';
      }
    }

    function renderTable(res) {
      var b = res.baseline;
      var id = selectedId || res.best.id;
      var cur = res.rows.filter(function (r) { return r.id === id; })[0];
      var isBest = cur.id === res.best.id;
      var risk = cur.rel >= 70 ? '低' : (cur.rel >= 50 ? '中' : '高');
      var dScore = cur.score - b.score, dQ = cur.q - b.q, dCost = cur.cost - b.cost;
      function sgn(v, dg, unit) {
        var s = (v > 0 ? '+' : '') + v.toFixed(dg);
        return '<span class="' + (v > 0 ? 'ok' : (v < 0 ? 'bad' : '')) + '">' + s + (unit || '') + '</span>';
      }
      $('co1-table').innerHTML =
        '<table class="iq-table">' +
        '<tr><th>指标</th><th>经验方案 · 射孔</th><th>' + (isBest ? 'AI 推荐 · ' : '当前查看 · ') + cur.short + '</th><th>变化</th></tr>' +
        '<tr><td>综合得分</td><td class="num">' + b.score.toFixed(1) + '</td><td class="num">' + cur.score.toFixed(1) + '</td><td class="num">' + sgn(dScore, 1) + '</td></tr>' +
        '<tr><td>预测日产</td><td class="num">' + b.q.toFixed(1) + ' t/d</td><td class="num">' + cur.q.toFixed(1) + ' t/d</td><td class="num">' + sgn(dQ, 1, ' t/d') + '</td></tr>' +
        '<tr><td>防砂能力</td><td class="num">' + b.sand + '</td><td class="num">' + cur.sand + '</td><td class="num">' + sgn(cur.sand - b.sand, 0) + '</td></tr>' +
        '<tr><td>投资</td><td class="num">' + b.cost + ' 万元</td><td class="num">' + cur.cost + ' 万元</td><td class="num">' + sgn(dCost, 0, ' 万元') + '</td></tr>' +
        '<tr class="hl"><td>风险等级</td><td class="num">' + (b.rel >= 70 ? '低' : b.rel >= 50 ? '中' : '高') + '</td><td class="num">' + risk + '</td><td class="num">' + (risk === '低' ? '改善' : (cur.rel >= b.rel ? '改善' : '需复核')) + '</td></tr>' +
        '</table>' +
        '<p class="iq-poll">当前查看 <b>' + esc(cur.name) + '</b>（第 ' + cur.rank + ' 名 · ' + cur.score.toFixed(1) + ' 分）' +
        (isBest ? '，与 AI 推荐一致' : '；AI 推荐 <b>' + esc(res.best.name) + '</b>（' + res.best.score.toFixed(1) + ' 分）') +
        '。左侧切换方案、右侧调整参数时，本表同步更新。</p>';

      var ex = $('co1-explain');
      var a = res.best;
      var top2 = res.ranked.slice(0, 2).map(function (r) { return r.name + ' ' + r.score.toFixed(1); }).join(' / ');
      var reasons = CRIT.map(function (c, i) { return { n: c.name, v: a.vals[i] / 100 * res.weights[i] }; })
        .sort(function (x, y) { return y.v - x.v; }).slice(0, 2).map(function (x) { return x.n; }).join('、');
      ex.innerHTML = '<b>为什么推荐 ' + a.name + '：</b>它在“' + reasons + '”上贡献最大；与第二名（' + res.ranked[1].name + '）相差 ' + res.gap.toFixed(1) + ' 分。' +
        '权重扰动 10 组中有 ' + res.stable + ' 组仍选择它，因此置信度给到 ' + res.conf + '%。' +
        (res.gap < 2 ? '<br><b>注意：</b>前两名分差很小，结论对权重敏感，建议结合邻井产量与作业能力复核。' : '') +
        '<br>排序：' + res.ranked.map(function (r) { return r.short; }).join(' > ') + '。' +
        '<br>当前查看的是 ' + esc(cur.name) + '（第 ' + cur.rank + ' 名），与经验方案的差异见下方对比表。';
    }

    function readState() {
      state.perm = Number($('co1-perm').value);
      state.pressure = Number($('co1-pressure').value);
      state.sandRisk = Number($('co1-sand').value);
      state.budget = Number($('co1-budget').value);
      state.target = Number($('co1-target').value);
      $('co1-o-perm').textContent = state.perm + ' mD';
      $('co1-o-pressure').textContent = state.pressure + ' MPa';
      $('co1-o-sand').textContent = state.sandRisk.toFixed(2);
      $('co1-o-budget').textContent = state.budget + ' 万元';
      $('co1-o-target').textContent = state.target + ' t/d';
    }

    /* 智能方法说明：全部数值取自本轮 evaluate()，不写死 */
    function renderSmart(res) {
      if (!window.IQSmart || !smartBox) return;
      var best = res.best, base = res.baseline;
      function riskOf(rel) { return rel >= 70 ? '低' : (rel >= 50 ? '中' : '高'); }
      function dlt(a, b, unit) {
        var d = b - a;
        return { v: (d >= 0 ? '+' : '') + d.toFixed(1) + (unit || ''), cls: d >= 0 ? 'ok' : 'bad' };
      }
      var rows = [
        { cells: ['完井方式', base.name, best.name, '—', '同一套储层参数'] },
        { cells: ['预测日产 (t/d)', base.q.toFixed(1), best.q.toFixed(1), dlt(base.q, best.q), '—'] },
        { cells: ['防砂能力 (0—100)', base.sand.toFixed(0), best.sand.toFixed(0), dlt(base.sand, best.sand), base.sand < res.req ? '经验方案偏弱' : '达标'] },
        { cells: ['投资 (万元)', String(base.cost), String(best.cost), dlt(base.cost, best.cost), { v: best.cost <= state.budget ? '预算内' : '超预算', cls: best.cost <= state.budget ? 'ok' : 'bad' }] },
        { cells: ['风险等级', riskOf(base.rel), riskOf(best.rel), '—', { v: '可靠性 ' + best.rel.toFixed(0) + ' / 100', cls: best.rel >= 55 ? 'ok' : 'bad' }] },
        { cells: ['TOPSIS 综合得分', base.score.toFixed(1), best.score.toFixed(1), dlt(base.score, best.score, ' 分'), '领先第 2 名 ' + res.gap.toFixed(1) + ' 分'], hl: true }
      ];
      smartBox.innerHTML = window.IQSmart.render({
        kicker: 'SMART METHOD · TOPSIS',
        title: 'TOPSIS 多目标决策 + 权重敏感性',
        subtitle: '五种完井方式 × 五项指标，先归一化再按工程权重求贴近度',
        badge: '权重 ' + WEIGHTS[state.pref].name,
        /* 主视觉：决策矩阵热图，格子来自本轮 evaluate() 的指标值 */
        algoSvg: window.IQAlgo ? window.IQAlgo.matrix({
          rows: res.rows.map(function (r) {
            return { name: r.short, vals: r.vals, score: r.score, best: r.id === best.id };
          }),
          crit: CRIT.map(function (c) { return c.short; }),
          weights: res.weights
        }) : '',
        algoCap: '<span><i style="background:rgba(178,106,57,.55)"></i>格子 = 归一化后的指标水平（数字为原始分）</span>' +
          '<span><i style="background:#3a352d"></i>右条 = TOPSIS 贴近度</span>' +
          '<span>深色行 <b>' + best.short + '</b> = 本轮第一</span>',
        input: '产能、防砂、经济性、可靠性、施工便利性 5 项指标；储层与预算参数',
        output: '五种方案的排序、推荐方案、置信度与权重敏感性',
        problem: '产能、防砂、投资相互冲突，只看单项指标会选出不适合本井的方案',
        fit: '不同量纲先归一化，再按工程权重计算贴近度；权重扰动可检验排序是否稳定',
        flow: ['储层 / 商务参数', '指标归一化', 'TOPSIS 贴近度', '预算与可靠性约束', '方案排序', '工程师复核'],
        trace: [
          ['方案 × 指标', res.rows.length + ' × ' + CRIT.length],
          ['权重扰动', '10 组'],
          ['排序未翻转', res.stable + ' / 10'],
          ['领先第 2 名', res.gap.toFixed(1) + ' 分'],
          ['本轮权重', WEIGHTS[state.pref].name]
        ],
        compare: {
          title: '经验方案（射孔） vs 智能方案（本轮第一）',
          columns: ['指标', '经验方案', '智能方案', '变化', '约束 / 说明'],
          rows: rows,
          note: '经验方案固定为射孔完井；智能方案为本轮 TOPSIS 排名第一的候选。两者共用同一套指标与参数。'
        },
        why: [
          '5 项指标先按列向量范数归一化再加权，投资（万元）与日产（t/d）不会因为量纲不同而被某一项主导。',
          '权重逐项 ±25% 扰动 ' + res.stable + '/10 组后第一名仍不变，说明当前排序对权重不敏感；若翻转，说明需要现场重新确认权重。',
          '推荐方案把防砂能力从 ' + base.sand.toFixed(0) + ' 提升到 ' + best.sand.toFixed(0) + '，代价是投资增加 ' +
            (best.cost - base.cost) + ' 万元——这个取舍被显式列出，而不是藏在“AI 更优”一句话里。'
        ],
        bounds: [
          '本示范使用合成数据，指标打分是规则映射，未用本井试采或邻井产能数据标定。',
          'TOPSIS 只回答“当前权重下谁更接近理想解”，不提供井壁稳定、防砂工艺与工具可行性的物理证明。',
          '权重、预算与可靠性阈值需现场确认；推荐结果必须由工程师复核后才能进入完井设计。'
        ]
      });
    }

    function renderAll() {
      var res = evaluate(state);
      renderSmart(res);
      renderRadar(res);
      renderBar(res);
      renderReasons(res);
      renderKpis(res);
      renderFigure(res);
      renderPicks(res);
      renderTable(res);
      renderFunnel(res);
      renderPickState(res);
      renderLink(res);
    }

    /* ---------------- 事件 ---------------- */
    ['co1-perm', 'co1-pressure', 'co1-sand', 'co1-budget', 'co1-target'].forEach(function (id) {
      listen($(id), 'input', function () {
        aiPicked = false;
        readState();
        renderAll();
      });
    });
    $('co1-pref').querySelectorAll('button').forEach(function (btn) {
      listen(btn, 'click', function () {
        state.pref = btn.getAttribute('data-pref');
        aiPicked = false;
        $('co1-pref').querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('on', b === btn);
        });
        renderAll();
      });
    });
    listen($('co1-reset'), 'click', function () {
      for (var k in DEFAULTS) state[k] = DEFAULTS[k];
      $('co1-perm').value = DEFAULTS.perm;
      $('co1-pressure').value = DEFAULTS.pressure;
      $('co1-sand').value = DEFAULTS.sandRisk;
      $('co1-budget').value = DEFAULTS.budget;
      $('co1-target').value = DEFAULTS.target;
      selectedId = null;
      aiPicked = false;
      $('co1-pref').querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-pref') === DEFAULTS.pref);
      });
      readState();
      renderAll();
    });
    listen($('co1-pick'), 'click', function () {
      selectedId = evaluate(state).best.id;
      aiPicked = true;
      renderAll();
    });

    listen($('co1-picks'), 'click', function (ev) {
      var c = ev.target.closest ? ev.target.closest('.iq-tcard') : null;
      if (!c) return;
      selectedId = c.getAttribute('data-id');
      aiPicked = false;
      renderAll();
    });

    /* 初始渲染 */
    $('co1-pref').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-pref') === state.pref);
    });
    readState();
    selectedId = evaluate(state).best.id;
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
