# Set / change the study-mode management password.
# The password gates study-mode-off (unblocking the internet) and future
# password changes. Stored as salted SHA-256 in ProgramData, never in git.

$ErrorActionPreference = 'Stop'
$passDir  = Join-Path $env:ProgramData 'Type2Memory'
$passFile = Join-Path $passDir 'studymode.pass'

function Get-PassHash([string]$Password, [string]$Salt) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [Text.Encoding]::UTF8.GetBytes($Salt + $Password)
  ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
}

function Read-PlainPassword([string]$Prompt) {
  $sec  = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  return $plain
}

# Changing an existing password requires knowing the current one
if (Test-Path $passFile) {
  $parts = (Get-Content $passFile -Raw).Trim() -split ':'
  $old = Read-PlainPassword '已设置过密码，请输入当前密码'
  if ((Get-PassHash $old $parts[0]) -ne $parts[1]) {
    Write-Host '密码错误，无法修改。' -ForegroundColor Red
    Read-Host '按回车关闭'
    exit 1
  }
}

$new1 = Read-PlainPassword '请输入新密码'
$new2 = Read-PlainPassword '请再输入一遍确认'
if ($new1 -ne $new2 -or [string]::IsNullOrWhiteSpace($new1)) {
  Write-Host '两次输入不一致或为空，未修改。' -ForegroundColor Red
  Read-Host '按回车关闭'
  exit 1
}

if (-not (Test-Path $passDir)) { New-Item -ItemType Directory -Force $passDir | Out-Null }
$salt = [Guid]::NewGuid().ToString('N')
Set-Content -Path $passFile -Value "${salt}:$(Get-PassHash $new1 $salt)" -Encoding ascii
Write-Host '管理密码已设置。study-mode-off 现在需要这个密码才能解除封锁。' -ForegroundColor Green
Read-Host '按回车关闭'
