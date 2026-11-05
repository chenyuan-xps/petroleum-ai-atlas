/* =========================================================
   跨环节案例 · wo1 修井作业方案智能推荐
   ---------------------------------------------------------
   场景：修井（10）
   方法：知识图谱 + 文本信息抽取
   示范：故障类型 + 确认度 + 预算 → 方案排序与预期费用
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var FAULTS = [
    { value: 'fish', label: '井下落物' },
    { value: 'stuck', label: '砂卡' },
    { value: 'casing', label: '套管变形' },
    { value: 'water', label: '出水' }
  ];

  var OPTIONS = [
    { id: 'fish', name: '打捞落物', cost: 80, days: 6, p: { fish: 0.90, stuck: 0.25, casing: 0.10, water: 0.05 } },
    { id: 'stuck', name: '解卡', cost: 60, days: 4, p: { fish: 0.15, stuck: 0.90, casing: 0.15, water: 0.10 } },
    { id: 'casing', name: '套管整形', cost: 140, days: 12, p: { fish: 0.20, stuck: 0.20, casing: 0.85, water: 0.15 } },
    { id: 'water', name: '堵水', cost: 110, days: 9, p: { fish: 0.05, stuck: 0.05, casing: 0.10, water: 0.85 } },
    { id: 'sidetrack', name: '侧钻', cost: 420, days: 30, p: { fish: 0.40, stuck: 0.45, casing: 0.70, water: 0.50 } }
  ];

  function compute(st) {
    var fault = st.fault || 'fish';
    var budget = st.budget;
    var sure = st.sure;
    var rows = OPTIONS.map(function (o) {
      var baseP = o.p[fault];
      var p = Math.min(0.98, baseP * (0.85 + 0.2 * sure));
      var expCost = o.cost + (1 - p) * (o.cost * 1.6 + 50);
      var expDays = o.days + (1 - p) * o.days * 0.5;
      var over = o.cost > budget;
      var applicable = p >= 0.35;
      return {
        id: o.id, name: o.name, cost: o.cost, days: o.days, p: p,
        expCost: expCost, expDays: expDays,
        over: over, applicable: applicable,
        ok: applicable && !over,
        score: Math.max(0, Math.min(100, 100 - expCost / 6))
      };
    });
    rows.sort(function (a, b) { return b.score - a.score; });
    var eligible = rows.filter(function (r) { return r.ok; });
    var best = eligible[0] || null;
    var backup = eligible[1] || null;
    var anyOver = rows.filter(function (r) { return r.over && r.applicable; })[0] || null;

    return {
      kpis: [
        { label: '推荐方案', value: best ? best.name : '无可行方案', wide: true, tone: best ? 'ok' : 'bad' },
        { label: '预期费用', value: best ? best.expCost.toFixed(0) : '—', unit: '万元', tone: best && best.expCost > budget ? 'warn' : '' },
        { label: '预期工期', value: best ? best.expDays.toFixed(0) : '—', unit: '天' },
        { label: '综合成功率', value: best ? (best.p * 100).toFixed(0) : '—', unit: '%', tone: best && best.p >= 0.7 ? 'ok' : 'warn' },
        { label: '可行方案', value: eligible.length + ' / ' + rows.length, unit: '套', wide: true }
      ],
      chart: {
        type: 'bars',
        title: '按“预期费用 + 失败代价”排序',
        hint: '灰条=不适用或超预算 · 数值为推荐指数',
        items: rows.map(function (r) {
          return {
            name: r.name,
            note: '费用 ' + r.cost + ' 万 · ' + r.days + ' 天 · 成功率 ' + (r.p * 100).toFixed(0) + '%',
            value: r.score,
            text: r.score.toFixed(0),
            color: r.ok ? '#3a352d' : '#cfc8b6',
            bad: !r.ok,
            hl: best && r.id === best.id
          };
        }),
        max: 100,
        unit: '',
        legend: [
          { color: '#3a352d', label: '可行方案' },
          { color: '#cfc8b6', label: '不适用 / 超预算' }
        ]
      },
      table: {
        head: ['口径', '经验首选', '本次检索'],
        rows: [
          ['方案', { 'fish': '打捞落物', 'stuck': '解卡', 'casing': '套管整形', 'water': '堵水' }[fault], best ? best.name : '无'],
          ['预期费用', '按定额估算，未计失败返工', best ? best.expCost.toFixed(0) + ' 万元' : '—'],
          ['预期工期', best ? best.days + ' 天（不含返工）' : '—', best ? best.expDays.toFixed(0) + ' 天（含失败概率）' : '—'],
          ['失败后', '临时再定', backup ? '备选 ' + backup.name : (anyOver ? '需追加预算考虑 ' + anyOver.name : '—')]
        ],
        hl: 1
      },
      verdict: {
        label: best ? '推荐方案' : '预算冲突',
        value: best ? best.name + ' · ' + best.expCost.toFixed(0) + ' 万元' : '需追加预算',
        tone: best ? (best.p >= 0.7 ? 'ok' : 'warn') : 'bad',
        html: best
          ? '<b>排序把“失败返工”折进了预期费用。</b>' + best.name + ' 成功率约 ' + (best.p * 100).toFixed(0) + '%、预期 ' + best.expDays.toFixed(0) + ' 天。' + (backup ? '若现场条件变化导致首选不成立，备选是 <b>' + backup.name + '</b>。' : '') + '这只是方案检索的排序，施工设计、工具选型与安全交底仍要工程师完成。'
          : '<b>当前预算内没有可行方案。</b>可行的低成本方案都因成功率过低被排除，' + (anyOver ? '唯一适用的是 ' + anyOver.name + '（' + anyOver.cost + ' 万元），需追加预算或调整作业目标。' : '需要重新确认故障类型。')
      }
    };
  }

  var DEF = G.makeCase({
    id: 'workover-plan-recommend',
    sceneId: 'wo1',
    code: 'WO1',
    title: '修井作业方案智能推荐',
    methods: ['kg', 'nlp'],

    highlight: '修井方案不是“选最便宜的”，而是把失败返工一起折进预期费用。',
    preview: '故障类型 + 确认度 + 预算 → 五套方案排序 → 预期费用 / 工期 / 成功率',

    credibility: {
      score: 60,
      level: '中',
      basis: '费用、工期与成功率按经验量级设定，未使用真实井史案例库；排序模型是“预期费用 + 失败代价”的简化式，用于演示检索与排序逻辑。',
      checks: [
        { k: '数据', v: '5 套方案 × 4 类故障（合成）' },
        { k: '方法', v: '适用性判断 + 预期费用排序' },
        { k: '验证', v: '预算与确认度敏感性' }
      ]
    },

    conclusion: {
      title: '默认落物工况下，打捞方案胜出',
      html: '<p>默认“井下落物、确认度 0.75、预算 200 万元”时，打捞落物成功率约 <b>87%</b>、预期费用约 <b>100 万元</b>、预期工期约 <b>7 天</b>；解卡虽便宜，但对该故障的成功率太低，被适用性条件排除。侧钻费用 420 万元，直接超预算。</p><p>这个排序回答的是“在当前故障判断与预算下，哪套方案的期望代价最低”。如果故障类型判断错了，或者预算能追加，结论会完全不同。真实修井方案还要过工具选型、井控与安全交底。</p>'
    },
    limits: [
      '方案费用、工期与成功率均为经验量级设定，未用真实修井井史标定；不同区块、不同井深的差异很大。',
      '故障类型是离散选项，真实井况常是“落物 + 砂卡 + 套管变形”叠加，需要更细的实体关系。',
      '预期费用模型只计入一次失败返工，未考虑多次失败、停产损失与安全风险。',
      '知识图谱与文本抽取的质量未在示范中体现；井史报告不规范时，推荐结果会明显退化。'
    ],

    concept: {
      title: '从故障描述到方案',
      steps: [
        { k: 'TEXT', t: '井史与故障', d: '井身结构、生产历史、现象' },
        { k: 'EXTRACT', t: '信息抽取', d: '故障类型、工具、效果' },
        { k: 'GRAPH', t: '案例图谱', d: '故障—工艺—工具—效果' },
        { k: 'SCREEN', t: '适用性判断', d: '成功率过低直接排除' },
        { k: 'RANK', t: '预期代价排序', d: '费用 + 失败返工 + 工期' }
      ]
    },

    judge: [
      { label: '任务类型', value: '知识图谱 + 案例推理', desc: '检索相似井次，不是预测成功率' },
      { label: '数据门槛', value: '500—2000 井次', desc: '修井设计与总结，文本 + 结构化' },
      { label: '收益', value: '1—2 天 → 小时级', desc: '方案编制时间，含复核', html: '<b style="font-family:var(--mono)">d → h</b>' },
      { label: '难度', value: '高', desc: '文本非结构化，实体关系抽取质量决定上限', html: '<span class="dtag" data-d="高">难度 高</span>' },
      { label: '关键口径', value: '预期费用', desc: '必须把失败返工折进去', html: '<b style="color:var(--clay-d);font-family:var(--mono)">含返工</b>' }
    ],

    lede: '修井方案要针对具体故障（落物、套管变形、出水、砂卡）选定工艺与工具组合。方案质量直接决定作业周期与成功率，但方案编制长期依赖工程师经验与历史井史 —— 同类故障在不同井上的处理方式差异很大，年轻工程师上手很慢。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>遇到修井，工程师先翻井史、找相似井，再凭经验组合“工艺 + 工具”。问题在于：<b>井史是非结构化文本</b>，关键信息散在作业总结、事故报告与班组记录里；<b>相似性判断靠人</b>，同一故障在不同井上的处理方式可能完全不同；<b>费用口径不统一</b>，有人只算直接作业费，有人把停产损失也算进去。</p>' +
          '<p>结果就是方案质量强依赖个人经验，年轻工程师只能“照着上次做”，而上次的方案未必适合这次。</p>' +
          K.figure(G.fieldSVG('workover'), 1, '修井现场示意：井架、油管与打捞工具下入井筒，井底有落物。方案要回答的不只是“用什么工具”，还有“失败了下一步怎么办、总共要花多少”。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>先把井史文本抽成结构化字段：故障类型、井身结构、工具、工艺、工期、效果。再用知识图谱组织“故障现象—工艺—工具—效果”关系，按井况检索相似案例。排序时不能只比直接费用，而要把<b>失败概率与返工代价</b>折进预期费用。</p>' +
          '<p>这里替换的是“翻井史、找先例”这一步，工程师仍然负责施工设计、井控与安全交底。模型的价值是<b>把散落在报告里的经验变成可检索的候选集</b>，并让排序口径透明。</p>' +
          K.figure(G.flowSVG([
            ['井史文本', '作业总结 · 事故报告', '#5d7fa3'],
            ['信息抽取', '故障 · 工具 · 效果', '#8a4b2d'],
            ['案例图谱', '井—故障—工艺—效果', '#7e5a8d'],
            ['适用性判断', '成功率过低直接排除', '#b26a39'],
            ['预期代价排序', '费用 + 返工 + 工期', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 2 步决定上限：井史写得含糊，后面检索出来的“相似井”也不可靠。' }), 2, '五步里最容易被低估的是第 2 步。修井报告里的“处理顺利”“效果尚可”如果不转成结构化字段，案例推理就没有依据。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['井史与故障描述', '井身结构、生产历史、故障现象', '单区块 500—2000 井次'],
            ['修井设计与总结', '工艺、工具、工期、效果', '文本 + 结构化'],
            ['作业时效记录', '各工序耗时', '用于工期估计'],
            ['费用定额', '直接作业费、材料费、停产损失', '统一口径'],
            ['工具与工艺库', '型号、适用井径、限制条件', '结构化整理']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['修井工程教材与作业规程', '案例推理（CBR）与知识图谱构建方法'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('高') + '<span class="small muted">文本非结构化，实体关系抽取质量直接决定推荐效果。</span></div>' +
          K.meter('高') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>高</b>：不是算法难，而是<b>数据脏</b>。修井报告格式五花八门，故障描述常混用口语与术语；成功率也没有统一口径。建议先把一个区块的报告标准化，再做案例推理。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['知识图谱', '案例推理', '文本信息抽取'], '#/method/nlp') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/production" style="color:var(--jade-d);font-weight:600">采油</a> · <a href="#/stage/eor" style="color:var(--jade-d);font-weight:600">增采</a></p>'
      }
    ],

    workflowTitle: '案例：一个区块的修井方案推荐',
    lead: [
      '某区块一年有 600 多井次修井作业，方案编制依赖两位老工程师。项目目标是把**方案编制从 1—2 天压到小时级**，并让年轻工程师能看到“为什么推荐这套方案、失败了怎么办”。',
      '第 2 步的信息抽取与第 4 步的适用性判断是成败关键：前者决定案例库质量，后者防止“便宜但根本不适用”的方案排到前面。'
    ],
    stats: [
      ['年井次', '600+'], ['备选方案', '5 套'], ['故障类型', '4 类'],
      ['原编制时间', '1—2 天'], ['目标', '小时级'], ['费用口径', '含返工']
    ],
    steps: [
      {
        name: '井史文本抽取', role: '工程环节',
        input: '作业总结 + 事故报告 + 生产记录',
        do: '抽取故障现象、井身结构、工具、工艺、工期与效果，统一术语。',
        output: '结构化井次记录',
        viz: '文本字段标注示例',
        effect: '把“报告”变成可检索的案例',
        trap: '只抽关键词、不抽关系，图谱会变成词表'
      },
      {
        name: '案例图谱构建', role: '算法核心',
        input: '结构化井次 + 工具库',
        do: '以“井—故障—工艺—工具—效果”建图，按区块、井深、井型建立索引。',
        output: '可检索的案例图谱',
        viz: '故障—工艺关系图',
        effect: '相似井从“凭记忆”变成“可查询”',
        trap: '不区分区块与井型，相似井会选出不适用的先例'
      },
      {
        name: '适用性判断', role: '效果关键',
        input: '候选方案 + 故障类型',
        do: '先按故障适用性、井径、工具限制做硬筛，成功率过低或工具不匹配的方案直接退出排序。',
        output: '可行方案集合',
        viz: '适用性矩阵',
        effect: '避免“便宜但不对症”的方案排第一',
        trap: '只按费用排序，会把解卡排到落物井的第一名'
      },
      {
        name: '预期代价排序', role: '算法核心',
        input: '可行方案 + 费用 / 工期 / 成功率',
        do: '按“直接费用 + 失败概率 × 返工代价”算预期费用，并给出备选方案。',
        output: '推荐 + 备选 + 预期费用',
        viz: '方案排序条形图',
        effect: '排序口径透明，可复核',
        trap: '只算直接费用，会系统性低估低成功率方案'
      },
      {
        name: '施工设计与反馈', role: '闭环',
        input: '推荐方案 + 现场井况',
        do: '工程师完成工具选型、井控与安全交底；作业后回写实际费用、工期与效果。',
        output: '施工方案 + 案例更新',
        viz: '预计 vs 实际',
        effect: '每一次作业都在修正案例库',
        trap: '不回写实际效果，案例库三年后就过期'
      }
    ],
    metricsTitle: '怎么算“推荐合理”',
    metricsHtml: '<p>修井方案没有唯一答案，评价要看<b>方案是否对症、预期费用是否算全、备选是否可行</p>。模型准确率在这里意义不大，工程可执行性才是核心。</p>' +
      K.dtable(['指标', '定义', '为什么必须看'], [
        ['适用性通过率', '可行方案 / 候选方案', '先保证对症'],
        ['预期费用偏差', '预计 vs 实际费用', '检验返工代价是否低估'],
        ['工期偏差', '预计 vs 实际工期', '影响停产损失'],
        ['备选可用率', '首选失败后仍有可行备选的比例', '决定方案鲁棒性']
      ]) +
      '<p style="margin-top:10px">示范只展示前三项的“计算口径”；真实偏差需要作业回写数据才能统计。</p>',
    fails: [
      { name: '井史文本不规范', why: '故障描述口语化、术语混用，抽取出的字段不可比。应先在区块内统一术语与模板。' },
      { name: '相似性判断错误', why: '只按故障类型检索，会忽略井径、井深、套管状况等关键条件，选出不适用的先例。' },
      { name: '费用口径不一致', why: '有人只算直接作业费，有人含停产损失。口径不统一，排序没有可比性。' },
      { name: '只排序不设适用性', why: '便宜的方案往往成功率低，若不先做适用性硬筛，会被排到第一。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 修井方案排序',
      title: '把失败返工折进费用，再看哪套方案真的划算',
      desc: '五套常见修井方案，费用、工期与不同故障下的成功率已知。切换故障类型、调整确认度与预算，看推荐方案怎样变化，以及哪些方案因“不适用 / 超预算”被排除。',
      chartTitle: '按预期费用排序',
      chartHint: '灰条=不适用或超预算',
      controls: [
        { key: 'fault', type: 'seg', label: '故障类型', value: 'fish', options: FAULTS },
        { key: 'sure', label: '故障确认度', min: 0.4, max: 0.95, step: 0.01, value: 0.75, display: function (v) { return (v * 100).toFixed(0) + '%'; } },
        { key: 'budget', label: '预算上限', min: 50, max: 500, step: 5, value: 200, display: function (v) { return v + ' 万元'; } }
      ],
      tags: [
        { text: 'KG · 案例推理', tone: 'jade' },
        { text: 'NLP · 井史抽取', tone: '' },
        { text: '含返工代价', tone: 'clay' }
      ],
      compute: compute,
      foot: '费用、工期与成功率为经验量级设定，未用真实井史标定；推荐只用于方案检索，施工设计、井控与安全交底仍需工程师完成。'
    }
  });
})();
