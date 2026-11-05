/* =========================================================
   自动生成：fracturing-parameter-optimization/case.json → 站点插件注册器
   不要手改本文件；改 case.json 或 demo/*，再跑 node tools/build-cases.js
   ========================================================= */
(function () {
  'use strict';
  var def = {
  "id": "fracturing-parameter-optimization",
  "sceneId": "e1",
  "methods": [
    "opt"
  ],
  "code": "E1",
  "title": "压裂参数智能优化",
  "status": "ready",
  "version": "2.0.0",
  "updated": "2026-11-02",
  "highlight": "液量越大不一定越好：泵注时间一长，滤失先把缝长吃回去。",
  "preview": "输入 4 项施工参数 → 输出缝长、增产、压力预演与风险分区",
  "credibility": {
    "score": 71,
    "level": "中高",
    "basis": "裂缝与压力为代理模型，已计入泵注时间—滤失效率项；风险阈值与设备上限按经验给定，未用微地震或施工曲线校验。",
    "checks": [
      {
        "k": "数据",
        "v": "合成 16×6 参数网格"
      },
      {
        "k": "方法",
        "v": "裂缝代理 + 网格搜索 + 风险分区"
      },
      {
        "k": "验证",
        "v": "压力余量 15.5 MPa，风险余量 55"
      }
    ]
  },
  "conclusion": {
    "title": "中等排量、大液量、较高砂比，换来更长缝与可控压力",
    "html": "<p>AI 推荐 <b>4.75 m³/min · 1200 m³ · 砂比 22%</b>：有效半缝长 <b>73 m</b>，预计日产 <b>43.9 t/d</b>，较压前 18 t/d 增产约 <b>144%</b>；峰值压力 <b>50.5 MPa</b>，低于 66 MPa 设备上限 15.5 MPa，泵注时长 4.2 h。</p><p>经验模板（4.00 m³/min、400 m³、18%）半缝长 47 m、日产 29.5 t/d。<b>为什么不把排量再压小</b>：1200 m³ 在 2.0 m³/min 下要泵 10 小时，滤失把缝长从 90 m 吃回 64 m，日产反落到 39.2 t/d。排量不是越小越好，液量也不是越大越好 —— 两个参数要通过“泵注时间”一起看。</p>"
  },
  "limits": [
    "裂缝几何与压力为代理模型，未用专业压裂模拟器或现场施工曲线校验；缝长按单缝计算，未计入缝网复杂度。",
    "风险阈值与压力上限按经验给定，未按本井设备能力与地层条件标定。",
    "推荐解贴近液量上限（1200 m³）与砂比窗口边界，现场需准备降砂比或降排量的备选方案。",
    "滤失系数按单一值处理，实际随净压力与天然裂缝发育程度变化，长泵注段的预测偏差会放大。"
  ],
  "concept": {
    "title": "决策链",
    "steps": [
      {
        "k": "INPUT",
        "t": "储层与设备",
        "d": "闭合压力、排量、液量、砂比"
      },
      {
        "k": "MODEL",
        "t": "裂缝与压力代理",
        "d": "缝长、导流、峰值压力"
      },
      {
        "k": "CONSTRAINT",
        "t": "压力与风险",
        "d": "设备上限 66 MPa / 风险 55"
      },
      {
        "k": "SEARCH",
        "t": "网格搜索",
        "d": "16×6 组合 + 风险分区"
      },
      {
        "k": "OUTPUT",
        "t": "施工参数",
        "d": "排量、液量、砂比与预演曲线"
      }
    ]
  },
  "tabs": {
    "background": {
      "label": "专业背景",
      "judge": [
        {
          "label": "方法组合",
          "value": "KG · OPT · TS · CV",
          "desc": "找先验、搜参数、盯泵注、验缝长"
        },
        {
          "label": "输入",
          "value": "4 项参数",
          "desc": "排量、液量、砂比、闭合压力"
        },
        {
          "label": "输出",
          "value": "施工参数",
          "desc": "缝长、增产、风险、置信度"
        },
        {
          "label": "难度",
          "value": "较高",
          "desc": "砂比与排量同时影响产能与砂堵",
          "html": "<span class=\"dtag\" data-d=\"高\">难度 高</span>"
        },
        {
          "label": "关键权衡",
          "value": "砂比窗口",
          "desc": "砂比超过 24% 后砂堵风险上升快于增产",
          "html": "<b style=\"color:var(--clay-d);font-family:var(--mono)\">≤ 24%</b>"
        }
      ],
      "lede": "压裂是低渗储层增产的主要手段：总液量决定造缝规模，排量决定泵注时间与缝高，砂比决定导流能力，三者共同决定施工压力与砂堵风险。现场通常先按邻井模板定规模，再根据施工压力临时调整 —— 遇到闭合压力或滤失变化，同一套参数可能从“增产”变成“砂堵”。",
      "sections": [
        {
          "no": 1,
          "en": "PROBLEM",
          "title": "当前做法与问题",
          "html": "<p>压裂设计通常先定规模（总液量、砂量），再按邻井经验选排量与砂比；施工中由现场工程师根据压力曲线临时调整。</p><p>问题有三个：<b>参数耦合强</b> —— 排量提高会增大缝高与摩阻，砂比提高会增强导流但增加砂堵概率；<b>模板不可迁移</b> —— 闭合压力、滤失系数一变，同一套参数可能从“增产”变成“砂堵”；<b>只看规模不看时间</b> —— 同样 1200 m³ 液量，4.75 m³/min 泵 4.2 小时，2.0 m³/min 要泵 10 小时，滤失量差一倍以上，缝长反而更短。</p><p>现实量级可以对照：鄂尔多斯长 7 致密油水平井单段液量约 1100 m³、加砂约 100 m³、段间距 90 m、排量 10—12 m³/min；吉木萨尔页岩油提到 14—16 m³/min、施工压力 60—81 MPa、加砂强度 2.0 m³/m。直井小规模压裂的排量则落在 4—8 m³/min。</p><figure style='margin:10px 0 0'><svg viewBox='0 0 620 190' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='水力裂缝示意'><rect width='620' height='190' fill='#fff'/><rect x='20' y='40' width='580' height='120' fill='#efe9dc'/><line x1='20' y1='88' x2='600' y2='88' stroke='#d8d2c4' stroke-dasharray='4 3'/><line x1='310' y1='18' x2='310' y2='168' stroke='#8d979d' stroke-width='6'/><path d='M310 100 C250 92 190 74 120 58 C170 88 240 106 310 116 Z' fill='#2f7d6b' fill-opacity='.16' stroke='#2f7d6b'/><path d='M310 100 C370 92 430 74 500 58 C450 88 380 106 310 116 Z' fill='#2f7d6b' fill-opacity='.16' stroke='#2f7d6b'/><g fill='#a9852f'><circle cx='270' cy='99' r='2.2'/><circle cx='240' cy='94' r='2.2'/><circle cx='210' cy='86' r='2.2'/><circle cx='180' cy='78' r='2.2'/><circle cx='150' cy='69' r='2.2'/><circle cx='350' cy='99' r='2.2'/><circle cx='380' cy='94' r='2.2'/><circle cx='410' cy='86' r='2.2'/><circle cx='440' cy='78' r='2.2'/><circle cx='470' cy='69' r='2.2'/></g><g font-size='10' fill='#4d565b' font-family='sans-serif'><text x='310' y='14' text-anchor='middle'>井口</text><text x='120' y='52' fill='#256354'>裂缝半长</text><text x='500' y='52' fill='#256354'>缝高</text><text x='310' y='182' text-anchor='middle' fill='#9ba3a9'>图 1 · 水力裂缝沿井筒两侧延伸，支撑剂（黄点）维持导流能力。</text></g></svg></figure>"
        },
        {
          "no": 2,
          "en": "INTERVENTION",
          "title": "AI 能做什么：先验、搜索、盯泵、验缝",
          "html": "<p>压裂是“设计—施工—验证”三段闭环，每段用的方法不一样：设计段要<b>先验和搜索</b>，施工段要<b>实时判异常</b>，压后要<b>用监测数据回头验证</b>。</p><table class=\"dtable\"><thead><tr><th>工序</th><th>方法</th><th>在这一步做什么</th></tr></thead><tbody><tr><td>找先验</td><td>KG · 案例检索</td><td>同层位、同闭合压力、同规模的邻井压裂案例建库，给参数搜索一个合理初值，避免从零网格搜</td></tr><tr><td>定参数</td><td>OPT · 多目标优化</td><td>裂缝/压力代理 + 约束搜索，输出“增产—风险”帕累托前沿，而不是一个点</td></tr><tr><td>盯泵注</td><td>TS · 曲线异常</td><td>施工压力与排量的斜率、残差突变，是砂堵与缝高失控的前兆；提前 1—2 分钟报警比压后分析有用</td></tr><tr><td>验缝长</td><td>CV · 微地震成像</td><td>微地震事件定位与缝网成像，反演缝长与缝高，回填代理模型；没有这一步，模型永远不知道自己错在哪</td></tr></tbody></table><p>这四步构成闭环：<b>KG 给初值 → OPT 给方案 → TS 保施工 → CV 验结果</b>。缺了最后一环，压裂设计就永远停在“按模板 + 事后总结”。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 122' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='122' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">裂缝代理 + 网格搜索 · 从施工参数到推荐泵注方案</text><rect x='14' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='23' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">01</text><text x='23' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>施工参数</text><text x='23' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>排量 / 液量 / 砂比</text><path d='M128 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='139' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='148' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">02</text><text x='148' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>裂缝代理</text><text x='148' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>缝长 + 缝高</text><path d='M253 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='264' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='273' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">03</text><text x='273' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>压力与风险</text><text x='273' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>超压 + 砂堵</text><path d='M378 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='389' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#e6e0d2' stroke-width='.9'/><text x='398' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">04</text><text x='398' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>网格搜索</text><text x='398' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>剔除超限</text><path d='M503 64 h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='#9ba3a9' stroke-width='1'/><rect x='514' y='30' width='112' height='68' rx='5' fill='#fbfaf6' stroke='#1e6f5c' stroke-width='1.1'/><text x='523' y='45' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".8\">05</text><text x='523' y='62' font-size='10.5' font-weight=\"500\" fill='#242b2e' font-family='sans-serif'>推荐方案</text><text x='523' y='77' font-size='8.2' fill='#79828a' font-family='sans-serif'>帕累托集</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 2 · 压裂设计的两难是「缝要长」和「压力别超」同时成立；代理模型把缝长、压力、砂堵风险一起算出来，才谈得上在网格里搜索。</figcaption></figure>"
        },
        {
          "no": 3,
          "en": "DATA",
          "title": "需要准备什么",
          "html": "<p style=\"margin-bottom:14px\">立项前先对着这张清单打勾。<b>勾不满不代表不能做</b>，但每一项空缺都会在后期变成返工。清单可点击，勾选状态只在本页有效。</p><div class=\"checklist\"><div class=\"cl-head\"><span>数据准备清单 · 5 项</span><span class=\"cl-prog\"><span id=\"cl-txt\">0 / 5</span><span class=\"cl-bar\"><i id=\"cl-fill\"></i></span></span></div><div class=\"cl-item\" data-cl=\"0\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">储层与岩石力学</span><span class=\"cl-s\">闭合压力、杨氏模量、泊松比、储层厚度</span></span><span class=\"cl-n\">缝长与缝高计算的输入</span></div><div class=\"cl-item\" data-cl=\"1\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">滤失参数</span><span class=\"cl-s\">滤失系数（可由小型测试或净压力拟合反演）</span></span><span class=\"cl-n\">决定同样液量能造多长的缝</span></div><div class=\"cl-item\" data-cl=\"2\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">施工参数</span><span class=\"cl-s\">排量范围、总液量、砂比、支撑剂粒径</span></span><span class=\"cl-n\">搜索空间边界</span></div><div class=\"cl-item\" data-cl=\"3\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">设备约束</span><span class=\"cl-s\">最高施工压力、泵注能力、套管承压</span></span><span class=\"cl-n\">硬约束，不可用权重替代</span></div><div class=\"cl-item\" data-cl=\"4\"><span class=\"cl-box\"><svg width=\"10\" height=\"10\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12.5l5 5L20 6.5\"/></svg></span><span><span class=\"cl-t\">历史井反馈</span><span class=\"cl-s\">施工曲线、砂堵记录、压后产量、微地震</span></span><span class=\"cl-n\">校准代理模型</span></div></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可参考的公开数据</span></p><div class=\"refs\"><span class=\"ref\">长 7 致密油：单段 1100 m³ / 加砂 100 m³ / 段间距 90 m</span><span class=\"ref\">吉木萨尔：排量 14—16 m³/min、压力 60—81 MPa</span><span class=\"ref\">青海油田：直井缝网压裂日增油 4.3 t</span></div><p style=\"margin-top:14px\" class=\"small muted\">口径提醒：<b>排量</b>是井底注入排量还是井口排量、<b>液量</b>含不含前置液与顶替液、<b>砂比</b>是平均砂比还是阶段砂比 —— 这三处不统一，两套设计没法比。</p><figure style='margin:12px 0 0'><svg viewBox='0 0 640 186' xmlns='http://www.w3.org/2000/svg' role='img'><rect x='0' y='0' width='640' height='186' fill='#ffffff'/><text x='14' y='18' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\"1.2\">施工参数表结构 · 一行一个候选方案</text><rect x='14' y='28' width='612' height='22' fill='#f1ede2' stroke='#e6e0d2'/><text x='66' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">层段</text><text x='177' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">闭合压力 (MPa)</text><text x='318' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">滤失 (m³/min¹ᐟ²)</text><text x='435' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">厚度 (m)</text><text x='548' y='43' font-size='8.6' fill='#4d565b' font-family='monospace' text-anchor=\"middle\" letter-spacing=\".3\">泵注能力 (m³/min)</text><rect x='14' y='50' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='66' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">3110—3140</text><text x='177' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">38.6</text><text x='318' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">0.0042</text><text x='435' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">28</text><text x='548' y='66' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">4.2</text><rect x='14' y='74' width='612' height='24' fill='#fbfaf6' stroke='#f0ece1' stroke-width='.7'/><text x='66' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">3110—3140</text><text x='177' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">38.6</text><text x='318' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">0.0042</text><text x='435' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">28</text><text x='548' y='90' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">4.8</text><rect x='14' y='98' width='612' height='24' fill='#ffffff' stroke='#f0ece1' stroke-width='.7'/><text x='66' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">3140—3170</text><text x='177' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">41.2</text><text x='318' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">0.0036</text><text x='435' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">24</text><text x='548' y='114' font-size='9' fill='#4d565b' font-family='sans-serif' text-anchor=\"middle\">4.2</text><line x1='119' y1='28' x2='119' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='236' y1='28' x2='236' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='400' y1='28' x2='400' y2='122' stroke='#f0ece1' stroke-width='.7'/><line x1='470' y1='28' x2='470' y2='122' stroke='#f0ece1' stroke-width='.7'/><rect x='14' y='137' width='7' height='7' rx='1.5' fill='#1e6f5c'/><text x='26' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">样本量</text><text x='26' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>网格 5×5×4 = 100 组</text><rect x='218' y='137' width='7' height='7' rx='1.5' fill='#a9852f'/><text x='230' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">标注成本</text><text x='230' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>需小型压裂测试定滤失</text><rect x='422' y='137' width='7' height='7' rx='1.5' fill='#a85249'/><text x='434' y='144' font-size='8' fill='#9ba3a9' font-family='monospace' letter-spacing=\".6\">口径风险</text><text x='434' y='156' font-size='9.2' fill='#4d565b' font-family='sans-serif'>闭合压力按实测，勿用估算</text></svg><figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 3 · 闭合压力与滤失系数决定了「同样的液量能造多长的缝」；厚度决定缝高向上延伸的风险，泵注能力是硬上限。</figcaption></figure>"
        },
        {
          "no": 4,
          "en": "DIFFICULTY",
          "title": "技术难度与参考方向",
          "html": "<div style=\"display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px\"><span class=\"dtag\" data-d=\"高\">难度 高</span><span class=\"small muted\">缝长的不确定性大，风险又分两类，不能加成一个数。</span></div><div class=\"meter\"><i class=\"on\"></i><i class=\"on\"></i><i class=\"on hi\"></i></div><p>难度按三档标注：<b>低</b> = 数据现成、任务边界清晰、错了代价小；<b>中</b> = 需要一个月量级的标注与清洗，效果依赖后处理规则；<b>高</b> = 标签稀缺或安全约束硬，通常要先做小范围可行性验证再立项。</p><p>这个案例落在<b>高</b>：缝长与缝高受天然裂缝、层理与滤失影响，代理模型只能给趋势；施工压力超限与砂堵是两类风险，代价不同、处置不同，不能简单相加。建议输出“可行域 + 帕累托前沿 + 风险分区”，施工中用实时压力曲线滚动修正。</p><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">可借鉴的通用技术</span></p><div class=\"refs\"><a class=\"ref\" href=\"#/method/opt\">代理模型<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">网格搜索<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/opt\">多目标优化<span class=\"ar\">↗</span></a><a class=\"ref\" href=\"#/method/ts\">实时曲线异常检测<span class=\"ar\">↗</span></a></div><p style=\"margin-top:18px\"><span class=\"kicker plain\" style=\"color:var(--ink-4)\">本案例用到的现实依据</span></p><div class=\"refs\"><span class=\"ref\">长 7：排量 10—12 m³/min、单段液量 1100 m³</span><span class=\"ref\">吉木萨尔：加砂强度 2.0 m³/m、液砂比约 10</span><span class=\"ref\">直井压裂：排量 4—8 m³/min 形成理想缝形</span></div><p style=\"margin-top:18px\" class=\"small muted\">交叉环节：<a href=\"#/stage/stimulation\" style=\"color:var(--jade-d);font-weight:600\">增采</a> · <a href=\"#/stage/completion\" style=\"color:var(--jade-d);font-weight:600\">完井</a></p>"
        }
      ]
    },
    "workflow": {
      "label": "案例流程",
      "title": "案例：F 井 3110—3140 m 段压裂参数设计",
      "lead": [
        "F 井是 3000 m 级直井，目标层厚 28 m、闭合压力 34 MPa、邻井实测滤失系数 0.004 m/min^0.5，压前日产 18 t/d。目标是在 66 MPa 设备压力与砂堵风险约束下，让有效缝长与导流能力带来最大增产。",
        "流程适用于新井压裂设计；老井重复压裂可沿用同一框架，但需重新标定闭合压力与滤失。"
      ],
      "stats": [
        [
          "参数组合",
          "≈ 1.4 万",
          true
        ],
        [
          "压力上限",
          "66 MPa"
        ],
        [
          "风险阈值",
          "55 / 100"
        ],
        [
          "推荐排量",
          "4.75 m³/min"
        ],
        [
          "泵注时长",
          "4.2 h"
        ],
        [
          "半缝长",
          "73 m"
        ]
      ],
      "steps": [
        {
          "name": "储层与施工数据采集",
          "role": "数据 · KG",
          "do": "整理闭合压力、滤失、储层厚度、泵注能力与设备压力上限；统一到 m³/min、m³、%、MPa。",
          "effect": "得到可计算的参数边界与硬约束",
          "trap": "把井口承压当套管承压，压力约束被低估，现场被迫降排量。",
          "input": "闭合压力、滤失、厚度、泵注能力",
          "output": "参数边界 + 硬约束集合",
          "viz": "参数区间条：范围 + 当前取值"
        },
        {
          "name": "裂缝与压力代理模型",
          "role": "建模 · OPT",
          "do": "由液量、排量、滤失与泵注时间估算缝长与缝高；由闭合压力、净压力与摩阻估算施工压力；由砂比与泵注时长估算砂堵风险。",
          "effect": "任意参数组合都能快速给出缝长、产量与风险",
          "trap": "只按液量算缝长、不看泵注时间，低排量方案会被高估 30% 以上。",
          "input": "液量、排量、砂比、滤失",
          "output": "缝长、缝高、施工压力、砂堵风险",
          "viz": "裂缝几何剖面 + 施工压力曲线"
        },
        {
          "name": "约束网格搜索",
          "role": "搜索 · OPT",
          "do": "在排量、液量、砂比网格上搜索，剔除压力或风险超限组合，按增产排序，并保留帕累托前沿。",
          "effect": "输出推荐参数与可替代的折中方案",
          "trap": "只搜网格点，最优点落在网格之间，需要局部细化。",
          "input": "三维网格 + 压力上限 / 风险阈值",
          "output": "推荐参数、备选、帕累托前沿",
          "viz": "增产热力图 + 风险等高线"
        },
        {
          "name": "施工曲线预演",
          "role": "预演 · TS",
          "do": "按泵注时间生成施工压力曲线，标出压力上限与砂堵风险时段，并与设备能力核对。",
          "effect": "把“会不会超压”提前到设计阶段",
          "trap": "忽略摩阻随排量与液量变化，压力曲线偏乐观。",
          "input": "推荐参数 + 泵注时间轴",
          "output": "压力曲线、超压与砂堵时段",
          "viz": "压力—时间曲线 + 上限红线 + 风险色带"
        },
        {
          "name": "现场执行与实时修正",
          "role": "人工 · CV",
          "do": "按设计泵注，实时对比压力曲线；压力异常上升时降排量或降砂比，必要时提前结束加砂。",
          "effect": "在安全边界内完成加砂",
          "trap": "为追设计砂量强行加砂，导致砂堵或缝口脱砂。",
          "input": "实时压力、排量、砂比",
          "output": "修正后的排量与砂比指令",
          "viz": "设计曲线 vs 实时曲线双线对比"
        }
      ],
      "metrics": {
        "title": "怎么算“压得好”",
        "html": "<p>压后评估看有效缝长（微地震或压降试井解释）、30 天增产倍数与施工复杂率；设计阶段看预测压力与实测压力的偏差。只看增产倍数会诱导“堆液量”，把复杂率一起算才平衡。</p><table class=\"dtable\"><thead><tr><th>指标</th><th>定义</th><th>本示范取值</th></tr></thead><tbody><tr><td>增产倍数</td><td>压后稳定日产 / 压前日产</td><td>2.4×（43.9 / 18）</td></tr><tr><td>压力偏差</td><td>预测与实测施工压力之差</td><td>≤ ±10%</td></tr><tr><td>复杂率</td><td>砂堵或超压井次比例</td><td>越低越好</td></tr><tr><td>缝长符合率</td><td>微地震解释缝长 / 设计缝长</td><td>0.8—1.2</td></tr></tbody></table>"
      },
      "fails": [
        {
          "name": "缝高失控",
          "why": "高排量把裂缝打进隔层，缝长变短、支撑剂铺置变差；模型需限制缝高，现场用控缝高工艺。"
        },
        {
          "name": "砂比过高",
          "why": "为导流能力把砂比推到 30% 以上，现场排量稍有波动就砂堵。"
        },
        {
          "name": "压力约束失真",
          "why": "未计入液柱与摩阻，设计压力低于实际，现场被迫降排量、少加砂。"
        },
        {
          "name": "长泵注滤失",
          "why": "低排量配大液量，泵注 8—10 小时，滤失把缝长吃回去；排量与液量必须一起看泵注时间。"
        }
      ]
    },
    "demo": {
      "__generated": true
    }
  }
};
  var key = "fracturing-parameter-optimization";
  def.tabs = def.tabs || {};
  def.tabs.demo = {
    label: "可运行示范",
    intro: "拖动排量、总液量、砂比与闭合压力，查看裂缝形态、增产热力图、风险等高线与施工压力曲线；点击“泵注预演”观察裂缝扩展。",
    mode: 'module',
    mount: function (root) {
      root.innerHTML = '';
      if (true) root.style.minHeight = 780 + 'px';
      var fn = window.__IQ_DEMOS__ && window.__IQ_DEMOS__[key];
      if (typeof fn !== 'function') {
        root.innerHTML = '<div class="iq-miss"><b>示范脚本未加载</b><br>请确认 index.html 中已引入 ' +
          "fracturing-parameter-optimization/demo/demo.js" + '，且位于 shell.js 之前。</div>';
        return;
      }
      root.__iqLive = fn(root);
      /* 示范之后固定追加「工程结论 + 模型边界」与可信度条 */
      if (window.K) {
        var foot = window.K.verdictBlock(def.conclusion, def.limits) +
          window.K.credStrip(def.credibility);
        if (foot) {
          var box = document.createElement('div');
          box.className = 'iq-case-foot';
          box.innerHTML = foot;
          root.appendChild(box);
        }
      }
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
