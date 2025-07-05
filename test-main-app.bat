@echo off
echo 🧪 测试修复后的主应用...
echo.

echo 📋 测试说明:
echo 1. 应用将正常启动
echo 2. 请尝试快速关闭窗口来测试修复
echo 3. 观察控制台是否还有 null 错误
echo 4. 检查生成的调试日志文件
echo.

echo ✅ 逻辑测试已通过，现在启动主应用...
echo.

echo 🚀 使用 npm start 启动应用...
npm start

echo.
echo 📄 应用已关闭，请检查是否有错误信息
echo 📊 调试日志文件位置: debug_*.log
echo.

echo 🔍 检查是否生成了调试日志文件...
if exist debug_*.log (
    echo ✅ 找到调试日志文件:
    dir debug_*.log /b
    echo.
    echo 📖 显示最新日志文件的最后几行:
    for /f %%i in ('dir debug_*.log /b /o-d') do (
        echo --- %%i ---
        powershell "Get-Content '%%i' | Select-Object -Last 10"
        goto :done
    )
    :done
) else (
    echo ⚠️ 未找到调试日志文件
)

echo.
pause
