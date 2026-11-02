/* =========================================================
   自动生成：production-forecasting/case.json → 站点插件注册器
   不要手改本文件；改 case.json 或 demo/*，再跑 node tools/build-cases.js
   ========================================================= */
(function () {
  'use strict';
  var def = {
  "id": "production-forecasting",
  "sceneId": "pr2",
  "methods": [
    "ts"
  ],
  "code": "PR2",
  "title": "产量智能预测",
  "status": "ready",
  "version": "2.0.0",
  "updated": "2026-11-02",
  "highlight": "比起点预测，配产更需要知道区间有多宽。",
  "preview": "输入 6 项生产与注水参数 → 输出带 95% 区间的产量曲线与配产制度",
  "credibility": {
    "score": 74,
    "level": "中高",
    "basis": "历史段为固定合成观测，预测段叠加显式响应项；区间按预测步长展宽，未做真实井滚动回测。",
    "checks": [
      {
        "k": "数据",
        "v": "120 天历史 + 90 天预测"
      },
      {
        "k": "方法",
        "v": "指数递减 + 注水 / 含水响应"
      },
      {
        "k": "验证",
        "v": "历史拟合 R² 0.94，终点区间 ±17%"
      }
    ]
  },
  "conclusion": {
    "title": "AI 制度能多拿 19.5% 累产，代价是含水贴到上限",
    "html": "<p>AI 推荐井组注水 <b>600 m³/d</b>、油嘴 <b>14.0 mm</b>：90 天累产油 <b>3916 t</b>，比当前制度（3276 t）多 639 t（<b>+19.5%</b>）；期末日产 41.9 t/d、含水 <b>53.5%</b>，已接近 55% 上限。当前制度期末日产 34.7 t/d、含水 47.2%。</p><p>90 天末的 95% 区间约为 <b>±17%</b>，并随预测步长继续展宽。这个宽度不是保守，而是诚实：按公开的递减曲线复盘，只有 12 个月历史时，外推的最终可采量可能落在真值的 0.53—2.13 倍之间；24 个月收窄到 0.64—1.42 倍，48 个月才到 0.89—1.10 倍。本案例只有 120 天历史，任何“精确到个位”的预测都不可信。</p><p>含水一旦超限，多出来的油会被液量处理能力吃掉，所以配产要按月滚动，而不是一次预测用一年。</p>"
  },
  "limits": [
    "历史段为固定合成观测，未用真实井的制度变更事件做分段验证。",
    "注水响应按线性支撑处理，未含滞后、井组干扰与地层压力非均匀衰减；注水量按井组口径给出。",
    "区间由历史残差外推，长周期预测必须随实际产量与含水滚动更新。",
    "递减率与 b 值未做多模型对比；页岩 / 致密油在早期常出现 b&gt;1，无约束外推会显著高估。"
  ],
  "concept": {
    "title": "决策链",
    "steps": [
      {
        "k": "INPUT",
        "t": "生产与注水",
        "d": "产量、含水、油嘴、注水量"
      },
      {
        "k": "FIT",
        "t": "递减趋势拟合",
        "d": "指数递减 + 事件分段"
      },
      {
        "k": "RESPONSE",
        "t": "注水与含水响应",
        "d": "注水支撑递减，含水压产油"
      },
      {
        "k": "BAND",
        "t": "区间估计",
        "d": "残差外推 + 随步长展宽"
      },
      {
        "k": "OUTPUT",
        "t": "制度情景",
        "d": "累产对比、推荐注水与油嘴"
      }
    ]
  },
  "tabs": {
    "background": {
      "label": "专业背景",
      "judge": [
        {
          "label": "方法组合",
          "value": "NLP · TS · KG · OPT",
          "desc": "分段、预测、归因、配产"
        },
        {
          "label": "输入",
          "value": "6 项参数",
          "desc": "注水、油嘴、含水、递减、周期、上限"
        },
        {
          "label": "输出",
          "value": "预测与方案",
          "desc": "产量曲线、区间、累产、推荐制度"
        },
        {
          "label": "难度",
          "value": "中",
          "desc": "历史短、制度变化多，区间比点预测更重要",
          "html": "<span class=\"dtag\" data-d=\"中\">难度 中</span>"
        },
        {
          "label": "关键指标",
          "value": "区间覆盖",
          "desc": "95% 区间随步长展宽，长周期不外推自信",
          "html": "<b style=\"color:var(--clay-d);font-family:var(--mono)\">±17%</b>"
        }
      ],
      "lede": "产量预测是配产、措施筛选与年度规划的基础。现场常用递减曲线外推或经验类比，遇到注水调整、油嘴变更、含水上升时，单条递减曲线往往预测失真。先看一眼真实量级：我国老油田年自然递减率普遍在 10%—15%，中国石化 2023 年平均 10.3%（胜利 9.5%、西北 14%），长庆油田控制在 10.2% 左右；致密油与页岩油首年递减则常到 25%—40%。递减率差了 3 倍，外推的结论就差很远。",
      "sections": [
        {
          "no": 1,
          "en": "PROBLEM",
          "title": "当前做法与问题",
          "html": "<p>常规做法是选一段历史产量做指数或双曲递减拟合，外推到预测期；若近期有注水或油嘴调整，工程师再手工修正。</p><p>问题有四个：<b>制度变化不可比</b> —— 历史段里油嘴从 8 mm 换到 10 mm，直接拟合会把产能变化误判为递减；<b>含水耦合被忽略</b> —— 含水上升通过液量上限压低产油，单看产油曲线看不出来；<b>只有点预测</b> —— 给一个“90 天后 32 t/d”，却不说可信区间，配产决策没有风险边界；<b>b 值无约束</b> —— 双曲递减的 b 值一旦放开到 1 以上再无限外推，累积产量会趋于无穷，这是储量评估里最经典的高估陷阱。</p><figure style='margin:10px 0 0'><svg viewBox='0 0 620 180' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='注采井组示意'><rect width='620' height='180' fill='#fff'/><rect x='14' y='46' width='592' height='100' fill='#efe9dc'/><rect x='14' y='46' width='592' height='26' fill='#e8dfc9'/><g font-size='9.5' fill='#4d565b' font-family='sans-serif'><text x='20' y='40'>地面</text><text x='20' y='66' fill='#8a744a'>储层</text></g><g stroke='#8d979d' stroke-width='5'><line x1='110' y1='24' x2='110' y2='126'/><line x1='310' y1='24' x2='310' y2='126'/><line x1='510' y1='24' x2='510' y2='126'/></g><g fill='#41699b'><circle cx='110' cy='46' r='3'/><circle cx='110' cy='58' r='3'/><circle cx='110' cy='70' r='3'/></g><g fill='#b26a39'><circle cx='510' cy='58' r='3'/><circle cx='510' cy='70' r='3'/><circle cx='510' cy='82' r='3'/></g><g stroke='#41699b' stroke-width='1.4' stroke-dasharray='4 3' marker-end='url(#pr2-a)'><path d='M120 72 C220 70 260 78 300 88' fill='none'/><path d='M320 88 C400 92 440 96 500 96' fill='none'/></g><g stroke='#b26a39' stroke-width='1.2' marker-end='url(#pr2-b)'><line x1='510' y1='102' x2='510' y2='118'/></g><defs><marker id='pr2-a' markerWidth='5' markerHeight='5' refX='4' refY='2.5' orient='auto'><path d='M0 0 L5 2.5 L0 5 z' fill='#41699b'/></marker><marker id='pr2-b' markerWidth='5' markerHeight='5' refX='4' refY='2.5' orient='auto'><path d='M0 0 L5 2.5 L0 5 z' fill='#b26a39'/></marker></defs><g font-size='10' fill='#4d565b' text-anchor='middle' font-family='sans-serif'><text x='110' y='150'>注水井</text><text x='310' y='150'>采油井</text><text x='510' y='150'>采油井</text></g><text x='310' y='172' text-anchor='middle' font-size='9.5' fill='#9ba3a9'>图 1 · 注水井（蓝）向两侧采油井（棕）驱替；注水量影响地层压力与递减，含水率影响液量分配。</text></svg></figure>"
        },
        {
          "no": 2,
          "en": "INTERVENTION",
          "title": "AI 能做什么：分段、预测、归因、配产",
          "html": "<p>产量预测最容易犯的错，是把一段“混着换油嘴、关井、压裂”的历史直接拟合。所以方法链的第一环不是预测，而是<b>把历史切成可比的段</b>。</p><table class=\"dtable\"><thead><tr><th>工序</th><th>方法</th><th>在这一步做什么</th></tr></thead><tbody><tr><td>切分段</td><td>NLP · 事件抽取</td><td>从措施、作业、关井记录里抽出事件时间点，把历史切成“制度不变”的若干段，避免把换油嘴当成递减</td></tr><tr><td>做预测</td><td>TS · 时序建模</td><td>分段拟合递减率与 b 值，叠加注水支撑与含水耦合，区间随预测步长展宽</td></tr><tr><td>判归因</td><td>KG · 注采关系图</td><td>井组注采关系建成图，判断注水受效方向，避免把邻井见效算到本井头上</td></tr><tr><td>定配产</td><td>OPT · 情景搜索</td><td>在注水量与油嘴范围内搜索，含水上限约束下最大化阶段累产，同时保留保守/基准/积极三档</td></tr></tbody></table><p>四步里 <b>NLP</b> 和 <b>KG</b> 看起来最“不预测”，但它们决定了预测的输入对不对：事件切错段、注水归错井，后面的时序模型再精细也是错的。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 122' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='122' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">递减 + 注水响应 · 从历史序列到带区间的预测</text><rect x='14' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='23' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">01</text><text x='23' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>历史序列</text><text x='23' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>分段清洗</text><path d='M128 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='139' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='148' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">02</text><text x='148' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>趋势分解</text><text x='148' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>递减率</text><path d='M253 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='264' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='273' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">03</text><text x='273' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>注水响应</text><text x='273' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>增油贡献</text><path d='M378 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='389' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='398' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">04</text><text x='398' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>外推预测</text><text x='398' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>点 + 区间</text><path d='M503 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='514' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='523' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">05</text><text x='523' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>制度优化</text><text x='523' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>累产最大</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 2 · 产量下降不一定是自然递减——换油嘴、上措施、注水见效都会改变曲线；先把这些事件拆开，剩下的才是可外推的递减。</figcaption></figure>"
        },
        {
          "no": 3,
          "en": "DATA",
          "title": "需要准备什么",
          "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">生产历史</span><span class=\"cl-s\">日产油、日产水、含水率，≥90 天</span></span><span class=\"cl-n\">拟合递减率的底料</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">工作制度</span><span class=\"cl-s\">油嘴 / 变频档位、井口压力</span></span><span class=\"cl-n\">区分产能变化与递减</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">注水数据</span><span class=\"cl-s\">井组日注水量、注水压力、注采比</span></span><span class=\"cl-n\">响应项输入</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">措施与事件</span><span class=\"cl-s\">换油嘴、压裂、堵水、关井的时间点</span></span><span class=\"cl-n\">分段建模的切点</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">计量与测试</span><span class=\"cl-s\">计量方式、测试产量、关井记录</span></span><span class=\"cl-n\">剔除异常点的依据</span></div></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可参考的公开数据</span></p><div class=\"refs\"><span class=\"ref\">中国石化 2023 年自然递减率 10.3%（胜利 9.5%）</span><span class=\"ref\">长庆油田自然递减率控制在 10.2% 左右</span><span class=\"ref\">Arps 递减：常规 b=0—1，页岩早期 1.0—1.5</span></div><p style=\"margin-top:14px\" class=\"small muted\">口径提醒：<b>日产</b>要区分井口日产与计量日产、生产时间与实际天数；<b>含水</b>是体积含水还是质量含水；<b>注水量</b>是单井还是井组。油嘴 14 mm 这类大制度要注明是自喷还是电泵配套。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 186' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='186' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">生产数据表结构 · 一行一天</text><rect x='14' y='28' width='612' height='22' fill='#f1ede2' stroke='#e6e0d2'/><text x='85' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">日期</text><text x='212' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">产油 (t/d)</text><text x='325' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">产水 (t/d)</text><text x='431' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">油嘴 (mm)</text><text x='553' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">注水量 (m³/d)</text><rect x='14' y='50' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='85' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">2026-03-01</text><text x='212' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">18.4</text><text x='325' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">6.2</text><text x='431' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">6</text><text x='553' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">120</text><rect x='14' y='74' width='612' height='24' fill='#fbfaf6' stroke='#f0ece1' stroke-width='.7'/><text x='85' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">2026-03-02</text><text x='212' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">18.1</text><text x='325' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">6.4</text><text x='431' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">6</text><text x='553' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">120</text><rect x='14' y='98' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='85' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">2026-03-03</text><text x='212' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">12.6</text><text x='325' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">9.8</text><text x='431' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">8</text><text x='553' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">120</text><line x1='156' y1='28' x2='156' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='269' y1='28' x2='269' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='382' y1='28' x2='382' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='481' y1='28' x2='481' y2='122' stroke='#f0ece1' stroke-width='.7'/><rect x='14' y='137' width='7' height='7' rx='1.5' fill='#1e6f5c'/><text x='26' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">样本量</text><text x='26' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>单井 3 年约 1000 天</text><rect x='218' y='137' width='7' height='7' rx='1.5' fill='#a9852f'/><text x='230' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">标注成本</text><text x='230' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>无需标注，需事件台账</text><rect x='422' y='137' width='7' height='7' rx='1.5' fill='#a85249'/><text x='434' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">口径风险</text><text x='434' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>关井 / 测试日必须剔除</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 3 · 第三行是典型的「制度变化」：油嘴从 6 mm 放到 8 mm，产油反而降、产水升——如果直接拿去拟合递减率，结论会全错。</figcaption></figure>"
        },
        {
          "no": 4,
          "en": "DIFFICULTY",
          "title": "技术难度与参考方向",
          "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">模型简单，难在事件归因与长周期外推。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i></i></div><p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p><p>这个案例落在<b>中</b>：短期（30—90 天）预测不难，难在两处 —— 一是<b>制度变更的归因</b>，产量下降可能是递减、也可能是换小油嘴或含水上升；二是<b>长周期外推</b>，注水响应有滞后，递减率并非常数。评估指标要用 MAPE 与区间覆盖率，不能只看 R²（R² 高不代表外推对）。</p><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/ts\">指数平滑<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">时间序列分解<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">情景分析<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">区间估计<span class=\"ar\">↗</span></a></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">本案例用到的现实依据</span></p><div class=\"refs\"><span class=\"ref\">老油田自然递减率 10%—15%，石化 2023 年 10.3%</span><span class=\"ref\">12 / 24 / 48 个月历史对应的外推不确定性</span><span class=\"ref\">Arps b&gt;1 无限外推导致储量高估</span></div><p style=\"margin-top:18px\" class=\"small muted\">交叉环节：<a href=\"#/stage/production\" style=\"color:var(--jade-d);font-weight:600\">采油</a> · <a href=\"#/stage/injection\" style=\"color:var(--jade-d);font-weight:600\">注水</a></p>"
        }
      ]
    },
    "workflow": {
      "label": "案例流程",
      "title": "案例：G 井组 90 天配产与注水制度",
      "lead": [
        "G 井组 8 口采油井、3 口注水井，目标井当前日产 34—35 t/d、含水 47%，井组日注水 300 m³/d。目标是给出“在当前制度下产量会怎么走、区间多宽、换制度能改善多少”，而不是一个精确的点值。",
        "流程适用于单井与井组配产、年度规划与措施筛选；多井可共享响应参数，但递减率必须分井标定。"
      ],
      "stats": [
        [
          "历史长度",
          "120 天",
          true
        ],
        [
          "预测周期",
          "30—180 天",
          true
        ],
        [
          "评估",
          "MAPE / 覆盖率"
        ],
        [
          "累产提升",
          "+19.5%"
        ],
        [
          "期末含水",
          "53.5%（上限 55%）"
        ],
        [
          "终点区间",
          "±17%"
        ]
      ],
      "steps": [
        {
          "name": "生产数据清洗与事件分段",
          "role": "分段 · NLP",
          "do": "按油嘴、措施、修井事件把历史分段；剔除关井、测试与异常点，统一到生产时间口径。",
          "effect": "得到按制度分段、可直接拟合的干净序列",
          "trap": "把测试产量当正常生产，拟合出的产能偏高；把关井段当递减，递减率被高估。",
          "input": "日度产油 / 产水 / 油嘴 / 注水 + 事件表",
          "output": "分段干净序列",
          "viz": "原始序列 + 事件竖线 + 分段底色"
        },
        {
          "name": "趋势与响应特征",
          "role": "特征 · TS",
          "do": "用移动平均提取趋势，拟合递减率与 b 值；构造注水量、油嘴、含水率与时间特征，注水项加滞后。",
          "effect": "把“趋势”和“制度响应”拆成两件事",
          "trap": "注水与产量同期相关但存在滞后，直接回归会低估响应，也会把注水见效误判为递减变缓。",
          "input": "分段序列",
          "output": "递减率、b 值、注水响应系数",
          "viz": "递减拟合线 + 残差小图"
        },
        {
          "name": "预测模型与区间",
          "role": "预测 · TS",
          "do": "指数递减叠加注水支撑与含水耦合，预测产油、产水与含水；区间由历史残差估计，并按预测步长展宽。",
          "effect": "输出点预测 + 随步长张开的区间带",
          "trap": "区间不随步长展宽，长周期预测看起来过于确定；120 天历史给出的 90 天区间不可能只有 ±9%。",
          "input": "递减率、响应系数、含水趋势",
          "output": "产油 / 产水 / 含水 + 95% 区间",
          "viz": "预测曲线 + 展宽置信带"
        },
        {
          "name": "制度情景优化",
          "role": "寻优 · OPT",
          "do": "在注水量与油嘴范围内搜索，满足含水上限的前提下最大化累产油，同时保留保守 / 基准 / 积极三档情景。",
          "effect": "给出推荐制度与可接受的下沿方案",
          "trap": "只追求累产，忽略含水处理能力与注水设备上限；三档情景不设，会把单点最优当成唯一答案。",
          "input": "注水 / 油嘴范围、含水上限 55%",
          "output": "推荐制度 + 三档情景对比",
          "viz": "情景对比条 + 累产对比"
        },
        {
          "name": "配产复核与滚动更新",
          "role": "人工 · KG",
          "do": "结合集输能力、修井计划与经济性确认方案；投产后按月用实际产量与含水重算。",
          "effect": "预测随生产更新，不会一年后还在用同一张图",
          "trap": "一次预测用一年，实际含水早已越过上限。",
          "input": "集输能力、修井计划、实际产出",
          "output": "配产方案 + 月度滚动机制",
          "viz": "累产对比 + 月度更新瀑布图"
        }
      ],
      "metrics": {
        "title": "怎么算“预测得准”",
        "html": "<p>离线用滚动回测：用前 90 天预测后 30 天、用前 120 天预测后 90 天，分别算 MAPE 与区间覆盖率；在线看实际产量落在区间内的比例。<b>MAPE 小但覆盖率低</b>说明区间太窄，比误差大更危险 —— 它会让决策者误以为风险可控。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>本示范取值</th></tr></thead><tbody><tr><td>MAPE</td><td>预测与实际日产的平均绝对百分比误差</td><td>目标 ≤ 10%</td></tr><tr><td>区间覆盖率</td><td>实际值落在 95% 区间内的比例</td><td>目标 ≥ 90%</td></tr><tr><td>累产偏差</td><td>预测与实际的阶段累产差</td><td>≤ ±12%</td></tr><tr><td>区间宽度</td><td>90 天末 95% 区间半宽</td><td>±17%（示范）</td></tr></tbody></table>"
      },
      "fails": [
        {
          "name": "制度事件未分段",
          "why": "换油嘴造成的产量台阶被拟合为递减加速，预测会持续偏低。"
        },
        {
          "name": "区间过窄",
          "why": "用训练集残差直接当预测误差、不随步长展宽，长周期严重过度自信。"
        },
        {
          "name": "注水响应无滞后",
          "why": "注水增加当天就假设产量上升，实际响应可能滞后数周；应加滞后项。"
        },
        {
          "name": "b 值无约束",
          "why": "双曲递减 b≥1 且无限外推，累积产量趋于无穷；必须设终止递减率或改用适用模型。"
        }
      ]
    },
    "demo": {
      "__generated": true
    }
  }
};
  var key = "production-forecasting";
  def.tabs = def.tabs || {};
  def.tabs.demo = {
    label: "可运行示范",
    intro: "调整注水量、油嘴、初始含水、递减率、预测周期与含水上限，查看带置信区间的产量预测、情景对比与影响因素排序；点击“播放预测”逐日展开。",
    mode: 'module',
    mount: function (root) {
      root.innerHTML = '';
      if (true) root.style.minHeight = 780 + 'px';
      var fn = window.__IQ_DEMOS__ && window.__IQ_DEMOS__[key];
      if (typeof fn !== 'function') {
        root.innerHTML = '<div class="iq-miss"><b>示范脚本未加载</b><br>请确认 index.html 中已引入 ' +
          "production-forecasting/demo/demo.js" + '，且位于 shell.js 之前。</div>';
        return;
      }
      root.__iqLive = fn(root);
    },
    unmount: function () {
      var root = document.getElementById('case-demo-root');
      var live = root && root.__iqLive;
      if (live && typeof live.unmount === 'function') { try { live.unmount(); } catch (e) { } }
      if (root) root.__iqLive = null;
    }
  };
  Cases.register(def);
})();
