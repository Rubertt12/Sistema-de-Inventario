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
$releaseUrl = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest/RRN.Agent.exe'

Write-Host 'Instalando RRN Agent...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

try {
  Invoke-WebRequest -UseBasicParsing -Uri $releaseUrl -OutFile $exePath
} catch {
  throw "Não foi possível baixar o RRN Agent. Verifique se a release rrn-agent-latest já foi publicada. $($_.Exception.Message)"
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

Write-Host ''
Write-Host 'RRN Agent instalado com sucesso.' -ForegroundColor Green
Write-Host 'Inventário inicial: enviado agora'
Write-Host 'Próximas sincronizações: todos os dias às 08:00 e 18:00'
Write-Host "Executável: $exePath"
