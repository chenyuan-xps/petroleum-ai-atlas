# 油气井完井智能决策实验室

石油勘探开发智能化案例网站，纯前端、离线可运行。学号尾号 `07`，对应**完井**阶段，包含四个完井案例与两个扩展案例。

## 快速开始

直接双击 `index.html` 即可浏览（无需安装依赖、无需启动服务器）。

- 首页：`index.html`
- 项目说明：`index.html#/project`
- 作业链：`index.html#/chain`
- 案例库（可筛选、可勾选对比）：`index.html#/cases`
- 案例对比：`index.html#/compare`
- 完井方式优选：`index.html#/scene/co1?tab=demo`
- 射孔参数设计：`index.html#/scene/co2?tab=demo`
- 管柱受力分析：`index.html#/scene/co3?tab=demo`
- 滑套控制策略：`index.html#/scene/co4?tab=demo`
- 压裂参数优化：`index.html#/scene/e1?tab=demo`
- 产量智能预测：`index.html#/scene/pr2?tab=demo`

每个案例也可单独打开：

```text
<案例文件夹>/demo/index.html
```

## 案例清单

| 场景 | 案例文件夹 | 提交压缩包 |
|---|---|---|
| co1 完井方式智能优选 | `completion-method-selection/` | `dist/完井-完井方式智能优选.zip` |
| co2 射孔参数智能设计 | `perforation-parameter-design/` | `dist/完井-射孔参数智能设计.zip` |
| co3 完井管柱受力智能分析 | `completion-string-stress-analysis/` | `dist/完井-完井管柱受力智能分析.zip` |
| co4 智能完井滑套控制策略 | `intelligent-sleeve-control/` | `dist/完井-智能完井滑套控制策略.zip` |
| e1 压裂参数智能优化 | `fracturing-parameter-optimization/` | `dist/增采-压裂参数智能优化.zip` |
| pr2 产量智能预测 | `production-forecasting/` | `dist/采油-产量智能预测.zip` |

每个案例包结构一致（7 个文件）：

```text
案例文件夹/
├─ case.json
└─ demo/
   ├─ index.html
   ├─ demo.css
   ├─ demo.js
   ├─ d3.v7.min.js
   ├─ iq-viz.js
   └─ iq-smart.js
```

其中 `demo.css` / `d3.v7.min.js` / `iq-viz.js` / `iq-smart.js` 由构建脚本从 `assets/` 复制，不要手改。
旧版 5 文件或 6 文件包仍可上传；缺少 `iq-smart.js` 时只是不显示智能方法说明卡。

## 平台能力（v2）

- **统一外壳**：固定顶栏 + 左侧导航 + 主内容区，`Ctrl/Cmd+K` 或 `/` 打开全局搜索，支持场景 / 案例 / 方法跳转。
- **首页驾驶舱**：作业链场景分布条（13 行）、方法构成环图、四张指标卡与数字滚动；6 个案例展厅缩略图。
- **统一案例页**：案例头（编号 / 亮点 / 可信度 / 上下篇）→ 决策链 → 三 Tab → 可信度条 → 结论与边界。
- **深度交互**：co1 权重敏感性扫描、co2 三档搜索口径、co3 下入回放与高风险井段、co4 固定/AI 切换 + 30 天回放 + 分层面积 + 流量分配、e1 三种优化口径 + 泵注回放 + Tornado、pr2 三情景 + 7/15/30/90 天快捷周期。
- **案例库与对比**：关键词 / 阶段 / 方法筛选，勾选 2 个以上案例生成 `#/compare?ids=...` 对比表。
- **案例包导入**：支持选择文件、选择文件夹、拖入文件夹，以及 **ZIP 压缩包**（点击选择或直接拖入）。ZIP 在浏览器本地解压，沿用同一套校验 / 预览 / 保存流程；单包 6 MB、解压后 6 MB、最多 200 个文件，拒绝路径穿越。
- **智能方法说明**：六个可运行示范顶部均展示「方法名称 / 输入 / 输出 / 解决的问题 / 为什么适合」、真实流程、经验方案 vs 智能方案的实时数值对比、有效原因与适用边界。

## 构建与打包

```bash
node tools/build-cases.js       # 校验 case.json（含 v2 平台字段）、同步共享 CSS/D3/组件、生成站点插件
python tools/package_cases.py   # 重新生成 dist/ 下六个提交压缩包（7 文件，打印 SHA-256）
```

修改 `assets/cases/iq-demo.css`、`assets/cases/iq-viz.js` 或 `assets/cases/iq-smart.js` 后需要重新运行构建脚本，改动会自动复制到六个案例包。

## 文档

- 项目完整说明：`项目说明.md`
- 原开发方案：`AI辅助开发实施方案.md`
- 案例设计规范：`案例设计与提交说明.md`
- 提示词与约束：`AI编程助手总提示词.md`
- 站点接入指南：`docs/如何添加新案例.md`

## 数据声明

示范中的**计算**仍使用合成数据：代理模型由物理关系式拟合，案例包内不含真实井数据，不代表真实生产结果。但案例文本里的**参数区间、器材指标与现场效果**已按公开标准、行业文献与现场报道逐项校核（API RP 19B-2021 射孔器评估、Dawson-Paslay 屈曲判据、中海油智能完井现场数据、长 7 与吉木萨尔压裂参数、中国石化递减率公报、PhaseNet 拾取误差基准等），逐条对应关系见 `项目说明.md` 第 4.1 节。工程决策需由工程师结合实测资料复核。

## 验证摘要

- 六个案例构建与语法检查：6 / 6 通过，每个包 7/7 文件；
- 站点内挂载、调参、AI 按钮、回放控件：6 / 6 通过；
- 13 条路由（总览 / 作业链 / 项目说明 / 对比 / 案例库 / 接入指南 / 环节 / 方法 / 场景）渲染正常；
- 首页三张驾驶舱图、案例库筛选与勾选对比、方法反查页分布条：通过；
- 浏览器控制台错误：0；
- D3 本地化，无 CDN、无后端请求；
- 案例包上传端到端测试通过，旧包（5 / 6 文件）与新包（7 文件）均兼容；
- ZIP 导入静态测试：store / deflate 解压、根目录与唯一顶层目录、缺少 case.json、多案例、`../` 与盘符路径、文件数量与体积上限均已覆盖；
- 六份提交压缩包已生成于 `dist/`（SHA-256 见 `python tools/package_cases.py` 输出）。
