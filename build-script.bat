@echo off
chcp 65001 >nul
echo.
echo ==========================================
echo   雷雨传媒网络配置管理工具 - 构建脚本
echo ==========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 版本:
node --version
echo.

:: 检查npm是否可用
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: npm 不可用
    pause
    exit /b 1
)

echo ✅ npm 版本:
npm --version
echo.

:: 安装依赖
echo 📦 正在安装依赖...
npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)
echo ✅ 依赖安装完成
echo.

:: 构建应用
echo 🔨 正在构建 Windows 应用程序...
npm run build-win
if %errorlevel% neq 0 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo.
echo ✅ 构建完成！
echo.
echo 📁 安装包位置: dist\
echo 🎉 您可以在 dist 文件夹中找到生成的安装程序
echo.

:: 询问是否打开dist文件夹
set /p choice="是否打开 dist 文件夹? (y/n): "
if /i "%choice%"=="y" (
    start explorer dist
)

echo.
echo 按任意键退出...
pause >nul
