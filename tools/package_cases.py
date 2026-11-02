# -*- coding: utf-8 -*-
"""
把六个案例包分别压缩为提交用 zip。
每个压缩包内保留案例文件夹作为根目录：
    案例文件夹/case.json
    案例文件夹/demo/index.html
    案例文件夹/demo/demo.css
    案例文件夹/demo/demo.js
    案例文件夹/demo/d3.v7.min.js
    案例文件夹/demo/iq-viz.js

用法：在项目根目录执行 python tools/package_cases.py
（先跑 node tools/build-cases.js，确保 demo 里的共享文件已同步）
"""
import hashlib
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

CASES = [
    ("completion-method-selection", "完井-完井方式智能优选.zip"),
    ("perforation-parameter-design", "完井-射孔参数智能设计.zip"),
    ("completion-string-stress-analysis", "完井-完井管柱受力智能分析.zip"),
    ("intelligent-sleeve-control", "完井-智能完井滑套控制策略.zip"),
    ("fracturing-parameter-optimization", "增采-压裂参数智能优化.zip"),
    ("production-forecasting", "采油-产量智能预测.zip"),
]

FILES = [
    "case.json",
    "demo/index.html",
    "demo/demo.css",
    "demo/demo.js",
    "demo/d3.v7.min.js",
    "demo/iq-viz.js",
    "demo/iq-smart.js",
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    os.makedirs(DIST, exist_ok=True)
    failed = 0
    total = 0

    print("案例压缩包")
    print("-" * 60)

    for folder, zipname in CASES:
        src = os.path.join(ROOT, folder)
        out = os.path.join(DIST, zipname)
        missing = [rel for rel in FILES if not os.path.isfile(os.path.join(src, rel))]
        if missing:
            print("[x] %s：缺少 %s" % (folder, ", ".join(missing)))
            failed += 1
            continue

        # 读取 case.json，顺带做一次 JSON 合法性校验
        try:
            with open(os.path.join(src, "case.json"), "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception as exc:
            print("[x] %s：case.json 无法解析（%s）" % (folder, exc))
            failed += 1
            continue

        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for rel in FILES:
                z.write(os.path.join(src, rel), arcname=folder + "/" + rel)

        size = os.path.getsize(out)
        total += size
        digest = sha256(out)
        print("[ok] %s  (%s · %.1f KB · %d/%d 文件)" % (zipname, folder, size / 1024.0, len(FILES), len(FILES)))
        print("     scene=%s, id=%s, code=%s" % (meta.get("sceneId"), meta.get("id"), meta.get("code", "-")))
        print("     sha256=%s" % digest)

    print("-" * 60)
    if failed:
        print("失败 %d 个，请先修复。" % failed)
        return 1
    print("完成：%d 个压缩包，共 %.1f MB，输出目录 %s" % (len(CASES), total / 1024.0 / 1024.0, DIST))
    return 0


if __name__ == "__main__":
    sys.exit(main())
