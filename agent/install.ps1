param(
  [Parameter(Mandatory = $true)]
  [string]$EnrollmentCode,
  [string]$Endpoint = 'https://tvfiicmwkddpswgbjyok.supabase.co/functions/v1/rrn-agent'
)

$ErrorActionPreference = 'Stop'

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  if (-not $PSCommandPath) { throw 'Salve o instalador em um arquivo .ps1 antes de executá-lo.' }
  $args = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -EnrollmentCode `"$EnrollmentCode`" -Endpoint `"$Endpoint`""
  Start-Process powershell.exe -Verb RunAs -ArgumentList $args
  exit
}

$installDir = Join-Path $env:ProgramFiles 'RRN Manager Agent'
$exePath = Join-Path $installDir 'RRN.Agent.exe'
$trayPath = Join-Path $installDir 'RRN.Agent.Tray.exe'
$logoPath = Join-Path $installDir 'rrn-logo.png'
$releaseBase = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest'

Write-Host 'Instalando RRN Agent...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

try {
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/RRN.Agent.exe" -OutFile $exePath
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/RRN.Agent.Tray.exe" -OutFile $trayPath
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/rrn-logo.png" -OutFile $logoPath
} catch {
  throw "Não foi possível baixar o pacote do RRN Agent. Verifique a release rrn-agent-latest. $($_.Exception.Message)"
}

Write-Host 'Vinculando esta máquina ao RRN Manager...'
& $exePath enroll --code $EnrollmentCode --endpoint $Endpoint
if ($LASTEXITCODE -ne 0) { throw 'Falha ao vincular o agente ao RRN Manager.' }

$taskMorning = 'RRN Agent - 08h'
$taskEvening = 'RRN Agent - 18h'
$morningCommand = '"{0}" run --kind morning' -f $exePath
$eveningCommand = '"{0}" run --kind evening' -f $exePath

schtasks.exe /Create /TN $taskMorning /TR $morningCommand /SC DAILY /ST 08:00 /RU SYSTEM /RL HIGHEST /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar a tarefa das 08:00.' }
schtasks.exe /Create /TN $taskEvening /TR $eveningCommand /SC DAILY /ST 18:00 /RU SYSTEM /RL HIGHEST /F | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar a tarefa das 18:00.' }

$runKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
New-ItemProperty -Path $runKey -Name 'RRN Agent' -Value ('"{0}"' -f $trayPath) -PropertyType String -Force | Out-Null

Get-Process 'RRN.Agent.Tray' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process $trayPath

Write-Host ''
Write-Host 'RRN Agent instalado com sucesso.' -ForegroundColor Green
Write-Host 'Inventário inicial: enviado agora'
Write-Host 'Próximas sincronizações: todos os dias às 08:00 e 18:00'
Write-Host 'Ícone de bandeja: iniciado e configurado para abrir com o Windows'
Write-Host "Executável principal: $exePath"
Write-Host "Aplicativo da bandeja: $trayPath"
