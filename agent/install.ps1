param(
  [Parameter(Mandatory = $true)]
  [string]$EnrollmentCode,
  [string]$Endpoint = 'https://tvfiicmwkddpswgbjyok.supabase.co/functions/v1/rrn-agent'
)

$ErrorActionPreference = 'Stop'
$releaseBase = 'https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest'
$allowedEndpoint = 'https://tvfiicmwkddpswgbjyok.supabase.co/functions/v1/rrn-agent'
$ruleCore = 'RRN Agent - Block inbound core'
$ruleTray = 'RRN Agent - Block inbound tray'

function Test-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-VerifiedReleaseFile {
  param([string]$Name, [string]$Target)
  $temp = Join-Path $env:TEMP ('rrn-agent-' + [guid]::NewGuid().ToString('N'))
  $hashFile = "$temp.sha256"
  try {
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/$Name" -OutFile $temp
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/$Name.sha256" -OutFile $hashFile
    $expected = (Get-Content -Raw $hashFile).Trim().ToLowerInvariant()
    if ($expected -notmatch '^[a-f0-9]{64}$') { throw "Hash publicado inválido para $Name." }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $temp).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "Falha de integridade em $Name. O arquivo baixado não corresponde ao SHA-256 publicado." }
    Copy-Item -Force $temp $Target
  }
  finally {
    Remove-Item $temp,$hashFile -Force -ErrorAction SilentlyContinue
  }
}

function Set-RrnFirewallHardening {
  param([string]$CoreExe, [string]$TrayExe)
  & netsh.exe advfirewall firewall delete rule name="$ruleCore" 2>$null | Out-Null
  & netsh.exe advfirewall firewall delete rule name="$ruleTray" 2>$null | Out-Null

  & netsh.exe advfirewall firewall add rule name="$ruleCore" dir=in action=block program="$CoreExe" enable=yes profile=any | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar a proteção de entrada do RRN.Agent.exe no Firewall do Windows.' }

  & netsh.exe advfirewall firewall add rule name="$ruleTray" dir=in action=block program="$TrayExe" enable=yes profile=any | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar a proteção de entrada do RRN.Agent.Tray.exe no Firewall do Windows.' }
}

function Set-RrnDataPermissions {
  param([string]$ConfigDir)
  if (-not (Test-Path $ConfigDir)) { return }
  $configPath = Join-Path $ConfigDir 'agent.json'
  $statusPath = Join-Path $ConfigDir 'status.json'

  & icacls.exe $ConfigDir /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível proteger a pasta de configuração do RRN Agent.' }

  if (Test-Path $configPath) {
    & icacls.exe $configPath /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' '*S-1-5-32-545:R' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível proteger o arquivo agent.json.' }
  }

  if (Test-Path $statusPath) {
    & icacls.exe $statusPath /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' '*S-1-5-32-545:M' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível proteger o arquivo status.json.' }
  }
}

if ($Endpoint.TrimEnd('/') -ne $allowedEndpoint) {
  throw 'Endpoint recusado. Este instalador só aceita o backend oficial configurado do RRN Manager.'
}

if (-not (Test-Administrator)) {
  if (-not $PSCommandPath) { throw 'Salve o instalador em um arquivo .ps1 antes de executá-lo.' }
  $args = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -EnrollmentCode `"$EnrollmentCode`" -Endpoint `"$Endpoint`""
  Start-Process powershell.exe -Verb RunAs -ArgumentList $args
  exit
}

$installDir = Join-Path $env:ProgramFiles 'RRN Manager Agent'
$configDir = Join-Path $env:ProgramData 'RRN Manager Agent'
$exePath = Join-Path $installDir 'RRN.Agent.exe'
$trayPath = Join-Path $installDir 'RRN.Agent.Tray.exe'
$logoPath = Join-Path $installDir 'rrn-logo.png'

Write-Host 'Instalando RRN Agent com hardening de rede...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

try {
  Get-VerifiedReleaseFile -Name 'RRN.Agent.exe' -Target $exePath
  Get-VerifiedReleaseFile -Name 'RRN.Agent.Tray.exe' -Target $trayPath
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/rrn-logo.png" -OutFile $logoPath
} catch {
  throw "Não foi possível baixar/verificar o pacote do RRN Agent. $($_.Exception.Message)"
}

Set-RrnFirewallHardening -CoreExe $exePath -TrayExe $trayPath

Write-Host 'Vinculando esta máquina ao RRN Manager...'
& $exePath enroll --code $EnrollmentCode --endpoint $Endpoint
if ($LASTEXITCODE -ne 0) { throw 'Falha ao vincular o agente ao RRN Manager.' }

Set-RrnDataPermissions -ConfigDir $configDir

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
Write-Host 'Proteção de entrada: BLOQUEADA no Firewall do Windows para Core e Tray'
Write-Host 'Integridade dos executáveis: verificada por SHA-256'
Write-Host 'Inventário inicial: enviado agora'
Write-Host 'Próximas sincronizações: todos os dias às 08:00 e 18:00'
Write-Host 'Ícone de bandeja: iniciado e configurado para abrir com o Windows'
Write-Host "Executável principal: $exePath"
Write-Host "Aplicativo da bandeja: $trayPath"
