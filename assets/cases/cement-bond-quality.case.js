/* =========================================================
   跨环节案例 · c1 固井质量智能评价
   ---------------------------------------------------------
   场景：固井（06）
   方法：计算机视觉 + 时序分段
   示范：随井深的胶结指数曲线 + 分级阈值 + 挤水泥段识别
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var TOP = 0, BOT = 900, STEP = 10;
  var DENS = 1.85;

  function bondOf(d, density, rnd) {
    var v = 74 + 9 * Math.sin(d / 60);
    v += (density - DENS) * 38;
    v -= 42 * Math.exp(-Math.pow((d - 640) / 22, 2));
    v -= 14 * Math.exp(-Math.pow((d - 820) / 30, 2));
    v += (rnd() - 0.5) * 7;
    return Math.max(2, Math.min(99, v));
  }

  function compute(st) {
    var rnd = (function (a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })(20261103);
    var points = [], zones = [], prevQ = null, runStart = TOP;
    for (var d = TOP; d <= BOT; d += STEP) {
      var v = bondOf(d, st.dens, rnd);
      var q = d < st.top ? 'none' : (v >= st.thr + 15 ? 'good' : v >= st.thr ? 'fair' : 'bad');
      points.push([d, v]);
      if (prevQ === null) { prevQ = q; runStart = d; }
      else if (q !== prevQ) {
        if (prevQ !== 'none') zones.push({ from: runStart, to: d, tone: prevQ, label: '' });
        prevQ = q; runStart = d;
      }
      if (d === BOT && q !== 'none') zones.push({ from: runStart, to: BOT, tone: q, label: '' });
    }
    var evalPts = points.filter(function (p) { return p[0] >= st.top; });
    var good = 0, fair = 0, bad = 0, minV = 100;
    evalPts.forEach(function (p) {
      if (p[1] >= st.thr + 15) good++;
      else if (p[1] >= st.thr) fair++;
      else bad++;
      if (p[1] < minV) minV = p[1];
    });
    var evalLen = Math.max(1, BOT - st.top);
    var goodShare = (good + fair) / Math.max(1, evalPts.length);
    // 连续不合格段
    var badRuns = [], inBad = false, rs = 0;
    evalPts.forEach(function (p, i) {
      var isBad = p[1] < st.thr;
      if (isBad && !inBad) { inBad = true; rs = p[0]; }
      if (!isBad && inBad) { inBad = false; if (p[0] - rs >= 20) badRuns.push([rs, p[0] - STEP]); }
      if (i === evalPts.length - 1 && inBad && p[0] - rs >= 20) badRuns.push([rs, p[0]]);
    });
    var worst = badRuns.length ? badRuns[0] : null;
    zones.forEach(function (z) {
      var len = z.to - z.from;
      if (len >= 50) z.label = z.tone === 'bad' ? '不合格' : z.tone === 'fair' ? '合格' : '优质';
    });

    return {
      kpis: [
        { label: '优质 + 合格占比', value: (goodShare * 100).toFixed(1), unit: '%', tone: goodShare >= 0.9 ? 'ok' : goodShare >= 0.75 ? 'warn' : 'bad' },
        { label: '不合格段长', value: String((bad * STEP)), unit: 'm', tone: bad * STEP >= 40 ? 'bad' : '' },
        { label: '需挤水泥段', value: String(badRuns.length), unit: '段', tone: badRuns.length ? 'warn' : 'ok' },
        { label: '最低胶结指数', value: minV.toFixed(0), unit: '/100', tone: minV >= st.thr ? 'ok' : 'bad' },
        { label: '评价井段', value: st.top + '—' + BOT, unit: 'm', wide: true }
      ],
      chart: {
        type: 'track',
        title: '胶结指数随井深变化',
        hint: '背景色=分级 · 虚线=评价阈值',
        depth: [TOP, BOT],
        valueMax: 100,
        points: points,
        threshold: { value: st.thr, label: '阈值 ' + st.thr },
        zones: zones,
        xAxis: '胶结指数 / %',
        legend: [
          { color: '#edf4f0', label: '优质' },
          { color: '#fbf2df', label: '合格' },
          { color: '#f9e9e5', label: '不合格' },
          { color: '#2f3a3f', label: '胶结指数曲线', line: true }
        ]
      },
      table: {
        head: ['口径', '人工评级（经验）', '本次（合成曲线）'],
        rows: [
          ['评价方式', '逐段看 CBL / VDL', '10 m 采样自动分级'],
          ['不合格段', '按解释员经验划分', badRuns.length ? worst[0] + '—' + worst[1] + ' m' : '未检出'],
          ['单井耗时', '1—2 h', '秒级 + 复核'],
          ['需复核', '快速地层 / 微环隙', (bad + fair) + ' 个采样点']
        ],
        hl: 0
      },
      verdict: {
        label: '工程建议',
        value: badRuns.length ? '对 ' + worst[0] + '—' + worst[1] + ' m 挤水泥' : '无需挤水泥',
        tone: badRuns.length ? 'warn' : 'ok',
        html: badRuns.length
          ? '<b>不合格段集中在 ' + worst[0] + '—' + worst[1] + ' m。</b>这是层间封隔的关键段，建议先做验窜，再决定挤水泥；若该段属于快速地层，需结合 VDL 波形人工复核，避免把“地层波快”误判成“胶结差”。'
          : '<b>当前评价井段内没有连续不合格段。</b>仍建议抽查胶结指数最低的 3—5 个点，并与施工记录核对水泥返高与密度。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'cement-bond-quality',
    sceneId: 'c1',
    code: 'C1',
    title: '固井质量智能评价',
    methods: ['cv', 'ts'],

    highlight: '把“一井段一评级”变成“沿井深的胶结指数曲线”，先给曲线，再谈等级。',
    preview: '随井深胶结指数 → 优质 / 合格 / 不合格分级 → 定位需挤水泥段',

    credibility: {
      score: 66,
      level: '中',
      basis: '胶结指数曲线为程序合成（含固定低值段与噪声），不是实测 CBL / VDL；分级阈值与“合格 + 优质”口径按行业常见做法示意，未做现场验窜标定。',
      checks: [
        { k: '数据', v: '合成 0—900 m 曲线，10 m 采样' },
        { k: '方法', v: '阈值分级 + 连续段识别' },
        { k: '验证', v: '不合格段定位与阈值敏感性' }
      ]
    },

    conclusion: {
      title: '默认返高 400 m 时，620—660 m 检出不合格段',
      html: '<p>默认“水泥返高 400 m、密度 1.85 g/cm³、阈值 55”时，评价井段内优质 + 合格约占 <b>90%</b>，620—660 m 出现一段明显低值，形成连续不合格段。模型给出的建议是<b>先验窜、再挤水泥</b>，而不是直接下结论。</p><p>这套曲线是合成的：真实 CBL 受快速地层、微环隙、仪器刻度与套管尺寸影响很大，低值不一定等于胶结差。示范想说明的是“分级口径要显式写出来”，而不是“某个阈值一定对”。</p>'
    },
    limits: [
      '胶结指数曲线为合成数据，不含真实 CBL / VDL 波形、快速地层与微环隙特征，不能据此判断实际固井质量。',
      '分级阈值（55）与优质线（70）是按常见做法示意；不同油田、不同套管尺寸的评级标准并不相同。',
      '只做了单条曲线的阈值分级，没有融合 VDL 波形、水泥浆施工记录与验窜结果。',
      '挤水泥建议只依据“连续低值段”，未考虑层间封隔要求、射孔段位置与经济性。'
    ],

    concept: {
      title: '从测井曲线到挤水泥决策',
      steps: [
        { k: 'LOG', t: 'CBL / VDL', d: '全井段采集，0.5 m 一点' },
        { k: 'NORM', t: '归一化', d: '深度对齐、刻度统一' },
        { k: 'INDEX', t: '胶结指数', d: '套管波衰减 → 0—100' },
        { k: 'CLASS', t: '分级', d: '优质 / 合格 / 不合格' },
        { k: 'ACTION', t: '验窜与挤水泥', d: '人工确认后施工' }
      ]
    },

    judge: [
      { label: '任务类型', value: '曲线分段 + 图像分类', desc: 'CBL 曲线与 VDL 图联合判读' },
      { label: '数据门槛', value: '100—300 段评级', desc: '单井全井段，需施工记录辅助' },
      { label: '收益', value: '1—2 h → 分钟级', desc: '单井评级时间，不含复核', html: '<b style="font-family:var(--mono)">h → min</b>' },
      { label: '难度', value: '高', desc: '评级标准有主观带，误判代价大', html: '<span class="dtag" data-d="高">难度 高</span>' },
      { label: '关键风险', value: '快速地层误判', desc: '低值不等于胶结差', html: '<b style="color:var(--clay-d);font-family:var(--mono)">先验窜</b>' }
    ],

    lede: '固井质量决定层间封隔，评价依据是 CBL / VDL 测井：水泥胶结好则套管波弱、地层波强。传统由解释员按胶结指数分段评级 —— 单井几十幅图，1—2 小时；遇到快速地层与微环隙，评级结果还和解释员经验强相关。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>解释员先在 CBL 曲线上看套管波衰减，再对照 VDL 变密度图判断地层波是否出现，最后按段给出“优质 / 合格 / 不合格”。难点有三：<b>评级标准本身有主观带</b>（不同人对同一段的判断可能差一档）；<b>快速地层</b>会让地层波提前到达，看起来像胶结差；<b>微环隙</b>会造成低值但并非真的窜槽。</p>' +
          '<p>这些误判的代价很直接：一段被误判为不合格，可能触发不必要的挤水泥作业；漏判则可能留下层间窜流通道。所以这件事不能只追求“自动”，必须保留<b>验窜与人工确认</b>。</p>' +
          K.figure(G.fieldSVG('cement'), 1, '固井质量评价示意：井筒环空里的水泥环在部分井段胶结好、部分存在微环隙；右侧是胶结指数曲线，低值段对应需要复核或挤水泥的位置。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>把评价拆成两层：<b>曲线层</b>用 CBL 套管波衰减算胶结指数，做成沿井深的连续曲线；<b>分级层</b>按阈值给出优质 / 合格 / 不合格，并识别连续不合格段。VDL 图像则作为第二通道，帮助区分“胶结差”与“快速地层”。</p>' +
          '<p>模型输出的是<b>候选不合格段</b>，不是施工指令。解释员仍需结合水泥浆返高、密度、验窜结果确认；挤水泥方案由工程人员定。</p>' +
          K.figure(G.flowSVG([
            ['CBL / VDL 采集', '全井段 · 0.5 m', '#5d7fa3'],
            ['预处理', '深度对齐 · 刻度归一', '#8a4b2d'],
            ['胶结指数', '套管波衰减 → 0—100', '#7e5a8d'],
            ['阈值分级', '优质 / 合格 / 不合格', '#b26a39'],
            ['验窜与施工', '人工确认 · 挤水泥', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 4 步输出“段”，不是“井”：连续不合格段才有工程意义。' }), 2, '从曲线到决策的五步。第 3 步是物理量，第 4 步是业务口径 —— 两者不能混在一起。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['CBL / VDL 测井', '全井段，约 0.5 m 一点，含原始波形', '人工评级段 100—300 段'],
            ['水泥浆施工记录', '密度、返高、排量、外加剂', '辅助解释，避免把设计段判成缺陷'],
            ['后续验窜结果', '试压、挤水泥、声幅复测', '作为真值'],
            ['套管与井身结构', '钢级、壁厚、尺寸', '影响 CBL 刻度'],
            ['人工评级表', '按段的等级与依据', '训练与验证']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['固井质量评价行业标准与解释手册', 'CBL / VDL 解释与快速地层识别文献'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('高') + '<span class="small muted">标准主观、特殊地层多，误判会直接触发作业。</span></div>' +
          K.meter('高') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>高</b>：标签本身来自解释员，带主观带；快速地层与微环隙需要专门样本；误判会引发不必要的挤水泥或漏掉真实窜槽。建议先做“辅助分级 + 人工确认”，不要直接自动下发施工建议。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['图像分段分类', '波形特征提取', '主观标注一致性分析'], '#/method/cv') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/completion" style="color:var(--jade-d);font-weight:600">完井</a> · <a href="#/stage/perforation" style="color:var(--jade-d);font-weight:600">射孔</a></p>'
      }
    ],

    workflowTitle: '案例：一口开发井的固井质量评级',
    lead: [
      '某开发井完井后要做固井质量评价，设计水泥返高 400 m。解释组手上有 CBL / VDL 与施工记录，但没有统一的自动评级工具。目标是把**单井评级从 1—2 小时压到分钟级**，并自动圈出需要验窜或挤水泥的连续低值段。',
      '第 1、2 步决定“曲线可不可比”，第 4 步决定“段怎么划”。真正需要人拍板的是第 5 步：低值段到底挤不挤。'
    ],
    stats: [
      ['评价井段', '0—900 m'], ['采样间隔', '0.5 m'], ['人工评级段', '100—300'],
      ['单井耗时', '1—2 h'], ['目标耗时', '<10 min'], ['关键动作', '验窜 / 挤水泥']
    ],
    steps: [
      {
        name: '资料归一化', role: '工程环节',
        input: 'CBL / VDL + 套管参数 + 施工记录',
        do: '深度对齐、刻度统一，剔除套管接箍与仪器异常段；标注水泥返高设计值。',
        output: '可比较的胶结指数曲线',
        viz: '曲线与接箍位置叠加',
        effect: '避免把仪器或接箍异常当成胶结缺陷',
        trap: '不同井的刻度不统一，评级结果无法横向比较'
      },
      {
        name: '评级标准对齐', role: '工程环节',
        input: '人工评级表 + 行业标准',
        do: '统一优质 / 合格 / 不合格的阈值与判定依据，统计解释员之间的一致性。',
        output: '可复现的评级口径',
        viz: '一致性混淆矩阵',
        effect: '让“模型分级”与“人工分级”可比',
        trap: '口径不统一，模型只能学成“平均解释员”'
      },
      {
        name: '曲线与图像分段模型', role: '算法核心',
        input: '胶结指数曲线 + VDL 图像',
        do: '时序分段 + 图像分类双通道，输出逐段等级与置信度，重点学习快速地层样本。',
        output: '分段等级与置信度',
        viz: '曲线分级 + VDL 分块',
        effect: '把逐段目视变成可复现的分级',
        trap: '只学曲线、不看 VDL，会把快速地层判成胶结差'
      },
      {
        name: '连续段识别与建议', role: '效果关键',
        input: '逐段等级',
        do: '按最小段长合并，输出连续不合格段；结合返高与层间封隔要求生成候选建议。',
        output: '不合格段清单 + 验窜建议',
        viz: '井深—等级带状图',
        effect: '把“点异常”变成“可施工的段”',
        trap: '只看单点最低值，会把噪声当成缺陷'
      },
      {
        name: '验窜确认与回流', role: '闭环',
        input: '候选段 + 验窜结果',
        do: '对候选段做验窜或复测，确认后施工；把结果回写为标签，修正阈值与模型。',
        output: '确认后的评级与施工记录',
        viz: '验窜前后对比',
        effect: '把“模型判断”变成“工程事实”',
        trap: '没有验窜，模型永远不知道自己是真对还是假对'
      }
    ],
    metricsTitle: '怎么算“评级对了”',
    metricsHtml: '<p>固井评级不是逐点回归，而是<b>分段分类</b>。单点误差没有意义，段边界偏 10 m 就可能改变挤水泥范围。所以指标要按段算，并单独看“严重误判”。</p>' +
      K.dtable(['指标', '定义', '为什么必须看'], [
        ['分段准确率', '段等级与人工一致的比例', '基础指标'],
        ['段边界偏差', '不合格段起止与人工的差值', '直接决定施工范围'],
        ['严重漏判率', '不合格段被判成优质 / 合格', '漏判会留下窜流通道'],
        ['误判率', '合格段被判成不合格', '会触发不必要的挤水泥']
      ]) +
      '<p style="margin-top:10px">两类错误的代价不对称：漏判通常比误判更严重。阈值应据此调整，而不是追求总体准确率。</p>',
    fails: [
      { name: '快速地层', why: '地层波速度快，VDL 上看起来像套管波弱，容易被判成胶结差。需要把“地层速度”作为条件变量，或建立专门样本。' },
      { name: '微环隙', why: '微环隙会产生低值但不一定窜槽。仅凭胶结指数无法区分，必须结合 VDL 与验窜。' },
      { name: '刻度与接箍干扰', why: '不同仪器刻度、套管接箍与扶正器位置会产生周期性异常。预处理不干净，模型会学到设备特征。' },
      { name: '主观标签', why: '人工评级本身有 ±1 档的不确定性。训练前必须做一致性分析，否则模型学的是噪声。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 固井评级',
      title: '沿井深看胶结指数，先找连续低值段，再谈等级',
      desc: '这是一条程序合成的胶结指数曲线：640 m 附近埋了一段低值，820 m 附近是轻微低值。调水泥返高、浆体密度与评价阈值，看不合格段怎么移动、挤水泥建议怎么变。',
      chartTitle: '胶结指数随井深变化',
      chartHint: '背景色=分级 · 虚线=评价阈值',
      controls: [
        { key: 'top', label: '水泥返高', min: 300, max: 900, step: 10, value: 400, display: function (v) { return v + ' m'; } },
        { key: 'dens', label: '水泥浆密度', min: 1.4, max: 2.2, step: 0.01, value: 1.85, display: function (v) { return v.toFixed(2) + ' g/cm³'; } },
        { key: 'thr', label: '评价阈值', min: 40, max: 80, step: 1, value: 55, display: function (v) { return String(v); } }
      ],
      tags: [
        { text: 'CV + TS · 分段', tone: 'jade' },
        { text: '阈值分级', tone: '' },
        { text: '验窜确认', tone: 'clay' }
      ],
      compute: compute,
      foot: '曲线为程序合成，不含真实 CBL / VDL 与快速地层；评级阈值按常见做法示意，施工建议必须经验窜与工程确认。'
    }
  });
})();
