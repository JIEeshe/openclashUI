@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM OpenClash管理器 Electron应用Windows构建脚本

echo 🚀 开始打包OpenClash管理器Electron应用...

REM 配置变量
set APP_NAME=雷雨传媒配置管理
set APP_VERSION=1.0.0
set BUILD_DIR=dist
set PACKAGE_DIR=packages
set TIMESTAMP=%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo 应用名称: %APP_NAME%
echo 应用版本: %APP_VERSION%
echo 构建时间: %TIMESTAMP%
echo.

REM 检查Node.js
echo [STEP] 检查构建依赖...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js未安装
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] NPM未安装
    pause
    exit /b 1
)

echo [INFO] Node.js版本:
node --version
echo [INFO] NPM版本:
npm --version

REM 安装依赖
echo.
echo [STEP] 安装项目依赖...
if not exist "node_modules" (
    echo [INFO] 安装NPM依赖...
    npm install
    if errorlevel 1 (
        echo [ERROR] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [INFO] 依赖已存在，跳过安装
)

REM 清理构建目录
echo.
echo [STEP] 清理构建目录...
if exist "%BUILD_DIR%" (
    rmdir /s /q "%BUILD_DIR%"
    echo [INFO] 已清理 %BUILD_DIR% 目录
)

if exist "%PACKAGE_DIR%" (
    rmdir /s /q "%PACKAGE_DIR%"
    echo [INFO] 已清理 %PACKAGE_DIR% 目录
)

mkdir "%PACKAGE_DIR%"

REM 构建Windows版本
echo.
echo [STEP] 构建Windows版本...

echo [INFO] 构建Windows x64安装包...
call npm run build-win -- --x64
if errorlevel 1 (
    echo [ERROR] Windows x64构建失败
    pause
    exit /b 1
)

REM 移动安装包文件
if exist "%BUILD_DIR%\雷雨传媒配置管理 Setup 1.0.0.exe" (
    move "%BUILD_DIR%\雷雨传媒配置管理 Setup 1.0.0.exe" "%PACKAGE_DIR%\LeiyuChuanmei-ConfigManager-%APP_VERSION%-win-x64-setup.exe"
    echo [INFO] ✅ Windows x64安装包构建完成
)

REM 构建便携版
echo [INFO] 构建Windows x64便携版...
call npm run build-win -- --x64 --dir
if errorlevel 1 (
    echo [ERROR] Windows便携版构建失败
    pause
    exit /b 1
)

if exist "%BUILD_DIR%\win-unpacked" (
    cd "%BUILD_DIR%"
    powershell -command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath '..\%PACKAGE_DIR%\LeiyuChuanmei-ConfigManager-%APP_VERSION%-win-x64-portable.zip' -Force"
    cd ..
    echo [INFO] ✅ Windows x64便携版构建完成
)

REM 构建32位版本
echo [INFO] 构建Windows x86安装包...
call npm run build-win -- --ia32
if errorlevel 1 (
    echo [WARN] Windows x86构建失败，跳过
) else (
    if exist "%BUILD_DIR%\雷雨传媒配置管理 Setup 1.0.0.exe" (
        move "%BUILD_DIR%\雷雨传媒配置管理 Setup 1.0.0.exe" "%PACKAGE_DIR%\LeiyuChuanmei-ConfigManager-%APP_VERSION%-win-x86-setup.exe"
        echo [INFO] ✅ Windows x86安装包构建完成
    )
)

REM 生成校验文件
echo.
echo [STEP] 生成校验文件...
cd "%PACKAGE_DIR%"

REM 生成MD5校验
echo [INFO] 生成MD5校验文件...
(
    for %%f in (*) do (
        if not "%%f"=="checksums-md5.txt" if not "%%f"=="checksums-sha256.txt" if not "%%f"=="RELEASE_NOTES.md" (
            powershell -command "Get-FileHash -Algorithm MD5 '%%f' | ForEach-Object { $_.Hash.ToLower() + '  ' + $_.Path.Split('\')[-1] }"
        )
    )
) > checksums-md5.txt

REM 生成SHA256校验
echo [INFO] 生成SHA256校验文件...
(
    for %%f in (*) do (
        if not "%%f"=="checksums-md5.txt" if not "%%f"=="checksums-sha256.txt" if not "%%f"=="RELEASE_NOTES.md" (
            powershell -command "Get-FileHash -Algorithm SHA256 '%%f' | ForEach-Object { $_.Hash.ToLower() + '  ' + $_.Path.Split('\')[-1] }"
        )
    )
) > checksums-sha256.txt

cd ..

REM 创建发布说明
echo.
echo [STEP] 创建发布说明...
(
echo # 雷雨传媒配置管理 v%APP_VERSION%
echo.
echo ## 📦 Windows发布包
echo.
echo ### 安装包
echo - **LeiyuChuanmei-ConfigManager-%APP_VERSION%-win-x64-setup.exe**: Windows 64位安装包
echo - **LeiyuChuanmei-ConfigManager-%APP_VERSION%-win-x86-setup.exe**: Windows 32位安装包
echo.
echo ### 便携版
echo - **LeiyuChuanmei-ConfigManager-%APP_VERSION%-win-x64-portable.zip**: Windows 64位便携版
echo.
echo ## ✨ 功能特性
echo.
echo - 🔐 **分级卡密权限系统**: 基础版、专业版、企业版三级权限
echo - 🎫 **卡密生成管理**: 批量生成和管理授权卡密
echo - 📊 **统计分析工具**: 卡密使用情况统计和分析
echo - 🔄 **在线验证系统**: 联网验证卡密有效性
echo - 🎨 **现代化界面**: 响应式设计，支持深色模式
echo - 🚀 **高性能**: 基于Electron框架，跨平台兼容
echo.
echo ## 🔧 系统要求
echo.
echo ### 最低配置
echo - **操作系统**: Windows 10 ^(64位^) / Windows 11
echo - **内存**: 4GB RAM
echo - **存储**: 200MB可用空间
echo - **网络**: 需要联网进行卡密验证
echo.
echo ### 推荐配置
echo - **内存**: 8GB RAM
echo - **存储**: 1GB可用空间
echo - **显示器**: 1920x1080分辨率
echo.
echo ## 📋 安装说明
echo.
echo ### 安装包版本
echo 1. 下载对应的安装包文件
echo 2. 右键选择"以管理员身份运行"
echo 3. 按照安装向导完成安装
echo 4. 首次运行需要输入授权码
echo.
echo ### 便携版
echo 1. 下载便携版ZIP文件
echo 2. 解压到任意目录
echo 3. 运行 雷雨传媒配置管理.exe
echo 4. 首次运行需要输入授权码
echo.
echo ## 🔒 安全说明
echo.
echo - 应用需要联网验证卡密有效性
echo - 所有数据本地存储，不会上传到服务器
echo - 建议在安全的网络环境中使用
echo - 请从官方渠道下载，避免使用来源不明的版本
echo.
echo ## 📞 技术支持
echo.
echo 如遇到问题，请联系技术支持团队。
echo.
echo ---
echo 构建时间: %TIMESTAMP%
echo 构建版本: %APP_VERSION%
echo 构建平台: Windows
) > "%PACKAGE_DIR%\RELEASE_NOTES.md"

echo [INFO] 发布说明已创建

REM 显示构建结果
echo.
echo [STEP] 构建结果汇总
echo.
echo 📦 构建完成的安装包:
echo ================================

cd "%PACKAGE_DIR%"
for %%f in (*) do (
    if not "%%f"=="checksums-md5.txt" if not "%%f"=="checksums-sha256.txt" if not "%%f"=="RELEASE_NOTES.md" (
        for %%s in ("%%f") do (
            set size=%%~zs
            set /a size_mb=!size!/1024/1024
            echo   📁 %%f ^(!size_mb!MB^)
        )
    )
)
cd ..

echo.
echo 📋 构建文件列表:
dir /b "%PACKAGE_DIR%"

echo.
echo 💾 输出目录: %PACKAGE_DIR%\
echo.
echo ✅ Windows平台构建完成！
echo.
echo 🚀 接下来可以:
echo   1. 测试安装包是否正常工作
echo   2. 上传到分发服务器
echo   3. 创建发布说明
echo.

pause
