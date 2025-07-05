@echo off
echo 🚀 启动雷雨传媒卡密验证服务器...
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 检查是否存在package.json
if not exist package.json (
    echo ❌ 错误: 未找到package.json文件
    echo 请确保在正确的目录中运行此脚本
    pause
    exit /b 1
)

REM 检查是否已安装依赖
if not exist node_modules (
    echo 📦 正在安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
)

REM 检查环境配置文件
if not exist .env (
    if exist .env.example (
        echo 📋 复制环境配置文件...
        copy .env.example .env
        echo ⚠️  请编辑 .env 文件配置数据库连接信息
        echo.
    ) else (
        echo ⚠️  警告: 未找到环境配置文件，将使用默认配置
        echo.
    )
)

REM 询问是否需要初始化数据库
echo 🔧 是否需要初始化数据库？
echo [Y] 是 - 创建数据库表和默认管理员账户
echo [N] 否 - 跳过数据库初始化
echo [Q] 退出
echo.
set /p choice="请选择 (Y/N/Q): "

if /i "%choice%"=="Y" (
    echo 📊 正在初始化数据库...
    node setup-database.js
    if %errorlevel% neq 0 (
        echo ❌ 数据库初始化失败
        pause
        exit /b 1
    )
    echo.
) else if /i "%choice%"=="Q" (
    echo 👋 退出启动
    pause
    exit /b 0
)

REM 启动服务器
echo 🚀 启动卡密验证服务器...
echo 📡 服务器将在 http://localhost:3001 启动
echo 🔄 按 Ctrl+C 停止服务器
echo.

node license-api-server.js

echo.
echo 👋 服务器已停止
pause
