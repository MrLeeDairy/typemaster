# Study Mode OFF — removes the firewall rules created by study-mode-on.ps1,
# restoring normal internet access for all browsers.
# Must run as Administrator (the .bat wrapper elevates automatically).

$removed = Get-NetFirewallRule -DisplayName 'Type2Memory-StudyMode-*' -ErrorAction SilentlyContinue
if ($removed) {
  $removed | Remove-NetFirewallRule
  Write-Host "已恢复浏览器联网（移除 $(@($removed).Count) 条封锁规则）" -ForegroundColor Green
} else {
  Write-Host '没有找到学习模式规则，无需恢复' -ForegroundColor Yellow
}
