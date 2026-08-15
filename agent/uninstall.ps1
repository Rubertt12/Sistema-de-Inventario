$ErrorActionPreference = 'Stop'

$ruleCore = 'RRN Agent - Block inbound core'
$ruleTray = 'RRN Agent - Block inbound tray'

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  if (-not $PSCommandPath) { throw 'Salve este script em um arquivo .ps1 antes de executá-lo.' }
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

schtasks.exe /Delete /TN 'RRN Agent - 08h' /F 2>$null | Out-Null
schtasks.exe /Delete /TN 'RRN Agent - 18h' /F 2>$null | Out-Null

& netsh.exe advfirewall firewall delete rule name="$ruleCore" 2>$null | Out-Null
& netsh.exe advfirewall firewall delete rule name="$ruleTray" 2>$null | Out-Null

$runKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
Remove-ItemProperty -Path $runKey -Name 'RRN Agent' -ErrorAction SilentlyContinue
Get-Process 'RRN.Agent.Tray' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

$installDir = Join-Path $env:ProgramFiles 'RRN Manager Agent'
$configDir = Join-Path $env:ProgramData 'RRN Manager Agent'

if (Test-Path $installDir) { Remove-Item -Recurse -Force $installDir }
if (Test-Path $configDir) { Remove-Item -Recurse -Force $configDir }

Write-Host 'RRN Agent removido desta máquina, incluindo as regras de hardening do Firewall.' -ForegroundColor Green
