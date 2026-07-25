# Non-interactive firewall block, invoked (elevated) by the backend when the
# child clicks "开始学习（断网）" in the app. Blocks outbound internet for every
# installed browser; loopback (localhost) is never filtered, so the app keeps
# working. Idempotent: clears any prior rules first.
$ErrorActionPreference = 'Stop'
$rulePrefix = 'Type2Memory-StudyMode'

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

Get-NetFirewallRule -DisplayName "$rulePrefix-*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
foreach ($name in $browsers.Keys) {
  foreach ($p in $browsers[$name]) {
    if (Test-Path $p) {
      New-NetFirewallRule -DisplayName "$rulePrefix-$name" -Direction Outbound `
        -Program $p -Action Block -Profile Any | Out-Null
      break
    }
  }
}
