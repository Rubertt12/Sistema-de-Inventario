using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

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
    private static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RRN Manager Agent");
    private static readonly string ProgramDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RRN Manager Agent");
    private static readonly string CoreExe = Path.Combine(InstallDir, "RRN.Agent.exe");
    private static readonly string ConfigPath = Path.Combine(ProgramDataDir, "agent.json");
    private static readonly string StatusPath = Path.Combine(ProgramDataDir, "status.json");
    private static readonly string LogoPath = Path.Combine(InstallDir, "rrn-logo.png");

    private readonly NotifyIcon _notifyIcon;
    private readonly ToolStripMenuItem _connectionItem;
    private readonly ToolStripMenuItem _lastSyncItem;
    private readonly System.Windows.Forms.Timer _refreshTimer;
    private Icon? _ownedIcon;
    private bool _syncing;

    public TrayContext()
    {
        _connectionItem = new ToolStripMenuItem("Status: verificando...") { Enabled = false };
        _lastSyncItem = new ToolStripMenuItem("Última sincronização: —") { Enabled = false };

        var menu = new ContextMenuStrip();
        menu.Items.Add(new ToolStripMenuItem("RRN Agent") { Enabled = false, Font = new Font(SystemFonts.MenuFont, FontStyle.Bold) });
        menu.Items.Add(_connectionItem);
        menu.Items.Add(_lastSyncItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Abrir RRN Manager", null, (_, _) => OpenManager());
        menu.Items.Add("Sincronizar agora", null, async (_, _) => await SynchronizeNowAsync());
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
                finally
                {
                    DestroyIcon(handle);
                }
            }
        }
        catch { }
        return SystemIcons.Application;
    }

    private void RefreshStatus()
    {
        var config = ReadJson(ConfigPath);
        var status = ReadJson(StatusPath);
        var deviceId = ReadString(config, "deviceId") ?? ReadString(config, "DeviceId");
        var connected = !string.IsNullOrWhiteSpace(deviceId);
        var lastResult = ReadString(status, "lastResult") ?? ReadString(status, "LastResult");
        var lastSync = ReadDate(status, "lastSyncAt") ?? ReadDate(status, "LastSyncAt");

        _connectionItem.Text = connected
            ? (string.Equals(lastResult, "error", StringComparison.OrdinalIgnoreCase) ? "Status: atenção" : "Status: conectado")
            : "Status: não vinculado";
        _lastSyncItem.Text = lastSync.HasValue
            ? $"Última sincronização: {lastSync.Value.LocalDateTime:dd/MM/yyyy HH:mm}"
            : "Última sincronização: —";
        _notifyIcon.Text = connected ? "RRN Agent - conectado" : "RRN Agent - não vinculado";
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
            var psi = new ProcessStartInfo(CoreExe, "run --kind manual")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            using var process = Process.Start(psi);
            if (process is null) throw new InvalidOperationException("Não foi possível iniciar a sincronização.");
            var stdoutTask = process.StandardOutput.ReadToEndAsync();
            var stderrTask = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            var stdout = await stdoutTask;
            var stderr = await stderrTask;
            RefreshStatus();

            if (process.ExitCode == 0)
                ShowBalloon("RRN Agent", string.IsNullOrWhiteSpace(stdout) ? "Inventário sincronizado com sucesso." : stdout.Trim(), ToolTipIcon.Info);
            else
                ShowBalloon("RRN Agent", string.IsNullOrWhiteSpace(stderr) ? "Falha ao sincronizar o inventário." : stderr.Trim(), ToolTipIcon.Error);
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
        var config = ReadJson(ConfigPath);
        var status = ReadJson(StatusPath);
        var deviceId = ReadString(config, "deviceId") ?? ReadString(config, "DeviceId") ?? "Não vinculado";
        var lastSync = ReadDate(status, "lastSyncAt") ?? ReadDate(status, "LastSyncAt");
        var lastMessage = ReadString(status, "lastMessage") ?? ReadString(status, "LastMessage") ?? "—";
        var version = typeof(TrayContext).Assembly.GetName().Version?.ToString(3) ?? "0.2.0";
        var nextSync = NextScheduledSync();

        using var form = new Form
        {
            Text = "RRN Agent",
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            Width = 460,
            Height = 360,
            BackColor = Color.FromArgb(248, 250, 250),
            Font = new Font("Segoe UI", 10F)
        };
        if (_notifyIcon.Icon is not null) form.Icon = _notifyIcon.Icon;

        var title = new Label
        {
            Text = "RRN Agent",
            Font = new Font("Segoe UI Semibold", 18F, FontStyle.Bold),
            ForeColor = Color.FromArgb(22, 58, 77),
            AutoSize = true,
            Left = 28,
            Top = 24
        };
        var subtitle = new Label
        {
            Text = File.Exists(ConfigPath) ? "● Conectado ao RRN Manager" : "● Não vinculado",
            ForeColor = File.Exists(ConfigPath) ? Color.FromArgb(47, 125, 120) : Color.FromArgb(190, 70, 70),
            AutoSize = true,
            Left = 30,
            Top = 66
        };

        var info = new Label
        {
            Text = $"Dispositivo: {deviceId}\nVersão: {version}\nÚltima sincronização: {(lastSync.HasValue ? lastSync.Value.LocalDateTime.ToString("dd/MM/yyyy HH:mm") : "—")}\nPróxima sincronização: {nextSync:dd/MM/yyyy HH:mm}\nÚltimo status: {lastMessage}",
            Left = 30,
            Top = 108,
            Width = 390,
            Height = 118,
            ForeColor = Color.FromArgb(38, 50, 56)
        };

        var sync = new Button { Text = "Sincronizar agora", Left = 30, Top = 246, Width = 150, Height = 38 };
        sync.Click += async (_, _) => { form.Hide(); await SynchronizeNowAsync(); form.Close(); };
        var open = new Button { Text = "Abrir RRN Manager", Left = 190, Top = 246, Width = 150, Height = 38 };
        open.Click += (_, _) => OpenManager();
        var close = new Button { Text = "Fechar", Left = 350, Top = 246, Width = 70, Height = 38 };
        close.Click += (_, _) => form.Close();

        form.Controls.AddRange([title, subtitle, info, sync, open, close]);
        form.ShowDialog();
    }

    private void StartSelfUpdate()
    {
        var answer = MessageBox.Show(
            "O RRN Agent vai baixar a versão mais recente e reiniciar o ícone da bandeja. Continuar?",
            "Atualizar RRN Agent",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (answer != DialogResult.Yes) return;

        try
        {
            var scriptPath = Path.Combine(Path.GetTempPath(), "rrn-agent-update.ps1");
            var script = $$"""
param([string]$InstallDir,[int]$TrayPid)
$ErrorActionPreference='Stop'
$base='{{ReleaseBase}}'
$temp=Join-Path $env:TEMP ('rrn-agent-update-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $temp | Out-Null
Invoke-WebRequest "$base/RRN.Agent.exe" -OutFile (Join-Path $temp 'RRN.Agent.exe')
Invoke-WebRequest "$base/RRN.Agent.Tray.exe" -OutFile (Join-Path $temp 'RRN.Agent.Tray.exe')
try { Invoke-WebRequest "$base/rrn-logo.png" -OutFile (Join-Path $temp 'rrn-logo.png') } catch {}
try { Wait-Process -Id $TrayPid -Timeout 20 -ErrorAction SilentlyContinue } catch {}
Copy-Item (Join-Path $temp 'RRN.Agent.exe') (Join-Path $InstallDir 'RRN.Agent.exe') -Force
Copy-Item (Join-Path $temp 'RRN.Agent.Tray.exe') (Join-Path $InstallDir 'RRN.Agent.Tray.exe') -Force
if (Test-Path (Join-Path $temp 'rrn-logo.png')) { Copy-Item (Join-Path $temp 'rrn-logo.png') (Join-Path $InstallDir 'rrn-logo.png') -Force }
Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
Start-Process (Join-Path $InstallDir 'RRN.Agent.Tray.exe')
""";
            File.WriteAllText(scriptPath, script);
            var psi = new ProcessStartInfo("powershell.exe")
            {
                UseShellExecute = true,
                Verb = "runas",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \"{scriptPath}\" -InstallDir \"{InstallDir}\" -TrayPid {Environment.ProcessId}"
            };
            Process.Start(psi);
            ShowBalloon("RRN Agent", "Atualização iniciada.", ToolTipIcon.Info);
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
        _notifyIcon.Visible = false;
        _notifyIcon.Dispose();
        _ownedIcon?.Dispose();
        base.ExitThreadCore();
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyIcon(IntPtr hIcon);
}
