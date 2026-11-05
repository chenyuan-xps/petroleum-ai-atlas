/* =========================================================
   跨环节案例 · p3 射孔弹型智能选型
   ---------------------------------------------------------
   场景：射孔（08）
   方法：知识图谱 · 规则匹配 / 语义检索
   示范：弹型参数库 → 硬约束过滤 → 综合排序
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var GUNS = [
    { id: 'A', name: 'A · 深穿透型', pen: 610, hole: 8.2, dmg: 0.82 },
    { id: 'B', name: 'B · 大孔径型', pen: 420, hole: 13.0, dmg: 0.45 },
    { id: 'C', name: 'C · 均衡型', pen: 520, hole: 10.5, dmg: 0.58 },
    { id: 'D', name: 'D · 低损伤型', pen: 360, hole: 9.0, dmg: 0.22 },
    { id: 'E', name: 'E · 高温深穿型', pen: 560, hole: 9.5, dmg: 0.70 },
    { id: 'F', name: 'F · 大孔中穿型', pen: 470, hole: 12.0, dmg: 0.52 }
  ];

  function compute(st) {
    var reqPen = st.strength * 3.2 + st.wall * 14;
    var dmgLimit = Math.max(0.2, 0.95 - st.wall * 0.035);
    var rows = GUNS.map(function (g) {
      var passPen = g.pen >= reqPen;
      var passHole = g.hole >= st.holeMin;
      var passDmg = g.dmg <= dmgLimit;
      var score = 0.45 * (g.pen / 650) + 0.30 * (g.hole / 14) + 0.25 * (1 - g.dmg);
      return {
        id: g.id, name: g.name, pen: g.pen, hole: g.hole, dmg: g.dmg,
        ok: passPen && passHole && passDmg,
        passPen: passPen, passHole: passHole, passDmg: passDmg,
        score: score
      };
    });
    rows.sort(function (a, b) { return b.score - a.score; });
    var eligible = rows.filter(function (r) { return r.ok; });
    var best = eligible[0] || null;
    var fallback = rows[0];

    return {
      kpis: [
        { label: '推荐弹型', value: best ? best.name : '无可行弹型', wide: true, tone: best ? 'ok' : 'bad' },
        { label: '穿深裕量', value: best ? (best.pen - reqPen).toFixed(0) : '—', unit: 'mm', tone: best && best.pen >= reqPen ? 'ok' : 'bad' },
        { label: '孔径', value: best ? best.hole.toFixed(1) : '—', unit: 'mm' },
        { label: '套管损伤指数', value: best ? best.dmg.toFixed(2) : '—', tone: best && best.dmg > dmgLimit ? 'bad' : '' },
        { label: '硬约束通过', value: eligible.length + ' / ' + rows.length, unit: '型', wide: true, tone: eligible.length ? '' : 'bad' }
      ],
      chart: {
        type: 'bars',
        title: '六种弹型的综合评分',
        hint: '灰条=未通过硬约束（仍有评分，但不可选）',
        items: rows.map(function (r) {
          return {
            name: r.name,
            note: '穿深 ' + r.pen + ' · 孔径 ' + r.hole + ' · 损伤 ' + r.dmg.toFixed(2),
            value: r.score * 100,
            text: (r.score * 100).toFixed(0),
            color: r.ok ? '#3a352d' : '#cfc8b6',
            bad: !r.ok,
            hl: best && r.id === best.id
          };
        }),
        max: 100,
        unit: '',
        threshold: null,
        legend: [
          { color: '#3a352d', label: '通过硬约束' },
          { color: '#cfc8b6', label: '未通过（穿深 / 孔径 / 损伤）' }
        ]
      },
      table: {
        head: ['口径', '手册“常用弹”', '本次检索'],
        rows: [
          ['弹型', 'A · 深穿透型', best ? best.name : '无'],
          ['穿深需求', '按经验估 ' + Math.round(reqPen * 0.85) + ' mm', '硬约束 ≥ ' + reqPen.toFixed(0) + ' mm'],
          ['套管损伤', '未单独校核', best ? '指数 ' + best.dmg.toFixed(2) + '（上限 ' + dmgLimit.toFixed(2) + '）' : '—'],
          ['硬约束', '1 项（穿深）', '3 项（穿深 / 孔径 / 损伤）']
        ],
        hl: 1
      },
      verdict: {
        label: best ? '选型结论' : '约束冲突',
        value: best ? best.name : '需调整设计',
        tone: best ? 'ok' : 'bad',
        html: best
          ? '<b>' + best.name + ' 同时满足穿深、孔径与套管损伤三项硬约束。</b>排序只回答“在可行集里谁更均衡”，不证明它一定增产；正式选型仍应做 1—2 发地面靶试，核对混凝土靶穿深与套管损伤。'
          : '<b>没有弹型能同时满足三项硬约束。</b>应先复核岩性强度与套管壁厚的取值，或调整孔径下限；继续在不可行集里排序只会给出“看起来有分、实际不能用”的答案。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'perforation-gun-selection',
    sceneId: 'p3',
    code: 'P3',
    title: '射孔弹型智能选型',
    methods: ['kg'],

    highlight: '选型不是“挑穿深最大的”，而是先过三道硬约束，再在可行集里排序。',
    preview: '六种弹型 × 穿深 / 孔径 / 损伤 → 硬约束过滤 → 综合评分与推荐',

    credibility: {
      score: 72,
      level: '中高',
      basis: '弹型参数按厂家手册量级简化，硬约束（穿深、孔径、套管损伤）由井况计算；评分权重是示范设定，未经靶试与现场效果标定。',
      checks: [
        { k: '数据', v: '6 种弹型 × 3 项参数' },
        { k: '方法', v: '硬约束过滤 + 加权评分' },
        { k: '验证', v: '逐项约束核验与排序' }
      ]
    },

    conclusion: {
      title: '默认井况下 B 型胜出：深穿型被套管损伤约束挡掉',
      html: '<p>默认“壁厚 10 mm、岩性强度 70 MPa、孔径下限 10 mm”时，穿深需求约 <b>364 mm</b>、损伤上限约 <b>0.60</b>。A 型虽然穿深最高，但损伤指数 0.82 超过上限；D 型损伤最低，但穿深不足。B 型在可行集里综合评分最高。</p><p>这个结论只对当前参数成立。壁厚、岩性强度与孔径下限任一变化，可行集就会变；<b>排序结果不是“最佳弹型”的证明</b>，正式选型仍需靶试与厂家数据核对。</p>'
    },
    limits: [
      '弹型参数为手册量级简化值，未区分不同厂家、不同枪型与不同混凝土靶条件；真实选型必须以靶试报告为准。',
      '岩性强度与套管壁厚按输入值计算，现场若用邻井数据外推，穿深需求会明显偏差。',
      '评分权重（穿深 0.45 / 孔径 0.30 / 损伤 0.25）是示范设定，不同油田的偏好不同。',
      '未考虑孔密、相位、射孔液与负压差对产能的影响；弹型只是射孔设计的一项。'
    ],

    concept: {
      title: '从井况到弹型',
      steps: [
        { k: 'INPUT', t: '井况', d: '岩性强度、套管钢级与壁厚' },
        { k: 'LIB', t: '弹型库', d: '型号、穿深、孔径、适用套管' },
        { k: 'SCREEN', t: '硬约束', d: '穿深 / 孔径 / 损伤上限' },
        { k: 'RANK', t: '综合评分', d: '可行集内加权排序' },
        { k: 'TEST', t: '靶试确认', d: '地面靶试 + 现场反馈' }
      ]
    },

    judge: [
      { label: '任务类型', value: '知识图谱 + 规则匹配', desc: '结构化检索，不是端到端预测' },
      { label: '数据门槛', value: '弹型手册结构化', desc: '型号、穿深、孔径、适用套管' },
      { label: '收益', value: '0.5—1 h → 分钟级', desc: '选型时间，含约束校核', html: '<b style="font-family:var(--mono)">h → min</b>' },
      { label: '难度', value: '低', desc: '数据可整理，风险可控', html: '<span class="dtag" data-d="低">难度 低</span>' },
      { label: '关键原则', value: '先硬约束', desc: '不可行的弹型不参与排序', html: '<b style="color:var(--clay-d);font-family:var(--mono)">3 道</b>' }
    ],

    lede: '不同射孔弹在穿深、孔径与对套管的损伤上各有取舍，选型要匹配岩性、套管钢级与完井方式。现场长期靠手册与“常用弹”经验 —— 手册更新慢，常用弹未必是当前井的最优，甚至可能不满足套管损伤约束。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>选型的依据通常是一本弹型手册：查穿深、查孔径、看适用套管，再凭经验挑一个“用得顺”的型号。问题有三：<b>手册参数与现场靶试条件不完全一致</b>；<b>“常用弹”形成路径依赖</b>，新井况未必适用；<b>套管损伤很少被单独校核</b>，但它直接影响后续压裂与井筒完整性。</p>' +
          '<p>更隐蔽的是：穿深、孔径、损伤三者互相牵制。追求穿深往往加大损伤，追求孔径往往牺牲穿深。选型本质上是一个<b>带硬约束的多指标取舍</b>，不是查表选最大值。</p>' +
          K.figure(G.fieldSVG('perforation'), 1, '射孔示意：射孔弹在套管内起爆，金属射流穿过套管与水泥环进入地层，形成孔眼与孔道。穿深、孔径与套管损伤是同一发弹的三个侧面。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>把弹型手册、套管规格、岩性与使用反馈组织成<b>知识图谱</b>：型号—参数—适用条件—效果。选型时先按井况做<b>硬约束过滤</b>（穿深需求、孔径下限、套管损伤上限），再在可行集内做加权排序或案例推理。</p>' +
          '<p>这不是“预测哪个弹更好”，而是<b>结构化检索 + 规则校核</b>。模型的价值在于不漏掉可行型号、不把不可行型号排到前面，并让每一条约束都可追溯。</p>' +
          K.figure(G.flowSVG([
            ['井况与套管', '岩性强度 · 壁厚 · 钢级', '#5d7fa3'],
            ['弹型库', '手册结构化 + 反馈', '#8a4b2d'],
            ['硬约束过滤', '穿深 · 孔径 · 损伤', '#7e5a8d'],
            ['可行集排序', '加权 / 案例推理', '#b26a39'],
            ['靶试确认', '地面靶试 · 现场反馈', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 3 步是“减法”：不可行型号直接退出排序，避免“分数高但不能用”。' }), 2, '五步选型流程。第 2 步的数据质量决定上限：手册参数不统一，后面的约束就不可信。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['射孔弹参数库', '型号、穿深、孔径、适用套管、枪型', '厂家手册结构化'],
            ['井况参数', '岩性强度、孔隙压力、温度', '无需标注'],
            ['套管与井身结构', '钢级、壁厚、尺寸、狗腿度', '硬约束输入'],
            ['地面靶试报告', '混凝土靶条件与结果', '校核手册值'],
            ['使用反馈', '实际产能、套管损伤、作业问题', '少量标注，用于修正']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['射孔弹厂家手册与 API RP 19B 靶试规范', '射孔参数与产能关系教材'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('低') + '<span class="small muted">结构化检索，数据可从手册整理，风险可控。</span></div>' +
          K.meter('低') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>低</b>：不需要训练大模型，重点是把手册数据结构化、把硬约束写清楚。真正的风险不在算法，而在<b>参数口径</b>：同一型号在不同靶试条件下的穿深可能差 10%—20%。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['知识图谱', '规则匹配', '语义检索'], '#/method/kg') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/completion" style="color:var(--jade-d);font-weight:600">完井</a> · <a href="#/stage/production" style="color:var(--jade-d);font-weight:600">采油</a></p>'
      }
    ],

    workflowTitle: '案例：一口水平井的射孔弹选型',
    lead: [
      '某水平井准备射孔完井，套管壁厚 10 mm，储层岩性强度中等。现场习惯用深穿透弹，但该井后续还要压裂，套管损伤必须控制。目标是把**选型从查手册的 0.5—1 小时压到分钟级**，并让三条硬约束都可追溯。',
      '这个案例的“智能”不在模型，而在**把约束显式化**：先过滤、再排序。第 5 步的靶试仍然不能省。'
    ],
    stats: [
      ['候选弹型', '6'], ['硬约束', '3 项'], ['参数维度', '穿深 / 孔径 / 损伤'],
      ['原耗时', '0.5—1 h'], ['目标', '分钟级'], ['靶试', '1—2 发']
    ],
    steps: [
      {
        name: '井况与套管收集', role: '工程环节',
        input: '岩性强度、套管钢级与壁厚、井眼轨迹',
        do: '统一单位与口径，确认岩性强度来源（测井 / 取心 / 邻井）。',
        output: '可计算的井况参数',
        viz: '井况参数表',
        effect: '约束有明确的输入，不再“拍脑袋”',
        trap: '用邻井强度外推而不标注，穿深需求会系统性偏差'
      },
      {
        name: '弹型库结构化', role: '工程环节',
        input: '厂家手册 + 靶试报告',
        do: '把型号、穿深、孔径、适用套管、枪型整理成表；标注靶试条件与数据来源。',
        output: '可检索的弹型库',
        viz: '弹型参数矩阵',
        effect: '不同型号可以在同一口径下比较',
        trap: '手册穿深条件不一致，直接比较会误导'
      },
      {
        name: '硬约束过滤', role: '算法核心',
        input: '井况 + 弹型库',
        do: '按穿深需求、孔径下限、套管损伤上限逐项过滤，记录每型未通过的原因。',
        output: '可行弹型集合',
        viz: '约束通过矩阵',
        effect: '不可行型号不会进入排序',
        trap: '只过滤穿深，会把损伤超标的型号排到第一'
      },
      {
        name: '可行集排序', role: '效果关键',
        input: '可行弹型 + 权重',
        do: '按穿深、孔径、损伤加权评分，输出排序与每项贡献；支持换权重重排。',
        output: '推荐弹型 + 备选',
        viz: '评分条形图',
        effect: '结论可复核，权重可讨论',
        trap: '权重不透明，排序会变成新的“黑箱经验”'
      },
      {
        name: '靶试与反馈', role: '闭环',
        input: '推荐弹型 + 靶试条件',
        do: '做 1—2 发地面靶试，核对穿深与套管损伤；现场使用后回写效果。',
        output: '确认后的弹型与参数',
        viz: '靶试结果对比',
        effect: '把“手册值”变成“本区块可信值”',
        trap: '不做靶试，手册误差会直接进入施工'
      }
    ],
    metricsTitle: '怎么算“选型对了”',
    metricsHtml: '<p>射孔选型没有“唯一正确答案”，但可以做可追溯的约束校核。指标不是模型准确率，而是<b>约束是否满足、排序是否稳定、现场是否可用</b>。</p>' +
      K.dtable(['指标', '定义', '为什么必须看'], [
        ['硬约束通过率', '可行型号 / 候选型号', '先保证“能用”'],
        ['穿深裕量', '实际穿深 − 需求穿深（mm）', '裕量太小，岩性变化就会不够'],
        ['孔径满足率', '孔径 ≥ 下限的型号占比', '影响产能与后续作业'],
        ['排序稳定性', '权重扰动下第一名是否翻转', '判断结论是否依赖主观权重']
      ]) +
      '<p style="margin-top:10px">最终验收仍要看<b>现场产能与套管完整性</b>，而不是评分表。</p>',
    fails: [
      { name: '手册口径不一', why: '不同厂家的穿深是在不同混凝土靶、不同枪型下测的，直接比较会高估或低估。必须统一到同一靶试条件。' },
      { name: '岩性强度估计偏差', why: '用邻井或经验值代替本井强度，穿深需求会偏。应尽量用测井或取心数据。' },
      { name: '只看穿深', why: '深穿透弹往往孔径小、损伤大。后续要压裂或防砂时，孔径与套管完整性同样关键。' },
      { name: '套管损伤不可见', why: '损伤指数不是唯一判据，实际还要看套管钢级、壁厚与后续施工压力。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 弹型选型',
      title: '先过三道硬约束，再在可行集里排序',
      desc: '六种弹型的穿深、孔径与套管损伤已知。调整套管壁厚、岩性强度与孔径下限，看哪些型号被硬约束挡掉，推荐结果如何变化。',
      chartTitle: '六种弹型的综合评分',
      chartHint: '灰条=未通过硬约束',
      controls: [
        { key: 'wall', label: '套管壁厚', min: 7, max: 14, step: 0.1, value: 10, display: function (v) { return v.toFixed(1) + ' mm'; } },
        { key: 'strength', label: '岩性强度', min: 30, max: 120, step: 1, value: 70, display: function (v) { return v + ' MPa'; } },
        { key: 'holeMin', label: '孔径下限', min: 8, max: 14, step: 0.5, value: 10, display: function (v) { return v.toFixed(1) + ' mm'; } }
      ],
      tags: [
        { text: 'KG · 规则匹配', tone: 'jade' },
        { text: '硬约束', tone: '' },
        { text: '靶试确认', tone: 'clay' }
      ],
      compute: compute,
      foot: '弹型参数为手册量级简化值；真实选型须按 API RP 19B 靶试与厂家数据核对，示范不构成施工依据。'
    }
  });
})();
