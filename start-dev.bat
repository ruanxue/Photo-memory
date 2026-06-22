@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Photo Memory 启动自检

set "ROOT=%~dp0"
cd /d "%ROOT%" 2>nul
if errorlevel 1 (
  echo.
  echo [错误] 无法进入项目目录：
  echo %ROOT%
  echo.
  echo 请确认项目文件夹没有被删除、移动，路径中没有异常权限限制。
  echo.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Photo Memory 开发环境启动自检
echo ========================================
echo 项目目录：%CD%
echo.

if not exist "%ROOT%backend\" (
  echo [错误] 找不到 backend 目录。
  echo 可能原因：项目压缩包没有完整解压，或当前 bat 不在 photo-memory 根目录。
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\" (
  echo [错误] 找不到 frontend 目录。
  echo 可能原因：项目压缩包没有完整解压，或当前 bat 不在 photo-memory 根目录。
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%start-dev.ps1" (
  echo [错误] 找不到 start-dev.ps1。
  echo 可能原因：启动脚本缺失，项目文件不完整。
  echo.
  pause
  exit /b 1
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [错误] 当前系统找不到 powershell.exe。
  echo 请使用 Windows 10/11，或确认 PowerShell 没有被系统策略禁用。
  echo.
  pause
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有检测到 Node.js。
  echo 请先安装 Node.js 18 或更高版本，然后重新双击本脚本。
  echo 下载地址：https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [错误] 没有检测到 npm。
    echo npm 通常会随 Node.js 一起安装。请重新安装 Node.js LTS 版本。
    echo.
    pause
    exit /b 1
  )
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node.split('.')[0]" 2^>nul') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
  echo [错误] 无法读取 Node.js 版本。
  echo 请在命令行执行 node -v 检查 Node.js 是否可用。
  echo.
  pause
  exit /b 1
)

if %NODE_MAJOR% LSS 18 (
  echo [错误] Node.js 版本过低。
  node -v
  echo 本项目需要 Node.js 18 或更高版本。
  echo.
  pause
  exit /b 1
)

echo [通过] Node.js 版本：
node -v
echo [通过] npm 版本：
npm -v
echo.
echo 正在启动项目。如果首次运行，请使用：
echo   start-dev.bat -Init
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-dev.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo ========================================
  echo   Photo Memory 启动失败
  echo ========================================
  echo 错误码：%EXIT_CODE%
  echo.
  echo 请根据上方红色或黄色提示排查。常见原因：
  echo 1. 没有安装 Node.js 18+ 或 npm 不可用。
  echo 2. 第一次运行没有执行 start-dev.bat -Init。
  echo 3. backend 或 frontend 依赖安装失败。
  echo 4. 端口 13033 或 5173 被其他程序占用。
  echo 5. 杀毒软件、公司电脑策略或 PowerShell 权限阻止脚本运行。
  echo.
  echo 如果看不懂错误，请把这个窗口里的完整内容发给开发者。
) else (
  echo ========================================
  echo   Photo Memory 启动命令已执行
  echo ========================================
  echo 正常情况下会出现两个新窗口：
  echo   Photo Memory Backend :13033
  echo   Photo Memory Frontend :5173
  echo.
  echo 访问地址：http://localhost:5173
  echo.
  echo 如果没有出现两个新窗口，或窗口里显示报错，请把对应窗口内容发给开发者。
)

echo.
pause
exit /b %EXIT_CODE%
