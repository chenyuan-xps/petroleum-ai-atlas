











































































































































/* =========================================================
   构建脚本：把「独立案例包」同步到站点插件层
   ---------------------------------------------------------
   做三件事：
   1. 把共享样式 assets/cases/iq-demo.css 复制为各包 demo/demo.css
   2. 把 assets/vendor/d3.v7.min.js 复制为各包 demo/d3.v7.min.js
   3. 由各包 case.json 生成 assets/cases/<id>.case.js（插件注册器）

   用法：node tools/build-cases.js
   只改 case.json / demo 文件，然后重跑本脚本即可。
   ========================================================= */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');

var CASES = [
  { folder: 'completion-method-selection', zip: '完井-完井方式智能优选.zip' },
  { folder: 'perforation-parameter-design', zip: '完井-射孔参数智能设计.zip' },
  { folder: 'completion-string-stress-analysis', zip: '完井-完井管柱受力智能分析.zip' },
  { folder: 'intelligent-sleeve-control', zip: '完井-智能完井滑套控制策略.zip' },
  { folder: 'fracturing-parameter-optimization', zip: '增采-压裂参数智能优化.zip' },
  { folder: 'production-forecasting', zip: '采油-产量智能预测.zip' }
];

var ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var problems = [];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function copy(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

var cssSrc = path.join(ROOT, 'assets', 'cases', 'iq-demo.css');
var d3Src = path.join(ROOT, 'assets', 'vendor', 'd3.v7.min.js');
var vizSrc = path.join(ROOT, 'assets', 'cases', 'iq-viz.js');
var smartSrc = path.join(ROOT, 'assets', 'cases', 'iq-smart.js');
if (!fs.existsSync(cssSrc)) problems.push('缺少共享样式：assets/cases/iq-demo.css');
if (!fs.existsSync(d3Src)) problems.push('缺少 D3：assets/vendor/d3.v7.min.js（先下载 d3 v7）');
if (!fs.existsSync(vizSrc)) problems.push('缺少共享可视化组件：assets/cases/iq-viz.js');
if (!fs.existsSync(smartSrc)) problems.push('缺少智能方法说明卡：assets/cases/iq-smart.js');

var seenIds = {};
var report = [];

CASES.forEach(function (item) {
  var pkgDir = path.join(ROOT, item.folder);
  var jsonPath = path.join(pkgDir, 'case.json');
  if (!fs.existsSync(jsonPath)) {
    problems.push(item.folder + '：缺少 case.json');
    return;
  }

  var def = null;
  try {
    def = readJson(jsonPath);
  } catch (e) {
    problems.push(item.folder + '：case.json 不是合法 JSON（' + e.message + '）');
    return;
  }

  /* ---------- 清单校验 ---------- */
  if (!ID_RE.test(def.id || '')) problems.push(item.folder + '：id 不合规（' + def.id + '）');
  if (seenIds[def.id]) problems.push(item.folder + '：id 重复（' + def.id + '）');
  seenIds[def.id] = 1;
  if (!def.sceneId) problems.push(item.folder + '：缺少 sceneId');
  if (!def.title) problems.push(item.folder + '：缺少 title');
  var bg = (def.tabs || {}).background || {};
  if (!Array.isArray(bg.sections) || bg.sections.length < 2) problems.push(item.folder + '：background.sections 少于 2 段');
  var wf = (def.tabs || {}).workflow || {};
  if (!Array.isArray(wf.steps) || !wf.steps.length) problems.push(item.folder + '：workflow.steps 为空');
  /* v3：每一步必须写全「输入 / 处理 / 输出 / 可视化方法」四要素 */
  (wf.steps || []).forEach(function (s, i) {
    ['name', 'input', 'do', 'output', 'viz'].forEach(function (k) {
      if (!s || !s[k]) problems.push(item.folder + '：steps[' + i + '] 缺 ' + k);
    });
  });
  var demo = (def.tabs || {}).demo || {};
  if (!demo.html) problems.push(item.folder + '：tabs.demo.html 未声明');

  /* ---------- 平台展示字段（升级 v2 新增） ---------- */
  if (!def.code) problems.push(item.folder + '：缺少展示编号 code（如 CO1）');
  if (!def.highlight) problems.push(item.folder + '：缺少 highlight 一句话亮点');
  if (!def.preview) problems.push(item.folder + '：缺少 preview 交付预览');
  var cred = def.credibility || {};
  if (typeof cred.score !== 'number') problems.push(item.folder + '：credibility.score 缺失');
  if (!cred.level) problems.push(item.folder + '：credibility.level 缺失');
  if (!Array.isArray(cred.checks) || cred.checks.length < 3) problems.push(item.folder + '：credibility.checks 少于 3 项');
  if (!def.conclusion || !def.conclusion.html) problems.push(item.folder + '：conclusion.html 缺失');
  if (!Array.isArray(def.limits) || def.limits.length < 2) problems.push(item.folder + '：limits 少于 2 条');
  if (!def.concept || !Array.isArray(def.concept.steps) || def.concept.steps.length < 4) {
    problems.push(item.folder + '：concept.steps 少于 4 步');
  }
  var judgeCards = (bg.judge || []);
  if (judgeCards.length < 5) problems.push(item.folder + '：background.judge 少于 5 卡（v2 结构）');

  /* ---------- 文件同步 ---------- */
  var demoDir = path.join(pkgDir, 'demo');
  if (!fs.existsSync(path.join(demoDir, 'index.html'))) problems.push(item.folder + '：缺少 demo/index.html');
  if (!fs.existsSync(path.join(demoDir, 'demo.js'))) problems.push(item.folder + '：缺少 demo/demo.js');
  if (fs.existsSync(cssSrc)) copy(cssSrc, path.join(demoDir, 'demo.css'));
  if (fs.existsSync(d3Src)) copy(d3Src, path.join(demoDir, 'd3.v7.min.js'));
  if (fs.existsSync(vizSrc)) copy(vizSrc, path.join(demoDir, 'iq-viz.js'));
  if (fs.existsSync(smartSrc)) copy(smartSrc, path.join(demoDir, 'iq-smart.js'));

  /* demo.js 语法检查（只编译不执行） */
  var jsPath = path.join(demoDir, 'demo.js');
  if (fs.existsSync(jsPath)) {
    try {
      new Function(fs.readFileSync(jsPath, 'utf8'));
    } catch (e) {
      problems.push(item.folder + '：demo.js 语法错误（' + e.message + '）');
    }
  }

  /* ---------- 生成插件注册器 ---------- */
  var pluginDef = JSON.parse(JSON.stringify(def));
  var key = pluginDef.id;
  var label = demo.label || '可运行示范';
  var intro = demo.intro || '';
  var height = Number(demo.height) || 0;
  pluginDef.tabs = pluginDef.tabs || {};
  pluginDef.tabs.demo = { __generated: true };
  pluginDef.status = pluginDef.status || 'ready';

  var defText = JSON.stringify(pluginDef, null, 2);
  var out =
    '/* =========================================================\n' +
    '   自动生成：' + item.folder + '/case.json → 站点插件注册器\n' +
    '   不要手改本文件；改 case.json 或 demo/*，再跑 node tools/build-cases.js\n' +
    '   ========================================================= */\n' +
    '(function () {\n' +
    '  \'use strict\';\n' +
    '  var def = ' + defText + ';\n' +
    '  var key = ' + JSON.stringify(key) + ';\n' +
    '  def.tabs = def.tabs || {};\n' +
    '  def.tabs.demo = {\n' +
    '    label: ' + JSON.stringify(label) + ',\n' +
    '    intro: ' + JSON.stringify(intro) + ',\n' +
    '    mode: \'module\',\n' +
    '    mount: function (root) {\n' +
    '      root.innerHTML = \'\';\n' +
    '      if (' + (height ? 'true' : 'false') + ') root.style.minHeight = ' + (height || 0) + ' + \'px\';\n' +
    '      var fn = window.__IQ_DEMOS__ && window.__IQ_DEMOS__[key];\n' +
    '      if (typeof fn !== \'function\') {\n' +
    '        root.innerHTML = \'<div class="iq-miss"><b>示范脚本未加载</b><br>请确认 index.html 中已引入 \' +\n' +
    '          ' + JSON.stringify(item.folder + '/demo/demo.js') + ' + \'，且位于 shell.js 之前。</div>\';\n' +
    '        return;\n' +
    '      }\n' +
    '      root.__iqLive = fn(root);\n' +
    '    },\n' +
    '    unmount: function () {\n' +
    '      var root = document.getElementById(\'case-demo-root\');\n' +
    '      var live = root && root.__iqLive;\n' +
    '      if (live && typeof live.unmount === \'function\') { try { live.unmount(); } catch (e) { } }\n' +
    '      if (root) root.__iqLive = null;\n' +
    '    }\n' +
    '  };\n' +
    '  Cases.register(def);\n' +
    '})();\n';

  fs.writeFileSync(path.join(ROOT, 'assets', 'cases', key + '.case.js'), out, 'utf8');

  report.push({
    id: key,
    sceneId: def.sceneId,
    folder: item.folder,
    zip: item.zip,
    hasDemo: fs.existsSync(path.join(demoDir, 'index.html')),
    files: fs.readdirSync(pkgDir).filter(function (f) { return f === 'case.json'; }).length +
      fs.readdirSync(demoDir).filter(function (f) {
        return ['index.html', 'demo.css', 'demo.js', 'd3.v7.min.js', 'iq-viz.js', 'iq-smart.js'].indexOf(f) >= 0;
      }).length
  });
});

/* ---------- 报告 ---------- */
console.log('\n案例包构建报告');
console.log('------------------------------------------------------------');
report.forEach(function (r, i) {
  console.log((i + 1) + '. ' + r.folder + '  →  ' + r.id + '  [' + r.sceneId + ']  ' + (r.hasDemo ? 'demo/ok' : 'demo/missing') + '  ' + r.files + '/7 文件');
  console.log('   zip: ' + r.zip);
});
if (problems.length) {
  console.log('\n发现 ' + problems.length + ' 个问题：');
  problems.forEach(function (p) { console.log('  ✗ ' + p); });
  process.exitCode = 1;
} else {
  console.log('\n✓ 全部通过：6 个案例包与插件注册器已同步。');
}
