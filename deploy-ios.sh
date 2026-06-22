#!/bin/bash
#
# 将 unpackage/resources 下的编译产物拷贝到 iOS HBuilder 项目中
# 用法：bash deploy-ios.sh
#

set -e

SRC="$(cd "$(dirname "$0")" && pwd)/unpackage/resources/__UNI__18F5913"
DST="/Users/zhanghaitao/iosProject/HBuilder-Hello/HBuilder-Hello/Pandora/apps/__UNI__18F5913"

if [ ! -d "$SRC" ]; then
    echo "错误：源目录不存在 $SRC"
    echo "请先执行编译（如 HBuilderX 发行 → 本地打包资源）"
    exit 1
fi

if [ ! -d "$DST" ]; then
    echo "错误：目标目录不存在 $DST"
    exit 1
fi

echo "源：$SRC"
echo "目标：$DST"
echo ""

# 删除目标目录下的旧文件，仅保留 www 内容
echo ">>> 清理目标目录..."
rm -rf "$DST"/*
echo ">>> 拷贝新文件..."
cp -R "$SRC"/* "$DST"/

echo ""
echo "完成！已替换 iOS 项目中的 app 资源。"
