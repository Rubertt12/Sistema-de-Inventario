using System.Management;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace RRN.Agent;

internal static class Program
{
    private const string DefaultEndpoint = "https://tvfiicmwkddpswgbjyok.supabase.co/functions/v1/rrn-agent";
    private const string UserRegistryPath = @"Software\RRN Manager Agent";
    private const string PreciseLocationValue = "PreciseLocationJson";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(35) };
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static readonly string AgentVersion = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.3.0";
    private static readonly string ConfigDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RRN Manager Agent");
    private static readonly string ConfigPath = Path.Combine(ConfigDirectory, "agent.json");
    private static readonly string StatusPath = Path.Combine(ConfigDirectory, "status.json");

    private sealed record AgentConfig(string Endpoint, string DeviceId, string SecretProtected);
    private sealed record EnrollmentResponse(bool Ok, string? DeviceId, string? AgentSecret, string? TenantId, string? AssetId, string? LocationMode);

    public static async Task<int> Main(string[] args)
    {
        try
        {
            var command = args.FirstOrDefault()?.Trim().ToLowerInvariant() ?? "run";
            return command switch
            {
                "enroll" => await EnrollAsync(args),
                "run" => await HeartbeatAsync(args),
                "status" => PrintStatus(),
                _ => Usage()
            };
        }
        catch (Exception ex)
        {
            WriteStatus("error", ex.Message, null);
            Console.Error.WriteLine($"RRN Agent: {ex.Message}");
            return 1;
        }
    }

    private static int Usage()
    {
        Console.WriteLine("RRN Agent Windows");
        Console.WriteLine("  enroll --code RRN-... [--endpoint URL]");
        Console.WriteLine("  run [--kind morning|evening|manual]");
        Console.WriteLine("  status");
        return 2;
    }

    private static int PrintStatus()
    {
        var config = LoadConfig();
        if (config is null)
        {
            Console.WriteLine("RRN Agent não vinculado.");
            return 1;
        }
        Console.WriteLine($"Dispositivo: {config.DeviceId}");
        Console.WriteLine($"Endpoint: {config.Endpoint}");
        Console.WriteLine($"Versão: {AgentVersion}");
        Console.WriteLine($"Configuração: {ConfigPath}");
        var location = LoadFreshPreciseLocation();
        Console.WriteLine(location is null ? "Localização precisa: indisponível ou desatualizada" : $"Localização precisa: {location["source"]} · {location["latitude"]}, {location["longitude"]}");
        return 0;
    }

    private static async Task<int> EnrollAsync(string[] args)
    {
        var code = Arg(args, "--code")?.Trim();
        if (string.IsNullOrWhiteSpace(code)) throw new InvalidOperationException("Informe o código de instalação com --code.");
        var endpoint = Arg(args, "--endpoint")?.Trim() ?? DefaultEndpoint;
        var inventory = CollectInventory();
        var location = LoadFreshPreciseLocation();
        var payload = new Dictionary<string, object?>
        {
            ["action"] = "enroll",
            ["enrollment_code"] = code,
            ["device_fingerprint"] = inventory["device_fingerprint"],
            ["agent_version"] = AgentVersion,
            ["inventory"] = inventory
        };
        if (location is not null) payload["location"] = location;

        using var response = await Http.PostAsJsonAsync(endpoint, payload, Json);
        var raw = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Falha ao vincular agente ({(int)response.StatusCode}): {raw}");
        var result = JsonSerializer.Deserialize<EnrollmentResponse>(raw, Json)
                     ?? throw new InvalidOperationException("Resposta de vínculo inválida.");
        if (!result.Ok || string.IsNullOrWhiteSpace(result.DeviceId) || string.IsNullOrWhiteSpace(result.AgentSecret))
            throw new InvalidOperationException("O servidor não retornou as credenciais do dispositivo.");

        SaveConfig(endpoint, result.DeviceId, result.AgentSecret);
        WriteStatus("ok", "Agente vinculado e inventário inicial enviado.", location);
        Console.WriteLine($"RRN Agent vinculado com sucesso. Device ID: {result.DeviceId}");
        Console.WriteLine("Inventário inicial enviado ao RRN Manager.");
        return 0;
    }

    private static async Task<int> HeartbeatAsync(string[] args)
    {
        var config = LoadConfig() ?? throw new InvalidOperationException("Agente não vinculado. Execute o instalador novamente com um código válido.");
        var secret = Unprotect(config.SecretProtected);
        var inventory = CollectInventory();
        var location = LoadFreshPreciseLocation();
        var kind = Arg(args, "--kind")?.Trim() ?? "scheduled";
        var payload = new Dictionary<string, object?>
        {
            ["action"] = "heartbeat",
            ["device_id"] = config.DeviceId,
            ["heartbeat_kind"] = kind,
            ["agent_version"] = AgentVersion,
            ["inventory"] = inventory
        };
        if (location is not null) payload["location"] = location;

        using var request = new HttpRequestMessage(HttpMethod.Post, config.Endpoint);
        request.Headers.Add("x-rrn-device-id", config.DeviceId);
        request.Headers.Add("x-rrn-agent-key", secret);
        request.Content = JsonContent.Create(payload, options: Json);
        using var response = await Http.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Heartbeat recusado ({(int)response.StatusCode}): {raw}");
        WriteStatus("ok", location is null ? "Inventário sincronizado. Localização precisa indisponível; backend usou fallback quando possível." : "Inventário e localização precisa sincronizados.", location);
        Console.WriteLine($"RRN Agent sincronizado em {DateTimeOffset.Now:dd/MM/yyyy HH:mm:ss}.");
        return 0;
    }

    private static Dictionary<string, object?> CollectInventory()
    {
        var computer = WmiFirst("SELECT Manufacturer,Model,TotalPhysicalMemory,UserName,Domain FROM Win32_ComputerSystem",
            "Manufacturer", "Model", "TotalPhysicalMemory", "UserName", "Domain");
        var bios = WmiFirst("SELECT SerialNumber FROM Win32_BIOS", "SerialNumber");
        var enclosure = WmiFirst("SELECT SMBIOSAssetTag,ChassisTypes FROM Win32_SystemEnclosure", "SMBIOSAssetTag", "ChassisTypes");
        var os = WmiFirst("SELECT Caption,Version,BuildNumber FROM Win32_OperatingSystem", "Caption", "Version", "BuildNumber");
        var cpu = WmiFirst("SELECT Name FROM Win32_Processor", "Name");

        var serial = CleanIdentity(bios.GetValueOrDefault("SerialNumber"));
        var assetTag = CleanIdentity(enclosure.GetValueOrDefault("SMBIOSAssetTag"));
        var manufacturer = CleanText(computer.GetValueOrDefault("Manufacturer"));
        var model = CleanText(computer.GetValueOrDefault("Model"));
        var machineGuid = ReadMachineGuid();
        var fingerprintSeed = string.Join("|", new[] { serial, assetTag, machineGuid, manufacturer, model, Environment.MachineName }.Where(v => !string.IsNullOrWhiteSpace(v)));
        var fingerprint = Sha256(fingerprintSeed);
        var networks = NetworkData();

        return new Dictionary<string, object?>
        {
            ["agent_version"] = AgentVersion,
            ["device_fingerprint"] = fingerprint,
            ["hostname"] = Environment.MachineName,
            ["equipment_type"] = DetectEquipmentType(model),
            ["serial_number"] = serial,
            ["asset_tag"] = assetTag,
            ["manufacturer"] = manufacturer,
            ["model"] = model,
            ["os_name"] = CleanText(os.GetValueOrDefault("Caption")) ?? Environment.OSVersion.Platform.ToString(),
            ["os_version"] = CleanText(os.GetValueOrDefault("Version")) ?? Environment.OSVersion.Version.ToString(),
            ["os_build"] = CleanText(os.GetValueOrDefault("BuildNumber")),
            ["cpu_name"] = CleanText(cpu.GetValueOrDefault("Name")),
            ["ram_bytes"] = ParseLong(computer.GetValueOrDefault("TotalPhysicalMemory")),
            ["storage"] = StorageData(),
            ["mac_addresses"] = networks.Macs,
            ["ip_addresses"] = networks.Ips,
            ["logged_user"] = CleanText(computer.GetValueOrDefault("UserName")) ?? Environment.UserName,
            ["domain_name"] = CleanText(computer.GetValueOrDefault("Domain")) ?? Environment.UserDomainName,
            ["timezone"] = TimeZoneInfo.Local.Id,
            ["collected_at"] = DateTimeOffset.UtcNow
        };
    }

    private static Dictionary<string, object?>? LoadFreshPreciseLocation()
    {
        try
        {
            var raw = ReadPreciseLocationJson();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (!root.TryGetProperty("latitude", out var latEl) || !latEl.TryGetDouble(out var lat) || lat is < -90 or > 90) return null;
            if (!root.TryGetProperty("longitude", out var lonEl) || !lonEl.TryGetDouble(out var lon) || lon is < -180 or > 180) return null;
            var capturedRaw = root.TryGetProperty("captured_at", out var capturedEl) ? capturedEl.GetString() : null;
            if (!DateTimeOffset.TryParse(capturedRaw, out var captured)) return null;
            if (DateTimeOffset.UtcNow - captured.ToUniversalTime() > TimeSpan.FromMinutes(90)) return null;
            var accuracy = root.TryGetProperty("accuracy_m", out var accEl) && accEl.TryGetDouble(out var parsedAccuracy) ? Math.Max(0, parsedAccuracy) : 0d;
            var source = root.TryGetProperty("source", out var sourceEl) ? sourceEl.GetString() : "windows";
            var windowsSource = root.TryGetProperty("windows_source", out var winEl) ? winEl.GetString() : null;
            return new Dictionary<string, object?>
            {
                ["source"] = string.IsNullOrWhiteSpace(source) ? "windows" : source,
                ["windows_source"] = windowsSource,
                ["latitude"] = lat,
                ["longitude"] = lon,
                ["accuracy_m"] = accuracy,
                ["captured_at"] = captured.ToUniversalTime().ToString("O")
            };
        }
        catch { return null; }
    }

    private static string? ReadPreciseLocationJson()
    {
        try
        {
            using var current = Registry.CurrentUser.OpenSubKey(UserRegistryPath);
            var rawCurrent = current?.GetValue(PreciseLocationValue)?.ToString();
            if (!string.IsNullOrWhiteSpace(rawCurrent)) return rawCurrent;
        }
        catch { }

        try
        {
            var user = WmiFirst("SELECT UserName FROM Win32_ComputerSystem", "UserName").GetValueOrDefault("UserName");
            if (string.IsNullOrWhiteSpace(user)) return null;
            var account = new NTAccount(user);
            var sid = (SecurityIdentifier)account.Translate(typeof(SecurityIdentifier));
            using var key = Registry.Users.OpenSubKey($@"{sid.Value}\{UserRegistryPath}");
            return key?.GetValue(PreciseLocationValue)?.ToString();
        }
        catch { return null; }
    }

    private static void WriteStatus(string result, string message, Dictionary<string, object?>? location)
    {
        try
        {
            Directory.CreateDirectory(ConfigDirectory);
            var payload = new Dictionary<string, object?>
            {
                ["lastResult"] = result,
                ["lastSyncAt"] = DateTimeOffset.UtcNow.ToString("O"),
                ["lastMessage"] = message,
                ["agentVersion"] = AgentVersion
            };
            if (location is not null)
            {
                payload["locationSource"] = location.GetValueOrDefault("source");
                payload["locationAccuracyM"] = location.GetValueOrDefault("accuracy_m");
            }
            File.WriteAllText(StatusPath, JsonSerializer.Serialize(payload, Json), Encoding.UTF8);
        }
        catch { }
    }

    private static string DetectEquipmentType(string? model)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT DeviceID FROM Win32_Battery");
            using var results = searcher.Get();
            if (results.Count > 0) return "Notebook";
        }
        catch { }
        var value = (model ?? string.Empty).ToLowerInvariant();
        if (value.Contains("workstation") || value.Contains("precision")) return "Workstation";
        return "Desktop";
    }

    private static List<Dictionary<string, object?>> StorageData()
    {
        var list = new List<Dictionary<string, object?>>();
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT DeviceID,VolumeName,Size,FreeSpace,FileSystem FROM Win32_LogicalDisk WHERE DriveType=3");
            using var results = searcher.Get();
            foreach (ManagementObject item in results)
            {
                list.Add(new Dictionary<string, object?>
                {
                    ["drive"] = item["DeviceID"]?.ToString(),
                    ["label"] = item["VolumeName"]?.ToString(),
                    ["file_system"] = item["FileSystem"]?.ToString(),
                    ["size_bytes"] = ParseLong(item["Size"]?.ToString()),
                    ["free_bytes"] = ParseLong(item["FreeSpace"]?.ToString())
                });
            }
        }
        catch { }
        return list;
    }

    private static (List<string> Macs, List<string> Ips) NetworkData()
    {
        var macs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var ips = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.NetworkInterfaceType is NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel) continue;
                var mac = nic.GetPhysicalAddress()?.ToString();
                if (!string.IsNullOrWhiteSpace(mac)) macs.Add(string.Join(":", Enumerable.Range(0, mac.Length / 2).Select(i => mac.Substring(i * 2, 2))));
                foreach (var address in nic.GetIPProperties().UnicastAddresses)
                {
                    if (address.Address.AddressFamily is AddressFamily.InterNetwork or AddressFamily.InterNetworkV6)
                    {
                        if (!System.Net.IPAddress.IsLoopback(address.Address)) ips.Add(address.Address.ToString());
                    }
                }
            }
        }
        catch { }
        return (macs.ToList(), ips.ToList());
    }

    private static Dictionary<string, string?> WmiFirst(string query, params string[] properties)
    {
        var result = properties.ToDictionary(p => p, _ => (string?)null, StringComparer.OrdinalIgnoreCase);
        try
        {
            using var searcher = new ManagementObjectSearcher(query);
            using var collection = searcher.Get();
            foreach (ManagementObject item in collection)
            {
                foreach (var property in properties)
                {
                    var value = item[property];
                    if (value is Array array) result[property] = string.Join(",", array.Cast<object?>().Select(v => v?.ToString()));
                    else result[property] = value?.ToString();
                }
                break;
            }
        }
        catch { }
        return result;
    }

    private static string? ReadMachineGuid()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            return key?.GetValue("MachineGuid")?.ToString();
        }
        catch { return null; }
    }

    private static string? CleanIdentity(string? value)
    {
        value = CleanText(value);
        if (value is null) return null;
        var normalized = value.ToLowerInvariant();
        var invalid = new[] { "to be filled", "default string", "system serial number", "none", "unknown", "not specified", "not applicable" };
        return invalid.Any(normalized.Contains) ? null : value;
    }

    private static string? CleanText(string? value)
    {
        var cleaned = value?.Trim();
        return string.IsNullOrWhiteSpace(cleaned) ? null : cleaned;
    }

    private static long? ParseLong(string? value) => long.TryParse(value, out var parsed) ? parsed : null;

    private static string Sha256(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string Protect(string secret)
    {
        var bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(secret), null, DataProtectionScope.LocalMachine);
        return Convert.ToBase64String(bytes);
    }

    private static string Unprotect(string protectedSecret)
    {
        var bytes = ProtectedData.Unprotect(Convert.FromBase64String(protectedSecret), null, DataProtectionScope.LocalMachine);
        return Encoding.UTF8.GetString(bytes);
    }

    private static void SaveConfig(string endpoint, string deviceId, string secret)
    {
        Directory.CreateDirectory(ConfigDirectory);
        var config = new AgentConfig(endpoint, deviceId, Protect(secret));
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(config, Json), Encoding.UTF8);
    }

    private static AgentConfig? LoadConfig()
    {
        if (!File.Exists(ConfigPath)) return null;
        return JsonSerializer.Deserialize<AgentConfig>(File.ReadAllText(ConfigPath, Encoding.UTF8), Json);
    }

    private static string? Arg(string[] args, string name)
    {
        for (var i = 0; i < args.Length - 1; i++)
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase)) return args[i + 1];
        return null;
    }
}
