/* =========================================================
   跨环节案例 · d1 钻速预测与参数优化
   ---------------------------------------------------------
   场景：钻井（03）
   方法：时序预测 + 参数优化
   示范：钻压—转速二维钻速图 + 扭矩约束内的推荐点
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var WOBS = [60, 80, 100, 120, 140, 160, 180, 200];
  var RPMS = [60, 75, 90, 100, 120, 135, 150, 160];

  function ropOf(wob, rpm, hardness, flow) {
    var w = wob / 120, r = rpm / 100;
    var base = (6 + 18 * Math.pow(w, 0.85) * Math.pow(r, 0.9)) / hardness;
    var founder = Math.pow(Math.max(0, w * r - 1.05), 1.4) * 14;
    return Math.max(1, base - founder + (flow - 45) * 0.1);
  }
  function torqueOf(wob, rpm) {
    return 0.09 * wob + 0.05 * rpm + 0.00035 * wob * rpm;
  }

  function compute(st) {
    var values = [], best = { rop: -1, wob: 0, rpm: 0, torque: 0 }, safeCount = 0;
    for (var r = 0; r < RPMS.length; r++) {
      var row = [];
      for (var c = 0; c < WOBS.length; c++) {
        var v = ropOf(WOBS[c], RPMS[r], st.hard, st.flow);
        var tq = torqueOf(WOBS[c], RPMS[r]);
        row.push(v);
        if (tq <= st.limit && v > best.rop) {
          best = { rop: v, wob: WOBS[c], rpm: RPMS[r], torque: tq };
        }
        if (tq <= st.limit) safeCount++;
      }
      values.push(row);
    }
    var baseRop = ropOf(120, 100, st.hard, st.flow);
    var gain = (best.rop / baseRop - 1) * 100;
    var margin = st.limit - best.torque;
    var ri = RPMS.indexOf(best.rpm), ci = WOBS.indexOf(best.wob);

    return {
      kpis: [
        { label: '推荐钻速', value: best.rop.toFixed(1), unit: 'm/h', tone: 'ok' },
        { label: '当前参数钻速', value: baseRop.toFixed(1), unit: 'm/h' },
        { label: '提升', value: (gain > 0 ? '+' : '') + gain.toFixed(0), unit: '%', tone: gain >= 15 ? 'ok' : 'warn' },
        { label: '扭矩余量', value: margin.toFixed(1), unit: 'kN·m', tone: margin <= 2 ? 'warn' : '' },
        { label: '可行网格', value: safeCount + ' / ' + (WOBS.length * RPMS.length), wide: true },
        { label: '推荐参数', value: 'WOB ' + best.wob + ' · RPM ' + best.rpm, wide: true, tone: 'ok' }
      ],
      chart: {
        type: 'heat',
        title: '钻速（m/h）随钻压与转速变化',
        hint: '颜色越深钻速越高 · 空心=当前参数，实心=推荐点',
        x: WOBS.map(function (v) { return String(v); }),
        y: RPMS.map(function (v) { return String(v); }),
        xLabel: '钻压 WOB / kN',
        xAxis: '转速 RPM ↑',
        values: values,
        min: 0,
        max: 50,
        scale: ['#fbf8f0', '#ecd9b6', '#c08a4e', '#8f4a22'],
        markers: [
          { x: ci, y: ri, kind: 'dot', color: '#3a352d', label: '推荐 ' + best.rop.toFixed(1) },
          { x: 3, y: 3, kind: 'ring', color: '#5d7fa3', label: '当前' }
        ],
        legend: [
          { color: '#fbf8f0', label: '低钻速' },
          { color: '#c08a4e', label: '中等' },
          { color: '#8f4a22', label: '高钻速' },
          { color: '#3a352d', label: '推荐参数' }
        ]
      },
      table: {
        head: ['口径', '当前 / 经验参数', '本次计算'],
        rows: [
          ['WOB / RPM', '120 kN / 100 r/min', best.wob + ' kN / ' + best.rpm + ' r/min'],
          ['钻速', baseRop.toFixed(1) + ' m/h', best.rop.toFixed(1) + ' m/h'],
          ['扭矩', torqueOf(120, 100).toFixed(1) + ' kN·m', best.torque.toFixed(1) + ' kN·m（上限 ' + st.limit + '）'],
          ['约束', '凭经验留余量', safeCount + ' 个可行网格']
        ],
        hl: 1
      },
      verdict: {
        label: '参数建议',
        value: 'WOB ' + best.wob + ' kN · RPM ' + best.rpm,
        tone: margin <= 2 ? 'warn' : 'ok',
        html: margin <= 2
          ? '<b>推荐点已经贴着扭矩上限。</b>现场应先小步调整并观察扭矩与泵压，不要把模型输出直接设成目标值；地层变化后要重新计算。'
          : '<b>推荐点仍有 ' + margin.toFixed(1) + ' kN·m 余量。</b>建议按 10% 步长分批逼近，并在每个立柱/层段结束后回写实际钻速，用于修正代理模型。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'drilling-rop-optimization',
    sceneId: 'd1',
    code: 'D1',
    title: '钻速预测与参数优化',
    methods: ['ts', 'opt'],

    highlight: '先算“参数—钻速”曲面，再在扭矩、泵压约束内找可行点——不是让模型直接下指令。',
    preview: '钻压 × 转速二维钻速图 → 扭矩约束过滤 → 推荐参数与提升幅度',

    credibility: {
      score: 63,
      level: '中',
      basis: '钻速与扭矩为简化代理公式（含钻压指数、转速指数与“憋钻”惩罚），不是实钻数据拟合；约束只保留扭矩一项，用于演示“先约束、后优化”的顺序。',
      checks: [
        { k: '数据', v: '合成 8×8 参数网格' },
        { k: '方法', v: '代理模型 + 约束内取最优' },
        { k: '验证', v: '对照当前参数与扭矩上限' }
      ]
    },

    conclusion: {
      title: '默认参数下可提升约 14%，但推荐点接近扭矩上限',
      html: '<p>默认“硬度 1.0、排量 45 L/s、扭矩上限 30 kN·m”时，模型把推荐点放在钻压 120 kN、转速 160 r/min：钻速约 <b>27.4 m/h</b>，比当前参数（120 kN / 100 r/min）高约 <b>14%</b>，扭矩余量约 4.5 kN·m。</p><p>这不是“模型算出了最优钻井参数”，而是<b>在一个简化曲面上找到了可行点</b>。真实钻井还要看井壁稳定、泵压、返出、钻具组合与地层变化；任何一项超限，都应该放弃推荐点。示范的价值在于展示顺序：先建映射，再列约束，最后才谈优化。</p>'
    },
    limits: [
      '钻速公式为简化代理模型，未用实钻数据标定；不同钻机、钻具组合与地层的系数差异很大。',
      '只保留扭矩一项约束，未考虑泵压、井壁稳定、井漏与气侵；真实闭环必须把这些约束一起纳入。',
      '二维网格是静态的，未体现“参数调整滞后于地层变化”；真实应用需按层段滚动更新。',
      '推荐点接近约束边界时，现场必须以小步试调与实时监测为准，不能直接下发目标值。'
    ],

    concept: {
      title: '从参数到可行点',
      steps: [
        { k: 'INPUT', t: '高频参数', d: 'WOB、RPM、排量、扭矩、泵压' },
        { k: 'SEGMENT', t: '按层分段', d: '用录井 / 测井分层对齐' },
        { k: 'MODEL', t: '代理模型', d: '参数—工况—钻速映射' },
        { k: 'CONSTRAIN', t: '约束过滤', d: '扭矩、泵压、井壁稳定' },
        { k: 'RECO', t: '小步推荐', d: '分批逼近 + 实时监测' }
      ]
    },

    judge: [
      { label: '任务类型', value: '时序回归 + 约束优化', desc: '预测钻速，再在可行域内选参数' },
      { label: '数据门槛', value: '单井 10 万+ 条', desc: '1—10 s 采样，含工况与事件' },
      { label: '收益', value: '保守参数 +20%', desc: '把被压低的钻速释放一部分', html: '<b style="font-family:var(--mono)">+10%~20%</b>' },
      { label: '难度', value: '高', desc: '闭环涉及井下安全，外推风险高', html: '<span class="dtag" data-d="高">难度 高</span>' },
      { label: '关键约束', value: '扭矩 / 泵压', desc: '推荐点不能贴边下发', html: '<b style="color:var(--clay-d);font-family:var(--mono)">先约束</b>' }
    ],

    lede: '机械钻速受岩性、钻压、转速、排量与钻井液性能多因素耦合影响。司钻主要凭经验与邻井资料调整参数，是钻井提效最直接的抓手 —— 但参数调整总是滞后于地层变化，为了规避卡钻与井漏，现场普遍采用保守参数，机械钻速被压低 20%—30%。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>钻台上的参数调整是“看仪表 + 听经验”：扭矩升高就降钻压，泵压异常就调排量，遇到软硬交错段凭邻井记忆提前收参数。这种做法的代价是<b>钻速长期跑在保守区</b>：为了避免复杂情况，参数被压在安全下限附近，机械钻速损失 20%—30%。</p>' +
          '<p>另一个问题是<b>反馈滞后</b>：地层已经变了，参数还在按上一段的经验走。钻进过程本身有惯性，等仪表出现异常再调，往往已经晚了。</p>' +
          K.figure(G.fieldSVG('drilling'), 1, '钻井现场示意：钻压与转速作用在钻头上，钻井液从环空返出。司钻能直接看到的是扭矩、泵压与返出，看不到的是“再往前 10 m 地层会变成什么”。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>做法分三层：<b>时序模型</b>建立“参数—工况—钻速”的映射，<b>约束层</b>把扭矩、泵压、井壁稳定作为硬边界，<b>优化层</b>在可行域内给出下一段的参数建议。注意顺序：<b>先约束、后优化</b>。如果先找最优再检查约束，模型很容易给出一个“钻速最高但会憋钻”的点。</p>' +
          '<p>模型不做闭环下发，而是给司钻一个“建议窗口 + 余量”。现场按小步逼近，并在每个层段结束后回写实际钻速，用于修正代理模型 —— 这样既不越过安全边界，也能持续学习。</p>' +
          K.figure(G.flowSVG([
            ['高频参数', 'WOB · RPM · 排量 · 扭矩', '#5d7fa3'],
            ['层段对齐', '录井 / 测井分层', '#8a4b2d'],
            ['代理模型', '参数 → 钻速 / 扭矩', '#7e5a8d'],
            ['约束过滤', '扭矩 · 泵压 · 稳定', '#b26a39'],
            ['小步推荐', '余量 + 实时监测', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 4 步不是“加个上限”，而是把不可行的参数组合直接剔除出候选集。' }), 2, '五步里最容易被跳过的是第 2 步：不按层段对齐，模型会把软泥岩的高钻速错记到硬砂岩上，参数建议自然失准。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['高频钻井参数', '1—10 s 采样，WOB / RPM / 排量 / 扭矩 / 泵压', '单井 10 万—100 万条'],
            ['地质分层与岩性', '来自录井与测井', '作为分段标签'],
            ['复杂情况记录', '卡钻、井漏、气侵、遇阻', '事件级标注，必须保留'],
            ['钻具组合与钻头型号', '每趟钻的明细', '代理模型的分组变量'],
            ['邻井参数与效果', '同区块、同层段', '用于先验与对比']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['钻井工程手册与钻头厂家参数表', '公开钻速方程与“憋钻”现象研究'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('高') + '<span class="small muted">数据量大、分布漂移强，且闭环涉及井下安全。</span></div>' +
          K.meter('高') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>高</b>：参数与钻速的关系不是单一函数，不同钻机、地层、钻具组合的分布差异很大；更关键的是，错了的代价是井下复杂情况。建议先做“离线建议 + 人工执行”的 shadow 模式，积累反馈后再考虑自动限幅。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['时序回归', '贝叶斯优化', '强化学习', '代理模型'], '#/method/opt') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/mudlogging" style="color:var(--jade-d);font-weight:600">录井</a> · <a href="#/stage/welllog" style="color:var(--jade-d);font-weight:600">测井</a></p>'
      }
    ],

    workflowTitle: '案例：一趟钻的钻速优化建议',
    lead: [
      '某开发井在 2800—3400 m 井段钻进，岩性软硬交错，现场为规避复杂情况一直使用保守参数。项目目标不是自动送钻，而是**在扭矩与泵压约束内给出下一段的参数窗口**，把钻速提升 10%—20%，同时把扭矩越限率控制在 5% 以内。',
      '下面五步里，第 1、2 步是数据工程，第 3、4 步是建模与约束，第 5 步才是现场。真正决定成败的是第 2 步的分段对齐和第 5 步的限幅。'
    ],
    stats: [
      ['采样间隔', '5 s'], ['单井记录', '10 万+'], ['层段', '8'],
      ['优化步长', '1 m'], ['目标提效', '10%—20%'], ['扭矩越限', '≤5%']
    ],
    steps: [
      {
        name: '数据对齐与分段', role: '工程环节',
        input: '高频参数 + 录井分层 + 井深',
        do: '按时间与井深对齐，统一单位与延迟（钻头位置滞后于地面参数）；按层段切分。',
        output: '带层段标签的参数序列',
        viz: '参数—井深对齐图',
        effect: '同一层段内的样本可以比较',
        trap: '不对齐钻头延迟会把上一层的钻速记到下一层'
      },
      {
        name: '工况清洗与事件标注', role: '工程环节',
        input: '参数序列 + 复杂情况记录',
        do: '剔除接单根、停钻、循环等非钻进段；把卡钻、井漏标成事件，保留为负样本。',
        output: '干净的钻进段 + 事件标签',
        viz: '工况分色时间线',
        effect: '模型学的是“钻进”，不是“停机”',
        trap: '把事件段当普通样本，会学到“高钻压→卡钻”的错误关联'
      },
      {
        name: '代理模型', role: '算法核心',
        input: '层段 + 参数 + 钻速',
        do: '梯度提升 / 时序网络建立参数—钻速映射，同时预测扭矩，输出不确定区间。',
        output: '钻速与扭矩的预测曲面',
        viz: '二维钻速热力图',
        effect: '把“经验窗口”变成可比较的曲面',
        trap: '只用平均钻速训练会抹掉软硬交错的波动'
      },
      {
        name: '约束内寻优', role: '效果关键',
        input: '预测曲面 + 约束',
        do: '先按扭矩、泵压、井壁稳定剔除不可行点，再在可行域内取钻速最大点，并保留余量。',
        output: '推荐参数 + 余量',
        viz: '可行域与推荐点',
        effect: '推荐点不会贴着安全边界',
        trap: '先优化后检查约束，等于把风险留给现场'
      },
      {
        name: '现场限幅与闭环', role: '闭环',
        input: '推荐窗口 + 实时仪表',
        do: '按 10% 步长分批逼近，设置扭矩/泵压越限回退；每段结束回写实际钻速。',
        output: '实际参数 + 修正后的模型',
        viz: '建议 vs 实际曲线',
        effect: '模型随钻机与地层持续修正',
        trap: '没有回退机制，一次误判就可能演变成复杂情况'
      }
    ],
    metricsTitle: '怎么算“优化有效”',
    metricsHtml: '<p>不能只看平均钻速。平均钻速提升可能来自“多钻了软地层”，也可能来自“牺牲了安全余量”。这个任务要同时看<b>分地层钻速、约束越限率与参数平滑度</b>。</p>' +
      K.dtable(['指标', '定义', '为什么必须看'], [
        ['分地层钻速', '按岩性 / 层段统计的 m/h', '避免软地层拉高平均值'],
        ['扭矩越限率', '扭矩超过上限的时间占比', '安全底线，通常要求 ≤5%'],
        ['参数平滑度', '相邻控制点的参数跳变', '跳变过大对钻具与井壁不友好'],
        ['建议采纳率', '司钻实际执行的建议比例', '衡量建议是否“可执行”']
      ]) +
      '<p style="margin-top:10px">示范只展示第一项与约束可行性；越限率、平滑度与采纳率需要现场数据才能统计。</p>',
    fails: [
      { name: '分布漂移', why: '换钻机、换钻头、换地层后，参数—钻速关系会变。必须按区块/钻具分组建模，并监控残差漂移。' },
      { name: '钻头延迟未对齐', why: '地面参数与井底钻头之间存在秒级到分钟级延迟，不对齐会让模型学到错误的因果。' },
      { name: '约束遗漏', why: '只约束扭矩、不约束泵压与井壁稳定，优化会给出“钻速高但会漏”的点。' },
      { name: '过度外推', why: '在训练数据没覆盖的参数区间取最优，等于让模型猜。应对推荐点做可信域检查，超出范围就退回经验窗口。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 钻速曲面',
      title: '在钻压—转速平面上找可行点，而不是最高点',
      desc: '这是简化的钻速代理模型：颜色越深钻速越高，但只有扭矩不超限的格子才可选。调地层硬度、排量与扭矩上限，看推荐点怎样从“最高钻速”退到“可行最优”。',
      chartTitle: '钻速随钻压与转速变化',
      chartHint: '空心=当前参数 · 实心=推荐点',
      controls: [
        { key: 'hard', label: '地层硬度系数', min: 0.7, max: 1.4, step: 0.01, value: 1, display: function (v) { return v.toFixed(2); } },
        { key: 'flow', label: '排量', min: 30, max: 60, step: 1, value: 45, display: function (v) { return v + ' L/s'; } },
        { key: 'limit', label: '扭矩上限', min: 18, max: 45, step: 0.5, value: 30, display: function (v) { return v.toFixed(1) + ' kN·m'; } }
      ],
      tags: [
        { text: 'TS · 代理模型', tone: 'jade' },
        { text: 'OPT · 约束寻优', tone: '' },
        { text: '井下安全', tone: 'clay' }
      ],
      compute: compute,
      foot: '钻速与扭矩为简化代理公式，非实钻数据拟合；真实应用需按钻具组合、地层与泵压多约束标定，并保留人工回退。'
    }
  });
})();
