#!/bin/bash

# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=========================================="
echo "  雷雨传媒网络配置管理工具 - 构建脚本"
echo "=========================================="
echo -e "${NC}"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: 未检测到 Node.js，请先安装 Node.js${NC}"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本:${NC}"
node --version
echo

# 检查npm是否可用
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 错误: npm 不可用${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm 版本:${NC}"
npm --version
echo

# 安装依赖
echo -e "${YELLOW}📦 正在安装依赖...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 依赖安装完成${NC}"
echo

# 检测操作系统并构建对应版本
OS="$(uname -s)"
case "${OS}" in
    Linux*)
        echo -e "${YELLOW}🔨 正在构建 Linux 应用程序...${NC}"
        npm run build-linux
        ;;
    Darwin*)
        echo -e "${YELLOW}🔨 正在构建 macOS 应用程序...${NC}"
        npm run build-mac
        ;;
    *)
        echo -e "${YELLOW}🔨 正在构建所有平台应用程序...${NC}"
        npm run dist
        ;;
esac

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
fi

echo
echo -e "${GREEN}✅ 构建完成！${NC}"
echo
echo -e "${BLUE}📁 安装包位置: dist/${NC}"
echo -e "${GREEN}🎉 您可以在 dist 文件夹中找到生成的安装程序${NC}"
echo

# 询问是否打开dist文件夹
read -p "是否打开 dist 文件夹? (y/n): " choice
case "$choice" in
    y|Y )
        if command -v xdg-open &> /dev/null; then
            xdg-open dist
        elif command -v open &> /dev/null; then
            open dist
        else
            echo "请手动打开 dist 文件夹查看构建结果"
        fi
        ;;
    * )
        echo "构建完成，退出脚本"
        ;;
esac
