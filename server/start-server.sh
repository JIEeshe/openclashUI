#!/bin/bash

echo "🚀 启动雷雨传媒卡密验证服务器..."
echo

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

# 检查是否存在package.json
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 未找到package.json文件"
    echo "请确保在正确的目录中运行此脚本"
    exit 1
fi

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖包..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
    echo
fi

# 检查环境配置文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📋 复制环境配置文件..."
        cp .env.example .env
        echo "⚠️  请编辑 .env 文件配置数据库连接信息"
        echo
    else
        echo "⚠️  警告: 未找到环境配置文件，将使用默认配置"
        echo
    fi
fi

# 询问是否需要初始化数据库
echo "🔧 是否需要初始化数据库？"
echo "[Y] 是 - 创建数据库表和默认管理员账户"
echo "[N] 否 - 跳过数据库初始化"
echo "[Q] 退出"
echo
read -p "请选择 (Y/N/Q): " choice

case "$choice" in
    [Yy]* )
        echo "📊 正在初始化数据库..."
        node setup-database.js
        if [ $? -ne 0 ]; then
            echo "❌ 数据库初始化失败"
            exit 1
        fi
        echo
        ;;
    [Qq]* )
        echo "👋 退出启动"
        exit 0
        ;;
    * )
        echo "跳过数据库初始化"
        echo
        ;;
esac

# 启动服务器
echo "🚀 启动卡密验证服务器..."
echo "📡 服务器将在 http://localhost:3001 启动"
echo "🔄 按 Ctrl+C 停止服务器"
echo

node license-api-server.js

echo
echo "👋 服务器已停止"
