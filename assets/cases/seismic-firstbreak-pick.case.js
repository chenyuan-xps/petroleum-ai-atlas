/* =========================================================
   跨环节案例 · s3 初至波自动拾取
   ---------------------------------------------------------
   场景：物探（02）
   方法：时序预测 · 波形回归 / 概率图
   示范：合成炮集 + 噪声 / 面波 + 阈值拾取与容差打分
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var N = 300, DT = 2, TMAX = 600;
  var OFFSETS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];

  function pickTrace(samples, thr) {
    var env = [], i, m = 0;
    for (i = 0; i < samples.length; i++) {
      var a = Math.abs(samples[i]);
      var b = i > 0 ? Math.abs(samples[i - 1]) : a;
      var c = i < samples.length - 1 ? Math.abs(samples[i + 1]) : a;
      env.push((a + b + c) / 3);
    }
    for (i = 25; i < env.length; i++) if (env[i] > m) m = env[i];
    for (i = 25; i < env.length - 2; i++) {
      if (env[i] >= thr * m && env[i + 1] >= thr * m) return i * DT;
    }
    return TMAX;
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
    var traces = [], truth = [], picks = [], errs = [];
    OFFSETS.forEach(function (off) {
      var t0 = 70 + off * 0.45;
      var samples = [];
      for (var j = 0; j < N; j++) {
        var t = j * DT;
        var x = (t - t0) / 16;
        /* 初至从 t0 开始（因果子波），保证“真实初至”与波形起点一致 */
        var w = t >= t0 ? (1 - 2 * x * x) * Math.exp(-x * x) : 0;
        var xs = (t - (t0 + 120)) / 42;
        var sw = st.surf * 0.75 * (1 - 2 * xs * xs) * Math.exp(-xs * xs);
        var noise = (rnd() * 2 - 1) * st.noise;
        samples.push(w + sw + noise);
      }
      var pk = pickTrace(samples, st.thr);
      traces.push({ offset: off, samples: samples });
      truth.push(t0);
      picks.push(pk);
      errs.push(pk - t0);
    });
    var hit = 0, bad = 0, sum = 0, max = 0;
    errs.forEach(function (e) {
      var a = Math.abs(e);
      sum += a;
      if (a <= 8) hit++;
      if (a > 25) bad++;
      if (a > max) max = a;
    });
    var rate = hit / errs.length;
    var mae = sum / errs.length;
    var status = rate >= 0.9 && mae <= 8 ? '可进入静校正（仍需抽检）'
      : rate >= 0.7 ? '部分道需返工' : '不可用，先压制面波 / 降噪';

    return {
      kpis: [
        { label: '容差命中率（±8 ms）', value: (rate * 100).toFixed(0), unit: '%', tone: rate >= 0.9 ? 'ok' : rate >= 0.7 ? 'warn' : 'bad' },
        { label: '平均绝对误差', value: mae.toFixed(1), unit: 'ms', tone: mae <= 8 ? 'ok' : 'warn' },
        { label: '错拾道数', value: bad + ' / ' + errs.length, unit: '道', tone: bad ? 'bad' : '' },
        { label: '最大误差', value: max.toFixed(0), unit: 'ms' },
        { label: '流程状态', value: status, wide: true, tone: rate >= 0.9 ? 'ok' : 'warn' }
      ],
      chart: {
        type: 'trace',
        title: '炮集波形与初至拾取',
        hint: '纵轴时间 0—600 ms · 横轴偏移距',
        traces: traces,
        tMax: TMAX,
        truth: truth,
        picks: picks,
        pickLabel: '自动拾取',
        legend: [
          { color: '#3a352d', label: '波形（含噪声与面波）', line: true },
          { color: '#2f3a3f', label: '真实初至（虚线）', line: true },
          { color: '#b26a39', label: '自动拾取点' }
        ]
      },
      table: {
        head: ['口径', '人工拾取（经验量级）', '本次（合成）'],
        rows: [
          ['单工区工时', '数人月', '分钟级推理 + 抽检'],
          ['平均误差', '5—10 ms', mae.toFixed(1) + ' ms'],
          ['低信噪比道返工', '10%—20%', (bad / errs.length * 100).toFixed(0) + '%'],
          ['一致性', '不同人差 2—4 ms', '同参数同结果']
        ],
        hl: 0
      },
      verdict: {
        label: '拾取状态',
        value: rate >= 0.9 ? '可直接用于静校正' : rate >= 0.7 ? '先抽检再入库' : '先做噪声压制',
        tone: rate >= 0.9 ? 'ok' : 'warn',
        html: '<b>远偏移距是最容易失手的地方。</b>面波能量比初至强时，阈值会把拾取点拉到面波上；噪声高时又会提前触发。解决顺序是“先压制干扰、再调阈值”，而不是让模型硬扛。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'seismic-firstbreak-pick',
    sceneId: 's3',
    code: 'S3',
    title: '初至波自动拾取',
    methods: ['ts'],

    highlight: '把“逐道点初至”变成“整炮概率图 + 连续性约束”，人只处理异常道。',
    preview: '11 道合成炮集 → 噪声 / 面波干扰 → 阈值拾取 → 容差命中率与错拾统计',

    credibility: {
      score: 68,
      level: '中',
      basis: '波形由雷克子波、面波与随机噪声合成，初至真值已知；拾取逻辑为包络阈值，未使用深度模型，因此指标只反映“阈值 + 干扰”的关系。',
      checks: [
        { k: '数据', v: '11 道 × 300 采样点（2 ms）' },
        { k: '方法', v: '包络阈值拾取 + ±8 ms 容差' },
        { k: '验证', v: '与合成初至逐道比对' }
      ]
    },

    conclusion: {
      title: '噪声 0.30、阈值 0.35 下多数道可命中，一道被噪声带偏',
      html: '<p>默认条件下，11 道里有 10 道落在 ±8 ms 容差内，平均绝对误差约 10 ms；剩下的一道在远偏移距，初至能量被噪声尖峰掩盖，拾取点提前了约 100 ms。这与现场经验一致 —— <b>初至拾取从来不是“全工区一个阈值”</b>，而要按信噪比分档。</p><p>“数人月 → 分钟级”是工区量级的流程对比，不是本合成的实测。真实工区还要做静校正迭代、异常道剔除与人工抽检，模型输出只是把人工从“逐道点”变成“审异常”。</p>'
    },
    limits: [
      '合成炮集只有直达波、面波与白噪声，没有折射波、多次波、坏道与极性反转；真实资料需先做这些处理。',
      '拾取使用包络阈值而非训练模型，不能代表深度模型的精度；它演示的是“阈值—干扰—容差”的因果关系。',
      '±8 ms 容差按 2 ms 采样、4 个采样点设定；实际容差应随目的层精度与采样率调整。',
      '没有做静校正闭环，拾取误差对叠加成像的影响未在示范中体现。'
    ],

    concept: {
      title: '从炮集到初至表',
      steps: [
        { k: 'INPUT', t: '炮集记录', d: '多道波形 + 炮检坐标' },
        { k: 'QC', t: '道集整理', d: '坏道、极性、面波检查' },
        { k: 'PICK', t: '初至拾取', d: '波形回归 / 概率图' },
        { k: 'POST', t: '连续性约束', d: '中值滤波、异常道剔除' },
        { k: 'CHECK', t: '人工抽检', d: '低信噪比道重点复核' }
      ]
    },

    judge: [
      { label: '任务类型', value: '波形回归 / 概率图', desc: '逐道给初至时刻，不是逐点分类' },
      { label: '数据门槛', value: '5%—10% 人工拾取', desc: '单工区 10 万—100 万道' },
      { label: '收益', value: '数人月 → 数小时', desc: '推理 + 异常道复核', html: '<b style="font-family:var(--mono)">人月 → 小时</b>' },
      { label: '难度', value: '中', desc: '数据量大、推理成本高，干扰多样', html: '<span class="dtag" data-d="中">难度 中</span>' },
      { label: '关键指标', value: '±8 ms 命中率', desc: '容差内算命中，不看逐点误差', html: '<b style="color:var(--clay-d);font-family:var(--mono)">±8 ms</b>' }
    ],

    lede: '初至拾取是地震资料处理的第一步，决定静校正与叠加成像的质量。常规做法是在炮集上逐道人工拾取初至时间 —— 一个三维工区上百万道，靠人点，工期以月计，而且低信噪比道的误差最大、返工最多。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>人工拾取时，解释员要在每一道上找到“能量突然起跳”的位置。近偏移距道初至干净，远偏移距道被面波、折射波和环境噪声覆盖，拾取点容易偏。一个工区几十万到上百万道，<b>人工工期以人月计</b>；更麻烦的是，不同人、不同批次的拾取标准不完全一致，静校正迭代时会反复返工。</p>' +
          '<p>这个任务的定义要非常小心：它不是“预测一个连续曲线”，而是<b>逐道给一个时刻</b>。评价也不能用 MSE，而要用“是否落在容差内”。</p>' +
          K.figure(G.fieldSVG('seismic'), 1, '炮集记录示意：炮点激发，检波器沿测线接收；下方波形里，初至是第一个起跳，后面紧跟面波与噪声。远偏移距道的初至最容易被面波“埋住”。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>主流做法是把炮集当成一张图：用 1D U-Net 或波形回归网络，对每道输出“初至概率曲线”，再取概率峰值作为时刻；也可以直接回归时刻。关键不在网络本身，而在<b>前后两步</b>：前面要压制面波、做道均衡；后面要用连续性约束（相邻道初至不应跳变）剔除异常拾取。</p>' +
          '<p>替换的仍然是“逐道点初至”这道工序，解释员转为<b>审异常道</b>。这也是为什么容差命中率比平均误差更重要：静校正只关心有没有落在容差内。</p>' +
          K.figure(G.flowSVG([
            ['炮集整理', '坏道 · 极性 · 几何', '#5d7fa3'],
            ['干扰压制', '面波 · 折射 · 道均衡', '#8a4b2d'],
            ['初至拾取', '1D U-Net / 波形回归', '#7e5a8d'],
            ['连续性约束', '中值滤波 · 异常剔除', '#b26a39'],
            ['人工抽检', '低信噪比道复核', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 2 步决定上限：面波没压住，再好的拾取模型也会被带偏。' }), 2, '从炮集到初至表的五步。第 4 步的连续性约束是“工程智慧”：它不提升单道精度，但能大幅减少离谱的异常拾取。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['炮集原始记录', 'SEG-Y / 内部格式，含炮检坐标与观测系统', '按工区分批'],
            ['人工拾取标签', '覆盖 5%—10% 的道，按信噪比分档', '训练与验证'],
            ['近地表高程与速度', '炮点、检波点坐标与低降速带资料', '静校正与质量控制'],
            ['低信噪比道样本', '远偏移距、复杂表层', '重点标注'],
            ['处理流程记录', '滤波、反褶积、面波压制参数', '保证训练与推理同口径']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['公开地震处理教材与 SEG-Y 规范', '各向异性 / 低信噪比初至拾取研究文献'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('中') + '<span class="small muted">方法成熟、数据量大；难点是干扰多样与推理成本。</span></div>' +
          K.meter('中') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>中</b>：初至拾取的方法链已经比较成熟，真正花时间的是<b>标签抽检</b>与<b>分档阈值</b>。如果工区表层条件变化剧烈，建议先在一个束线做验证，再推广到全工区。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['波形回归', 'U-Net 概率图', '强噪声鲁棒学习'], '#/method/ts') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/geology" style="color:var(--jade-d);font-weight:600">地质勘察</a> · <a href="#/stage/drilling" style="color:var(--jade-d);font-weight:600">钻井</a></p>'
      }
    ],

    workflowTitle: '案例：一个三维工区的初至拾取提速',
    lead: [
      '某三维工区有约 40 万道炮集记录，近地表条件横向变化。处理组的目标不是“替掉拾取员”，而是把**逐道人工拾取变成“模型初拾 + 异常道复核”**，把工期从数人月压到数小时，同时保证 ±8 ms 容差内的命中率。',
      '第 2 步和第 4 步是这类项目最容易忽略、却最影响结果的两步：干扰压制决定初至是否“可见”，连续性约束决定异常拾取会不会污染静校正。'
    ],
    stats: [
      ['工区道数', '约 40 万'], ['人工标签', '5%—10%'], ['容差', '±8 ms'],
      ['拾取方式', '逐道'], ['原工期', '数人月'], ['目标工期', '数小时 + 抽检']
    ],
    steps: [
      {
        name: '炮集整理与 QC', role: '工程环节',
        input: '原始炮集 + 观测系统 + 坐标',
        do: '检查坏道、缺道、极性与几何，统一到同一处理流程；按束线划分训练 / 验证。',
        output: '可用的炮集与分档清单',
        viz: '道集显示 + 坏道标记',
        effect: '避免把“坏道”当成“难样本”',
        trap: '按道随机划分会让同一炮的相邻道同时进训练与验证'
      },
      {
        name: '干扰压制与道均衡', role: '工程环节',
        input: '炮集记录',
        do: '面波压制、折射波分离、道均衡与带通滤波；保留初至频段。',
        output: '初至更清晰的炮集',
        viz: '压制前后对比',
        effect: '把“能不能拾”这件事先解决掉',
        trap: '压制过重会削弱初至，反而让拾取点后移'
      },
      {
        name: '初至拾取模型', role: '算法核心',
        input: '炮集道 + 人工标签',
        do: '1D U-Net / 波形回归输出初至概率曲线，取峰值时刻；按信噪比分档训练。',
        output: '逐道初至时刻 + 置信度',
        viz: '概率曲线叠加波形',
        effect: '把逐道人工点选变成批量推理',
        trap: '只用一个全局阈值会在低信噪比道系统性偏移'
      },
      {
        name: '连续性约束与异常剔除', role: '效果关键',
        input: '逐道初至 + 置信度',
        do: '相邻道中值滤波、时距曲线拟合，剔除跳变与低置信度拾取，标记返工道。',
        output: '干净的初至表 + 异常道清单',
        viz: '时距曲线与残差',
        effect: '把零星离谱拾取挡在静校正之前',
        trap: '约束过强会把真实的地表异常（如低速带）抹平'
      },
      {
        name: '人工抽检与闭环', role: '闭环',
        input: '初至表 + 异常道清单',
        do: '按信噪比与残差抽检，人工重拾异常道；结果回流训练集。',
        output: '交付初至表 + 质量报告',
        viz: '分档命中率与残差分布',
        effect: '每束线都在改善下一束线',
        trap: '只抽检近偏移距会漏掉真正的问题道'
      }
    ],
    metricsTitle: '怎么算“拾取对了”',
    metricsHtml: '<p>初至拾取的评价必须带容差：2 ms 采样下，±8 ms 就是 ±4 个采样点。用平均误差会掩盖“少数道错得离谱”，用逐点准确率又没有意义。所以这里同时看<b>命中率、平均误差与错拾道数</b>。</p>' +
      K.dtable(['指标', '定义', '在本示范里的含义'], [
        ['容差命中率', '|误差| ≤ 8 ms 的道占比', '静校正真正关心的比例'],
        ['平均绝对误差', '所有道 |误差| 的均值', '整体偏移程度'],
        ['错拾道数', '|误差| > 25 ms 的道数', '需要人工返工的道'],
        ['分档命中率', '按信噪比 / 偏移距分组的命中率', '暴露模型在哪一档失效']
      ]) +
      '<p style="margin-top:10px">真实项目还应报告<b>静校正迭代后的成像质量</b>，因为初至误差最终是通过叠加剖面体现的。</p>',
    fails: [
      { name: '面波与折射干扰', why: '面波能量常比初至强，包络阈值会直接落到面波上。必须先做面波压制，或让模型学习“初至的形态”而不是“最大能量”。' },
      { name: '极性反转与坏道', why: '反极性道的起跳方向相反，基于能量的拾取会偏移半个周期。应在 QC 阶段修正或剔除。' },
      { name: '近偏移距井口干扰', why: '炮点附近的强能量会淹没最近道的初至，这一档通常需要单独建模或人工拾取。' },
      { name: '全局阈值', why: '不同偏移距、不同表层的初至能量差异很大，一个阈值必然在某些档失效。应按信噪比分档设阈值。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 初至拾取',
      title: '在一炮记录上拾取初至，看噪声与面波如何带偏结果',
      desc: '这是程序合成的 11 道炮集：真实初至已知，所以能逐道算误差。增大噪声或面波，观察拾取点怎样从初至跳到干扰上；再调阈值，看命中率与错拾道数的取舍。',
      chartTitle: '炮集波形与初至拾取',
      chartHint: '纵轴 0—600 ms · 横轴偏移距',
      controls: [
        { key: 'noise', label: '随机噪声', min: 0.02, max: 0.6, step: 0.01, value: 0.3, display: function (v) { return v.toFixed(2); } },
        { key: 'surf', label: '面波强度', min: 0, max: 1.2, step: 0.02, value: 0.8, display: function (v) { return v.toFixed(2); } },
        { key: 'thr', label: '拾取阈值', min: 0.2, max: 0.8, step: 0.01, value: 0.35, display: function (v) { return v.toFixed(2); } }
      ],
      tags: [
        { text: 'TS · 波形回归', tone: 'jade' },
        { text: '容差 ±8 ms', tone: '' },
        { text: '面波干扰', tone: 'clay' }
      ],
      compute: compute,
      foot: '炮集为程序合成（雷克子波 + 面波 + 白噪声），拾取使用包络阈值；真实资料需先压制干扰并做静校正闭环。'
    }
  });
})();
