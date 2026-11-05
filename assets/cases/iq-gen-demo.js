/* =========================================================
   跨环节案例 · 共享示范渲染器
   ---------------------------------------------------------
   九个新案例（g1 / s3 / d1 / m1 / c1 / p3 / wo1 / t1 / r2）
   共用这一份“图表 + 滑杆 + 指标 + 结论”的平面（2D SVG）版式。

   对外只暴露 window.IQGen：
     · demo(root, cfg, def)       渲染整块可运行示范
     · fieldSVG(kind)             专业背景用的油田现场示意图
     · flowSVG(steps)             专业背景用的算法链路图
     · barFig(items, opts)        正文里的小型条形图
   不依赖 D3，所有图形由字符串拼成，离线可用。
   ========================================================= */

(function (global) {
  'use strict';

  var C = {
    ink: '#2f3a3f', ink2: '#56616a', ink3: '#79828a', dim: '#9ba3a9',
    line: '#e9e4d8', line2: '#f0ece1', paper: '#fbfaf6',
    jade: '#3a352d', clay: '#b26a39', red: '#a03d4f',
    amber: '#a9852f', blue: '#5d7fa3', green: '#4c8a72'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, d) { return Number(v).toFixed(d == null ? 0 : d); }
  function svgHead(w, h, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      esc(label || '图') + '">';
  }
  function txt(x, y, s, size, fill, anchor, weight) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 9.5) + '" fill="' + (fill || C.ink3) + '"' +
      (anchor ? ' text-anchor="' + anchor + '"' : '') +
      (weight ? ' font-weight="' + weight + '"' : '') + '>' + esc(s) + '</text>';
  }
  function mono(x, y, s, size, fill, anchor) {
    return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 8.5) + '" fill="' + (fill || C.dim) +
      '" font-family="ui-monospace,Consolas,monospace"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' +
      esc(s) + '</text>';
  }

  /* ---------- 随机数：同样的种子 → 同样的图 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gaussOf(r) {
    return function () {
      var u = 0, v = 0;
      while (u === 0) u = r();
      while (v === 0) v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
  }

  /* ---------- 颜色插值 ---------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
      Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
      Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function ramp(stops, t) {
    t = clamp(t, 0, 1);
    var seg = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(seg));
    return mix(stops[i], stops[i + 1], seg - i);
  }

  /* =========================================================
     一、专业背景插图：油田现场示意
     ---------------------------------------------------------
     每张图都是 640×214 的平面示意，风格与站内其他插图一致。
     ========================================================= */
  function fieldSVG(kind) {
    var s = svgHead(640, 214, '现场示意：' + kind);
    s += '<rect x="0" y="0" width="640" height="214" fill="#ffffff"/>';

    if (kind === 'geology') {
      s += txt(14, 18, '遥感影像解译 · 1:5 万图幅', 9.5, C.dim);
      s += '<rect x="14" y="30" width="392" height="150" fill="#e8e1d1" stroke="#ddd6c4"/>';
      s += '<path d="M14 84 L406 66" stroke="#cfc4ab" stroke-width="12" fill="none"/>';
      s += '<path d="M14 118 L406 104" stroke="#c3b697" stroke-width="14" fill="none"/>';
      s += '<path d="M70 180 L118 30 L188 30 L232 180 Z" fill="#b9a98b" opacity=".55"/>';
      s += '<path d="M300 180 L340 30 L406 30 L406 96 Z" fill="#cdbf9f" opacity=".6"/>';
      // 网格
      for (var gx = 14; gx <= 406; gx += 49) {
        s += '<line x1="' + gx + '" y1="30" x2="' + gx + '" y2="180" stroke="#ffffff" stroke-width=".7" opacity=".7"/>';
      }
      for (var gy = 30; gy <= 180; gy += 30) {
        s += '<line x1="14" y1="' + gy + '" x2="406" y2="' + gy + '" stroke="#ffffff" stroke-width=".7" opacity=".7"/>';
      }
      // 断层（红色）与解释界线
      s += '<path d="M250 30 L216 96 L268 146 L246 180" stroke="#a03d4f" stroke-width="1.6" fill="none"/>';
      s += '<path d="M14 102 L406 92" stroke="#3a352d" stroke-width="1.4" fill="none"/>';
      s += '<path d="M120 180 L150 30" stroke="#3a352d" stroke-width="1.2" stroke-dasharray="4 3" fill="none"/>';
      s += txt(256, 196, '影像底图', 9, C.dim);

      // 右侧矢量面板
      s += '<rect x="424" y="30" width="202" height="150" fill="#fbfaf6" stroke="#e9e4d8"/>';
      s += txt(438, 48, '解译矢量图层', 10.5, C.ink, null, 600);
      s += '<path d="M446 142 L470 62 L520 58 L540 140 Z" fill="#c99a56" opacity=".5" stroke="#3a352d" stroke-width=".9"/>';
      s += '<path d="M546 142 L566 70 L606 64 L614 140 Z" fill="#6b89a3" opacity=".45" stroke="#3a352d" stroke-width=".9"/>';
      s += '<path d="M470 62 L520 58 L566 70 L606 64" fill="none" stroke="#3a352d" stroke-width="1.2"/>';
      s += '<path d="M446 142 L614 140" fill="none" stroke="#3a352d" stroke-width="1.2"/>';
      s += '<path d="M500 150 L486 166 L534 170" stroke="#a03d4f" stroke-width="1.4" fill="none"/>';
      s += txt(438, 166, '① 岩性界线  ② 断层', 9, C.ink3);
      s += txt(438, 180, '可直接入库的矢量图元', 8.5, C.dim);

      s += '<path d="M412 106 h8 m-3 -3 l3 3 l-3 3" stroke="' + C.clay + '" stroke-width="1.2" fill="none"/>';
      s += txt(14, 208, '同一幅影像，两位解释员勾绘的界线可相差 80—120 m；植被与风化层覆盖区更容易漏判。', 9, C.ink3);
    }

    if (kind === 'seismic') {
      s += txt(14, 18, '炮集记录 · 初至拾取', 9.5, C.dim);
      s += '<line x1="20" y1="44" x2="620" y2="44" stroke="#d9d2c1" stroke-width="1"/>';
      s += '<path d="M42 44 l-9 8 h18 z" fill="#b26a39"/>';
      s += mono(20, 68, '炮点', 8.5, C.clay);
      var tX = [110, 158, 206, 254, 302, 350, 398, 446, 494, 542, 590];
      for (var i = 0; i < tX.length; i++) {
        s += '<path d="M' + tX[i] + ' 44 l-5 7 h10 z" fill="#56616a"/>';
        s += '<line x1="42" y1="44" x2="' + tX[i] + '" y2="44" stroke="#e2dccb" stroke-width=".8"/>';
      }
      s += mono(590, 68, '检波点', 8.5, C.ink3);

      var r = mulberry32(17);
      for (var k = 0; k < tX.length; k++) {
        var x0 = tX[k], t0 = 118 + k * 17;
        var pts = [];
        for (var j = 0; j <= 60; j++) {
          var tt = j / 60 * 150 + 44;
          var amp = Math.exp(-Math.pow((tt - t0) / 9, 2)) * 14 * Math.sin((tt - t0) * 1.4);
          amp += (r() - 0.5) * 3;
          pts.push((x0 + amp).toFixed(1) + ',' + tt.toFixed(1));
        }
        s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#3a352d" stroke-width=".8" opacity=".87"/>';
        s += '<circle cx="' + x0 + '" cy="' + t0 + '" r="2" fill="#b26a39"/>';
      }
      s += '<path d="M110 118 L590 288" stroke="#b26a39" stroke-width="1.2" stroke-dasharray="4 3" fill="none"/>';
      s += mono(596, 300, '初至', 9, C.clay);
      s += txt(14, 208, '低信噪比道（远偏移距、表层复杂区）上，面波与折射干扰常把初至“藏”起来。', 9, C.ink3);
    }

    if (kind === 'drilling') {
      s += txt(14, 18, '钻机 · 钻头 · 参数闭环', 9.5, C.dim);
      // 地层
      s += '<rect x="14" y="122" width="398" height="18" fill="#e7dfcd"/>';
      s += '<rect x="14" y="140" width="398" height="22" fill="#d9cdb4"/>';
      s += '<rect x="14" y="162" width="398" height="22" fill="#cfc0a3"/>';
      s += '<rect x="14" y="184" width="398" height="16" fill="#c2b38f"/>';
      // 井架
      s += '<path d="M96 122 L126 34 L156 122" fill="none" stroke="#56616a" stroke-width="1.6"/>';
      s += '<path d="M96 122 L156 122" stroke="#56616a" stroke-width="1.2"/>';
      s += '<path d="M96 122 L126 34 L156 122 M108 92 L144 92 M118 64 L134 64" stroke="#8d979d" stroke-width=".8" fill="none"/>';
      // 钻杆
      s += '<line x1="126" y1="52" x2="126" y2="196" stroke="#3a352d" stroke-width="3"/>';
      s += '<rect x="119" y="190" width="14" height="10" rx="2" fill="#b26a39"/>';
      s += '<path d="M112 200 l-7 8 M140 200 l7 8" stroke="#b26a39" stroke-width=".9"/>';
      s += mono(66, 44, '钻压 WOB', 8.5, C.ink3);
      s += mono(66, 58, '转速 RPM', 8.5, C.ink3);
      s += '<path d="M176 130 C214 126 226 112 246 108" stroke="#4c8a72" stroke-width="1" fill="none" stroke-dasharray="3 2"/>';
      s += mono(150, 106, '钻井液返出', 8.5, C.green);

      // 右侧 ROP 小图
      s += '<rect x="424" y="30" width="202" height="150" fill="#fbfaf6" stroke="#e9e4d8"/>';
      s += mono(438, 48, 'ROP / (m·h⁻¹)', 8, C.dim);
      s += '<path d="M446 84 C470 92 486 112 502 118 S540 96 560 90 S590 78 612 74" fill="none" stroke="#3a352d" stroke-width="1.2"/>';
      s += '<line x1="446" y1="118" x2="612" y2="118" stroke="#e9e4d8"/>';
      s += '<line x1="452" y1="104" x2="606" y2="104" stroke="#b26a39" stroke-width=".9" stroke-dasharray="3 3"/>';
      s += mono(438, 136, '保守参数', 8.5, C.clay);
      s += mono(438, 150, '推荐窗口', 8.5, C.ink2);
      s += mono(438, 168, '地层变化后需重算', 8, C.dim);
      s += txt(14, 208, '司钻看的是扭矩、泵压与返出；模型看的是同一组参数下钻速的包络。', 9, C.ink3);
    }

    if (kind === 'mudlog') {
      s += txt(14, 18, '岩屑录井 · 捞样与描述', 9.5, C.dim);
      // 振动筛
      s += '<rect x="16" y="64" width="150" height="64" rx="6" fill="#f3efe4" stroke="#d8d2c1"/>';
      s += '<path d="M26 78 L148 96 M26 94 L148 112" stroke="#8d979d" stroke-width="1"/>';
      s += '<path d="M84 128 L84 150" stroke="#b26a39" stroke-width="1.2"/>';
      s += mono(26, 58, '振动筛', 9, C.ink3);
      // 样品盘
      s += '<rect x="184" y="82" width="112" height="70" rx="5" fill="#fbfaf6" stroke="#d8d2c1"/>';
      var cols = ['#c99a56', '#a3855f', '#6b89a3', '#cfae7c', '#8f9aa6', '#a3855f'];
      for (var mi = 0; mi < 6; mi++) {
        s += '<circle cx="' + (200 + (mi % 3) * 32) + '" cy="' + (102 + Math.floor(mi / 3) * 30) + '" r="7" fill="' + cols[mi] + '" opacity=".85"/>';
      }
      s += mono(188, 168, '每 1—2 m 捞样一次', 8.5, C.dim);
      // 显微镜视野
      s += '<circle cx="404" cy="116" r="54" fill="#f7f5ee" stroke="#d8d2c1"/>';
      s += '<circle cx="404" cy="116" r="46" fill="none" stroke="#e3ddd0"/>';
      s += '<circle cx="388" cy="106" r="9" fill="#c99a56"/>';
      s += '<circle cx="414" cy="104" r="7" fill="#6b89a3"/>';
      s += '<circle cx="422" cy="128" r="8" fill="#a3855f"/>';
      s += '<circle cx="394" cy="134" r="6" fill="#cfae7c"/>';
      s += '<circle cx="408" cy="118" r="5" fill="#8f9aa6"/>';
      s += mono(356, 188, '镜下：成分 / 粒级 / 含油', 8.5, C.ink3);
      s += '<path d="M300 116 h24 m-4 -4 l4 4 l-4 4" stroke="#c9c2b0" stroke-width="1.2" fill="none"/>';
      s += '<path d="M458 116 h18" stroke="#c9c2b0" stroke-width="1.2"/>';
      s += txt(470, 70, '人工目估', 9, C.clay);
      s += txt(470, 84, '同一块样品', 8.5, C.ink3);
      s += txt(470, 96, '可差一个粒级', 8.5, C.ink3);
      s += txt(14, 208, '洗样、混样与污染会直接变成标签噪声；分组必须按“样品处理批次”，不能按图像随机划分。', 9, C.ink3);
    }

    if (kind === 'cement') {
      s += txt(14, 18, '固井质量 · CBL / VDL 评价', 9.5, C.dim);
      // 地层
      s += '<rect x="120" y="30" width="220" height="160" fill="#e8e1d1"/>';
      // 井筒
      s += '<rect x="206" y="30" width="48" height="160" fill="#d9cdb4"/>';
      s += '<rect x="210" y="30" width="6" height="160" fill="#8d979d"/>';
      s += '<rect x="244" y="30" width="6" height="160" fill="#8d979d"/>';
      // 水泥环：好段与差段
      s += '<rect x="198" y="30" width="8" height="84" fill="#b9c6b4"/>';
      s += '<rect x="252" y="30" width="8" height="84" fill="#b9c6b4"/>';
      s += '<rect x="198" y="114" width="8" height="46" fill="#f4dfd8"/>';
      s += '<rect x="252" y="114" width="8" height="46" fill="#f4dfd8"/>';
      s += '<rect x="198" y="160" width="8" height="30" fill="#b9c6b4"/>';
      s += '<rect x="252" y="160" width="8" height="30" fill="#b9c6b4"/>';
      // 仪器
      s += '<rect x="218" y="36" width="24" height="58" rx="4" fill="#fbfaf6" stroke="#56616a"/>';
      s += '<rect x="218" y="100" width="24" height="50" rx="4" fill="#fbfaf6" stroke="#56616a"/>';
      s += mono(146, 118, '微环隙', 8.5, C.red);
      s += mono(272, 64, '胶结好', 8.5, C.green);
      // 右侧曲线
      s += '<rect x="394" y="30" width="232" height="160" fill="#fbfaf6" stroke="#e9e4d8"/>';
      s += mono(408, 48, '胶结指数 / %', 8, C.dim);
      s += '<line x1="408" y1="152" x2="610" y2="152" stroke="#e9e4d8"/>';
      var cbl = [86, 84, 88, 80, 76, 34, 22, 28, 74, 78, 70, 52, 46];
      for (var ci = 0; ci < cbl.length; ci++) {
        s += '<line x1="' + (408 + ci * 16) + '" y1="60" x2="' + (408 + ci * 16) + '" y2="' + (60 + cbl[ci] * 1.05) + '" stroke="' + (cbl[ci] < 40 ? C.red : C.jade) + '" stroke-width="3"/>';
      }
      s += '<line x1="408" y1="' + (60 + 45 * 1.05) + '" x2="610" y2="' + (60 + 45 * 1.05) + '" stroke="#b26a39" stroke-width=".9" stroke-dasharray="3 3"/>';
      s += mono(408, 178, '不合格段 → 挤水泥决策', 8.5, C.clay);
      s += txt(14, 208, '评价不是“好 / 坏”两档：优质、合格、不合格三档之间，还有快速地层与微环隙这类需要单独样本的情况。', 9, C.ink3);
    }

    if (kind === 'perforation') {
      s += txt(14, 18, '射孔 · 弹型与套管', 9.5, C.dim);
      s += '<rect x="120" y="30" width="300" height="160" fill="#e8e1d1"/>';
      s += '<rect x="196" y="30" width="10" height="160" fill="#8d979d"/>';
      s += '<rect x="334" y="30" width="10" height="160" fill="#8d979d"/>';
      s += '<rect x="200" y="30" width="140" height="160" fill="#f4f1e6"/>';
      // 射孔孔眼 + 隧道
      for (var pi = 0; pi < 3; pi++) {
        var py = 62 + pi * 44;
        s += '<rect x="334" y="' + (py - 4) + '" width="10" height="10" fill="#b26a39"/>';
        s += '<path d="M344 ' + (py + 1) + ' L396 ' + (py - 8) + ' L420 ' + (py + 2) + ' L396 ' + (py + 12) + ' Z" fill="#b26a39" opacity=".55"/>';
        s += '<path d="M396 ' + (py - 8) + ' L420 ' + (py + 2) + ' L396 ' + (py + 12) + '" stroke="#8e5229" stroke-width=".8" fill="none"/>';
      }
      // 弹
      s += '<rect x="226" y="86" width="26" height="46" rx="4" fill="#3a352d"/>';
      s += '<path d="M252 96 L268 108 L252 120" fill="#b26a39"/>';
      s += mono(228, 78, '射孔弹', 8.5, C.ink3);
      s += mono(352, 54, '穿深 / 孔径', 8.5, C.clay);
      s += mono(352, 194, '套管损伤', 8.5, C.red);
      s += txt(14, 208, '穿深、孔径与套管损伤三者互相牵制：追求穿深往往加大损伤，选型要按井况做硬约束。', 9, C.ink3);
    }

    if (kind === 'workover') {
      s += txt(14, 18, '修井 · 故障与工具组合', 9.5, C.dim);
      s += '<rect x="60" y="30" width="180" height="160" fill="#e8e1d1"/>';
      // 井架
      s += '<path d="M96 30 L126 4 L156 30" stroke="#56616a" stroke-width="1.6" fill="none"/>';
      s += '<line x1="126" y1="8" x2="126" y2="196" stroke="#3a352d" stroke-width="3"/>';
      s += '<line x1="206" y1="30" x2="206" y2="196" stroke="#56616a" stroke-width="2"/>';
      s += '<rect x="198" y="30" width="16" height="14" fill="#8d979d"/>';
      // 落物
      s += '<path d="M198 166 L214 160 L210 176 L202 178 Z" fill="#a03d4f"/>';
      s += mono(222, 174, '落物', 8.5, C.red);
      // 打捞筒
      s += '<rect x="232" y="120" width="26" height="40" rx="4" fill="#fbfaf6" stroke="#56616a"/>';
      s += '<path d="M238 120 L238 100 M252 120 L252 100" stroke="#56616a"/>';
      s += mono(226, 92, '打捞筒', 8.5, C.ink3);
      // 右侧选项
      s += '<rect x="304" y="30" width="322" height="160" fill="#fbfaf6" stroke="#e9e4d8"/>';
      var opts = ['打捞落物', '套管整形', '堵水', '解卡', '侧钻'];
      for (var wi = 0; wi < opts.length; wi++) {
        s += '<rect x="320" y="' + (42 + wi * 28) + '" width="286" height="20" rx="4" fill="#f4f1e6" stroke="#e6e0d2"/>';
        s += mono(330, (56 + wi * 28), opts[wi], 9, C.ink2);
        s += mono(594, (56 + wi * 28), ['成本 / 工期 / 成功率'][0], 7.5, C.dim);
      }
      s += txt(14, 208, '同类故障在不同井上的处理方式差异很大，方案库的价值在于把“上一次怎么做的、效果如何”变成可检索的案例。', 9, C.ink3);
    }

    if (kind === 'pipeline') {
      s += txt(14, 18, '长输管道 · 压力与流量监测', 9.5, C.dim);
      s += '<path d="M14 150 L626 150" stroke="#cfc8b6" stroke-width="1"/>';
      s += '<path d="M40 128 L72 128 L82 112 L112 112 L122 128 L156 128" fill="none" stroke="#8d979d" stroke-width="2"/>';
      s += '<path d="M170 118 L420 118" stroke="#56616a" stroke-width="5" stroke-linecap="round"/>';
      s += '<path d="M420 118 L520 118" stroke="#a03d4f" stroke-width="5" stroke-linecap="round"/>';
      s += '<rect x="250" y="106" width="26" height="24" rx="3" fill="#fbfaf6" stroke="#56616a"/>';
      s += mono(240, 100, '泵站', 8.5, C.ink3);
      s += '<rect x="348" y="104" width="18" height="18" rx="2" fill="#fbfaf6" stroke="#56616a"/>';
      s += mono(336, 98, '阀', 8.5, C.ink3);
      // 泄漏
      s += '<path d="M440 118 l-12 -14 M440 118 l-18 -8 M440 118 l-8 -20" stroke="#a03d4f" stroke-width="1.4"/>';
      s += mono(452, 104, '渗漏', 9, C.red);
      // 压力曲线
      s += '<rect x="170" y="30" width="380" height="56" fill="#fbfaf6" stroke="#e9e4d8"/>';
      s += '<path d="M178 66 C220 64 250 62 290 64 S350 68 390 70 L424 72 L440 54 L470 58 L520 62 L542 64" fill="none" stroke="#3a352d" stroke-width="1.1"/>';
      s += '<line x1="178" y1="76" x2="542" y2="76" stroke="#b26a39" stroke-width=".8" stroke-dasharray="3 3"/>';
      s += mono(180, 44, '压力残差 / kPa', 8, C.dim);
      s += mono(512, 44, '报警线', 8, C.clay);
      s += txt(14, 208, '小流量渗漏不会产生明显负压波；调阀、启停泵的扰动却很像泄漏，所以误报抑制比灵敏度更难。', 9, C.ink3);
    }

    if (kind === 'refinery') {
      s += txt(14, 18, '催化裂化 · 反应—分馏', 9.5, C.dim);
      // 提升管
      s += '<rect x="150" y="66" width="34" height="120" rx="6" fill="#f3efe4" stroke="#8d979d"/>';
      s += '<rect x="150" y="30" width="34" height="40" rx="8" fill="#e4ddd0" stroke="#8d979d"/>';
      s += mono(128, 52, '提升管', 8.5, C.ink3);
      // 再生器
      s += '<rect x="208" y="46" width="64" height="62" rx="10" fill="#efe9db" stroke="#8d979d"/>';
      s += mono(210, 38, '再生器', 8.5, C.ink3);
      s += '<path d="M184 76 C198 62 200 58 208 56" stroke="#b26a39" stroke-width="1" fill="none"/>';
      // 分馏塔
      s += '<rect x="330" y="26" width="76" height="170" rx="8" fill="#fbfaf6" stroke="#8d979d"/>';
      for (var ti = 0; ti < 5; ti++) {
        s += '<line x1="336" y1="' + (56 + ti * 26) + '" x2="400" y2="' + (56 + ti * 26) + '" stroke="#e3ddd0"/>';
      }
      s += mono(334, 20, '分馏塔', 8.5, C.ink3);
      // 产品出口
      var prods = ['干气', '液化气', '汽油', '柴油', '油浆'];
      for (var qi = 0; qi < prods.length; qi++) {
        var qy = 50 + qi * 30;
        s += '<path d="M406 ' + qy + ' L446 ' + qy + ' m-4 -4 l4 4 l-4 4" stroke="#56616a" stroke-width="1.1" fill="none"/>';
        s += mono(454, qy + 3, prods[qi], 9, C.ink2);
      }
      // 原料
      s += '<path d="M60 150 L150 150 m-4 -4 l4 4 l-4 4" stroke="#b26a39" stroke-width="1.2" fill="none"/>';
      s += mono(58, 142, '原料油', 8.5, C.clay);
      s += txt(14, 208, '产品分布随原料性质与反应温度连续变化；排产优化要的是“趋势 + 约束”，不是一次性的收率数字。', 9, C.ink3);
    }

    s += '</svg>';
    return s;
  }

  /* =========================================================
     二、专业背景插图：算法链路
     ---------------------------------------------------------
     steps = [[标题, 说明, 色], ...]，4—6 步。
     ========================================================= */
  function flowSVG(steps, opts) {
    opts = opts || {};
    var n = steps.length, W = 640, H = opts.h || 138;
    var gap = 14, x0 = 8, w = (W - x0 * 2 - gap * (n - 1)) / n;
    var s = svgHead(W, H, opts.label || '算法链路');
    var pal = ['#3a352d', '#8a4b2d', '#5d7fa3', '#7e5a8d', '#6f7430', '#a03d4f'];
    var bg = ['#f8f1e8', '#f8ecdf', '#e8eef9', '#efe9f4', '#f1f1dd', '#f9e9e5'];
    steps.forEach(function (st, i) {
      var col = st[2] || pal[i % pal.length];
      var b = bg[i % bg.length];
      s += '<rect x="' + (x0 + i * (w + gap)) + '" y="30" width="' + w + '" height="76" rx="8" fill="' + b + '" stroke="' + col + '" stroke-opacity=".28"/>';
      s += '<rect x="' + (x0 + i * (w + gap)) + '" y="30" width="3" height="76" rx="1.5" fill="' + col + '"/>';
      s += txt(x0 + i * (w + gap) + 12, 51, st[0], 11, '#242a32', null, 600);
      st[1].split(' · ').forEach(function (line, k) {
        s += txt(x0 + i * (w + gap) + 12, 68 + k * 14, line, 8.7, C.ink3);
      });
      s += mono(x0 + (i + 1) * (w + gap) - 12, 99, '0' + (i + 1), 8, col, 'end');
      if (i < n - 1) {
        s += '<path d="M' + (x0 + (i + 1) * (w + gap) - 10) + ' 68 h6 m-2.6 -2.8 l2.8 2.8 l-2.8 2.8" stroke="#c9c2b0" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
      }
    });
    s += mono(8, 20, (opts.tag || 'PIPELINE'), 9, C.dim);
    if (opts.note) s += txt(8, 124, opts.note, 9.5, C.ink3);
    s += '</svg>';
    return s;
  }

  /* =========================================================
     三、正文里的小型条形图
     ========================================================= */
  function barFig(items, opts) {
    opts = opts || {};
    var W = 600, H = opts.h || (34 + items.length * 22 + 18);
    var x0 = 132, x1 = 522, max = opts.max || Math.max.apply(null, items.map(function (d) { return d.v; }));
    var s = svgHead(W, H, opts.label || '指标对比');
    items.forEach(function (d, i) {
      var y = 22 + i * 22;
      s += txt(0, y + 8, d.n, 9.5, C.ink3);
      var bw = (x1 - x0) * clamp(d.v / max, 0, 1);
      s += '<rect x="' + x0 + '" y="' + (y + 2) + '" width="' + (x1 - x0) + '" height="9" rx="4" fill="#f2efe6"/>';
      s += '<rect x="' + x0 + '" y="' + (y + 2) + '" width="' + bw.toFixed(1) + '" height="9" rx="4" fill="' + (d.c || C.jade) + '"/>';
      s += mono(x1 + 8, y + 10, num(d.v, opts.d == null ? 0 : opts.d) + (opts.unit || ''), 9, C.ink2);
    });
    s += '</svg>';
    return s;
  }

  /* =========================================================
     四、图表绘制
     ========================================================= */

  /* ---- 条形：排名 / 得分 ---- */
  function chartBars(cfg) {
    var items = cfg.items || [];
    var W = 640, rowH = 42, x0 = 156, x1 = 588, y0 = 44;
    var H = y0 + items.length * rowH + 34;
    var max = cfg.max || Math.max.apply(null, items.map(function (d) { return d.value; }).concat([1]));
    var s = svgHead(W, H, cfg.label || '排名条形图');
    s += mono(x0, 24, cfg.xLabel || '相对数值', 8.5, C.dim);
    for (var t = 0; t <= 4; t++) {
      var gx = x0 + (x1 - x0) * t / 4;
      s += '<line x1="' + gx + '" y1="30" x2="' + gx + '" y2="' + (H - 22) + '" stroke="#f2eee4" stroke-width=".8"/>';
      s += mono(gx, H - 10, num(max * t / 4, max >= 10 ? 0 : 1), 8, C.dim, 'middle');
    }
    items.forEach(function (d, i) {
      var y = y0 + i * rowH;
      var bw = (x1 - x0) * clamp(d.value / max, 0, 1);
      var col = d.bad ? '#cfc8b6' : (d.color || C.jade);
      s += txt(10, y + 15, d.name, 11, d.bad ? C.dim : C.ink, null, 600);
      if (d.note) s += txt(10, y + 29, d.note, 8.6, C.dim);
      s += '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + (x1 - x0) + '" height="13" rx="6" fill="#f4f1e9"/>';
      s += '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + bw.toFixed(1) + '" height="13" rx="6" fill="' + col + '"/>';
      s += mono(x1 + 8, y + 15, (d.text != null ? d.text : num(d.value, cfg.digits == null ? 0 : cfg.digits)) + (cfg.unit || ''), 9.5, d.bad ? C.dim : C.ink2);
      if (d.bad) s += mono(x1 - 18, y + 15, '×', 11, C.red, 'end');
      if (d.hl) s += '<rect x="' + (x0 - 4) + '" y="' + (y + 1) + '" width="' + (x1 - x0 + 8) + '" height="19" rx="6" fill="none" stroke="' + C.jade + '" stroke-opacity=".35"/>';
    });
    if (cfg.threshold) {
      var tx = x0 + (x1 - x0) * clamp(cfg.threshold.value / max, 0, 1);
      s += '<line x1="' + tx + '" y1="26" x2="' + tx + '" y2="' + (H - 20) + '" stroke="' + C.clay + '" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += mono(tx + 4, 22, cfg.threshold.label, 8.5, C.clay);
    }
    s += '</svg>';
    return s;
  }

  /* ---- 热力：二维网格 ---- */
  function chartHeat(cfg) {
    var W = 640, H = 356, x0 = 86, x1 = 600, y0 = 36, y1 = 286;
    var rows = cfg.y.length, cols = cfg.x.length;
    var cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    var s = svgHead(W, H, cfg.label || '二维热力图');
    s += mono(x0, 22, cfg.xLabel || '', 8.5, C.dim);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var v = cfg.values[r][c];
        var t = (v - cfg.min) / Math.max(1e-6, cfg.max - cfg.min);
        var col = ramp(cfg.scale || ['#fbf8f0', '#ecd9b6', '#c08a4e', '#a85f2e'], t);
        s += '<rect x="' + (x0 + c * cw) + '" y="' + (y0 + r * ch) + '" width="' + (cw + .6) + '" height="' + (ch + .6) + '" fill="' + col + '"/>';
      }
    }
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="none" stroke="' + C.line + '"/>';
    for (var rr = 0; rr < rows; rr++) {
      s += mono(x0 - 6, y0 + rr * ch + ch / 2 + 3, cfg.y[rr], 8.5, C.ink3, 'end');
    }
    for (var cc = 0; cc < cols; cc++) {
      s += mono(x0 + cc * cw + cw / 2, y1 + 16, cfg.x[cc], 8.5, C.ink3, 'middle');
    }
    s += mono(x1, y1 + 34, cfg.xAxis || '', 8.5, C.dim, 'end');
    (cfg.markers || []).forEach(function (m) {
      var mx = x0 + (m.x + .5) * cw, my = y0 + (m.y + .5) * ch;
      if (m.kind === 'ring') {
        s += '<circle cx="' + mx + '" cy="' + my + '" r="8" fill="none" stroke="' + (m.color || C.jade) + '" stroke-width="2"/>';
      } else {
        s += '<circle cx="' + mx + '" cy="' + my + '" r="5.5" fill="' + (m.color || C.clay) + '"/>';
        s += '<circle cx="' + mx + '" cy="' + my + '" r="2.4" fill="#fff"/>';
      }
      if (m.label) s += mono(mx + 9, my - 7, m.label, 8.5, m.color || C.ink3);
    });
    s += '</svg>';
    return s;
  }

  /* ---- 分类栅格：遥感解译 / 概率阈值 ---- */
  function chartGrid(cfg) {
    var W = 640, H = 330, x0 = 20, x1 = 560, y0 = 34, y1 = 284;
    var rows = cfg.cells.length, cols = cfg.cells[0].length;
    var cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
    var s = svgHead(W, H, cfg.label || '分类结果栅格');
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = cfg.cells[r][c];
        var col = cell.accept ? cfg.palette[cell.cls] : '#f0ede4';
        s += '<rect x="' + (x0 + c * cw) + '" y="' + (y0 + r * ch) + '" width="' + (cw + .5) + '" height="' + (ch + .5) + '" fill="' + col + '"/>';
        if (!cell.accept) {
          s += '<circle cx="' + (x0 + c * cw + cw / 2) + '" cy="' + (y0 + r * ch + ch / 2) + '" r="1.1" fill="#c9c2b0"/>';
        }
      }
    }
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="none" stroke="' + C.line + '"/>';
    (cfg.boundaries || []).forEach(function (pl) {
      var pts = pl.map(function (p) {
        return (x0 + p[0] * cw).toFixed(1) + ',' + (y0 + p[1] * ch).toFixed(1);
      }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="#2f3a3f" stroke-width="1.3" stroke-dasharray="4 3"/>';
    });
    if (cfg.truthNote) s += mono(x0, 18, cfg.truthNote, 8.5, C.dim);
    // 图例
    var lx = 578, ly = y0 + 6;
    (cfg.legend || []).forEach(function (l, i) {
      s += '<rect x="' + lx + '" y="' + (ly + i * 20) + '" width="10" height="10" rx="2" fill="' + l.color + '"/>';
      s += mono(lx + 15, ly + i * 20 + 9, l.short, 8.5, C.ink3);
    });
    s += mono(x1, y1 + 24, '列 →  东', 8.5, C.dim, 'end');
    s += mono(x0 - 6, y1 + 24, '行 ↓  南', 8.5, C.dim);
    s += '</svg>';
    return s;
  }

  /* ---- 曲线：多系列 ---- */
  function chartLine(cfg) {
    var W = 640, H = 356, x0 = 70, x1 = 610, y0 = 34, y1 = 286;
    var s = svgHead(W, H, cfg.label || '曲线图');
    var xd = cfg.xDomain, yd = cfg.yDomain;
    function X(v) { return x0 + (v - xd[0]) / (xd[1] - xd[0]) * (x1 - x0); }
    function Y(v) { return y1 - (v - yd[0]) / (yd[1] - yd[0]) * (y1 - y0); }

    for (var t = 0; t <= 5; t++) {
      var gx = x0 + (x1 - x0) * t / 5, gy = y0 + (y1 - y0) * t / 5;
      s += '<line x1="' + gx + '" y1="' + y0 + '" x2="' + gx + '" y2="' + y1 + '" stroke="#f2eee4" stroke-width=".8"/>';
      s += '<line x1="' + x0 + '" y1="' + gy + '" x2="' + x1 + '" y2="' + gy + '" stroke="#f2eee4" stroke-width=".8"/>';
      s += mono(gx, y1 + 16, cfg.fmtX ? cfg.fmtX(xd[0] + (xd[1] - xd[0]) * t / 5) : num(xd[0] + (xd[1] - xd[0]) * t / 5), 8.5, C.ink3, 'middle');
      s += mono(x0 - 8, gy + 3, cfg.fmtY ? cfg.fmtY(yd[1] - (yd[1] - yd[0]) * t / 5) : num(yd[1] - (yd[1] - yd[0]) * t / 5), 8.5, C.ink3, 'end');
    }
    if (cfg.band) {
      var by1 = Y(cfg.band.from), by2 = Y(cfg.band.to);
      s += '<rect x="' + x0 + '" y="' + Math.min(by1, by2) + '" width="' + (x1 - x0) + '" height="' + Math.abs(by2 - by1) + '" fill="' + (cfg.band.color || '#f9ecdf') + '" opacity=".7"/>';
    }
    (cfg.series || []).forEach(function (se) {
      var pts = se.points.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 1.6) + '"' +
        (se.dash ? ' stroke-dasharray="' + se.dash + '"' : '') + ' stroke-linejoin="round"/>';
    });
    if (cfg.threshold) {
      var ty = Y(cfg.threshold.value);
      s += '<line x1="' + x0 + '" y1="' + ty + '" x2="' + x1 + '" y2="' + ty + '" stroke="' + (cfg.threshold.color || C.clay) + '" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += mono(x1 - 4, ty - 5, cfg.threshold.label, 8.5, cfg.threshold.color || C.clay, 'end');
    }
    if (cfg.vline) {
      var vx = X(cfg.vline.x);
      s += '<line x1="' + vx + '" y1="' + y0 + '" x2="' + vx + '" y2="' + y1 + '" stroke="' + (cfg.vline.color || C.blue) + '" stroke-width="1.1" stroke-dasharray="3 3"/>';
      s += mono(vx + 4, y0 + 10, cfg.vline.label, 8.5, cfg.vline.color || C.blue);
    }
    (cfg.markers || []).forEach(function (m) {
      var mx = X(m.x), my = Y(m.y);
      s += '<circle cx="' + mx + '" cy="' + my + '" r="' + (m.r || 4) + '" fill="' + (m.color || C.clay) + '" stroke="#fff" stroke-width="1.4"/>';
      if (m.label) s += mono(mx + 7, my - 6, m.label, 8.5, m.color || C.ink3);
    });
    s += mono(x1, y1 + 32, cfg.xAxis || '', 8.5, C.dim, 'end');
    s += mono(8, 24, cfg.yAxis || '', 8.5, C.dim);
    s += '</svg>';
    return s;
  }

  /* ---- 深度道：随井深的曲线 + 分级 ---- */
  function chartTrack(cfg) {
    var W = 640, H = 430, x0 = 118, x1 = 512, y0 = 30, y1 = 392;
    var s = svgHead(W, H, cfg.label || '随井深曲线');
    var dmax = cfg.depth[1], vmax = cfg.valueMax || 100;
    function X(v) { return x0 + clamp(v / vmax, 0, 1) * (x1 - x0); }
    function Y(d) { return y0 + clamp(d / dmax, 0, 1) * (y1 - y0); }

    (cfg.zones || []).forEach(function (z) {
      var ya = Y(z.from), yb = Y(z.to);
      var col = z.tone === 'bad' ? '#f9e9e5' : z.tone === 'fair' ? '#fbf2df' : '#edf4f0';
      s += '<rect x="' + x0 + '" y="' + ya + '" width="' + (x1 - x0) + '" height="' + Math.max(1, yb - ya) + '" fill="' + col + '" opacity=".8"/>';
      if (z.label) s += mono(x1 + 8, (ya + yb) / 2 + 3, z.label, 8.5, C.ink3);
    });
    for (var d = 0; d <= dmax; d += dmax / 6) {
      var yy = Y(d);
      s += '<line x1="' + x0 + '" y1="' + yy + '" x2="' + x1 + '" y2="' + yy + '" stroke="#f0ece1" stroke-width=".8"/>';
      s += mono(x0 - 8, yy + 3, num(d, 0), 8.5, C.ink3, 'end');
    }
    var pts = cfg.points.map(function (p) { return X(p[1]).toFixed(1) + ',' + Y(p[0]).toFixed(1); }).join(' ');
    s += '<polyline points="' + pts + '" fill="none" stroke="#2f3a3f" stroke-width="1.5" stroke-linejoin="round"/>';
    if (cfg.threshold) {
      var tx = X(cfg.threshold.value);
      s += '<line x1="' + tx + '" y1="' + y0 + '" x2="' + tx + '" y2="' + y1 + '" stroke="' + (cfg.threshold.color || C.clay) + '" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += mono(tx + 4, y0 - 8, cfg.threshold.label, 8.5, cfg.threshold.color || C.clay);
    }
    for (var t = 0; t <= 4; t++) {
      s += mono(x0 + (x1 - x0) * t / 4, y1 + 16, num(vmax * t / 4, 0), 8.5, C.ink3, 'middle');
    }
    s += mono(x0, 20, cfg.xAxis || '', 8.5, C.dim);
    s += mono(x0 - 8, y1 + 32, '井深 / m', 8.5, C.dim, 'end');
    s += '</svg>';
    return s;
  }

  /* ---- 炮集：多道波形 + 初至 ---- */
  function chartTrace(cfg) {
    var W = 640, H = 366, x0 = 62, x1 = 610, y0 = 30, y1 = 306;
    var tmax = cfg.tMax, tr = cfg.traces || [];
    var s = svgHead(W, H, cfg.label || '地震道集');
    function Y(t) { return y0 + clamp(t / tmax, 0, 1) * (y1 - y0); }
    for (var tk = 0; tk <= 5; tk++) {
      var ty = Y(tmax * tk / 5);
      s += '<line x1="' + x0 + '" y1="' + ty + '" x2="' + x1 + '" y2="' + ty + '" stroke="#f2eee4" stroke-width=".8"/>';
      s += mono(x0 - 8, ty + 3, num(tmax * tk / 5, 0), 8.5, C.ink3, 'end');
    }
    tr.forEach(function (trace, i) {
      var cx = tr.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (tr.length - 1);
      var pts = trace.samples.map(function (a, j) {
        var t = j / (trace.samples.length - 1) * tmax;
        return (cx + a * (tr.length > 1 ? (x1 - x0) / (tr.length - 1) * 0.36 : 30)).toFixed(1) + ',' + Y(t).toFixed(1);
      }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="#3a352d" stroke-width=".9" opacity=".9"/>';
      s += mono(cx, y1 + 16, num(trace.offset, 0), 8, C.dim, 'middle');
    });
    if (cfg.truth) {
      var tp = cfg.truth.map(function (t, i) {
        var cx = x0 + (x1 - x0) * i / Math.max(1, cfg.truth.length - 1);
        return cx.toFixed(1) + ',' + Y(t).toFixed(1);
      }).join(' ');
      s += '<polyline points="' + tp + '" fill="none" stroke="#2f3a3f" stroke-width="1.2" stroke-dasharray="4 3"/>';
      s += mono(x1 - 2, y0 + 14, '真实初至', 8.5, C.ink2, 'end');
    }
    (cfg.picks || []).forEach(function (p, i) {
      var cx = x0 + (x1 - x0) * i / Math.max(1, (cfg.picks || []).length - 1);
      s += '<circle cx="' + cx + '" cy="' + Y(p) + '" r="2.6" fill="' + (cfg.pickColor || C.clay) + '"/>';
    });
    if (cfg.pickLabel) s += mono(x0 + 4, y0 + 14, cfg.pickLabel, 8.5, cfg.pickColor || C.clay);
    s += mono(x1, y1 + 32, '时间 / ms', 8.5, C.dim, 'end');
    s += mono(x0 - 8, y1 + 32, '偏移距 / m', 8.5, C.dim, 'end');
    s += '</svg>';
    return s;
  }

  function chartSVG(cfg) {
    if (!cfg) return '';
    if (cfg.type === 'bars') return chartBars(cfg);
    if (cfg.type === 'heat') return chartHeat(cfg);
    if (cfg.type === 'grid') return chartGrid(cfg);
    if (cfg.type === 'line') return chartLine(cfg);
    if (cfg.type === 'track') return chartTrack(cfg);
    if (cfg.type === 'trace') return chartTrace(cfg);
    return '';
  }

  /* =========================================================
     五、可运行示范
     ========================================================= */
  function demo(root, cfg, def) {
    if (!root) return null;
    var state = {};
    (cfg.controls || []).forEach(function (c) { state[c.key] = c.value; });

    function controlHTML(c) {
      if (c.type === 'seg') {
        return '<div class="iq-ctl"><div class="iq-ctl-top"><span>' + esc(c.label) + '</span></div>' +
          '<div class="iq-seg" data-seg="' + c.key + '">' +
          (c.options || []).map(function (o) {
            return '<button type="button" data-val="' + esc(o.value) + '"' +
              (o.value === c.value ? ' class="on"' : '') + '>' + esc(o.label) + '</button>';
          }).join('') + '</div></div>';
      }
      return '<div class="iq-ctl">' +
        '<div class="iq-ctl-top"><span>' + esc(c.label) + '</span>' +
        '<output id="gq-o-' + c.key + '">' + (c.display ? c.display(c.value) : c.value + (c.unit || '')) + '</output></div>' +
        '<input type="range" id="gq-c-' + c.key + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step +
        '" value="' + c.value + '">' +
        '</div>';
    }

    var tags = (cfg.tags || []).map(function (t) {
      return '<span class="iq-tag ' + (t.tone || '') + '">' + esc(t.text) + '</span>';
    }).join('');

    root.innerHTML =
      '<div class="iq-head">' +
        '<div><span class="iq-kicker">' + esc(cfg.kicker || 'INTERACTIVE') + '</span>' +
        '<h3>' + esc(cfg.title) + '</h3>' +
        '<p>' + esc(cfg.desc) + '</p></div>' +
        '<div class="iq-tags">' + tags + '</div>' +
      '</div>' +
      '<div class="gq-wrap">' +
        '<div class="gq-main">' +
          '<div class="iq-card"><div class="iq-card-h"><h4><i class="iq-dot"></i><span id="gq-chart-title">' +
            esc(cfg.chartTitle || '计算结果') + '</span></h4>' +
            '<span class="iq-mini" id="gq-chart-hint">' + esc(cfg.chartHint || '') + '</span></div>' +
            '<div class="gq-chart" id="gq-chart"></div>' +
            '<div class="iq-legend" id="gq-legend"></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>智能输出 vs 经验做法</h4>' +
            '<span class="iq-mini" id="gq-table-mini">同一组参数</span></div>' +
            '<div id="gq-table"></div>' +
          '</div>' +
        '</div>' +
        '<div class="gq-side">' +
          '<div class="iq-card"><div class="iq-card-h"><h4>可调参数</h4>' +
            '<span class="iq-mini">' + (cfg.controls || []).length + ' 项</span></div>' +
            (cfg.controls || []).map(controlHTML).join('') +
            '<div class="iq-btns"><button class="iq-btn" id="gq-reset">重置参数</button></div>' +
          '</div>' +
          '<div class="iq-card"><div class="iq-card-h"><h4>本次输出</h4>' +
            '<span class="iq-mini">随参数实时重算</span></div>' +
            '<div id="gq-kpis"></div>' +
            '<div id="gq-verdict" style="margin-top:10px"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="gq-foot"></div>';

    var chartEl = root.querySelector('#gq-chart');
    var legendEl = root.querySelector('#gq-legend');
    var kpiEl = root.querySelector('#gq-kpis');
    var tableEl = root.querySelector('#gq-table');
    var verdictEl = root.querySelector('#gq-verdict');
    var hintEl = root.querySelector('#gq-chart-hint');
    var titleEl = root.querySelector('#gq-chart-title');
    var footEl = root.querySelector('#gq-foot');

    function kpiHTML(list) {
      return '<div class="iq-kpis">' + list.map(function (k) {
        return '<div class="iq-kpi' + (k.wide ? ' wide' : '') + '"><span>' + esc(k.label) + '</span>' +
          '<b class="' + (k.tone || '') + '">' + esc(k.value) +
          (k.unit ? '<small>' + esc(k.unit) + '</small>' : '') + '</b></div>';
      }).join('') + '</div>';
    }

    function tableHTML(tb) {
      if (!tb) return '';
      return '<table class="iq-table"><thead><tr>' +
        tb.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + tb.rows.map(function (r, i) {
          return '<tr class="' + (i === tb.hl ? 'hl' : '') + '">' + r.map(function (c) {
            return '<td>' + (c && c.html ? c.html : esc(c)) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }

    function legendHTML(list) {
      if (!list || !list.length) return '';
      return list.map(function (l) {
        return '<span><i class="' + (l.line ? 'line' : '') + '" style="background:' + l.color + '"></i>' + esc(l.label) + '</span>';
      }).join('');
    }

    function verdictHTML(v) {
      if (!v) return '';
      return '<div class="iq-reco"><span class="tag">' + esc(v.label || 'AI 推荐') + '</span><b>' + esc(v.value) + '</b></div>' +
        (v.html ? '<div class="iq-note ' + (v.tone === 'warn' ? 'clay' : v.tone === 'bad' ? 'red' : 'blue') + '">' + v.html + '</div>' : '');
    }

    function render(updateControls) {
      var out = cfg.compute(state, root);
      chartEl.innerHTML = chartSVG(out.chart);
      legendEl.innerHTML = legendHTML(out.chart && out.chart.legend);
      if (out.chart && out.chart.title) titleEl.textContent = out.chart.title;
      if (out.chart && out.chart.hint) hintEl.textContent = out.chart.hint;
      kpiEl.innerHTML = kpiHTML(out.kpis || []);
      tableEl.innerHTML = tableHTML(out.table);
      verdictEl.innerHTML = verdictHTML(out.verdict);
      if (updateControls) {
        (cfg.controls || []).forEach(function (c) {
          if (c.type === 'seg') return;
          var o = root.querySelector('#gq-o-' + c.key);
          if (o) o.textContent = c.display ? c.display(state[c.key]) : state[c.key] + (c.unit || '');
        });
      }
    }

    (cfg.controls || []).forEach(function (c) {
      if (c.type === 'seg') {
        var seg = root.querySelector('[data-seg="' + c.key + '"]');
        if (!seg) return;
        seg.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-val]');
          if (!b) return;
          state[c.key] = b.getAttribute('data-val');
          [].forEach.call(seg.querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
          render(false);
        });
        return;
      }
      var el = root.querySelector('#gq-c-' + c.key);
      if (!el) return;
      el.addEventListener('input', function () {
        state[c.key] = Number(el.value);
        render(true);
      });
    });
    var resetBtn = root.querySelector('#gq-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        (cfg.controls || []).forEach(function (c) {
          state[c.key] = c.value;
          if (c.type === 'seg') {
            var seg = root.querySelector('[data-seg="' + c.key + '"]');
            if (seg) {
              [].forEach.call(seg.querySelectorAll('button'), function (x) {
                x.classList.toggle('on', x.getAttribute('data-val') === c.value);
              });
            }
            return;
          }
          var el = root.querySelector('#gq-c-' + c.key);
          if (el) el.value = c.value;
        });
        render(true);
      });
    }

    var foot = '';
    if (def && global.K) {
      foot += global.K.verdictBlock(def.conclusion, def.limits);
      foot += global.K.credStrip(def.credibility);
    }
    footEl.innerHTML = '<div class="gq-foot-note">' + esc(cfg.foot || '') + '</div>' + foot;

    if (global.IQFrame) global.IQFrame.boot(root);
    render(true);
    return { state: state };
  }

  global.IQGen = {
    demo: demo,
    fieldSVG: fieldSVG,
    flowSVG: flowSVG,
    barFig: barFig,
    chartSVG: chartSVG,
    esc: esc,
    num: num,
    clamp: clamp,
    ramp: ramp,
    makeCase: makeCase
  };

  /* 用同一套契约注册案例：案例文件只提供内容，结构由这里保证 */
  function makeCase(spec) {
    var def = {
      id: spec.id,
      sceneId: spec.sceneId,
      code: spec.code,
      title: spec.title,
      methods: spec.methods,
      status: 'ready',
      version: spec.version || '1.0.0',
      updated: spec.updated || '2026-11-03',
      highlight: spec.highlight,
      preview: spec.preview,
      credibility: spec.credibility,
      conclusion: spec.conclusion,
      limits: spec.limits,
      concept: spec.concept,
      tabs: {
        background: {
          label: '专业背景',
          judge: spec.judge,
          lede: spec.lede,
          sections: spec.sections
        },
        workflow: {
          label: '案例流程',
          title: spec.workflowTitle,
          lead: spec.lead,
          stats: spec.stats,
          steps: spec.steps,
          metrics: { title: spec.metricsTitle, html: spec.metricsHtml },
          fails: spec.fails
        },
        demo: {
          label: '可运行示范',
          mount: function (root, ctx) {
            if (!global.IQGen) return;
            global.IQGen.demo(root, spec.demo, def);
          },
          unmount: function () { }
        }
      }
    };
    if (global.Cases) global.Cases.register(def);
    return def;
  }

})(window);
