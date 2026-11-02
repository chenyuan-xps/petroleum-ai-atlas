/* =========================================================
   自动生成：perforation-parameter-design/case.json → 站点插件注册器
   不要手改本文件；改 case.json 或 demo/*，再跑 node tools/build-cases.js
   ========================================================= */
(function () {
  'use strict';
  var def = {
  "id": "perforation-parameter-design",
  "sceneId": "co2",
  "methods": [
    "opt"
  ],
  "code": "CO2",
  "title": "射孔参数智能设计",
  "status": "ready",
  "version": "2.0.0",
  "updated": "2026-11-02",
  "highlight": "孔径和穿深是一对死对头：14 mm 的孔眼，穿深只剩 12 cm。",
  "preview": "输入 4 项射孔参数与地层压力 → 输出产能 / 风险双图与约束内最优组合",
  "credibility": {
    "score": 72,
    "level": "中高",
    "basis": "产能与风险为代理模型；孔径—穿深关系按 API RP 19B 器材样本修正，负压值按渤海经验公式校核；推荐解贴风险阈值。",
    "checks": [
      {
        "k": "数据",
        "v": "合成 21×7 网格 + 器材样本校核"
      },
      {
        "k": "方法",
        "v": "产能代理 + 风险模型 + 约束搜索"
      },
      {
        "k": "验证",
        "v": "2.1 万组搜索，解在风险边界"
      }
    ]
  },
  "conclusion": {
    "title": "约束内最优是“更高孔密 + 更长段长”，代价是风险余量归零",
    "html": "<p>推荐组合为 <b>21 孔/m · 60° · 孔径 10 mm · 射孔 19 m</b>：预测日产 <b>55.3 t/d</b>，风险指数 <b>64</b>，正好压在阈值上。经验方案（16 孔/m · 60° · 10 mm · 8 m）日产 45.8 t/d、风险 54，产能差约 21%。</p><p>推荐解没有把孔径顶到 14 mm —— 这是本案例最容易被忽略的一点。API RP 19B 的器材样本里，14 mm 以上孔径只有“大孔径弹”能做到，而大孔径弹的混凝土靶穿深只有 12—16 cm；深穿透弹孔径 10 mm、穿深 90—127 cm。孔径与穿深此消彼长，只把孔径当独立变量调，产能会被系统性算高。</p>"
  },
  "limits": [
    "产能与风险为代理模型，未覆盖储层非均质、层间干扰与射孔污染；孔径—穿深修正按单一器材档位标定，换弹型需重标。",
    "推荐解贴风险阈值（余量 0），现场参数波动即可能超限，必须保留低一档孔密的备选方案。",
    "负压值与射孔液未进入模型；实际设计要按《海上油气田完井手册》公式单独校核，负压过高会引发地层大量出砂。"
  ],
  "concept": {
    "title": "决策链",
    "steps": [
      {
        "k": "INPUT",
        "t": "四参数空间",
        "d": "孔密、相位、孔径、段长"
      },
      {
        "k": "MODEL",
        "t": "产能与风险代理",
        "d": "两条响应面同时计算"
      },
      {
        "k": "CONSTRAINT",
        "t": "器材与风险",
        "d": "孔径—穿深折减 / 风险 ≤ 64"
      },
      {
        "k": "SEARCH",
        "t": "约束网格搜索",
        "d": "2.1 万组组合 + 帕累托"
      },
      {
        "k": "OUTPUT",
        "t": "推荐与备选",
        "d": "参数组合、日产、风险、负压值"
      }
    ]
  },
  "tabs": {
    "background": {
      "label": "专业背景",
      "judge": [
        {
          "label": "方法组合",
          "value": "KG · CV · OPT · TS",
          "desc": "器材口径、孔道质量、参数搜索、投产后校准"
        },
        {
          "label": "参数空间",
          "value": "4 参数 · 2 万组",
          "desc": "孔密 4—24 孔/m、相位 0—180°、孔径 6—14 mm、段长 2—20 m"
        },
        {
          "label": "器材约束",
          "value": "孔径 ↔ 穿深",
          "desc": "14 mm 孔径的弹，穿深只有 12—16 cm"
        },
        {
          "label": "难度",
          "value": "中",
          "desc": "代理模型易建，器材口径难统一",
          "html": "<span class=\"dtag\" data-d=\"中\">难度 中</span>"
        },
        {
          "label": "关键约束",
          "value": "风险边界",
          "desc": "推荐解风险 64，已贴阈值，需备低一档孔密",
          "html": "<b style=\"color:var(--clay-d);font-family:var(--mono)\">64 / 100</b>"
        }
      ],
      "lede": "射孔是把套管井和储层连通的最后一步。孔密决定孔眼数量，相位决定孔眼在井周的分布，孔径与穿深决定每个孔眼的流通能力 —— 后两者在器材上此消彼长：想要大孔眼，就得接受浅穿透。现场多按一套标准参数套用（16 孔/m、60°、10 mm、射孔 8 m 是最常见的一套），遇到定向井、水平井或强出砂地层要改哪一项、改多少，往往只能凭经验。",
      "sections": [
        {
          "no": 1,
          "en": "PROBLEM",
          "title": "当前做法与问题",
          "html": "<p>常规做法是查设计手册或邻井资料，套一组“标准参数”。以 4-1/2″ 套管、16 孔/m、60° 相位、10 mm 孔径、射孔 8 m 为例：16 孔/m 换算成英制是 <b>4.9 SPF</b>，落在 API 常用区间（4—12 SPF，高密度可到 21 SPF）的中低段；60° 是垂直井最常见的相位。</p><p>问题有三个：<b>组合空间大</b> —— 四个参数合起来超过两万种组合，逐组做数值模拟算不起；<b>目标冲突</b> —— 孔密和段长增加能提高产能，出砂与套管损伤风险同步上升；<b>口径最乱</b> —— 孔径与穿深被当成两个独立旋钮，而器材样本里二者此消彼长，混用不同厂家的标称值，产能能差 20% 以上。</p><figure style='margin:10px 0 0'><svg viewBox='0 0 620 168' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='射孔相位示意'><rect x='0' y='0' width='620' height='168' fill='#ffffff'/><g font-family='sans-serif'><g transform='translate(78,80)'><circle r='46' fill='#efe9dc' stroke='#d8d2c4'/><circle r='21' fill='#fff' stroke='#8d979d' stroke-width='3'/><circle r='27' fill='none' stroke='#c9c3b4'/><g stroke='#b26a39' stroke-width='2.5'><line x1='0' y1='-21' x2='0' y2='-46'/><line x1='0' y1='21' x2='0' y2='46'/></g><text y='72' text-anchor='middle' font-size='10' fill='#4d565b'>180° · 2 孔</text></g><g transform='translate(218,80)'><circle r='46' fill='#efe9dc' stroke='#d8d2c4'/><circle r='21' fill='#fff' stroke='#8d979d' stroke-width='3'/><circle r='27' fill='none' stroke='#c9c3b4'/><g stroke='#b26a39' stroke-width='2.5'><line x1='0' y1='-21' x2='0' y2='-46'/><line x1='0' y1='21' x2='0' y2='46'/><line x1='0' y1='-21' x2='0' y2='21' transform='rotate(90)' transform-origin='0 0'/></g><text y='72' text-anchor='middle' font-size='10' fill='#4d565b'>90° · 4 孔</text></g><g transform='translate(358,80)'><circle r='46' fill='#efe9dc' stroke='#d8d2c4'/><circle r='21' fill='#fff' stroke='#8d979d' stroke-width='3'/><circle r='27' fill='none' stroke='#c9c3b4'/><g stroke='#b26a39' stroke-width='2.5'><line x1='0' y1='-21' x2='-12.1' y2='-42.4'/><line x1='0' y1='-21' x2='12.1' y2='-42.4'/><line x1='0' y1='-21' x2='-21.1' y2='-41'/><line x1='0' y1='-21' x2='21.1' y2='-41'/><line x1='-12.1' y1='-42.4' x2='-21.1' y2='-41'/><line x1='12.1' y1='-42.4' x2='21.1' y2='-41'/></g><text y='72' text-anchor='middle' font-size='10' fill='#4d565b'>60° · 6 孔（示意）</text></g><g transform='translate(498,80)'><circle r='46' fill='#efe9dc' stroke='#d8d2c4'/><circle r='21' fill='#fff' stroke='#8d979d' stroke-width='3'/><circle r='27' fill='none' stroke='#c9c3b4'/><g stroke='#b26a39' stroke-width='2.5'><line x1='0' y1='-21' x2='0' y2='-46'/><line x1='0' y1='-21' x2='0' y2='-40' transform='rotate(45)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(45)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(90)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(135)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(180)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(225)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(270)'/><line x1='0' y1='-21' x2='0' y2='-46' transform='rotate(315)'/></g><text y='72' text-anchor='middle' font-size='10' fill='#4d565b'>45° · 8 孔</text></g><text x='310' y='156' text-anchor='middle' font-size='10' fill='#9ba3a9'>图 1 · 同一孔密下不同相位的孔眼分布；相位越密，出砂与套管受力越分散，但单孔产能贡献下降。</text></g></svg></figure>"
        },
        {
          "no": 2,
          "en": "INTERVENTION",
          "title": "AI 能做什么：器材、孔道、参数、校准",
          "html": "<p>射孔设计的难点不在算，而在<b>四个“信不过”</b>：器材标称值信不过、孔道实际形态信不过、代理模型信不过、产能系数信不过。四种方法各解决一个。</p><table class=\"dtable\"><thead><tr><th>工序</th><th>方法</th><th>在这一步做什么</th></tr></thead><tbody><tr><td>认器材</td><td>KG · 知识图谱</td><td>弹型—孔径—穿深—适用套管尺寸建成器材图谱，先把“买不到、下不去”的组合剔出搜索空间</td></tr><tr><td>验孔道</td><td>CV · 图像分割</td><td>靶试断面或 CT 图像分割孔道与压实带，量出有效孔径与穿透形态；标称 14 mm 的孔，压实带占掉的那圈才是真实流通面积</td></tr><tr><td>搜参数</td><td>OPT · 约束优化</td><td>产能/风险代理 + 网格搜索 + 帕累托前沿，取风险阈值内日产最高的一组</td></tr><tr><td>校系数</td><td>TS · 时序分析</td><td>投产后 30 天产量与含水时序反标产能系数，回填代理模型，避免一次标定用三年</td></tr></tbody></table><p>四步里最容易被跳过的是<b>验孔道</b>：只看厂家标称孔径，模型会把“大孔眼”和“深穿透”同时算成收益，而这在器材上不可能同时成立。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 122' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='122' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">代理模型 + 约束搜索 · 从四维参数到推荐组合</text><rect x='14' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='23' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">01</text><text x='23' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>参数网格</text><text x='23' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>四维组合</text><path d='M128 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='139' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='148' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">02</text><text x='148' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>代理模型</text><text x='148' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>毫秒级预测</text><path d='M253 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='264' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='273' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">03</text><text x='273' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>双目标输出</text><text x='273' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>日产 + 风险</text><path d='M378 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='389' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='398' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">04</text><text x='398' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>约束筛选</text><text x='398' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>风险阈值</text><path d='M503 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='514' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='523' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">05</text><text x='523' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>帕累托集</text><text x='523' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>推荐 + 备选</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 2 · 数值模拟跑一组参数要几分钟，代理模型把它压到毫秒，才可能在网格上穷举；搜索的结果不是一个点，而是一条「产能—风险」前沿。</figcaption></figure>"
        },
        {
          "no": 3,
          "en": "DATA",
          "title": "需要准备什么",
          "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">射孔器材样本</span><span class=\"cl-s\">弹型 / 孔径 / 穿深 / 混凝土靶数据</span></span><span class=\"cl-n\">API RP 19B Section 1</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">井身结构</span><span class=\"cl-s\">套管钢级、壁厚、井斜与狗腿度</span></span><span class=\"cl-n\">决定孔密上限与相位</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">储层与岩石力学</span><span class=\"cl-s\">渗透率、孔隙度、地层压力、UCS</span></span><span class=\"cl-n\">产能与出砂风险标定</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">负压设计参数</span><span class=\"cl-s\">地层压力、泡点压力、声波时差 ΔT</span></span><span class=\"cl-n\">按手册公式算 Pmin / Pmax</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">历史井反馈</span><span class=\"cl-s\">同区块射孔参数、产量、出砂与套损</span></span><span class=\"cl-n\">校准代理模型</span></div></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可参考的公开标准与样本</span></p><div class=\"refs\"><span class=\"ref\">API RP 19B-2021《射孔器评估》</span><span class=\"ref\">API RP 19B 器材样本（厂家公开数据表）</span><span class=\"ref\">《海上油气田完井手册》负压值算法</span></div><p style=\"margin-top:14px\" class=\"small muted\">负压值的算法是公开的：最小负压 P<sub>min</sub>=6.89×3.5/K<sup>0.37</sup>（K 为渗透率，10⁻³ μm²），最大负压 P<sub>max</sub>=(3600−20ΔT)×6.89×10⁻³，渤海常用取 P<sub>rec</sub>=0.8P<sub>min</sub>+0.2P<sub>max</sub>。这套值必须单独算，不能由产能模型代劳。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 186' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='186' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">射孔参数表结构 · 一行一个候选段</text><rect x='14' y='28' width='612' height='22' fill='#f1ede2' stroke='#e6e0d2'/><text x='90' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">井段 (m)</text><text x='235' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">孔密 (孔/m)</text><text x='354' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">相位 (°)</text><text x='464' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">孔径 (mm)</text><text x='575' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">段长 (m)</text><rect x='14' y='50' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='90' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">3120—3136</text><text x='235' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">16</text><text x='354' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">60</text><text x='464' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">10.0</text><text x='575' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">16</text><rect x='14' y='74' width='612' height='24' fill='#fbfaf6' stroke='#f0ece1' stroke-width='.7'/><text x='90' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">3120—3136</text><text x='235' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">20</text><text x='354' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">90</text><text x='464' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">12.0</text><text x='575' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">16</text><rect x='14' y='98' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='90' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">3136—3152</text><text x='235' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">16</text><text x='354' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">120</text><text x='464' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">10.0</text><text x='575' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">16</text><line x1='167' y1='28' x2='167' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='303' y1='28' x2='303' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='405' y1='28' x2='405' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='524' y1='28' x2='524' y2='122' stroke='#f0ece1' stroke-width='.7'/><rect x='14' y='137' width='7' height='7' rx='1.5' fill='#1e6f5c'/><text x='26' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">样本量</text><text x='26' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>网格 6×4×3×3 = 216 组</text><rect x='218' y='137' width='7' height='7' rx='1.5' fill='#a9852f'/><text x='230' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">标注成本</text><text x='230' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>需历史井产量做监督</text><rect x='422' y='137' width='7' height='7' rx='1.5' fill='#a85249'/><text x='434' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">口径风险</text><text x='434' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>孔密按孔/m，勿混孔数</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 3 · 孔密、相位、孔径、段长四个维度决定了孔眼在地层里的分布；同一井段换一组参数，产能与出砂风险同时变化。</figcaption></figure>"
        },
        {
          "no": 4,
          "en": "DIFFICULTY",
          "title": "技术难度与参考方向",
          "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px\"><span class=\"dtag\" data-d=\"中\">难度 中</span><span class=\"small muted\">参数不多、机理清楚；难点在器材口径与风险定义，不在算法。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i></i></div><p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p><p>这个案例落在<b>中</b>：产能代理模型本身不难，真正决定成败的是两件事 —— 一是器材口径（孔径与穿深必须成对取样，不能各取最优值），二是风险口径（出砂、地层破裂、套管损伤是三类风险，不能加成一个数就完事）。</p><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">约束网格搜索<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">帕累托前沿<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">贝叶斯优化<span class=\"ar\">↗</span></a></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">本案例用到的现实数据</span></p><div class=\"refs\"><span class=\"ref\">API RP 19B-2021：靶体配比 / 养护 / 强度要求</span><span class=\"ref\">射孔弹样本：孔径 9.6—18 mm、穿深 12—127 cm</span><span class=\"ref\">渤海负压值经验公式（Pmin / Pmax / Prec）</span></div><p style=\"margin-top:18px\" class=\"small muted\">交叉环节：<a href=\"#/stage/completion\" style=\"color:var(--jade-d);font-weight:600\">完井</a> · <a href=\"#/stage/stimulation\" style=\"color:var(--jade-d);font-weight:600\">增采</a></p>"
        }
      ]
    },
    "workflow": {
      "label": "案例流程",
      "title": "案例：B 区块 12 口调整井的射孔参数设计",
      "lead": [
        "B 区块 12 口调整井，4-1/2″ 套管、储层压力 32 MPa、渗透率 20—60 mD，邻井出砂轻微但有套损记录。目标不是“算一个最优点”，而是把 12 口井从一套模板改成按井定制，同时把风险指数压在 64 以内。",
        "下面五步里，第 2 步（器材口径）和第 5 步（试射与负压校核）不涉及任何模型，却决定了推荐参数能不能真正下井。"
      ],
      "stats": [
        [
          "调整井",
          "12",
          true
        ],
        [
          "参数组合",
          "≈ 2.1 万",
          true
        ],
        [
          "风险阈值",
          "64 / 100"
        ],
        [
          "人工设计",
          "6 h / 井"
        ],
        [
          "辅助后",
          "1.5 h / 井"
        ],
        [
          "日产提升",
          "+21%"
        ]
      ],
      "steps": [
        {
          "name": "器材与井身数据入库",
          "role": "数据 · KG",
          "do": "把候选弹型的 API RP 19B 数据（孔径、穿深、孔密、相位）与 12 口井的套管钢级、壁厚、井斜录进同一张表，统一到孔/m、mm、m、MPa。",
          "effect": "同一口井的候选参数只从“能买到、能下井”的器材里生成",
          "trap": "孔径取 A 厂标称、穿深取 B 厂标称，两个数不在同一测试条件下，产能会系统性偏高。",
          "input": "弹型样本、套管规格、测斜数据",
          "output": "器材—井身联合参数表",
          "viz": "器材卡片 + 套管参数表"
        },
        {
          "name": "孔径—穿深口径统一",
          "role": "校核 · CV",
          "do": "按 API RP 19B 样本给孔径加穿透折减：孔径 ≤10 mm 取全穿深，11 mm 起逐毫米折减，14 mm 时只剩约 80% 穿透能力。",
          "effect": "模型不再把“大孔眼”和“深穿透”当成可以同时拿到的两件事",
          "trap": "不做折减，搜索会把孔径一路顶到 14 mm 上限，给出井下做不到的组合。",
          "input": "孔径—穿深样本对",
          "output": "带折减的产能响应面",
          "viz": "孔径—穿深散点 + 折减曲线"
        },
        {
          "name": "代理模型与风险模型",
          "role": "建模 · OPT",
          "do": "用回归模型预测日产；用规则与回归组合算出砂、地层破裂、套管损伤三类风险分，再按井身条件加权。",
          "effect": "任意组合都能在毫秒级给出产能与风险",
          "trap": "风险模型没有单调性约束，会出现“孔密越高风险越低”的反常结果。",
          "input": "四参数组合 + 地层压力",
          "output": "预测日产 + 三类风险分",
          "viz": "产能热力图 + 风险等高线"
        },
        {
          "name": "约束搜索与帕累托分析",
          "role": "搜索 · OPT",
          "do": "在四维网格上搜索，剔除风险超限的组合，按产能排序，同时保留“产能—风险”帕累托前沿供工程师取舍。",
          "effect": "给出推荐组合、备选组合和一条可选的折中曲线",
          "trap": "只搜网格点，最优点可能落在网格之间，需要局部细化。",
          "input": "参数网格 + 风险阈值 64",
          "output": "推荐组合、备选组合、帕累托前沿",
          "viz": "帕累托散点 + 参数二维切片"
        },
        {
          "name": "试射与负压校核",
          "role": "人工 · TS",
          "do": "复核射孔枪、相位器与套管强度，按手册公式算出 Pmin/Pmax 并确定负压值，必要时先试射 2—3 发验证穿深。",
          "effect": "把“模型最优”变成“井上可执行”",
          "trap": "负压值取上限会引发地层大量出砂，防砂井还可能砂堵井筒；负压偏低则孔道清理不净，表皮降不下来。",
          "input": "推荐组合 + 套管强度 + 渗透率",
          "output": "射孔设计书 + 负压值 + 试射方案",
          "viz": "孔眼分布俯视 + 负压区间条"
        }
      ],
      "metrics": {
        "title": "怎么算“设计得对”",
        "html": "<p>射孔设计不能只看预测日产，否则一定选出贴边界的激进方案。离线用历史井回测：把实际采用的参数作为参照，看推荐前 2 名是否覆盖；在线看投产后前 30 天的日产偏差、出砂事件与套损记录。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>本示范取值</th></tr></thead><tbody><tr><td>日产偏差</td><td>预测与实际之差 / 实际</td><td>≤ ±20%</td></tr><tr><td>风险命中率</td><td>高风险方案实际发生出砂或套损的比例</td><td>≥ 70%</td></tr><tr><td>器材可用性</td><td>推荐参数的弹型在库、可采购、能下井</td><td>100%</td></tr><tr><td>负压校核</td><td>设计负压值落在 Pmin—Pmax 之间</td><td>必须通过</td></tr></tbody></table><p style=\"margin-top:14px\">口径提醒：本示范的“日产”是<b>类比产能</b>——由采油指数与生产压差估算的相对值，不是某口真实井的实测产量。它可以用来比较方案优劣，不能直接拿去配产。</p>"
      },
      "fails": [
        {
          "name": "孔径—穿深混用",
          "why": "把大孔径弹的孔径与深穿透弹的穿深拼在一起，产能算高 20%—40%，下井后才发现孔道根本连不到有效储层。"
        },
        {
          "name": "风险阈值一刀切",
          "why": "所有井都用 64 分阈值，忽略套管钢级、壁厚与地层强度的差异。应按井分组设定阈值。"
        },
        {
          "name": "只盯产量",
          "why": "最优点落在高风险窄区，现场排量或压力稍有波动就出砂；必须同时给出低一档孔密的备选。"
        },
        {
          "name": "负压值凭经验",
          "why": "负压过高引发大量出砂，防砂井直接砂堵；负压过低孔道清理不净，表皮系数降不下来。要按公式算，再用前 2—3 口井的实际产能与出砂情况修正。"
        }
      ]
    },
    "demo": {
      "__generated": true
    }
  }
};
  var key = "perforation-parameter-design";
  def.tabs = def.tabs || {};
  def.tabs.demo = {
    label: "可运行示范",
    intro: "调节孔密、相位、孔径与射孔段长，查看产能热力图与风险等高线；点击“采用 AI 方案”把参数切到约束最优组合。",
    mode: 'module',
    mount: function (root) {
      root.innerHTML = '';
      if (true) root.style.minHeight = 780 + 'px';
      var fn = window.__IQ_DEMOS__ && window.__IQ_DEMOS__[key];
      if (typeof fn !== 'function') {
        root.innerHTML = '<div class="iq-miss"><b>示范脚本未加载</b><br>请确认 index.html 中已引入 ' +
          "perforation-parameter-design/demo/demo.js" + '，且位于 shell.js 之前。</div>';
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
