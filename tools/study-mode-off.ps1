# Study Mode OFF — removes the firewall rules created by study-mode-on.ps1,
# restoring normal internet access for all browsers.
# Requires the management password (set via study-mode-setpass.bat).
# Must run as Administrator (the .bat wrapper elevates automatically).

$ErrorActionPreference = 'Stop'
$passFile = Join-Path $env:ProgramData 'Type2Memory\studymode.pass'

function Get-PassHash([string]$Password, [string]$Salt) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [Text.Encoding]::UTF8.GetBytes($Salt + $Password)
  ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
}

if (Test-Path $passFile) {
  $parts = (Get-Content $passFile -Raw).Trim() -split ':'
  $sec  = Read-Host '请输入管理密码' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  if ((Get-PassHash $plain $parts[0]) -ne $parts[1]) {
    Write-Host '密码错误，学习模式保持开启。' -ForegroundColor Red
    Start-Sleep -Seconds 2
    Read-Host '按回车关闭'
    exit 1
  }
} else {
  Write-Host '（尚未设置管理密码 — 建议运行 study-mode-setpass.bat 设置一个）' -ForegroundColor Yellow
}

$removed = Get-NetFirewallRule -DisplayName 'Type2Memory-StudyMode-*' -ErrorAction SilentlyContinue
if ($removed) {
  $removed | Remove-NetFirewallRule
  Write-Host "已恢复浏览器联网（移除 $(@($removed).Count) 条封锁规则）" -ForegroundColor Green
} else {
  Write-Host '没有找到学习模式规则，无需恢复' -ForegroundColor Yellow
}
Read-Host '按回车关闭'
