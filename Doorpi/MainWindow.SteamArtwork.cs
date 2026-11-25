using System.IO;
using System.Text.Json;
using Doorpi.Storage;
using Doorpi.Steam;
namespace Doorpi;
public partial class MainWindow
{
    private readonly SemaphoreSlim _steamHeaderGate = new(2);
    private async Task SendSteamGameHeaderAsync(int appId)
    {
        string? image = null;
        await _steamHeaderGate.WaitAsync();
        try
        {
            using var response = await SteamHttpClient.GetAsync($"https://store.steampowered.com/api/appdetails?appids={appId}&filters=basic");
            if (response.IsSuccessStatusCode)
            {
                using var data = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                if (data.RootElement.TryGetProperty(appId.ToString(), out var entry) && entry.TryGetProperty("data", out var details) &&
                    details.TryGetProperty("header_image", out var header) && Uri.TryCreate(header.GetString(), UriKind.Absolute, out var url) &&
                    url.Scheme == "https" && url.Host.EndsWith(".steamstatic.com", StringComparison.OrdinalIgnoreCase))
                    image = url.AbsoluteUri;
            }
        }
        catch (Exception e) when (e is System.Net.Http.HttpRequestException or OperationCanceledException or JsonException) { }
        finally { _steamHeaderGate.Release(); }
        PostProfileSyncMessage(new { type = "steamGameHeader", appId, image });
    }
    private readonly HashSet<string> _steamArtworkBackfilledUsers = new(StringComparer.OrdinalIgnoreCase);
    private void BackfillSteamHistoryArtwork(string owner)
    {
        if (string.IsNullOrWhiteSpace(owner) || _steamArtworkBackfilledUsers.Contains(owner)) return;
        string path = Path.Combine(dataFolder, "users", ProfileSync.GoogleOAuthClient.SafeProfileId(owner), "game-history.json");
        var snapshot = StateStorage.ReadSnapshot(new[] { path });
        if (snapshot.Documents[path] is { } content)
        {
            var history = JsonSerializer.Deserialize<List<GameHistoryEntry>>(content) ?? throw new InvalidDataException("Histórico inválido.");
            bool changed = false;
            foreach (var entry in history) changed |= SteamHistoryArtwork.FillMissing(entry);
            if (changed)
            {
                try { StateStorage.WriteBatchIfRevision(new Dictionary<string, string?> { [path] = JsonSerializer.Serialize(history) }, snapshot.Revisions); }
                catch (StorageConflictException) { return; }
                ScheduleProfileSync(owner);
            }
        }
        _steamArtworkBackfilledUsers.Add(owner);
    }
}
