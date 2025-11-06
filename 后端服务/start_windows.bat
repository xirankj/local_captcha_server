@echo off
chcp 65001 >nul
title 本地验证码识别服务

echo ========================================
echo   本地验证码识别服务
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误：未检测到Python，请先安装Python 3.8+
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✅ Python已安装
echo.

REM 检查是否已安装依赖
python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 首次运行，正在安装依赖...
    echo 这可能需要几分钟时间，请耐心等待...
    echo.
    python -m pip install --upgrade pip
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    
    if %errorlevel% neq 0 (
        echo.
        echo ❌ 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    echo.
    echo ✅ 依赖安装完成！
    echo.
)

echo 🚀 正在启动服务...
echo.
echo 服务地址: http://localhost:1205
echo 按 Ctrl+C 可停止服务
echo.
echo ========================================
echo.

REM 启动服务
python local_captcha_server.py

pause
