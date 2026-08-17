using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Win32;
using Windows.Devices.Geolocation;

namespace RRN.Agent.Tray;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new TrayContext());
    }
}

internal sealed class TrayContext : ApplicationContext
{
    private const string ManagerUrl = "https://sistema-de-inventario-pearl.vercel.app/dashboard.html";
    private const string ReleaseBase = "https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest";
    private const string RegistryPath = @"Software\RRN Manager Agent";
    private const string LocationValue = "PreciseLocationJson";
    private const string LocationEnabledValue = "PreciseLocationEnabled";
    private const string LocationPromptedValue = "PreciseLocationPrompted";
    private const string ManualTaskName = "RRN Agent - 08h";

    private static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RRN Manager Agent");
    private static readonly string ProgramDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RRN Manager Agent");
    private static readonly string CoreExe = Path.Combine(InstallDir, "RRN.Agent.exe");
    private static readonly string StatusPath = Path.Combine(ProgramDataDir, "status.json");
    private static readonly string LogoPath = Path.Combine(InstallDir, "rrn-logo.png");

    private readonly NotifyIcon _notifyIcon;
    private readonly ToolStripMenuItem _connectionItem;
    private readonly ToolStripMenuItem _lastSyncItem;
    private readonly ToolStripMenuItem _locationItem;
    private readonly System.Windows.Forms.Timer _refreshTimer;
    private readonly System.Windows.Forms.Timer _locationTimer;
    private readonly System.Windows.Forms.Timer _promptTimer;
    private Icon? _ownedIcon;
    private Geolocator? _geolocator;
    private bool _syncing;
    private bool _locationRefreshing;

    private sealed record LocationSnapshot(
        string Source,
        string WindowsSource,
        double Latitude,
        double Longitude,
        double AccuracyM,
        DateTimeOffset CapturedAt);

    public TrayContext()
    {
        _connectionItem = new ToolStripMenuItem("Status: verificando...") { Enabled = false };
        _lastSyncItem = new ToolStripMenuItem("Última sincronização: —") { Enabled = false };
        _locationItem = new ToolStripMenuItem("Localização precisa: verificando...") { Enabled = false };

        var menu = new ContextMenuStrip();
        menu.Items.Add(new ToolStripMenuItem("RRN Agent") { Enabled = false, Font = new Font(SystemFonts.MenuFont, FontStyle.Bold) });
        menu.Items.Add(_connectionItem);
        menu.Items.Add(_lastSyncItem);
        menu.Items.Add(_locationItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Abrir RRN Manager", null, (_, _) => OpenManager());
        menu.Items.Add("Sincronizar agora", null, async (_, _) => await SynchronizeNowAsync());
        menu.Items.Add("Ativar / atualizar localização precisa", null, async (_, _) => await CapturePreciseLocationAsync(true, true));
        menu.Items.Add("Configurações de localização do Windows", null, (_, _) => OpenLocationSettings());
        menu.Items.Add("Atualizar agente", null, (_, _) => StartSelfUpdate());
        menu.Items.Add("Sobre / Status", null, (_, _) => ShowStatusWindow());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Sair", null, (_, _) => ExitTray());

        _notifyIcon = new NotifyIcon
        {
            Text = "RRN Agent",
            Visible = true,
            ContextMenuStrip = menu,
            Icon = LoadBrandIcon()
        };
        _notifyIcon.DoubleClick += (_, _) => ShowStatusWindow();

        _refreshTimer = new System.Windows.Forms.Timer { Interval = 30_000 };
        _refreshTimer.Tick += (_, _) => RefreshStatus();
        _refreshTimer.Start();

        _locationTimer = new System.Windows.Forms.Timer { Interval = 5_000 };
        _locationTimer.Tick += async (_, _) =>
        {
            _locationTimer.Stop();
            _locationTimer.Interval = 15 * 60 * 1000;
            _locationTimer.Start();
            if (IsPreciseLocationEnabled()) await CapturePreciseLocationAsync(false, false);
        };
        _locationTimer.Start();

        _promptTimer = new System.Windows.Forms.Timer { Interval = 3_500 };
        _promptTimer.Tick += async (_, _) =>
        {
            _promptTimer.Stop();
            if (WasLocationPrompted() || IsPreciseLocationEnabled()) return;
            MarkLocationPrompted();
            var answer = MessageBox.Show(
                "O RRN Agent pode usar o serviço de localização do Windows para registrar uma posição mais precisa da máquina (GPS/GNSS, Wi-Fi ou rede, conforme disponível).\n\nA localização só será usada após sua autorização no Windows. Deseja ativar agora?",
                "RRN Agent · Localização precisa",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Information);
            if (answer == DialogResult.Yes) await CapturePreciseLocationAsync(true, true);
        };
        _promptTimer.Start();

        RefreshStatus();
    }

    private Icon LoadBrandIcon()
    {
        try
        {
            if (File.Exists(LogoPath))
            {
                using var bitmap = new Bitmap(LogoPath);
                using var resized = new Bitmap(bitmap, new Size(32, 32));
                var handle = resized.GetHicon();
                try
                {
                    _ownedIcon = (Icon)Icon.FromHandle(handle).Clone();
                    return _ownedIcon;
                }
                finally { DestroyIcon(handle); }
            }
        }
        catch { }
        return SystemIcons.Application;
    }

    private void RefreshStatus()
    {
        var status = ReadJson(StatusPath);
        var lastResult = ReadString(status, "lastResult") ?? ReadString(status, "LastResult");
        var lastSync = ReadDate(status, "lastSyncAt") ?? ReadDate(status, "LastSyncAt");
        var lastMessage = ReadString(status, "lastMessage") ?? ReadString(status, "LastMessage") ?? string.Empty;
        var linked = status is not null
            && !lastMessage.Contains("não vinculado", StringComparison.OrdinalIgnoreCase)
            && (!string.IsNullOrWhiteSpace(lastResult) || lastSync.HasValue);
        var location = ReadPreciseLocation();

        _connectionItem.Text = linked
            ? (string.Equals(lastResult, "error", StringComparison.OrdinalIgnoreCase) ? "Status: atenção" : "Status: conectado")
            : "Status: não vinculado";
        _lastSyncItem.Text = lastSync.HasValue
            ? $"Última sincronização: {lastSync.Value.LocalDateTime:dd/MM/yyyy HH:mm}"
            : "Última sincronização: —";
        _locationItem.Text = location is not null
            ? $"Localização precisa: {SourceLabel(location.Source)} · ±{FormatAccuracy(location.AccuracyM)}"
            : IsPreciseLocationEnabled() ? "Localização precisa: aguardando posição" : "Localização precisa: desativada";
        _notifyIcon.Text = linked ? "RRN Agent - conectado" : "RRN Agent - não vinculado";
    }

    private async Task<LocationSnapshot?> CapturePreciseLocationAsync(bool requestAccess, bool showFeedback)
    {
        if (_locationRefreshing) return ReadPreciseLocation();
        _locationRefreshing = true;
        try
        {
            if (requestAccess)
            {
                var access = await Geolocator.RequestAccessAsync();
                if (access != GeolocationAccessStatus.Allowed)
                {
                    SetPreciseLocationEnabled(false);
                    RefreshStatus();
                    if (showFeedback)
                    {
                        var open = MessageBox.Show(
                            "O Windows não autorizou o acesso à localização. Você pode habilitar em Privacidade e segurança > Localização.\n\nDeseja abrir essa configuração agora?",
                            "RRN Agent · Localização",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Warning);
                        if (open == DialogResult.Yes) OpenLocationSettings();
                    }
                    return null;
                }
                SetPreciseLocationEnabled(true);
            }
            else if (!IsPreciseLocationEnabled())
            {
                return null;
            }

            _geolocator ??= new Geolocator
            {
                DesiredAccuracy = PositionAccuracy.High,
                DesiredAccuracyInMeters = 10
            };

            var position = await _geolocator.GetGeopositionAsync(TimeSpan.FromMinutes(1), TimeSpan.FromSeconds(20));
            var coordinate = position.Coordinate;
            var point = coordinate.Point.Position;
            var snapshot = new LocationSnapshot(
                NormalizeSource(coordinate.PositionSource),
                coordinate.PositionSource.ToString(),
                point.Latitude,
                point.Longitude,
                coordinate.Accuracy,
                coordinate.Timestamp);

            SavePreciseLocation(snapshot);
            RefreshStatus();
            if (showFeedback)
            {
                ShowBalloon(
                    "RRN Agent · Localização",
                    $"Posição atualizada: {SourceLabel(snapshot.Source)}, precisão estimada ±{FormatAccuracy(snapshot.AccuracyM)}.",
                    ToolTipIcon.Info);
            }
            return snapshot;
        }
        catch (UnauthorizedAccessException)
        {
            SetPreciseLocationEnabled(false);
            RefreshStatus();
            if (showFeedback) MessageBox.Show("O acesso à localização foi bloqueado pelo Windows.", "RRN Agent", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return null;
        }
        catch (Exception ex)
        {
            if (showFeedback) ShowBalloon("RRN Agent · Localização", $"Não foi possível obter a posição agora: {ex.Message}", ToolTipIcon.Warning);
            return null;
        }
        finally
        {
            _locationRefreshing = false;
        }
    }

    private static string NormalizeSource(PositionSource source) => source switch
    {
        PositionSource.Satellite => "gps",
        PositionSource.WiFi => "wifi",
        PositionSource.Cellular => "cellular",
        PositionSource.IPAddress => "windows_ip",
        PositionSource.Default => "windows_default",
        PositionSource.Obfuscated => "windows_coarse",
        _ => "windows"
    };

    private static string SourceLabel(string? source) => (source ?? string.Empty).ToLowerInvariant() switch
    {
        "gps" => "GPS / GNSS",
        "wifi" => "Wi-Fi",
        "cellular" => "Rede celular",
        "windows_ip" => "IP via Windows",
        "windows_default" => "Local definido no Windows",
        "windows_coarse" => "Localização aproximada do Windows",
        "ip" => "IP público",
        _ => "Serviço de localização do Windows"
    };

    private static string FormatAccuracy(double meters)
    {
        if (meters < 1000) return $"{Math.Max(1, Math.Round(meters)):0} m";
        return $"{meters / 1000d:0.0} km";
    }

    private static void SavePreciseLocation(LocationSnapshot snapshot)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RegistryPath, writable: true);
            var payload = new Dictionary<string, object?>
            {
                ["source"] = snapshot.Source,
                ["windows_source"] = snapshot.WindowsSource,
                ["latitude"] = snapshot.Latitude,
                ["longitude"] = snapshot.Longitude,
                ["accuracy_m"] = snapshot.AccuracyM,
                ["captured_at"] = snapshot.CapturedAt.ToUniversalTime().ToString("O")
            };
            key?.SetValue(LocationValue, JsonSerializer.Serialize(payload), RegistryValueKind.String);
            key?.SetValue(LocationEnabledValue, 1, RegistryValueKind.DWord);
        }
        catch { }
    }

    private static LocationSnapshot? ReadPreciseLocation()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryPath);
            var raw = key?.GetValue(LocationValue)?.ToString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (!root.TryGetProperty("latitude", out var latEl) || !latEl.TryGetDouble(out var lat) || lat is < -90 or > 90) return null;
            if (!root.TryGetProperty("longitude", out var lonEl) || !lonEl.TryGetDouble(out var lon) || lon is < -180 or > 180) return null;
            var accuracy = root.TryGetProperty("accuracy_m", out var accEl) && accEl.TryGetDouble(out var acc) ? Math.Max(0, acc) : 0d;
            var source = root.TryGetProperty("source", out var sourceEl) ? sourceEl.GetString() ?? "windows" : "windows";
            var windowsSource = root.TryGetProperty("windows_source", out var winEl) ? winEl.GetString() ?? "Unknown" : "Unknown";
            var capturedRaw = root.TryGetProperty("captured_at", out var capEl) ? capEl.GetString() : null;
            var captured = DateTimeOffset.TryParse(capturedRaw, out var parsed) ? parsed : DateTimeOffset.MinValue;
            return new LocationSnapshot(source, windowsSource, lat, lon, accuracy, captured);
        }
        catch { return null; }
    }

    private static bool IsPreciseLocationEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryPath);
            return Convert.ToInt32(key?.GetValue(LocationEnabledValue, 0) ?? 0) == 1;
        }
        catch { return false; }
    }

    private static void SetPreciseLocationEnabled(bool enabled)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RegistryPath, writable: true);
            key?.SetValue(LocationEnabledValue, enabled ? 1 : 0, RegistryValueKind.DWord);
        }
        catch { }
    }

    private static bool WasLocationPrompted()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryPath);
            return Convert.ToInt32(key?.GetValue(LocationPromptedValue, 0) ?? 0) == 1;
        }
        catch { return false; }
    }

    private static void MarkLocationPrompted()
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RegistryPath, writable: true);
            key?.SetValue(LocationPromptedValue, 1, RegistryValueKind.DWord);
        }
        catch { }
    }

    private async Task SynchronizeNowAsync()
    {
        if (_syncing) return;
        if (!File.Exists(CoreExe))
        {
            ShowBalloon("RRN Agent", "Executável principal não encontrado.", ToolTipIcon.Error);
            return;
        }

        _syncing = true;
        try
        {
            if (IsPreciseLocationEnabled()) await CapturePreciseLocationAsync(false, false);
            var beforeStatus = ReadJson(StatusPath);
            var before = ReadDate(beforeStatus, "lastSyncAt") ?? ReadDate(beforeStatus, "LastSyncAt");

            var psi = new ProcessStartInfo("schtasks.exe")
            {
                UseShellExecute = true,
                Verb = "runas",
                Arguments = $"/Run /TN \"{ManualTaskName}\""
            };
            using var process = Process.Start(psi);
            if (process is null) throw new InvalidOperationException("Não foi possível acionar a tarefa segura de sincronização.");
            await process.WaitForExitAsync();
            if (process.ExitCode != 0)
                throw new InvalidOperationException("O Windows não autorizou a tarefa de sincronização. Reinstale o agente se a tarefa automática tiver sido removida.");

            for (var attempt = 0; attempt < 80; attempt++)
            {
                await Task.Delay(500);
                var status = ReadJson(StatusPath);
                var current = ReadDate(status, "lastSyncAt") ?? ReadDate(status, "LastSyncAt");
                if (!current.HasValue || (before.HasValue && current.Value <= before.Value)) continue;

                var result = ReadString(status, "lastResult") ?? ReadString(status, "LastResult");
                var message = ReadString(status, "lastMessage") ?? ReadString(status, "LastMessage");
                RefreshStatus();
                if (string.Equals(result, "error", StringComparison.OrdinalIgnoreCase))
                    ShowBalloon("RRN Agent", string.IsNullOrWhiteSpace(message) ? "A sincronização retornou erro." : message, ToolTipIcon.Error);
                else
                    ShowBalloon("RRN Agent", string.IsNullOrWhiteSpace(message) ? "Inventário sincronizado com sucesso." : message, ToolTipIcon.Info);
                return;
            }

            RefreshStatus();
            ShowBalloon("RRN Agent", "A sincronização foi solicitada ao Windows. O resultado aparecerá no status assim que a tarefa concluir.", ToolTipIcon.Info);
        }
        catch (System.ComponentModel.Win32Exception ex) when (ex.NativeErrorCode == 1223)
        {
            ShowBalloon("RRN Agent", "Sincronização cancelada: a elevação do Windows não foi autorizada.", ToolTipIcon.Warning);
        }
        catch (Exception ex)
        {
            ShowBalloon("RRN Agent", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _syncing = false;
        }
    }

    private void ShowStatusWindow()
    {
        var status = ReadJson(StatusPath);
        var linked = status is not null;
        var lastSync = ReadDate(status, "lastSyncAt") ?? ReadDate(status, "LastSyncAt");
        var lastMessage = ReadString(status, "lastMessage") ?? ReadString(status, "LastMessage") ?? "—";
        var version = typeof(TrayContext).Assembly.GetName().Version?.ToString(3) ?? "0.4.0";
        var nextSync = NextScheduledSync();
        var location = ReadPreciseLocation();
        var locationText = location is null
            ? (IsPreciseLocationEnabled() ? "Aguardando posição" : "Desativada")
            : $"{SourceLabel(location.Source)} · ±{FormatAccuracy(location.AccuracyM)}\nCoordenadas: {location.Latitude:F6}, {location.Longitude:F6}\nAtualizada: {location.CapturedAt.LocalDateTime:dd/MM/yyyy HH:mm}";

        MessageBox.Show(
            $"Vínculo: {(linked ? "Ativo" : "Não vinculado")}\nVersão: {version}\nÚltima sincronização: {(lastSync.HasValue ? lastSync.Value.LocalDateTime.ToString("dd/MM/yyyy HH:mm") : "—")}\nPróxima sincronização: {nextSync:dd/MM/yyyy HH:mm}\nÚltimo status: {lastMessage}\n\nLocalização: {locationText}\n\nSegurança: credencial isolada do usuário padrão; sincronizações executadas pela tarefa protegida do Windows; entrada de rede bloqueada; atualizações verificadas por SHA-256.",
            "RRN Agent · Status",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }

    private void StartSelfUpdate()
    {
        var answer = MessageBox.Show(
            "O RRN Agent vai baixar a versão mais recente, verificar a integridade dos executáveis e reiniciar o ícone da bandeja. Continuar?",
            "Atualizar RRN Agent",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (answer != DialogResult.Yes) return;

        try
        {
            var scriptPath = Path.Combine(Path.GetTempPath(), $"rrn-agent-update-{Guid.NewGuid():N}.ps1");
            var script = $$"""
param([string]$InstallDir,[int]$TrayPid)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$base='{{ReleaseBase}}'
$temp=Join-Path $env:TEMP ('rrn-agent-update-' + [guid]::NewGuid().ToString('N'))
$logDir=Join-Path $env:ProgramData 'RRN Manager Agent'
$logPath=Join-Path $logDir 'update-security.log'
New-Item -ItemType Directory -Force -Path $temp,$logDir | Out-Null

function Write-UpdateLog([string]$Message) {
  Add-Content -Path $logPath -Value ((Get-Date).ToString('o') + ' ' + $Message) -Encoding UTF8
}

function Get-VerifiedReleaseFile([string]$Name) {
  $target=Join-Path $temp $Name
  $hashFile=Join-Path $temp ($Name + '.sha256')
  Invoke-WebRequest -UseBasicParsing -Uri ($base + '/' + $Name) -OutFile $target
  Invoke-WebRequest -UseBasicParsing -Uri ($base + '/' + $Name + '.sha256') -OutFile $hashFile
  $expected=(Get-Content -Raw $hashFile).Trim().ToLowerInvariant()
  if ($expected -notmatch '^[a-f0-9]{64}$') { throw ('Hash publicado inválido para ' + $Name) }
  $actual=(Get-FileHash -Algorithm SHA256 -Path $target).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw ('Falha de integridade em ' + $Name + '. Atualização cancelada.') }
  return $target
}

function Get-SafeVersion([string]$Path) {
  try {
    $raw=(Get-Item $Path).VersionInfo.FileVersion
    if ([string]::IsNullOrWhiteSpace($raw)) { return [version]'0.0.0.0' }
    return [version](($raw -split '[^0-9\.]')[0])
  } catch { return [version]'0.0.0.0' }
}

$coreNew=Get-VerifiedReleaseFile 'RRN.Agent.exe'
$trayNew=Get-VerifiedReleaseFile 'RRN.Agent.Tray.exe'
try { Invoke-WebRequest -UseBasicParsing -Uri ($base + '/rrn-logo.png') -OutFile (Join-Path $temp 'rrn-logo.png') } catch {}

$coreCurrent=Join-Path $InstallDir 'RRN.Agent.exe'
$trayCurrent=Join-Path $InstallDir 'RRN.Agent.Tray.exe'
if ((Test-Path $coreCurrent) -and ((Get-SafeVersion $coreNew) -lt (Get-SafeVersion $coreCurrent))) { throw 'Downgrade do RRN.Agent.exe recusado.' }
if ((Test-Path $trayCurrent) -and ((Get-SafeVersion $trayNew) -lt (Get-SafeVersion $trayCurrent))) { throw 'Downgrade do RRN.Agent.Tray.exe recusado.' }

$coreBackup=Join-Path $temp 'RRN.Agent.exe.bak'
$trayBackup=Join-Path $temp 'RRN.Agent.Tray.exe.bak'
if (Test-Path $coreCurrent) { Copy-Item $coreCurrent $coreBackup -Force }
if (Test-Path $trayCurrent) { Copy-Item $trayCurrent $trayBackup -Force }

try {
  try { Wait-Process -Id $TrayPid -Timeout 20 -ErrorAction SilentlyContinue } catch {}
  Copy-Item $coreNew $coreCurrent -Force
  Copy-Item $trayNew $trayCurrent -Force
  if (Test-Path (Join-Path $temp 'rrn-logo.png')) { Copy-Item (Join-Path $temp 'rrn-logo.png') (Join-Path $InstallDir 'rrn-logo.png') -Force }
  Write-UpdateLog 'Atualização concluída com hashes SHA-256 validados.'
} catch {
  Write-UpdateLog ('Falha na atualização: ' + $_.Exception.Message)
  if (Test-Path $coreBackup) { Copy-Item $coreBackup $coreCurrent -Force -ErrorAction SilentlyContinue }
  if (Test-Path $trayBackup) { Copy-Item $trayBackup $trayCurrent -Force -ErrorAction SilentlyContinue }
  throw
} finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}

Start-Process $trayCurrent
Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
""";
            File.WriteAllText(scriptPath, script);
            var psi = new ProcessStartInfo("powershell.exe")
            {
                UseShellExecute = true,
                Verb = "runas",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\" -InstallDir \"{InstallDir}\" -TrayPid {Environment.ProcessId}"
            };
            Process.Start(psi);
            ShowBalloon("RRN Agent", "Atualização segura iniciada. Os hashes serão validados antes da substituição.", ToolTipIcon.Info);
            Application.Exit();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "RRN Agent", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static DateTime NextScheduledSync()
    {
        var now = DateTime.Now;
        var morning = now.Date.AddHours(8);
        var evening = now.Date.AddHours(18);
        if (now < morning) return morning;
        if (now < evening) return evening;
        return now.Date.AddDays(1).AddHours(8);
    }

    private static JsonDocument? ReadJson(string path)
    {
        try { return File.Exists(path) ? JsonDocument.Parse(File.ReadAllText(path)) : null; }
        catch { return null; }
    }

    private static string? ReadString(JsonDocument? doc, string property)
    {
        if (doc is null) return null;
        return doc.RootElement.TryGetProperty(property, out var value) ? value.GetString() : null;
    }

    private static DateTimeOffset? ReadDate(JsonDocument? doc, string property)
    {
        var raw = ReadString(doc, property);
        return DateTimeOffset.TryParse(raw, out var value) ? value : null;
    }

    private static void OpenManager()
    {
        try { Process.Start(new ProcessStartInfo(ManagerUrl) { UseShellExecute = true }); }
        catch { }
    }

    private static void OpenLocationSettings()
    {
        try { Process.Start(new ProcessStartInfo("ms-settings:privacy-location") { UseShellExecute = true }); }
        catch { }
    }

    private void ShowBalloon(string title, string text, ToolTipIcon icon)
    {
        _notifyIcon.BalloonTipTitle = title;
        _notifyIcon.BalloonTipText = text.Length > 220 ? text[..220] : text;
        _notifyIcon.BalloonTipIcon = icon;
        _notifyIcon.ShowBalloonTip(3500);
    }

    private void ExitTray()
    {
        var answer = MessageBox.Show(
            "Fechar apenas o ícone do RRN Agent? As sincronizações automáticas de 08:00 e 18:00 continuarão ativas.",
            "Sair do RRN Agent",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (answer != DialogResult.Yes) return;
        ExitThread();
    }

    protected override void ExitThreadCore()
    {
        _refreshTimer.Stop();
        _locationTimer.Stop();
        _promptTimer.Stop();
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        _ownedIcon?.Dispose();
        base.ExitThreadCore();
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyIcon(IntPtr hIcon);
}
