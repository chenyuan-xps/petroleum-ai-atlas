/* =========================================================
   自动生成：completion-string-stress-analysis/case.json → 站点插件注册器
   不要手改本文件；改 case.json 或 demo/*，再跑 node tools/build-cases.js
   ========================================================= */
(function () {
  'use strict';
  var def = {
  "id": "completion-string-stress-analysis",
  "sceneId": "co3",
  "methods": [
    "opt"
  ],
  "code": "CO3",
  "title": "完井管柱受力智能分析",
  "status": "ready",
  "version": "2.0.0",
  "updated": "2026-11-02",
  "highlight": "“下得去”不是井口的一个数字，是沿井深每 20 m 的一条曲线。",
  "preview": "输入 5 项管柱与井眼参数 → 输出钩载曲线、安全系数与安全下入速度",
  "credibility": {
    "score": 76,
    "level": "中高",
    "basis": "分段受力积分可解释，屈曲判据用 Dawson-Paslay 解析式；摩阻系数与井眼清洁程度按经验给定，未用指重表反演。",
    "checks": [
      {
        "k": "数据",
        "v": "合成井眼轨迹 4200 m"
      },
      {
        "k": "方法",
        "v": "分段积分 + 屈曲判据 + 速度扫描"
      },
      {
        "k": "验证",
        "v": "37 档速度扫描，残差 −1 kN"
      }
    ]
  },
  "conclusion": {
    "title": "当前速度安全，但把速度提到 1.55 m/s 会把安全系数压到阈值附近",
    "html": "<p>当前 0.80 m/s 下末端钩载 <b>839 kN</b>、最小安全系数 <b>2.79</b>，全程无高风险井段。在 37 档速度中，最快可行档是 <b>1.55 m/s</b>：预计用时从 1.9 h 降到 0.8 h，安全系数降到 2.01，仍略高于阈值 2.0。</p><p>2640 m 处钩载相对滑动平均下掉 1 kN，被标为疑似遇阻点。这个信号很小，必须结合指重表、扭矩与返出情况现场确认 —— 1 kN 也可能只是接单根造成的正常波动。</p><p>还有一道闸没画在这张图上：<b>屈曲</b>。按 Dawson-Paslay 式，垂直段的临界屈曲载荷趋近于零，任何受压段都可能屈曲并让摩阻上升，所以“钩载为正”不等于“管柱没受压”。</p>"
  },
  "limits": [
    "摩阻系数、井眼清洁程度按经验给定，未用实测指重表与扭矩数据反演；同一口井不同井段的摩阻可以差一倍。",
    "模型按准静态下入计算，未含动载、井口波动、套管变形与井壁坍塌。",
    "屈曲判据只判断是否达到临界载荷，未计算后屈曲形态与附加摩阻，需在方案里留余量。",
    "遇阻点由钩载残差识别，1 kN 量级的信号需结合扭矩、返出与成像测井进一步确认。"
  ],
  "concept": {
    "title": "决策链",
    "steps": [
      {
        "k": "INPUT",
        "t": "测斜与管柱",
        "d": "井深、井斜、线重、摩阻"
      },
      {
        "k": "MODEL",
        "t": "分段受力积分",
        "d": "浮重 + 摩阻 + 狗腿附加"
      },
      {
        "k": "CHECK",
        "t": "钩载与安全系数",
        "d": "逐点校核阈值 2.0"
      },
      {
        "k": "DETECT",
        "t": "屈曲与遇阻",
        "d": "临界载荷 + 残差识别"
      },
      {
        "k": "OUTPUT",
        "t": "速度决策",
        "d": "安全窗口内最快下入速度"
      }
    ]
  },
  "tabs": {
    "background": {
      "label": "专业背景",
      "judge": [
        {
          "label": "方法组合",
          "value": "CV · OPT · TS",
          "desc": "摩阻取值、受力积分、遇阻识别"
        },
        {
          "label": "输入",
          "value": "5 项参数",
          "desc": "速度、摩阻、井斜、线重、井深"
        },
        {
          "label": "输出",
          "value": "风险井段",
          "desc": "安全系数、疑似遇阻点、推荐速度"
        },
        {
          "label": "难度",
          "value": "中",
          "desc": "机理模型可批量生成样本",
          "html": "<span class=\"dtag\" data-d=\"中\">难度 中</span>"
        },
        {
          "label": "关键窗口",
          "value": "速度 × 摩阻",
          "desc": "速度提高缩短工时，安全系数同步下降",
          "html": "<b style=\"color:var(--clay-d);font-family:var(--mono)\">0.2—2.0 m/s</b>"
        }
      ],
      "lede": "完井管柱在起下过程中承受自重、浮重、摩阻与弯曲，钩载过低会自锁或屈曲，弯曲应力过高会导致接头疲劳甚至断脱。传统做法是按“最深、最斜、摩阻最大”的保守工况算一遍，再留一个安全系数；现场起下时靠指重表判断遇阻。问题是指重表只给一个数，看不出风险在哪个井段、由什么引起。",
      "sections": [
        {
          "no": 1,
          "en": "PROBLEM",
          "title": "当前做法与问题",
          "html": "<p>管柱设计通常按最不利工况算一遍：最大井斜、最大摩阻、最深下入，然后乘一个安全系数。现场起下时依靠指重表判断遇阻，靠经验决定是否继续下放。</p><p>问题有三个：<b>工况组合爆炸</b> —— 井斜、摩阻、速度、管柱组合一变，钩载与应力曲线就变，逐组算不现实；<b>保守设计浪费</b> —— 为了覆盖不确定性选更高钢级，成本上升；<b>风险不可见</b> —— 指重表只给井口一个数字，而风险往往出现在中深部某个狗腿段。</p><p>更麻烦的是<b>屈曲</b>。按 Dawson-Paslay 的解析式，临界正弦屈曲载荷 F<sub>sin</sub>=2√(EI·q·sinα/r) —— 井斜角 α 趋近 0 时它趋近于零。这意味着垂直段只要受压就可能屈曲，屈曲后管壁贴紧井壁、摩阻骤增，管柱会“下不去也提不动”。</p><figure style='margin:10px 0 0'><svg viewBox='0 0 640 210' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='管柱受力示意'><rect width='640' height='210' fill='#fff'/><path d='M40 30 C40 90 300 110 300 180' fill='none' stroke='#d8d2c4' stroke-width='22'/><path d='M40 30 C40 90 300 110 300 180' fill='none' stroke='#8d979d' stroke-width='3'/><path d='M354 30 C354 90 560 110 560 180' fill='none' stroke='#d8d2c4' stroke-width='22'/><path d='M354 30 C354 90 560 110 560 180' fill='none' stroke='#8d979d' stroke-width='3'/><g stroke='#2f7d6b' stroke-width='3' fill='none'><line x1='40' y1='30' x2='300' y2='180'/><line x1='354' y1='30' x2='560' y2='180'/></g><g font-size='10' fill='#4d565b' font-family='sans-serif'><text x='20' y='22'>井口</text><text x='296' y='200'>直井段</text><text x='500' y='200'>大斜度段</text><text x='414' y='64' fill='#b26a39'>摩阻</text><text x='120' y='118' fill='#2f7d6b'>自重</text><text x='470' y='128' fill='#41699b'>弯曲</text></g><g stroke='#b26a39' stroke-width='2' marker-end='url(#co3-a)'><line x1='414' y1='74' x2='380' y2='100'/></g><g stroke='#41699b' stroke-width='2' marker-end='url(#co3-a)'><line x1='470' y1='138' x2='440' y2='158'/></g><defs><marker id='co3-a' markerWidth='5' markerHeight='5' refX='4' refY='2.5' orient='auto'><path d='M0 0 L5 2.5 L0 5 z' fill='#8d979d'/></marker></defs><text x='320' y='18' text-anchor='middle' font-size='10' fill='#9ba3a9'>图 1 · 管柱受力来自自重、井壁摩阻与井眼曲率；三者叠加决定钩载与弯曲应力。</text></svg></figure>"
        },
        {
          "no": 2,
          "en": "INTERVENTION",
          "title": "AI 能做什么：摩阻、受力、遇阻、复核",
          "html": "<p>管柱受力模型的公式是公开的，误差几乎全来自<b>输入</b>：摩阻系数取多少、井眼是不是缩径、钩载曲线的哪一段不正常。所以方法落在三处输入和一处判断上。</p><table class=\"dtable\"><thead><tr><th>工序</th><th>方法</th><th>在这一步做什么</th></tr></thead><tbody><tr><td>定摩阻</td><td>CV · 图像识别</td><td>井眼成像或超声成像识别缩径、椭圆化与狗腿集中段，把“全井一个摩阻系数”改成分段值</td></tr><tr><td>算受力</td><td>OPT · 机理代理</td><td>沿井深逐段积分浮重、摩阻与弯曲应力，输出钩载与安全系数曲线</td></tr><tr><td>认遇阻</td><td>TS · 时序异常检测</td><td>指重表与扭矩的滑动残差检测，定位钩载突降点；1 kN 的残差也会被标出来，再由人判是真遇阻还是接单根</td></tr><tr><td>定速度</td><td>OPT · 约束扫描</td><td>在安全系数 ≥2.0、钩载 ≥120 kN、不进入屈曲区的约束下，扫描最快可行速度</td></tr></tbody></table><p>这里最容易被忽略的是<b>屈曲</b>：按 Dawson-Paslay 式，垂直段临界屈曲载荷趋近于零，只要受压就可能屈曲，所以“钩载为正”不等于管柱没受压 —— 这条判据必须写进约束，而不是留给经验。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 122' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='122' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">受力积分 + 异常检测 · 从测斜到风险井段</text><rect x='14' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='23' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">01</text><text x='23' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>测斜序列</text><text x='23' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>井深等间距</text><path d='M128 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='139' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='148' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">02</text><text x='148' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>分段积分</text><text x='148' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>自重 + 摩阻</text><path d='M253 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='264' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='273' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">03</text><text x='273' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>钩载 / 应力</text><text x='273' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>安全系数</text><path d='M378 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='389' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='398' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">04</text><text x='398' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>残差检测</text><text x='398' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>阈值分段</text><path d='M503 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='514' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='523' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">05</text><text x='523' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>风险井段</text><text x='523' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>位置 + 区间</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 2 · 管柱在井下受的力看不见，只能沿井深逐段积分算出来；算出的安全系数曲线再交给异常检测，才能定位到具体井段。</figcaption></figure>"
        },
        {
          "no": 3,
          "en": "DATA",
          "title": "需要准备什么",
          "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">管柱结构</span><span class=\"cl-s\">钢级、外径、壁厚、线重、下深、接头</span></span><span class=\"cl-n\">决定抗拉与抗弯能力</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井眼轨迹</span><span class=\"cl-s\">测斜数据（井斜、方位、狗腿度），≤30 m 一点</span></span><span class=\"cl-n\">狗腿度是弯曲应力来源</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">工况参数</span><span class=\"cl-s\">下入速度、钻井液密度、摩阻系数</span></span><span class=\"cl-n\">摩阻可由邻井指重表反演</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">现场反馈</span><span class=\"cl-s\">指重表记录、遇阻 / 卡钻井深、作业报告</span></span><span class=\"cl-n\">校验模型与风险段</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井眼条件</span><span class=\"cl-s\">扩径率、砂桥、台阶、套管磨损</span></span><span class=\"cl-n\">解释异常摩阻</span></div></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可参考的公开方法</span></p><div class=\"refs\"><span class=\"ref\">Dawson & Paslay 屈曲临界载荷解析式</span><span class=\"ref\">超长裸眼井完井管柱摩阻动态反演（石油钻采工艺）</span><span class=\"ref\">API 管材力学性能表（钢级 / 屈服强度）</span></div><p style=\"margin-top:14px\" class=\"small muted\">口径提醒：摩阻系数按<b>下放为正、上提为负</b>分别取值；速度统一到 m/s；钩载统一为<br>kN（井下为浮重，井口为悬重）。这三处一乱，曲线就对不上指重表。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 186' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='186' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">管柱受力表结构 · 一行一个井深点</text><rect x='14' y='28' width='612' height='22' fill='#f1ede2' stroke='#e6e0d2'/><text x='71' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">井深 (m)</text><text x='185' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">井斜 (°)</text><text x='318' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">线重 (N/m)</text><text x='452' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">钢级</text><text x='567' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">摩阻系数</text><rect x='14' y='50' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='71' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">1200</text><text x='185' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">8.4</text><text x='318' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">286</text><text x='452' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">N80</text><text x='567' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">0.24</text><rect x='14' y='74' width='612' height='24' fill='#fbfaf6' stroke='#f0ece1' stroke-width='.7'/><text x='71' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">1240</text><text x='185' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">11.2</text><text x='318' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">286</text><text x='452' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">N80</text><text x='567' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">0.24</text><rect x='14' y='98' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='71' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">1280</text><text x='185' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">17.6</text><text x='318' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">286</text><text x='452' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">N80</text><text x='567' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">0.31</text><line x1='128' y1='28' x2='128' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='242' y1='28' x2='242' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='395' y1='28' x2='395' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='509' y1='28' x2='509' y2='122' stroke='#f0ece1' stroke-width='.7'/><rect x='14' y='137' width='7' height='7' rx='1.5' fill='#1e6f5c'/><text x='26' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">样本量</text><text x='26' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>每 40 m 一点，全井约 90 点</text><rect x='218' y='137' width='7' height='7' rx='1.5' fill='#a9852f'/><text x='230' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">标注成本</text><text x='230' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>只需指重表读数做校验</text><rect x='422' y='137' width='7' height='7' rx='1.5' fill='#a85249'/><text x='434' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">口径风险</text><text x='434' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>摩阻系数分段取值</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 3 · 井斜角与摩阻系数是钩载曲线的两个主要输入：井斜变大、摩阻上调，同一段管柱的悬重就会被吃掉更多。</figcaption></figure>"
        },
        {
          "no": 4,
          "en": "DIFFICULTY",
          "title": "技术难度与参考方向",
          "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">力学模型清楚；难点是摩阻系数不确定与屈曲判别。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i></i></div><p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p><p>这个案例落在<b>中</b>：方程是解析的，可解释性好；真正的不确定性在摩阻系数 —— 同一口井不同井段能差一倍，模型给出的安全系数本质上是一个区间。建议把输出做成“安全窗口 + 风险井段 + 异常点”，而不是只报一个最小安全系数。</p><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">机理代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">时序异常检测<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">敏感性分析<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">可靠性评估<span class=\"ar\">↗</span></a></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">本案例用到的现实依据</span></p><div class=\"refs\"><span class=\"ref\">Dawson-Paslay：垂直段临界屈曲载荷趋零</span><span class=\"ref\">摩阻动态反演：分井段反演优于全井一个系数</span><span class=\"ref\">漂浮下入：降低有效线重以通过超长裸眼段</span></div><p style=\"margin-top:18px\" class=\"small muted\">交叉环节：<a href=\"#/stage/completion\" style=\"color:var(--jade-d);font-weight:600\">完井</a> · <a href=\"#/stage/drilling\" style=\"color:var(--jade-d);font-weight:600\">钻井</a></p>"
        }
      ]
    },
    "workflow": {
      "label": "案例流程",
      "title": "案例：D 井 4200 m 完井管柱下入预演",
      "lead": [
        "D 井是一口 4200 m 定向井，最大井斜 62°，完井管柱 5-1/2″、壁厚 9.17 mm，邻井实测摩阻系数 0.20—0.30。目标是把“能不能下得去、下多快安全”变成一条可看的钩载曲线与风险井段，而不是井口的一个数字。",
        "流程适用于完井管柱、生产管柱的起下作业预演；摩阻系数用邻井指重表反演，再随本井实测滚动修正。"
      ],
      "stats": [
        [
          "井深",
          "4200 m",
          true
        ],
        [
          "计算步长",
          "20 m",
          true
        ],
        [
          "安全系数阈值",
          "2.0"
        ],
        [
          "末端钩载",
          "839 kN"
        ],
        [
          "速度扫描",
          "37 档"
        ],
        [
          "推荐速度",
          "1.55 m/s"
        ]
      ],
      "steps": [
        {
          "name": "测斜与管柱数据整理",
          "role": "数据 · CV",
          "do": "把测斜数据插值到 20 m 等间距，整理管柱线重、外径、钢级与下深；统一单位为 m、kN、MPa。",
          "effect": "得到沿井深连续的井斜序列与管柱属性序列",
          "trap": "测斜点稀疏且不插值，狗腿度被严重低估，弯曲应力与风险段一起消失。",
          "input": "测斜数据、管柱规格",
          "output": "等间距井斜序列 + 管柱属性",
          "viz": "井眼轨迹侧视：井斜角随井深"
        },
        {
          "name": "受力积分与应力计算",
          "role": "建模 · OPT",
          "do": "沿井深逐段积分浮重与摩阻得到钩载曲线；按狗腿度算弯曲应力，与轴向应力叠加求安全系数。",
          "effect": "整条钩载曲线与安全系数曲线一次算出",
          "trap": "摩阻方向取反，起下两种工况的钩载会完全对不上指重表。",
          "input": "井斜序列 + 管柱属性 + 摩阻系数",
          "output": "钩载、弯曲应力、安全系数（沿井深）",
          "viz": "钩载 / 安全系数双轴剖面"
        },
        {
          "name": "屈曲与风险分段",
          "role": "识别 · TS",
          "do": "按 Dawson-Paslay 式算各井段的临界屈曲载荷，与轴向压力比较；安全系数低于 2.0 的连续段标为高风险段，钩载残差超阈值的点标为疑似遇阻。",
          "effect": "把“哪里可能屈曲、哪里可能遇阻”标在井深轴上",
          "trap": "只看钩载正负判屈曲 —— 垂直段受压即屈曲，钩载还远未到零。",
          "input": "钩载曲线、井斜、管柱刚度",
          "output": "屈曲风险段 + 疑似遇阻点",
          "viz": "残差控制图 + 风险带高亮"
        },
        {
          "name": "下入速度优化",
          "role": "搜索 · OPT",
          "do": "扫描 0.2—2.0 m/s，在安全系数 ≥2.0、钩载 >0 且不进入屈曲区的约束下，选用时最短的速度。",
          "effect": "给出可行区间与最快可行档，而不是一个拍出来的速度",
          "trap": "只追求速度，忽略摩阻随速度与井深上升，实际下放时被卡住。",
          "input": "约束阈值 + 速度区间",
          "output": "推荐速度 + 可行区间",
          "viz": "速度—用时 / 速度—安全系数双曲线"
        },
        {
          "name": "现场复核与指重表校验",
          "role": "人工",
          "do": "把预测钩载与现场指重表逐点比对，偏差大时反演摩阻系数并重算；高风险段降速或增加短起下。",
          "effect": "模型随本井实测收敛，风险预案可执行",
          "trap": "模型与现场不一致时仍按模型执行，忽略实际摩阻变化。",
          "input": "预测钩载 vs 实测指重表",
          "output": "反演摩阻、修订参数与预案",
          "viz": "预测 / 实测散点 + 偏差分布"
        }
      ],
      "metrics": {
        "title": "怎么算“算得准”",
        "html": "<p>与现场指重表逐点对比钩载，统计平均绝对误差与最大偏差；风险段用实际遇阻、卡钻记录验证命中率。注意<b>钩载 MAE 小不等于模型对</b> —— 摩阻系数可以靠调参把曲线拟合得很漂亮，但风险段的定位仍可能错。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>本示范取值</th></tr></thead><tbody><tr><td>钩载 MAE</td><td>预测与实测钩载的平均绝对误差</td><td>≤ 5%</td></tr><tr><td>风险段命中</td><td>高风险段与实际复杂井段的重合比例</td><td>≥ 70%</td></tr><tr><td>误报率</td><td>标高风险但现场正常作业的比例</td><td>越低越好</td></tr><tr><td>屈曲裕度</td><td>轴向压力距临界屈曲载荷的余量</td><td>&gt; 0（必须）</td></tr></tbody></table>"
      },
      "fails": [
        {
          "name": "摩阻系数失真",
          "why": "用邻井经验值套新区块，钩载曲线整体偏移；应结合本井指重表分井段反演。"
        },
        {
          "name": "狗腿度低估",
          "why": "测斜点太稀，弯曲应力被抹平，风险段漏报；测斜间隔不宜大于 30 m。"
        },
        {
          "name": "异常误报",
          "why": "接单根、停钻等操作造成钩载突变，被当成遇阻；需结合作业时序过滤。"
        },
        {
          "name": "忽略屈曲",
          "why": "只校核抗拉与钩载，没算临界屈曲载荷；垂直段受压即屈曲，屈曲后摩阻骤增，管柱可能既下不去也提不动。"
        }
      ]
    },
    "demo": {
      "__generated": true
    }
  }
};
  var key = "completion-string-stress-analysis";
  def.tabs = def.tabs || {};
  def.tabs.demo = {
    label: "可运行示范",
    intro: "拖动下入速度、摩阻系数、井斜角、管柱线重与井深，查看井眼轨迹、钩载曲线、安全系数与风险热力带；点击“下入动画”观察管柱沿井眼推进。",
    mode: 'module',
    mount: function (root) {
      root.innerHTML = '';
      if (true) root.style.minHeight = 780 + 'px';
      var fn = window.__IQ_DEMOS__ && window.__IQ_DEMOS__[key];
      if (typeof fn !== 'function') {
        root.innerHTML = '<div class="iq-miss"><b>示范脚本未加载</b><br>请确认 index.html 中已引入 ' +
          "completion-string-stress-analysis/demo/demo.js" + '，且位于 shell.js 之前。</div>';
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
