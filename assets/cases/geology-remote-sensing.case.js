/* =========================================================
   跨环节案例 · g1 地质剖面遥感解译
   ---------------------------------------------------------
   场景：地质勘察（01）
   方法：计算机视觉 · 语义分割 + 矢量化
   示范：合成地物栅格 + 概率阈值 + 人工复核比例
   数据为程序合成，仅用于展示方法链路与指标口径。
   ========================================================= */

(function () {
  'use strict';

  var G = window.IQGen;
  var esc = G.esc;

  /* ---------------- 合成地物 ---------------- */
  var W = 24, H = 14, CELL_M = 60;

  function truthClass(r, c) {
    var v = r / H + 0.18 * Math.sin(c / W * Math.PI * 1.2);
    return v < 0.36 ? 0 : v < 0.62 ? 1 : 2;
  }
  function boundary(thr) {
    var pts = [];
    for (var c = 0; c <= W; c++) {
      var r = (thr - 0.18 * Math.sin(c / W * Math.PI * 1.2)) * H;
      pts.push([c, Math.max(0, Math.min(H, r))]);
    }
    return pts;
  }

  function probsFor(r, c, sep, cloud, rnd) {
    var truth = truthClass(r, c);
    var v = r / H + 0.18 * Math.sin(c / W * Math.PI * 1.2);
    var near = Math.min(Math.abs(v - 0.36), Math.abs(v - 0.62)) < 0.055;
    var sc = [rnd() * 0.9, rnd() * 0.9, rnd() * 0.9];
    sc[truth] += 1.2 + sep * 2.2;
    /* 界线附近的混分：真实解译里误差主要集中在这里，而不是图幅内部 */
    if (near && rnd() < 0.45) {
      sc[truth] -= 2;
      sc[(truth + 1) % 3] += 1.8;
    }
    if (rnd() < cloud * 0.55) sc[truth] -= 1.7;
    var e = [Math.exp(sc[0]), Math.exp(sc[1]), Math.exp(sc[2])];
    var sum = e[0] + e[1] + e[2];
    return [e[0] / sum, e[1] / sum, e[2] / sum];
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
    var cells = [], total = W * H, accepted = 0, correct = 0, wrong = 0;
    for (var r = 0; r < H; r++) {
      var row = [];
      for (var c = 0; c < W; c++) {
        var p = probsFor(r, c, st.sep, st.cloud, rnd);
        var best = 0;
        if (p[1] > p[best]) best = 1;
        if (p[2] > p[best]) best = 2;
        var ok = p[best] >= st.thr;
        if (ok) {
          accepted++;
          if (best === truthClass(r, c)) correct++; else wrong++;
        }
        row.push({ cls: best, accept: ok, p: p[best] });
      }
      cells.push(row);
    }
    var acc = accepted ? correct / accepted : 0;
    var review = 1 - accepted / total;
    var status = (acc >= 0.88 && review <= 0.25) ? '可交付草稿图层'
      : (review <= 0.55 ? '可用，但需人工复核' : '不可交付，先改影像或阈值');

    return {
      kpis: [
        { label: '分类准确率（已接受格）', value: (acc * 100).toFixed(1), unit: '%', tone: acc >= 0.88 ? 'ok' : acc >= 0.78 ? 'warn' : 'bad', wide: false },
        { label: '待人工复核', value: (review * 100).toFixed(0), unit: '%', tone: review <= 0.25 ? 'ok' : 'warn' },
        { label: '错分格数', value: String(wrong), unit: '格 / ' + total, tone: wrong > 20 ? 'bad' : '' },
        { label: '图层状态', value: status, wide: true, tone: review <= 0.25 && acc >= 0.88 ? 'ok' : 'warn' }
      ],
      chart: {
        type: 'grid',
        title: '岩性分类与待复核格',
        hint: '每格 ' + CELL_M + ' m · 虚线为真实界线',
        cells: cells,
        palette: ['#cfae7c', '#7b93a8', '#a5ad8d'],
        legend: [
          { color: '#cfae7c', label: '砂岩' },
          { color: '#7b93a8', label: '泥岩' },
          { color: '#a5ad8d', label: '灰岩' },
          { color: '#f0ede4', label: '待复核' }
        ],
        boundaries: [boundary(0.36), boundary(0.62)],
        truthNote: '试验块约 1.4 km × 0.8 km · 合成地物'
      },
      table: {
        head: ['口径', '人工目视（文献量级）', '本次（合成）'],
        rows: [
          ['界线偏差', '80—120 m（不同解释员）', '约 ' + Math.round(CELL_M * 0.9) + ' m（±1 格）'],
          ['单块工期', '按图幅计 10 天量级', '秒级推理 + ' + (review * 100).toFixed(0) + '% 复核'],
          ['可重复性', '低，因人而异', '同参数同结果'],
          ['需要人工编辑的图斑', '100%', (review * 100).toFixed(0) + '%']
        ],
        hl: 0
      },
      verdict: {
        label: '阈值决策',
        value: '阈值 ' + st.thr.toFixed(2),
        tone: review <= 0.25 ? 'ok' : 'warn',
        html: '<b>准确率与复核量是同一根滑杆的两端。</b>阈值调高，错分减少、但待复核格变多；调低，图层更“满”，错误也一起交付。阈值必须由解释员按图幅精度要求来定，不是模型参数。'
      }
    };
  }

  /* ---------------- 注册 ---------------- */
  var DEF = G.makeCase({
    id: 'geology-remote-sensing',
    sceneId: 'g1',
    code: 'G1',
    title: '地质剖面遥感解译',
    methods: ['cv'],

    highlight: '模型给概率图，解释员定阈值——把“勾绘”变成“筛选与复核”。',
    preview: '合成地物栅格 → 三类岩性概率 → 阈值控制待复核比例与错分格数',

    credibility: {
      score: 64,
      level: '中',
      basis: '地物与概率场为程序合成，隐藏真值可精确比对；方法链路（多通道分割 → 概率阈值 → 矢量化 → 人工复核）与真实流程一致，但精度不能外推到真实影像。',
      checks: [
        { k: '数据', v: '合成 24 × 14 栅格（60 m/格）' },
        { k: '方法', v: '三类概率 + 阈值 + 分类栅格' },
        { k: '验证', v: '与隐藏真值逐格比对' }
      ]
    },

    conclusion: {
      title: '默认阈值下可交付草稿图层，但误差集中在界线附近',
      html: '<p>默认“影像可分度 0.70、概率阈值 0.62”时，已接受格子的分类准确率约 <b>92%</b>，约 10% 的格子被推到人工复核，23 个错分格（约 7%）多集中在两条岩性界线附近 —— 这与真实解译的误差分布一致：<b>面积判对不难，界线判准才难</b>。</p><p>图标里的“10 天 → 1 天”是任务量级对比，不是本合成的实测值。真实项目还要叠加辐射校正、跨景拼接与野外验证的时间，且历史地质图本身就有几十米到上百米的偏差，不能直接当作精确真值。</p>'
    },
    limits: [
      '演示为合成地物与合成概率场，不含云影、植被、地形阴影与跨景色差；真实影像必须先做辐射、大气与地形校正。',
      '合成真值按解析界线生成，比历史地质图“干净”；真实训练标签含 80—120 m 的解释偏差，指标会明显下降。',
      '阈值只控制“接受 / 复核”，不保证界线位置正确；交付前仍需拓扑检查与野外验证点。',
      '跨气候区、跨岩性组合的迁移能力没有在示范中体现，不能据此判断模型可移植性。'
    ],

    concept: {
      title: '从影像到矢量图层',
      steps: [
        { k: 'INPUT', t: '多源影像', d: '多光谱 / 高光谱 / SAR + DEM' },
        { k: 'PREP', t: '预处理', d: '辐射、大气、地形校正与配准' },
        { k: 'SEG', t: '语义分割', d: '逐像素类别概率' },
        { k: 'VEC', t: '阈值与矢量化', d: '最小图斑、去毛刺、拓扑' },
        { k: 'REVIEW', t: '人工复核', d: '界线编辑与野外查证' }
      ]
    },

    judge: [
      { label: '任务类型', value: '语义分割 + 矢量化', desc: '输出概率图，再转成可入库的线/面' },
      { label: '数据门槛', value: '20 幅精修掩膜', desc: '加历史地质图作弱标签' },
      { label: '收益', value: '10 天 → 1 天', desc: '按图幅量级，含人工复核', html: '<b style="font-family:var(--mono)">10d → 1d</b>' },
      { label: '难度', value: '中', desc: '影像易得，地质标签稀缺且不精确', html: '<span class="dtag" data-d="中">难度 中</span>' },
      { label: '关键风险', value: '界线偏移', desc: '面积指标好看，界线未必对', html: '<b style="color:var(--clay-d);font-family:var(--mono)">±1 格</b>' }
    ],

    lede: '遥感影像是区域地质调查的第一手资料。多光谱、高光谱与 SAR 记录了地表岩性、构造与蚀变的差异，解释员据此勾绘岩性界线、断层与褶皱。问题是：一幅 1:5 万图幅的目视解译要一到两周，而且同一影像由不同人勾绘，界线能相差上百米。',

    sections: [
      {
        no: 1, en: 'PROBLEM', title: '当前做法与问题',
        html: '<p>常规流程是“影像 → 目视判读 → 手工勾绘 → 矢量化 → 野外抽查”。一幅 1:5 万图幅，解释员要逐块对照影像色调、纹理、地貌与已知地质图，勾出岩性界线和断层。工作量以周计，且<b>判据停留在人的经验里</b>：同一处界线，两个人可能差 80—120 m；植被与风化层覆盖区信噪比低，薄层与小型构造容易漏判。</p>' +
          '<p>更关键的是，地质图关心的不是“面积占比”，而是<b>界线的位置</b>。这让评价方式与常规图像分割不同：像素准确率再高，界线偏 100 m 也等于没用。</p>' +
          K.figure(G.fieldSVG('geology'), 1, '遥感影像与解译矢量。左侧是影像底图（含断层与解释界线），右侧是最终入库的矢量图元。真正耗时的不是“看见”，而是把看见的东西变成位置准确的线。')
      },
      {
        no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
        html: '<p>把解译建模成<b>多通道语义分割</b>：输入多光谱 / 高光谱波段，叠加 DEM 的高程、坡度、坡向，输出逐像素的岩性类别概率；再用历史地质图作弱标签补足样本。分割之后还有两步不能省：<b>概率阈值</b>与<b>矢量化后处理</b>（最小图斑、去毛刺、拓扑检查）。</p>' +
          '<p>这里替换的是“勾绘”这一道工序，不是解释员。模型把整幅影像压成一张概率图，解释员决定阈值、编辑界线、做野外验证 —— 责任边界仍然在人这边。</p>' +
          K.figure(G.flowSVG([
            ['多源影像', '多光谱 / 高光谱 / SAR', '#5d7fa3'],
            ['预处理', '辐射 · 大气 · 地形校正', '#8a4b2d'],
            ['语义分割', 'U-Net / DeepLab · 多通道', '#7e5a8d'],
            ['矢量化', '阈值 · 最小图斑 · 拓扑', '#b26a39'],
            ['人工复核', '界线编辑 · 野外验证', '#6f7430']
          ], { tag: 'PIPELINE', note: '第 4 步的阈值是业务参数：它决定多少图斑交给人工，而不是模型好坏。' }), 2, '从影像到矢量图层的五步。第 3 步决定“能不能分”，第 4 步决定“交付多少、复核多少”，第 5 步决定“对不对”。')
      },
      {
        no: 3, en: 'DATA', title: '你需要准备什么',
        html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p>' +
          K.checklist([
            ['多光谱 / 高光谱影像', '覆盖整个图幅，含短波红外更利于岩性区分', '按景预处理与拼接'],
            ['历史地质图', '同区域、已矢量化，可投影转换', '作弱标签，不能当真值'],
            ['DEM 高程与坡度', '与影像同分辨率或更细', '无需标注'],
            ['精修岩性掩膜', '至少 20 个图幅 / 试验块', '训练与验证'],
            ['野外验证点', '界线、断层与存疑图斑', '最终精度依据']
          ]) +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可参考的公开资料</span></p>' +
          K.refs(['Sentinel-2 / Landsat 8 公开影像', '公开地质图与区域地质调查报告'], null)
      },
      {
        no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
        html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
          K.dtag('中') + '<span class="small muted">影像充足、任务清晰；难点是标签不精确、界线评价与跨区迁移。</span></div>' +
          K.meter('中') +
          '<p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p>' +
          '<p>这个场景落在<b>中</b>：影像与 DEM 都能拿到，分割模型也成熟；真正的门槛是“标签从哪来”和“界线怎么评”。历史地质图能解决样本量，但会把旧图的偏差一起学进去，必须留出独立验证区。</p>' +
          '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
          K.refs(['语义分割', '弱监督学习', '多光谱特征融合'], '#/method/cv') +
          '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/seismic" style="color:var(--jade-d);font-weight:600">物探</a> · <a href="#/stage/welllog" style="color:var(--jade-d);font-weight:600">测井</a></p>'
      }
    ],

    workflowTitle: '案例：一幅 1:5 万图幅的岩性—构造解译',
    lead: [
      '某区域地质调查项目要在一幅 1:5 万图幅上更新岩性与构造图层。影像齐全，历史地质图也已矢量化，但没有现成的逐像素标签。目标不是“全自动出图”，而是**把 10 天量级的目视解译压到 1 天（含复核）**，并把界线偏差控制在 1 个栅格以内。',
      '下面五步里，第 2 步和第 4 步不涉及任何模型，却决定了成果能不能入库：标签从哪来、阈值谁来定。'
    ],
    stats: [
      ['试验块', '24×14 格'], ['单格地面', '60 m'], ['精修掩膜', '20 幅'],
      ['岩性类别', '3'], ['目视工期', '10 天'], ['目标工期', '1 天']
    ],
    steps: [
      {
        name: '影像与底图准备', role: '工程环节',
        input: '多光谱 4 景 + DEM + 历史地质图',
        do: '做辐射、大气与地形校正，重采样到统一 15 m 网格，按图幅裁切；把历史地质图投影转换为类别栅格。',
        output: '空间对齐的多通道栅格与弱标签',
        viz: '预处理前后对比 + 波段组合',
        effect: '同一地物在不同景里有一致的响应',
        trap: '不同景的成像时间与太阳高度差会变成“假界线”'
      },
      {
        name: '标签规范化', role: '工程环节',
        input: '历史矢量图 + 20 幅精修掩膜',
        do: '统一岩性分类体系，按图幅划分训练 / 验证；精修掩膜只放在验证区做独立检验。',
        output: '训练集 + 独立验证集',
        viz: '标签覆盖率与类别分布',
        effect: '可以判断“模型学到的是影像还是旧图的偏差”',
        trap: '历史图本身有 80—120 m 偏差，直接当真值会把误差学进去'
      },
      {
        name: '语义分割', role: '算法核心',
        input: '多通道影像块 + 弱标签',
        do: 'U-Net / DeepLab 逐像素分类，类别加权 + 边界损失，输出三类概率图。',
        output: '逐像素类别概率',
        viz: '概率图 + 混淆矩阵',
        effect: '把整幅影像压成一张可筛选的概率图',
        trap: '按像素随机划分会让同一地物同时进训练与验证，指标虚高'
      },
      {
        name: '阈值与矢量化', role: '效果关键',
        input: '类别概率图',
        do: '按精度要求定阈值，做最小图斑、去毛刺、拓扑检查，转成矢量线 / 面。',
        output: '可入库的矢量图层',
        viz: '不同阈值下的图斑数与碎片率',
        effect: '把概率图变成符合制图规范的成果',
        trap: '阈值过低会产生大量碎片图斑，后处理成本反而更高'
      },
      {
        name: '人工复核与野外验证', role: '闭环',
        input: '矢量图层 + 验证点',
        do: '解释员编辑界线，野外查证存疑图斑，修正结果回流为样本。',
        output: '交付图幅 + 误差报告',
        viz: '界线偏差分布',
        effect: '每一幅图都在修正下一幅的模型',
        trap: '没有验证点，指标只是“和旧图一致”，不是“和地面一致”'
      }
    ],
    metricsTitle: '怎么算“解译对了”',
    metricsHtml: '<p>遥感解译最容易踩的坑是只看像素准确率。泥岩占 60% 的图幅里，把所有像素判成泥岩也能拿到 60% 的准确率，但界线一条都没画对。这个任务要同时看<b>面积、界线与复核量</b>三类指标。</p>' +
      K.dtable(['指标', '定义', '为什么不能只看它'], [
        ['像素准确率', '正确像素 / 总像素', '类别不均衡时会虚高'],
        ['mIoU', '各类交并比的平均值', '对小类敏感，但仍不反映界线位置'],
        ['边界 F1（±1 格）', '界线落在容差内的比例', '地质图真正关心的指标'],
        ['待复核图斑率', '需人工编辑的图斑占比', '直接决定工期与交付成本']
      ]) +
      '<p style="margin-top:10px">本示范用“已接受格子的准确率 + 待复核比例 + 错分格数”来对应这三类指标；合成真值已知，所以能逐格比对。</p>',
    fails: [
      { name: '云影与植被遮蔽', why: '目标岩性被覆盖时，模型只能靠邻域外推，容易给出过于平滑的界线。应把云/植被作为独立类别或掩膜，不要强行分类。' },
      { name: '跨气候区迁移', why: '同一岩性在不同气候区的光谱响应差异很大，直接迁移会系统性偏色。必须留出跨区验证，必要时做光谱归一化。' },
      { name: '类别不均衡', why: '小类（如薄层灰岩）样本少，模型倾向忽略。需要类别加权、重采样或专门的小类检测头。' },
      { name: '历史图配准误差', why: '弱标签与影像配准差几个像素，就会在界线处产生系统性错位，模型学到的是“旧图的偏移”。' }
    ],

    demo: {
      kicker: 'INTERACTIVE · 语义分割阈值',
      title: '在遥感影像上圈出岩性单元，并决定哪些格子交给人工',
      desc: '这是一幅程序合成的地物栅格：真实类别已知，所以能精确统计。拖动“影像可分度”“云影覆盖”和“概率阈值”，看分类图、待复核比例与错分格数怎么变。',
      chartTitle: '岩性分类与待复核格',
      chartHint: '每格 60 m · 虚线为真实界线',
      controls: [
        { key: 'sep', label: '影像可分度', min: 0.35, max: 1, step: 0.01, value: 0.7, display: function (v) { return v.toFixed(2); } },
        { key: 'cloud', label: '云影 / 植被覆盖', min: 0, max: 0.5, step: 0.01, value: 0.15, display: function (v) { return (v * 100).toFixed(0) + '%'; } },
        { key: 'thr', label: '概率阈值', min: 0.4, max: 0.9, step: 0.01, value: 0.62, display: function (v) { return v.toFixed(2); } }
      ],
      tags: [
        { text: 'CV · 语义分割', tone: 'jade' },
        { text: '概率阈值', tone: '' },
        { text: '人工复核', tone: 'clay' }
      ],
      compute: compute,
      foot: '图为程序合成的地物与概率场；真实影像需辐射校正、跨区验证与野外查证，指标不能直接外推。'
    }
  });
})();
