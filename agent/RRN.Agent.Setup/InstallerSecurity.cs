using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace RRN.Agent.Setup;

internal static class InstallerSecurity
{
    private const string RuleCore = "RRN Agent - Block inbound core";
    private const string RuleTray = "RRN Agent - Block inbound tray";
    private static readonly string InstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "RRN Manager Agent");
    private static readonly string CoreExe = Path.Combine(InstallDir, "RRN.Agent.exe");
    private static readonly string TrayExe = Path.Combine(InstallDir, "RRN.Agent.Tray.exe");
    private static readonly string ProgramDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RRN Manager Agent");
    private static readonly string ConfigPath = Path.Combine(ProgramDataDir, "agent.json");
    private static readonly string StatusPath = Path.Combine(ProgramDataDir, "status.json");
    private static System.Threading.Timer? _timer;
    private static int _running;
    private static int _attempts;

    [ModuleInitializer]
    internal static void Initialize()
    {
        var uninstall = Environment.GetCommandLineArgs().Any(a => string.Equals(a, "--uninstall", StringComparison.OrdinalIgnoreCase));
        if (uninstall)
        {
            RemoveFirewallRules();
            return;
        }

        _timer = new System.Threading.Timer(_ => TryApply(), null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2));
    }

    private static void TryApply()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return;
        try
        {
            _attempts++;
            if (!File.Exists(CoreExe) || !File.Exists(TrayExe) || !File.Exists(ConfigPath) || !File.Exists(StatusPath))
            {
                if (_attempts >= 90) _timer?.Dispose();
                return;
            }

            ApplyFirewallRules();
            HardenDataPermissions();
            WriteMarker();
            _timer?.Dispose();
        }
        catch (Exception ex)
        {
            WriteSecurityLog($"Falha ao aplicar hardening: {ex.Message}");
            if (_attempts >= 90) _timer?.Dispose();
        }
        finally
        {
            Interlocked.Exchange(ref _running, 0);
        }
    }

    private static void ApplyFirewallRules()
    {
        RunNetsh(false, "advfirewall", "firewall", "delete", "rule", $"name={RuleCore}");
        RunNetsh(false, "advfirewall", "firewall", "delete", "rule", $"name={RuleTray}");

        RunNetsh(true, "advfirewall", "firewall", "add", "rule", $"name={RuleCore}", "dir=in", "action=block", $"program={CoreExe}", "enable=yes", "profile=any");
        RunNetsh(true, "advfirewall", "firewall", "add", "rule", $"name={RuleTray}", "dir=in", "action=block", $"program={TrayExe}", "enable=yes", "profile=any");
    }

    private static void HardenDataPermissions()
    {
        if (!Directory.Exists(ProgramDataDir)) return;

        RunProcess("icacls.exe", true,
            ProgramDataDir,
            "/inheritance:r",
            "/grant:r",
            "*S-1-5-18:(OI)(CI)F",
            "*S-1-5-32-544:(OI)(CI)F",
            "*S-1-5-32-545:(OI)(CI)RX");

        if (File.Exists(ConfigPath))
        {
            RunProcess("icacls.exe", true,
                ConfigPath,
                "/inheritance:r",
                "/grant:r",
                "*S-1-5-18:F",
                "*S-1-5-32-544:F",
                "*S-1-5-32-545:R");
        }

        if (File.Exists(StatusPath))
        {
            RunProcess("icacls.exe", true,
                StatusPath,
                "/inheritance:r",
                "/grant:r",
                "*S-1-5-18:F",
                "*S-1-5-32-544:F",
                "*S-1-5-32-545:M");
        }
    }

    private static void RemoveFirewallRules()
    {
        try { RunNetsh(false, "advfirewall", "firewall", "delete", "rule", $"name={RuleCore}"); } catch { }
        try { RunNetsh(false, "advfirewall", "firewall", "delete", "rule", $"name={RuleTray}"); } catch { }
    }

    private static void RunNetsh(bool required, params string[] args) => RunProcess("netsh.exe", required, args);

    private static void RunProcess(string fileName, bool required, params string[] args)
    {
        var psi = new ProcessStartInfo(fileName)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var arg in args) psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi);
        if (process is null)
        {
            if (required) throw new InvalidOperationException($"Não foi possível executar {fileName}.");
            return;
        }
        process.WaitForExit(15000);
        if (!process.HasExited)
        {
            try { process.Kill(true); } catch { }
            if (required) throw new TimeoutException($"Tempo excedido ao executar {fileName}.");
            return;
        }
        if (required && process.ExitCode != 0)
        {
            var error = process.StandardError.ReadToEnd();
            throw new InvalidOperationException($"{fileName} retornou código {process.ExitCode}. {error}".Trim());
        }
    }

    private static void WriteMarker()
    {
        try
        {
            Directory.CreateDirectory(ProgramDataDir);
            File.WriteAllText(Path.Combine(ProgramDataDir, "security-hardening.txt"),
                $"RRN Agent hardening ativo\r\nAplicado em: {DateTimeOffset.Now:O}\r\nEntrada de rede: bloqueada para Core e Tray\r\n");
        }
        catch { }
    }

    private static void WriteSecurityLog(string message)
    {
        try
        {
            Directory.CreateDirectory(ProgramDataDir);
            File.AppendAllText(Path.Combine(ProgramDataDir, "security-hardening.log"),
                $"{DateTimeOffset.Now:O} {message}{Environment.NewLine}");
        }
        catch { }
    }
}
