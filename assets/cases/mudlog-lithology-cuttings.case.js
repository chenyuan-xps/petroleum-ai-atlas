/* =========================================================
   跨环节案例 · m1 岩屑岩性自动识别
   ---------------------------------------------------------
   场景：录井（04）
   方法：计算机视觉 · 细粒度分类 / 多标签
   示范：岩屑显微特征 → 六类概率排序 → 阈值与复核
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var CLASSES = [
    { key: 'sand', name: '砂岩', base: 0.84, color: '#c99a56' },
    { key: 'silt', name: '粉砂岩', base: 0.62, color: '#a3855f' },
    { key: 'mud', name: '泥岩', base: 0.55, color: '#6b89a3' },
    { key: 'shale', name: '页岩', base: 0.42, color: '#8878ab' },
    { key: 'lime', name: '灰岩', base: 0.38, color: '#a5ad8d' },
    { key: 'dol', name: '白云岩', base: 0.30, color: '#8f9aa6' }
  ];

  function compute(st) {
    var rnd = (function (a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })(20261103);
    var scores = [];
    CLASSES.forEach(function (c) {
      var s = c.base;
      if (c.key === 'sand') s += (st.grain - 2) * 0.16 - st.cont * 0.22;
      if (c.key === 'silt') s += (2 - st.grain) * 0.10 - st.cont * 0.08;
      if (c.key === 'mud') s += st.cont * 0.16 - (st.grain - 2) * 0.07;
      if (c.key === 'shale') s += st.cont * 0.20;
      if (c.key === 'lime') s += (st.grain - 2) * 0.12 - st.cont * 0.05;
      if (c.key === 'dol') s += (st.grain - 2) * 0.06;
      s += (rnd() - 0.5) * 0.10;
      scores.push(s);
    });
    var exps = scores.map(function (s) { return Math.exp(s * 12); });
    var sum = exps.reduce(function (a, b) { return a + b; }, 0);
    var probs = exps.map(function (e) { return e / sum; });
    var order = CLASSES.map(function (c, i) {
      return { name: c.name, color: c.color, p: probs[i], key: c.key };
    }).sort(function (a, b) { return b.p - a.p; });
    var top = order[0];
    var passed = order.filter(function (o) { return o.p >= st.thr; });
    var review = top.p < 0.60 || (order[1].p > 0.30);

    return {
      kpis: [
        { label: '主类判定', value: top.name, tone: 'ok' },
        { label: '主类置信度', value: (top.p * 100).toFixed(0), unit: '%', tone: top.p >= 0.65 ? 'ok' : 'warn' },
        { label: '通过阈值类别', value: String(passed.length), unit: '类', tone: passed.length ? '' : 'bad' },
        { label: '复核需求', value: review ? '需人工复核' : '可直接入库', wide: true, tone: review ? 'warn' : 'ok' }
      ],
      chart: {
        type: 'bars',
        title: '六类岩性的模型概率',
        hint: '按概率排序 · 虚线为入库阈值',
        items: order.map(function (o) {
          return {
            name: o.name,
            note: o.p >= st.thr ? '过阈值' : '低于阈值',
            value: o.p * 100,
            text: (o.p * 100).toFixed(1),
            color: o.p >= st.thr ? o.color : '#cfc8b6',
            bad: o.p < st.thr,
            hl: o.key === top.key
          };
        }),
        unit: '%',
        max: 100,
        digits: 1,
        threshold: { value: st.thr * 100, label: '阈值 ' + (st.thr * 100).toFixed(0) + '%' },
        legend: CLASSES.map(function (c) { return { color: c.color, label: c.name }; })
      },
      table: {
        head: ['口径', '人工描述', '本次（合成特征）'],
        rows: [
          ['主类', '镜下目估', top.name],
          ['次类', '按含量排序', order[1] ? order[1].name + '（' + (order[1].p * 100).toFixed(0) + '%）' : '—'],
          ['处理时间', '1—2 min / 张', '秒级 + 复核'],
          ['一致性', '同一块样品可差一个粒级', review ? '建议复核' : '可自动入库']
        ],
        hl: 0
      },
      verdict: {
        label: '入库判断',
        value: top.p >= st.thr ? top.name + '（' + (top.p * 100).toFixed(0) + '%）' : '主类未过阈值',
        tone: top.p >= st.thr && !review ? 'ok' : 'warn',
        html: review
          ? '<b>主类与次类差距不大，属于“看起来像两种”的样品。</b>这类样品在真实录井里最常见：粉砂岩与细砂岩、泥岩与页岩，肉眼都难分。建议把这一张推给录井工复核，而不是强行自动入库。'
          : '<b>主类明确，可自动入库。</b>但仍要保留原图与概率，便于后期按井深追溯；含油级别不能由这套模型给出，必须单独判断。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'mudlog-lithology-cuttings',
    sceneId: 'm1',
    code: 'M1',
    title: '岩屑岩性自动识别',
    methods: ['cv'],

    highlight: '岩屑识别的难点不是“分得开”，而是“混样与细粒级让人也分不开”。',
    preview: '六类岩屑概率排序 → 混样 / 粒级影响 → 阈值决定自动入库还是人工复核',

    credibility: {
      score: 62,
      level: '中',
      basis: '概率由人工设定的类别基分、混样与粒级效应合成，不是真实显微图像训练结果；用于演示“细粒度分类 + 阈值 + 复核”的判断逻辑，不用于估计真实精度。',
      checks: [
        { k: '数据', v: '六类合成概率，无真实图像' },
        { k: '方法', v: 'softmax 概率 + 入库阈值' },
        { k: '验证', v: '主类 / 次类差距与复核判断' }
      ]
    },

    conclusion: {
      title: '默认参数下主类为砂岩，置信度约 65%',
      html: '<p>默认“混样 0.35、粒级中等、阈值 0.55”时，砂岩概率约 <b>65%</b>，粉砂岩与泥岩各占一成多，主类明确、可自动入库。把混样程度调高，泥岩的概率上升，主类置信度掉到 55% 左右，次类差距缩小，这时应转人工复核而不是硬判。</p><p>要强调的是：<b>含油级别不在这套模型里</b>。岩性识别只能回答“是什么岩”，回答不了“含不含油、含多少”。真实项目里这两件事必须分开建模、分开验收。</p>'
    },
    limits: [
      '概率由合成规则生成，没有使用真实岩屑显微图像；类别可分性、纹理特征与真实情况差距很大。',
      '未建模洗样、污染、荧光与含油级别；这些因素在真实录井中会显著改变图像与标签。',
      '六类只是示意，真实区块的岩性类别更多，且存在过渡类型与混层，单标签分类会丢信息。',
      '阈值只决定“是否自动入库”，不代表岩性判定正确；仍需按井深抽检并与测井曲线对照。'
    ],

    concept: {
      title: '从岩屑到岩性表',
      steps: [
        { k: 'SAMPLE', t: '捞样与洗样', d: '每 1—2 m，固定处理流程' },
        { k: 'IMAGE', t: '显微成像', d: '固定光照、标尺、批量拍摄' },
        { k: 'CLASSIFY', t: '细粒度分类', d: '六类概率 + 多标签组分' },
        { k: 'THRESH', t: '阈值判断', d: '自动入库 / 人工复核' },
        { k: 'LOG', t: '形成描述表', d: '按井深回填，与测井对照' }
      ]
    },

    judge: [
      { label: '任务类型', value: '细粒度图像分类', desc: '类间差异小，常需多标签组分' },
      { label: '数据门槛', value: '每类 ≥500 张', desc: '单井 300—800 张，需固定光照' },
      { label: '收益', value: '1—2 min → 秒级', desc: '单张描述时间，不含复核', html: '<b style="font-family:var(--mono)">min → s</b>' },
      { label: '难度', value: '高', desc: '混样、污染与类别不均衡叠加', html: '<span class="dtag" data-d="高">难度 高</span>' },
      { label: '关键限制', value: '含油级别另做', desc: '岩性模型不能替代含油描述', html: '<b style="color:var(--clay-d);font-family:var(--mono)">分开建模</b>' }
    ],

    lede: '岩屑录井是判断钻遇地层最直接的手段。捞取的岩屑由录井工在显微镜下目估成分、粒级与含油级别，形成岩屑描述表。每 1—2 m 捞一次，单井数百个样品 —— 岩屑细小、混样严重，同一块样品不同人描述能差一个粒级。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>岩屑从振动筛上捞取、清洗、晾干，再放到显微镜下观察。录井工要判断<b>成分（砂岩、泥岩、灰岩…）、粒级（细、中、粗）、含油级别</p>，并把结果按井深填表。单井几百个样品，每个样品 1—2 分钟，遇到混样还要反复看。</p>' +
          '<p>问题的根源不是“看不清”，而是<b>样品本身不纯</b>：钻井液携带的岩屑在井筒里混合，软地层岩屑容易被冲碎，洗样与污染又会改变颜色与粒度。这些因素会直接变成标签噪声，任何模型都绕不过去。</p>' +
          K.figure(G.fieldSVG('mudlog'), 1, '岩屑录井现场：振动筛捞样、样品盘分装、镜下观察。右侧显微镜视野里，不同颜色的颗粒就是不同岩性 —— 但真实样品往往混在一起，还带泥浆与油污。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>把岩屑显微图像做<b>细粒度分类</b>：固定光照与标尺拍图，模型输出六类（或更多）岩性概率；对混样样品，用<b>多标签 / 组分回归</b>给出比例，而不是强行选一个主类。最后按阈值决定“自动入库”还是“人工复核”。</p>' +
          '<p>这里的关键不是网络深度，而是<b>拍摄规范</b>与<b>样品分组</b>：同一块样品的多张图必须分在同一集合，否则模型会记住“这一块”而不是“这一类”。</p>' +
          K.figure(G.flowSVG([
            ['捞样 / 洗样', '固定流程 · 固定筛布', '#5d7fa3'],
            ['显微成像', '固定光照 · 标尺 · 批量', '#8a4b2d'],
            ['细粒度分类', '六类概率 / 多标签', '#7e5a8d'],
            ['阈值判断', '自动入库 / 复核', '#b26a39'],
            ['描述表回填', '按井深 · 与测井对照', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 1、2 步是“数据质量”，不是“算法”；拍图不规范，后面全白做。' }), 2, '从岩屑到描述表的五步。第 3 步输出概率，第 4 步才做决定 —— 把“识别”和“入库”分开，才能控制标签噪声。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['岩屑显微图像', '单井 300—800 张，固定光照、固定放大倍率、带标尺', '每类 ≥500 张'],
            ['岩屑描述表', '对应井深、岩性、粒级、含油级别', '作标签，含油级别单列'],
            ['洗样与混样记录', '样品处理条件、混样比例', '用于分组，避免数据泄漏'],
            ['井深与钻时', '岩屑滞后井深校正', '对齐录井深度'],
            ['测井曲线', 'GR / SP / 岩性密度', '交叉验证']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['公开岩屑 / 矿物显微图像数据集', '细粒度图像分类与类别不均衡处理方法'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('高') + '<span class="small muted">类间差异小、样本不均衡，标签本身带噪声。</span></div>' +
          K.meter('高') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>高</b>：泥岩与页岩、粉砂岩与细砂岩在图像上差异很小；混样与污染又让标签本身不可靠。可行的路径是先用<b>多标签 + 组分</b>降低“必须选一个”的压力，再逐步收敛到单标签。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['细粒度图像分类', '小样本学习', '类别不均衡处理'], '#/method/cv') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/drilling" style="color:var(--jade-d);font-weight:600">钻井</a> · <a href="#/stage/welllog" style="color:var(--jade-d);font-weight:600">测井</a></p>'
      }
    ],

    workflowTitle: '案例：一口探井的岩屑自动描述',
    lead: [
      '某探井设计井深 4200 m，每 1.5 m 捞样一次，预计 800 个样品。录井队只有两人，人工描述要占用大量夜班时间。项目目标是把**单张描述从 1—2 分钟压到秒级**，但含油级别仍由人工判断，模型只负责岩性与粒级。',
      '第 1、2 步是“把图像拍一致”，第 4 步是“把识别与入库分开”。这两件事做不好，模型精度再高也没法用。'
    ],
    stats: [
      ['设计井深', '4200 m'], ['捞样间隔', '1.5 m'], ['预计样品', '约 800'],
      ['岩性类别', '6'], ['人工耗时', '1—2 min / 张'], ['目标', '秒级 + 复核']
    ],
    steps: [
      {
        name: '捞样与洗样规范', role: '工程环节',
        input: '振动筛岩屑 + 洗样流程',
        do: '固定筛布、清洗时间与烘干方式；记录混样与污染情况，按“样品批次”分组。',
        output: '可比较的岩屑样品',
        viz: '洗样前后对比',
        effect: '把“样品差异”与“岩性差异”分开',
        trap: '不同班次用不同洗法，模型会学到班次而不是岩性'
      },
      {
        name: '显微成像', role: '工程环节',
        input: '分装样品 + 显微镜',
        do: '固定光照、放大倍率与白平衡，每样品拍 3—5 个视野，带标尺。',
        output: '标准化显微图像',
        viz: '同一岩性的多视野拼图',
        effect: '颜色与粒度可比，模型才能学纹理',
        trap: '自动白平衡会让同一岩性在不同照片里颜色不同'
      },
      {
        name: '细粒度分类', role: '算法核心',
        input: '图像 + 岩性标签',
        do: 'CNN / ViT 输出六类概率；混样样品用多标签或组分回归，不强行单标签。',
        output: '类别概率与组分比例',
        viz: '混淆矩阵 + 概率排序',
        effect: '把“目估”变成可比较的概率',
        trap: '按图像随机划分会让同一块样品进训练与验证，指标虚高'
      },
      {
        name: '阈值与入库判断', role: '效果关键',
        input: '类别概率',
        do: '按阈值决定自动入库或转人工；主类与次类差距小于阈值时强制复核。',
        output: '自动描述 + 复核清单',
        viz: '概率—复核量曲线',
        effect: '把模型的不确定性显式交给录井工',
        trap: '只设一个高阈值会让复核量爆掉，录井工反而不用'
      },
      {
        name: '描述表回填与对照', role: '闭环',
        input: '自动描述 + 测井曲线',
        do: '按井深回填，和 GR / 岩性密度对照；异常段人工复核并回流样本。',
        output: '岩屑描述表 + 修正样本',
        viz: '岩性柱与测井曲线对照',
        effect: '用测井约束岩屑的深度与类别',
        trap: '不做岩屑滞后校正，岩性与深度会系统性错位'
      }
    ],
    metricsTitle: '怎么算“识别对了”',
    metricsHtml: '<p>岩屑识别不能只看整体准确率：砂岩样品占多数时，全判砂岩也能拿到高分，但泥岩与页岩全错。要按类别看<b>召回率</b>，并单独统计“主类与次类接近”的样品。</p>' +
      K.dtable(['指标', '定义', '为什么必须分开看'], [
        ['Macro-F1', '各类 F1 的算术平均', '防止多数类掩盖小类'],
        ['各类召回率', '该类被正确识别的比例', '泥岩 / 页岩最容易漏'],
        ['混淆对', '最常互相误判的类别对', '决定复核清单怎么排'],
        ['复核率', '被转人工的样品比例', '直接决定录井工时']
      ]) +
      '<p style="margin-top:10px">含油级别、荧光与油气显示必须单独建模、单独验收，不能用岩性分类的指标替代。</p>',
    fails: [
      { name: '混样与污染', why: '钻井液携带的岩屑互相混合，油污与泥浆会改变颜色。应记录混样比例，并把“混样”作为独立标签。' },
      { name: '类间差异小', why: '泥岩 / 页岩、粉砂岩 / 细砂岩在低倍镜下几乎一样。需要更高倍率、偏振光或纹理特征，而不是只靠颜色。' },
      { name: '类别不均衡', why: '砂岩样品可能占七成，小类样本不足。需要重采样、类别加权与分层抽样验证。' },
      { name: '拍摄条件漂移', why: '光照、白平衡、放大倍率变化会直接改变图像分布。必须固定拍摄规范，否则模型学的是设备而不是岩性。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 细粒度分类',
      title: '在六类岩屑里选主类，并决定这一张要不要复核',
      desc: '这是按“混样程度 + 粒级”合成的六类概率，不是真实显微图像。调整混样与粒级，看主类置信度与过阈值类别数怎么变；阈值决定自动入库还是转人工。',
      chartTitle: '六类岩性的模型概率',
      chartHint: '按概率排序 · 虚线为入库阈值',
      controls: [
        { key: 'cont', label: '混样程度', min: 0, max: 1, step: 0.01, value: 0.35, display: function (v) { return (v * 100).toFixed(0) + '%'; } },
        { key: 'grain', label: '粒级（细 → 粗）', min: 1, max: 3, step: 1, value: 2, display: function (v) { return ['细', '中', '粗'][v - 1] + '粒'; } },
        { key: 'thr', label: '入库阈值', min: 0.3, max: 0.9, step: 0.01, value: 0.55, display: function (v) { return (v * 100).toFixed(0) + '%'; } }
      ],
      tags: [
        { text: 'CV · 细粒度分类', tone: 'jade' },
        { text: '多标签', tone: '' },
        { text: '人工复核', tone: 'clay' }
      ],
      compute: compute,
      foot: '概率由合成规则生成，不含真实显微图像与含油级别；真实项目需固定拍摄规范、按样品分组，并单独建模含油描述。'
    }
  });
})();
