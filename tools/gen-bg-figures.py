# -*- coding: utf-8 -*-
"""
为六个案例的「专业背景」第 2/3/4 段各生成一张概念图，写回 case.json。

三种原型（同一套配色与排版，切换内容即得新图）：
  A 方法链路图  —— 五段式：输入 → 变换 → 模型 → 判据 → 输出
  B 数据结构图  —— 一张示意表 + 三项口径注解
  C 难点与路线  —— 左侧难点定位条 + 右侧改进路线阶梯

用法：python tools/gen-bg-figures.py
只改本文件里的 CONTENT，然后重跑；再跑 node tools/build-cases.js 同步插件。
"""
import json, io, os

# ---------------------------------------------------------------- 配色
C = dict(
    paper='#ffffff', panel='#fbfaf6', line='#e6e0d2', line2='#f0ece1',
    ink='#242b2e', ink2='#4d565b', ink3='#79828a', ink4='#9ba3a9',
    jade='#1e6f5c', clay='#b06a3b', amber='#a9852f', bad='#a85249',
)

MONO = "monospace"
SANS = "sans-serif"


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def txt(x, y, s, size=9, fill=None, anchor='start', family=SANS, ls=None, weight=None):
    a = ' text-anchor="%s"' % anchor if anchor != 'start' else ''
    l = ' letter-spacing="%s"' % ls if ls else ''
    w = ' font-weight="%s"' % weight if weight else ''
    return ("<text x='%s' y='%s' font-size='%s'%s fill='%s' font-family='%s'%s>%s</text>"
            % (x, y, size, w, fill or C['ink2'], family, a + l, esc(s)))


def wrap(s, limit):
    """按字符数切成最多两行（中文按 1 字算）。"""
    if len(s) <= limit:
        return [s]
    half = (len(s) + 1) // 2
    return [s[:half], s[half:]]


# ---------------------------------------------------------------- 原型 A
def fig_chain(head, chips):
    W, H = 640, 122
    o = ["<svg viewBox='0 0 %d %d' xmlns='http://www.w3.org/2000/svg' role='img'>" % (W, H),
         "<rect x='0' y='0' width='%d' height='%d' fill='%s'/>" % (W, H, C['paper']),
         txt(14, 18, head, 8, C['ink4'], family=MONO, ls='1.2')]
    cw, gap, y, ch = 112, 13, 30, 68
    for i, (title, sub) in enumerate(chips):
        x = 14 + i * (cw + gap)
        first, last = (i == 0), (i == len(chips) - 1)
        stroke = C['jade'] if (first or last) else C['line']
        o.append("<rect x='%d' y='%d' width='%d' height='%d' rx='5' fill='%s' stroke='%s' stroke-width='%s'/>"
                 % (x, y, cw, ch, C['panel'], stroke, '1.1' if (first or last) else '.9'))
        o.append(txt(x + 9, y + 15, '%02d' % (i + 1), 8, C['ink4'], family=MONO, ls='.8'))
        o.append(txt(x + 9, y + 32, title, 10.5, C['ink'], weight='500'))
        for j, line in enumerate(wrap(sub, 12)):
            o.append(txt(x + 9, y + 47 + j * 11, line, 8.2, C['ink3']))
        if i < len(chips) - 1:
            ax = x + cw + 2
            o.append("<path d='M%d %d h7 m-3 -3 l3 3 l-3 3' fill='none' stroke='%s' stroke-width='1'/>"
                     % (ax, y + ch // 2, C['ink4']))
    o.append("</svg>")
    return ''.join(o)


# ---------------------------------------------------------------- 原型 B
def fig_table(head, cols, rows, notes):
    W, H = 640, 186
    left, right = 14, 626
    tw = right - left
    # 列宽：按最长文本加权
    weights = []
    for i, c in enumerate(cols):
        mx = max([len(c)] + [len(str(r[i])) for r in rows])
        weights.append(max(mx, 6))
    tot = float(sum(weights))
    widths = [int(tw * w / tot) for w in weights]
    widths[-1] = tw - sum(widths[:-1])
    xs = [left]
    for w in widths[:-1]:
        xs.append(xs[-1] + w)

    o = ["<svg viewBox='0 0 %d %d' xmlns='http://www.w3.org/2000/svg' role='img'>" % (W, H),
         "<rect x='0' y='0' width='%d' height='%d' fill='%s'/>" % (W, H, C['paper']),
         txt(14, 18, head, 8, C['ink4'], family=MONO, ls='1.2')]

    hy, hh, rh = 28, 22, 24
    o.append("<rect x='%d' y='%d' width='%d' height='%d' fill='%s' stroke='%s'/>"
             % (left, hy, tw, hh, '#f1ede2', C['line']))
    for i, c in enumerate(cols):
        o.append(txt(xs[i] + widths[i] // 2, hy + 15, c, 8.6, C['ink2'], anchor='middle', family=MONO, ls='.3'))
    for r, row in enumerate(rows):
        ry = hy + hh + r * rh
        fill = C['paper'] if r % 2 == 0 else C['panel']
        o.append("<rect x='%d' y='%d' width='%d' height='%d' fill='%s' stroke='%s' stroke-width='.7'/>"
                 % (left, ry, tw, rh, fill, C['line2']))
        for i, v in enumerate(row):
            o.append(txt(xs[i] + widths[i] // 2, ry + 16, str(v), 9, C['ink2'], anchor='middle'))
    for x in xs[1:]:
        o.append("<line x1='%d' y1='%d' x2='%d' y2='%d' stroke='%s' stroke-width='.7'/>"
                 % (x, hy, x, hy + hh + len(rows) * rh, C['line2']))

    ny = hy + hh + len(rows) * rh + 22
    for i, (k, v, tone) in enumerate(notes):
        x = left + i * 204
        o.append("<rect x='%d' y='%d' width='7' height='7' rx='1.5' fill='%s'/>" % (x, ny - 7, tone))
        o.append(txt(x + 12, ny, k, 8, C['ink4'], family=MONO, ls='.6'))
        o.append(txt(x + 12, ny + 12, v, 9.2, C['ink2']))
    o.append("</svg>")
    return ''.join(o)


# ---------------------------------------------------------------- 原型 C
def fig_route(head, pains, routes):
    W, H = 640, 178
    o = ["<svg viewBox='0 0 %d %d' xmlns='http://www.w3.org/2000/svg' role='img'>" % (W, H),
         "<rect x='0' y='0' width='%d' height='%d' fill='%s'/>" % (W, H, C['paper']),
         txt(14, 18, head, 8, C['ink4'], family=MONO, ls='1.2')]

    # 左：难点定位
    o.append(txt(14, 40, '难点定位', 9, C['ink2'], weight='500'))
    for i, (name, sev) in enumerate(pains):
        y = 60 + i * 26
        o.append(txt(14, y + 3, name, 9, C['ink2']))
        o.append("<rect x='118' y='%d' width='150' height='7' rx='3.5' fill='%s'/>" % (y - 4, C['line2']))
        tone = C['bad'] if sev >= 0.7 else (C['clay'] if sev >= 0.55 else C['amber'])
        o.append("<rect x='118' y='%d' width='%d' height='7' rx='3.5' fill='%s'/>"
                 % (y - 4, int(150 * sev), tone))
        o.append(txt(276, y + 3, '%d' % round(sev * 100), 8, C['ink4'], family=MONO))

    o.append("<line x1='300' y1='34' x2='300' y2='152' stroke='%s' stroke-dasharray='2 3'/>" % C['line'])

    # 右：改进路线（成本递增的阶梯，用成本轴代替穿行的斜线）
    o.append(txt(318, 40, '改进路线（成本递增）', 9, C['ink2'], weight='500'))
    bw, bh, gap = 94, 34, 10
    xs = [318 + i * (bw + gap) for i in range(3)]
    ys = [100, 70, 40]
    o.append("<line x1='318' y1='148' x2='620' y2='148' stroke='%s' stroke-width='.8'/>" % C['line'])
    for x in xs:
        cx = x + bw // 2
        o.append("<line x1='%d' y1='148' x2='%d' y2='153' stroke='%s' stroke-width='.8'/>" % (cx, cx, C['line']))
    o.append(txt(318, 166, '低成本', 7.6, C['ink4'], family=MONO, ls='.5'))
    o.append(txt(620, 166, '高成本', 7.6, C['ink4'], anchor='end', family=MONO, ls='.5'))
    for i, (name, cost) in enumerate(routes):
        x, y = xs[i], ys[i]
        tone = C['jade'] if i == 0 else (C['clay'] if i == 1 else C['bad'])
        o.append("<rect x='%d' y='%d' width='%d' height='%d' rx='4' fill='%s' stroke='%s' stroke-width='.9'/>"
                 % (x, y, bw, bh, C['panel'], C['line']))
        o.append("<rect x='%d' y='%d' width='3' height='%d' rx='1.5' fill='%s'/>" % (x, y, bh, tone))
        o.append(txt(x + 11, y + 15, name, 9.2, C['ink'], weight='500'))
        o.append(txt(x + 11, y + 28, cost, 8, C['ink4'], family=MONO))
        o.append("<line x1='%d' y1='%d' x2='%d' y2='148' stroke='%s' stroke-dasharray='2 3'/>"
                 % (x + bw // 2, y + bh, x + bw // 2, C['line']))
    o.append("</svg>")
    return ''.join(o)


def figure(svg, no, cap):
    return ("<figure style='margin:12px 0 0'>" + svg +
            "<figcaption style='font-size:10.5px;color:#9ba3a9;margin-top:5px'>图 %d · %s</figcaption></figure>" % (no, cap))


# ---------------------------------------------------------------- 内容
# chips: (标题, 副标题)   cols/rows   pains/routes
CONTENT = {
'completion-method-selection': dict(
    chain_head='TOPSIS 决策链路 · 从参数表到方案排序',
    chips=[('决策矩阵', '5 方案 × 5 指标'), ('归一化', '成本指标逆向'), ('加权求和', '权重可调'),
           ('理想解距离', '正解 / 负解'), ('贴近度排序', '0—1 可比较')],
    chain_cap='五项指标先压到 0—1 同一量纲，再比较每个方案与「最理想点」的距离；排序结果对权重敏感，所以最后一步必须回到人。',
    table_head='决策表结构 · 一行一个候选方案',
    cols=['井号 / 方案', '储层参数', '流体参数', '商务约束', '指标得分'],
    rows=[['A-12 裸眼', '孔隙度 18% / 渗透率 45 mD', '黏度 8 mPa·s', '预算 320 万', '0.41 / 0.55 …'],
          ['A-12 射孔', '同上', '同上', '同上', '0.62 / 0.71 …'],
          ['A-12 筛管', '同上', '同上', '同上', '0.58 / 0.83 …']],
    notes=[('样本量', '5 方案 × 5 指标 = 25 格', C['jade']),
           ('标注成本', '无需训练，只需口径确认', C['amber']),
           ('口径风险', '渗透率 / 压力必须同基准', C['bad'])],
    table_cap='决策表的每一行是一个候选方案，最后一组是算出来的指标；同一口井的三行共用储层与流体参数，只差完井方式。',
    route_head='难点定位与三条改进路线',
    pains=[('权重主观', .72), ('指标口径不一', .55), ('邻井不可迁移', .80)],
    routes=[('权重情景扫描', '成本 低'), ('口径字典固化', '成本 低'), ('邻井标定校准', '成本 高')],
    route_cap='权重靠人给、口径靠人算、邻井靠人搬——三条路线分别把这三处主观性换成可复现的流程。',
),
'perforation-parameter-design': dict(
    chain_head='代理模型 + 约束搜索 · 从四维参数到推荐组合',
    chips=[('参数网格', '四维组合'), ('代理模型', '毫秒级预测'), ('双目标输出', '日产 + 风险'),
           ('约束筛选', '风险阈值'), ('帕累托集', '推荐 + 备选')],
    chain_cap='数值模拟跑一组参数要几分钟，代理模型把它压到毫秒，才可能在网格上穷举；搜索的结果不是一个点，而是一条「产能—风险」前沿。',
    table_head='射孔参数表结构 · 一行一个候选段',
    cols=['井段 (m)', '孔密 (孔/m)', '相位 (°)', '孔径 (mm)', '段长 (m)'],
    rows=[['3120—3136', '16', '60', '10.0', '16'],
          ['3120—3136', '20', '90', '12.0', '16'],
          ['3136—3152', '16', '120', '10.0', '16']],
    notes=[('样本量', '网格 6×4×3×3 = 216 组', C['jade']),
           ('标注成本', '需历史井产量做监督', C['amber']),
           ('口径风险', '孔密按孔/m，勿混孔数', C['bad'])],
    table_cap='孔密、相位、孔径、段长四个维度决定了孔眼在地层里的分布；同一井段换一组参数，产能与出砂风险同时变化。',
    route_head='难点定位与三条改进路线',
    pains=[('参数强耦合', .75), ('风险阈值缺标定', .70), ('网格维度爆炸', .60)],
    routes=[('降维 + 粗筛', '成本 低'), ('风险模型标定', '成本 中'), ('代理模型主动学习', '成本 高')],
    route_cap='先在低维粗筛把 216 组砍到几十组，再用实测井标定风险阈值，最后用主动学习补样本——这是低成本到高成本的三级台阶。',
),
'completion-string-stress-analysis': dict(
    chain_head='受力积分 + 异常检测 · 从测斜到风险井段',
    chips=[('测斜序列', '井深等间距'), ('分段积分', '自重 + 摩阻'), ('钩载 / 应力', '安全系数'),
           ('残差检测', '阈值分段'), ('风险井段', '位置 + 区间')],
    chain_cap='管柱在井下受的力看不见，只能沿井深逐段积分算出来；算出的安全系数曲线再交给异常检测，才能定位到具体井段。',
    table_head='管柱受力表结构 · 一行一个井深点',
    cols=['井深 (m)', '井斜 (°)', '线重 (N/m)', '钢级', '摩阻系数'],
    rows=[['1200', '8.4', '286', 'N80', '0.24'],
          ['1240', '11.2', '286', 'N80', '0.24'],
          ['1280', '17.6', '286', 'N80', '0.31']],
    notes=[('样本量', '每 40 m 一点，全井约 90 点', C['jade']),
           ('标注成本', '只需指重表读数做校验', C['amber']),
           ('口径风险', '摩阻系数分段取值', C['bad'])],
    table_cap='井斜角与摩阻系数是钩载曲线的两个主要输入：井斜变大、摩阻上调，同一段管柱的悬重就会被吃掉更多。',
    route_head='难点定位与三条改进路线',
    pains=[('摩阻系数不确定', .80), ('狗腿度突变', .58), ('指重表漂移', .50)],
    routes=[('摩阻反演', '成本 低'), ('阈值自适应', '成本 中'), ('钩载 / 扭矩融合', '成本 高')],
    route_cap='摩阻系数是最大的不确定源——先反演它，再让阈值随井段自适应，最后引入实时扭矩做融合，误差逐级收敛。',
),
'intelligent-sleeve-control': dict(
    chain_head='分层预测 + 约束优化 · 从开度组合到 30 天策略',
    chips=[('开度组合', '三层 0—100%'), ('分层产能', '产油 + 产水'), ('含水演化', '逐日上升'),
           ('约束寻优', '产水最小'), ('30 天策略', '逐日开度')],
    chain_cap='三层滑套各有 0—100% 开度，组合空间极大；优化的目标不是把今天的油做大，而是让 30 天的累产油最大、产水最少。',
    table_head='分层数据表结构 · 一行一个层段',
    cols=['层号', '产液指数', '初始含水', '压力 (MPa)', '滑套开度'],
    rows=[['L1', '2.4', '32%', '21.6', '100%'],
          ['L2', '1.7', '58%', '22.3', '60%'],
          ['L3', '0.9', '74%', '23.1', '40%']],
    notes=[('样本量', '3 层 × 30 天 × 开度网格', C['jade']),
           ('标注成本', '需产液剖面复测', C['amber']),
           ('口径风险', '分层贡献靠反演，非实测', C['bad'])],
    table_cap='三层物性差异明显：L1 产液强但含水低，L3 含水已到 74%。开度怎么分配，取决于每层「多产一吨油要多产多少水」。',
    route_head='难点定位与三条改进路线',
    pains=[('分层贡献不可测', .80), ('含水上升快', .64), ('滑套调节精度', .52)],
    routes=[('产液剖面复测', '成本 低'), ('含水滚动校正', '成本 中'), ('井下流量计闭环', '成本 高')],
    route_cap='分层贡献是反演出来的，误差会随含水上升放大；路线从「定期复测」到「闭环计量」，本质是在买更准的分层信息。',
),
'fracturing-parameter-optimization': dict(
    chain_head='裂缝代理 + 网格搜索 · 从施工参数到推荐泵注方案',
    chips=[('施工参数', '排量 / 液量 / 砂比'), ('裂缝代理', '缝长 + 缝高'), ('压力与风险', '超压 + 砂堵'),
           ('网格搜索', '剔除超限'), ('推荐方案', '帕累托集')],
    chain_cap='压裂设计的两难是「缝要长」和「压力别超」同时成立；代理模型把缝长、压力、砂堵风险一起算出来，才谈得上在网格里搜索。',
    table_head='施工参数表结构 · 一行一个候选方案',
    cols=['层段', '闭合压力 (MPa)', '滤失 (m³/min¹ᐟ²)', '厚度 (m)', '泵注能力 (m³/min)'],
    rows=[['3110—3140', '38.6', '0.0042', '28', '4.2'],
          ['3110—3140', '38.6', '0.0042', '28', '4.8'],
          ['3140—3170', '41.2', '0.0036', '24', '4.2']],
    notes=[('样本量', '网格 5×5×4 = 100 组', C['jade']),
           ('标注成本', '需小型压裂测试定滤失', C['amber']),
           ('口径风险', '闭合压力按实测，勿用估算', C['bad'])],
    table_cap='闭合压力与滤失系数决定了「同样的液量能造多长的缝」；厚度决定缝高向上延伸的风险，泵注能力是硬上限。',
    route_head='难点定位与三条改进路线',
    pains=[('滤失系数未知', .80), ('砂堵突发', .70), ('设备压力上限', .55)],
    routes=[('小型压裂测试', '成本 中'), ('压力实时反演', '成本 中'), ('砂比自适应控制', '成本 高')],
    route_cap='滤失系数差一倍，缝长就差三成——它必须靠测试或反演拿到；再往上走，才是把砂比交给实时闭环。',
),
'production-forecasting': dict(
    chain_head='递减 + 注水响应 · 从历史序列到带区间的预测',
    chips=[('历史序列', '分段清洗'), ('趋势分解', '递减率'), ('注水响应', '增油贡献'),
           ('外推预测', '点 + 区间'), ('制度优化', '累产最大')],
    chain_cap='产量下降不一定是自然递减——换油嘴、上措施、注水见效都会改变曲线；先把这些事件拆开，剩下的才是可外推的递减。',
    table_head='生产数据表结构 · 一行一天',
    cols=['日期', '产油 (t/d)', '产水 (t/d)', '油嘴 (mm)', '注水量 (m³/d)'],
    rows=[['2026-03-01', '18.4', '6.2', '6', '120'],
          ['2026-03-02', '18.1', '6.4', '6', '120'],
          ['2026-03-03', '12.6', '9.8', '8', '120']],
    notes=[('样本量', '单井 3 年约 1000 天', C['jade']),
           ('标注成本', '无需标注，需事件台账', C['amber']),
           ('口径风险', '关井 / 测试日必须剔除', C['bad'])],
    table_cap='第三行是典型的「制度变化」：油嘴从 6 mm 放到 8 mm，产油反而降、产水升——如果直接拿去拟合递减率，结论会全错。',
    route_head='难点定位与三条改进路线',
    pains=[('制度变化混杂', .76), ('数据缺失段', .60), ('长期外推发散', .80)],
    routes=[('事件分段清洗', '成本 低'), ('区间随步长展宽', '成本 中'), ('注采耦合约束', '成本 高')],
    route_cap='外推越远越不可信，这是物理限制而不是模型缺陷——所以区间必须随步长展宽，再往后要靠注采耦合机理把结果「拉住」。',
),
}

CASES = ['completion-method-selection', 'perforation-parameter-design', 'completion-string-stress-analysis',
         'intelligent-sleeve-control', 'fracturing-parameter-optimization', 'production-forecasting']

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for case in CASES:
    p = os.path.join(ROOT, case, 'case.json')
    d = json.load(io.open(p, encoding='utf-8'))
    cfg = CONTENT[case]
    secs = d['tabs']['background']['sections']
    assert len(secs) == 4, (case, len(secs))

    figs = [
        figure(fig_chain(cfg['chain_head'], cfg['chips']), 2, cfg['chain_cap']),
        figure(fig_table(cfg['table_head'], cfg['cols'], cfg['rows'], cfg['notes']), 3, cfg['table_cap']),
        figure(fig_route(cfg['route_head'], cfg['pains'], cfg['routes']), 4, cfg['route_cap']),
    ]
    for i, f in zip([1, 2, 3], figs):
        h = secs[i]['html']
        if '<figure' in h:      # 已有图则替换整段 figure
            import re
            h = re.sub(r"<figure[\s\S]*?</figure>", '', h).rstrip()
        secs[i]['html'] = h + f

    io.open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    n = sum(secs[i]['html'].count('<svg') for i in range(4))
    print('ok %-34s svg=%d  json=%.1f KB' % (case, n, os.path.getsize(p) / 1024.0))
