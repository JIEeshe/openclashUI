@echo off
echo 🧪 开始测试 mainWindow null 检查修复...
echo.

echo 📋 测试步骤:
echo 1. 启动应用
echo 2. 快速关闭窗口
echo 3. 检查是否有 null 错误
echo.

echo 🔍 检查 Electron 是否已安装...
where electron >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 electron 命令，尝试使用 npx...
    echo 🚀 启动测试应用...
    npx electron test-fix.js
) else (
    echo ✅ 找到 electron 命令
    echo 🚀 启动测试应用...
    electron test-fix.js
)

echo.
echo ✅ 测试完成！
echo 📄 请检查生成的调试日志文件
echo.

pause
