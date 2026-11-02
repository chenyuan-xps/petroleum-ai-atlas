/* =========================================================
   渲染工具箱 Render Kit
   ---------------------------------------------------------
   把"案例想表达什么"和"页面长什么样"分开：
   案例只调用这里的语义化函数，不写 CSS 类名。
   想改版式只需改本文件与 ui.css，所有案例同步生效。
   ========================================================= */

(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 允许案例在文本里用极简标记：**粗体** 与 `等宽` */
  function rich(s) {
    var out = esc(s);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    out = out.replace(/`([^`]+)`/g, '<code style="font-family:var(--mono);font-size:.92em;background:var(--paper-2);padding:1px 4px;border-radius:3px">$1</code>');
    return out;
  }

  /* ---------- 标签 ---------- */
  function mtag(keys) {
    var M = (global.ATLAS && global.ATLAS.methods) || {};
    return (keys || []).map(function (k) {
      var m = M[k] || { abbr: k.toUpperCase() };
      return '<span class="mtag" data-m="' + k + '"><b>' + m.abbr + '</b></span>';
    }).join('');
  }

  function dtag(d) {
    return '<span class="dtag" data-d="' + esc(d) + '">难度 ' + esc(d) + '</span>';
  }

  /* ---------- 图 ---------- */
  function figure(svg, no, caption) {
    return '<div class="figure">' + svg + '</div>' +
      (caption ? '<div class="figcap"><b>图 ' + esc(no) + '</b><span>' + rich(caption) + '</span></div>' : '');
  }

  /* ---------- 四段式 ---------- */
  function sec4(no, en, title, bodyHTML) {
    return '<div class="sec4"><div class="sn">' + pad(no) + '<span>' + esc(en) + '</span></div>' +
      '<div class="sec4-body"><h3>' + esc(title) + '</h3>' + bodyHTML + '</div></div>';
  }

  /* ---------- 30 秒判断 ---------- */
  function judge(cells) {
    var five = cells.length === 5 ? ' five' : '';
    return '<div class="judge' + five + '">' + cells.map(function (c) {
      return '<div class="jc"><div class="jl">' + esc(c.label) + '</div>' +
        '<div class="jv">' + (c.html || rich(c.value)) + '</div>' +
        (c.desc ? '<div class="jd">' + rich(c.desc) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ---------- 可信度条：分数 + 依据 + 三项检查 ---------- */
  function credStrip(cred) {
    cred = cred || {};
    var score = Math.max(0, Math.min(100, Number(cred.score) || 0));
    var lv = cred.level || (score >= 80 ? '较高' : score >= 65 ? '中' : '偏低');
    var checks = (cred.checks || []).map(function (c) {
      return '<div class="cred-item"><span class="ck">' + esc(c.k) + '</span><span class="cv">' + rich(c.v) + '</span></div>';
    }).join('');
    return '<div class="cred-strip">' +
      '<div class="cred-main">' +
      '<div class="cm-top"><span class="kicker plain">CONFIDENCE · 可信度</span><span class="lv">' + esc(lv) + '</span></div>' +
      '<div class="cm-num"><b>' + score + '</b><small>/100</small></div>' +
      '<div class="cred-bar"><i style="width:' + score + '%"></i></div>' +
      (cred.basis ? '<p class="cm-note">' + rich(cred.basis) + '</p>' : '') +
      '</div>' +
      (checks ? '<div class="cred-side">' + checks + '</div>' : '') +
      '</div>';
  }

  /* ---------- 决策链：输入 → 处理 → 判断 → 输出 ---------- */
  function decisionChain(steps) {
    if (!steps || !steps.length) return '';
    var inner = steps.map(function (s, i) {
      return '<div class="dc-step">' +
        '<div class="dc-no">' + ('0' + (i + 1)).slice(-2) + '</div>' +
        '<div class="dc-k">' + esc(s.k || '') + '</div>' +
        '<div class="dc-t">' + esc(s.t || '') + '</div>' +
        (s.d ? '<div class="dc-d">' + esc(s.d) + '</div>' : '') +
        '</div>' +
        (i < steps.length - 1 ? '<div class="dc-ar">→</div>' : '');
    }).join('');
    return '<div class="decision"><div class="decision-h">' +
      '<span class="kicker plain">DECISION PATH · 决策链</span>' +
      '<span class="mini">' + steps.length + ' 步</span></div>' +
      '<div class="decision-scroll"><div class="decision-in">' + inner + '</div></div></div>';
  }

  /* ---------- 工程结论 + 模型边界 ---------- */
  function verdictBlock(conclusion, limits) {
    if (!conclusion && !(limits && limits.length)) return '';
    var c = conclusion || {}, ls = limits || [];
    return '<div class="case-end">' +
      (conclusion ? '<div class="verdict"><div class="vk">VERDICT · 工程结论</div>' +
        '<h4>' + esc(c.title || '结论') + '</h4>' + (c.html || '') + '</div>' : '') +
      (ls.length ? '<div class="boundary"><div class="vk">BOUNDARY · 模型边界</div>' +
        '<h4>这套结果在哪里会失效</h4><ul>' +
        ls.map(function (l) { return '<li>' + rich(l) + '</li>'; }).join('') +
        '</ul></div>' : '') +
      '</div>';
  }

  /* ---------- 表格 ---------- */
  function dtable(head, rows) {
    return '<table class="dtable"><thead><tr>' +
      head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + rich(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- 数据清单（可勾选） ---------- */
  function checklist(items, title) {
    var head = title || '数据准备清单';
    var rows = items.map(function (d, i) {
      var name = Array.isArray(d) ? d[0] : d;
      var spec = Array.isArray(d) ? d[1] : '';
      var note = Array.isArray(d) ? d[2] : '';
      return '<div class="cl-item" data-cl="' + i + '">' +
        '<span class="cl-box"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg></span>' +
        '<span><span class="cl-t">' + esc(name) + '</span>' +
        '<span class="cl-s">' + esc(spec) + '</span></span>' +
        '<span class="cl-n">' + esc(note) + '</span></div>';
    }).join('');
    return '<div class="checklist"><div class="cl-head">' +
      '<span>' + esc(head) + ' · ' + items.length + ' 项</span>' +
      '<span class="cl-prog"><span id="cl-txt">0 / ' + items.length + '</span>' +
      '<span class="cl-bar"><i id="cl-fill"></i></span></span></div>' + rows + '</div>';
  }

  /* ---------- 参考方向 ---------- */
  function refs(list, hrefPrefix) {
    return '<div class="refs">' + list.map(function (r) {
      var name = typeof r === 'string' ? r : r.name;
      var href = typeof r === 'string' ? (hrefPrefix || '#/method/cv') : (r.href || hrefPrefix);
      var ar = href ? '<span class="ar">↗</span>' : '';
      return href
        ? '<a class="ref" href="' + href + '">' + esc(name) + ar + '</a>'
        : '<span class="ref">' + esc(name) + '</span>';
    }).join('') + '</div>';
  }

  /* ---------- 难度条 ---------- */
  function meter(diff) {
    var lv = diff === '低' ? 1 : diff === '高' ? 3 : 2;
    return '<div class="meter">' + [1, 2, 3].map(function (i) {
      return '<i class="' + (i <= lv ? 'on' : '') + (i === 3 && lv === 3 ? ' hi' : '') + '"></i>';
    }).join('') + '</div>';
  }

  /* ---------- 编号指标格 ---------- */
  function cells(items) {
    return '<div class="case-cells">' + items.map(function (c) {
      var l = Array.isArray(c) ? c[0] : c.label;
      var v = Array.isArray(c) ? c[1] : c.value;
      var raw = Array.isArray(c) ? c[2] : c.html;
      var isNum = !raw && /^[\d.]+$/.test(String(v));
      return '<div><div class="l">' + esc(l) + '</div><div class="v">' +
        (raw ? v : isNum ? '<b>' + esc(v) + '</b>' : esc(v)) + '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- 流程步骤 ---------- */
  function pipeline(steps) {
    return '<div class="pipeline">' + steps.map(function (s, i) {
      /* 四要素版：输入 → 处理 → 输出 画成横向流程图，再标注这一步适合的图形。
         老模板只有 do/effect/trap，缺 input/output 时退回纯文字处理说明，保持向后兼容。 */
      var hasIO = !!(s.input && s.output);
      var io = '';
      if (hasIO) {
        io = '<div class="pio">' +
          '<div class="pio-c"><span class="k">输入</span><span class="v">' + rich(s.input) + '</span></div>' +
          '<div class="pio-ar">→</div>' +
          '<div class="pio-c proc"><span class="k">处理</span><span class="v">' + rich(s.do) + '</span></div>' +
          '<div class="pio-ar">→</div>' +
          '<div class="pio-c is-out"><span class="k">输出</span><span class="v">' + rich(s.output) + '</span></div>' +
          '</div>';
      }
      return '<div class="pstep"><div class="pn">' + pad(i + 1) + '</div><div class="pc">' +
        '<h4>' + esc(s.name) + (s.role ? '<span class="role">' + esc(s.role) + '</span>' : '') + '</h4>' +
        io +
        (hasIO ? '' : '<div class="pdo">' + rich(s.do) + '</div>') +
        (s.effect ? '<div class="peff"><span class="k">预期效果</span><span>' + rich(s.effect) + '</span></div>' : '') +
        (s.trap ? '<div class="peff" style="border-top-color:rgba(176,90,81,.2)"><span class="k" style="color:var(--bad)">常见坑</span><span>' + rich(s.trap) + '</span></div>' : '') +
        (s.viz ? '<div class="pviz"><span class="k">建议图示</span>' +
          '<svg class="pvico" viewBox="0 0 16 12" aria-hidden="true"><rect x="1" y="7" width="3" height="4" fill="#3a352d"/><rect x="6" y="4" width="3" height="7" fill="#7ba99b"/><rect x="11" y="1" width="3" height="10" fill="#c9d9d3"/></svg>' +
          '<span>' + rich(s.viz) + '</span></div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }

  /* ---------- 失败模式 ---------- */
  function fails(items) {
    return '<div class="fails">' + items.map(function (f, i) {
      return '<div class="fail"><div class="fi">FAIL ' + pad(i + 1) + '</div>' +
        '<h5>' + esc(f.name) + '</h5><p>' + rich(f.why) + '</p></div>';
    }).join('') + '</div>';
  }

  /* ---------- 提示条 ---------- */
  function callout(text, kind) {
    return '<div class="callout' + (kind === 'warn' ? ' warn' : '') + '">' +
      '<span class="ci">' + (kind === 'warn' ? '注意' : '说明') + '</span>' +
      '<span>' + rich(text) + '</span></div>';
  }

  /* ---------- 代码块 ---------- */
  function highlight(src) {
    var store = [];
    function stash(html) { store.push(html); return '\u0001' + (store.length - 1) + '\u0002'; }

    var s = String(src);
    // 注释
    s = s.replace(/\/\/[^\n]*/g, function (m) { return stash('<span class="c">' + esc(m) + '</span>'); });
    // 字符串
    s = s.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, function (m) {
      return stash('<span class="s">' + esc(m) + '</span>');
    });
    s = esc(s);
    s = s.replace(/\b(var|let|const|function|return|if|else|for|while|new|this|typeof|true|false|null|undefined)\b/g,
      '<span class="k">$1</span>');
    s = s.replace(/\u0001(\d+)\u0002/g, function (_, i) { return store[+i]; });
    return s;
  }

  function code(src, opts) {
    opts = opts || {};
    return '<div class="code">' +
      '<div class="code-top"><span class="dots"><i></i><i></i><i></i></span>' +
      esc(opts.file || 'snippet.js') + (opts.note ? ' · ' + esc(opts.note) : '') + '</div>' +
      '<pre>' + highlight(src) + '</pre></div>';
  }

  /* ---------- 文件树 ---------- */
  function tree(lines) {
    return '<div class="tree">' + lines.join('<br>') + '</div>';
  }

  global.K = {
    esc: esc, pad: pad, rich: rich,
    mtag: mtag, dtag: dtag,
    figure: figure, sec4: sec4, judge: judge,
    credStrip: credStrip, decisionChain: decisionChain, verdictBlock: verdictBlock,
    dtable: dtable, checklist: checklist, refs: refs, meter: meter,
    cells: cells, pipeline: pipeline, fails: fails,
    callout: callout, code: code, tree: tree, highlight: highlight
  };
})(window);
