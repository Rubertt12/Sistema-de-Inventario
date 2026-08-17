using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Security.Principal;

namespace RRN.Agent;

internal static class LocalSecretAcl
{
    private static readonly string ProgramDataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "RRN Manager Agent");
    private static readonly string ConfigPath = Path.Combine(ProgramDataDir, "agent.json");
    private static readonly string StatusPath = Path.Combine(ProgramDataDir, "status.json");

    [ModuleInitializer]
    internal static void Initialize()
    {
        TryApply();
    }

    internal static void TryApply()
    {
        if (!IsElevatedOrSystem() || !Directory.Exists(ProgramDataDir)) return;
        try
        {
            RunIcacls(
                ProgramDataDir,
                "/inheritance:r",
                "/grant:r",
                "*S-1-5-18:(OI)(CI)F",
                "*S-1-5-32-544:(OI)(CI)F",
                "*S-1-5-32-545:(OI)(CI)RX");

            if (File.Exists(ConfigPath))
            {
                RunIcacls(
                    ConfigPath,
                    "/inheritance:r",
                    "/grant:r",
                    "*S-1-5-18:F",
                    "*S-1-5-32-544:F");
            }

            if (File.Exists(StatusPath))
            {
                RunIcacls(
                    StatusPath,
                    "/inheritance:r",
                    "/grant:r",
                    "*S-1-5-18:F",
                    "*S-1-5-32-544:F",
                    "*S-1-5-32-545:R");
            }
        }
        catch
        {
            // O instalador também reaplica as ACLs. Falhar aqui não deve impedir o inventário.
        }
    }

    private static bool IsElevatedOrSystem()
    {
        try
        {
            using var identity = WindowsIdentity.GetCurrent();
            if (identity.User?.IsWellKnown(WellKnownSidType.LocalSystemSid) == true) return true;
            return new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch { return false; }
    }

    private static void RunIcacls(params string[] args)
    {
        var psi = new ProcessStartInfo("icacls.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        foreach (var arg in args) psi.ArgumentList.Add(arg);
        using var process = Process.Start(psi);
        if (process is null) return;
        process.WaitForExit(10_000);
        if (!process.HasExited)
        {
            try { process.Kill(true); } catch { }
        }
    }
}
