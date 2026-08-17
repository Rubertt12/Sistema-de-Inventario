using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace RRN.Agent.Setup;

internal static class VerifiedDownload
{
    internal static async Task DownloadAsync(HttpClient http, string releaseBase, string fileName, string target)
    {
        var downloadPath = target + ".download";
        var hashUrl = $"{releaseBase}/{fileName}.sha256";
        try
        {
            await DownloadFileAsync(http, $"{releaseBase}/{fileName}", downloadPath);
            var expected = (await http.GetStringAsync(hashUrl)).Trim().ToLowerInvariant();
            if (!Regex.IsMatch(expected, "^[a-f0-9]{64}$"))
                throw new InvalidOperationException($"Hash publicado inválido para {fileName}.");

            await using var stream = File.OpenRead(downloadPath);
            var actual = Convert.ToHexString(await SHA256.HashDataAsync(stream)).ToLowerInvariant();
            if (!CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(actual),
                    Convert.FromHexString(expected)))
                throw new InvalidOperationException($"Falha de integridade em {fileName}. A instalação foi cancelada.");

            File.Move(downloadPath, target, true);
        }
        finally
        {
            try { if (File.Exists(downloadPath)) File.Delete(downloadPath); } catch { }
        }
    }

    internal static async Task DownloadFileAsync(HttpClient http, string url, string target)
    {
        using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        await using var source = await response.Content.ReadAsStreamAsync();
        await using var file = File.Create(target);
        await source.CopyToAsync(file);
    }
}
