/* =========================================================
   跨环节案例 · r2 催化裂化产物预测
   ---------------------------------------------------------
   场景：加工（13）
   方法：深度回归 + 时序分析
   示范：反应温度 → 五类产品收率曲线 + 推荐温度
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var T0 = 470, T1 = 540;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function yieldsAt(T, ratio, ccr) {
    var conv = clamp(0.55 + (T - 500) * 0.006 + (ratio - 6) * 0.035 - (ccr - 2) * 0.03, 0.35, 0.95);
    var over = Math.max(0, (T - 512) / 10);
    var dry = 2.5 + conv * 6 + (ccr - 2) * 0.5 + over * 4;
    var lpg = 8 + conv * 14 + (ratio - 6) * 0.5 + over * 4;
    var gaso = 25 + conv * 30 - over * 8;
    var diesel = 12 + (1 - conv) * 14;
    var slurry = 100 - dry - lpg - gaso - diesel;
    return {
      dry: Math.max(0, dry), lpg: Math.max(0, lpg), gaso: Math.max(0, gaso),
      diesel: Math.max(0, diesel), slurry: Math.max(0, slurry), conv: conv
    };
  }

  function valueOf(y) {
    return y.gaso * 1.0 + y.lpg * 0.85 + y.diesel * 0.90 + y.dry * 0.30 + y.slurry * 0.12;
  }

  function compute(st) {
    var cur = yieldsAt(st.temp, st.ratio, st.ccr);
    var bestT = T0, bestVal = -1;
    for (var t = T0; t <= T1; t += 1) {
      var v = valueOf(yieldsAt(t, st.ratio, st.ccr));
      if (v > bestVal) { bestVal = v; bestT = t; }
    }
    var best = yieldsAt(bestT, st.ratio, st.ccr);
    var delta = bestT - st.temp;
    var liquid = cur.lpg + cur.gaso + cur.diesel;

    var x = [];
    for (var xx = T0; xx <= T1; xx += 5) x.push(xx);
    var seriesDef = [
      { key: 'gaso', name: '汽油', color: '#3a352d' },
      { key: 'lpg', name: '液化气', color: '#b26a39' },
      { key: 'diesel', name: '柴油', color: '#5d7fa3' },
      { key: 'dry', name: '干气', color: '#a03d4f' },
      { key: 'slurry', name: '油浆', color: '#8a8377' }
    ];
    var series = seriesDef.map(function (s) {
      return {
        name: s.name, color: s.color, width: s.key === 'gaso' ? 2 : 1.3,
        points: x.map(function (t) { return [t, yieldsAt(t, st.ratio, st.ccr)[s.key]]; })
      };
    });

    return {
      kpis: [
        { label: '汽油收率', value: cur.gaso.toFixed(1), unit: '%', tone: cur.gaso >= best.gaso - 0.5 ? 'ok' : 'warn' },
        { label: '总液收', value: liquid.toFixed(1), unit: '%', tone: liquid >= 78 ? 'ok' : 'warn' },
        { label: '产品价值指数', value: valueOf(cur).toFixed(1), unit: '/100' },
        { label: '推荐温度', value: String(bestT), unit: '°C', tone: Math.abs(delta) <= 4 ? 'ok' : 'warn' },
        { label: '温度偏差', value: (delta > 0 ? '+' : '') + delta, unit: '°C', wide: true }
      ],
      chart: {
        type: 'line',
        title: '五类产品收率随反应温度变化',
        hint: '竖线=当前温度 · 各曲线按当前剂油比与残炭',
        xDomain: [T0, T1],
        yDomain: [0, 55],
        series: series,
        vline: { x: st.temp, label: '当前 ' + st.temp + ' °C', color: '#5d7fa3' },
        markers: [{ x: bestT, y: best.gaso, color: '#3a352d', label: '最优 ' + bestT + ' °C', r: 4 }],
        fmtX: function (v) { return v.toFixed(0); },
        fmtY: function (v) { return v.toFixed(0); },
        xAxis: '反应温度 / °C',
        yAxis: '收率 / %',
        legend: seriesDef.map(function (s) { return { color: s.color, label: s.name, line: true }; })
      },
      table: {
        head: ['口径', '当前操作', '本模型建议'],
        rows: [
          ['反应温度', st.temp + ' °C', bestT + ' °C'],
          ['汽油收率', cur.gaso.toFixed(1) + '%', best.gaso.toFixed(1) + '%'],
          ['总液收', liquid.toFixed(1) + '%', (best.lpg + best.gaso + best.diesel).toFixed(1) + '%'],
          ['产品价值指数', valueOf(cur).toFixed(1), bestVal.toFixed(1)],
          ['干气 + 油浆', (cur.dry + cur.slurry).toFixed(1) + '%', (best.dry + best.slurry).toFixed(1) + '%']
        ],
        hl: 0
      },
      verdict: {
        label: '温度建议',
        value: Math.abs(delta) <= 4 ? '当前温度接近最优' : '建议 ' + bestT + ' °C',
        tone: Math.abs(delta) <= 4 ? 'ok' : 'warn',
        html: Math.abs(delta) <= 4
          ? '<b>当前温度已在最优附近（±4 °C）。</b>再往上调，汽油会因过裂化下降，干气与液化气上升；再往下调，柴油与油浆增加。此时更值得关注的是原料性质变化，而不是继续动温度。'
          : '<b>按当前原料与剂油比，模型建议把温度调整到 ' + bestT + ' °C（' + (delta > 0 ? '上调' : '下调') + ' ' + Math.abs(delta) + ' °C）。</b>现场调整必须分步进行，并盯住干气、焦炭与再生器温度；模型只给趋势，不替代装置操作规程。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'fcc-product-prediction',
    sceneId: 'r2',
    code: 'R2',
    title: '催化裂化产物预测',
    methods: ['opt', 'ts'],

    highlight: '产品分布不是单点数字，而是一组随温度与剂油比移动的曲线。',
    preview: '反应温度扫描 → 五类产品收率曲线 → 价值最优温度与当前偏差',

    credibility: {
      score: 61,
      level: '中',
      basis: '收率模型为转化率 + 过裂化惩罚的简化代理式，参数按炼厂量级设定，未用真实装置数据拟合；用于演示“趋势 + 约束”的决策方式。',
      checks: [
        { k: '数据', v: '合成收率曲线（470—540 °C）' },
        { k: '方法', v: '转化率代理 + 产品价值排序' },
        { k: '验证', v: '当前温度与最优温度对比' }
      ]
    },

    conclusion: {
      title: '默认原料下汽油收率在 510—512 °C 附近见顶',
      html: '<p>默认“剂油比 6、残炭 2%、温度 505 °C”时，汽油收率约 <b>42%</b>、总液收约 <b>76%</b>；继续升温到 525 °C，汽油因过裂化降到 40% 以下，干气与液化气上升，产品价值指数反而下降。</p><p>这是简化代理模型的趋势，不是装置标定结果。真实 FCC 受原料性质、催化剂活性、再生器温度与压力共同影响，任何“最优温度”都必须结合在线分析与操作约束。</p>'
    },
    limits: [
      '收率模型是转化率 + 过裂化惩罚的简化式，未使用真实装置数据拟合；绝对收率不能用于排产结算。',
      '只考虑反应温度、剂油比与残炭三个变量，未纳入催化剂活性、再生温度、压力与停留时间。',
      '产品价值指数使用固定价格系数，未反映实时市场价格与产品结构约束。',
      '没有做原料—操作—产品的时间对齐；真实数据若不对齐，模型会学到滞后关系。'
    ],

    concept: {
      title: '从原料到产品分布',
      steps: [
        { k: 'INPUT', t: '原料与操作', d: '密度、残炭、温度、剂油比' },
        { k: 'ALIGN', t: '数据对齐', d: '原料—操作—化验同时间窗' },
        { k: 'MODEL', t: '收率代理', d: '深度回归 / 机理约束' },
        { k: 'OPT', t: '价值排序', d: '价格 × 收率，约束内寻优' },
        { k: 'CLOSE', t: '在线闭环', d: '分步调整 + 化验反馈' }
      ]
    },

    judge: [
      { label: '任务类型', value: '深度回归 + 优化', desc: '预测产品分布，再按价值排序' },
      { label: '数据门槛', value: '小时级对齐数据', desc: '原料、操作、化验三者同窗' },
      { label: '收益', value: '汽油 +1%—2%', desc: '收率量级，需在线分析验证', html: '<b style="font-family:var(--mono)">+1%~2%</b>' },
      { label: '难度', value: '高', desc: '强非线性、变量耦合、数据对齐难', html: '<span class="dtag" data-d="高">难度 高</span>' },
      { label: '关键约束', value: '干气 / 焦炭', desc: '不能为汽油收率无限升温', html: '<b style="color:var(--clay-d);font-family:var(--mono)">过裂化</b>' }
    ],

    lede: '催化裂化（FCC）产品分布（干气、液化气、汽油、柴油、油浆）受原料性质、反应温度、剂油比等多因素影响，是炼厂效益的核心。机理模型标定复杂，原料变化频繁时预测偏差大；操作调整又往往滞后于市场与原料变化。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>炼厂靠机理模型 + 化验数据来掌握产品分布，但机理模型参数多、标定复杂，原料一换就要重新校对。操作上，反应温度是最直接的调节手段：升温提高转化率，汽油先升后降；继续升温，干气与焦炭增加，效益反而变差。</p>' +
          '<p>问题在于<b>“最优温度”随原料与剂油比移动</b>，而操作调整往往滞后。等化验结果出来，原料可能已经又变了。排产与效益核算需要的是<b>趋势 + 约束</b>，不是一次性的收率数字。</p>' +
          K.figure(G.fieldSVG('refinery'), 1, '催化裂化装置示意：原料进入提升管，与再生后的催化剂反应，产物进分馏塔分成干气、液化气、汽油、柴油与油浆。温度与剂油比决定产品分布。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>用深度回归或“机理 + 数据”混合模型，从原料性质与操作条件预测五类产品收率；再把收率乘上价格，得到产品价值，在干气、焦炭与设备约束内寻优。关键在<b>数据对齐</b>：原料化验、操作参数与产品化验必须在同一时间窗，否则模型学到的是滞后关系。</p>' +
          '<p>模型输出的是<b>趋势与建议窗口</b>，不是直接下发温度设定值。装置调整要分步进行，并盯住再生器温度与干气量。</p>' +
          K.figure(G.flowSVG([
            ['原料与操作', '密度 · 残炭 · 温度 · 剂油比', '#5d7fa3'],
            ['数据对齐', '同一时间窗 · 滞后校正', '#8a4b2d'],
            ['收率代理', '深度回归 / 机理约束', '#7e5a8d'],
            ['价值排序', '价格 × 收率 · 约束', '#b26a39'],
            ['在线闭环', '分步调整 · 化验反馈', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 2 步是这类项目最常见的失败点：时间不对齐，模型会把“上一批原料”的效果记到“这一批”上。' }), 2, '五步里第 4 步决定“调不调”：同样的收率，在不同价格与约束下，最优温度并不相同。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['原料性质', '密度、残炭、硫、族组成', '小时级，与操作同窗'],
            ['操作参数', '反应温度、剂油比、再生温度、压力', '过程数据'],
            ['产品分布', '干气、液化气、汽油、柴油、油浆收率', '化验 + 在线分析'],
            ['催化剂性质', '活性、微反活性、平衡剂', '影响转化率'],
            ['价格与约束', '产品价格、干气上限、焦炭限制', '优化目标']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['催化裂化工艺教材与装置操作规程', 'FCC 收率预测与实时优化研究文献'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('高') + '<span class="small muted">强非线性、变量耦合，且依赖长期稳定的数据对齐。</span></div>' +
          K.meter('高') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>高</b>：数据量足够，但<b>对齐难</b>、<b>工况漂移强</b>。建议先做一个“离线趋势看板”，让操作员看到温度—收率关系，再逐步接入优化建议。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['深度回归', '机理约束', '数据对齐'], '#/method/opt') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/transport" style="color:var(--jade-d);font-weight:600">运输</a> · <a href="#/stage/production" style="color:var(--jade-d);font-weight:600">采油</a></p>'
      }
    ],

    workflowTitle: '案例：一套 FCC 装置的收率优化',
    lead: [
      '某炼厂 FCC 装置原料来源频繁变化，操作员主要凭化验结果与经验调反应温度。项目目标是把**温度调整从“事后反应”变成“趋势预判”**，在不超干气与焦炭约束的前提下提升汽油收率 1—2 个百分点。',
      '第 2 步的数据对齐与第 5 步的分步调整是成败关键：前者决定模型可信度，后者决定现场敢不敢用。'
    ],
    stats: [
      ['产品', '5 类'], ['关键变量', '3 个'], ['数据频率', '小时级'],
      ['原料切换', '每周 1—3 次'], ['目标', '汽油 +1%—2%'], ['约束', '干气 / 焦炭']
    ],
    steps: [
      {
        name: '数据对齐', role: '工程环节',
        input: '原料化验 + 操作参数 + 产品化验',
        do: '按同一时间窗对齐，校正化验滞后与停留时间；剔除开停车与异常工况。',
        output: '可用于建模的同窗数据',
        viz: '时间对齐示意',
        effect: '模型学到“同批原料—同批产品”的关系',
        trap: '不对齐会把上一批原料的效果记到这一批'
      },
      {
        name: '特征与约束定义', role: '工程环节',
        input: '原料、操作、催化剂',
        do: '构造转化率相关特征；明确干气上限、焦炭限制与设备温度约束。',
        output: '特征表 + 约束清单',
        viz: '变量相关性',
        effect: '优化有明确的可行域',
        trap: '约束没写清，优化会给出“收率高但干气超标”的点'
      },
      {
        name: '收率代理模型', role: '算法核心',
        input: '同窗数据 + 特征',
        do: '深度回归 / 机理 + 数据混合模型，输出五类收率与不确定区间。',
        output: '收率预测',
        viz: '预测 vs 化验',
        effect: '把化验结果的滞后补上',
        trap: '只用化验点训练，样本量不足以覆盖原料变化'
      },
      {
        name: '价值排序与寻优', role: '效果关键',
        input: '收率预测 + 价格 + 约束',
        do: '按产品价值计算目标函数，在约束内扫描温度 / 剂油比，输出建议窗口。',
        output: '建议温度与预期收益',
        viz: '温度—价值曲线',
        effect: '结论从“收率最高”变成“价值最高且可行”',
        trap: '用固定价格，市场变化后建议会失真'
      },
      {
        name: '分步调整与反馈', role: '闭环',
        input: '建议窗口 + 在线分析',
        do: '按小步长调整，监测干气、焦炭与再生温度；化验结果回写模型。',
        output: '实际收率 + 修正模型',
        viz: '建议 vs 实际',
        effect: '模型随原料与催化剂状态持续修正',
        trap: '一次调整过大，会触发干气超标或操作波动'
      }
    ],
    metricsTitle: '怎么算“预测有用”',
    metricsHtml: '<p>收率预测不能只看总准确率。汽油与干气的误差方向不同，价值也不一样；更关键的是<b>优化建议是否可执行</b>。</p>' +
      K.dtable(['指标', '定义', '为什么必须看'], [
        ['各产品 MAE', '汽油 / 液化气 / 柴油等分别统计', '总量准确会掩盖汽油误差'],
        ['总液收偏差', '预测 − 化验（百分点）', '直接对应效益'],
        ['约束违反率', '建议点超出干气 / 焦炭约束的比例', '决定建议能不能执行'],
        ['建议采纳后的收益', '实际 vs 基准', '最终验收指标']
      ]) +
      '<p style="margin-top:10px">示范只展示“温度—收率—价值”的计算口径；真实项目需用在线分析与化验数据做回测。</p>',
    fails: [
      { name: '数据不对齐', why: '原料、操作与产品化验存在时间滞后，不对齐会让模型学到错误的因果关系。' },
      { name: '原料突变', why: '原料性质突然变化时，历史数据覆盖不到，预测会偏。需要监控特征漂移并给出不确定区间。' },
      { name: '强非线性', why: '温度—收率关系存在峰值与过裂化，线性模型会给出单调错误的建议。' },
      { name: '只优化收率', why: '不看干气、焦炭与设备约束，优化会给出“汽油高但装置受不了”的点。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · FCC 收率',
      title: '沿反应温度扫描产品收率，找“价值最高”而不是“汽油最高”',
      desc: '这是简化的 FCC 收率代理模型：汽油先随温度升高，过 510 °C 后因过裂化回落，干气与液化气继续上升。调温度、剂油比与残炭，看五条曲线与推荐温度怎么移动。',
      chartTitle: '五类产品收率随反应温度变化',
      chartHint: '竖线=当前温度 · 圆点=最优温度',
      controls: [
        { key: 'temp', label: '反应温度', min: 470, max: 540, step: 1, value: 505, display: function (v) { return v + ' °C'; } },
        { key: 'ratio', label: '剂油比', min: 4, max: 9, step: 0.1, value: 6, display: function (v) { return v.toFixed(1); } },
        { key: 'ccr', label: '原料残炭', min: 0.5, max: 6, step: 0.1, value: 2, display: function (v) { return v.toFixed(1) + '%'; } }
      ],
      tags: [
        { text: 'OPT + TS · 代理', tone: 'jade' },
        { text: '产品分布', tone: '' },
        { text: '过裂化约束', tone: 'clay' }
      ],
      compute: compute,
      foot: '收率模型为简化代理式，未用真实装置数据标定；绝对收率与最优温度不能用于排产结算，现场调整须遵守操作规程。'
    }
  });
})();
