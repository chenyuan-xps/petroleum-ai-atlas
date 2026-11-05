/* =========================================================
   应用外壳 Shell
   ---------------------------------------------------------
   职责：路由、页面骨架、导航、把案例挂到场景页上。
   不含任何具体案例的业务内容 —— 那些都在 assets/cases/*.js
   ========================================================= */

(function (global) {
  'use strict';

  var A = global.ATLAS;
  var M = A.methods;
  var K = global.K;
  var esc = K.esc, pad = K.pad, rich = K.rich;

  var view = document.getElementById('view');
  var mounted = null;          // 当前挂载中的示范，切页时调用其 unmount
  var mountedKey = '';
  var wfStop = null;           // 流程页自动播放的中止函数，切页时调用

  /* 左侧导航收起 / 展开（状态记在 localStorage，刷新后保持） */
  function setRailCollapsed(v) {
    document.body.classList.toggle('rail-collapsed', !!v);
    var btn = document.querySelector('[data-rail-toggle]');
    if (btn) btn.setAttribute('aria-expanded', v ? 'false' : 'true');
    try { localStorage.setItem('atlas.rail.collapsed', v ? '1' : '0'); } catch (e) { /* 隐私模式忽略 */ }
  }
  try {
    if (localStorage.getItem('atlas.rail.collapsed') === '1') document.body.classList.add('rail-collapsed');
  } catch (e) { /* 忽略 */ }

  /* 方法反查抽屉：悬停或点击展开，选中子页后自动收起 */
  function setRailDrop(v) {
    var drop = document.querySelector('.rail-drop');
    if (!drop) return;
    drop.classList.toggle('on', !!v);
    var btn = drop.querySelector('[data-rail-drop]');
    if (btn) btn.setAttribute('aria-expanded', v ? 'true' : 'false');
  }

  /* =========================================================
     一、路由
     ========================================================= */
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?'), qs = '';
    if (qi >= 0) { qs = h.slice(qi + 1); h = h.slice(0, qi); }
    var q = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { parts: h.split('/').filter(Boolean), q: q };
  }

  function go(hash) { location.hash = hash; }

  /* file:// 协议下部分浏览器会拒绝 replaceState，失败时静默降级 */
  function setHashQuiet(hash) {
    try { history.replaceState(null, '', hash); }
    catch (e) { /* 忽略：地址栏不同步不影响功能 */ }
  }

  /* =========================================================
     二、公共片段
     ========================================================= */
  /* 顶栏与左栏用到的线性图标（统一 1.7 描边，currentColor） */
  var ICON = {
    search: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L21 21"/></svg>',
    home: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z"/></svg>',
    chain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="4.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19.5" cy="12" r="2"/><path d="M6.5 12h3.5M14 12h3.5"/></svg>',
    cases: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4.5" width="7.5" height="7" rx="1.2"/><rect x="13.5" y="4.5" width="7.5" height="7" rx="1.2"/><rect x="3" y="14.5" width="7.5" height="5" rx="1.2"/><rect x="13.5" y="14.5" width="7.5" height="5" rx="1.2"/></svg>',
    doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5V8h4M9 12h6M9 15.5h6"/></svg>',
    guide: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5.5c2.6-.9 5.3-.9 8 0v14c-2.7-.9-5.4-.9-8 0z"/><path d="M12 5.5c2.7-.9 5.4-.9 8 0v14c-2.6-.9-5.3-.9-8 0"/></svg>',
    admin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3.5 12h2M18.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  };

  /* 本平台交付的六个案例（co1–co4 + e1 + pr2），不含站点自带的示例案例 */
  function ownedCaseIds() {
    var pj = A.project || {};
    return (pj.requiredIds || []).concat(pj.extensionIds || []);
  }
  function ownedCases() {
    return ownedCaseIds().map(function (id) { return Cases.get(id); }).filter(Boolean);
  }
  function ownedCaseCount() { return ownedCases().length; }

  function header(isHome) {
    var r = parseHash();
    var p = r.parts, cur = p[0] || 'home';
    var s = A.stats();
    var owned = ownedCaseCount();
    function on(k) { return cur === k ? ' on' : ''; }
    var mnav =
      '<nav class="plat-mnav">' +
      '<a class="' + (cur === 'home' ? 'on' : '') + '" href="#/">总览</a>' +
      '<a class="' + (cur === 'chain' || cur === 'stage' ? 'on' : '') + '" href="#/chain">作业链</a>' +
      '<a class="' + (cur === 'cases' || cur === 'scene' ? 'on' : '') + '" href="#/cases">案例库</a>' +
      '<a class="' + (cur === 'project' ? 'on' : '') + '" href="#/project">项目说明</a>' +
      '<a class="' + (cur === 'guide' ? 'on' : '') + '" href="#/guide">接入指南</a>' +
      '</nav>';

    return '<header class="hdr cmdbar' + (isHome ? ' hdr-home' : '') + '"><div class="hdr-in">' +
      '<a class="brand" href="#/">' +
      '<span class="brand-mark">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round">' +
      '<path d="M3 17l5-6 4 3 4-6 5 4"/><circle cx="8" cy="11" r="1.6" fill="#fff" stroke="none"/>' +
      '</svg></span>' +
      '<span class="brand-txt"><b>石油智能化案例平台</b><span>Petro × AI Atlas</span></span></a>' +
      '<button class="cmd-search" type="button" data-cmdk aria-label="全局搜索">' + ICON.search +
      '<span class="ph">搜索环节、场景、案例或方法…</span><kbd>Ctrl K</kbd></button>' +
      '<div class="cmd-right">' +
      '<span class="cmd-stat"><b>' + owned + '</b>案例<span class="sep">·</span><b>' + s.total + '</b>场景<span class="sep">·</span>' + A.stages.length + ' 环节</span>' +
      '<button class="cmd-add" data-import>＋ 添加案例</button>' +
      '</div></div>' + mnav + '</header>';
  }

  /* ---------------- 左侧导航 ---------------- */
  function railLink(href, icon, label, opts) {
    opts = opts || {};
    return '<a class="rail-link' + (opts.on ? ' on' : '') + '" href="' + href + '"' +
      (opts.m ? ' data-m="' + opts.m + '"' : '') + ' title="' + esc(opts.title || label) + '">' +
      '<span class="ic">' + (ICON[icon] || ICON.doc) + '</span><span>' + esc(label) + '</span>' +
      (opts.cnt != null ? '<span class="cnt">' + opts.cnt + '</span>' : '') +
      (opts.dot ? '<i class="dot"></i>' : '') + '</a>';
  }

  function railHTML() {
    var r = parseHash();
    var p = r.parts, top = p[0] || 'home';
    var pc = ownedCaseCount();
    var methodKey = top === 'method' ? p[1] : '';

    var navOn =
      top === 'home' ? 'home' :
      (top === 'chain' || top === 'stage') ? 'chain' :
      (top === 'cases' || top === 'scene') ? 'cases' :
      top === 'project' ? 'project' :
      top === 'guide' ? 'guide' : top === 'admin' ? 'admin' : '';

    /* 方法反查子页：抽屉里列出五类方法，选中即跳转 */
    var methodItems = Object.keys(M).map(function (k) {
      var n = (A.index.byMethod[k] || []).length;
      return '<a class="rf-item' + (methodKey === k ? ' on' : '') + '" href="#/method/' + k + '"' +
        ' data-m="' + esc(M[k].colorKey || k) + '" title="' + esc(M[k].abbr + ' · ' + n + ' 个场景') + '">' +
        '<span class="rf-dot"></span><span class="rf-t">' + esc(M[k].name) + '</span>' +
        '<span class="rf-b">' + esc(M[k].abbr) + '</span><span class="rf-n">' + n + '</span></a>';
    }).join('');

    var methodDrop =
      '<div class="rail-drop">' +
      '<button class="rail-link rail-drop-btn" type="button" data-rail-drop ' +
      'aria-haspopup="true" aria-expanded="false">' +
      '<span class="ic">' + ICON.chain + '</span><span class="rd-l">方法反查</span>' +
      '<span class="cnt">' + Object.keys(M).length + '</span>' +
      '<svg class="chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="rail-fly" role="menu">' +
      '<div class="rf-h">按方法反查场景</div>' + methodItems +
      '</div></div>';

    return '<aside class="rail">' +
      '<button class="rail-toggle" type="button" data-rail-toggle ' +
      'aria-label="收起或展开左侧导航" title="收起 / 展开导航">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M15 5L8 12l7 7"/></svg></button>' +
      '<div class="rail-h">平台导航</div>' +
      railLink('#/chain', 'chain', '作业链', { on: navOn === 'chain', cnt: A.stages.length }) +
      railLink('#/cases', 'cases', '案例库', { on: navOn === 'cases', cnt: pc }) +
      railLink('#/project', 'doc', '项目说明', { on: navOn === 'project' }) +
      methodDrop +

      '<div class="rail-h">系统</div>' +
      railLink('#/guide', 'guide', '接入指南') +
      railLink('#/admin', 'admin', global.Admin && global.Admin.loggedIn() ? '管理后台' : '管理') +
      '<div class="rail-foot">' +
      esc(A.meta.version) + ' · 平台版<br>' +
      '纯前端 · 无后端<br>合成数据用于教学' +
      '</div>' +
      '</aside>';
  }

  function crumb(items) {
    return '<nav class="crumb">' + items.map(function (it, i) {
      var last = i === items.length - 1;
      return (i ? '<span class="sep">/</span>' : '') +
        (last ? '<span class="cur">' + esc(it[1]) + '</span>' : '<a href="' + it[0] + '">' + esc(it[1]) + '</a>');
    }).join('') + '</nav>';
  }

  function caseChip(k) {  /* 案例 methods 标签（小号） */
    var m = M[k];
    if (!m) return '';
    var ck = m.colorKey || k;
    return '<span class="mtag sm" data-m="' + ck + '"><b>' + esc(m.abbr) + '</b>' + esc(m.name) + '</span>';
  }

  /* =========================================================
     三、首页：平台驾驶舱
     ========================================================= */
  var CASE_SPEC = {
    'completion-method-selection': {
      hot: '深度交互', params: 5, charts: 4,
      blurb: '五套完井方案 × 五项指标做 TOPSIS 排序；现场权重一动，排序与推荐路径随之改变。'
    },
    'perforation-parameter-design': {
      hot: '深度交互', params: 4, charts: 4,
      blurb: '孔密、相位、孔径与段长联动，产能热力与风险等高线一起看，找综合最优窗口。'
    },
    'completion-string-stress-analysis': {
      hot: '中深度交互', params: 5, charts: 4,
      blurb: '下入速度与摩阻决定钩载，沿井深逐点计算安全系数，提前看到卡点与超限段。'
    },
    'intelligent-sleeve-control': {
      hot: '深度交互', params: 6, charts: 6,
      blurb: '三层滑套 30 天滚动优化，AI 策略与固定开度逐日对比产油、含水与流量分配。'
    },
    'fracturing-parameter-optimization': {
      hot: '中深度交互', params: 4, charts: 5,
      blurb: '排量、液量、砂比与闭合压力联动，增产热力与风险等高线共同圈定可行窗口。'
    },
    'production-forecasting': {
      hot: '中深度交互', params: 6, charts: 4,
      blurb: '指数递减叠加注水与含水耦合，给出带置信区间的产量预测与配产制度建议。'
    },
    'geology-remote-sensing': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '合成地物栅格给出三类岩性概率，阈值直接决定图层能交付多少、人工要复核多少。'
    },
    'seismic-firstbreak-pick': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '炮集波形叠加噪声与面波，阈值拾取后按 ±8 ms 容差统计命中率与错拾道数。'
    },
    'drilling-rop-optimization': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '钻压—转速二维钻速图，先按扭矩约束剔除不可行点，再给出带余量的参数建议。'
    },
    'mudlog-lithology-cuttings': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '六类岩屑概率按混样与粒级变化，阈值决定自动入库还是转人工复核。'
    },
    'cement-bond-quality': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '沿井深的胶结指数曲线按阈值分三级，自动圈出连续不合格段与挤水泥候选。'
    },
    'perforation-gun-selection': {
      hot: '轻量交互', params: 3, charts: 1,
      blurb: '六种弹型先过穿深、孔径、套管损伤三道硬约束，再在可行集里排序。'
    },
    'workover-plan-recommend': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '按故障类型把失败返工折进预期费用，五套修井方案排序并给出备选。'
    },
    'pipeline-leak-detection': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '压力残差曲线配报警阈值，实时看到检测延迟与误报次数的此消彼长。'
    },
    'fcc-product-prediction': {
      hot: '中深度交互', params: 3, charts: 1,
      blurb: '反应温度扫描出五类产品收率曲线，按产品价值找最优温度而非最高汽油收率。'
    }
  };

  /* 方法类别 → 主色，用于给上传案例生成占位缩略图 */
  var CASE_COLOR = {
    cv: '#4a443a', ts: '#b06a3b', nlp: '#78568a', opt: '#8a3040', kg: '#6f7430'
  };

  function caseSpec(c) {
    var sp = CASE_SPEC[c.id];
    var sc = A.index.byScene[c.sceneId];
    /* 上传的案例没有登记参数/图表数量时，用 null 表示"未申报"，
       案例头据此隐藏对应胶囊，而不是显示成「— 个可调」。 */
    return sp || { hot: '可运行', params: null, charts: null, blurb: sc ? sc.point : '' };
  }

  /* 六个案例的缩略图：每个对应它在示范里的主图形态 */
  function caseThumb(c) {
    var id = (c && c.id) ? c.id : c;
    var open = '<svg viewBox="0 0 240 88" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    var close = '</svg>';
    var b = '';

    if (id === 'completion-method-selection') {
      b = '<g transform="translate(120 44)">' +
        '<polygon points="0,-31 29.5,-9.6 18.2,25.1 -18.2,25.1 -29.5,-9.6" fill="none" stroke="#c9c2b0" stroke-width=".8"/>' +
        '<polygon points="0,-19 18.1,-5.9 11.2,15.4 -11.2,15.4 -18.1,-5.9" fill="none" stroke="#c9c2b0" stroke-width=".8" stroke-dasharray="2 2"/>' +
        '<g stroke="#ddd7c8" stroke-width=".7">' +
        '<line x1="0" y1="0" x2="0" y2="-31"/><line x1="0" y1="0" x2="29.5" y2="-9.6"/>' +
        '<line x1="0" y1="0" x2="18.2" y2="25.1"/><line x1="0" y1="0" x2="-18.2" y2="25.1"/>' +
        '<line x1="0" y1="0" x2="-29.5" y2="-9.6"/></g>' +
        '<polygon points="0,-24 22,-7 14,18 -14,18 -22,-7" fill="#3a352d" fill-opacity=".16" stroke="#3a352d" stroke-width="1.3"/>' +
        '<circle r="2.2" fill="#b26a39"/></g>' +
        '<text x="230" y="80" text-anchor="end" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">TOPSIS</text>';
    } else if (id === 'perforation-parameter-design') {
      var vals = [0.10, 0.20, 0.34, 0.46, 0.54, 0.42, 0.26, 0.14,
        0.16, 0.30, 0.52, 0.72, 0.82, 0.66, 0.38, 0.20,
        0.12, 0.24, 0.44, 0.64, 0.70, 0.50, 0.30, 0.16,
        0.08, 0.14, 0.24, 0.34, 0.40, 0.30, 0.18, 0.10];
      var cells = '';
      for (var i = 0; i < vals.length; i++) {
        var cx = 16 + (i % 8) * 26, cy = 10 + Math.floor(i / 8) * 18;
        cells += '<rect x="' + cx + '" y="' + cy + '" width="23" height="16" rx="1.5" fill="#b26a39" fill-opacity="' + vals[i] + '"/>';
      }
      b = cells +
        '<path d="M22 48 C62 30 96 46 128 34 S188 40 216 24" fill="none" stroke="#8e5229" stroke-width="1.2" stroke-dasharray="3 2"/>' +
        '<path d="M22 62 C60 52 100 62 132 52 S190 54 216 42" fill="none" stroke="#3a352d" stroke-width="1.1" opacity=".75"/>' +
        '<text x="230" y="80" text-anchor="end" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">HEATMAP</text>';
    } else if (id === 'completion-string-stress-analysis') {
      b = '<line x1="14" y1="80" x2="228" y2="80" stroke="#e9e4d8" stroke-width="1"/>' +
        '<path d="M66 8 C66 28 78 42 72 58 S60 70 63 80" fill="none" stroke="#8d979d" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M66 8 C66 28 78 42 72 58 S60 70 63 80" fill="none" stroke="#a03d4f" stroke-width="1" stroke-dasharray="3 3"/>' +
        '<g fill="#b26a39">' +
        '<circle cx="66" cy="8" r="2.2"/><circle cx="71" cy="34" r="2.2"/>' +
        '<circle cx="67" cy="58" r="2.2"/><circle cx="63" cy="80" r="2.2"/></g>' +
        '<path d="M112 68 C132 61 142 42 158 36 S200 26 222 20" fill="none" stroke="#3a352d" stroke-width="1.6"/>' +
        '<line x1="112" y1="26" x2="222" y2="26" stroke="#b05a51" stroke-width=".9" stroke-dasharray="4 3"/>' +
        '<text x="230" y="16" text-anchor="end" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">HOOK LOAD</text>';
    } else if (id === 'intelligent-sleeve-control') {
      b = '<path d="M18 66 C60 58 80 62 120 54 S190 44 222 46 L222 78 L18 78 Z" fill="#3a352d" fill-opacity=".16"/>' +
        '<path d="M18 58 C60 50 90 56 130 46 S194 38 222 36 L222 46 C190 44 160 40 120 54 S60 58 18 66 Z" fill="#b26a39" fill-opacity=".15"/>' +
        '<path d="M18 46 C58 42 92 40 126 36 S192 28 222 26 L222 36 C194 38 160 34 130 46 S60 50 18 58 Z" fill="#a03d4f" fill-opacity=".14"/>' +
        '<path d="M18 40 C60 36 96 34 130 28 S196 20 222 18" fill="none" stroke="#3a352d" stroke-width="1.6"/>' +
        '<line x1="18" y1="22" x2="222" y2="22" stroke="#b26a39" stroke-width=".9" stroke-dasharray="4 3"/>' +
        '<text x="230" y="80" text-anchor="end" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">30 DAYS</text>';
    } else if (id === 'fracturing-parameter-optimization') {
      var fv = [0.12, 0.22, 0.36, 0.52, 0.44, 0.26,
        0.18, 0.34, 0.60, 0.78, 0.62, 0.36,
        0.12, 0.26, 0.46, 0.56, 0.42, 0.22,
        0.06, 0.12, 0.20, 0.26, 0.18, 0.10];
      var fc = '';
      for (var j = 0; j < fv.length; j++) {
        var fx = 40 + (j % 6) * 30, fy = 8 + Math.floor(j / 6) * 19;
        fc += '<rect x="' + fx + '" y="' + fy + '" width="27" height="17" rx="1.5" fill="#767a2e" fill-opacity="' + fv[j] + '"/>';
      }
      b = fc +
        '<path d="M34 82 C74 58 112 42 150 20" fill="none" stroke="#8e5229" stroke-width="1.4"/>' +
        '<path d="M52 82 C92 62 124 48 166 26" fill="none" stroke="#b26a39" stroke-width=".9" stroke-dasharray="4 3"/>' +
        '<text x="230" y="80" text-anchor="end" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">PROXY</text>';
    } else if (id === 'production-forecasting') {
      b = '<line x1="16" y1="76" x2="226" y2="76" stroke="#e9e4d8"/>' +
        '<path d="M18 38 C50 36 80 42 110 47 S180 57 224 61 L224 72 C180 68 150 63 110 58 S50 48 18 50 Z" fill="#b26a39" fill-opacity=".14"/>' +
        '<path d="M18 44 C50 42 80 48 110 53 S180 62 224 66" fill="none" stroke="#b26a39" stroke-width="1.8"/>' +
        '<path d="M18 42 C50 40 80 45 110 50 S180 59 224 63" fill="none" stroke="#79828a" stroke-width="1" stroke-dasharray="3 2"/>' +
        '<line x1="110" y1="12" x2="110" y2="76" stroke="#c9c2b0" stroke-dasharray="2 2"/>' +
        '<circle cx="110" cy="53" r="2" fill="#8e5229"/>' +
        '<text x="114" y="16" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">FORECAST →</text>';
    }
    /* 上传的案例没有预置缩略图：按所属场景的方法色生成一张抽象占位图，
       保证案例头与案例画廊里的卡片不会出现空框。 */
    if (!b) {
      var pc = (CASE_COLOR[((c && c.methods && c.methods[0]) || '')] || '#3a352d');
      var grid = '', bar = '';
      for (var gi = 0; gi < 3; gi++) {
        var gy = 26 + gi * 20;
        grid += '<line x1="16" y1="' + gy + '" x2="226" y2="' + gy + '" stroke="#e9e4d8" stroke-width=".7"/>';
      }
      var hgt = [16, 26, 21, 38, 30, 46, 34, 52];
      for (var bi = 0; bi < hgt.length; bi++) {
        bar += '<rect x="' + (22 + bi * 26) + '" y="' + (78 - hgt[bi]) + '" width="13" height="' + hgt[bi] +
          '" rx="1.5" fill="' + pc + '" fill-opacity="' + (0.10 + bi * 0.028).toFixed(2) + '"/>';
      }
      b = grid + bar +
        '<path d="M22 62 C58 56 92 48 124 40 S190 26 224 20" fill="none" stroke="' + pc +
        '" stroke-width="1.6" stroke-opacity=".85"/>' +
        '<circle cx="124" cy="40" r="2.4" fill="' + pc + '"/>' +
        '<text x="230" y="80" text-anchor="end" font-size="6.5" letter-spacing="1" fill="#9ba3a9" font-family="monospace">' +
        esc(String((c && c.sceneId) || '').toUpperCase()) + '</text>';
    }
    return open + b + close;
  }

  /* =========================================================
     首页 13 环节 · 油田场景地图
     ---------------------------------------------------------
     作业要求「13 个阶段须在网站首页列出」。这一版不再用卡片网格，
     而是画一张按作业顺序铺开的油田全景剖面：地表从地质勘察到加工
     依次排开设备，地下是井筒与储层剖面；13 个编号标记用引线钉在
     对应设备上，点击进入该环节的场景清单。所有图形为矢量绘制。
     ========================================================= */

  /* 每个环节的标注位置：
     x / y  —— 编号钉在设备上的位置；
     lx / ly —— 名称牌的中心 x 与顶部 y，按设备高度上下错落，避免挤成一排。 */
  var FM_ANCHOR = {
    geology: { x: 150, y: 505, lx: 150, ly: 428 },
    seismic: { x: 320, y: 508, lx: 330, ly: 428 },
    drilling: { x: 470, y: 360, lx: 470, ly: 244 },
    mudlogging: { x: 625, y: 500, lx: 625, ly: 420 },
    welllog: { x: 745, y: 500, lx: 772, ly: 386 },
    cementing: { x: 875, y: 455, lx: 886, ly: 336 },
    completion: { x: 1000, y: 490, lx: 1000, ly: 408 },
    perforation: { x: 1130, y: 500, lx: 1132, ly: 336 },
    production: { x: 1250, y: 480, lx: 1262, ly: 276 },
    workover: { x: 1380, y: 480, lx: 1398, ly: 246 },
    eor: { x: 1500, y: 500, lx: 1500, ly: 356 },
    transport: { x: 1620, y: 510, lx: 1626, ly: 436 },
    refining: { x: 1846, y: 425, lx: 1852, ly: 256 }
  };

  /* 井架：底宽 hb、顶宽 ht，按等分节点画横撑与斜撑 */
  function fmDerrick(x, base, h, hb, ht) {
    var g = '<g transform="translate(' + x + ',' + base + ')">';
    g += '<rect x="' + (-hb - 6) + '" y="-18" width="' + (hb * 2 + 12) +
      '" height="18" rx="2" fill="#bcb096" stroke="#3a352d" stroke-opacity=".35"/>';
    g += '<line x1="-16" y1="-18" x2="-16" y2="0" stroke="#3a352d" stroke-opacity=".3"/>' +
      '<line x1="16" y1="-18" x2="16" y2="0" stroke="#3a352d" stroke-opacity=".3"/>';
    var seg = 8;
    for (var i = 0; i < seg; i++) {
      var t = i / seg, t2 = (i + 1) / seg;
      var y1 = -18 - h * t, y2 = -18 - h * t2;
      var xl1 = -hb + (hb - ht) * t, xr1 = hb - (hb - ht) * t;
      var xl2 = -hb + (hb - ht) * t2, xr2 = hb - (hb - ht) * t2;
      g += '<line x1="' + xl1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + xl2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="#3a352d" stroke-width="1.6"/>';
      g += '<line x1="' + xr1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + xr2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="#3a352d" stroke-width="1.6"/>';
      g += '<line x1="' + xl2.toFixed(1) + '" y1="' + y2.toFixed(1) + '" x2="' + xr2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="#3a352d" stroke-width="1" stroke-opacity=".75"/>';
      g += i % 2
        ? '<line x1="' + xl1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + xr2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="#3a352d" stroke-width="1" stroke-opacity=".45"/>'
        : '<line x1="' + xr1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + xl2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="#3a352d" stroke-width="1" stroke-opacity=".45"/>';
    }
    g += '<rect x="-12" y="' + (-18 - h - 9) + '" width="24" height="9" rx="1" fill="#4a443a"/>' +
      '<circle cx="0" cy="' + (-18 - h - 4) + '" r="2.4" fill="#b8622f"/>';
    return g + '</g>';
  }

  function fmDefs() {
    return '<defs>' +
      '<linearGradient id="fmSky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fbf7ec"/><stop offset=".56" stop-color="#f5e9d3"/>' +
      '<stop offset="1" stop-color="#ecd8b9"/></linearGradient>' +
      '<linearGradient id="fmGround" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#d6c19b"/><stop offset=".55" stop-color="#c9b187"/>' +
      '<stop offset="1" stop-color="#b89a70"/></linearGradient>' +
      '<radialGradient id="fmSun">' +
      '<stop offset="0" stop-color="#ffe4b6" stop-opacity=".9"/>' +
      '<stop offset=".45" stop-color="#ffdCA6" stop-opacity=".34"/>' +
      '<stop offset="1" stop-color="#ffdca6" stop-opacity="0"/></radialGradient>' +
      '</defs>';
  }

  /* 远处地平线上的抽油机剪影：偶发几台，避免把地平线压成一条直线 */
  function fmFarPumps() {
    var xs = [1040, 1428, 1688];
    var g = '<g fill="#b3a386" opacity=".4">';
    for (var i = 0; i < xs.length; i++) {
      g += '<g transform="translate(' + xs[i] + ',420) scale(.55)">' +
        '<path d="M-11 0l7-24 6 0-7 24z"/>' +
        '<path d="M-30-30l34-6 2 4-34 6z"/>' +
        '<path d="M-34-34h5v12h-5z"/>' +
        '<line x1="-31" y1="-22" x2="-31" y2="0" stroke="#b3a386" stroke-width="1.4"/>' +
        '<rect x="-35" y="-5" width="9" height="5"/>' +
        '</g>';
    }
    return g + '</g>';
  }

  function fmScene() {
    var s = '';
    var i, x;

    /* ---------- 天空 / 远景 ---------- */
    s += '<rect x="0" y="0" width="2000" height="452" fill="url(#fmSky)"/>' +
      '<circle cx="1540" cy="336" r="250" fill="url(#fmSun)"/>' +
      '<circle cx="1540" cy="336" r="26" fill="#ffeccb" opacity=".92"/>' +
      '<g opacity=".6">' +
      '<ellipse cx="286" cy="152" rx="196" ry="15" fill="#fdf6e8"/><ellipse cx="392" cy="140" rx="118" ry="9" fill="#fdf6e8"/>' +
      '<ellipse cx="866" cy="214" rx="246" ry="13" fill="#f7ecd8"/><ellipse cx="1240" cy="122" rx="166" ry="11" fill="#fdf6e8"/>' +
      '<ellipse cx="1756" cy="176" rx="150" ry="10" fill="#fdf6e8"/></g>' +
      '<g fill="#e9d7bb" opacity=".45">' +
      '<ellipse cx="640" cy="228" rx="300" ry="7"/><ellipse cx="1080" cy="92" rx="240" ry="6"/>' +
      '<ellipse cx="1600" cy="242" rx="220" ry="6"/></g>';

    /* 远山：左侧是地质勘察的山区，向右过渡成平原 */
    s += '<path d="M0 452V392L34 362 62 334 92 348 126 308 158 338 192 320 222 352 256 366 ' +
      '300 382 360 394 430 402 2000 408V452Z" fill="#d9ceb2"/>' +
      '<path d="M0 452V420L120 412 260 418 420 412 620 418 820 412 1040 418 1240 412 ' +
      '1440 418 1660 414 1900 420 2000 415V452Z" fill="#cdc0a1"/>' +
      '<rect x="0" y="404" width="2000" height="26" fill="#f6e8cf" opacity=".3"/>';

    /* 地平线上的抽油机剪影：把“油田”再往外推一层 */
    s += fmFarPumps();

    /* ---------- 地表 ---------- */
    s += '<rect x="0" y="420" width="2000" height="152" fill="url(#fmGround)"/>';

    var TUFT = [70, 148, 238, 300, 392, 528, 700, 800, 1010, 1080, 1180, 1300, 1420, 1560, 1660, 1780, 1930,
      96, 268, 350, 452, 596, 664, 780, 846, 928, 1044, 1128, 1216, 1276, 1364, 1478, 1596, 1712, 1810, 1962];
    for (i = 0; i < TUFT.length; i++) {
      x = TUFT[i];
      var ty = 556 - (i % 4) * 7;
      s += '<path d="M' + x + ' ' + ty + 'l-4-7M' + x + ' ' + ty +
        'l0-9M' + x + ' ' + ty + 'l5-6" fill="none" stroke="#a8906a" stroke-width="1" opacity=".7"/>';
    }
    s += '<g fill="#a08358" opacity=".45">' +
      '<ellipse cx="120" cy="562" rx="9" ry="2.4"/><ellipse cx="672" cy="548" rx="12" ry="2.2"/>' +
      '<ellipse cx="1332" cy="566" rx="10" ry="2"/><ellipse cx="1900" cy="558" rx="14" ry="2.6"/>' +
      '<ellipse cx="404" cy="560" rx="7" ry="2"/><ellipse cx="996" cy="552" rx="8" ry="1.8"/>' +
      '<ellipse cx="1156" cy="566" rx="9" ry="2"/><ellipse cx="1736" cy="560" rx="11" ry="2.4"/></g>' +
      /* 沙脊与通往加工厂的车辙 */
      '<g stroke="#a98b62" fill="none" opacity=".18">' +
      '<path d="M0 536C220 528 380 542 560 534S880 540 1020 532" stroke-width="2"/>' +
      '<path d="M120 552C320 544 520 558 720 548S980 556 1160 546" stroke-width="2"/></g>' +
      '<path d="M1040 548C1230 540 1410 558 1590 546S1890 552 2000 546" stroke="#96794f" stroke-width="6" opacity=".15" fill="none"/>' +
      '<path d="M1040 558C1230 550 1410 568 1590 556S1890 562 2000 556" stroke="#96794f" stroke-width="3" opacity=".12" fill="none"/>';

    /* 集输管线（在设备之前画，设备地基会压住它） */
    s += '<path d="M690 556H1746" stroke="#8a7f6b" stroke-width="4" opacity=".5"/>' +
      '<path d="M690 549H1746" stroke="#b3a585" stroke-width="1.2" opacity=".7"/>';
    for (i = 0; i < 10; i++) {
      x = 740 + i * 120;
      s += '<line x1="' + x + '" y1="556" x2="' + x + '" y2="567" stroke="#8a7f6b" stroke-width="2" opacity=".45"/>';
    }

    /* ---------- 地下剖面 ---------- */
    s += '<rect x="0" y="570" width="2000" height="290" fill="#8f774f"/>' +
      '<rect x="0" y="570" width="2000" height="50" fill="#c2ab80"/>' +
      '<rect x="0" y="620" width="2000" height="56" fill="#b29a6e"/>' +
      '<rect x="0" y="676" width="2000" height="54" fill="#a1885c"/>' +
      '<rect x="0" y="730" width="2000" height="62" fill="#907a51"/>' +
      '<rect x="0" y="792" width="2000" height="68" fill="#7c6844"/>' +
      '<g stroke="#8d7750" stroke-width="1" opacity=".6">' +
      '<line x1="0" y1="620" x2="2000" y2="620"/><line x1="0" y1="676" x2="2000" y2="676"/>' +
      '<line x1="0" y1="730" x2="2000" y2="730"/><line x1="0" y1="792" x2="2000" y2="792"/></g>';

    for (i = 0; i < 46; i++) {
      s += '<ellipse cx="' + ((i * 97) % 1980 + 10) + '" cy="' + (600 + (i * 53) % 236) +
        '" rx="' + (2 + i % 3) + '" ry="1.4" fill="#6f5c3c" opacity=".3"/>';
    }

    /* 含油储层：沿地层拉出一条连续砂体，而不是一块孤立的椭圆 */
    s += '<path d="M742 748C880 736 1040 754 1200 744S1420 736 1540 748C1600 754 1636 748 1668 744' +
      'L1668 790C1600 796 1520 790 1420 796S1200 800 1060 794C940 790 840 796 742 790Z" ' +
      'fill="#9c7c48" stroke="#6b5637" stroke-width="1"/>' +
      '<path d="M746 750C890 738 1040 756 1200 746S1420 738 1540 750C1600 756 1636 750 1662 746" ' +
      'stroke="#d7bd8c" stroke-width="1" fill="none" opacity=".5"/>';
    s += '<g fill="#3f301a" opacity=".45">';
    for (i = 0; i < 30; i++) {
      s += '<circle cx="' + (790 + (i * 67) % 840) + '" cy="' + (752 + (i * 29) % 36) + '" r="1.8"/>';
    }
    s += '</g>';

    /* 剖面切口 */
    s += '<line x1="0" y1="570" x2="2000" y2="570" stroke="#8b7a55" stroke-width="1.6" opacity=".55"/>';
    for (i = 0; i < 40; i++) {
      x = i * 50 + 25;
      s += '<line x1="' + x + '" y1="570" x2="' + (x + 8) + '" y2="578" stroke="#8b7a55" stroke-width="1" opacity=".3"/>';
    }

    /* 井筒：钻井 / 完井 / 采油 / 注水 */
    s += '<g>' +
      '<rect x="461" y="560" width="18" height="28" fill="#cfc6b6" stroke="#8b7a55" stroke-opacity=".5"/>' +
      '<line x1="470" y1="586" x2="470" y2="806" stroke="#5b5347" stroke-width="2"/>' +
      '<polygon points="463,806 477,806 470,817" fill="#3a352d"/>' +
      '<path d="M461 690c-7 9-7 19-5 28" stroke="#b8622f" stroke-width="1" fill="none" opacity=".45"/>' +
      '</g>' +
      '<g>' +
      '<rect x="984" y="570" width="32" height="198" fill="#d6cdbd" stroke="#b9ae99"/>' +
      '<rect x="992" y="570" width="16" height="198" fill="#eee4ce" stroke="#8a7f6b"/>' +
      '<rect x="986" y="742" width="28" height="8" fill="#4a443a"/>' +
      '<g stroke="#b8622f" stroke-width="1.6">' +
      '<line x1="1000" y1="760" x2="976" y2="770"/><line x1="1000" y1="760" x2="1024" y2="770"/>' +
      '<line x1="1000" y1="780" x2="972" y2="792"/><line x1="1000" y1="780" x2="1028" y2="792"/></g>' +
      '<circle cx="1000" cy="760" r="3" fill="#b8622f"/>' +
      '</g>' +
      '<g>' +
      '<rect x="1238" y="570" width="24" height="188" fill="#d6cdbd" stroke="#b9ae99"/>' +
      '<rect x="1246" y="570" width="8" height="176" fill="#eee4ce" stroke="#8a7f6b"/>' +
      '<g stroke="#97571a" stroke-width="1.4" opacity=".8">' +
      '<line x1="1206" y1="748" x2="1234" y2="754"/><line x1="1206" y1="772" x2="1234" y2="776"/></g>' +
      '</g>' +
      '<g>' +
      '<rect x="1488" y="570" width="24" height="204" fill="#d6cdbd" stroke="#b9ae99"/>' +
      '<rect x="1496" y="570" width="8" height="192" fill="#eee4ce" stroke="#8a7f6b"/>' +
      '<g stroke="#6f7430" stroke-width="1.5" opacity=".85">' +
      '<line x1="1500" y1="752" x2="1472" y2="766"/><line x1="1500" y1="752" x2="1528" y2="766"/></g>' +
      '</g>';

    /* ---------- 01 地质勘察 ---------- */
    s += '<g transform="translate(150,570)">' +
      '<path d="M-172 0V-56l30-16 26 20 14 26 6 26z" fill="#c8b28a" stroke="#3a352d" stroke-opacity=".25"/>' +
      '<g stroke="#a8916a" stroke-width="1" opacity=".8">' +
      '<line x1="-168" y1="-36" x2="-106" y2="-32"/><line x1="-168" y1="-20" x2="-100" y2="-14"/></g>' +
      '<polygon points="-96,0 -70,-42 -44,0" fill="#f6f0e2" stroke="#3a352d" stroke-opacity=".4"/>' +
      '<polygon points="-76,0 -70,-42 -62,0" fill="#3a352d" opacity=".16"/>' +
      '<g stroke="#3a352d" stroke-width="1.2">' +
      '<line x1="14" y1="0" x2="0" y2="-54"/><line x1="14" y1="0" x2="30" y2="-54"/>' +
      '<line x1="14" y1="0" x2="14" y2="-58"/></g>' +
      '<rect x="6" y="-68" width="16" height="10" rx="2" fill="#4a443a"/>' +
      '<circle cx="24" cy="-63" r="3" fill="#b8622f"/>' +
      '<g fill="#3a352d">' +
      '<circle cx="46" cy="-42" r="4.6"/>' +
      '<path d="M44 -37v15M44 -22l-6 22M44 -22l6 22M44 -32l11 9" stroke="#3a352d" stroke-width="2.4" fill="none"/></g>' +
      '<line x1="-112" y1="0" x2="-112" y2="-64" stroke="#3a352d" stroke-width="1.2"/>' +
      '<path d="M-112-64l22 6-22 7z" fill="#b8622f"/>' +
      '</g>';

    /* ---------- 02 物探 ---------- */
    s += '<g transform="translate(320,570)">' +
      '<rect x="-86" y="-9" width="56" height="9" rx="2" fill="#6b6255"/>' +
      '<rect x="-90" y="-26" width="82" height="10" fill="#8b8171"/>' +
      '<rect x="-84" y="-54" width="58" height="28" rx="4" fill="#f3ecdc" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-24" y="-50" width="34" height="24" rx="3" fill="#ece3cf" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-18" y="-46" width="20" height="12" rx="2" fill="#bfb39a"/>' +
      '<circle cx="-72" cy="-9" r="9" fill="#3a352d"/><circle cx="-34" cy="-9" r="9" fill="#3a352d"/>' +
      '<circle cx="-72" cy="-9" r="3" fill="#8a8377"/><circle cx="-34" cy="-9" r="3" fill="#8a8377"/>' +
      '<line x1="34" y1="0" x2="104" y2="0" stroke="#3a352d" stroke-width="1" opacity=".6"/>' +
      '<g stroke="#3a352d" stroke-width="1" fill="#b8622f">' +
      '<line x1="44" y1="0" x2="44" y2="-16"/><polygon points="44,-16 54,-12 44,-9"/>' +
      '<line x1="68" y1="0" x2="68" y2="-16"/><polygon points="68,-16 78,-12 68,-9"/>' +
      '<line x1="92" y1="0" x2="92" y2="-16"/><polygon points="92,-16 102,-12 92,-9"/></g>' +
      '<g stroke="#b8622f" stroke-width="1" fill="none" opacity=".4" stroke-dasharray="3 4">' +
      '<path d="M-30 8q30 34 60 0"/><path d="M-52 8q52 54 104 0"/><path d="M-74 8q74 74 148 0"/></g>' +
      '</g>';

    /* ---------- 03 钻井 ---------- */
    s += fmDerrick(470, 570, 182, 30, 11) +
      '<g transform="translate(470,570)">' +
      '<line x1="-6" y1="-202" x2="-6" y2="-176" stroke="#3a352d" stroke-width="1"/>' +
      '<rect x="-8" y="-176" width="16" height="16" rx="1" fill="#4a443a"/>' +
      '<ellipse cx="0" cy="-18" rx="15" ry="4" fill="#8b8171" stroke="#3a352d" stroke-opacity=".35"/>' +
      '<line x1="-36" y1="0" x2="-36" y2="-166" stroke="#4a443a" stroke-width="2.4" opacity=".8"/>' +
      '<path d="M-12-198c-14 4-22 16-24 32" stroke="#4a443a" stroke-width="3" fill="none"/>' +
      '<rect x="34" y="-14" width="54" height="5" rx="2" fill="#8b8171"/>' +
      '<rect x="34" y="-22" width="54" height="5" rx="2" fill="#a2957c"/>' +
      '</g>';

    /* ---------- 04 录井 ---------- */
    s += '<g transform="translate(625,570)">' +
      '<rect x="-58" y="-56" width="62" height="44" rx="3" fill="#f2ebda" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-58" y="-58" width="62" height="4" fill="#8b8171"/>' +
      '<rect x="-52" y="-48" width="20" height="14" rx="2" fill="#cbbfa5"/>' +
      '<rect x="-46" y="-45" width="12" height="8" rx="1" fill="#d8a33e" opacity=".85"/>' +
      '<line x1="8" y1="-58" x2="8" y2="-78" stroke="#3a352d" stroke-width="1.2"/>' +
      '<circle cx="8" cy="-79" r="2.4" fill="#b8622f"/>' +
      '<rect x="8" y="-32" width="44" height="18" rx="2" fill="#8b8171" stroke="#3a352d" stroke-opacity=".3"/>' +
      '<g stroke="#3a352d" stroke-width="1" opacity=".65">' +
      '<line x1="12" y1="-28" x2="48" y2="-28"/><line x1="12" y1="-24" x2="48" y2="-24"/>' +
      '<line x1="12" y1="-20" x2="48" y2="-20"/></g>' +
      '<path d="M52-32c10 4 12 12 8 20" stroke="#8a7f6b" stroke-width="3" fill="none" opacity=".7"/>' +
      '<rect x="-16" y="-14" width="46" height="4" rx="1" fill="#b9ad95"/>' +
      '<g fill="#b8622f" opacity=".8">' +
      '<rect x="-8" y="-22" width="5" height="8" rx="1"/><rect x="2" y="-22" width="5" height="8" rx="1"/>' +
      '<rect x="12" y="-22" width="5" height="8" rx="1"/></g>' +
      '</g>';

    /* ---------- 05 测井 ---------- */
    s += '<g transform="translate(745,570)">' +
      '<rect x="-62" y="-24" width="14" height="24" fill="#cfc6b6" stroke="#8b7a55" stroke-opacity=".5"/>' +
      '<rect x="-66" y="-32" width="22" height="9" rx="1" fill="#4a443a"/>' +
      '<circle cx="-55" cy="-27" r="3" fill="#b8622f"/>' +
      '<line x1="-52" y1="-32" x2="-52" y2="-88" stroke="#3a352d" stroke-width="1.2"/>' +
      '<circle cx="-52" cy="-90" r="5" fill="none" stroke="#3a352d" stroke-width="1.2"/>' +
      '<rect x="-8" y="-18" width="88" height="10" fill="#8b8171"/>' +
      '<rect x="-4" y="-52" width="64" height="34" rx="3" fill="#f3ecdc" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="58" y="-46" width="30" height="30" rx="3" fill="#ece3cf" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="64" y="-42" width="16" height="12" rx="2" fill="#bfb39a"/>' +
      '<circle cx="12" cy="-36" r="10" fill="#4a443a"/><circle cx="12" cy="-36" r="3" fill="#b8622f"/>' +
      '<circle cx="14" cy="-8" r="9" fill="#3a352d"/><circle cx="74" cy="-8" r="9" fill="#3a352d"/>' +
      '<path d="M12-46C-10-78-30-92-52-90" stroke="#3a352d" stroke-width="1" fill="none"/>' +
      '<line x1="-52" y1="-90" x2="-52" y2="-34" stroke="#3a352d" stroke-width="1"/>' +
      '</g>';

    /* ---------- 06 固井 ---------- */
    s += '<g transform="translate(875,570)">' +
      '<rect x="-72" y="-110" width="40" height="66" rx="3" fill="#f1e9d8" stroke="#3a352d" stroke-opacity=".35"/>' +
      '<polygon points="-72,-44 -32,-44 -40,0 -64,0" fill="#e6dcc6" stroke="#3a352d" stroke-opacity=".3"/>' +
      '<line x1="-64" y1="-6" x2="-64" y2="0" stroke="#8b7a55" stroke-width="2"/>' +
      '<line x1="-40" y1="-6" x2="-40" y2="0" stroke="#8b7a55" stroke-width="2"/>' +
      '<g stroke="#a2957c" stroke-width="1"><line x1="-52" y1="-108" x2="-52" y2="-46"/>' +
      '<line x1="-56" y1="-104" x2="-48" y2="-104"/><line x1="-56" y1="-88" x2="-48" y2="-88"/>' +
      '<line x1="-56" y1="-72" x2="-48" y2="-72"/></g>' +
      '<rect x="-66" y="-116" width="32" height="6" rx="2" fill="#b9ad95"/>' +
      '<rect x="-6" y="-18" width="88" height="10" fill="#8b8171"/>' +
      '<rect x="-2" y="-50" width="50" height="32" rx="3" fill="#f3ecdc" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="10" y="-42" width="26" height="18" rx="2" fill="#4a443a"/>' +
      '<circle cx="23" cy="-33" r="6" fill="#8a8377"/>' +
      '<rect x="50" y="-44" width="32" height="28" rx="3" fill="#ece3cf" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="56" y="-40" width="16" height="12" rx="2" fill="#bfb39a"/>' +
      '<circle cx="8" cy="-8" r="9" fill="#3a352d"/><circle cx="72" cy="-8" r="9" fill="#3a352d"/>' +
      '<path d="M82-28h40" stroke="#8a7f6b" stroke-width="4" opacity=".8"/>' +
      '</g>';

    /* ---------- 07 完井（主线，带光圈） ---------- */
    s += '<g transform="translate(1000,570)">' +
      '<ellipse cx="0" cy="-2" rx="58" ry="9" fill="#b8622f" opacity=".16"/>' +
      '<rect x="-40" y="-5" width="80" height="5" rx="2" fill="#b9ad95"/>' +
      '<rect x="-16" y="-26" width="32" height="26" fill="#cfc6b6" stroke="#3a352d" stroke-opacity=".45"/>' +
      '<rect x="-13" y="-44" width="26" height="18" rx="2" fill="#4a443a"/>' +
      '<rect x="-9" y="-60" width="18" height="16" rx="2" fill="#4a443a"/>' +
      '<rect x="-18" y="-58" width="36" height="5" rx="2" fill="#b8622f"/>' +
      '<circle cx="18" cy="-46" r="7" fill="none" stroke="#4a443a" stroke-width="2"/>' +
      '<line x1="18" y1="-46" x2="22" y2="-50" stroke="#4a443a" stroke-width="1.6"/>' +
      '<path d="M18-40h34" stroke="#8a7f6b" stroke-width="4" opacity=".8"/>' +
      '<circle cx="0" cy="-72" r="6" fill="none" stroke="#4a443a" stroke-width="2"/>' +
      '<line x1="0" y1="-66" x2="0" y2="-60" stroke="#4a443a" stroke-width="2"/>' +
      '</g>';

    /* ---------- 08 射孔 ---------- */
    s += '<g transform="translate(1130,570)">' +
      '<rect x="-70" y="-18" width="86" height="10" fill="#8b8171"/>' +
      '<rect x="-66" y="-50" width="56" height="32" rx="3" fill="#f3ecdc" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-8" y="-46" width="32" height="28" rx="3" fill="#ece3cf" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-2" y="-42" width="18" height="12" rx="2" fill="#bfb39a"/>' +
      '<circle cx="-52" cy="-38" r="9" fill="#4a443a"/><circle cx="-52" cy="-38" r="3" fill="#b8622f"/>' +
      '<circle cx="-58" cy="-8" r="9" fill="#3a352d"/><circle cx="10" cy="-8" r="9" fill="#3a352d"/>' +
      '<line x1="-18" y1="-50" x2="-18" y2="-96" stroke="#3a352d" stroke-width="1.4"/>' +
      '<circle cx="-18" cy="-98" r="5" fill="none" stroke="#3a352d" stroke-width="1.2"/>' +
      '<path d="M-42-47L-18-98" stroke="#3a352d" stroke-width="1" fill="none"/>' +
      '<line x1="-18" y1="-98" x2="-18" y2="-28" stroke="#3a352d" stroke-width="1"/>' +
      '<rect x="-26" y="-28" width="16" height="28" fill="#4a443a"/>' +
      '<rect x="-30" y="-34" width="24" height="8" rx="2" fill="#b8622f"/>' +
      '</g>';

    /* ---------- 09 采油 ---------- */
    s += '<g transform="translate(1250,570)">' +
      '<rect x="-52" y="-7" width="112" height="7" rx="2" fill="#b9ad95"/>' +
      '<g stroke="#3a352d" stroke-width="2" fill="none">' +
      '<path d="M-20-7L8-86M34-7L8-86"/></g>' +
      '<path d="M-58-106L46-92" stroke="#4a443a" stroke-width="7"/>' +
      '<path d="M-58-106a24 24 0 0 0 0 46" stroke="#4a443a" stroke-width="9" fill="none"/>' +
      '<line x1="-58" y1="-62" x2="-58" y2="-30" stroke="#3a352d" stroke-width="1.6"/>' +
      '<line x1="-66" y1="-62" x2="-58" y2="-30" stroke="#3a352d" stroke-width="1"/>' +
      '<rect x="-66" y="-22" width="16" height="22" fill="#cfc6b6" stroke="#8b7a55" stroke-opacity=".5"/>' +
      '<rect x="-70" y="-29" width="24" height="8" rx="2" fill="#4a443a"/>' +
      '<circle cx="42" cy="-97" r="16" fill="#4a443a"/>' +
      '<path d="M42-97a16 16 0 0 1 0 16z" fill="#97571a" opacity=".65"/>' +
      '<rect x="6" y="-60" width="28" height="20" rx="2" fill="#8b8171"/>' +
      '<circle cx="20" cy="-50" r="4" fill="#4a443a"/>' +
      '<rect x="30" y="-30" width="26" height="14" rx="2" fill="#8b8171"/>' +
      '</g>';

    /* ---------- 10 修井 ---------- */
    s += fmDerrick(1380, 570, 132, 22, 9) +
      '<g transform="translate(1380,570)">' +
      '<rect x="-102" y="-18" width="62" height="10" fill="#8b8171"/>' +
      '<rect x="-98" y="-44" width="46" height="28" rx="3" fill="#f3ecdc" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-106" y="-42" width="24" height="28" rx="3" fill="#ece3cf" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-100" y="-38" width="13" height="11" rx="2" fill="#bfb39a"/>' +
      '<circle cx="-84" cy="-8" r="9" fill="#3a352d"/><circle cx="-52" cy="-8" r="9" fill="#3a352d"/>' +
      '<line x1="0" y1="-150" x2="0" y2="-30" stroke="#3a352d" stroke-width="1.2"/>' +
      '<rect x="-8" y="-30" width="16" height="30" fill="#4a443a"/>' +
      '<rect x="-12" y="-37" width="24" height="8" rx="2" fill="#4a443a"/>' +
      '</g>';

    /* ---------- 11 增采 ---------- */
    s += '<g transform="translate(1500,570)">' +
      '<rect x="-80" y="-56" width="48" height="22" rx="4" fill="#f0e8d6" stroke="#3a352d" stroke-opacity=".35"/>' +
      '<rect x="-80" y="-86" width="48" height="22" rx="4" fill="#f5eee0" stroke="#3a352d" stroke-opacity=".35"/>' +
      '<g stroke="#8b7a55" stroke-width="2"><line x1="-72" y1="-34" x2="-72" y2="-6"/>' +
      '<line x1="-42" y1="-34" x2="-42" y2="-6"/><line x1="-72" y1="-64" x2="-72" y2="-56"/></g>' +
      '<path d="M-70-86c-6-10 6-18 0-28M-48-88c-6-10 6-18 0-28" stroke="#fffaf0" stroke-width="3" fill="none" opacity=".45"/>' +
      '<rect x="-20" y="-28" width="36" height="22" rx="3" fill="#8b8171"/>' +
      '<circle cx="-6" cy="-40" r="8" fill="#6f7430"/>' +
      '<path d="M-8-56h56" stroke="#8a7f6b" stroke-width="3"/>' +
      '<path d="M48-56v34" stroke="#8a7f6b" stroke-width="3"/>' +
      '<rect x="44" y="-26" width="16" height="26" fill="#4a443a"/>' +
      '<rect x="40" y="-34" width="24" height="9" rx="2" fill="#6f7430"/>' +
      '</g>';

    /* ---------- 12 运输 ---------- */
    s += '<g transform="translate(1620,570)">' +
      '<rect x="-64" y="-54" width="76" height="24" rx="11" fill="#e8dfcb" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="-64" y="-46" width="76" height="3" fill="#b9ad95" opacity=".7"/>' +
      '<rect x="16" y="-48" width="32" height="28" rx="3" fill="#f3ecdc" stroke="#3a352d" stroke-opacity=".38"/>' +
      '<rect x="22" y="-44" width="17" height="12" rx="2" fill="#bfb39a"/>' +
      '<circle cx="-46" cy="-10" r="9" fill="#3a352d"/><circle cx="-6" cy="-10" r="9" fill="#3a352d"/>' +
      '<circle cx="34" cy="-10" r="9" fill="#3a352d"/>' +
      '<circle cx="98" cy="-17" r="7" fill="none" stroke="#b8622f" stroke-width="2"/>' +
      '<path d="M98-24v14" stroke="#b8622f" stroke-width="2"/>' +
      '</g>';

    /* ---------- 13 加工 ---------- */
    s += '<g opacity=".95">' +
      '<rect x="1712" y="392" width="44" height="178" rx="4" fill="#cfc3ac" stroke="#8a7f6b"/>' +
      '<ellipse cx="1734" cy="392" rx="22" ry="7" fill="#ddd2ba" stroke="#8a7f6b"/>' +
      '<rect x="1770" y="360" width="36" height="210" rx="4" fill="#d5cab4" stroke="#8a7f6b"/>' +
      '<ellipse cx="1788" cy="360" rx="18" ry="6" fill="#e1d7c0" stroke="#8a7f6b"/>' +
      '<rect x="1822" y="430" width="28" height="140" rx="3" fill="#cfc3ac" stroke="#8a7f6b"/>' +
      '<g stroke="#8a7f6b" stroke-width="1" opacity=".8">' +
      '<line x1="1700" y1="470" x2="1860" y2="470"/><line x1="1700" y1="512" x2="1860" y2="512"/></g>' +
      '<circle cx="1888" cy="524" r="30" fill="#e2d8c2" stroke="#8a7f6b"/>' +
      '<path d="M1858 524h60" stroke="#8a7f6b" stroke-width="1"/>' +
      '<rect x="1928" y="466" width="42" height="104" rx="3" fill="#e2d8c2" stroke="#8a7f6b"/>' +
      '<ellipse cx="1949" cy="466" rx="21" ry="7" fill="#efe7d3" stroke="#8a7f6b"/>' +
      '<line x1="1986" y1="570" x2="1986" y2="352" stroke="#8a7f6b" stroke-width="4"/>' +
      '<path d="M1986 352c-8-10-6-22 0-30 6 8 8 20 0 30z" fill="#d8a33e" opacity=".9"/>' +
      '<path d="M1700 556h296" stroke="#8a7f6b" stroke-width="3" opacity=".7"/>' +
      '<g fill="#d8a33e" opacity=".75">' +
      '<circle cx="1724" cy="418" r="2"/><circle cx="1724" cy="452" r="2"/><circle cx="1782" cy="392" r="2"/>' +
      '<circle cx="1794" cy="440" r="2"/><circle cx="1949" cy="520" r="2"/></g>' +
      '</g>';

    /* 设备落影 + 统一放大：给每个设备组补一片贴地阴影，
       并按基础点放大到 1.3 倍，让设备在全景里占住分量。 */
    s = s.replace(/<g transform="translate\((\d+),570\)">/g, function (m, x) {
      return '<g transform="translate(' + x + ',570) scale(1.3)">' +
        '<ellipse cx="-14" cy="-2" rx="56" ry="8" fill="#3a2a12" opacity=".13"/>';
    });

    return s;
  }

  /* 13 个标注：编号钉在设备上，名称牌按设备高度上下错落并由引线相连。
     13 个环节一律同款样式，不做任何突出。 */
  function fmPins() {
    return A.stages.map(function (st) {
      var a = FM_ANCHOR[st.id] || { x: 100, y: 500, lx: 100, ly: 400 };
      var w = st.name.length * 24 + 30;
      var px = a.lx - w / 2;
      var py = a.ly;
      var pyb = py + 40;
      return '<a class="of-pin" href="#/stage/' + st.id + '"' +
        ' aria-label="第 ' + pad(st.idx) + ' 环节 ' + esc(st.name) + '，' + st.scenes.length + ' 个场景">' +
        '<title>' + esc(st.name) + ' · ' + st.scenes.length + ' 个场景，点击进入清单</title>' +
        '<path class="pin-lead" d="M' + a.lx + ' ' + pyb + 'L' + a.x + ' ' + (a.y - 13) + '"/>' +
        '<rect class="pin-pill" x="' + px + '" y="' + py + '" width="' + w + '" height="40" rx="6"/>' +
        '<text class="pin-t" x="' + (px + 15) + '" y="' + (py + 28) + '">' +
        '<tspan class="pin-n">' + esc(st.name) + '</tspan>' +
        '</text>' +
        '<circle class="pin-halo" cx="' + a.x + '" cy="' + a.y + '" r="22"/>' +
        '<circle class="pin-pin" cx="' + a.x + '" cy="' + a.y + '" r="14"/>' +
        '<text class="pin-num" x="' + a.x + '" y="' + (a.y + 5) + '">' + pad(st.idx) + '</text>' +
        '</a>';
    }).join('');
  }

  function homeFieldMap() {
    return '<div class="of-frame"><div class="of-scroll"><div class="of-scene">' +
      '<svg class="of-svg" viewBox="0 0 2000 860" aria-label="石油勘探开发 13 个环节的油田场景地图">' +
      fmDefs() + fmScene() + fmPins() + '</svg>' +
      '</div></div>' +
      '<div class="of-foot"><span>地表按作业顺序排开 13 个环节 · 地下是井筒与储层剖面 —— ' +
      '点击编号进入该环节的 <b>场景清单</b></span>' +
      '<span class="of-swipe">← 左右滑动查看整条作业链 →</span></div>' +
      '</div>';
  }

  function homeHTML() {
    var total = A.allScenes.length;
    var st = A.stats();
    var cs = Cases.stats();
    var mkeys = Object.keys(A.methods);
    var mc = {};
    mkeys.forEach(function (k) { mc[k] = 0; });
    A.allScenes.forEach(function (sc) {
      (sc.methods || []).forEach(function (k) { mc[k] = (mc[k] || 0) + 1; });
    });
    var MCC = { cv: '#a89a84', ts: '#cf813c', nlp: '#a07fb4', opt: '#b9616f', kg: '#a3a95a' };
    var dLow = st.diff['低'] || 0, dMid = st.diff['中'] || 0, dHigh = st.diff['高'] || 0;
    var coverPct = total ? Math.round(cs.coveredScenes / total * 100) : 0;
    var msum = mkeys.reduce(function (a, k) { return a + (mc[k] || 0); }, 0);
    var mseg = mkeys.map(function (k) {
      return '<i style="width:' + (msum ? mc[k] / msum * 100 : 0) + '%;background:' + (MCC[k] || '#8b6bb3') + '"></i>';
    }).join('');
    var mleg = mkeys.map(function (k) {
      return '<div class="gl-li"><i style="background:' + (MCC[k] || '#8b6bb3') + '"></i>' +
        '<span class="gl-la">' + esc((A.methods[k] || {}).abbr || k) + '</span>' +
        '<span class="gl-ln">' + mc[k] + '</span></div>';
    }).join('');

    return '<main>' +
      /* ---------- Hero（深色主视觉） ---------- */
      '<section class="home-hero">' +
      '<div class="wrap hh-in">' +
      '<div class="hh-copy">' +
      '<span class="hh-kicker"><i></i>PETRO × AI ATLAS<span class="sep">/</span>07 COMPLETION</span>' +
      '<h1>石油勘探开发的<em>智能化</em>案例实验平台</h1>' +
      '<p class="hh-lead">把 13 个作业环节拆成 ' + total + ' 个可判断的智能化场景；完井段落 4 个必做案例，加上 11 个跨环节扩展（覆盖其余 9 个环节），共 15 个案例都配有能在浏览器里直接调参、看结果、读风险的示范。不展示结论，而是把结论的生成过程摊开给你。</p>' +
      '<div class="hh-points">' +
      '<span><i></i>13 环节 · ' + total + ' 场景</span>' +
      '<span><i></i>5 类方法交叉索引</span>' +
      '<span><i></i>' + ownedCaseCount() + ' 个可运行示范</span>' +
      '<span><i></i>纯前端 · 离线可用</span>' +
      '</div>' +
      '<div class="hh-acts">' +
      '<a class="btn primary" href="#/chain">进入平台 <span class="ar">→</span></a>' +
      '<a class="btn ghost" href="#/project">项目说明</a>' +
      '</div>' +
      '<div class="hh-note"><p><b>数据声明：</b>本站所有曲线、指标与结论均由前端合成数据生成，用于教学与方法演示，不代表任何真实井的产能、受力或风险判断。案例包可离线运行，不依赖后端与外部接口。</p></div>' +
      '</div>' +
      /* ---------- 右侧速览面板 ---------- */
      '<aside class="hh-glance" aria-label="平台速览">' +
      '<div class="gl-head"><span class="gl-kicker">AT A GLANCE · 速览</span><span class="gl-ver">v2.0</span></div>' +
      '<div class="gl-rows">' +
      '<div class="gl-row"><span class="gl-l">作业环节</span><span class="gl-n">' + A.stages.length + '<i>↑</i></span></div>' +
      '<div class="gl-row"><span class="gl-l">候选场景</span><span class="gl-n">' + total + '<i>↑</i></span></div>' +
      '<div class="gl-row gl-stack"><div class="gl-two"><span class="gl-l">难度分布（低/中/高）</span>' +
      '<span class="gl-n sm">' + dLow + '<em> / </em>' + dMid + '<em> / </em>' + dHigh + '</span></div>' +
      '<div class="gl-track"><i style="width:' + (dLow / total * 100) + '%;background:#6f9e83"></i>' +
      '<i style="width:' + (dMid / total * 100) + '%;background:#cf813c"></i>' +
      '<i style="width:' + (dHigh / total * 100) + '%;background:#b5618a"></i></div></div>' +
      '<div class="gl-row"><span class="gl-l">已接入案例</span><span class="gl-n">' + cs.registered + '<i>↑</i></span></div>' +
      '<div class="gl-row"><span class="gl-l">其中可运行示范</span><span class="gl-n">' + cs.withDemo + '<i>↑</i></span></div>' +
      '<div class="gl-row gl-stack"><div class="gl-two"><span class="gl-l">案例覆盖场景</span>' +
      '<span class="gl-n sm">' + cs.coveredScenes + '<em> / ' + total + ' · ' + coverPct + '%</em></span></div>' +
      '<div class="gl-track thin"><i style="width:' + coverPct + '%;background:#d98a45"></i></div></div>' +
      '</div>' +
      '<div class="gl-method">' +
      '<div class="gl-mhead">方法构成 <em>/</em> BY METHOD</div>' +
      '<div class="gl-track method">' + mseg + '</div>' +
      '<div class="gl-legend">' + mleg + '</div>' +
      '</div>' +
      '<div class="gl-foot"><span>数据截至 ' + esc((A.meta || {}).updated || '2026-10') + '</span><span>教学用途</span></div>' +
      '</aside>' +
      '</div>' +
      '</section>' +
      '</main>';
  }

  /* =========================================================
     四、项目说明页
     ========================================================= */
  function projectHTML() {
    var proj = A.project || {};
    var reqIds = proj.requiredIds || [], extIds = proj.extensionIds || [];
    var cases = ownedCases();
    var cs = Cases.stats();
    var s = A.stats();

    var rows = reqIds.concat(extIds).map(function (id, i) {
      var c = Cases.get(id);
      var sc = c && A.index.byScene[c.sceneId];
      return '<tr><td class="id">' + esc(String(sc ? sc.id : id).toUpperCase()) + '</td>' +
        '<td><div class="nm">' + esc(c ? c.title : id) + '</div>' +
        (sc ? '<div class="sc">' + esc(sc.stageName) + ' / ' + esc(sc.name) + '</div>' : '') + '</td>' +
        '<td>' + (i < reqIds.length ? '<span class="tag">必做</span>' : '<span class="tag">扩展</span>') + '</td>' +
        '<td>' + (sc ? K.dtag(sc.diff) : '—') + '</td>' +
        '<td>' + (c ? '<span class="ok-mark">✓ 已交付</span>' : '<span class="bad-mark">✕ 缺失</span>') + '</td>' +
        '<td>' + (sc ? '<a class="btn sm ghost" href="#/scene/' + esc(sc.id) + '?tab=demo">打开 →</a>' : '—') + '</td></tr>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/project', '项目说明']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">PROJECT · 学号尾号 07 · 完井</div>' +
      '<h1>从选方式到控滑套：完井段落的四个决策点<span class="en">Completion Intelligence</span></h1>' +
      '<p class="blurb">本平台以石油作业链第 07 环节「完井」为主线，交付 4 个必做案例；再以压裂优化、产量预测与 9 个跨环节案例作为扩展，验证同一套案例结构能否覆盖整条作业链。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + cases.length + '</div><div class="l">可运行案例</div></div>' +
      '<div><div class="n">' + (reqIds.length + extIds.length) + '</div><div class="l">交付总数</div></div>' +
      '<div><div class="n">' + s.total + '</div><div class="l">候选场景</div></div>' +
      '</div></div></div>' +

      '<div class="project-grid">' +
      '<div class="project-card"><h3>项目定位</h3>' +
      '<p>学号尾号 <b>07</b> 对应作业链第 07 环节 <b>完井</b>。这个环节的共性是：决策对象是“下什么、怎么下、下了以后怎么调”，每一步都有明确的工程约束，但约束之间互相冲突。</p>' +
      '<p>平台不替工程师做决定，而是把冲突摆到同一张图上：方案排序随权重怎么变、射孔产能与风险如何取舍、管柱在哪个井深先超限、滑套策略每天怎么滚动修正。</p>' +
      '<ul>' +
      '<li><b>co1 完井方式智能优选</b>：五方案 × 五指标 TOPSIS 排序，权重实时可调。</li>' +
      '<li><b>co2 射孔参数智能设计</b>：孔密、相位、孔径、段长联动，产能与风险双图。</li>' +
      '<li><b>co3 完井管柱受力智能分析</b>：沿井深计算钩载与安全系数，定位超限段。</li>' +
      '<li><b>co4 智能完井滑套控制策略</b>：三层滑套 30 天滚动优化，AI 与固定策略逐日对比。</li>' +
      '</ul></div>' +

      '<div class="project-card"><h3>交付范围</h3>' +
      '<p>必做 4 个案例全部完成；扩展 11 个案例覆盖其余作业环节（含增采与采油），用来检验案例结构、图表组件与构建流程的复用性。</p>' +
      '<div class="project-ver">' +
      '<div><span>必做案例</span><b>' + reqIds.filter(function (id) { return !!Cases.get(id); }).length + ' / ' + reqIds.length + '</b></div>' +
      '<div><span>扩展案例</span><b>' + extIds.filter(function (id) { return !!Cases.get(id); }).length + ' / ' + extIds.length + '</b></div>' +
      '<div><span>可运行示范</span><b>' + cases.length + ' / ' + (reqIds.length + extIds.length) + '</b></div>' +
      '<div><span>案例包构建</span><b>通过</b></div>' +
      '<div><span>纯前端离线</span><b>是</b></div>' +
      '<div><span>数据性质</span><b>合成</b></div>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<a class="btn primary sm" href="#/stage/' + esc(proj.stageId || 'completion') + '">进入完井环节 →</a>' +
      '<a class="btn sm ghost" href="#/cases">案例库</a>' +
      '</div></div>' +
      '</div>' +

      '<div class="section tight"><div class="sec-head">' +
      '<div class="sec-rail"><span class="sec-num">01</span><span class="kicker">TASK MAP</span></div>' +
      '<h2>学号 07 → ' + (reqIds.length + extIds.length) + ' 个案例</h2>' +
      '<p>前四行是必做任务，其余为跨环节扩展。每行都能直接打开对应示范。</p></div>' +
      '<div class="matrix-wrap"><table class="sys-table"><thead><tr>' +
      '<th>编号</th><th>案例 / 场景</th><th>类型</th><th>难度</th><th>状态</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div></div>' +

      '<div class="section tight"><div class="sec-head">' +
      '<div class="sec-rail"><span class="sec-num">02</span><span class="kicker">DELIVERY</span></div>' +
      '<h2>交付物与验证</h2>' +
      '<p>站点、案例包与压缩包三者内容一致；任何一份案例包都能脱离站点单独打开。</p></div>' +
      '<div class="project-grid">' +
      '<div class="project-card"><h3>案例包结构</h3>' +
      K.tree([
        '<b>每个案例包</b>',
        '├── case.json          <span class="cm">清单：场景、三 Tab、元信息</span>',
        '└── demo/',
        '    ├── index.html     <span class="cm">可独立打开的示范页</span>',
        '    ├── demo.css       <span class="cm">共享示范样式</span>',
        '    ├── demo.js        <span class="cm">参数、模型与图表</span>',
        '    └── d3.v7.min.js   <span class="cm">本地 D3，不依赖 CDN</span>'
      ]) +
      '<p style="margin-top:9px">构建脚本 <b>tools/build-cases.js</b> 会把共享样式与 D3 复制进每个包，并生成站点插件注册器；打包脚本输出 6 个 zip。</p></div>' +

      '<div class="project-card"><h3>已验证项</h3><ul>' +
      '<li>六个案例包构建与 <b>demo.js</b> 语法检查通过。</li>' +
      '<li>站点挂载、参数滑块、AI 按钮与图表重绘端到端通过。</li>' +
      '<li>上传旧包与刷新恢复通过（localStorage）。</li>' +
      '<li>六个压缩包内容与源文件 SHA-256 一致。</li>' +
      '<li>原有测井分层案例与上传机制未被破坏。</li>' +
      '</ul>' +
      '<p style="margin-top:9px;color:var(--ink-4)">上述验证针对合成数据下的功能路径，不代表真实井的工程结论。</p></div>' +
      '</div></div>' +

      '<div class="section tight"><div class="sec-head">' +
      '<div class="sec-rail"><span class="sec-num">03</span><span class="kicker">METHOD</span></div>' +
      '<h2>技术路线</h2>' +
      '<p>全部为浏览器端计算：机理公式 + 轻量代理模型 + D3 可视化，没有后端与外部接口。</p></div>' +
      '<div class="project-grid">' +
      '<div class="project-card"><h3>案例内部</h3><ul>' +
      '<li><b>参数层</b>：每个案例至少 3 个可调参数，统一由滑块/下拉驱动。</li>' +
      '<li><b>模型层</b>：TOPSIS、产能指数、管柱受力、滚动优化、递减 + 注水响应等。</li>' +
      '<li><b>图表层</b>：每个案例至少 2 张 D3 图，包含主图与风险/对比图。</li>' +
      '<li><b>解释层</b>：智能输出、风险指标、置信度、前后对比与结果解释。</li>' +
      '</ul></div>' +
      '<div class="project-card"><h3>平台侧</h3><ul>' +
      '<li>哈希路由 + 案例插件注册表：新增案例不改外壳。</li>' +
      '<li>统一案例详情：头部、判断卡、决策链、可信度与结论边界。</li>' +
      '<li>全局搜索：把 61 个场景与 ' + cases.length + ' 个案例放在同一检索面。</li>' +
      '<li>本地 D3 组件层：作业链、方法分布、热力、等高线、区间带。</li>' +
      '</ul></div>' +
      '</div></div>' +
      '</main>';
  }

  /* =========================================================
     六、链条总览页
     ========================================================= */
  function chainHTML() {
    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/chain', '作业链']]) +
      homeFieldMap() + '</main>';
  }

  /* =========================================================
     五、环节页
     ========================================================= */
  function stageHTML(st, q) {
    var counts = {};
    st.scenes.forEach(function (s) { counts[s.diff] = (counts[s.diff] || 0) + 1; });
    var mFilter = q.m || '';
    var dFilter = q.d || '';

    var methodKeys = Object.keys(M).filter(function (k) {
      return st.scenes.some(function (s) { return s.methods.indexOf(k) >= 0; });
    });
    var methBtns = ['<button class="chip' + (mFilter ? '' : ' on') + '" data-f="m" data-v="">全部方法</button>'].concat(
      methodKeys.map(function (k) {
        return '<button class="chip' + (mFilter === k ? ' on' : '') + '" data-f="m" data-v="' + k + '" data-m="' + k + '">' + M[k].abbr + ' ' + esc(M[k].name) + '</button>';
      })).join('');

    var diffBtns = ['<button class="chip' + (dFilter ? '' : ' on') + '" data-f="d" data-v="">全部难度</button>'].concat(
      ['低', '中', '高'].map(function (d) {
        return '<button class="chip' + (dFilter === d ? ' on' : '') + '" data-f="d" data-v="' + d + '">' + d + '</button>';
      })).join('');

    var list = st.scenes.map(function (sc) {
      var cn = Cases.bySceneAll(sc.id).length;
      return '<a class="scene-row' + (sc.status === 'ext' ? ' is-ext' : '') + '" href="#/scene/' + sc.id + '" data-m="' + sc.methods.join(' ') + '" data-d="' + sc.diff + '">' +
        '<div class="sr-n">' + esc(sc.id.toUpperCase()) + '</div>' +
        '<div><div class="sr-name">' + esc(sc.name) +
        (cn ? '<span class="badge-ready">已接入案例' + (cn > 1 ? ' ×' + cn : '') + '</span>' : '') +
        '<span class="arrow">→</span></div>' +
        '<div class="sr-point">' + esc(sc.point) + '</div>' +
        '<div class="sr-meta">' + sc.methods.map(function (k) {
          var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
          return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
        }).join('') + '</div></div>' +
        '<div class="sr-right"><span class="dtag" data-d="' + sc.diff + '">难度 ' + sc.diff + '</span>' +
        (sc.demo ? '<span class="badge-wip" style="border-style:solid;color:var(--jade-d);background:var(--jade-l);border-color:rgba(58,53,45,.2)">可运行</span>' : '') +
        '</div></a>';
    }).join('');

    var idx = A.stages.indexOf(st);
    var prev = A.stages[idx - 1], next = A.stages[idx + 1];

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/chain', '作业链'], ['#/stage/' + st.id, st.name]]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">' + pad(st.idx) + ' / ' + pad(A.stages.length) + '</div>' +
      '<h1>' + esc(st.name) + '环节的可智能化场景<span class="en">' + esc(st.en) + '</span></h1>' +
      '<p class="blurb">' + esc(st.blurb) + '</p></div>' +
      '<div class="ph-stat">' +
      '<div><div class="n">' + st.scenes.length + '</div><div class="l">场景</div></div>' +
      '<div><div class="n">' + (counts.低 || 0) + '</div><div class="l">低难度</div></div>' +
      '<div><div class="n">' + (counts.高 || 0) + '</div><div class="l">高难度</div></div>' +
      '</div></div></div>' +

      '<div class="filters"><span class="lbl">方法</span>' + methBtns +
      '<span class="divider"></span><span class="lbl">难度</span>' + diffBtns +
      '<span class="count" id="f-count">' + st.scenes.length + ' 个场景</span></div>' +
      '<div class="scenes" id="scene-list">' + list + '</div>' +
      '<div class="pager">' +
      (prev ? '<a href="#/stage/' + prev.id + '" class="prev"><span class="dir">← 上一环节</span><span class="nm">' + pad(prev.idx) + ' ' + esc(prev.name) + '</span></a>' : '') +
      (next ? '<a href="#/stage/' + next.id + '" class="next"><span class="dir">下一环节 →</span><span class="nm">' + pad(next.idx) + ' ' + esc(next.name) + '</span></a>' : '') +
      '</div></main>';
  }

  function bindFilters(root) {
    var listEl = root.querySelector('#scene-list');
    if (!listEl) return;
    var st = { m: '', d: '' };
    var chips = root.querySelectorAll('.filters .chip');
    [].forEach.call(chips, function (c) {
      if (c.classList.contains('on')) st[c.dataset.f] = c.dataset.v;
    });

    function apply() {
      var n = 0;
      [].forEach.call(listEl.children, function (row) {
        var ms = (row.dataset.m || '').split(' ');
        var okM = !st.m || ms.indexOf(st.m) >= 0;
        var okD = !st.d || row.dataset.d === st.d;
        var show = okM && okD;
        row.style.display = show ? '' : 'none';
        if (show) n++;
      });
      var cnt = root.querySelector('#f-count');
      if (cnt) cnt.textContent = n + ' 个场景';
      if (!n) {
        if (!listEl.querySelector('.filter-empty')) {
          var d = document.createElement('div');
          d.className = 'empty filter-empty';
          d.innerHTML = '<b>没有符合条件的场景</b>换个筛选条件试试。';
          listEl.appendChild(d);
        }
      } else {
        var e = listEl.querySelector('.filter-empty');
        if (e) e.remove();
      }
    }

    [].forEach.call(chips, function (c) {
      c.addEventListener('click', function () {
        var f = c.dataset.f;
        st[f] = c.dataset.v;
        [].forEach.call(chips, function (x) {
          if (x.dataset.f === f) x.classList.toggle('on', x === c);
        });
        apply();
        var hash = '#/stage/' + parseHash().parts[1] + (st.m ? '?m=' + st.m + (st.d ? '&d=' + st.d : '') : (st.d ? '?d=' + st.d : ''));
        setHashQuiet(hash);
      });
    });
    apply();
  }

  /* =========================================================
     六、方法反查页
     ========================================================= */
  function methodHTML(key) {
    if (!M[key]) return '<main class="wrap"><div class="empty"><b>没有这个方法类别</b></div></main>';
    var all = A.index.byMethod[key] || [];
    var hitStages = A.stages.filter(function (st) {
      return st.scenes.some(function (s) { return s.methods.indexOf(key) >= 0; });
    });
    var mc = (global.IQViz && global.IQViz.methodColor(key)) || 'var(--jade)';
    var relCases = ownedCases().filter(function (c) {
      var sc = A.index.byScene[c.sceneId];
      var ms = (c.methods && c.methods.length ? c.methods : (sc && sc.methods) || []);
      return ms.indexOf(key) >= 0;
    });
    var groups = hitStages.map(function (st) {
      var rows = st.scenes.filter(function (s) { return s.methods.indexOf(key) >= 0; }).map(function (sc) {
        var c = Cases.byScene(sc.id);
        return '<a class="mrow" href="#/scene/' + sc.id + '">' +
          '<div><div class="nm">' + esc(sc.name) + (c ? '<span class="badge-ready">案例</span>' : '') + '</div>' +
          '<div class="pt">' + esc(sc.point) + '</div></div>' +
          '<div class="rt"><span class="dtag" data-d="' + sc.diff + '">' + sc.diff + '</span><span class="mono" style="font-size:10px;color:var(--ink-4)">→</span></div></a>';
      }).join('');
      return '<div class="method-group"><div class="mg-head">' +
        '<span class="idx">' + pad(st.idx) + '</span><h3>' + esc(st.name) + '</h3>' +
        '<span class="cnt">' + st.scenes.filter(function (s) { return s.methods.indexOf(key) >= 0; }).length + ' 个</span></div>' +
        '<div class="mg-list">' + rows + '</div></div>';
    }).join('');

    var counts = hitStages.map(function (st) {
      return { st: st, n: st.scenes.filter(function (s) { return s.methods.indexOf(key) >= 0; }).length };
    });
    var totalN = counts.reduce(function (a, x) { return a + x.n; }, 0) || 1;
    var distBar = counts.map(function (x, i) {
      var op = 0.92 - i * 0.022;   /* 只做轻微深浅变化，保证末段文字仍然清楚 */
      return '<a class="md-seg" href="#/stage/' + x.st.id + '" style="flex:' + x.n + ';background:' + mc + ';opacity:' + op.toFixed(2) + '"' +
        ' title="' + esc(x.st.name) + ' · ' + x.n + ' 个场景"><span>' + pad(x.st.idx) + '</span><b>' + x.n + '</b></a>';
    }).join('');
    var relList = relCases.map(function (c) {
      var spec = caseSpec(c);
      var cred = c.credibility || {};
      return '<a class="m-rel" href="#/scene/' + esc(c.sceneId) + '?tab=demo">' +
        '<span class="mr-code">' + esc(c.code || String(c.sceneId).toUpperCase()) + '</span>' +
        '<span class="mr-main"><b>' + esc(c.title) + '</b><span>' + esc(c.highlight || c.preview || spec.blurb) + '</span></span>' +
        '<span class="mr-meta"><span>' + esc(spec.params) + ' 参数 · ' + esc(spec.charts) + ' 图</span>' +
        (cred.score ? '<span class="mr-cred">' + esc(String(cred.score)) + ' / 100</span>' : '') + '</span></a>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/method/' + key, M[key].name]]) +
      '<div class="method-hero" style="--m-color:' + mc + '">' +
        '<div class="mh-l"><div class="mh-k"><span class="mh-abbr">' + esc(M[key].abbr) + '</span>METHOD · ' + esc(M[key].signal) + '</div>' +
        '<h1>' + esc(M[key].name) + '在石油勘探开发中的可应用场景</h1>' +
        '<p>' + esc(M[key].desc) + '</p></div>' +
        '<div class="mh-r">' +
          '<div><b>' + all.length + '</b><span>场景</span></div>' +
          '<div><b>' + hitStages.length + '</b><span>跨环节</span></div>' +
          '<div><b>' + relCases.length + '</b><span>已实现案例</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="m-dist"><div class="md-head"><span class="md-k">环节分布</span>' +
        '<span class="md-sub">共 ' + totalN + ' 个场景，按环节占比 · 点击跳转</span></div>' +
        '<div class="m-dist-bar">' + distBar + '</div></div>' +
      (relList ? '<div class="m-rel-box"><div class="mr-head"><span class="md-k">相关案例</span>' +
        '<span class="md-sub">' + relCases.length + ' 个案例把这个方法做成了可运行示范</span></div>' +
        relList + '</div>' : '') +
      '<div class="method-groups">' + groups + '</div>' +
      '<div class="pager"><a href="#/" class="prev"><span class="dir">← 返回</span><span class="nm">总览</span></a></div></main>';
  }

  /* =========================================================
     七、场景详情页（案例自动挂载）
     ========================================================= */
  function sceneHTML(sc, q) {
    var st = A.index.byStage[sc.stageId];
    var allCases = Cases.bySceneAll(sc.id);
    /* 当前展示哪个案例：?case= 指定，默认第一个 */
    var c = allCases.filter(function (x) { return x.id === q.case; })[0] || allCases[0] || null;

    var caseSwitch = '';
    if (allCases.length > 1) {
      caseSwitch = '<div class="case-switch"><span class="cs-lbl">本场景共有 ' + allCases.length +
        ' 个案例，当前展示</span>' + allCases.map(function (x) {
          var on = c && x.id === c.id;
          return '<button class="chip' + (on ? ' on' : '') + '" data-case="' + esc(x.id) + '">' +
            esc(x.title || x.id) + '</button>';
        }).join('') + '</div>';
    }

    var tabs = [];
    var showAi = !!(c && c.ai && global.IQAI && sc.stageId !== 'completion');
    if (c) {
      if (c.tabs.background) tabs.push({ key: 'bg', num: '01', name: c.tabs.background.label || '专业背景' });
      if (c.tabs.workflow) tabs.push({ key: 'flow', num: '02', name: c.tabs.workflow.label || '案例流程' });
      if (c.tabs.demo) tabs.push({ key: 'demo', num: '03', name: c.tabs.demo.label || '可运行示范' });
      if (showAi) tabs.push({ key: 'ai', num: '04', name: 'AI 解释' });
    }

    var tabBtns = tabs.map(function (t, i) {
      return '<button class="tab' + (i === 0 ? ' on' : '') + '" data-tab="' + t.key + '">' +
        '<span class="num">' + t.num + '</span>' + esc(t.name) + '</button>';
    }).join('');

    var panels = '';
    if (c) {
      if (c.tabs.background) panels += '<div class="panel on" data-panel="bg">' + renderBackground(sc, c) + '</div>';
      if (c.tabs.workflow) panels += '<div class="panel" data-panel="flow">' + renderWorkflow(sc, c) + '</div>';
      if (c.tabs.demo) panels += '<div class="panel" data-panel="demo">' + renderDemoShell(sc, c) + '</div>';
      if (showAi) panels += '<div class="panel" data-panel="ai">' + global.IQAI.block(c) + '</div>';
    }

    var cBadge = allCases.length
      ? '<span class="badge-ready">案例 ' + esc(c.id) + ' · v' + esc(c.version || '—') + '</span>' +
        (allCases.length > 1 ? '<span class="tag">共 ' + allCases.length + ' 个案例</span>' : '')
      : '<span class="badge-wip">未接入案例</span>';

    var head;
    if (c) {
      /* 统一案例头：编号 / 一句话价值 / 预览图 / 可信度 / 上下篇 */
      var order = ownedCaseIds();
      var ci = order.indexOf(c.id);
      var prevC = ci > 0 ? Cases.get(order[ci - 1]) : null;
      var nextC = ci >= 0 && ci < order.length - 1 ? Cases.get(order[ci + 1]) : null;
      function navCase(x, dir) {
        if (!x) return '';
        var xs = A.index.byScene[x.sceneId];
        if (!xs) return '';
        return '<a href="#/scene/' + xs.id + '?tab=background" title="' + esc(x.title) + '">' +
          (dir === 'prev' ? '← ' : '') + esc(x.title) + (dir === 'next' ? ' →' : '') + '</a>';
      }
      var spec = caseSpec(c);
      head = '<div class="case-head"><div class="case-head-grid">' +
        '<div class="ch-main">' +
        '<div class="case-head-top">' +
        '<span class="case-code">' + esc(c.code || String(c.sceneId).toUpperCase()) + '</span>' +
        '<span class="case-hot">' + esc(spec.hot) + '</span>' +
        '<a class="tag" href="#/stage/' + st.id + '">环节 ' + pad(st.idx) + ' · ' + esc(st.name) + '</a>' +
        sc.methods.map(function (k) {
          var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
          return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
        }).join('') +
        '<div class="case-nav">' + navCase(prevC, 'prev') + navCase(nextC, 'next') + '</div>' +
        '</div>' +
        '<h1 class="ch-title">' + esc(c.title || sc.name) + '</h1>' +
        '<p class="ch-high">' + esc(c.highlight || sc.point) + '</p>' +
        (c.preview ? '<p class="ch-pre">' + esc(c.preview) + '</p>' : '') +
        '<div class="case-meta">' +
        (spec.params ? '<span class="cm"><b>参数</b>' + esc(String(spec.params)) + ' 个可调</span>' : '') +
        (spec.charts ? '<span class="cm"><b>图表</b>' + esc(String(spec.charts)) + ' 张</span>' : '') +
        '<span class="cm"><b>难度</b>' + esc(sc.diff) + '</span>' +
        '<span class="cm ok"><b>示范</b>可运行</span>' +
        '<span class="cm"><b>版本</b>v' + esc(c.version || '—') + ' · ' + esc(c.updated || '') + '</span>' +
        '</div>' +
        '<div class="ch-acts">' +
        '<a class="btn primary sm" href="#/scene/' + sc.id + '?tab=demo">打开可运行示范 →</a>' +
        '<a class="btn sm ghost" href="#/scene/' + sc.id + '?tab=flow">看案例流程</a>' +
        (allCases.length > 1 ? '<a class="btn sm ghost" href="#/scene/' + sc.id + '?tab=background">切换其他案例（' + allCases.length + '）</a>' : '') +
        '</div></div>' +
        '<div class="ch-thumb">' + caseThumb(c) +
        '<div class="ch-thumb-f"><span>' + esc(String(c.sceneId).toUpperCase()) + '</span><span>' + esc(spec.hot) + '</span></div>' +
        '</div></div></div>' +
        caseSwitch;
    } else {
      head = '<div class="detail-head">' +
        '<div class="dh-kicker">' +
        '<a class="tag" href="#/stage/' + st.id + '">环节 ' + pad(st.idx) + ' · ' + esc(st.name) + '</a>' +
        sc.methods.map(function (k) {
          var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
          return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
        }).join('') +
        cBadge +
        '</div>' +
        '<h1 class="dh-title">' + esc(sc.name) + '</h1>' +
        '<p class="dh-sub">' + esc(sc.intro) + '</p>' +
        '<div class="dh-tags">' + K.dtag(sc.diff) +
        (sc.status === 'ext' ? '<span class="badge-wip">待扩展</span>' : '') +
        '<span class="tag"><span class="dot" style="color:var(--ink-4)"></span>' + esc(sc.id.toUpperCase()) + '</span>' +
        '</div></div>';
    }

    var body = c
      ? '<div class="tabs" id="tabs">' + tabBtns + '</div>' + panels
      : pendingHTML(sc);

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/stage/' + st.id, st.name], ['#/scene/' + sc.id, sc.name]]) +
      head + body + relatedHTML(sc) + '</main>';
  }

  /* ---- 有案例：三块内容由案例提供，这里只套版式 ---- */
  function renderBackground(sc, c) {
    var b = c.tabs.background;
    var out = '';
    if (b.lede) out += '<div class="lede-block"><span class="kicker plain">专业场景介绍</span><p>' + rich(b.lede) + '</p></div>';
    (b.sections || []).forEach(function (s, i) {
      out += K.sec4(i + 1, s.en || '', s.title, s.html || s.body || '');
    });
    return out;
  }

  function wfPad(n) { return (n < 10 ? '0' : '') + n; }

  function renderWorkflow(sc, c) {
    var w = c.tabs.workflow;
    var WF = window.__IQ_WF__ && window.__IQ_WF__[c.id];
    var R = window.__IQ_WF_RENDER__ && window.__IQ_WF_RENDER__[c.id];
    var steps = w.steps || [];
    var out = '';

    /* 没有步骤可视化渲染器的案例，保留原来的单列版式 */
    if (!R || !steps.length) {
      out = '<div class="case-lead"><div>' +
        '<span class="kicker clay">CASE WALKTHROUGH</span>' +
        '<h3 style="margin-top:10px">' + esc(w.title || '案例流程') + '</h3>' +
        (w.lead || []).map(function (p) { return '<p>' + rich(p) + '</p>'; }).join('') +
        '</div>' + (w.stats ? K.cells(w.stats) : '') + '</div>' +
        K.pipeline(steps);
    } else {
      /* 上下两个容器：上面整幅横版放说明（概念图 + 对照卡），
         下面才分左右——左为可点步骤，右为随步骤切换的动态可视化（吸附） */
      out = '<div class="wf-top">' +
          '<div class="case-lead">' +
            '<div class="wf-lead">' +
              '<span class="kicker clay">CASE WALKTHROUGH</span>' +
              '<h3>' + esc(w.title || '案例流程') + '</h3>' +
              (w.lead || []).map(function (p) { return '<p>' + rich(p) + '</p>'; }).join('') +
            '</div>' +
            (w.stats ? K.cells(w.stats) : '') +
          '</div>' +
          (WF && WF.conceptSvg ? '<div class="wf-concept">' +
            '<div class="wf-h"><b>一张图看懂</b><span>生活比喻 → 专业结构</span></div>' +
            WF.conceptSvg() + '</div>' : '') +
          (WF && WF.CONCEPTS ? '<div class="wf-metas">' + WF.CONCEPTS.map(function (k) {
            return '<div class="wf-meta"><div class="t">' + esc(k.t) + '</div>' +
              '<div><span class="k">专业</span>' + esc(k.prof) + '</div>' +
              '<div class="life"><span class="k">比喻</span>' + esc(k.life) + '</div>' +
              '<div class="see"><span class="k">看图</span>' + esc(k.see) + '</div></div>';
          }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="wf-wrap">' +
          '<div class="wf-left">' +
          '<div class="wf-steps" data-wf-steps>' + steps.map(function (s, i) {
            return '<div class="wf-step" data-i="' + i + '">' +
              '<div class="wf-step-h"><span class="no">' + wfPad(i + 1) + '</span>' +
                '<span class="nm">' + esc(s.name) + '</span>' +
                '<span class="ar">更多 ⌄</span></div>' +
              '<div class="wf-step-b">' +
                '<div class="wf-io3">' +
                  '<div><span class="k">输入</span><span class="v">' + rich(s.input || '') + '</span></div>' +
                  '<div class="proc"><span class="k">处理</span><span class="v">' + rich(s.do || '') + '</span></div>' +
                  '<div class="is-out"><span class="k">输出</span><span class="v">' + rich(s.output || '') + '</span></div>' +
                '</div>' +
                (s.effect ? '<div class="wf-eff"><span class="k">作用</span><span>' + rich(s.effect) + '</span></div>' : '') +
                (s.trap ? '<div class="wf-trap"><span class="k">不做会怎样</span><span>' + rich(s.trap) + '</span></div>' : '') +
              '</div></div>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="wf-right">' +
          '<div class="wf-vizbox">' +
            '<div class="wf-viz-h"><span class="wf-no" data-wf-no>STEP 01 / ' + wfPad(steps.length) + '</span>' +
              '<b data-wf-title>' + esc(steps[0].name) + '</b>' +
              '<span class="wf-viz-tag">动态可视化</span></div>' +
            '<div class="wf-ctl" role="group" aria-label="步骤播放控制">' +
              '<button class="wf-btn" type="button" data-wf-prev aria-label="上一步" title="上一步">‹</button>' +
              '<button class="wf-btn wf-btn-play" type="button" data-wf-play aria-pressed="false" aria-label="自动播放步骤">' +
                '<span data-wf-play-l>▶ 播放</span></button>' +
              '<button class="wf-btn" type="button" data-wf-next aria-label="下一步" title="下一步">›</button>' +
              '<button class="wf-btn wf-btn-ghost" type="button" data-wf-reset aria-label="回到第一步重播" title="重播">重播</button>' +
              '<span class="wf-state" data-wf-state aria-live="polite">第 1 / ' + steps.length + ' 步</span>' +
              '<div class="wf-dots" data-wf-dots>' + steps.map(function (s, i) {
                return '<button class="wf-dot' + (i === 0 ? ' on' : '') + '" type="button" data-wf-go="' + i + '"' +
                  ' aria-label="跳到第 ' + (i + 1) + ' 步：' + esc(s.name) + '" title="第 ' + (i + 1) + ' 步 · ' + esc(s.name) + '">' +
                  (i + 1) + '</button>';
              }).join('') + '</div>' +
            '</div>' +
            '<div class="wf-viz" data-wf-viz></div>' +
            '<div class="wf-viz-note" data-wf-note></div>' +
            '<div class="wf-viz-src">图形由本案例同一套模型函数实时计算，参数取示范默认值</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    if (w.metrics) {
      out += K.sec4(0, 'METRICS', w.metrics.title || '怎么算"做对了"', w.metrics.html || '');
    }
    if (w.fails) {
      out += '<div class="sec4"><div class="sn">FAIL<span>MODES</span></div><div class="sec4-body">' +
        '<h3>这类任务通常死在哪</h3>' +
        '<p>下面这些失败模式在同类项目里反复出现。它们多半不是模型能力问题，而是任务定义与数据规范问题。</p>' +
        K.fails(w.fails) + '</div></div>';
    }
    return out;
  }

  /* 流程页：步骤点击 + 播放控制 → 右侧动态图切换。无渲染器的案例自动跳过。 */
  function bindWorkflow(c) {
    var box = document.querySelector('[data-wf-steps]');
    var R = window.__IQ_WF_RENDER__ && window.__IQ_WF_RENDER__[c.id];
    if (!box || !R) return;
    var steps = (c.tabs.workflow.steps) || [];
    var WF = (window.__IQ_WF__ && window.__IQ_WF__[c.id]) || {};
    var viz = document.querySelector('[data-wf-viz]');
    var note = document.querySelector('[data-wf-note]');
    var title = document.querySelector('[data-wf-title]');
    var no = document.querySelector('[data-wf-no]');
    var stateEl = document.querySelector('[data-wf-state]');
    var dots = document.querySelectorAll('[data-wf-go]');
    var playBtn = document.querySelector('[data-wf-play]');
    var playL = document.querySelector('[data-wf-play-l]');
    var prevBtn = document.querySelector('[data-wf-prev]');
    var nextBtn = document.querySelector('[data-wf-next]');
    var resetBtn = document.querySelector('[data-wf-reset]');
    if (!viz || !note) return;

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var cur = 0, timer = null, playing = false;
    if (reduce && playBtn) {
      playBtn.disabled = true;
      playBtn.title = '系统已启用“减少动态效果”，自动播放关闭';
      if (playL) playL.textContent = '动效已关闭';
    }

    /* 给 SVG 元素打标记：分阶段入场 + 虚线流动。只加 class，不改图形与数据 */
    var warmStroke = ['#b26a39', '#a03d4f', '#b05a51', '#b8622f', '#c07a4a', '#a85249', '#b5653f'];
    function decorate() {
      var svgEl = viz.querySelector('svg');
      if (!svgEl) return;
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', steps[cur].name + ' · 步骤示意图');
      var nodes = svgEl.querySelectorAll('rect,line,path,circle,text,ellipse,polyline,polygon');
      [].forEach.call(nodes, function (el, i) {
        el.classList.add('wf-el');
        if (!el.style.getPropertyValue('--wf-d')) {
          el.style.setProperty('--wf-d', Math.min(i * 22, 460) + 'ms');
        }
        var da = el.getAttribute('stroke-dasharray');
        var stroke = el.getAttribute('stroke');
        if (da && stroke && stroke !== 'none') {
          el.classList.add('wf-flow');
        } else if (stroke && warmStroke.indexOf(stroke.toLowerCase()) >= 0) {
          /* 暖色实线多为“流体/受力传递”路径，做轻微呼吸提示，不改变图形 */
          el.classList.add('wf-hot');
        }
      });
    }

    function show(i) {
      cur = Math.max(0, Math.min(steps.length - 1, i));
      [].forEach.call(box.querySelectorAll('.wf-step'), function (b, k) {
        b.classList.toggle('on', k === cur);
      });
      [].forEach.call(dots, function (d, k) { d.classList.toggle('on', k === cur); });
      var s = steps[cur];
      if (title) title.textContent = s.name;
      if (no) no.textContent = 'STEP ' + wfPad(cur + 1) + ' / ' + wfPad(steps.length);
      if (stateEl) stateEl.textContent = '第 ' + (cur + 1) + ' / ' + steps.length + ' 步';
      if (prevBtn) prevBtn.disabled = cur === 0;
      if (nextBtn) nextBtn.disabled = cur === steps.length - 1;
      viz.innerHTML = '';
      note.innerHTML = '';
      try {
        var msg = R(cur, viz, WF);
        if (msg) note.innerHTML = msg;
      } catch (err) {
        viz.innerHTML = '<div class="wf-empty">图形生成失败：' + esc(err.message) + '</div>';
      }
      decorate();
      viz.classList.remove('wf-paused');
      viz.classList.remove('wf-in');
      void viz.offsetWidth;
      viz.classList.add('wf-in');
    }

    function stop() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (playBtn) {
        playBtn.setAttribute('aria-pressed', 'false');
        playBtn.setAttribute('aria-label', '自动播放步骤');
      }
      if (playL) playL.textContent = '▶ 播放';
      viz.classList.add('wf-paused');
    }

    function play() {
      if (reduce || playing) return;
      if (cur === steps.length - 1) show(0);
      playing = true;
      if (playBtn) {
        playBtn.setAttribute('aria-pressed', 'true');
        playBtn.setAttribute('aria-label', '暂停自动播放');
      }
      if (playL) playL.textContent = '⏸ 暂停';
      viz.classList.remove('wf-paused');
      timer = setInterval(function () {
        if (cur >= steps.length - 1) { stop(); return; }
        show(cur + 1);
      }, 4800);
    }

    box.addEventListener('click', function (e) {
      var b = e.target.closest('.wf-step');
      if (!b) return;
      stop();
      show(Number(b.getAttribute('data-i')));
    });
    [].forEach.call(dots, function (d) {
      d.addEventListener('click', function () { stop(); show(Number(d.getAttribute('data-wf-go'))); });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { stop(); show(cur - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stop(); show(cur + 1); });
    if (resetBtn) resetBtn.addEventListener('click', function () { stop(); show(0); });
    if (playBtn) playBtn.addEventListener('click', function () { playing ? stop() : play(); });
    /* 控制条内支持方向键切换步骤，方便纯键盘操作 */
    var ctl = document.querySelector('.wf-ctl');
    if (ctl) ctl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); show(cur - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stop(); show(cur + 1); }
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });

    wfStop = stop;
    show(0);
  }

  function renderDemoShell(sc, c) {
    return '<div id="case-demo-root" class="iqd"></div>';
  }

  /* ---- 无案例：展示速览 + 接入引导 ---- */
  function pendingHTML(sc) {
    var dataRows = sc.data.map(function (d) { return [d[0], d[1], d[2]]; });
    return '<div style="padding-top:8px">' +
      '<div class="sec4" style="border-top:0">' +
      '<div class="sn">01<span>PROBLEM</span></div><div class="sec4-body">' +
      '<h3>业务问题</h3><p>' + esc(sc.problem) + '</p></div></div>' +
      '<div class="sec4"><div class="sn">02<span>INTERVENTION</span></div><div class="sec4-body">' +
      '<h3>AI 介入点</h3><p>' + esc(sc.point) + '</p></div></div>' +
      '<div class="sec4"><div class="sn">03<span>DATA</span></div><div class="sec4-body">' +
      '<h3>数据条件</h3>' + K.dtable(['数据类型', '规模 / 规格', '标注要求'], dataRows) + '</div></div>' +
      '<div class="sec4"><div class="sn">04<span>DIFFICULTY</span></div><div class="sec4-body">' +
      '<h3>技术难度与参考方向</h3>' +
      '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px">' + K.dtag(sc.diff) +
      '<span class="small muted">' + esc(sc.diffWhy) + '</span></div>' + K.meter(sc.diff) +
      K.refs(sc.refs, '#/method/' + sc.methods[0]) +
      '</div></div>' +

      '<div class="pending"><div class="pending-top"><span class="badge-wip">案例待接入</span>' +
      '<h3>这个场景还没有配套案例</h3></div>' +
      '<p>它的元数据（问题、介入点、数据条件、难度）已经在地图里，但还没有写成可讲解、可运行的具体案例。案例是按插件方式接入的：写一个文件声明三块内容，注册后这个页面就会自动出现 tab 与示范。</p>' +
      '<div class="pending-lines"><div class="pending-line"></div><div class="pending-line"></div><div class="pending-line"></div></div>' +
      '<div class="pending-actions">' +
      '<button class="btn primary" data-import data-scene="' + esc(sc.id) + '">＋ 为这个场景添加案例</button>' +
      '<a class="btn" href="#/cases">看已接入的案例</a>' +
      '<a class="btn ghost" href="#/guide">看接入说明</a>' +
      '</div></div></div>';
  }

  function relatedHTML(sc) {
    var sameStage = A.index.byStage[sc.stageId].scenes.filter(function (s) { return s.id !== sc.id; }).slice(0, 4);
    var sameMethod = (A.index.byMethod[sc.methods[0]] || []).filter(function (s) { return s.id !== sc.id; }).slice(0, 4);
    return '<div class="related"><div class="sec-head" style="margin-bottom:0;border-top:0;padding-top:0"><div>' +
      '<span class="kicker">RELATED</span><h2 style="font-size:18px;margin-top:8px">相关场景</h2></div></div>' +
      '<div class="rel-grid">' +
      '<div class="rel-col"><h5>同环节 · ' + esc(A.index.byStage[sc.stageId].name) + '</h5>' +
      sameStage.map(function (s) {
        return '<a class="rel-item" href="#/scene/' + s.id + '"><span class="nm">' + esc(s.name) + '</span><span class="go">→</span></a>';
      }).join('') + '</div>' +
      '<div class="rel-col"><h5>同方法 · ' + esc(M[sc.methods[0]].name) + '</h5>' +
      sameMethod.map(function (s) {
        return '<a class="rel-item" href="#/scene/' + s.id + '"><span class="nm">' + esc(s.name) + '</span><span class="go">' + esc(s.stageName) + ' →</span></a>';
      }).join('') + '</div></div>' +
      '<div style="margin-top:18px;display:flex;gap:9px;flex-wrap:wrap">' +
      '<a class="btn" href="#/stage/' + sc.stageId + '">← 返回' + esc(sc.stageName) + '环节</a>' +
      '<a class="btn ghost" href="#/">返回总览</a></div></div>';
  }

  /* ---- tab 交互与示范挂载 ---- */
  function bindTabs(sc, c) {
    var tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;

    function activate(key, scroll) {
      [].forEach.call(tabsEl.children, function (b) {
        b.classList.toggle('on', b.dataset.tab === key);
      });
      [].forEach.call(document.querySelectorAll('.panel'), function (p) {
        p.classList.toggle('on', p.dataset.panel === key);
      });
      /* 窄屏下 tab 条可横向滚动：把当前 tab 滚到可视区中间 */
      var tb = tabsEl.querySelector('[data-tab="' + key + '"]');
      if (tb && tabsEl.scrollWidth > tabsEl.clientWidth) {
        tabsEl.scrollTo({
          left: Math.max(0, tb.offsetLeft - (tabsEl.clientWidth - tb.offsetWidth) / 2),
          behavior: 'smooth'
        });
      }
      if (key === 'demo') mountDemo(sc, c);
      if ((key === 'bg' || key === 'ai') && global.IQAI) global.IQAI.bind(view);
      if (scroll) {
        var y = tabsEl.getBoundingClientRect().top + window.scrollY - 62;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }

    tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      activate(b.dataset.tab, true);
      setHashQuiet('#/scene/' + sc.id + '?tab=' + b.dataset.tab);
    });

    var want = { 1: 'bg', 2: 'flow', 3: 'demo' }[parseHash().q.tab] || parseHash().q.tab;
    if (want && tabsEl.querySelector('[data-tab="' + want + '"]')) activate(want, false);

    bindWorkflow(c);
    bindChecklist();
  }

  function mountDemo(sc, c) {
    var d = c.tabs.demo;
    if (!d || typeof d.mount !== 'function') return;
    var key = c.id;
    if (mountedKey === key) return;
    var root = document.getElementById('case-demo-root');
    if (!root) return;
    if (mounted && mounted.unmount) { try { mounted.unmount(); } catch (e) { } }
    root.innerHTML = '';
    mounted = d;
    mountedKey = key;
    try {
      d.mount(root, { scene: sc, kase: c, K: K, atlas: A });
    } catch (err) {
      root.innerHTML = '<div class="callout warn"><span class="ci">错误</span><span>示范挂载失败：' +
        esc(err.message) + '。检查 <b>' + esc(c.id) + '</b> 的 tabs.demo.mount。</span></div>';
      console.error('[case:' + c.id + '] demo mount failed', err);
    }
  }

  function bindChecklist() {
    var items = document.querySelectorAll('.cl-item');
    if (!items.length) return;
    var total = items.length;
    var fill = document.getElementById('cl-fill');
    var txt = document.getElementById('cl-txt');

    function sync() {
      var n = document.querySelectorAll('.cl-item.done').length;
      if (fill) fill.style.width = (n / total * 100) + '%';
      if (txt) txt.textContent = n + ' / ' + total;
    }
    [].forEach.call(items, function (it) {
      it.addEventListener('click', function () {
        it.classList.toggle('done');
        sync();
      });
    });
    sync();
  }

  /* =========================================================
     八、案例库控制台
     ========================================================= */
  function casesHTML() {
    var list = Cases.list();
    var checks = Cases.validateAll();
    var s = Cases.stats();
    var pending = A.allScenes.filter(function (sc) { return !Cases.bySceneAll(sc.id).length; });

    var rows = list.map(function (c) {
      var sc = A.index.byScene[c.sceneId];
      var ck = checks[c.id] || [];
      var errs = ck.filter(function (x) { return x.level === 'error'; }).length;
      var warns = ck.filter(function (x) { return x.level === 'warn'; }).length;
      var state = errs ? '<span class="bad-mark">✕ ' + errs + ' 项错误</span>'
        : warns ? '<span class="mono" style="font-size:11px;color:var(--warn)">! ' + warns + ' 项提醒</span>'
          : '<span class="ok-mark">✓ 通过</span>';
      var tabFlags = ['background', 'workflow', 'demo'].map(function (k) {
        return '<span class="' + (c.tabs[k] ? 'ok-mark' : 'dim-mark') + '" title="' + k + '">' + (c.tabs[k] ? '●' : '○') + '</span>';
      }).join(' ');
      var mChips = (c.methods || []).map(caseChip).join('') || '<span class="dim-mark">继承场景</span>';

      return '<tr data-lib-row data-code="' + esc(String(c.code || c.sceneId)) + '" data-id="' + esc(c.id) + '"' +
        ' data-stage="' + esc(sc ? sc.stageId : '') + '" data-methods="' + esc((c.methods || (sc && sc.methods) || []).join(' ')) + '"' +
        ' data-ready="' + (c.tabs.demo ? '1' : '0') + '">' +
        '<td class="id">' + esc(c.id) + '</td>' +
        '<td><div class="nm">' + esc(c.title || sc && sc.name) +
        (c.imported ? '<span class="badge-local">本地导入</span>' : '') + '</div>' +
        '<div class="sc">' + (sc ? esc(sc.stageName) + ' / ' + esc(sc.name) : '⚠ sceneId 未匹配') + '</div></td>' +
        '<td>' + mChips + '</td>' +
        '<td class="sc">' + esc(c.version || '—') + '</td>' +
        '<td class="sc">' + esc(c.updated || '—') + '</td>' +
        '<td style="letter-spacing:.16em">' + tabFlags + '</td>' +
        '<td>' + state + '</td>' +
        '<td>' + (sc ? '<a class="btn sm ghost" href="#/scene/' + sc.id + '?case=' + esc(c.id) + '">打开 →</a>' : '—') +
        '<a href="#" class="link-remove" data-remove-case="' + esc(c.id) + '" title="' +
        (c.imported ? '从本机移除这份上传的案例包' : '从站点删除这个插件案例（文件保留，可恢复）') + '">' +
        (c.imported ? '移除' : '删除') + '</a>' +
        '</td></tr>';
    }).join('');

    /* 被删除（隐藏）的插件案例——可恢复 */
    var blocked = (global.CaseImport && global.CaseImport.blockedList ? global.CaseImport.blockedList() : [])
      .filter(function (id) { return !Cases.get(id); });
    var blockedBlock = '';
    if (blocked.length) {
      blockedBlock =
        '<div class="blocked-box">' +
        '<div class="bb-h"><span class="kicker clay">HIDDEN</span>' +
        '<b>已删除的插件案例（' + blocked.length + '）</b>' +
        '<span class="bb-sub">.js 文件仍在磁盘上，恢复后重新加载页面即可回到上表</span></div>' +
        '<div class="bb-list">' + blocked.map(function (id) {
          return '<span class="bb-item"><span class="mono">' + esc(id) + '</span>' +
            '<a href="#" class="link-remove" data-restore-case="' + esc(id) + '">恢复</a></span>';
        }).join('') + '</div></div>';
    }

    var detail = list.map(function (c) {
      var ck = checks[c.id] || [];
      return '<details class="chk-fold">' +
        '<summary>' +
        esc(c.id) + ' 的校验明细 <span class="mono" style="font-weight:400;color:var(--ink-4);font-size:10.5px">' +
        ck.length + ' 条</span></summary>' +
        '<div style="padding:0 14px 12px"><table class="contract"><tbody>' +
        ck.map(function (x) {
          var mark = x.level === 'ok' ? '<span class="ok-mark">✓</span>'
            : x.level === 'warn' ? '<span style="color:var(--warn);font-family:var(--mono);font-size:11px">!</span>'
              : '<span class="bad-mark">✕</span>';
          return '<tr><td style="width:22px">' + mark + '</td>' +
            '<td style="font-family:var(--sans)">' + esc(x.label) + '</td>' +
            '<td style="color:var(--ink-4);font-size:11px">' + esc(x.detail) + '</td></tr>';
        }).join('') + '</tbody></table></div></details>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/cases', '案例库']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">CASE REGISTRY</div>' +
      '<h1>案例库与接入状态</h1>' +
      '<p class="blurb">系统在启动时扫描所有已加载的案例插件，按契约做静态校验。任何一项报错都会在这里列出来，不会静默失败。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + s.registered + '</div><div class="l">已注册</div></div>' +
      '<div><div class="n">' + s.withDemo + '</div><div class="l">含示范</div></div>' +
      '<div><div class="n">' + pending.length + '</div><div class="l">待接入</div></div>' +
      '</div></div></div>' +

      '<div class="console-bar">' +
      '<span class="num">' + s.coveredScenes + '<small>/' + s.totalScenes + '</small></span>' +
      '<span class="lbl">个场景已有案例实现（共 ' + s.registered + ' 个案例）</span><span class="sp"></span>' +
      '<button class="btn sm primary" data-import>＋ 添加案例</button>' +
      '<button class="btn sm ghost" id="rerun">重新校验</button></div>' +

      '<div class="lib-bar">' +
        '<input type="search" id="lib-q" class="lib-q" placeholder="搜索案例名 / id / 技术…" aria-label="搜索案例">' +
        '<select id="lib-stage" aria-label="按阶段筛选"><option value="">全部阶段</option>' +
          A.stages.filter(function (st) { return list.some(function (c) { return c.sceneId && A.index.byScene[c.sceneId] && A.index.byScene[c.sceneId].stageId === st.id; }); })
            .map(function (st) { return '<option value="' + st.id + '">' + pad(st.idx) + ' · ' + esc(st.name) + '</option>'; }).join('') +
        '</select>' +
        '<select id="lib-method" aria-label="按方法筛选"><option value="">全部方法</option>' +
          Object.keys(M).filter(function (k) { return list.some(function (c) { return (c.methods || []).indexOf(k) >= 0; }); })
            .map(function (k) { return '<option value="' + k + '">' + esc(M[k].abbr) + ' · ' + esc(M[k].name) + '</option>'; }).join('') +
        '</select>' +
        '<label class="lib-chk"><input type="checkbox" id="lib-ready"> 只看可运行</label>' +
        '<span class="sp"></span>' +
        '<span class="lib-count" id="lib-count">' + list.length + ' 个案例</span>' +
      '</div>' +
      '<div class="matrix-wrap" style="box-shadow:var(--sh-1)">' +
      '<table class="sys-table"><thead><tr>' +
      '<th>案例 id</th><th>绑定场景</th><th>涉及技术</th><th>版本</th><th>更新</th><th>三块内容</th><th>校验</th><th></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="8" class="empty">还没有任何案例注册</td></tr>') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:9px">三块内容依次为 background / workflow / demo，● 已提供、○ 未提供。技术标签可在导入时勾选，不选则继承场景；同一个场景支持挂多个案例，场景页顶部会出现切换器。删除上传案例会清掉本机存档；删除插件案例只是隐藏，文件不动，可随时恢复。</p>' +

      blockedBlock +

      '<div class="chk-sec"><div class="chk-sec-h"><span class="kicker">CONTRACT CHECKS</span>' +
      '<b>逐案例校验明细</b><span class="small muted">' + list.length + ' 个案例 · 展开查看每项是否通过</span></div>' +
      '<div class="chk-grid">' + detail + '</div></div>' +

      '<div class="section" style="padding:44px 0 56px">' +
      '<div class="sec-head"><div><span class="kicker">BACKLOG</span>' +
      '<h2 style="margin-top:10px">还有 ' + pending.length + ' 个场景等待接入</h2>' +
      '<p>下面这些场景已有元数据，缺的是案例实现。接入一个大约需要「一份专业背景 + 一条流程 + 一个能跑的最小示范」。</p>' +
      '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
      pending.slice(0, 24).map(function (sc) {
        return '<a class="tag" href="#/scene/' + sc.id + '">' + esc(sc.name) + '</a>';
      }).join('') +
      (pending.length > 24 ? '<span class="tag">… 另有 ' + (pending.length - 24) + ' 个</span>' : '') +
      '</div></div></main>';
  }

  /* =========================================================
     九、接入指南
     ========================================================= */
  function guideHTML() {
    var fileTree = K.tree([
      '<b>项目根目录</b>',
      '├── index.html                <span class="cm">← 新增案例时加一行 script</span>',
      '├── assets/',
      '│   ├── data.js               <span class="cm">场景元数据（13 环节 / 61 场景）</span>',
      '│   ├── core/                 <span class="cm">外壳，一般不用动</span>',
      '│   │   ├── tokens.css        <span class="cm">颜色 / 字号 / 圆角</span>',
      '│   │   ├── layout.css        <span class="cm">导航 / 页头 / 页脚</span>',
      '│   │   ├── ui.css            <span class="cm">卡片 / 表格 / 四段式 / 示范</span>',
      '│   │   ├── platform.css      <span class="cm">平台顶栏 / 左栏 / 驾驶舱 / 案例头</span>',
      '│   │   ├── registry.js       <span class="cm">Cases.register 契约与校验</span>',
      '│   │   ├── kit.js            <span class="cm">K.sec4 / K.figure / K.code…</span>',
      '│   │   ├── case-demo-host.js <span class="cm">示范宿主：iframe 整页 / Shadow DOM 模块</span>',
      '│   │   ├── case-upload.js    <span class="cm">案例包导入：校验 / 打包 / 落库</span>',
      '│   │   └── shell.js          <span class="cm">路由与页面</span>',
      '│   └── cases/                <span class="dir">← 案例都放这里</span>',
      '│       ├── welllog-layer.case.js   <span class="new">测井分层（示例）</span>',
      '│       ├── welllog-layer.demo.js   <span class="new">它的可运行示范</span>',
      '│       ├── iq-demo.css             <span class="new">六个案例共用的示范样式</span>',
      '│       ├── iq-viz.js               <span class="new">共享 D3 组件（作业链条 / 方法环图 / 计数）</span>',
      '│       ├── _template.case.js       <span class="new">插件模板，复制它开始</span>',
      '│       └── _template.case.json     <span class="new">清单模板（完整包请用弹窗里下载的 zip）</span>',
      '└── docs/',
      '    ├── 如何添加新案例.md      <span class="cm">本页的离线版</span>',
      '    └── 项目升级方案-v2.md    <span class="cm">平台化升级的取舍与验收</span>'
    ]);

    var sample = [
      "Cases.register({",
      "  id: 'logging-mud-loss',          // 必填，kebab-case，全局唯一",
      "  sceneId: 'd3',                    // 必填，data.js 里已有的场景 id",
      "  title: '钻井液漏失层位识别',",
      "  status: 'ready',                  // ready | draft",
      "  version: '1.0.0',",
      "  updated: '2026-10-22',",
      "",
      "  tabs: {",
      "    // ① 专业背景：四段式，返回 HTML 字符串",
      "    background: {",
      "      label: '专业背景',",
      "      judge: [",
      "        { label: '任务', value: '序列分割' },",
      "        { label: '数据', value: '随钻曲线 + 漏失记录' }",
      "      ],",
      "      lede: '一句话说明这个场景到底在做什么。',",
      "      sections: [",
      "        { no: 1, en: 'PROBLEM', title: '当前做法与问题',",
      "          html: '<p>……</p>' + K.figure(svgManual(), 1, '图注') },",
      "        { no: 2, en: 'INTERVENTION', title: 'AI 能做什么', html: '……' },",
      "        { no: 3, en: 'DATA', title: '你需要准备什么',",
      "          html: K.checklist([['随钻曲线', '1 s 采样'], ['漏失记录', '人工登记']]) },",
      "        { no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向', html: '……' }",
      "      ]",
      "    },",
      "",
      "    // ② 案例流程：一条真实项目走过的路",
      "    workflow: {",
      "      label: '案例流程',",
      "      title: '某某区块 18 口井的漏失识别',",
      "      lead: ['项目目标不是做模型，而是把漏失层位定位时间压到 10 分钟。'],",
      "      stats: [['样本井', '18 口'], ['目标准确率', '85%']],",
      "      steps: [",
      "        { name: '数据对齐', do: '……', role: '工程环节',",
      "          effect: '……', trap: '……' }",
      "      ],",
      "      fails: [{ name: '标签滞后', why: '……' }]",
      "    },",
      "",
      "    // ③ 可运行示范（可选）：给一个 DOM 容器就能跑",
      "    demo: {",
      "      label: '可运行示范',",
      "      mount: function (root, ctx) {",
      "        root.innerHTML = '<div>……</div>';",
      "        // ctx.scene / ctx.kase / ctx.K / ctx.atlas 都可直接用",
      "      },",
      "      unmount: function () { /* 清理定时器、事件监听 */ }",
      "    }",
      "  }",
      "});"
    ].join('\n');

    var fields = [
      ['id', '必填', '全局唯一标识，kebab-case。会显示在场景页头部与控制台里。'],
      ['sceneId', '必填', '绑定到 data.js 中的某个场景 id。校验会检查它是否存在。'],
      ['title', '必填', '案例标题，通常与场景名一致或更具体。'],
      ['status', '建议', 'ready = 可用于教学；draft = 内容未定稿，控制台标黄。'],
      ['version', '建议', '语义化版本，改了内容就升一格。'],
      ['updated', '建议', '最后更新日期，方便判断内容是否过期。'],
      ['tabs.background', '必填', '对象。judge（30 秒判断）/ lede（导语）/ sections（四段式数组）。'],
      ['tabs.background.sections[]', '必填', '每段 { no, en, title, html }。建议恰好四段，与全站一致。'],
      ['tabs.workflow', '建议', '对象。title / lead[] / stats[] / steps[] / fails[] / metrics。'],
      ['tabs.workflow.steps[]', '建议', '每步 { name, input, do, output, viz, role, effect, trap }。input/output 渲染成输入·输出双格，viz 单独标注这一步用什么图表达，role 渲染成小标签。'],
      ['tabs.demo', '可选', '对象。mount(root, ctx) 必填；unmount() 用于清理。'],
      ['tabs.demo.label', '可选', '第三个 tab 的显示名，默认「可运行示范」。'],
      ['code / highlight / preview', '建议', '案例头展示用：编号、一句话亮点、交付预览。'],
      ['credibility', '建议', '可信度 { score, level, basis, checks[] }，会渲染成案例头徽标与页尾可信度条。'],
      ['conclusion / limits', '建议', '示范 Tab 之后的结论卡与适用边界；limits 至少 2 条。'],
      ['concept', '建议', '决策链 { title, steps[] }，每步 { k（英文短语）, t（标题）, d（说明） }，建议 4–6 步。']
    ].map(function (r) {
      var req = r[1] === '必填' ? '<span class="req">必填</span>'
        : r[1] === '建议' ? '<span class="opt">建议</span>' : '<span class="opt">可选</span>';
      return '<tr><td>' + esc(r[0]) + '</td><td>' + req + '</td><td>' + rich(r[2]) + '</td></tr>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/guide', '接入指南']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">EXTENDING</div>' +
      '<h1>怎么把这个系统扩成你自己的案例集</h1>' +
      '<p class="blurb">两条路：不写代码就上传案例包；需要真实算法示范时才写插件。两条路走完，效果一样——场景页自动长出 tab，检索路径自动收录。</p>' +
      '</div></div></div>' +

      /* ---- 方式 A：上传案例包 ---- */
      '<div class="sec-head" style="margin-top:4px">' +
      '<div class="sec-rail"><span class="sec-num">A</span><span class="kicker">UPLOAD PACKAGE · 推荐</span>' +
      '<span class="r"><span class="tag">不需要改任何文件</span></span></div>' +
      '<h2>上传一个案例包，三步接进去</h2>' +
      '<p>下载模板（zip，含一个能跑的示范页）→ 改清单、替换演示内容 → 把整个文件夹拖回网站。系统逐项检查格式，通过后当场出现在站点里。</p>' +
      '</div>' +

      '<div class="upcard">' +
      '<div class="upcard-l">' +
      '<h4>案例包是什么</h4>' +
      '<p>是一个<b>文件夹</b>：一份 JSON 清单 + 任意演示文件。清单写名称、所属场景和两块正文（专业背景 / 案例流程）；' +
      '示范可以是一个完整的 <b>index.html</b>、配套的 <b>demo.js</b> / <b>demo.css</b>，以及图片、JSON 数据等素材。</p>' +
      '<p>拖进弹窗时会整个读进浏览器——<b>html 自动内联 css 与 js、图片自动转成内嵌资源</b>，所以不需要服务器，双击 index.html 也能跑。</p>' +
      '<p>示范页跑在 <b>sandbox iframe</b> 里，你可以随便写样式和脚本，不会污染主站；只有 demo.js 没有 html 时，脚本会挂进 <b>Shadow DOM</b>，样式同样隔离。</p>' +
      '<div class="upcard-acts">' +
      '<button class="btn primary" data-import>＋ 打开「添加案例」</button>' +
      '<button class="btn" data-dl-template>↓ 下载案例包模板（.zip）</button>' +
      '</div>' +
      '<div class="upcard-note">模板解压后就是一个可直接运行的完整包：清单 + 示范页 + 样式 + 脚本，改完整个文件夹拖回去即可。' +
      '上传的案例保存在本机浏览器（localStorage），换电脑需重新上传；要永久发布给所有人，用下面的方式 B。</div>' +
      '</div>' +
      '<div class="upcard-r">' +
      '<table class="contract"><thead><tr><th>文件 / 字段</th><th>级别</th><th>说明</th></tr></thead><tbody>' +
      [
        ['case.json', '必填', '清单。建议就用这个名字，放在包根目录'],
        ['demo/index.html', '可选', '整页示范。自动内联 css/js，图片相对路径自动替换'],
        ['demo/demo.css', '可选', '示范页样式，只在沙箱里生效'],
        ['demo/demo.js', '可选', '示范脚本；无 html 时走模块模式，需导出 mount'],
        ['demo/d3.v7.min.js', '可选', '本地离线 D3。缺失时示范会提示「D3 未加载」'],
        ['demo/iq-viz.js', '可选', '共享可视化组件；只在需要图表组件时引入'],
        ['id', '必填', '小写字母 / 数字 / 连字符，全站唯一'],
        ['sceneId', '必填', '绑定场景，等于选定分类（环节 + 方法自动带出）'],
        ['title', '必填', '案例名称，页头与列表都用它'],
        ['tabs.background.sections[]', '必填', '每段 { title, html }；建议四段'],
        ['tabs.background.judge', '可选', '「30 秒判断」四格 { label, value, desc }'],
        ['tabs.workflow.steps[]', '可选', '每步 { name, input, do, output, viz, effect, trap }'],
        ['tabs.demo.mode', '可选', 'auto（默认）/ page / module / builtin，一般不用写'],
        ['tabs.demo.builtin', '可选', '复用某个已有案例的示范（填它的 id）'],
        ['code', '可选', '展示编号 CO1 / E1 / PR2，用于案例头'],
        ['highlight', '可选', '案例头的一句话亮点，比 title 更适合当副标题'],
        ['preview', '可选', '交付预览：说明示范里能操作什么、能出什么图'],
        ['credibility', '可选', '可信度 { score, level, basis, checks[] }，案例头与页尾都会用到'],
        ['conclusion', '可选', '结论卡 { title, html }，放在示范 Tab 之后'],
        ['limits', '可选', '适用边界字符串数组，至少 2 条'],
        ['concept', '可选', '决策链 { title, steps[] }，每步 { k, t, d }']
      ].map(function (r) {
        var req = r[1] === '必填' ? '<span class="req">必填</span>' : '<span class="opt">可选</span>';
        return '<tr><td>' + esc(r[0]) + '</td><td>' + req + '</td><td>' + rich(r[2]) + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '</div>' +
      '</div>' +

      /* ---- 方式 B：插件 ---- */
      '<div class="sec-head" style="margin-top:26px">' +
      '<div class="sec-rail"><span class="sec-num">B</span><span class="kicker">PLUGIN · 需要真实示范时</span></div>' +
      '<h2>写一个案例插件</h2>' +
      '<p>要放真实的算法示范（可交互的曲线、可拖的参数），就用插件。下面三步走完即可。</p>' +
      '</div>' +

      '<div class="gsteps">' +
      '<div class="gstep"><div class="gn">1</div><div>' +
      '<h3>复制模板，改三处</h3>' +
      '<p>把 <b>assets/cases/_template.case.js</b> 复制成 <b>你的案例.case.js</b>，然后只改三处：<b>id</b>、<b>sceneId</b>、以及三个 tab 里的内容。</p>' +
      '<p>id 用 kebab-case，保证唯一；sceneId 必须是 <b>assets/data.js</b> 里已经存在的场景 id（比如 <b>w1</b> 是测井分层）。如果这个场景还不存在，先在 data.js 的对应环节 scenes 数组里加一条元数据。</p>' +
      '</div></div>' +

      '<div class="gstep"><div class="gn">2</div><div>' +
      '<h3>在 index.html 里挂上去</h3>' +
      '<p>找到页面底部的脚本区，在你的案例文件后面加一行：</p>' +
      K.code('<script src="assets/cases/你的案例.case.js"><' + '/script>', { file: 'index.html', note: '加在 shell.js 之前' }) +
      '<p>加载顺序是：data.js → registry.js → kit.js → 案例 → shell.js。案例必须在 shell.js 之前注册完，否则首屏渲染时找不到它。</p>' +
      '</div></div>' +

      '<div class="gstep"><div class="gn">3</div><div>' +
      '<h3>打开控制台看校验结果</h3>' +
      '<p>刷新页面，进 <a href="#/cases" style="color:var(--jade-d);font-weight:600">案例库</a>。系统会自动检查：id 是否规范、sceneId 是否存在、三段内容是否齐全、demo.mount 是否为函数、场景与案例的 demo 标记是否一致。</p>' +
      '<p>全绿就说明接入完成 —— 场景页的 tab、面包屑、相关场景、方法反查页里的条目都会自动出现，不需要改任何其它文件。</p>' +
      '<p>标准案例包是 <b>6 个文件</b>：<b>case.json</b> + <b>demo/index.html</b> + <b>demo.css</b> + <b>demo.js</b> + <b>d3.v7.min.js</b> + <b>iq-viz.js</b>。前四个是内容，后两个由构建脚本从 <b>assets/cases/</b> 与 <b>assets/vendor/</b> 复制，不要手改。</p>' +
      '<p>同步命令：<b>node tools/build-cases.js</b>（生成插件注册器 + 复制共享样式/D3/组件 + 校验平台字段）；打 zip：<b>python tools/package_cases.py</b>。</p>' +
      '</div></div>' +
      '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">STRUCTURE</span>' +
      '<h2 style="margin-top:8px">文件在哪</h2></div></div>' + fileTree + '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">CONTRACT</span>' +
      '<h2 style="margin-top:8px">契约字段</h2>' +
      '<p>只有标「必填」的字段缺失会报错，其余缺失只是控制台里的一条提醒。</p></div></div>' +
      '<div class="matrix-wrap"><table class="contract"><thead><tr><th>字段</th><th>级别</th><th>说明</th></tr></thead><tbody>' +
      fields + '</tbody></table></div></div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">EXAMPLE</span>' +
      '<h2 style="margin-top:8px">一个完整的案例声明</h2>' +
      '<p>这是最小可用的骨架，把省略号换成你的内容即可。</p></div></div>' +
      K.code(sample, { file: 'assets/cases/your-case.case.js' }) +
      '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">KIT</span>' +
      '<h2 style="margin-top:8px">内容怎么写：工具箱</h2>' +
      '<p>不要在案例里写 CSS 类名，用这些函数生成结构，版式改动会全站同步。</p></div></div>' +
      K.dtable(['函数', '用途'], [
        ['K.sec4(no, en, title, html)', '四段式中的一段，带编号与英文小标'],
        ['K.figure(svg, no, caption)', '插图 + 图注，图注支持 **粗体**'],
        ['K.judge([{label,value,desc}])', '页面顶部那排"30 秒判断"格子'],
        ['K.checklist(items)', '可勾选的数据准备清单，items 为 [名称, 规格, 标注要求]'],
        ['K.dtable(head, rows)', '普通数据表格'],
        ['K.pipeline(steps)', '带编号的流程步骤，每步可写效果与坑'],
        ['K.fails([{name, why}])', '失败模式四宫格'],
        ['K.cells([[标签, 值]])', '流程页右侧的指标格'],
        ['K.credStrip(credibility)', '页尾可信度条：分数 / 等级 / 依据 / 三项检查'],
        ['K.decisionChain(steps)', '示范页上方的决策链：输入 → 处理 → 输出'],
        ['K.verdictBlock(conclusion, limits)', '结论卡 + 适用边界，示范之后固定出现'],
        ['K.meter(diff)', '三段式难度条'],
        ['K.refs([...], href)', '参考方向胶囊'],
        ['K.callout(text, "warn")', '提示条'],
        ['K.code(str, {file})', '代码块，带语法着色']
      ]) +
      K.callout('文本里可以直接用 **粗体** 与 `等宽` 两种标记，所有函数都会自动转义 HTML，不需要手动防注入。') +
      '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">PITFALLS</span>' +
      '<h2 style="margin-top:8px">四个常踩的坑</h2></div></div>' +
      '<div class="fails" style="grid-template-columns:1fr 1fr">' +
      '<div class="fail"><div class="fi">PITFALL 01</div><h5>script 顺序放反</h5><p>案例写在 shell.js 后面，页面已经渲染完了才注册，控制台里能看到但场景页没有 tab。案例脚本必须在 shell.js 之前。</p></div>' +
      '<div class="fail"><div class="fi">PITFALL 02</div><h5>sceneId 拼错</h5><p>id 区分大小写。写错不会报 JS 错误，只是这个案例永远不出现。控制台的"绑定场景"列会显示 ⚠。</p></div>' +
      '<div class="fail"><div class="fi">PITFALL 03</div><h5>demo 里没有清理</h5><p>用 setInterval / addEventListener 的示范要在 unmount 里清掉，否则切换场景后老定时器还在跑。</p></div>' +
      '<div class="fail"><div class="fi">PITFALL 04</div><h5>把样式写死在案例里</h5><p>内联颜色会让案例在改配色时掉队。颜色一律用 var(--jade) 这类令牌，或干脆用 K.* 生成。</p></div>' +
      '</div></div>' +

      '<div class="pending" style="margin-top:36px"><div class="pending-top">' +
      '<span class="badge-ready">下一步</span><h3>从最简单的案例开始</h3></div>' +
      '<p>如果还没有想好做什么，先挑一个 <b>数据现成、任务边界清晰</b> 的场景：把四段式写满、流程写三步、示范可以先不做。一个只有 80 行内容的案例，也比一个空着的场景有用。</p>' +
      '<div class="pending-actions">' +
      '<a class="btn primary" href="#/cases">看当前案例库 →</a>' +
      '<a class="btn" href="#/scene/w1">对照测井分层的写法</a></div></div>' +
      '</main>';
  }

  /* =========================================================
     十、调度
     ========================================================= */
  function unmountCurrent() {
    if (mounted && mounted.unmount) {
      try { mounted.unmount(); } catch (e) { }
    }
    mounted = null;
    mountedKey = '';
  }

  function render() {
    var r = parseHash();
    var p = r.parts;
    unmountCurrent();
    window.scrollTo(0, 0);

    var html;
    if (!p.length) html = homeHTML();
    else if (p[0] === 'chain') html = chainHTML();
    else if (p[0] === 'project') html = projectHTML();
    else if (p[0] === 'cases') html = casesHTML();
    else if (p[0] === 'guide') html = guideHTML();
    else if (p[0] === 'admin') html = global.Admin ? global.Admin.route(p, r.q) : notFound('管理模块未加载');
    else if (p[0] === 'stage') {
      var st = A.index.byStage[p[1]];
      html = st ? stageHTML(st, r.q) : notFound('没有这个环节');
    } else if (p[0] === 'method') {
      html = methodHTML(p[1]);
    } else if (p[0] === 'scene') {
      var sc = A.index.byScene[p[1]];
      html = sc ? sceneHTML(sc, r.q) : notFound('没有这个场景');
    } else html = notFound('页面不存在');

    /* 首页不挂左侧导航，进入具体页面后再显示 */
    var isHome = !p.length;
    if (wfStop) { wfStop(); wfStop = null; }
    view.innerHTML = header(isHome) +
      '<div class="plat' + (isHome ? ' plat-home' : '') + '">' +
      (isHome ? '' : railHTML()) +
      '<div class="plat-body">' + html + '</div></div>';

    if (global.IQAI) global.IQAI.bind(view);
    revealInit();
    markScroll();

    // 页面级交互
    if (!p.length) bindHome();
    if (p[0] === 'stage') bindFilters(view);
    if (p[0] === 'scene') {
      var sc2 = A.index.byScene[p[1]];
      var all2 = sc2 && Cases.bySceneAll(sc2.id);
      var c2 = all2 && all2.filter(function (x) { return x.id === r.q.case; })[0] || (all2 && all2[0]) || null;
      if (c2) bindTabs(sc2, c2);
      /* 多案例切换器 */
      [].forEach.call(view.querySelectorAll('.case-switch [data-case]'), function (b) {
        b.addEventListener('click', function () {
          var tab = parseHash().q.tab;
          go('#/scene/' + sc2.id + '?case=' + b.dataset.case + (tab ? '&tab=' + tab : ''));
        });
      });
    }
    if (p[0] === 'cases') {
      var rb = document.getElementById('rerun');
      if (rb) rb.addEventListener('click', render);
      bindLibrary();
    }
    if (p[0] === 'admin' && global.Admin) global.Admin.bind(view);
    document.title = pageTitle(p) + ' · 石油智能化案例平台';
  }

  function pageTitle(p) {
    if (!p.length) return '总览';
    if (p[0] === 'scene') { var s = A.index.byScene[p[1]]; return s ? s.name : '场景'; }
    if (p[0] === 'stage') { var t = A.index.byStage[p[1]]; return t ? t.name : '环节'; }
    if (p[0] === 'method') return M[p[1]] ? M[p[1]].name : '方法';
    if (p[0] === 'admin') return global.Admin && global.Admin.loggedIn() ? '管理后台' : '管理员登录';
    return { chain: '作业链', cases: '案例库', guide: '接入指南', project: '项目说明' }[p[0]] || '地图';
  }

  function notFound(msg) {
    return '<main class="wrap"><div class="empty" style="padding:120px 0"><b>' + esc(msg) + '</b>' +
      '检查地址，或<a href="#/" style="color:var(--jade-d)">回到总览</a>。</div></main>';
  }

  /* =========================================================
     十、案例库筛选
     ========================================================= */
  function bindLibrary() {
    var rows = [].slice.call(document.querySelectorAll('[data-lib-row]'));
    if (!rows.length) return;
    var q = document.getElementById('lib-q');
    var stage = document.getElementById('lib-stage');
    var method = document.getElementById('lib-method');
    var ready = document.getElementById('lib-ready');
    var count = document.getElementById('lib-count');

    function apply() {
      var kw = (q && q.value || '').trim().toLowerCase();
      var st = stage ? stage.value : '';
      var m = method ? method.value : '';
      var only = ready && ready.checked;
      var n = 0;
      rows.forEach(function (r) {
        var hay = (r.textContent || '') + ' ' + (r.getAttribute('data-code') || '') + ' ' + (r.getAttribute('data-id') || '');
        var hit = !kw || hay.toLowerCase().indexOf(kw) >= 0;
        if (hit && st) hit = r.getAttribute('data-stage') === st;
        if (hit && m) hit = (r.getAttribute('data-methods') || '').split(' ').indexOf(m) >= 0;
        if (hit && only) hit = r.getAttribute('data-ready') === '1';
        r.hidden = !hit;
        if (hit) n++;
      });
      if (count) count.textContent = n + ' / ' + rows.length + ' 个案例';
    }

    if (q) q.addEventListener('input', apply);
    if (stage) stage.addEventListener('change', apply);
    if (method) method.addEventListener('change', apply);
    if (ready) ready.addEventListener('change', apply);
    apply();
  }

  /* =========================================================
     十一、首页绑定
     ========================================================= */
  function bindHome() {
    var V = global.IQViz;
    if (V && V.counters) V.counters(view);
  }

  /* =========================================================
     十二、全局搜索（Ctrl / Cmd + K）
     ========================================================= */
  function cmdkHTML() {
    return '<div class="cmdk" id="cmdk" hidden>' +
      '<div class="cmdk-back"></div>' +
      '<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="全局搜索">' +
      '<div class="cmdk-top">' + ICON.search +
      '<input id="cmdk-input" type="text" placeholder="搜索环节、场景、案例或方法…" autocomplete="off" spellcheck="false">' +
      '<kbd>ESC</kbd></div>' +
      '<div class="cmdk-list"></div>' +
      '<div class="cmdk-f"><span>↑ ↓ 选择</span><span>↵ 打开</span><span>Ctrl K 唤起</span><span>Esc 关闭</span></div>' +
      '</div></div>';
  }

  function cmdkIndex() {
    var items = [
      { t: '页面', name: '总览', sub: '驾驶舱与案例展厅', href: '#/' },
      { t: '页面', name: '作业链', sub: '13 个环节的方法构成', href: '#/chain' },
      { t: '页面', name: '案例库', sub: '案例包与校验结果', href: '#/cases' },
      { t: '页面', name: '项目说明', sub: '学号 07 · 完井', href: '#/project' },
      { t: '页面', name: '接入指南', sub: '如何新增一个案例', href: '#/guide' }
    ];
    A.stages.forEach(function (st) {
      items.push({
        t: '环节', name: st.name,
        sub: st.idx + ' / ' + A.stages.length + ' · ' + st.scenes.length + ' 个场景',
        href: '#/stage/' + st.id
      });
      st.scenes.forEach(function (sc) {
        items.push({
          t: '场景', name: sc.name,
          sub: st.name + ' · ' + (sc.methods || []).map(function (k) { return M[k] ? M[k].abbr : k; }).join(' / '),
          href: '#/scene/' + sc.id
        });
      });
    });
    Object.keys(M).forEach(function (k) {
      items.push({
        t: '方法', name: M[k].name,
        sub: M[k].abbr + ' · ' + (A.index.byMethod[k] || []).length + ' 个场景',
        href: '#/method/' + k
      });
    });
    Cases.list().forEach(function (c) {
      var sc = A.index.byScene[c.sceneId];
      items.push({
        t: '案例', name: c.title,
        sub: (sc ? sc.stageName + ' / ' + sc.name : c.sceneId) + ' · 可运行',
        href: '#/scene/' + c.sceneId + '?tab=demo'
      });
    });
    return items;
  }

  var CMDK = { el: null, input: null, list: null, items: [], sel: 0, open: false, all: null };

  function cmdkSearch(q) {
    if (!CMDK.all) CMDK.all = cmdkIndex();
    if (!q) {
      /* 默认：六个案例 + 完井环节 + 几个页面 */
      return CMDK.all.filter(function (it) {
        return it.t === '案例' || (it.t === '环节' && it.name === ((A.index.byStage[(A.project || {}).stageId] || {}).name || ''));
      }).slice(0, 12);
    }
    var lq = q.toLowerCase(), out = [];
    CMDK.all.forEach(function (it) {
      var n = it.name.toLowerCase(), s = (it.sub || '').toLowerCase(), t = it.t.toLowerCase();
      var i = n.indexOf(lq);
      if (i < 0 && s.indexOf(lq) < 0 && t.indexOf(lq) < 0) return;
      out.push({ it: it, score: i === 0 ? 0 : i > 0 ? 1 : s.indexOf(lq) >= 0 ? 2 : 3 });
    });
    out.sort(function (a, b) { return a.score - b.score; });
    return out.slice(0, 24).map(function (o) { return o.it; });
  }

  function cmdkPaint(q) {
    if (!CMDK.list) return;
    var items = cmdkSearch(q);
    CMDK.items = items;
    if (CMDK.sel >= items.length) CMDK.sel = 0;
    if (!items.length) {
      CMDK.list.innerHTML = '<div class="cmdk-empty"><b>没有匹配结果</b><br>试试「完井」「射孔」「滑套」或方法名。</div>';
      return;
    }
    var html = '', group = '';
    items.forEach(function (it, i) {
      if (it.t !== group) {
        group = it.t;
        html += '<div class="cmdk-group">' + esc(group) + '</div>';
      }
      html += '<div class="cmdk-item' + (i === CMDK.sel ? ' on' : '') + '" data-i="' + i + '" data-href="' + esc(it.href) + '">' +
        '<span class="t">' + esc(it.t) + '</span>' +
        '<span class="nm">' + esc(it.name) + '</span>' +
        '<span class="sub">' + esc(it.sub || '') + '</span>' +
        '<span class="go">↵</span></div>';
    });
    CMDK.list.innerHTML = html;
    CMDK.list.scrollTop = 0;
  }

  function cmdkSetOpen(v) {
    if (!CMDK.el) return;
    CMDK.open = v;
    CMDK.el.hidden = !v;
    document.body.classList.toggle('cmdk-open', v);
    if (v) {
      CMDK.input.value = '';
      CMDK.sel = 0;
      cmdkPaint('');
      setTimeout(function () { try { CMDK.input.focus(); } catch (e) { } }, 20);
    }
  }

  function cmdkMove(d) {
    if (!CMDK.items.length) return;
    CMDK.sel = (CMDK.sel + d + CMDK.items.length) % CMDK.items.length;
    [].forEach.call(CMDK.list.querySelectorAll('.cmdk-item'), function (el, i) {
      if (i === CMDK.sel) el.classList.add('on'); else el.classList.remove('on');
    });
    var on = CMDK.list.querySelector('.cmdk-item.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  function cmdkGo(i) {
    var it = CMDK.items[i];
    if (!it) return;
    cmdkSetOpen(false);
    go(it.href);
  }

  function bindCmdk() {
    CMDK.el = document.getElementById('cmdk');
    if (!CMDK.el) return;
    CMDK.input = CMDK.el.querySelector('#cmdk-input');
    CMDK.list = CMDK.el.querySelector('.cmdk-list');

    CMDK.input.addEventListener('input', function () {
      CMDK.sel = 0;
      cmdkPaint(CMDK.input.value.trim());
    });
    CMDK.input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdkMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); cmdkGo(CMDK.sel); }
    });
    CMDK.el.addEventListener('mousedown', function (e) {
      if (e.target.classList.contains('cmdk-back')) cmdkSetOpen(false);
    });
    CMDK.list.addEventListener('click', function (e) {
      var it = e.target.closest ? e.target.closest('.cmdk-item') : null;
      if (!it) return;
      cmdkGo(Number(it.dataset.i));
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cmdk]') : null;
      if (t) { e.preventDefault(); cmdkSetOpen(true); }
      var rb = e.target.closest ? e.target.closest('[data-rail-toggle]') : null;
      if (rb) { e.preventDefault(); setRailCollapsed(!document.body.classList.contains('rail-collapsed')); }
      var rd = e.target.closest ? e.target.closest('[data-rail-drop]') : null;
      if (rd) {
        e.preventDefault();
        if (document.body.classList.contains('rail-collapsed')) setRailCollapsed(false);
        setRailDrop(!document.querySelector('.rail-drop').classList.contains('on'));
      } else if (!(e.target.closest && e.target.closest('.rail-drop'))) {
        setRailDrop(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable);
      var k = String(e.key || '').toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        cmdkSetOpen(!CMDK.open);
        return;
      }
      if (e.key === '/' && !typing && !CMDK.open) { e.preventDefault(); cmdkSetOpen(true); return; }
      if (e.key === 'Escape' && CMDK.open) { e.preventDefault(); cmdkSetOpen(false); }
      if (e.key === 'Escape' && !CMDK.open) setRailDrop(false);
    });
  }

  /* =========================================================
     十二、视觉层增强（不改结构，只加状态类）
     ---------------------------------------------------------
     1. 顶栏滚动后加深：给 .hdr 挂 .is-scrolled
     2. 内容滚入：给章节与卡片挂 .rv，进入视口后加 .in
     ========================================================= */
  var revealObs = null;

  function markScroll() {
    var h = document.querySelector('.hdr');
    if (h) h.classList.toggle('is-scrolled', (window.scrollY || 0) > 6);
  }

  function revealInit() {
    var nodes = document.querySelectorAll(
      '.plat-body .hero-main, .plat-body .hero-stats, .plat-body .stat-tile,' +
      '.plat-body .section, .plat-body .case-head'
    );
    if (!nodes.length) return;
    var vh = window.innerHeight || 800;
    var i, n, r, rest = [];

    /* 首屏元素立即播放，避免等待回调造成闪烁 */
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      r = n.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > 0) {
        n.style.animationDelay = (Math.min(i, 4) * 50) + 'ms';
        n.classList.add('rv');
      } else if (r.top > 0) {
        rest.push(n);
      }
    }

    if (!('IntersectionObserver' in window) || !rest.length) return;
    if (revealObs) revealObs.disconnect();
    revealObs = new IntersectionObserver(function (ents) {
      for (var k = 0; k < ents.length; k++) {
        if (!ents[k].isIntersecting) continue;
        ents[k].target.classList.add('rv');
        revealObs.unobserve(ents[k].target);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.03 });
    for (i = 0; i < rest.length; i++) revealObs.observe(rest[i]);
  }

  document.body.insertAdjacentHTML('beforeend', cmdkHTML());
  bindCmdk();
  window.addEventListener('scroll', markScroll, { passive: true });
  window.addEventListener('hashchange', render);
  render();
  revealInit();
  markScroll();

  // 启动自检：把注册阶段的异常打到控制台，便于排查
  var probs = Cases.problems();
  if (probs.length) console.warn('[case registry]', probs);

})(window);
