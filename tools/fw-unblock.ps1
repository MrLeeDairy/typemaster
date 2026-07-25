# Non-interactive firewall unblock, invoked (elevated) by the backend after
# the parent password has already been verified server-side. Removes the
# study-mode block rules, restoring normal browsing.
$ErrorActionPreference = 'Stop'
Get-NetFirewallRule -DisplayName 'Type2Memory-StudyMode-*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
