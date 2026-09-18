# -*- coding: utf-8 -*-
"""
把 _data/recommendations.json 同步生成一份 _data/recommendations.js

为什么需要这一步？
    直接双击打开网页时用的是 file:// 协议，浏览器会硬性拦截 fetch 读本地
    JSON 文件（同源策略，纯前端无法绕过）。所以额外生成一份 .js 镜像，
    由 <script> 标签加载 —— 这种加载方式不受同源策略限制。

    正常部署到服务器后，页面会优先走 fetch 读 JSON，这份镜像用不到，
    留着不会有任何副作用。

用法：
    编辑完 _data/recommendations.json 后，双击「更新推荐数据.bat」即可。
    也可以直接运行：python sync-data.py
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, '_data', 'recommendations.json')
DST = os.path.join(ROOT, '_data', 'recommendations.js')

HEADER = (
    "/* 自动生成，请勿手动编辑。\n"
    " * 数据源：_data/recommendations.json\n"
    " * 改完 JSON 后，双击「更新推荐数据.bat」重新生成本文件。\n"
    " */\n"
)


def main():
    if not os.path.exists(SRC):
        print('[x] 找不到 %s' % SRC)
        return 1

    try:
        with io.open(SRC, encoding='utf-8') as f:
            data = json.load(f)
    except ValueError as e:
        print('[x] recommendations.json 格式有误，请检查：')
        print('    %s' % e)
        return 1

    songs = data.get('songs') if isinstance(data, dict) else data
    if not isinstance(songs, list):
        print('[x] 结构不对：应为数组，或 {"songs": [...]} 形式')
        return 1

    js = (HEADER
          + 'window.RECOMMENDATIONS = '
          + json.dumps(data, ensure_ascii=False, indent=2)
          + ';\n')

    # 用 utf-8-sig（带 BOM）写出，确保浏览器一定按 UTF-8 解码，中文不会乱码
    with io.open(DST, 'w', encoding='utf-8-sig') as f:
        f.write(js)

    print('[OK] 同步完成，共 %d 首歌' % len(songs))
    print('     %s' % os.path.relpath(SRC, ROOT))
    print('     -> %s' % os.path.relpath(DST, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
