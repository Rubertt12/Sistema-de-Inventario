using System.Net;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace RRN.Agent.Tray;

internal static class SecurityGuard
{
    private static System.Threading.Timer? _auditTimer;

    [ModuleInitializer]
    internal static void Initialize()
    {
        // O Tray roda no contexto do usuário padrão e, por projeto, não deve ler
        // o agent.json, que contém a credencial protegida para SYSTEM/Administradores.
        // A validação do endpoint permanece no Core, executado pela tarefa protegida.
        AuditOrTerminate();
        _auditTimer = new System.Threading.Timer(_ => AuditOrTerminate(), null, TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(10));
    }

    private static void AuditOrTerminate()
    {
        try
        {
            var ports = CurrentProcessListenerPorts();
            if (ports.Count > 0)
                Terminate($"Porta TCP em estado LISTENING detectada no processo da bandeja: {string.Join(", ", ports)}.");
        }
        catch
        {
            // A regra de bloqueio de entrada do Windows Firewall continua como camada adicional.
        }
    }

    private static List<int> CurrentProcessListenerPorts()
    {
        var ports = new HashSet<int>();
        ReadIpv4Listeners(ports);
        ReadIpv6Listeners(ports);
        return ports.OrderBy(p => p).ToList();
    }

    private static void ReadIpv4Listeners(HashSet<int> ports)
    {
        ReadTable(2, ptr =>
        {
            var row = Marshal.PtrToStructure<MibTcpRowOwnerPid>(ptr);
            if (row.OwningPid == (uint)Environment.ProcessId) ports.Add(DecodePort(row.LocalPort));
            return Marshal.SizeOf<MibTcpRowOwnerPid>();
        });
    }

    private static void ReadIpv6Listeners(HashSet<int> ports)
    {
        ReadTable(23, ptr =>
        {
            var row = Marshal.PtrToStructure<MibTcp6RowOwnerPid>(ptr);
            if (row.OwningPid == (uint)Environment.ProcessId) ports.Add(DecodePort(row.LocalPort));
            return Marshal.SizeOf<MibTcp6RowOwnerPid>();
        });
    }

    private static void ReadTable(int addressFamily, Func<IntPtr, int> readRow)
    {
        var size = 0;
        _ = GetExtendedTcpTable(IntPtr.Zero, ref size, false, addressFamily, TcpTableClass.OwnerPidListener, 0);
        if (size <= 4) return;

        var table = Marshal.AllocHGlobal(size);
        try
        {
            var result = GetExtendedTcpTable(table, ref size, false, addressFamily, TcpTableClass.OwnerPidListener, 0);
            if (result != 0) return;
            var count = Marshal.ReadInt32(table);
            var current = IntPtr.Add(table, sizeof(int));
            for (var i = 0; i < count; i++)
            {
                var rowSize = readRow(current);
                current = IntPtr.Add(current, rowSize);
            }
        }
        finally
        {
            Marshal.FreeHGlobal(table);
        }
    }

    private static int DecodePort(uint rawPort) =>
        (ushort)IPAddress.NetworkToHostOrder(unchecked((short)(rawPort & 0xFFFF)));

    private static void Terminate(string message)
    {
        try
        {
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RRN Manager Agent");
            Directory.CreateDirectory(dir);
            File.AppendAllText(Path.Combine(dir, "security.log"), $"{DateTimeOffset.UtcNow:O} {message}{Environment.NewLine}");
        }
        catch { }
        Environment.FailFast($"RRN Agent bloqueado por proteção de rede. {message}");
    }

    private enum TcpTableClass
    {
        OwnerPidListener = 3
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MibTcpRowOwnerPid
    {
        public uint State;
        public uint LocalAddr;
        public uint LocalPort;
        public uint RemoteAddr;
        public uint RemotePort;
        public uint OwningPid;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MibTcp6RowOwnerPid
    {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)] public byte[] LocalAddr;
        public uint LocalScopeId;
        public uint LocalPort;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)] public byte[] RemoteAddr;
        public uint RemoteScopeId;
        public uint RemotePort;
        public uint State;
        public uint OwningPid;
    }

    [DllImport("iphlpapi.dll", SetLastError = true)]
    private static extern uint GetExtendedTcpTable(
        IntPtr pTcpTable,
        ref int dwOutBufLen,
        bool sort,
        int ipVersion,
        TcpTableClass tableClass,
        uint reserved);
}
