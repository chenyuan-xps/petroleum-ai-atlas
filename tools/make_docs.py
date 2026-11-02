# -*- coding: utf-8 -*-
"""
生成三份交付文档：
  交付物/网站亮点说明.docx
  交付物/结课报告.docx（随后转 PDF）
  交付物/视频讲稿.docx
"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = r"D:\2pythonwork\vision\石油勘探开发智能化案例集"
OUT = os.path.join(ROOT, "交付物")
os.makedirs(OUT, exist_ok=True)

INK = RGBColor(0x1F, 0x23, 0x29)
INK2 = RGBColor(0x4A, 0x54, 0x5D)
ACCENT = RGBColor(0x1E, 0x6F, 0x5C)
BROWN = RGBColor(0x8C, 0x5A, 0x2B)

BODY_FONT = "宋体"
HEAD_FONT = "微软雅黑"


def set_run_font(run, name=BODY_FONT, size=10.5, bold=False, color=INK, italic=False):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts")
        rpr.append(rf)
    rf.set(qn("w:ascii"), name)
    rf.set(qn("w:hAnsi"), name)
    rf.set(qn("w:eastAsia"), name)


def init_doc(margin_top=2.4, margin_bottom=2.3, margin_lr=2.5):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(margin_top)
    sec.bottom_margin = Cm(margin_bottom)
    sec.left_margin = Cm(margin_lr)
    sec.right_margin = Cm(margin_lr)

    st = doc.styles["Normal"]
    st.font.name = BODY_FONT
    st.font.size = Pt(10.5)
    st.font.color.rgb = INK
    st.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    pf = st.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.55
    pf.space_before = Pt(0)
    pf.space_after = Pt(5)
    return doc


def add_page_number_footer(doc, prefix=""):
    footer = doc.sections[0].footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if prefix:
        r0 = p.add_run(prefix)
        set_run_font(r0, BODY_FONT, 8.5, False, INK2)
    r = p.add_run()
    set_run_font(r, BODY_FONT, 8.5, False, INK2)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), " PAGE ")
    r._element.addnext(fld)


def p(doc, text="", size=10.5, bold=False, color=INK, font=BODY_FONT,
      align=None, before=0, after=5, indent_first=0, line=1.55, space_char=False):
    par = doc.add_paragraph()
    pf = par.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = line
    if indent_first:
        pf.first_line_indent = Pt(indent_first)
    if align == "center":
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif align == "right":
        par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    elif align == "justify":
        par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    run = par.add_run(text)
    set_run_font(run, font, size, bold, color)
    if space_char:
        run.font.element.rPr.append(OxmlElement("w:spacing"))
    return par


def rich(doc, parts, size=10.5, before=0, after=5, line=1.55, indent_first=0, align="justify"):
    """parts: [(text, bold, color)]"""
    par = doc.add_paragraph()
    pf = par.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = line
    if indent_first:
        pf.first_line_indent = Pt(indent_first)
    if align == "justify":
        par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    for t, b, c in parts:
        r = par.add_run(t)
        set_run_font(r, BODY_FONT, size, b, c or INK)
    return par


def h1(doc, num, text, before=16, after=8):
    par = doc.add_paragraph()
    pf = par.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.keep_with_next = True
    if num:
        r = par.add_run(num + "  ")
        set_run_font(r, HEAD_FONT, 14, True, ACCENT)
    r = par.add_run(text)
    set_run_font(r, HEAD_FONT, 14, True, INK)
    # 下边框
    pPr = par._element.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "8")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), "1E6F5C")
    pbdr.append(bottom)
    pPr.append(pbdr)
    return par


def h2(doc, text, before=12, after=4):
    par = doc.add_paragraph()
    pf = par.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    pf.keep_with_next = True
    r = par.add_run(text)
    set_run_font(r, HEAD_FONT, 11.5, True, ACCENT)
    return par


def bullet(doc, text, size=10.5, indent=0.6, after=3, bold_head=None):
    par = doc.add_paragraph()
    pf = par.paragraph_format
    pf.left_indent = Cm(indent)
    pf.first_line_indent = Cm(-0.45)
    pf.space_before = Pt(0)
    pf.space_after = Pt(after)
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = 1.5
    par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = par.add_run("· ")
    set_run_font(r, BODY_FONT, size, False, BROWN)
    if bold_head:
        rb = par.add_run(bold_head)
        set_run_font(rb, BODY_FONT, size, True, INK)
    r2 = par.add_run(text)
    set_run_font(r2, BODY_FONT, size, False, INK)
    return par


def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def set_table_borders(table, color="D8D3C7", sz=6):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        borders.append(el)
    tblPr.append(borders)


def add_table(doc, header, rows, widths, size=9, header_fill="EDF3F0",
              first_col_bold=False, align_center_cols=(), after=8):
    table = doc.add_table(rows=1, cols=len(header))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    hdr = table.rows[0].cells
    for i, h in enumerate(header):
        hdr[i].text = ""
        par = hdr[i].paragraphs[0]
        par.paragraph_format.space_before = Pt(3)
        par.paragraph_format.space_after = Pt(3)
        par.paragraph_format.line_spacing = 1.15
        r = par.add_run(h)
        set_run_font(r, HEAD_FONT, size, True, RGBColor(0x14, 0x4A, 0x3D))
        shade(hdr[i], header_fill)
    # 表头重复
    trPr = table.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement("w:tblHeader")
    th.set(qn("w:val"), "true")
    trPr.append(th)

    for row in rows:
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            par = cells[i].paragraphs[0]
            par.paragraph_format.space_before = Pt(3)
            par.paragraph_format.space_after = Pt(3)
            par.paragraph_format.line_spacing = 1.2
            if i in align_center_cols:
                par.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = par.add_run(str(val))
            bold = first_col_bold and i == 0
            set_run_font(r, BODY_FONT, size, bold, INK)

    for r in table.rows:
        for i, w in enumerate(widths):
            r.cells[i].width = Cm(w)

    doc.add_paragraph().paragraph_format.space_after = Pt(after)
    return table


def caption(doc, text):
    par = doc.add_paragraph()
    par.paragraph_format.space_before = Pt(2)
    par.paragraph_format.space_after = Pt(2)
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = par.add_run(text)
    set_run_font(r, BODY_FONT, 8.5, False, INK2)
    return par


def callout(doc, title, text, fill="F7F3EA"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, color="E4DCC8", sz=4)
    cell = table.rows[0].cells[0]
    cell.width = Cm(15.8)
    shade(cell, fill)
    cell.text = ""
    par = cell.paragraphs[0]
    par.paragraph_format.space_before = Pt(6)
    par.paragraph_format.space_after = Pt(2)
    r = par.add_run(title)
    set_run_font(r, HEAD_FONT, 9.5, True, BROWN)
    par2 = cell.add_paragraph()
    par2.paragraph_format.space_before = Pt(0)
    par2.paragraph_format.space_after = Pt(6)
    par2.paragraph_format.line_spacing = 1.45
    r2 = par2.add_run(text)
    set_run_font(r2, BODY_FONT, 9.5, False, INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)


# ============================================================
# 文档一：网站亮点说明
# ============================================================
def build_highlights():
    doc = init_doc()
    add_page_number_footer(doc, "石油智能化案例地图 · 网站亮点说明　—　")

    p(doc, "石油智能化案例地图", size=20, bold=True, font=HEAD_FONT, align="center",
      before=24, after=2, line=1.2)
    p(doc, "网 站 亮 点 说 明", size=13, font=HEAD_FONT, color=ACCENT, align="center",
      before=2, after=10, line=1.2)
    p(doc, "6 个可运行案例　·　13 个环节　·　61 个场景　·　纯前端离线",
      size=9.5, color=INK2, align="center", after=2)
    p(doc, "在线地址：https://petro-ai-atlas.app.workbuddy.host/?sharecode=EQHJFYWA24",
      size=9.5, color=INK2, align="center", after=18)

    callout(doc, "一句话",
            "这个网站想解决的不是“多放几张图”，而是让读者在一屏之内看清三件事："
            "这个决策用了哪些指标、被什么约束卡住、换成另一个人拍板会怎样。"
            "六个案例的每一张主图都挂在一个真实计算函数的返回值上，参数一动，图和结论一起变。")

    h1(doc, "一", "交付概览")
    add_table(doc,
              ["维度", "内容"],
              [["课程任务", "学号尾号 07 → 第 7 个环节「完井」，其下 4 个子场景全部完成"],
               ["案例数量", "6 个交付案例（完井 4 个必做 + 扩展 2 个：压裂参数优化、产量预测）；站点另注册 1 个测井分层示例，用于对照写法、不计入交付"],
               ["场景库", "13 个环节、61 个场景，首页一次性列全，并标出本人负责的环节"],
               ["每个案例", "专业背景 / 案例流程 / 可运行示范 三部分，各自配图"],
               ["技术栈", "HTML + CSS + 原生 JS + D3 v7.9（本地文件），无后端、无 CDN、无外部请求"],
               ["交付形态", "主站 1 个（含 13 条路由）+ 6 个可独立运行的案例包（每包 7 个文件）"],
               ["验证情况", "6/6 案例构建与语法检查通过；挂载、调参、AI 按钮、回放控件 6/6 通过；控制台错误 0"]],
              [2.6, 13.2], size=9, first_col_bold=True)

    h1(doc, "二", "亮点一：首页把 13 个环节一次说完，并指出“我负责哪个”")
    p(doc, "作业要求 13 个环节必须出现在网站首页。常见的应付方式是在二级页面画一条链，首页只留一句“进入作业链”。"
           "本项目把 13 个环节做成首页正文里的一条横向网格：每格一个环节，格内是环节名、场景数，以及一条用颜色表示方法构成的细条；"
           "本人负责的「完井」格高亮，右上角标“必做”。", indent_first=21)
    bullet(doc, "13 列等宽网格（repeat(13, minmax(0,1fr))），桌面端一眼看全，不需要点击、不需要滚动。", bold_head="视觉：")
    bullet(doc, "窄屏（<1000px）时整条横向滚动（min-width 1170px），宁可让读者滑，也不把字压成两行、把色条压没。", bold_head="降级：")
    bullet(doc, "每一格的方法色条复用作业链页的 stageBar()，同一个环节在两处的颜色完全一致，读者不用重新建立颜色与方法的对应关系。", bold_head="一致：")
    p(doc, "这一块的价值不在于“画得好看”，而在于它回答了读者打开网站后的第一个问题：这个站覆盖了石油勘探开发的哪些环节，"
           "我做的那一块在整条链的什么位置。", indent_first=21, before=2)

    h1(doc, "三", "亮点二：算法真的在算，而不是播放预录动画")
    p(doc, "可视化最容易露馅的地方，是图很漂亮但和参数无关——拖滑杆只是换了一张预先画好的图。"
           "本项目六个案例各有一个核心计算函数，页面上所有数字、图形、推荐结论都从它的返回值派生。"
           "为了让这件事可核查，每个案例的方法卡下面加了一行“本轮中间量”，参数一动就跟着变。", indent_first=21)
    add_table(doc,
              ["案例", "核心函数", "改一个参数后先变什么", "页面上可核对的证据"],
              [["co1 完井方式优选", "topsis() → evaluate()", "五项指标 → 加权矩阵 → 正负理想解距离 → 贴近度",
                "权重档从“均衡”切到“防砂优先”，综合得分 71.3→78.4、置信度 96%→75%"],
               ["co2 射孔参数设计", "calc() → optimize()", "固定相位/孔径下 399 个「孔密×段长」组合重算；四维搜索共评估 21546 组",
                "评估组数、风险内可行组数、可行率随相位/孔径改变"],
               ["co3 管柱受力分析", "buildProfile() → scanSpeed()", "211 段逐段受力积分 → 钩载 → 安全系数 → 37 档速度扫描",
                "可行档数（默认 28/37）、高风险井段深度、卡住的约束随井斜/摩阻改变"],
               ["co4 滑套控制", "rates() → optimizeOpen() → simulate()", "9261 组开度组合枚举 → 达标组合 → 30 天滚动重算",
                "达标天数、累产油/水、调控次数随目标产油与含水上限改变"],
               ["e1 压裂参数优化", "evalFrac() → optimize()", "273 组「排量×液量」的缝长、施工压力与砂堵风险",
                "压力越界 / 砂堵 / 两者同时越界会给出不同提示"],
               ["pr2 产量预测", "forecast() → optimize() → fitR2()", "120 天历史残差 → 拟合优度 → 289 组制度搜索",
                "R² 由残差实时算出（实测 0.682），不是写死的 0.94"]],
              [2.6, 4.4, 4.6, 4.2], size=8.5, first_col_bold=True)
    p(doc, "其中 pr2 的 R² 是一次“反向修正”：初版页面上写着 R²=0.94，但那是手填的。改成按 120 天历史残差实时计算后，"
           "真实值只有 0.682——因为合成历史里带了 ±3% 的噪声。这个数字不好看，但它是真的，"
           "也正好说明“预测曲线上的那条区间带”为什么必须画出来。", indent_first=21, before=2)

    h1(doc, "四", "亮点三：方法说明卡改成“图优先”")
    p(doc, "原来每个案例顶部是一大段文字，讲方法叫什么、流程几步、为什么适合。读者要读完两百字才知道这个方法在干什么。"
           "现在的顺序是：方法名 → 算法自己的图 → 一行中间量 → 折叠起来的原理、对比表与适用边界。", indent_first=21)
    add_table(doc,
              ["图型", "用在哪", "读者第一眼看到什么"],
              [["决策矩阵热图 matrix()", "co1", "5 个方案 × 5 项指标的加权得分矩阵，哪一格最深，方案优势在哪一列一目了然"],
               ["搜索散点 scatter()", "co2 / co4 / e1 / pr2", "整个搜索面（399 / 1331 / 273 / 289 个点）、阈值线，以及被选中的那一个点"],
               ["可行性带 band()", "co3", "37 档速度的绿/红带 + 最小安全系数曲线，可施工窗口是一条连续的绿带"]],
              [4.4, 4.0, 7.4], size=8.5, first_col_bold=True)
    p(doc, "三种图对应三类算法：多目标排序看矩阵，约束搜索看散点，一维扫描看带。图不是配图，它就是方法的形状。", indent_first=21)

    h1(doc, "五", "亮点四：三栏决策台，调参、看图、读结论在同一视野")
    p(doc, "案例演示页统一成三栏：左栏工程示意与当前方案，中栏主图，右栏输入参数与 AI 结论。"
           "左右两栏 sticky 吸附，中栏随页面自然滚动。这样拖动右栏滑杆时，左栏的结构示意和中栏的图同时在视野里，"
           "不需要来回滚动去对照。", indent_first=21)
    bullet(doc, "没有做成三个各自定高、各自滚动的框——实践下来卡片会被切断在数字中间，读起来更累。", bold_head="取舍：")
    bullet(doc, "只在 599px 以下堆叠成单列，中间不设过渡档，避免“两栏挤在一起”的尴尬宽度。", bold_head="断点：")
    bullet(doc, "每个图右上角有放大按钮（⤢），双击图表也能放大，Esc 或点遮罩退出；D3 后渲染的图由 MutationObserver 自动补挂按钮。", bold_head="细节：")

    h1(doc, "六", "亮点五：每张图都有工程语义")
    p(doc, "判断一张图该不该画，标准是“读者能不能用它做一个判断”。本项目的图基本都能对应到一句工程话：", indent_first=21)
    add_table(doc,
              ["图", "读者能读出什么"],
              [["风险等高线（co2 / e1）", "哪一片区域是不能碰的——等高线不是装饰，它把“风险超限”画成了一条边界"],
               ["分层产液堆叠面积（co4）", "含水上升时是哪一层在出水，而不是只知道“全井含水涨了”"],
               ["Tornado 敏感性（e1）", "排量、液量、砂比、闭合压力四个参数，谁动一格对结果影响最大"],
               ["可行性带（co3）", "速度越靠右越快、裕度越低；绿带就是现场可以下的速度窗口"],
               ["预测区间（pr2）", "90 天后的产量不是一个点，而是一个 ±17% 的带；历史越短，带越宽"]],
              [5.4, 10.4], size=8.5, first_col_bold=True)

    h1(doc, "七", "亮点六：算不出来的时候，如实说算不出来")
    p(doc, "工程软件最危险的行为是“永远给你一个答案”。本项目专门处理了三种“没有解”的情况：", indent_first=21)
    bullet(doc, "co3 在给定井斜与摩阻下 37 档速度全都不满足安全系数时，推荐卡改为“参考解”，并指出是被安全系数还是钩载上下限卡住。")
    bullet(doc, "co4 目标产油在含水上限内不可达时，页面顶部出现红色提示条，给出“最接近的可行方案”和差距，而不是硬凑一个开度。")
    bullet(doc, "e1 把越界原因分成施工压力超限、砂堵风险超限、两者同时超限三种，提示语不同，处置建议也不同。")
    p(doc, "这类设计在答辩时最容易被追问，也最能说明作者真的跑过这些参数。", indent_first=21, before=2)

    h1(doc, "八", "亮点七：可扩展、可上传，旧包不会被新版本打破")
    p(doc, "每个案例是一个自包含的包：case.json 加 demo/ 目录（7 个文件），既能挂进主站，也能单独双击打开。"
           "构建脚本 tools/build-cases.js 负责校验字段、把共用的 CSS 与 D3 复制进每个包、生成站点插件；"
           "tools/package_cases.py 负责打出六个提交用的 zip。", indent_first=21)
    bullet(doc, "支持选择文件、选择文件夹、拖入文件夹、拖入 ZIP 四种方式；ZIP 在浏览器本地解压，沿用同一套校验、预览、保存流程。", bold_head="上传：")
    bullet(doc, "新加的展示字段（code / highlight / credibility / conclusion / limits 等）都是可选项，旧版 5 文件、6 文件包上传后照常显示，只是少几块内容。", bold_head="兼容：")
    bullet(doc, "案例页新增的“演示区固定高度”能力写在 case.json 的 tabs.demo.scroll 里，未设置时行为与旧版完全一致。", bold_head="渐进：")

    h1(doc, "九", "亮点八：纯前端、可离线、可复现")
    p(doc, "整站只有 HTML、CSS、原生 JS 和一份本地的 d3.v7.min.js，没有后端、没有数据库、没有 CDN，"
           "双击 index.html 就能完整浏览。路由用 hash，刷新不 404。", indent_first=21)
    p(doc, "可复现性体现在两道检查上：构建脚本做静态校验（字段、语法、文件数），无头浏览器做冒烟测试"
           "（挂载、调参、AI 按钮、回放控件、筛选对比、上传）。目前 6 个案例全部通过，控制台错误 0。", indent_first=21)

    h1(doc, "十", "六个案例，各一句话")
    add_table(doc,
              ["案例", "一句话亮点"],
              [["co1 完井方式智能优选", "把“为什么选它”拆成五项指标的加权矩阵，再加 10 组权重扰动看排序稳不稳"],
               ["co2 射孔参数智能设计", "在 2 万余组参数里先筛掉不可施工的，再把“产能—风险”的取舍摊成一张散点图"],
               ["co3 完井管柱受力智能分析", "211 段逐段积分 + 37 档速度扫描，把“下得下去吗”画成一条绿带；还带下入回放"],
               ["co4 智能完井滑套控制", "固定开度与滚动调控同屏对比，30 天回放里能看见是哪一层先出水"],
               ["e1 压裂参数智能优化", "三档优化口径 + 泵注回放 + Tornado，把“排量越大缝越长”这个直觉纠正过来"],
               ["pr2 产量智能预测", "预测不是一个点而是一个带；R² 由残差实时算出，接受它只有 0.682"]],
              [5.2, 10.6], size=8.5, first_col_bold=True)

    h1(doc, "十一", "我最满意的三处，以及为什么")
    bullet(doc, "co3 把 37 档下入速度做成一条绿/红可行性带，绿带右端就是“再快不敢下”的那一档；"
                "co2 用风险等高线把“不能碰的区域”画成一条边界。工程决策里最难的不是算最优，而是知道什么时候不能做，"
                "这两张图把“边界”从经验话变成了可以用手指认的位置。", bold_head="1. 把约束画成边界：")
    bullet(doc, "每个案例的方法卡下都有一行“本轮中间量”：评估组数、可行率、领先分差、R²。参数一动，图和数字一起变；"
                "如果数字不动，就说明代码没接到算法上。pr2 的 R² 只有 0.682，是这行数字把初版手填的 0.94 揪出来的。"
                "它让“这张图不是预录动画”这件事变得可核查。", bold_head="2. 让算法留痕：")
    bullet(doc, "co3 没有可行档时给“参考解”并指出卡住的约束；co4 目标不可达时给红条和最接近方案；"
                "e1 区分压力超限、砂堵、两者同时超限。工程软件最危险的是永远给你一个答案，这三处是我刻意保留的“不漂亮”状态。",
           bold_head="3. 算不出来时如实说：")
    p(doc, "之所以说这三处做得好，不是因为它们好看，而是因为它们都能被追问：边界能不能指出来、数字能不能复算、"
           "结论失效时系统会不会承认。答辩时老师随便改一个参数，页面都要给出相应的变化与解释——这是我对“好”的判断标准。",
      indent_first=21, before=2)

    h1(doc, "十二", "与课程“三部分”要求的对应")
    add_table(doc,
              ["课程要求", "本项目做法", "数量"],
              [["专业背景", "每个案例 4 张概念 SVG：井筒/裂缝/井眼结构、方法链路、数据结构、难点与改进路线", "6 × 4 = 24 张"],
               ["案例流程", "每一步给出“输入 → 处理 → 输出”三格，并单独标注“这一步用什么图表达”", "6 案 × 5—6 步"],
               ["案例演示", "核心函数真实计算 → 工程示意 + 主图 + 中间量 → 推荐值、风险等级、置信度 → 经验方案对比", "6 个可运行示范"]],
              [2.8, 10.2, 2.8], size=8.5, first_col_bold=True, align_center_cols=(2,))

    h1(doc, "十三", "怎么看")
    p(doc, "在线：https://petro-ai-atlas.app.workbuddy.host/?sharecode=EQHJFYWA24", indent_first=21)
    p(doc, "本地：解压后双击 index.html，无需安装任何依赖。", indent_first=21)
    p(doc, "建议路线：首页看 13 个环节与本人任务 → 点「完井」进 co1，把权重档在“均衡 / 防砂优先 / 成本优先”之间切三次，"
           "观察得分与置信度怎么变 → 依次看 co2、co3、co4 → 再看两个扩展案例 → 最后用案例对比页把六个案例的参数数、图表数、"
           "核心交互横向拉一张表。", indent_first=21, before=2)

    path = os.path.join(OUT, "网站亮点说明.docx")
    doc.save(path)
    return path


# ============================================================
# 文档二：结课报告（转 PDF）
# ============================================================
def build_report():
    doc = init_doc(margin_top=2.6)
    add_page_number_footer(doc, "—　")

    # ---- 封面 ----
    for _ in range(3):
        doc.add_paragraph()
    p(doc, "石油勘探开发智能化", size=15, font=HEAD_FONT, color=INK2, align="center", after=4, line=1.2)
    p(doc, "可 视 化 案 例 地 图", size=15, font=HEAD_FONT, color=INK2, align="center", after=30, line=1.2)
    p(doc, "结 课 报 告", size=30, bold=True, font=HEAD_FONT, align="center", after=10, line=1.2)
    p(doc, "—— 以完井阶段的六个案例为例", size=12, font=HEAD_FONT, color=ACCENT, align="center",
      after=40, line=1.4)

    p(doc, "项目名称　　石油智能化案例地图 · 油气井完井智能决策实验室", size=11, align="center", after=8)
    p(doc, "学　　号　　＿＿＿＿＿＿＿＿07", size=11, align="center", after=8)
    p(doc, "姓　　名　　chenyuan", size=11, align="center", after=8)
    p(doc, "完成日期　　2026 年 11 月", size=11, align="center", after=8)

    for _ in range(5):
        doc.add_paragraph()
    p(doc, "案例：完井方式优选 · 射孔参数设计 · 管柱受力分析 · 滑套控制策略 · 压裂参数优化 · 产量预测",
      size=9, color=INK2, align="center", after=2)
    p(doc, "在线地址：https://petro-ai-atlas.app.workbuddy.host/?sharecode=EQHJFYWA24",
      size=9, color=INK2, align="center", after=2)

    doc.add_page_break()

    # ---- 一、任务与交付 ----
    h1(doc, "一", "任务与交付", before=0)
    p(doc, "课程规定作业链共 13 个环节，按学号最后两位循环对应，类别下的子场景必须全部完成，不足 5 个再从其他环节补足。"
           "本人学号尾号 07，对应第 7 个环节「完井」，其下 4 个子场景全部完成；因完井只有 4 个场景，"
           "另从增采与采油环节补 2 个扩展案例，合计 6 个。", indent_first=21)
    add_table(doc,
              ["编号", "场景", "所属环节", "核心方法", "可调参数"],
              [["co1", "完井方式智能优选", "完井", "TOPSIS 多目标决策 + 权重扰动", "5"],
               ["co2", "射孔参数智能设计", "完井", "产能代理模型 + 四维网格搜索", "5"],
               ["co3", "完井管柱受力智能分析", "完井", "一维力学积分 + 异常检测 + 速度扫描", "5"],
               ["co4", "智能完井滑套控制策略", "完井", "分层产能模型 + 约束枚举 + 滚动重算", "6"],
               ["e1", "压裂参数智能优化", "增采（扩展）", "裂缝代理模型 + 双约束搜索", "4"],
               ["pr2", "产量智能预测", "采油（扩展）", "指数递减 + 协变量耦合 + 情景搜索", "6"]],
              [1.4, 5.0, 3.0, 5.0, 1.6], size=8.5, align_center_cols=(0, 4))
    caption(doc, "表 1　六个案例与所用方法")

    p(doc, "交付形态是一个纯前端静态网站加六个可独立运行的案例包。网站本身有 13 条路由（总览、作业链、案例库、案例对比、"
           "项目说明、环节、方法、场景等），首页列出全部 13 个环节；案例包遵循同一份 case.json 契约，"
           "既可作为站点插件挂载，也可单独解压双击运行，还可以通过“添加案例”上传回站点。", indent_first=21)

    # ---- 二、可视化理解 ----
    h1(doc, "二", "可视化理解")
    h2(doc, "2.1　工程决策为什么需要可视化")
    p(doc, "石油工程里的决策，难点往往不在“算不出来”，而在“算出来也说不清”。我在做这六个案例的过程中，反复撞到三种失败模式：", indent_first=21)
    bullet(doc, "同一个方案，两个人给出的评价不同，因为各自心里的指标权重不一样，却没有把权重摆到桌面上。", bold_head="口径不一：")
    bullet(doc, "射孔参数有孔密、相位、孔径、段长四个维度，每维十几个取值，组合上万；工程师只能凭经验挑几组试算。", bold_head="参数爆炸：")
    bullet(doc, "预测只给一个数，读者无法判断这个数有多可靠、超出多远会失效。", bold_head="单点结论：")
    p(doc, "可视化要解决的正是这三件事：把权重显性化、把搜索空间摊开、把不确定性画成宽度。所以本项目不追求“图多”，"
           "而是要求每张图回答一个具体问题。", indent_first=21, before=2)

    h2(doc, "2.2　可视化的三个层次")
    p(doc, "做完六个案例后，我把案例里的图归成三层，这个分层也成了页面组织的依据：", indent_first=21)
    add_table(doc,
              ["层次", "回答的问题", "本项目的做法", "例子"],
              [["结构可视化", "对象长什么样", "手写 SVG 工程示意：井筒、射孔孔眼、管柱、滑套、裂缝", "co1 井筒示意、co4 三层滑套剖面"],
               ["过程可视化", "结果是怎么算出来的", "把中间量摊开：加权矩阵、搜索散点、逐段积分曲线、可行性带", "co1 决策矩阵热图、co3 37 档扫描带"],
               ["决策可视化", "为什么选它、边界在哪", "推荐卡 + 风险等级 + 置信度 + 经验方案对比 + 不可行提示", "六个案例的右栏结论区"]],
              [2.8, 4.0, 6.4, 3.4], size=8.5, first_col_bold=True)
    caption(doc, "表 2　案例可视化的三个层次")
    p(doc, "三层缺一不可。只有结构图，是本教科书插图；只有过程图，读者不知道这些点跟他有什么关系；"
           "只有结论卡，就退回到“我给你一个答案”的黑箱。", indent_first=21)

    h2(doc, "2.3　三个具体例子")
    p(doc, "例一：co1 的决策矩阵热图。左侧五个方案、上方五项指标，格子的深浅是加权后的得分。"
           "在文字里解释“防砂优先会改变排序”需要一段话；在热图上，读者把权重档从“均衡”切到“防砂优先”，"
           "会看到“压裂完井”那一行的颜色整体变深、名次从第三跳到第一，而综合得分从 71.3 变成 78.4、"
           "置信度从 96% 掉到 75%——置信度下降本身就说明“这个排序对权重变敏感了”，这一点比结论更有价值。", indent_first=21)
    p(doc, "例二：co3 的可行性带。横轴是 37 档下入速度，每一档是一根细柱，绿色表示同时满足安全系数与钩载上下限，红色表示越界；"
           "下方叠一条最小安全系数曲线。读者不需要读公式就能看出：往右走速度更快、用时更短，但安全裕度单调下降，"
           "绿带右端就是“再快就不敢下”的那一档。把“下得下去吗”这个只能靠老师傅经验回答的问题，变成了一条可指认的边界。", indent_first=21)
    p(doc, "例三：co4 的分层产液堆叠面积。固定开度与滚动调控两条曲线同屏，下面是三层各自的产液贡献。"
           "当含水开始上升，堆叠面积会显示是哪一个层的面积在变宽——如果只看全井含水曲线，只能知道“水多了”，"
           "看分层面积才知道“是底部那层突进”。这直接决定了滑套该关哪一层。", indent_first=21)

    h2(doc, "2.4　一条原则：好图要“允许被读错”")
    p(doc, "做这套图最大的体会是：图必须携带足够的信息，以至于读者可能读错，才证明它在传递信息。"
           "如果一个图无论参数怎么调都长得一样，那它只是装饰。为此我给每个案例都加了一行“本轮中间量”"
           "（评估组数、可行率、领先分差、拟合优度 R² 等），参数一动数字就变——这一行既是给读者的证据，"
           "也是给我自己的自检：如果它不变，说明这段代码并没有真正接到算法上。", indent_first=21)
    p(doc, "pr2 的 R² 就是这么被抓出来的：初版页面写着 0.94，接入实时残差计算后只有 0.682。"
           "承认这个数字不好看，比留一个漂亮的假数字更接近工程实际。", indent_first=21)

    # ---- 三、技术及效果 ----
    h1(doc, "三", "所用可视化技术及效果")
    h2(doc, "3.1　图表类型与技术选型")
    p(doc, "全部图表用 D3 v7.9 手写，不依赖任何图表库封装，也不使用 CDN（d3.v7.min.js 随包分发）。"
           "这样做的代价是代码量大，好处是每一根线、每一个色阶都能按工程语义定制。", indent_first=21)
    add_table(doc,
              ["技术 / 图型", "用在哪", "为什么选它"],
              [["雷达图", "co1", "五个方案在五项指标上的形状差异，比五组柱状图更快看出“偏科”"],
               ["决策矩阵热图", "co1", "方案 × 指标的加权得分，用顺序色阶同时表达高低与结构"],
               ["分组柱状图", "co1、pr2", "方案得分 / 情景累产的直接比较"],
               ["热力图 + d3.contours() 等高线", "co2、e1", "把“产能”和“风险”两个连续场叠在一张图上，等高线直接成为不可逾越的边界"],
               ["搜索散点（含阈值线与选中点）", "co2、co4、e1、pr2", "把整个搜索面摊开：读者看得见算法“看过哪些组合”，而不是只看到最后选中的那个"],
               ["折线 / 面积 / 堆叠面积", "co3、co4、pr2", "钩载、产油、含水、分层贡献随时间变化"],
               ["可行性带", "co3", "一维扫描的离散结果 + 连续阈值曲线叠加，一次说清“窗口在哪”"],
               ["Tornado 图", "e1", "四个参数敏感性的排序，条形长度即影响幅度"],
               ["手写 SVG 工程示意", "六个案例", "井筒、射孔、管柱、滑套、裂缝——这些对象没有现成图表类型，只能画"],
               ["动画回放（播放/暂停/单步/拖动）", "co3、co4、e1", "下入过程、30 天调控、泵注过程都是时序事件，静态图表达不了“过程”"]],
              [4.6, 3.6, 8.0], size=8.5, first_col_bold=True)
    caption(doc, "表 3　主要可视化技术与用途")

    h2(doc, "3.2　交互技术")
    bullet(doc, "滑块实时重算：拖动即重算，不做防抖延迟，六个案例的单次计算都在毫秒级（最大 9261 组枚举），因此交互是连续的。", bold_head="参数驱动：")
    bullet(doc, "左右栏 sticky 吸附、中栏随页面滚动，保证“调参—看图—读结论”在同一视野；599px 以下才堆叠成单列。", bold_head="三栏布局：")
    bullet(doc, "图表右上角 ⤢ 按钮与双击放大，Esc 或点遮罩退出；D3 后渲染的图由 MutationObserver 自动补挂按钮。", bold_head="放大：")
    bullet(doc, "co3 下入回放按当前深度截断数据并插值补端点，井眼画浅色、已下入管柱画深色，钩载与安全系数曲线同时只亮已下入段。", bold_head="回放：")
    bullet(doc, "所有图表用 SVG viewBox 自适应容器宽度；类名统一 .iq 前缀，根容器 .iqd，不污染主站样式。", bold_head="响应式与隔离：")

    h2(doc, "3.3　效果")
    p(doc, "效果可以从三个角度衡量：读者能不能自己得出结论、结论是否随参数变化、以及这套东西是否经得起复现。", indent_first=21)
    add_table(doc,
              ["角度", "具体表现"],
              [["可读性", "方法说明卡从“两百字讲方法”改为“先看图再读原理”，读者第一眼看到的是搜索空间与阈值线，而不是术语表"],
               ["可核查性", "每个案例方法卡下有“本轮中间量”：评估组数、可行组数、可行率、领先分差、R²；参数一动即变"],
               ["可对比性", "co1 综合得分 71.3→78.4、置信度 96%→75%；co4 固定开度与滚动调控同屏；e1 经验参数与推荐参数分列"],
               ["诚实性", "co3 无可行档时给“参考解”并指出卡住的约束；co4 不可达时给红条与最接近方案；e1 区分压力/砂堵/两者越界"],
               ["可复现性", "6/6 案例构建与语法检查通过；挂载、调参、AI 按钮、回放控件 6/6 通过；13 条路由渲染正常；控制台错误 0"],
               ["可移植性", "纯前端、D3 本地化、hash 路由，双击 index.html 即可离线运行；案例包可单包上传回站点"]],
              [3.0, 12.8], size=8.5, first_col_bold=True)
    caption(doc, "表 4　可视化效果评估")
    p(doc, "我判断一张图是否有效，用的自检办法是“遮住说明文字只看图”：能不能在一句话内回答一个工程问题。"
           "co3 的可行性带能做到——绿带右端就是“再快不敢下”的那一档，红色只出现在下半段是因为速度越高、"
           "轴向摩阻与屈曲风险越集中。如果一张图遮住文字后什么问题都回答不了，我就重画，而不是再加一段解释。"
           "这也正是纯文字描述最难做到的部分。", indent_first=21, before=2)

    # ---- 四、课程建议 ----
    h1(doc, "四", "课程建议")
    p(doc, "以下建议来自这次从零做一个可视化案例网站的实际过程，按“最想先说”的顺序排列。", indent_first=21)
    bullet(doc, "课程要求的“专业背景 / 案例流程 / 案例演示”三部分非常清晰，但三者之间如何衔接没有说明。"
                "建议在课程材料里给一个衔接范式，例如“背景给出对象与约束 → 流程给出方法与数据 → 演示给出可调参数与判据”，"
                "学生就不会把三部分写成三篇互不相干的文章。", bold_head="1. 给三部分一个衔接范式：")
    bullet(doc, "这次最大的收获来自“算法必须真算”这条自加约束，但它并不是课程要求。建议把“参数改变后必须有可见变化”"
                "写成硬性验收项，并附一张检查方法（改一个参数，指出哪个数字变了），能有效避免交上来的是一组静态截图。",
           bold_head="2. 把“可交互”写成可验收的条目：")
    bullet(doc, "石油工程的数据大多拿不到，学生只能用合成数据。建议明确要求标注“哪些是合成、哪些来自文献”，"
                "并给一份公开来源清单（标准、行业公报、现场报道）。本项目按 API RP 19B、Dawson-Paslay 判据、"
                "中海油智能完井现场数据等逐项校核，过程本身就是很好的工程训练。", bold_head="3. 允许合成数据，但要求标注来源：")
    bullet(doc, "建议增加一次 10 分钟的中期评审，只看“你的核心函数是哪一个、参数改了哪里会变”。"
                "这个检查能在早期暴露出“页面很漂亮但没接算法”的问题，返工成本比结课时低得多。", bold_head="4. 中期加一次“核心函数”评审：")
    bullet(doc, "建议给一个最小的案例包接口约定（清单字段 + 目录结构），并保留旧版本兼容。"
                "这样同学之间的案例可以直接互相导入、互相评审，而不是每人一个孤岛。", bold_head="5. 统一案例包接口：")
    bullet(doc, "可视化部分目前偏“工具教学”，建议补一节“图的选择”：什么关系用散点、什么关系用等高线、"
                "什么时候该画不确定性区间。工具会过时，选择图的判断力不会。", bold_head="6. 补一点“图的选择”教学：")

    # ---- 五、收获与不足 ----
    h1(doc, "五", "收获与不足")
    p(doc, "收获有三点。第一，理解了“可视化是一种论证方式”，不是排版装饰：一张等高线能替代一段关于风险边界的文字，"
           "而且更难被含糊过去。第二，理解了工程软件的诚实性——不可行时要说不可行，预测要给区间，"
           "置信度要能被追问。第三，理解了“可维护”也是设计的一部分：六个案例共用一套 CSS、一份 D3、一个构建脚本，"
           "改一处样式六个包同时生效，否则六个案例会很快变成六份互相矛盾的代码。", indent_first=21)
    p(doc, "不足也很明确。一是数据仍是合成的，代理模型由物理关系式拟合，未经实测标定，页面上的数值只能体现趋势；"
           "二是覆盖不全，13 个环节里仍有 7 个环节没有案例，下游的修井、运输、加工基本空白；"
           "三是模型深度有限，co3 的异常检测还是滑动平均残差，没有换成可学习模型；"
           "四是移动端只做到“不破版”，图表本身没有针对窄屏做简化，信息密度仍偏高。"
           "这些边界在网站的“项目说明”页里逐条写明，我认为把边界写出来，比把边界藏起来更负责任。", indent_first=21)

    path = os.path.join(OUT, "结课报告.docx")
    doc.save(path)
    return path


# ============================================================
# 文档三：视频讲稿（≤5 分钟）
# ============================================================
def build_script():
    doc = init_doc(margin_top=2.2, margin_bottom=2.0)
    add_page_number_footer(doc, "视频讲稿　—　")

    p(doc, "《石油智能化案例地图》演示视频 · 讲解稿", size=16, bold=True, font=HEAD_FONT,
      align="center", before=10, after=2)
    p(doc, "成片 4 分 36 秒　|　1600×900 真实录屏　|　中文配音，无真人出镜",
      size=9.5, color=INK2, align="center", after=6)

    callout(doc, "成片说明",
            "① 全部画面由 Edge 无头浏览器实际打开本地站点录制，拖权重、扫敏感性、播下入回放、切固定/AI、"
            "跑 30 天调控、拖 ZIP 进上传框，都是真实操作，不是后期合成；"
            "② 配音用系统中文语音逐段合成，按分镜对齐，全片无背景音乐，避免盖住“可行档 28/37”这类数字；"
            "③ 录制前六个案例均已预渲染，画面里不会出现加载白屏；"
            "④ 视频文件名：网站亮点演示视频.mp4，与本文档同目录。")

    rows = [
        ["00:04–00:26", "网站首页，滚到 13 个环节横条，鼠标停在「完井」格",
         "这是我做的石油智能化案例地图。学号尾号 07，对应第 7 个环节完井，四个子场景全做，"
         "另外补了压裂和产量预测两个扩展案例。首页这 13 格就是完整的作业链，我负责的完井在这里，标了“必做”。"],
        ["00:26–00:54", "进入 co1，滚到三栏决策台，切“均衡 → 防砂优先 → 投资优先”",
         "先看完井方式优选。右侧是五项指标和权重档。我把权重从“均衡”切到“防砂优先”，综合得分从 71.3 变成 78.4，"
         "但置信度从 96% 掉到 75%。置信度下降不是缺点，它是在告诉我：这个排序对权重很敏感，换个人拍板结论可能就变了。"],
        ["00:54–01:21", "滚到敏感性筹码，点“扫描排序变化”，10 组扰动逐项亮起",
         "方法卡第一屏不是文字，是算法自己的图。这张热图是五个方案乘五项指标的加权矩阵，哪一格深，方案的优势就在哪一列。"
         "下面这十组扰动是给权重加减 25%，看第一名会不会翻。现在是十组扰动全部稳定，说明在当前参数下这个排序比较扎实。"],
        ["01:21–01:50", "进入 co2，停在搜索散点，相位 60° → 120° → 45° → 90°",
         "射孔参数设计。这张散点图上的每个点，都是一组“孔密乘段长”的真实试算结果，一共 399 个。绿色是风险阈值以内的，"
         "红色是越界的。我拖一下相位，整个点云会整体移动——这就是算法在重新算，不是在放动画。"
         "右上是推荐参数，下面是评估了多少组、多少组可行。"],
        ["01:50–02:22", "进入 co3，指绿带右端，播放下入回放，钩载曲线随深度生长",
         "管柱受力分析，这是我个人最喜欢的一页。横轴是 37 档下入速度，绿色是可以下的，红色是不能下的，"
         "下面这条线是每一档对应的最小安全系数。往右走速度更快、用时更短，但裕度单调下降，绿带的右端就是极限。"
         "点播放，管柱会随深度一段一段下去，钩载和安全系数曲线只亮已经下入的那一段。"],
        ["02:22–02:49", "进入 co4，切“固定开度 / AI 动态”，跑 30 天回放，滚到分层面积",
         "智能完井滑套控制。同一个目标产量，固定开度和滚动调控放在一起比。播放 30 天，含水开始上升的时候，"
         "看下面这块分层面积——不是全井含水涨了，是底部那一层在出水。这直接决定滑套该关哪一层，"
         "只看总含水是看不出来的。"],
        ["02:49–03:01", "进入 e1，停在 Tornado 图，鼠标沿条形扫过",
         "两个扩展案例。压裂这页有 Tornado 图，四个参数谁更敏感，条形长度直接给答案。"],
        ["03:01–03:27", "进入 pr2，停在方法卡中间量，R² 数字被框出",
         "产量预测这页我特别想说的是这个数字：拟合优度 R² 等于 0.682，不好看，但它是按 120 天历史残差实时算出来的。"
         "初版我手填了 0.94，接上计算以后就露馅了。所以我更愿意把它留着，顺便解释那条 ±17% 的区间带为什么必须画。"],
        ["03:27–03:39", "案例库逐行勾选 co1—pr2 六个复选框",
         "六个案例共用一套外壳：案例头、三个页签、三栏决策台和结论区。所以它们可以横向比。"],
        ["03:39–03:55", "对比页，六列指标横向排开，鼠标扫过表格",
         "在案例库勾选六个，生成这张对比表：参数数、图表数、核心交互、一句话价值。"
         "这是我理解的“平台”，不是六个孤立的网页。"],
        ["03:55–04:15", "打开“添加案例”弹窗，ZIP 拖入后出现文件清单与校验结果",
         "最后一句讲扩展性。每个案例是一个自包含的包，拖一个 zip 进来就能校验、预览、保存，旧版本的包也兼容。"],
        ["04:15–04:34", "回到首页英雄区，鼠标停住，画面定格 1 秒后切片尾",
         "整站纯前端，D3 是本地文件，双击 index.html 就能离线跑。"
         "我想做的不是把结论画得好看，而是把“为什么是这个结论、它什么时候会失效”摆在明面上。谢谢。"],
    ]
    add_table(doc, ["时间码", "画面", "口播（逐字稿）"], rows, [2.6, 5.2, 8.0], size=8.5,
              align_center_cols=(0,))

    h2(doc, "时间轴核算")
    p(doc, "12 段配音合计 4 分 00 秒；加上片头 4 秒、每段之间 1—2 秒的操作留白、片尾 2.5 秒，"
           "成片 4 分 36 秒，满足“不超过 5 分钟”。若课堂放映需要压到 4 分钟，优先删 co2 的重复解释"
           "与上传段的补充说明；不建议删 co3 或 pr2 两段，它们分别承载“约束边界”和“诚实性”两个核心论点。",
      indent_first=21)

    h2(doc, "备用问答（答辩可能被追问）")
    qa = [
        ("这些数据是真的吗？", "不是。示范计算用的是合成数据，代理模型由物理关系式拟合。但参数区间、器材指标和现场效果"
                              "按 API RP 19B、Dawson-Paslay 判据、中海油智能完井现场数据、长 7 与吉木萨尔压裂参数、"
                              "中国石化递减率公报逐项校核过。页面上“合成”和“文献”是分开写的。"),
        ("算法是你写的吗？", "是。六个案例各有一个核心函数，co1 是 TOPSIS 加权重扰动，co2 是代理模型加四维网格搜索，"
                          "co3 是逐段受力积分加速度扫描，co4 是分层产能模型加 9261 组枚举，e1 是裂缝代理模型加双约束，"
                          "pr2 是指数递减加协变量耦合。图表全部读这些函数的返回值。"),
        ("为什么置信度会掉？", "因为权重变了。co1 的置信度不是模型精度，是排序的稳定性：十组权重扰动里有几组第一名不翻。"
                            "翻得越多，置信度越低。它衡量的是“这个结论有多依赖你现在的偏好”。"),
        ("如果算不出可行解呢？", "如实说算不出来。co3 会改成“参考解”并指出是安全系数还是钩载卡住；co4 会给红条和最接近的方案；"
                             "e1 会区分施工压力超限、砂堵、还是两者同时超限。工程软件最危险的是永远给你一个答案。"),
    ]
    for q, a in qa:
        rich(doc, [("问：" + q, True, BROWN)], size=9.5, after=1, align="left")
        p(doc, "答：" + a, size=9.5, indent_first=0, after=6)

    path = os.path.join(OUT, "视频讲稿.docx")
    doc.save(path)
    return path


if __name__ == "__main__":
    for fn in (build_highlights, build_report, build_script):
        print("saved:", fn())
