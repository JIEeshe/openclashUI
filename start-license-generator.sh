#!/bin/bash

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "      雷雨传媒 - 卡密管理系统"
echo "=========================================="
echo ""

echo -e "${BLUE}🚀 正在启动卡密管理系统...${NC}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误：未检测到 Node.js${NC}"
    echo ""
    echo "请先安装 Node.js："
    echo "1. 访问 https://nodejs.org/"
    echo "2. 下载并安装最新版本的 Node.js"
    echo "3. 重新运行此脚本"
    echo ""
    read -p "按 Enter 键退出..."
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本: $(node --version)${NC}"

# 检查 npm 是否可用
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 错误：未检测到 npm${NC}"
    echo ""
    echo "npm 通常与 Node.js 一起安装，请重新安装 Node.js"
    echo ""
    read -p "按 Enter 键退出..."
    exit 1
fi

echo -e "${GREEN}✅ npm 版本: $(npm --version)${NC}"

# 检查 Electron 是否安装
if [ ! -d "node_modules/electron" ]; then
    echo -e "${YELLOW}📦 正在安装依赖包...${NC}"
    echo ""
    
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 依赖包安装失败${NC}"
        echo ""
        read -p "按 Enter 键退出..."
        exit 1
    fi
    
    echo -e "${GREEN}✅ 依赖包安装完成${NC}"
    echo ""
fi

# 检查必要文件是否存在
if [ ! -f "license-generator-main.js" ]; then
    echo -e "${RED}❌ 错误：找不到 license-generator-main.js 文件${NC}"
    echo ""
    read -p "按 Enter 键退出..."
    exit 1
fi

if [ ! -f "license-generator.html" ]; then
    echo -e "${RED}❌ 错误：找不到 license-generator.html 文件${NC}"
    echo ""
    read -p "按 Enter 键退出..."
    exit 1
fi

if [ ! -f "license-manager.js" ]; then
    echo -e "${RED}❌ 错误：找不到 license-manager.js 文件${NC}"
    echo ""
    read -p "按 Enter 键退出..."
    exit 1
fi

# 启动卡密管理系统
echo -e "${BLUE}🎫 启动卡密管理系统...${NC}"
echo ""

# 设置环境变量
export NODE_ENV=production

# 启动应用
npx electron license-generator-main.js

# 检查退出状态
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ 卡密管理系统启动失败${NC}"
    echo ""
    echo "可能的解决方案："
    echo "1. 确保所有依赖包已正确安装"
    echo "2. 检查所有必要文件是否存在"
    echo "3. 尝试重新安装 Electron: npm install electron"
    echo "4. 检查系统是否支持图形界面"
    echo ""
else
    echo ""
    echo -e "${GREEN}✅ 卡密管理系统已关闭${NC}"
    echo ""
fi

read -p "按 Enter 键退出..."
