@echo off
chcp 65001 >nul
title 雷雨传媒 - 卡密管理系统

echo.
echo ==========================================
echo      雷雨传媒 - 卡密管理系统
echo ==========================================
echo.

echo 🚀 正在启动卡密管理系统...
echo.

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未检测到 Node.js
    echo.
    echo 请先安装 Node.js：
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载并安装最新版本的 Node.js
    echo 3. 重新运行此脚本
    echo.
    pause
    exit /b 1
)

REM 检查 Electron 是否安装
if not exist "node_modules\electron" (
    echo 📦 正在安装依赖包...
    echo.
    npm install
    if errorlevel 1 (
        echo ❌ 依赖包安装失败
        echo.
        pause
        exit /b 1
    )
    echo ✅ 依赖包安装完成
    echo.
)

REM 启动卡密管理系统
echo 🎫 启动卡密管理系统...
echo.

npx electron license-generator-main.js

if errorlevel 1 (
    echo.
    echo ❌ 卡密管理系统启动失败
    echo.
    echo 可能的解决方案：
    echo 1. 确保所有依赖包已正确安装
    echo 2. 检查 license-generator-main.js 文件是否存在
    echo 3. 尝试重新安装 Electron: npm install electron
    echo.
) else (
    echo.
    echo ✅ 卡密管理系统已关闭
    echo.
)

pause
