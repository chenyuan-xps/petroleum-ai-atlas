/* =========================================================
   跨环节案例 · t1 管道泄漏智能检测
   ---------------------------------------------------------
   场景：运输（12）
   方法：时序分析 · 多源异常检测
   示范：压力残差曲线 + 报警阈值 + 检测延迟 / 误报统计
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;

  var TMAX = 180, DT = 1, LEAK_AT = 90;

  function compute(st) {
    var rnd = (function (a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })(20261103);
    var points = [], det = null, falseAlarm = 0, aboveRun = 0;
    for (var t = 0; t <= TMAX; t += DT) {
      var noise = (rnd() * 2 - 1) * st.noise;
      var leak = t >= LEAK_AT ? (t - LEAK_AT) * st.leak * 0.9 : 0;
      var v = noise + leak;
      points.push([t, v]);
      if (v > st.thr) {
        aboveRun++;
        if (aboveRun >= 3) {
          if (t < LEAK_AT - 2) {
            if (aboveRun === 3) falseAlarm++;
          } else if (det === null && t >= LEAK_AT - 2) {
            det = t - 2;
          }
        }
      } else {
        aboveRun = 0;
      }
    }
    var delay = det === null ? null : Math.max(0, det - LEAK_AT);
    var status = delay === null ? '漏检：小泄漏被噪声淹没'
      : delay <= 8 ? '可报警，建议结合流量平衡定位'
        : delay <= 20 ? '可检出，但延迟偏大' : '延迟过长，需改阈值或降噪';

    return {
      kpis: [
        { label: '检测延迟', value: delay === null ? '未检出' : String(delay), unit: delay === null ? '' : 'min', tone: delay === null ? 'bad' : delay <= 8 ? 'ok' : 'warn' },
        { label: '泄漏量', value: st.leak.toFixed(1), unit: 'm³/h' },
        { label: '报警阈值', value: st.thr.toFixed(1), unit: 'kPa' },
        { label: '误报次数', value: String(falseAlarm), unit: '次 / 90 min', tone: falseAlarm ? 'bad' : 'ok' },
        { label: '流程状态', value: status, wide: true, tone: delay === null ? 'bad' : delay <= 8 ? 'ok' : 'warn' }
      ],
      chart: {
        type: 'line',
        title: '压力残差曲线与报警点',
        hint: '泄漏在 90 min 开始 · 虚线为报警阈值',
        xDomain: [0, TMAX],
        yDomain: [-4, Math.max(12, st.thr + st.leak * LEAK_AT * 0.9 * 0.7)],
        series: [
          { name: '压力残差', color: '#2f3a3f', width: 1.4, points: points }
        ],
        threshold: { value: st.thr, label: '报警阈值 ' + st.thr.toFixed(1) + ' kPa', color: '#b26a39' },
        vline: { x: LEAK_AT, label: '泄漏开始（事后真值）', color: '#5d7fa3' },
        markers: det === null ? [] : [{ x: det, y: st.thr, color: '#a03d4f', label: '报警 ' + det + ' min', r: 4 }],
        fmtX: function (v) { return v.toFixed(0); },
        fmtY: function (v) { return v.toFixed(0); },
        xAxis: '时间 / min',
        yAxis: '残差 / kPa',
        legend: [
          { color: '#2f3a3f', label: '压力残差', line: true },
          { color: '#b26a39', label: '报警阈值（虚线）', line: true },
          { color: '#a03d4f', label: '报警时刻' }
        ]
      },
      table: {
        head: ['口径', '负压波法（传统）', '本次残差检测'],
        rows: [
          ['最小可检漏量', '约 1%—2% 流量', st.leak.toFixed(1) + ' m³/h（示意）'],
          ['检测延迟', '秒级—分钟级', delay === null ? '未检出' : delay + ' min'],
          ['误报', '工况扰动易触发', falseAlarm + ' 次 / 90 min'],
          ['定位', '波速 + 时间同步', '需结合流量平衡']
        ],
        hl: 1
      },
      verdict: {
        label: '检测结论',
        value: delay === null ? '未检出' : delay <= 8 ? '可报警' : '延迟偏大',
        tone: delay === null ? 'bad' : delay <= 8 ? 'ok' : 'warn',
        html: delay === null
          ? '<b>泄漏量太小，残差还没越过噪声。</b>降低阈值可以检出，但误报会同时上升。这类小流量渗漏更适合用“长时间窗流量平衡 + 巡线”，而不是靠单点压力报警。'
          : '<b>报警在泄漏开始后 ' + delay + ' min 触发，期间出现 ' + falseAlarm + ' 次误报。</b>真实系统还要用工况记录剔除调阀、启停泵的扰动，再用两端时间差做定位；单靠残差只能回答“有没有”。'
      }
    };
  }

  var DEF = G.makeCase({
    id: 'pipeline-leak-detection',
    sceneId: 't1',
    code: 'T1',
    title: '管道泄漏智能检测',
    methods: ['ts'],

    highlight: '小流量渗漏不产生明显负压波——真正的难题是“检出”与“误报”的取舍。',
    preview: '压力残差曲线 → 报警阈值 → 检测延迟与误报次数',

    credibility: {
      score: 58,
      level: '中',
      basis: '残差由线性泄漏增长 + 高斯噪声合成，不含真实水力瞬变与工况扰动；检测逻辑为“连续三点越限”，用于演示灵敏度与误报之间的取舍。',
      checks: [
        { k: '数据', v: '合成 180 min 残差序列' },
        { k: '方法', v: '阈值 + 连续三点确认' },
        { k: '验证', v: '检测延迟与误报统计' }
      ]
    },

    conclusion: {
      title: '默认 0.8 m³/h 渗漏在约 7 分钟后可报警',
      html: '<p>默认“泄漏 0.8 m³/h、噪声 0.8 kPa、阈值 5 kPa”时，残差在泄漏开始后约 <b>7 分钟</b>越过阈值并连续三点确认，期间没有出现噪声误报。把泄漏量调到很小，曲线会一直埋在噪声里 —— 这就是小流量渗漏的检出瓶颈。</p><p>该曲线是合成的：真实管道的调阀、启停泵、温度变化与传感器漂移都会产生类似“泄漏”的残差。示范只说明<b>灵敏度与误报是一条滑杆的两端</b>，不代表现场可检漏量。</p>'
    },
    limits: [
      '残差为合成序列，不含真实水力瞬变、工况扰动与传感器漂移；不能据此估计现场最小可检漏量。',
      '检测逻辑是固定阈值 + 连续三点确认，没有使用工况识别、机器学习或水力模型。',
      '定位只给出口径提示，未做波速、时间同步与两端站间计算；真实定位误差通常以百米到公里计。',
      '泄漏样本稀少，任何“检出率”都需要长期运行与人工巡线确认才能统计。'
    ],

    concept: {
      title: '从压力到报警',
      steps: [
        { k: 'SENSE', t: '多站采集', d: '压力 / 流量 / 温度，秒级' },
        { k: 'OPS', t: '工况识别', d: '调阀、启停泵、切罐' },
        { k: 'RESIDUAL', t: '残差检测', d: '实测 − 水力模型预期' },
        { k: 'ALARM', t: '报警与定位', d: '连续确认 + 时间差' },
        { k: 'VERIFY', t: '巡线确认', d: '人工到场，回流样本' }
      ]
    },

    judge: [
      { label: '任务类型', value: '时序异常检测', desc: '泄漏样本少，本质是极不平衡检测' },
      { label: '数据门槛', value: '数十起泄漏事件', desc: '秒级压力 / 流量 + 工况记录' },
      { label: '收益', value: '分钟级报警', desc: '相比人工巡线发现更早', html: '<b style="font-family:var(--mono)">min 级</b>' },
      { label: '难度', value: '中', desc: '样本稀少，误报是核心指标', html: '<span class="dtag" data-d="中">难度 中</span>' },
      { label: '关键权衡', value: '灵敏度 vs 误报', desc: '阈值降低会同时放大两者', html: '<b style="color:var(--clay-d);font-family:var(--mono)">两端</b>' }
    ],

    lede: '长输管道泄漏造成安全与环境风险。负压波、流量平衡与声波是主要检测手段，但小流量渗漏不会产生明显负压波，调阀与启停泵的扰动又很像泄漏 —— 真正难的不是“报警”，而是“少误报”。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>传统方法靠负压波：泄漏瞬间产生压力突降，两端站捕捉到时间差即可定位。但<b>小流量渗漏</b>（比如腐蚀穿孔初期）压力下降很慢，被噪声淹没；而<b>工况调整</b>（调阀、启停泵、切罐）会产生类似的压力波动，导致误报。</p>' +
          '<p>更现实的问题是：误报多了，调度员会关掉报警；灵敏度调高，误报又压不住。这个任务的评价指标必须是<b>检出率 + 延迟 + 误报率</b>的组合，而不是单看灵敏度。</p>' +
          K.figure(G.fieldSVG('pipeline'), 1, '管道沿线示意：泵站、阀门与监测点；右侧小图是压力残差。泄漏点产生的压力变化会向两端传播，但小渗漏的波形很容易被工况扰动掩盖。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>把多站压力、流量、温度做成<b>水力模型残差</b>：用模型算出“当前工况下应有的压力”，再与实际值相减。残差里如果出现持续偏移，就更像泄漏；瞬时尖峰更像噪声或操作。再叠加<b>工况识别</b>（调阀、启停泵）把已知扰动剔除，最后才做报警与定位。</p>' +
          '<p>模型不做“自动切阀”之类的动作，只输出报警与疑似位置，由调度员确认、巡线核实。这样既保留了人的判断，也避免误报直接触发操作。</p>' +
          K.figure(G.flowSVG([
            ['多站采集', '压力 · 流量 · 温度', '#5d7fa3'],
            ['工况识别', '调阀 · 启停泵 · 切罐', '#8a4b2d'],
            ['残差检测', '实测 − 模型预期', '#7e5a8d'],
            ['报警与定位', '连续确认 + 时间差', '#b26a39'],
            ['巡线确认', '人工到场 · 样本回流', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 2 步比模型更重要：不剔除已知工况，误报会把报警系统变成“狼来了”。' }), 2, '五步检测链。第 3 步输出“异常分数”，第 4 步才决定“报不报”——两者分开，才能独立调灵敏度。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['压力 / 流量 / 温度', '秒级，全线多站同步', '无需逐点标注'],
            ['泄漏事件记录', '位置、时间、漏量、处置', '单管线数十起'],
            ['工况操作记录', '调阀、启停泵、切罐', '用于剔除误报'],
            ['水力模型与高程', '沿线高程、管径、介质物性', '计算预期压力'],
            ['巡线记录', '发现时间与现场情况', '作为最终真值']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['管道泄漏检测与负压波定位教材', '多源异常检测与误报抑制方法'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('中') + '<span class="small muted">方法成熟，但泄漏样本稀少，误报率是核心指标。</span></div>' +
          K.meter('中') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>中</b>：传感器数据现成、方法成熟；难点是<b>标签极少</b>，很难用监督学习。可行路径是“机理残差 + 无监督异常 + 工况规则”，并用长期误报统计来验收。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['多源异常检测', '水力模型', '误报抑制'], '#/method/ts') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/production" style="color:var(--jade-d);font-weight:600">采油</a> · <a href="#/stage/refining" style="color:var(--jade-d);font-weight:600">加工</a></p>'
      }
    ],

    workflowTitle: '案例：一条 120 km 原油管道的泄漏检测',
    lead: [
      '某原油管道全长 120 km，沿线 4 座站场，已有秒级压力与流量采集。项目目标不是“换掉负压波”，而是**补上小流量渗漏的检测能力**，并把误报控制在每月 1 次以内。',
      '第 2 步的工况识别与第 5 步的巡线确认决定了项目能不能长期运行：前者压误报，后者提供真值。'
    ],
    stats: [
      ['管长', '120 km'], ['站场', '4 座'], ['采样', '1 s'],
      ['泄漏样本', '数十起'], ['最小可检', '0.5% 流量'], ['误报目标', '<1 次 / 月']
    ],
    steps: [
      {
        name: '多源数据接入', role: '工程环节',
        input: '压力、流量、温度 + 高程 + 介质物性',
        do: '统一时标与单位，处理缺失与漂移；建立站间对应关系。',
        output: '同步的多站时序',
        viz: '多站压力曲线',
        effect: '残差计算有可靠输入',
        trap: '时标不同步，泄漏定位会系统性偏移'
      },
      {
        name: '工况识别与剔除', role: '工程环节',
        input: '阀门、泵、切罐操作记录',
        do: '把调阀、启停泵、切罐标成已知扰动，建立“操作—压力响应”模板。',
        output: '带工况标签的时序',
        viz: '工况时间线',
        effect: '把“像泄漏的扰动”提前排除',
        trap: '不标工况，误报会把报警系统变成“狼来了”'
      },
      {
        name: '残差与异常检测', role: '算法核心',
        input: '实测压力 + 水力模型',
        do: '计算残差，结合多站流量平衡与无监督异常分数，输出泄漏置信度。',
        output: '逐时刻异常分数',
        viz: '残差曲线 + 异常分数',
        effect: '小流量渗漏也能积累出偏移',
        trap: '只用瞬时突降，会漏掉缓慢渗漏'
      },
      {
        name: '报警与定位', role: '效果关键',
        input: '异常分数 + 站间时差',
        do: '连续确认后报警，按负压波时差与流量平衡估计位置，给出置信区间。',
        output: '报警 + 疑似位置',
        viz: '沿线位置与置信区间',
        effect: '调度员知道“去哪看”',
        trap: '定位只给单点、不给区间，巡线会被误导'
      },
      {
        name: '巡线确认与回流', role: '闭环',
        input: '报警 + 现场巡线',
        do: '巡线确认后标注真实泄漏 / 误报，回写样本与工况模板。',
        output: '确认记录 + 修正模型',
        viz: '检出率与误报统计',
        effect: '模型随管道运行状态持续修正',
        trap: '不回写误报，阈值永远调不准'
      }
    ],
    metricsTitle: '怎么算“检测有效”',
    metricsHtml: '<p>泄漏检测不能只看“能不能报”。报警太晚没有意义，误报太多会被关掉。验收要同时看<b>检出率、延迟与误报率</b>，并按泄漏量分档统计。</p>' +
      K.dtable(['指标', '定义', '为什么必须看'], [
        ['检出率', '真实泄漏中被报警的比例', '基础能力'],
        ['检测延迟', '从泄漏开始到报警的时间', '决定应急响应窗口'],
        ['误报率', '单位时间内的误报次数', '决定报警是否被信任'],
        ['定位误差', '估计位置与真实位置的距离', '决定巡线效率']
      ]) +
      '<p style="margin-top:10px">小流量渗漏的检出率通常明显低于大泄漏，必须<b>按漏量分档报告</b>，不能用一个总数掩盖。</p>',
    fails: [
      { name: '小流量渗漏', why: '压力变化被噪声淹没，负压波法基本失效。需要长时间窗流量平衡与残差累积。' },
      { name: '工况扰动', why: '调阀、启停泵会产生类似泄漏的压力波动。必须用操作记录建立模板并剔除。' },
      { name: '传感器漂移', why: '压力变送器零点漂移会形成缓慢残差，看起来像渗漏。需要定期校准与多站交叉校验。' },
      { name: '样本稀少', why: '真实泄漏只有数十起，监督学习难以训练。应优先机理残差 + 无监督方法，并用误报统计验收。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 泄漏检测',
      title: '在压力残差里找渗漏，同时盯住误报',
      desc: '这是合成的 180 分钟压力残差：泄漏在第 90 分钟开始，缓慢累积。调泄漏量、噪声与报警阈值，看检测延迟与误报次数怎样此消彼长。',
      chartTitle: '压力残差曲线与报警点',
      chartHint: '泄漏在 90 min 开始 · 虚线为阈值',
      controls: [
        { key: 'leak', label: '泄漏量', min: 0.1, max: 5, step: 0.1, value: 0.8, display: function (v) { return v.toFixed(1) + ' m³/h'; } },
        { key: 'noise', label: '噪声水平', min: 0.3, max: 2, step: 0.05, value: 0.8, display: function (v) { return v.toFixed(1) + ' kPa'; } },
        { key: 'thr', label: '报警阈值', min: 2, max: 12, step: 0.5, value: 5, display: function (v) { return v.toFixed(1) + ' kPa'; } }
      ],
      tags: [
        { text: 'TS · 异常检测', tone: 'jade' },
        { text: '残差', tone: '' },
        { text: '误报抑制', tone: 'clay' }
      ],
      compute: compute,
      foot: '残差为程序合成，不含真实水力瞬变与工况扰动；现场可检漏量、定位误差需长期运行与巡线确认统计。'
    }
  });
})();
