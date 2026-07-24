# Study Mode ON — blocks every installed browser's internet access via
# Windows Firewall outbound rules, then opens the practice app in kiosk
# mode. Loopback traffic is never filtered by Windows Firewall, so
# http://localhost:3210 keeps working while Google/translators do not.
# Must run as Administrator (the .bat wrapper elevates automatically).

$ErrorActionPreference = 'Stop'
$rulePrefix = 'Type2Memory-StudyMode'

# Known install locations of the browsers we care about
$browsers = @{
  'chrome'  = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
                "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe")
  'msedge'  = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
                "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
  'firefox' = @("$env:ProgramFiles\Mozilla Firefox\firefox.exe",
                "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe")
  'brave'   = @("$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
                "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe")
  'opera'   = @("$env:LOCALAPPDATA\Programs\Opera\opera.exe",
                "$env:ProgramFiles\Opera\opera.exe")
}

# Clear any leftover rules from a previous session, then add fresh ones
Get-NetFirewallRule -DisplayName "$rulePrefix-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule

$blocked = @()
foreach ($name in $browsers.Keys) {
  foreach ($path in $browsers[$name]) {
    if (Test-Path $path) {
      New-NetFirewallRule -DisplayName "$rulePrefix-$name" -Direction Outbound `
        -Program $path -Action Block -Profile Any | Out-Null
      $blocked += $name
      break
    }
  }
}
Write-Host "已封锁浏览器联网: $($blocked -join ', ')" -ForegroundColor Green

# Make sure the local server is running
$serverUp = $false
try {
  $tcp = New-Object Net.Sockets.TcpClient
  $tcp.Connect('127.0.0.1', 3210)
  $tcp.Close()
  $serverUp = $true
} catch {}
if (-not $serverUp) {
  $root = Split-Path -Parent $PSScriptRoot
  Start-Process node -ArgumentList 'server/server.js' -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 1
  Write-Host '本地服务器已启动' -ForegroundColor Green
}

# Open the app fullscreen in a clean kiosk profile (no tabs, no address bar)
$chrome = $browsers['chrome'] | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) {
  Start-Process $chrome -ArgumentList "--kiosk http://localhost:3210 --user-data-dir=$env:TEMP\t2m-kiosk --no-first-run"
  Write-Host '练习页面已全屏打开。学习模式生效中 — 结束后请运行 study-mode-off.bat 恢复上网。' -ForegroundColor Yellow
} else {
  Write-Host '未找到 Chrome，请手动打开 http://localhost:3210' -ForegroundColor Yellow
}
