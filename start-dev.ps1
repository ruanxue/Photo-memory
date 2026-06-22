[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Migrate,
  [switch]$Seed,
  [switch]$Init,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$UploadsDir = Join-Path $BackendDir "uploads"
$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"

if ($Init) {
  $Install = $true
  $Migrate = $true
  $Seed = $true
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
  param([string]$Message)
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Get-RequiredCommand {
  param([string[]]$Names)

  foreach ($Name in $Names) {
    $Command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($Command) {
      return $Command.Source
    }
  }

  throw "缺少必要命令：$($Names -join ' 或 ')。请先安装 Node.js 18+，并确认 npm/npx 可以在命令行中使用。"
}

function Get-NodeMajorVersion {
  try {
    $VersionText = & node -p "process.versions.node.split('.')[0]"
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return [int]$VersionText
  }
  catch {
    return $null
  }
}

function Get-ConfiguredSqlitePath {
  if (-not (Test-Path $BackendEnv)) {
    return Join-Path (Join-Path $BackendDir "prisma") "dev.db"
  }

  $Line = Get-Content -LiteralPath $BackendEnv -ErrorAction SilentlyContinue |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -First 1
  if (-not $Line) {
    return Join-Path (Join-Path $BackendDir "prisma") "dev.db"
  }

  $Value = ($Line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
  if (-not $Value.StartsWith("file:")) {
    return $null
  }

  $PathValue = $Value.Substring(5)
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return Join-Path (Join-Path $BackendDir "prisma") $PathValue
}

function Invoke-Npm {
  param(
    [string]$Directory,
    [string[]]$Arguments
  )

  Push-Location $Directory
  try {
    & $script:NpmCommand @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($Arguments -join ' ') failed in $Directory"
    }
  }
  finally {
    Pop-Location
  }
}

function Invoke-Npx {
  param(
    [string]$Directory,
    [string[]]$Arguments
  )

  Push-Location $Directory
  try {
    & $script:NpxCommand @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npx $($Arguments -join ' ') failed in $Directory"
    }
  }
  finally {
    Pop-Location
  }
}

function Test-PortInUse {
  param([int]$Port)

  $Client = New-Object System.Net.Sockets.TcpClient
  try {
    $Async = $Client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $Connected = $Async.AsyncWaitHandle.WaitOne(250, $false)
    if (-not $Connected) {
      return $false
    }

    $Client.EndConnect($Async)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $Client.Close()
  }
}

function ConvertTo-PowerShellLiteral {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function Start-DevWindow {
  param(
    [string]$Title,
    [string]$Directory,
    [string[]]$NpmArguments
  )

  $TitleLiteral = ConvertTo-PowerShellLiteral $Title
  $DirectoryLiteral = ConvertTo-PowerShellLiteral $Directory
  $NpmLiteral = ConvertTo-PowerShellLiteral $script:NpmCommand
  $NpmArgsLiteral = ($NpmArguments | ForEach-Object { ConvertTo-PowerShellLiteral $_ }) -join ", "

  $WindowScript = @"
`$Host.UI.RawUI.WindowTitle = $TitleLiteral
Set-Location -LiteralPath $DirectoryLiteral
Write-Host $TitleLiteral -ForegroundColor Green
Write-Host 'Working directory:' (Get-Location).Path
& $NpmLiteral @($NpmArgsLiteral)
if (`$LASTEXITCODE -ne 0) {
  Write-Host ('Process exited with code ' + `$LASTEXITCODE) -ForegroundColor Red
}
"@

  $Encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($WindowScript))
  Start-Process powershell.exe -WorkingDirectory $Directory -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    $Encoded
  )
}

Write-Step "Checking project"
if (-not (Test-Path $BackendDir)) {
  throw "找不到 backend 目录：$BackendDir。请确认项目已经完整解压，并从 photo-memory 根目录启动。"
}
if (-not (Test-Path $FrontendDir)) {
  throw "找不到 frontend 目录：$FrontendDir。请确认项目已经完整解压，并从 photo-memory 根目录启动。"
}
if (-not (Test-Path (Join-Path $BackendDir "package.json"))) {
  throw "找不到 backend/package.json。项目文件不完整，请重新解压或重新拉取仓库。"
}
if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
  throw "找不到 frontend/package.json。项目文件不完整，请重新解压或重新拉取仓库。"
}

$script:NpmCommand = Get-RequiredCommand @("npm.cmd", "npm")
$script:NpxCommand = Get-RequiredCommand @("npx.cmd", "npx")
Get-RequiredCommand @("node.exe", "node") | Out-Null

$NodeMajor = Get-NodeMajorVersion
if (-not $NodeMajor) {
  throw "无法读取 Node.js 版本。请在命令行执行 node -v 检查 Node.js 是否可用。"
}
if ($NodeMajor -lt 18) {
  throw "Node.js 版本过低。当前主版本：$NodeMajor；本项目需要 Node.js 18 或更高版本。"
}

if (-not (Test-Path $BackendEnv) -and (Test-Path $BackendEnvExample)) {
  Write-Step "Creating backend .env from .env.example"
  Copy-Item -LiteralPath $BackendEnvExample -Destination $BackendEnv
}

$DatabasePath = Get-ConfiguredSqlitePath
if ($DatabasePath -and -not (Test-Path $DatabasePath) -and -not $Migrate -and -not $Init) {
  Write-Warn "未检测到 SQLite 数据库：$DatabasePath"
  Write-Warn "如果这是第一次启动，请关闭本窗口后运行：start-dev.bat -Init"
}

Write-Step "Ensuring upload directories"
@("originals", "mediums", "thumbnails") | ForEach-Object {
  $Path = Join-Path $UploadsDir $_
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

$BackendNodeModules = Join-Path $BackendDir "node_modules"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"

if ($Install -or -not (Test-Path $BackendNodeModules)) {
  Write-Step "Installing backend dependencies"
  Invoke-Npm $BackendDir @("install")
}

if ($Install -or -not (Test-Path $FrontendNodeModules)) {
  Write-Step "Installing frontend dependencies"
  Invoke-Npm $FrontendDir @("install")
}

if ($Install -or $Migrate) {
  Write-Step "Generating Prisma client"
  Invoke-Npx $BackendDir @("prisma", "generate")
}

if ($Migrate) {
  Write-Step "Running Prisma migration"
  Invoke-Npx $BackendDir @("prisma", "migrate", "dev", "--name", "init")
}

if ($Seed) {
  Write-Step "Seeding database"
  Invoke-Npm $BackendDir @("run", "seed")
}

Write-Step "Starting development servers"
if (Test-PortInUse 13033) {
  Write-Warn "Port 13033 is already in use. Backend may already be running."
}
else {
  Start-DevWindow "Photo Memory Backend :13033" $BackendDir @("run", "dev")
}

if (Test-PortInUse 5173) {
  Write-Warn "Port 5173 is already in use. Frontend may already be running."
}
else {
  Start-DevWindow "Photo Memory Frontend :5173" $FrontendDir @("run", "dev")
}

Write-Host ""
Write-Host "Photo Memory is starting." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:13033"
Write-Host ""
Write-Host "First run: .\start-dev.ps1 -Init"
Write-Host "Normal run: .\start-dev.ps1"

if (-not $NoBrowser) {
  Start-Sleep -Seconds 2
  Start-Process "http://localhost:5173"
}
