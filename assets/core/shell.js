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
    compare: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h7M4 12h10M4 18h6"/><path d="M17 8v10M14.5 15.5L17 18l2.5-2.5"/></svg>',
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

  function header() {
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
      '<a class="' + (cur === 'compare' ? 'on' : '') + '" href="#/compare">对比</a>' +
      '<a class="' + (cur === 'project' ? 'on' : '') + '" href="#/project">项目说明</a>' +
      '<a class="' + (cur === 'guide' ? 'on' : '') + '" href="#/guide">接入指南</a>' +
      '</nav>';

    return '<header class="hdr cmdbar"><div class="hdr-in">' +
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
      top === 'compare' ? 'compare' : top === 'project' ? 'project' :
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
      railLink('#/compare', 'compare', '案例对比', { on: navOn === 'compare', cnt: pc }) +
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

  function methodChip(k) {
    var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
    return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
  }

  function caseChip(k) {  /* 案例 methods 标签（小号） */
    var m = M[k];
    if (!m) return '';
    var ck = m.colorKey || k;
    return '<span class="mtag sm" data-m="' + ck + '"><b>' + esc(m.abbr) + '</b>' + esc(m.name) + '</span>';
  }

  function stageBar(stageId) {
    var counts = A.countByStageMethod()[stageId];
    var keys = Object.keys(counts).filter(function (k) { return counts[k] > 0; });
    if (!keys.length) return '<div class="step-bar"><i class="empty"></i></div>';
    return '<div class="step-bar">' + keys.map(function (k) {
      var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
      return '<i style="flex:' + counts[k] + ';background:var(--c-' + ck + ')"></i>';
    }).join('') + '</div>';
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

  function homeHTML() {
    var total = A.allScenes.length;
    var proj = A.project || {};
    var projStage = proj.stageId || 'completion';

    /* 13 个阶段是作业的第一条硬性要求：必须在首页列出来。
       用专用的 .hs-grid 而不是作业链页的 .chain —— 后者的 13 列网格在
       首页宽度下会被撑成横向超宽行，只能看到前几个环节。 */
    var stageCells = A.stages.map(function (st) {
      var isMine = st.id === projStage;
      return '<a class="hs-cell' + (isMine ? ' on' : '') + '" href="#/stage/' + st.id + '"' +
        (isMine ? ' aria-current="true"' : '') + '>' +
        '<span class="hs-dot"></span>' +
        '<span class="hs-idx">' + pad(st.idx) + (isMine ? ' 必做' : '') + '</span>' +
        '<span class="hs-name">' + esc(st.name) + '</span>' +
        '<span class="hs-n">' + st.scenes.length + '<i>场景</i></span>' +
        stageBar(st.id) + '</a>';
    }).join('');

    return '<main>' +
      /* ---------- Hero（深色主视觉） ---------- */
      '<section class="home-hero">' +
      '<div class="wrap hh-in">' +
      '<span class="hh-kicker"><i></i>PETRO × AI ATLAS<span class="sep">/</span>07 COMPLETION</span>' +
      '<h1>石油勘探开发的<em>智能化</em>案例实验平台</h1>' +
      '<p class="hh-lead">把 13 个作业环节拆成 ' + total + ' 个可判断的智能化场景；完井段落的 4 个必做案例与 2 个扩展案例，都配有能在浏览器里直接调参、看结果、读风险的示范。不展示结论，而是把结论的生成过程摊开给你。</p>' +
      '<div class="hh-points">' +
      '<span><i></i>13 环节 · ' + total + ' 场景</span>' +
      '<span><i></i>5 类方法交叉索引</span>' +
      '<span><i></i>6 个可运行示范</span>' +
      '<span><i></i>纯前端 · 离线可用</span>' +
      '</div>' +
      '<div class="hh-acts">' +
      '<a class="btn primary" href="#/chain">进入平台 <span class="ar">→</span></a>' +
      '<a class="btn ghost" href="#/project">项目说明</a>' +
      '</div>' +
      '<div class="hh-note"><p><b>数据声明：</b>本站所有曲线、指标与结论均由前端合成数据生成，用于教学与方法演示，不代表任何真实井的产能、受力或风险判断。案例包可离线运行，不依赖后端与外部接口。</p></div>' +
      '</div>' +
      '</section>' +

      /* ---------- 13 个阶段：作业链地图必须在首页可见 ---------- */
      '<section class="section" id="home-chain" style="padding-top:26px">' +
      '<div class="wrap">' +
      '<div class="sec-head">' +
      '<div class="sec-rail"><span class="sec-num">01</span><span class="kicker">13 STAGES</span></div>' +
      '<h2>13 个阶段，一条从勘探到加工的链</h2>' +
      '<p>石油勘探开发按作业顺序拆成 13 个环节，共 ' + total + ' 个可智能化场景。第 ' +
      pad(A.index.byStage[projStage] ? A.index.byStage[projStage].idx : 7) + ' 环节「' +
      esc(proj.stageName || '完井') + '」是本次作业的主线，已标为<b>必做</b>；点任一环节进入它的场景清单。</p>' +
      '</div>' +
      '<div class="hs-scroll"><div class="hs-grid">' + stageCells + '</div></div>' +
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
      '<p class="blurb">本平台以石油作业链第 07 环节「完井」为主线，交付 4 个必做案例；再以压裂优化与产量预测作为跨阶段扩展，验证同一套案例结构能否迁移到增采与采油。</p>' +
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
      '<p>必做 4 个案例全部完成；扩展 2 个案例分别落在增采与采油环节，用来检验案例结构、D3 组件与构建流程的复用性。</p>' +
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
      '<a class="btn sm" href="#/compare">案例对比</a>' +
      '<a class="btn sm ghost" href="#/cases">案例库</a>' +
      '</div></div>' +
      '</div>' +

      '<div class="section tight"><div class="sec-head">' +
      '<div class="sec-rail"><span class="sec-num">01</span><span class="kicker">TASK MAP</span></div>' +
      '<h2>学号 07 → 六个案例</h2>' +
      '<p>前四行是必做任务，后两行是扩展。每行都能直接打开对应示范。</p></div>' +
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
      '<li>全局搜索与案例对比：把 61 个场景与 6 个案例放在同一检索面。</li>' +
      '<li>本地 D3 组件层：作业链、方法分布、热力、等高线、区间带。</li>' +
      '</ul></div>' +
      '</div></div>' +
      '</main>';
  }

  /* =========================================================
     五、案例对比页
     ========================================================= */
  function compareHTML(q) {
    var cases = ownedCases();
    if (!cases.length) {
      return '<main class="wrap"><div class="empty"><b>还没有可对比的案例</b>先在案例库接入案例。</div></main>';
    }
    /* ?ids=co1,co2 由案例库勾选传入；未指定或匹配不足 2 个时展示全部 */
    var picked = String((q && q.ids) || '').split(',').filter(Boolean).map(function (x) {
      return x.trim().toLowerCase();
    });
    var selected = picked.length ? cases.filter(function (c) {
      return picked.indexOf(String(c.sceneId).toLowerCase()) >= 0 ||
        picked.indexOf(String(c.code || '').toLowerCase()) >= 0 ||
        picked.indexOf(String(c.id).toLowerCase()) >= 0;
    }) : [];
    var isPick = selected.length >= 2;
    if (isPick) cases = selected;
    var head = '<tr><th>对比维度</th>' + cases.map(function (c) {
      return '<th><span class="cc">' + esc(String(c.sceneId).toUpperCase()) + '</span>' +
        '<a href="#/scene/' + esc(c.sceneId) + '?tab=demo">' + esc(c.title) + '</a></th>';
    }).join('') + '</tr>';

    function row(label, fn) {
      return '<tr><th>' + label + '</th>' + cases.map(function (c) {
        var sc = A.index.byScene[c.sceneId] || {};
        return '<td>' + fn(c, sc) + '</td>';
      }).join('') + '</tr>';
    }

    var body =
      row('所属阶段', function (c, sc) { return esc(sc.stageName || '—'); }) +
      row('方法', function (c, sc) {
        return (c.methods && c.methods.length ? c.methods : (sc.methods || [])).map(caseChip).join('') || '—';
      }) +
      row('难度', function (c, sc) { return sc.diff ? K.dtag(sc.diff) : '—'; }) +
      row('可调参数', function (c) { return '<b>' + esc(String(caseSpec(c).params)) + '</b> 个'; }) +
      row('图表数量', function (c) { return '<b>' + esc(String(caseSpec(c).charts)) + '</b> 张'; }) +
      row('核心交互', function (c) { return esc(caseSpec(c).hot); }) +
      row('一句话价值', function (c) { return esc(caseSpec(c).blurb); }) +
      row('版本 / 更新', function (c) {
        return esc(c.version || '—') + '<br><span class="mono" style="font-size:9.5px;color:var(--ink-4)">' + esc(c.updated || '—') + '</span>';
      }) +
      row('打开', function (c) {
        return '<a class="btn sm" href="#/scene/' + esc(c.sceneId) + '?tab=demo">示范 →</a>';
      });

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/compare', '案例对比']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">CASE COMPARISON · ' + cases.length + ' 个案例' + (isPick ? ' · 自案例库勾选' : '') + '</div>' +
      '<h1>' + (isPick ? '勾选案例横向对比' : '六个案例放在一张表里') + '</h1>' +
      '<p class="blurb">' + (isPick
        ? '只展示你在案例库勾选的 ' + cases.length + ' 个案例。换一组：回案例库重新勾选，或'
        : '同样一套案例结构，分别落在完井、增采、采油三个阶段。对比参数规模、图表数量与核心交互，可以看出“深度交互案例”与“中深度案例”的差别在哪里。想只看其中几个：') +
      '<a href="#/cases" style="color:var(--jade-d)">去案例库勾选</a>。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + cases.length + '</div><div class="l">案例</div></div>' +
      '<div><div class="n">' + cases.filter(function (c) { return (A.project.requiredIds || []).indexOf(c.id) >= 0; }).length + '</div><div class="l">必做</div></div>' +
      '<div><div class="n">' + cases.filter(function (c) { return (A.project.extensionIds || []).indexOf(c.id) >= 0; }).length + '</div><div class="l">扩展</div></div>' +
      '</div></div></div>' +
      '<div class="compare-wrap"><table class="compare"><thead>' + head + '</thead><tbody>' + body +
      '</tbody></table></div>' +
      '<div class="compare-actions">' +
      '<a class="btn" href="#/cases">案例库与校验 →</a>' +
      '<a class="btn ghost" href="#/project">看项目说明</a>' +
      '</div></main>';
  }

  /* =========================================================
     六、链条总览页
     ========================================================= */
  function chainHTML() {
    var rows = A.stages.map(function (st) {
      var top = st.scenes.slice(0, 5).map(function (s) { return s.name; }).join('、');
      /* 汇总全环节涉及的方法并去重，避免同一方法胶囊重复出现（只取前 3 种） */
      var mseen = [];
      st.scenes.forEach(function (s) {
        (s.methods || []).forEach(function (k) {
          if (mseen.indexOf(k) < 0) mseen.push(k);
        });
      });
      var chips = mseen.slice(0, 3).map(function (k) { return methodChip(k); }).join('');
      return '<a class="scene-row" href="#/stage/' + st.id + '" style="grid-template-columns:52px 1fr auto">' +
        '<div class="sr-n" style="padding-top:9px">' + pad(st.idx) + '</div>' +
        '<div><div class="sr-name">' + esc(st.name) +
        '<span class="mono" style="font-size:9.5px;color:var(--ink-4);letter-spacing:.14em">' + esc(st.en).toUpperCase() + '</span>' +
        '<span class="arrow">→</span></div>' +
        '<div class="sr-point">' + esc(st.blurb) + '</div>' +
        '<div class="sr-meta">' + chips +
        '<span class="tag" style="margin-left:4px">' + esc(top) + (st.scenes.length > 5 ? '…' : '') + '</span></div></div>' +
        '<div class="sr-right"><span class="mono" style="font-size:19px;color:var(--ink-2)">' + st.scenes.length + '</span>' +
        '<span class="small muted">场景</span></div></a>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/chain', '作业链']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">CHAIN · ' + A.stages.length + ' 个环节</div>' +
      '<h1>从地质勘察到加工的全链条</h1>' +
      '<p class="blurb">上游到下游按作业顺序排列。每个环节标注可智能化的场景数量与方法构成，点进去看清单。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + A.stages.length + '</div><div class="l">环节</div></div>' +
      '<div><div class="n">' + A.allScenes.length + '</div><div class="l">场景</div></div>' +
      '</div></div></div>' +
      '<div class="scenes">' + rows + '</div></main>';
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
    if (c) {
      if (c.tabs.background) tabs.push({ key: 'bg', num: '01', name: c.tabs.background.label || '专业背景' });
      if (c.tabs.workflow) tabs.push({ key: 'flow', num: '02', name: c.tabs.workflow.label || '案例流程' });
      if (c.tabs.demo) tabs.push({ key: 'demo', num: '03', name: c.tabs.demo.label || '可运行示范' });
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
        (spec.charts ? '<span class="cm"><b>图表</b>' + esc(String(spec.charts)) + ' 张 D3</span>' : '') +
        '<span class="cm"><b>难度</b>' + esc(sc.diff) + '</span>' +
        '<span class="cm ok"><b>示范</b>可运行</span>' +
        '<span class="cm"><b>版本</b>v' + esc(c.version || '—') + ' · ' + esc(c.updated || '') + '</span>' +
        '</div>' +
        '<div class="ch-acts">' +
        '<a class="btn primary sm" href="#/scene/' + sc.id + '?tab=demo">打开可运行示范 →</a>' +
        '<a class="btn sm ghost" href="#/scene/' + sc.id + '?tab=flow">看案例流程</a>' +
        (allCases.length > 1 ? '<a class="btn sm ghost" href="#/scene/' + sc.id + '?tab=background">切换其他案例（' + allCases.length + '）</a>' : '<a class="btn sm ghost" href="#/compare">与其他案例对比</a>') +
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
      if (key === 'demo') mountDemo(sc, c);
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

    var ownedIds = ownedCaseIds();
    var rows = list.map(function (c) {
      var sc = A.index.byScene[c.sceneId];
      var canPick = ownedIds.indexOf(c.id) >= 0;
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
        '<td class="pickcell"><input type="checkbox" class="lib-pick" value="' + esc(c.sceneId) + '"' +
        (canPick ? '' : ' disabled title="示例案例不参与案例对比"') +
        ' aria-label="选择 ' + esc(c.title || c.id) + ' 参与对比"></td>' +
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
        '<button class="btn sm primary" id="lib-compare" disabled>对比所选（0）</button>' +
      '</div>' +
      '<div class="matrix-wrap" style="box-shadow:var(--sh-1)">' +
      '<table class="sys-table"><thead><tr>' +
      '<th class="pickcell" title="勾选 2 个及以上可横向对比">选</th><th>案例 id</th><th>绑定场景</th><th>涉及技术</th><th>版本</th><th>更新</th><th>三块内容</th><th>校验</th><th></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">还没有任何案例注册</td></tr>') + '</tbody></table></div>' +
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
        ['demo/iq-viz.js', '可选', '共享可视化组件；只有首页/对比用到时才需要'],
        ['id', '必填', '小写字母 / 数字 / 连字符，全站唯一'],
        ['sceneId', '必填', '绑定场景，等于选定分类（环节 + 方法自动带出）'],
        ['title', '必填', '案例名称，页头与列表都用它'],
        ['tabs.background.sections[]', '必填', '每段 { title, html }；建议四段'],
        ['tabs.background.judge', '可选', '「30 秒判断」四格 { label, value, desc }'],
        ['tabs.workflow.steps[]', '可选', '每步 { name, input, do, output, viz, effect, trap }'],
        ['tabs.demo.mode', '可选', 'auto（默认）/ page / module / builtin，一般不用写'],
        ['tabs.demo.builtin', '可选', '复用某个已有案例的示范（填它的 id）'],
        ['code', '可选', '展示编号 CO1 / E1 / PR2，用于案例头与对比页'],
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
    else if (p[0] === 'compare') html = compareHTML(r.q);
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
    view.innerHTML = header() +
      '<div class="plat' + (isHome ? ' plat-home' : '') + '">' +
      (isHome ? '' : railHTML()) +
      '<div class="plat-body">' + html + '</div></div>';

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
    return { chain: '作业链', cases: '案例库', guide: '接入指南', project: '项目说明', compare: '案例对比' }[p[0]] || '地图';
  }

  function notFound(msg) {
    return '<main class="wrap"><div class="empty" style="padding:120px 0"><b>' + esc(msg) + '</b>' +
      '检查地址，或<a href="#/" style="color:var(--jade-d)">回到总览</a>。</div></main>';
  }

  /* =========================================================
     十、案例库筛选与对比勾选
     ========================================================= */
  function bindLibrary() {
    var rows = [].slice.call(document.querySelectorAll('[data-lib-row]'));
    if (!rows.length) return;
    var q = document.getElementById('lib-q');
    var stage = document.getElementById('lib-stage');
    var method = document.getElementById('lib-method');
    var ready = document.getElementById('lib-ready');
    var count = document.getElementById('lib-count');
    var btn = document.getElementById('lib-compare');

    function picked() {
      return rows.filter(function (r) {
        var cb = r.querySelector('.lib-pick');
        return cb && cb.checked;
      });
    }

    function syncPick() {
      var ps = picked();
      if (btn) {
        btn.disabled = ps.length < 2;
        btn.textContent = '对比所选（' + ps.length + '）';
      }
    }

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
      syncPick();
    }

    if (q) q.addEventListener('input', apply);
    if (stage) stage.addEventListener('change', apply);
    if (method) method.addEventListener('change', apply);
    if (ready) ready.addEventListener('change', apply);
    [].forEach.call(document.querySelectorAll('.lib-pick'), function (cb) {
      cb.addEventListener('change', syncPick);
    });
    if (btn) {
      btn.addEventListener('click', function () {
        var ids = picked().map(function (r) {
          var cb = r.querySelector('.lib-pick');
          return cb ? cb.value : '';
        }).filter(Boolean);
        if (ids.length >= 2) go('#/compare?ids=' + ids.join(','));
      });
    }
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
      { t: '页面', name: '案例对比', sub: '六个案例并排', href: '#/compare' },
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
