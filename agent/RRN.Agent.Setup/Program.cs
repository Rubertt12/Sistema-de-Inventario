using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace RRN.Agent.Setup;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.Any(a => string.Equals(a, "--uninstall", StringComparison.OrdinalIgnoreCase)))
        {
            Application.Run(new UninstallForm());
            return;
        }
        Application.Run(new SetupForm());
    }
}

internal sealed class SetupForm : Form
{
    private const string ReleaseBase = "https://github.com/Rubertt12/Sistema-de-Inventario/releases/download/rrn-agent-latest";
    private const string Endpoint = "https://tvfiicmwkddpswgbjyok.supabase.co/functions/v1/rrn-agent";
    private const string TaskMorning = "RRN Agent - 08h";
    private const string TaskEvening = "RRN Agent - 18h";
    private static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RRN Manager Agent");
    private static readonly string CoreExe = Path.Combine(InstallDir, "RRN.Agent.exe");
    private static readonly string TrayExe = Path.Combine(InstallDir, "RRN.Agent.Tray.exe");
    private static readonly string SetupExe = Path.Combine(InstallDir, "RRN.Agent.Setup.exe");
    private static readonly string SetupPendingExe = Path.Combine(InstallDir, "RRN.Agent.Setup.pending.exe");
    private static readonly string LogoPng = Path.Combine(InstallDir, "rrn-logo.png");

    private readonly TextBox _code = new();
    private readonly Button _install = new();
    private readonly ProgressBar _progress = new();
    private readonly Label _status = new();
    private readonly Label _step = new();
    private readonly Button _openManager = new();
    private bool _busy;

    public SetupForm()
    {
        Text = "Instalar RRN Agent";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        Width = 600;
        Height = 470;
        BackColor = Color.FromArgb(248, 250, 250);
        Font = new Font("Segoe UI", 10F);
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!);

        var header = new Panel { Dock = DockStyle.Top, Height = 112, BackColor = Color.FromArgb(22, 58, 77) };
        var title = new Label { Text = "RRN Agent", ForeColor = Color.White, Font = new Font("Segoe UI Semibold", 22F, FontStyle.Bold), AutoSize = true, Left = 28, Top = 22 };
        var subtitle = new Label { Text = "Inventário automático do RRN Manager", ForeColor = Color.FromArgb(205, 229, 229), AutoSize = true, Left = 31, Top = 68 };
        header.Controls.AddRange([title, subtitle]);

        var intro = new Label
        {
            Text = "Digite o código de instalação gerado no RRN Manager. O aplicativo fará o cadastro da máquina, instalará o agente e configurará as sincronizações automaticamente.",
            Left = 30, Top = 138, Width = 520, Height = 52, ForeColor = Color.FromArgb(67, 83, 91)
        };

        var codeLabel = new Label { Text = "Código de instalação", Left = 30, Top = 202, Width = 200, Height = 22, Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold) };
        _code.SetBounds(30, 228, 520, 36);
        _code.CharacterCasing = CharacterCasing.Upper;
        _code.PlaceholderText = "RRN-XXXXXXXXXXXXXXXXXXXXXXXX";

        _install.Text = IsInstalled() ? "Atualizar / vincular agente" : "Instalar RRN Agent";
        _install.SetBounds(30, 282, 210, 42);
        _install.BackColor = Color.FromArgb(47, 125, 120);
        _install.ForeColor = Color.White;
        _install.FlatStyle = FlatStyle.Flat;
        _install.FlatAppearance.BorderSize = 0;
        _install.Click += async (_, _) => await InstallAsync();

        _openManager.Text = "Abrir RRN Manager";
        _openManager.SetBounds(250, 282, 165, 42);
        _openManager.FlatStyle = FlatStyle.Flat;
        _openManager.Click += (_, _) => OpenManager();

        _progress.SetBounds(30, 344, 520, 8);
        _progress.Style = ProgressBarStyle.Continuous;
        _progress.Minimum = 0;
        _progress.Maximum = 100;
        _step.SetBounds(30, 364, 520, 24);
        _step.Text = "Pronto para instalar.";
        _step.ForeColor = Color.FromArgb(67, 83, 91);
        _status.SetBounds(30, 392, 520, 38);
        _status.ForeColor = Color.FromArgb(47, 125, 120);

        Controls.AddRange([header, intro, codeLabel, _code, _install, _openManager, _progress, _step, _status]);
        Shown += (_, _) => TryPasteEnrollmentCode();
        FormClosing += (_, e) => { if (_busy) e.Cancel = true; };
    }

    private static bool IsInstalled() => File.Exists(CoreExe) || File.Exists(TrayExe);

    private void TryPasteEnrollmentCode()
    {
        try
        {
            if (!Clipboard.ContainsText()) return;
            var match = Regex.Match(Clipboard.GetText().Trim(), @"RRN-[A-Z0-9]{12,64}", RegexOptions.IgnoreCase);
            if (match.Success) _code.Text = match.Value.ToUpperInvariant();
        }
        catch { }
    }

    private async Task InstallAsync()
    {
        if (_busy) return;
        var code = _code.Text.Trim().ToUpperInvariant();
        if (!Regex.IsMatch(code, @"^RRN-[A-Z0-9]{12,64}$"))
        {
            MessageBox.Show("Informe um código RRN válido gerado em Configurações → Agente RRN.", "RRN Agent", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        _busy = true;
        _install.Enabled = false;
        _code.Enabled = false;
        _status.Text = string.Empty;

        var temp = Path.Combine(Path.GetTempPath(), "rrn-agent-setup-" + Guid.NewGuid().ToString("N"));
        var deferredSetupReplacement = false;
        try
        {
            Directory.CreateDirectory(temp);
            Directory.CreateDirectory(InstallDir);

            SetStep(6, "Encerrando processos antigos do RRN Agent...");
            PrepareForReplacement();

            using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(4) };
            SetStep(16, "Baixando e verificando agente principal...");
            await VerifiedDownload.DownloadAsync(http, ReleaseBase, "RRN.Agent.exe", Path.Combine(temp, "RRN.Agent.exe"));
            SetStep(30, "Baixando e verificando aplicativo da bandeja...");
            await VerifiedDownload.DownloadAsync(http, ReleaseBase, "RRN.Agent.Tray.exe", Path.Combine(temp, "RRN.Agent.Tray.exe"));
            SetStep(42, "Baixando e verificando o instalador...");
            await VerifiedDownload.DownloadAsync(http, ReleaseBase, "RRN.Agent.Setup.exe", Path.Combine(temp, "RRN.Agent.Setup.exe"));
            await DownloadAsync(http, $"{ReleaseBase}/rrn-logo.png", Path.Combine(temp, "rrn-logo.png"), 48, "Baixando identidade visual...");

            SetStep(54, "Instalando arquivos verificados do RRN Agent...");
            CopyWithRetry(Path.Combine(temp, "RRN.Agent.exe"), CoreExe);
            CopyWithRetry(Path.Combine(temp, "RRN.Agent.Tray.exe"), TrayExe);
            CopyWithRetry(Path.Combine(temp, "rrn-logo.png"), LogoPng);

            var runningSetup = Environment.ProcessPath ?? string.Empty;
            var downloadedSetup = Path.Combine(temp, "RRN.Agent.Setup.exe");
            if (PathsEqual(runningSetup, SetupExe))
            {
                CopyWithRetry(downloadedSetup, SetupPendingExe);
                deferredSetupReplacement = true;
            }
            else
            {
                CopyWithRetry(downloadedSetup, SetupExe);
                TryDelete(SetupPendingExe);
            }

            SetStep(64, "Vinculando esta máquina ao RRN Manager...");
            var enroll = await RunAsync(CoreExe, ["enroll", "--code", code, "--endpoint", Endpoint], true);
            if (enroll.ExitCode != 0)
                throw new InvalidOperationException(string.IsNullOrWhiteSpace(enroll.Error) ? "O servidor não aceitou o vínculo da máquina." : enroll.Error.Trim());

            SetStep(76, "Configurando sincronizações das 08:00 e 18:00...");
            CreateScheduledTask(TaskMorning, "08:00", "morning");
            CreateScheduledTask(TaskEvening, "18:00", "evening");

            SetStep(84, "Configurando inicialização com o Windows...");
            using (var run = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true))
                run?.SetValue("RRN Agent", $"\"{TrayExe}\"", RegistryValueKind.String);

            RegisterInstalledApplication();
            CreateStartMenuLinks();

            SetStep(94, "Iniciando RRN Agent...");
            Process.Start(new ProcessStartInfo(TrayExe) { UseShellExecute = true });

            if (deferredSetupReplacement)
                ScheduleSetupReplacement();

            SetStep(100, "Instalação concluída.");
            _status.Text = "✓ RRN Agent instalado, vinculado e sincronizado com sucesso.";
            _install.Text = "Reinstalar / atualizar";
            MessageBox.Show("RRN Agent instalado com sucesso. Processos antigos foram encerrados antes da substituição e a integridade dos executáveis foi validada.", "RRN Agent", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        catch (Exception ex)
        {
            _progress.Value = 0;
            _step.Text = "A instalação não foi concluída.";
            _status.ForeColor = Color.FromArgb(190, 70, 70);
            _status.Text = ex.Message;
            MessageBox.Show(ex.Message, "Falha ao instalar RRN Agent", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            try { if (Directory.Exists(temp)) Directory.Delete(temp, true); } catch { }
            if (!deferredSetupReplacement) TryDelete(SetupPendingExe);
            _busy = false;
            _install.Enabled = true;
            _code.Enabled = true;
        }
    }

    private async Task DownloadAsync(HttpClient http, string url, string target, int progress, string message)
    {
        SetStep(progress, message);
        using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        await using var source = await response.Content.ReadAsStreamAsync();
        await using var file = File.Create(target);
        await source.CopyToAsync(file);
    }

    private static void PrepareForReplacement()
    {
        EndScheduledTask(TaskMorning);
        EndScheduledTask(TaskEvening);
        StopProcess("RRN.Agent.Tray");
        StopProcess("RRN.Agent");
    }

    private static void StopProcess(string processName)
    {
        foreach (var process in Process.GetProcessesByName(processName))
        {
            try
            {
                process.Kill(true);
                process.WaitForExit(10000);
            }
            catch { }
            finally { process.Dispose(); }
        }
    }

    private static void EndScheduledTask(string name)
    {
        try
        {
            var psi = new ProcessStartInfo("schtasks.exe") { UseShellExecute = false, CreateNoWindow = true };
            foreach (var arg in new[] { "/End", "/TN", name }) psi.ArgumentList.Add(arg);
            using var process = Process.Start(psi);
            process?.WaitForExit(5000);
        }
        catch { }
    }

    private static void CopyWithRetry(string source, string destination)
    {
        Exception? last = null;
        for (var attempt = 1; attempt <= 20; attempt++)
        {
            try
            {
                File.Copy(source, destination, true);
                return;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                last = ex;
                if (string.Equals(destination, CoreExe, StringComparison.OrdinalIgnoreCase)) StopProcess("RRN.Agent");
                if (string.Equals(destination, TrayExe, StringComparison.OrdinalIgnoreCase)) StopProcess("RRN.Agent.Tray");
                Thread.Sleep(250);
            }
        }
        throw new IOException($"Não foi possível substituir {Path.GetFileName(destination)} porque o arquivo continua em uso por outro processo. Feche o RRN Agent e tente novamente.", last);
    }

    private static bool PathsEqual(string? first, string? second)
    {
        if (string.IsNullOrWhiteSpace(first) || string.IsNullOrWhiteSpace(second)) return false;
        try
        {
            return string.Equals(Path.GetFullPath(first), Path.GetFullPath(second), StringComparison.OrdinalIgnoreCase);
        }
        catch { return string.Equals(first, second, StringComparison.OrdinalIgnoreCase); }
    }

    private static void ScheduleSetupReplacement()
    {
        var pending = SetupPendingExe.Replace("'", "''");
        var target = SetupExe.Replace("'", "''");
        var script = $"$p=Get-Process -Id {Environment.ProcessId} -ErrorAction SilentlyContinue; if($p){{$p.WaitForExit()}}; for($i=0;$i -lt 30;$i++){{try{{Move-Item -LiteralPath '{pending}' -Destination '{target}' -Force; exit 0}}catch{{Start-Sleep -Milliseconds 500}}}}; exit 1";
        var psi = new ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true
        };
        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-ExecutionPolicy");
        psi.ArgumentList.Add("Bypass");
        psi.ArgumentList.Add("-Command");
        psi.ArgumentList.Add(script);
        Process.Start(psi);
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    private static async Task<(int ExitCode, string Output, string Error)> RunAsync(string fileName, IEnumerable<string> arguments, bool hidden)
    {
        var psi = new ProcessStartInfo(fileName)
        {
            UseShellExecute = false,
            CreateNoWindow = hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var arg in arguments) psi.ArgumentList.Add(arg);
        using var process = Process.Start(psi) ?? throw new InvalidOperationException($"Não foi possível iniciar {Path.GetFileName(fileName)}.");
        var output = process.StandardOutput.ReadToEndAsync();
        var error = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        return (process.ExitCode, await output, await error);
    }

    private static void CreateScheduledTask(string name, string time, string kind)
    {
        var psi = new ProcessStartInfo("schtasks.exe") { UseShellExecute = false, CreateNoWindow = true };
        foreach (var arg in new[] { "/Create", "/TN", name, "/TR", $"\"{CoreExe}\" run --kind {kind}", "/SC", "DAILY", "/ST", time, "/RU", "SYSTEM", "/RL", "HIGHEST", "/F" })
            psi.ArgumentList.Add(arg);
        using var process = Process.Start(psi) ?? throw new InvalidOperationException("Não foi possível configurar a sincronização automática.");
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException($"Falha ao criar a tarefa automática {name}.");
    }

    private static void RegisterInstalledApplication()
    {
        using var key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\RRN Manager Agent", true);
        if (key is null) return;
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.4.0";
        key.SetValue("DisplayName", "RRN Manager Agent");
        key.SetValue("DisplayVersion", version);
        key.SetValue("Publisher", "RRN Manager");
        key.SetValue("DisplayIcon", TrayExe);
        key.SetValue("InstallLocation", InstallDir);
        key.SetValue("UninstallString", $"\"{SetupExe}\" --uninstall");
        key.SetValue("QuietUninstallString", $"\"{SetupExe}\" --uninstall");
        key.SetValue("URLInfoAbout", "https://sistema-de-inventario-pearl.vercel.app/");
        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
    }

    private static void CreateStartMenuLinks()
    {
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu), "Programs", "RRN Manager Agent");
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, "Abrir RRN Manager.url"), "[InternetShortcut]\r\nURL=https://sistema-de-inventario-pearl.vercel.app/dashboard.html\r\n");
        }
        catch { }
    }

    private void SetStep(int value, string message)
    {
        _progress.Value = Math.Clamp(value, 0, 100);
        _step.Text = message;
        _status.ForeColor = Color.FromArgb(47, 125, 120);
        Application.DoEvents();
    }

    private static void OpenManager()
    {
        try { Process.Start(new ProcessStartInfo("https://sistema-de-inventario-pearl.vercel.app/dashboard.html") { UseShellExecute = true }); } catch { }
    }
}

internal sealed class UninstallForm : Form
{
    private static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RRN Manager Agent");
    private static readonly string SetupExe = Path.Combine(InstallDir, "RRN.Agent.Setup.exe");

    public UninstallForm()
    {
        Text = "Desinstalar RRN Agent";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        Width = 480;
        Height = 255;
        BackColor = Color.FromArgb(248, 250, 250);
        Font = new Font("Segoe UI", 10F);
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!);

        var title = new Label { Text = "Desinstalar RRN Agent?", Left = 28, Top = 28, Width = 390, Height = 34, Font = new Font("Segoe UI Semibold", 17F, FontStyle.Bold), ForeColor = Color.FromArgb(22, 58, 77) };
        var text = new Label { Text = "Isso remove o aplicativo desta máquina e as tarefas automáticas. O registro do computador no RRN Manager deve ser removido pela área Agente RRN.", Left = 30, Top = 76, Width = 400, Height = 54, ForeColor = Color.FromArgb(67, 83, 91) };
        var cancel = new Button { Text = "Cancelar", Left = 220, Top = 150, Width = 100, Height = 38 };
        var remove = new Button { Text = "Desinstalar", Left = 330, Top = 150, Width = 100, Height = 38, BackColor = Color.FromArgb(190, 70, 70), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
        cancel.Click += (_, _) => Close();
        remove.Click += (_, _) => Uninstall();
        Controls.AddRange([title, text, cancel, remove]);
    }

    private void Uninstall()
    {
        try
        {
            foreach (var processName in new[] { "RRN.Agent.Tray", "RRN.Agent" })
            {
                foreach (var process in Process.GetProcessesByName(processName))
                {
                    try { process.Kill(true); process.WaitForExit(5000); } catch { }
                    finally { process.Dispose(); }
                }
            }

            DeleteTask("RRN Agent - 08h");
            DeleteTask("RRN Agent - 18h");
            using (var run = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true)) run?.DeleteValue("RRN Agent", false);
            Registry.LocalMachine.DeleteSubKeyTree(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\RRN Manager Agent", false);

            try
            {
                var menu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu), "Programs", "RRN Manager Agent");
                if (Directory.Exists(menu)) Directory.Delete(menu, true);
            }
            catch { }

            foreach (var file in Directory.Exists(InstallDir) ? Directory.GetFiles(InstallDir) : [])
            {
                if (string.Equals(file, SetupExe, StringComparison.OrdinalIgnoreCase)) continue;
                try { File.Delete(file); } catch { }
            }

            var psi = new ProcessStartInfo("cmd.exe")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                Arguments = $"/c timeout /t 2 /nobreak >nul & del /f /q \"{SetupExe}\" & rmdir /s /q \"{InstallDir}\""
            };
            Process.Start(psi);
            MessageBox.Show("RRN Agent removido deste computador.", "RRN Agent", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Falha ao desinstalar", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void DeleteTask(string name)
    {
        try
        {
            var psi = new ProcessStartInfo("schtasks.exe") { UseShellExecute = false, CreateNoWindow = true };
            foreach (var arg in new[] { "/Delete", "/TN", name, "/F" }) psi.ArgumentList.Add(arg);
            using var process = Process.Start(psi); process?.WaitForExit();
        }
        catch { }
    }
}