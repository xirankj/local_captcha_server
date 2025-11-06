@echo off
chcp 65001 >nul
echo.
echo ============================================================
echo   验证码识别服务 - 密码重置工具 (Windows)
echo ============================================================
echo.

REM 检查数据库文件是否存在
if not exist "users.db" (
    echo X 数据库文件不存在，请先启动服务创建数据库
    echo.
    pause
    exit /b 1
)

REM 直接调用Python脚本，由Python脚本处理所有交互
python reset_password.py

REM 检查返回状态
if errorlevel 1 (
    echo.
    echo X 重置失败
    echo.
    echo 可能的原因：
    echo 1. 数据库结构需要更新
    echo 2. 请确保已启动过服务（数据库已创建）
    echo.
    echo 建议：
    echo 1. 先启动一次服务以创建数据库
    echo 2. 停止服务
    echo 3. 再次运行此脚本
    echo.
)

pause
exit /b 0
