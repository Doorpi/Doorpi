using Doorpi.ProfileSync;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text.Json;

namespace Doorpi;

public partial class MainWindow
{
    private readonly object _profileSyncServiceLock = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _profileSyncDebounces =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, ProfileSyncResult> _profileSyncConflicts =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, ProfileSyncResult> _profileSyncSetupImports =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, byte> _profileSyncConflictDeferred =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, byte> _profileArtworkWorkers =
        new(StringComparer.OrdinalIgnoreCase);
    private GoogleDriveSyncService? _profileSyncService;
    private string? _profileSyncDeviceId;
    private int _profileSyncApplyingRemote;
    private volatile bool _profileOAuthInputModeActive;
    private Thread? _profileOAuthInputThread;

    private GoogleDriveSyncService ProfileSyncService
    {
        get
        {
            lock (_profileSyncServiceLock)
            {
                return _profileSyncService ??= new GoogleDriveSyncService(
                    ResolveGoogleOAuthCredentialsPath(),
                    dataFolder,
                    "Doorpi");
            }
        }
    }

    private string ResolveGoogleOAuthCredentialsPath()
    {
        string outputPath = Path.Combine(AppContext.BaseDirectory, "google-oauth.local.json");
        if (File.Exists(outputPath)) return outputPath;

        string projectPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "google-oauth.local.json"));
        if (File.Exists(projectPath)) return projectPath;
        return outputPath;
    }

    private string GetProfileSyncDeviceId()
    {
        if (!string.IsNullOrWhiteSpace(_profileSyncDeviceId)) return _profileSyncDeviceId;
        string path = Path.Combine(dataFolder, "device-id.txt");
        try
        {
            string existing = File.Exists(path) ? File.ReadAllText(path).Trim() : "";
            if (!string.IsNullOrWhiteSpace(existing)) return _profileSyncDeviceId = existing;
            string created = Guid.NewGuid().ToString("N");
            File.WriteAllText(path, created);
            return _profileSyncDeviceId = created;
        }
        catch
        {
            return _profileSyncDeviceId = Environment.MachineName;
        }
    }

    private static byte[]? DecodeProfilePhoto(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64)) return null;
        string value = base64;
        int comma = value.IndexOf(',');
        if (value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && comma >= 0)
            value = value[(comma + 1)..];
        try { return Convert.FromBase64String(value); }
        catch { return null; }
    }

    private static string NormalizeProfileSyncId(string? profileId)
    {
        try { return GoogleOAuthClient.SafeProfileId(profileId ?? ""); }
        catch { return ""; }
    }

    private UserProfile? FindProfileForSync(string profileId)
        => LoadUserProfiles().FirstOrDefault(user =>
            string.Equals(user.Id, profileId, StringComparison.OrdinalIgnoreCase));

    private List<GameHistoryEntry> LoadProfileHistoryForSync(string profileId)
    {
        string path = Path.Combine(dataFolder, "users", profileId, "game-history.json");
        if (!File.Exists(path)) return new List<GameHistoryEntry>();
        try
        {
            return JsonSerializer.Deserialize<List<GameHistoryEntry>>(SafeReadAllText(path)) ?? new();
        }
        catch
        {
            return new List<GameHistoryEntry>();
        }
    }

    private (CloudProfileV1 Snapshot, byte[]? Photo)? CreateLocalProfileSyncSnapshot(string profileId)
    {
        UserProfile? profile = FindProfileForSync(profileId);
        if (profile == null) return null;
        CloudProfileV1 snapshot = ProfileSyncSnapshotFactory.Create(
            profile,
            LoadProfileHistoryForSync(profileId),
            GetProfileSyncDeviceId(),
            DateTimeOffset.UtcNow);
        return (snapshot, DecodeProfilePhoto(profile.PhotoBase64));
    }

    private void StartProfileOAuthInputMode()
    {
        if (_profileOAuthInputModeActive) return;
        _profileOAuthInputModeActive = true;
        Dispatcher.Invoke(() =>
        {
            EnsureCursorVisible();
            _mainScreenMouseVisible = true;
            CenterCursorOnScreen();
            UpdateHoverStateInWebView();
        });

        _profileOAuthInputThread = new Thread(() =>
            SharedGamepadControllerLoop(
                () => _profileOAuthInputModeActive,
                () => { },
                handleXboxButton: false,
                shouldAcceptInput: () => _profileOAuthInputModeActive))
        {
            IsBackground = true,
            Name = "Doorpi.ProfileOAuthInput"
        };
        _profileOAuthInputThread.Start();
    }

    private void StopProfileOAuthInputMode(bool restoreDoorpiFocus)
    {
        _profileOAuthInputModeActive = false;
        Thread? inputThread = _profileOAuthInputThread;
        _profileOAuthInputThread = null;
        if (inputThread != null && inputThread != Thread.CurrentThread && inputThread.IsAlive)
        {
            try { inputThread.Join(120); } catch { }
        }
        Dispatcher.Invoke(() =>
        {
            _desktopVkb?.Close();
            _desktopVkb = null;
            EnsureCursorVisible();
            EnsureCursorHidden();
            _mainScreenMouseVisible = false;
            _lastKnownCursorPos = new POINT { X = 0, Y = 0 };
            try { SetCursorPos(0, 0); } catch { }
            ReleaseAllStuckKeys();
            if (restoreDoorpiFocus) FocusDoorpiMainWebView(onlyIfFocusLost: false);
        });
    }

    private void CompleteProfileOAuthBrowserHandoff(string profileId, bool setup)
    {
        StopProfileOAuthInputMode(restoreDoorpiFocus: true);
        PostProfileSyncMessage(new
        {
            type = "profileSyncBusy",
            profileId,
            busy = true,
            setup,
            message = ProfileSyncLocalized(
                "Carregando informações do perfil...",
                "Loading profile information...")
        });
    }

    private void PostProfileSyncMessage(object payload)
    {
        _ = Dispatcher.BeginInvoke(() =>
        {
            try
            {
                webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(payload));
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[ProfileSync] Falha ao notificar interface: " + ex.Message);
            }
        });
    }

    private async Task<bool> TryHandleProfileSyncWebMessageAsync(string action, JsonElement root)
    {
        switch (action)
        {
            case "profileSyncStatus":
            {
                string profileId = GetStr(root, "profileId", currentUserId);
                await SendProfileSyncStatusAsync(profileId).ConfigureAwait(false);
                return true;
            }
            case "profileSyncConnect":
            {
                bool setup = root.TryGetProperty("setup", out JsonElement setupElement) && setupElement.GetBoolean();
                string profileId = GetStr(root, "profileId");
                if (string.IsNullOrWhiteSpace(profileId))
                    profileId = setup ? $"profile-{Guid.NewGuid():N}" : currentUserId;
                await ConnectProfileSyncAsync(profileId, setup).ConfigureAwait(false);
                return true;
            }
            case "profileSyncNow":
            {
                string profileId = GetStr(root, "profileId", currentUserId);
                _profileSyncConflictDeferred.TryRemove(profileId, out _);
                await RunProfileSyncAsync(profileId, notifyFailure: true).ConfigureAwait(false);
                return true;
            }
            case "profileSyncDisconnect":
            {
                string profileId = GetStr(root, "profileId", currentUserId);
                bool deleteCloud = root.TryGetProperty("deleteCloud", out JsonElement deleteElement) && deleteElement.GetBoolean();
                ProfileSyncResult result = await ProfileSyncService.DisconnectAsync(profileId, deleteCloud).ConfigureAwait(false);
                _profileSyncConflicts.TryRemove(profileId, out _);
                _profileSyncSetupImports.TryRemove(profileId, out _);
                RemoveProfileSyncNotification(profileId, "failure");
                RemoveProfileSyncNotification(profileId, "conflict");
                PostProfileSyncResult(profileId, result);
                return true;
            }
            case "profileSyncResolve":
            {
                string profileId = GetStr(root, "profileId", currentUserId);
                string choice = GetStr(root, "choice");
                await ResolveProfileSyncConflictAsync(profileId, choice).ConfigureAwait(false);
                return true;
            }
            default:
                return false;
        }
    }

    private async Task SendProfileSyncStatusAsync(string profileId)
    {
        ProfileConnectionStatus status = await ProfileSyncService.GetConnectionStatusAsync(profileId).ConfigureAwait(false);
        PostProfileSyncMessage(new
        {
            type = "profileSyncStatus",
            profileId,
            status = status.Status.ToString(),
            connected = status.HasStoredAuthorization && status.Status != SyncStatus.Disconnected,
            message = status.Message
        });
    }

    private async Task ConnectProfileSyncAsync(string profileId, bool setup)
    {
        PostProfileSyncMessage(new { type = "profileSyncBusy", profileId, busy = true, setup });
        StartProfileOAuthInputMode();
        try
        {
            ProfileSyncResult connected = await ProfileSyncService.ConnectAsync(
                    profileId,
                    () => CompleteProfileOAuthBrowserHandoff(profileId, setup))
                .ConfigureAwait(false);
            if (connected.Status is SyncStatus.Failed or SyncStatus.Offline or SyncStatus.AuthenticationRequired)
            {
                PostProfileSyncResult(profileId, connected, setup);
                return;
            }

            if (connected.Action == ProfileSyncAction.RemoteMissing)
            {
                if (setup)
                {
                    PostProfileSyncMessage(new
                    {
                        type = "profileSyncSetupResult",
                        setup = true,
                        profileId,
                        remoteExists = false,
                        connected = true
                    });
                }
                else
                {
                    (CloudProfileV1 Snapshot, byte[]? Photo)? local = CreateLocalProfileSyncSnapshot(profileId);
                    ProfileSyncResult result = local == null
                        ? new ProfileSyncResult { Status = SyncStatus.Failed, Message = "Perfil local não encontrado." }
                        : await ProfileSyncService.UploadProfileAsync(profileId, local.Value.Snapshot, local.Value.Photo)
                            .ConfigureAwait(false);
                    PostProfileSyncResult(profileId, result);
                }
                return;
            }

            if (setup)
            {
                ProfileSyncResult remote = await ProfileSyncService.DownloadProfileAsync(profileId).ConfigureAwait(false);
                if (remote.RemoteProfile == null)
                {
                    PostProfileSyncResult(profileId, remote, setup: true);
                    return;
                }

                string targetProfileId = NormalizeProfileSyncId(remote.RemoteProfile.ProfileId);
                if (string.IsNullOrWhiteSpace(targetProfileId)) targetProfileId = profileId;
                remote.RemoteProfile.ProfileId = targetProfileId;
                if (!string.Equals(profileId, targetProfileId, StringComparison.OrdinalIgnoreCase))
                    await ProfileSyncService.TransferConnectionAsync(profileId, targetProfileId).ConfigureAwait(false);

                if (FindProfileForSync(targetProfileId) != null)
                {
                    PostProfileSyncMessage(new
                    {
                        type = "profileSyncSetupResult",
                        setup = true,
                        profileId = targetProfileId,
                        remoteExists = true,
                        alreadyLocal = true,
                        connected = true
                    });
                    return;
                }

                _profileSyncSetupImports[targetProfileId] = remote;
                PostProfileSyncMessage(new
                {
                    type = "profileSyncSetupResult",
                    setup = true,
                    profileId = targetProfileId,
                    remoteExists = true,
                    connected = true,
                    profile = remote.RemoteProfile,
                    photoBase64 = remote.RemoteProfilePhoto is { Length: > 0 }
                        ? Convert.ToBase64String(remote.RemoteProfilePhoto)
                        : ""
                });
                return;
            }

            await RunProfileSyncAsync(profileId, notifyFailure: true).ConfigureAwait(false);
        }
        finally
        {
            StopProfileOAuthInputMode(restoreDoorpiFocus: true);
            PostProfileSyncMessage(new { type = "profileSyncBusy", profileId, busy = false, setup });
        }
    }

    private void PostProfileSyncResult(string profileId, ProfileSyncResult result, bool setup = false)
    {
        if (result.Status == SyncStatus.Conflict)
        {
            _profileSyncConflicts[profileId] = result;
            RemoveProfileSyncNotification(profileId, "conflict");
        }
        else if (result.Status is SyncStatus.Synced or SyncStatus.Uploaded or SyncStatus.Downloaded)
        {
            _profileSyncConflicts.TryRemove(profileId, out _);
            _profileSyncConflictDeferred.TryRemove(profileId, out _);
            RemoveProfileSyncNotification(profileId, "failure");
            RemoveProfileSyncNotification(profileId, "conflict");
        }

        PostProfileSyncMessage(new
        {
            type = result.Status == SyncStatus.Conflict ? "profileSyncConflict" : "profileSyncResult",
            profileId,
            setup,
            status = result.Status.ToString(),
            action = result.Action.ToString(),
            message = result.Message,
            differences = result.Differences.Select(difference => new
            {
                kind = difference.Kind.ToString(),
                difference.Path,
                difference.GameName,
                local = difference.LocalSummary,
                cloud = difference.RemoteSummary,
                difference.IsSensitive
            })
        });
    }

    private async Task RunProfileSyncAsync(
        string profileId,
        bool notifyFailure,
        CancellationToken cancellationToken = default)
    {
        if (Volatile.Read(ref _profileSyncApplyingRemote) == 1) return;
        if (!string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase)) return;
        (CloudProfileV1 Snapshot, byte[]? Photo)? local = CreateLocalProfileSyncSnapshot(profileId);
        if (local == null) return;

        ProfileSyncResult result = await ProfileSyncService.SyncAsync(
                profileId,
                local.Value.Snapshot,
                local.Value.Photo,
                cancellationToken)
            .ConfigureAwait(false);
        if (!string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase)) return;
        if (result.Status == SyncStatus.Downloaded && result.RemoteProfile != null)
        {
            await ApplyRemoteProfileAsync(profileId, result).ConfigureAwait(false);
            result = new ProfileSyncResult
            {
                Status = SyncStatus.Downloaded,
                Action = ProfileSyncAction.DownloadRemote,
                Message = result.Message
            };
        }
        PostProfileSyncResult(profileId, result);

        if (notifyFailure && result.Status is (SyncStatus.Offline or SyncStatus.AuthenticationRequired or SyncStatus.Failed))
            PostProfileSyncFailureNotification(profileId, result.Status);
    }

    private void ScheduleProfileSync(string? profileId = null, bool notifyFailure = false)
    {
        if (Volatile.Read(ref _profileSyncApplyingRemote) == 1) return;
        string id = string.IsNullOrWhiteSpace(profileId) ? currentUserId : profileId;
        if (string.IsNullOrWhiteSpace(id) || id == "default") return;
        if (!string.Equals(id, currentUserId, StringComparison.OrdinalIgnoreCase)) return;
        if (notifyFailure) _profileSyncConflictDeferred.TryRemove(id, out _);
        else if (_profileSyncConflictDeferred.ContainsKey(id)) return;

        foreach ((string pendingId, CancellationTokenSource pending) in _profileSyncDebounces)
        {
            if (!string.Equals(pendingId, id, StringComparison.OrdinalIgnoreCase)) pending.Cancel();
        }

        var cts = new CancellationTokenSource();
        _profileSyncDebounces.AddOrUpdate(id, cts, (_, previous) =>
        {
            previous.Cancel();
            previous.Dispose();
            return cts;
        });

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(1400, cts.Token).ConfigureAwait(false);
                if (!string.Equals(id, currentUserId, StringComparison.OrdinalIgnoreCase)) return;
                ProfileConnectionStatus status = await ProfileSyncService.GetConnectionStatusAsync(id, cts.Token)
                    .ConfigureAwait(false);
                if (status.HasStoredAuthorization && status.Status != SyncStatus.Disconnected)
                {
                    if (status.Status is SyncStatus.Offline or SyncStatus.AuthenticationRequired or SyncStatus.Failed)
                        PostProfileSyncFailureNotification(id, status.Status);
                    if (status.Status == SyncStatus.Synced)
                        await RunProfileSyncAsync(id, notifyFailure: true, cts.Token).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception ex) { Debug.WriteLine("[ProfileSync] Sincronização automática falhou: " + ex.Message); }
            finally
            {
                if (_profileSyncDebounces.TryGetValue(id, out CancellationTokenSource? current) && ReferenceEquals(current, cts))
                    _profileSyncDebounces.TryRemove(id, out _);
                cts.Dispose();
            }
        });
    }

    private async Task ResolveProfileSyncConflictAsync(string profileId, string choice)
    {
        if (string.Equals(choice, "later", StringComparison.OrdinalIgnoreCase))
        {
            _profileSyncConflictDeferred[profileId] = 0;
            PostProfileSyncConflictNotification(profileId);
            PostProfileSyncMessage(new { type = "profileSyncConflictClosed", profileId });
            return;
        }

        _profileSyncConflictDeferred.TryRemove(profileId, out _);
        RemoveProfileSyncNotification(profileId, "conflict");

        if (string.Equals(choice, "cloud", StringComparison.OrdinalIgnoreCase))
        {
            ProfileSyncResult remote = await ProfileSyncService.DownloadProfileAsync(profileId).ConfigureAwait(false);
            if (remote.RemoteProfile != null)
                await ApplyRemoteProfileAsync(profileId, remote).ConfigureAwait(false);
            PostProfileSyncResult(profileId, remote);
            return;
        }

        if (string.Equals(choice, "local", StringComparison.OrdinalIgnoreCase))
        {
            (CloudProfileV1 Snapshot, byte[]? Photo)? local = CreateLocalProfileSyncSnapshot(profileId);
            _profileSyncConflicts.TryGetValue(profileId, out ProfileSyncResult? conflict);
            ProfileSyncResult result = local == null
                ? new ProfileSyncResult { Status = SyncStatus.Failed, Message = "Perfil local não encontrado." }
                : await ProfileSyncService.UploadProfileAsync(
                    profileId,
                    local.Value.Snapshot,
                    local.Value.Photo,
                    conflict?.RemoteRevision).ConfigureAwait(false);
            PostProfileSyncResult(profileId, result);
        }
    }

    private async Task ApplyRemoteProfileAsync(string profileId, ProfileSyncResult result)
    {
        CloudProfileV1 remote = result.RemoteProfile ?? throw new InvalidOperationException("Perfil remoto ausente.");
        UserProfile? profile = FindProfileForSync(profileId);
        if (profile == null) return;

        Interlocked.Exchange(ref _profileSyncApplyingRemote, 1);
        try
        {
            (CloudProfileV1 Snapshot, byte[]? Photo)? local = CreateLocalProfileSyncSnapshot(profileId);
            if (local != null)
            {
                var store = new ProfileSyncLocalStore(Path.Combine(dataFolder, "users", profileId));
                await store.CreateBackupAsync(local.Value.Snapshot, "before-cloud-apply").ConfigureAwait(false);
            }

            RenameBrowserProfilesForSyncedName(profile.Name, remote.ProfileName);
            profile.Name = remote.ProfileName;
            profile.PinCode = NormalizePinCode(remote.PinCode);
            profile.SteamGridApiKey = remote.SteamGridApiKey ?? "";
            profile.DateCreated = remote.CreatedAtUtc?.LocalDateTime ?? profile.DateCreated;
            profile.PhotoSource = remote.ProfilePhoto.Source ?? "";
            profile.PhotoSourceUrl = remote.ProfilePhoto.SourceUrl ?? "";
            profile.PhotoSteamGridAssetId = remote.ProfilePhoto.SteamGridAssetId;
            profile.PhotoCropX = remote.ProfilePhoto.CropX;
            profile.PhotoCropY = remote.ProfilePhoto.CropY;
            profile.PhotoZoom = remote.ProfilePhoto.Zoom > 0 ? remote.ProfilePhoto.Zoom : 1;
            profile.PhotoBase64 = remote.ProfilePhoto.HasPhoto && result.RemoteProfilePhoto is { Length: > 0 }
                ? Convert.ToBase64String(result.RemoteProfilePhoto)
                : "";

            List<UserProfile> users = LoadUserProfiles();
            int profileIndex = users.FindIndex(user => string.Equals(user.Id, profileId, StringComparison.OrdinalIgnoreCase));
            if (profileIndex >= 0) users[profileIndex] = profile;
            SaveUserProfiles(users);
            WriteUserProfileFile(Path.Combine(dataFolder, "users", profileId, "user.json"), profile);

            List<GameHistoryEntry> previous = LoadProfileHistoryForSync(profileId);
            var previousByKey = previous
                .GroupBy(entry => ProfileSyncSnapshotFactory.NormalizeGameKey(entry.Name))
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
            List<GameHistoryEntry> appliedHistory = remote.Games.Select(game =>
            {
                previousByKey.TryGetValue(game.GameKey, out GameHistoryEntry? old);
                return new GameHistoryEntry
                {
                    Name = game.Name,
                    TotalPlaytimeMinutes = Math.Max(0, game.TotalPlaytimeSeconds / 60),
                    LastSessionMinutes = Math.Max(0, game.LastSessionSeconds / 60),
                    FirstPlayed = game.FirstPlayedUtc?.LocalDateTime ?? DateTime.MinValue,
                    LastPlayed = game.LastPlayedUtc?.LocalDateTime ?? DateTime.MinValue,
                    ShowcaseVerticalImageUrl = game.ShowcaseVerticalImageUrl ?? "",
                    HistoryHorizontalImageUrl = game.HistoryHorizontalImageUrl ?? "",
                    ProfileBannerImageUrl = game.ProfileBannerImageUrl ?? "",
                    SteamGridGameId = game.SteamGridGameId,
                    ShowcaseVerticalLocalImage = old?.ShowcaseVerticalLocalImage ?? "",
                    HistoryHorizontalLocalImage = old?.HistoryHorizontalLocalImage ?? "",
                    ProfileBannerLocalImage = old?.ProfileBannerLocalImage ?? "",
                    GridImage = old?.GridImage ?? "",
                    GridStaticImage = old?.GridStaticImage ?? "",
                    GridHorizontalImage = old?.GridHorizontalImage ?? "",
                    GridHorizontalStaticImage = old?.GridHorizontalStaticImage ?? "",
                    IconBase64 = old?.IconBase64 ?? "",
                    Source = old?.Source ?? ""
                };
            }).ToList();

            string historyPath = Path.Combine(dataFolder, "users", profileId, "game-history.json");
            SafeWriteAllText(historyPath, JsonSerializer.Serialize(appliedHistory, IndentedJsonOptions));
            if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
            {
                SaveUserProfile(profile);
                SaveGameHistory(appliedHistory);
                await Dispatcher.InvokeAsync(LoadCurrentUserIntoUI);
            }

            ResumeProfileSyncArtworkDownloads(profileId, initialDelayMs: 3500);

            CloudProfileV1 appliedSnapshot = ProfileSyncSnapshotFactory.Create(
                profile,
                appliedHistory,
                GetProfileSyncDeviceId(),
                DateTimeOffset.UtcNow);
            await ProfileSyncService.ConfirmRemoteAppliedAsync(profileId, appliedSnapshot, result.RemoteRevision)
                .ConfigureAwait(false);
        }
        finally
        {
            Interlocked.Exchange(ref _profileSyncApplyingRemote, 0);
        }
    }

    private void ResumeProfileSyncArtworkDownloads(string profileId, int initialDelayMs = 6500)
    {
        if (string.IsNullOrWhiteSpace(profileId) || !_profileArtworkWorkers.TryAdd(profileId, 0)) return;
        _ = Task.Run(async () =>
        {
            try
            {
                if (initialDelayMs > 0) await Task.Delay(initialDelayMs).ConfigureAwait(false);
                List<GameHistoryEntry> history = LoadProfileHistoryForSync(profileId);

                // Cache the most-played banner and last-played grid before the remaining
                // history artwork so the profile is offline-ready sooner.
                GameHistoryEntry? mostPlayed = history
                    .OrderByDescending(entry => Math.Max(0, entry.TotalPlaytimeMinutes))
                    .FirstOrDefault();
                if (mostPlayed != null)
                    await DownloadProfileHistoryArtworkAsync(profileId, mostPlayed.Name, "banner",
                        mostPlayed.ProfileBannerImageUrl, mostPlayed.ProfileBannerLocalImage).ConfigureAwait(false);

                GameHistoryEntry? lastPlayed = history
                    .Where(entry => entry.LastPlayed > DateTime.MinValue)
                    .OrderByDescending(entry => entry.LastPlayed)
                    .FirstOrDefault();
                if (lastPlayed != null)
                    await DownloadProfileHistoryArtworkAsync(profileId, lastPlayed.Name, "horizontal",
                        lastPlayed.HistoryHorizontalImageUrl, lastPlayed.HistoryHorizontalLocalImage).ConfigureAwait(false);

                foreach (GameHistoryEntry entry in history)
                {
                    await DownloadProfileHistoryArtworkAsync(profileId, entry.Name, "vertical",
                        entry.ShowcaseVerticalImageUrl, entry.ShowcaseVerticalLocalImage).ConfigureAwait(false);
                    await DownloadProfileHistoryArtworkAsync(profileId, entry.Name, "horizontal",
                        entry.HistoryHorizontalImageUrl, entry.HistoryHorizontalLocalImage).ConfigureAwait(false);
                    await DownloadProfileHistoryArtworkAsync(profileId, entry.Name, "banner",
                        entry.ProfileBannerImageUrl, entry.ProfileBannerLocalImage).ConfigureAwait(false);
                    await Task.Delay(180).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[ProfileSync] Fila de artes interrompida: " + ex.Message);
            }
            finally
            {
                _profileArtworkWorkers.TryRemove(profileId, out _);
            }
        });
    }

    private async Task DownloadProfileHistoryArtworkAsync(
        string profileId,
        string gameName,
        string category,
        string remoteUrl,
        string localUrl)
    {
        if (string.IsNullOrWhiteSpace(gameName) || string.IsNullOrWhiteSpace(remoteUrl) ||
            HasUsableProfileArtwork(localUrl)) return;
        if (!Uri.TryCreate(remoteUrl, UriKind.Absolute, out Uri? uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)) return;

        string urlFolder = category switch
        {
            "vertical" => "history-vertical",
            "banner" => "history-banner",
            _ => "history-horizontal"
        };
        string targetFolder = Path.Combine(dataFolder, "images", urlFolder);
        string fileName = "cloud_" + StableAssetName(profileId + "_" + gameName + "_" + category);
        string? localPath = await DownloadImageAsync(remoteUrl, targetFolder, fileName).ConfigureAwait(false);
        if (localPath == null) return;
        string savedUrl = $"https://data.local/images/{urlFolder}/{Path.GetFileName(localPath)}";

        lock (_gameHistoryFileLock)
        {
            string historyPath = Path.Combine(dataFolder, "users", profileId, "game-history.json");
            List<GameHistoryEntry> latest;
            try
            {
                latest = File.Exists(historyPath)
                    ? JsonSerializer.Deserialize<List<GameHistoryEntry>>(SafeReadAllText(historyPath)) ?? new()
                    : new List<GameHistoryEntry>();
            }
            catch { return; }

            string key = ProfileSyncSnapshotFactory.NormalizeGameKey(gameName);
            GameHistoryEntry? target = latest.FirstOrDefault(item =>
                ProfileSyncSnapshotFactory.NormalizeGameKey(item.Name) == key);
            if (target == null) return;
            if (category == "vertical") target.ShowcaseVerticalLocalImage = savedUrl;
            else if (category == "banner") target.ProfileBannerLocalImage = savedUrl;
            else target.HistoryHorizontalLocalImage = savedUrl;
            string json = JsonSerializer.Serialize(latest, IndentedJsonOptions);
            SafeWriteAllText(historyPath, json);
            if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
            {
                string mirror = Path.Combine(dataFolder, "game-history.json");
                SafeWriteAllText(mirror, json);
            }
        }
    }

    private bool HasUsableProfileArtwork(string localUrl)
    {
        if (string.IsNullOrWhiteSpace(localUrl)) return false;
        const string dataPrefix = "https://data.local/images/";
        if (localUrl.StartsWith(dataPrefix, StringComparison.OrdinalIgnoreCase))
        {
            string relative = Uri.UnescapeDataString(localUrl[dataPrefix.Length..])
                .Replace('/', Path.DirectorySeparatorChar);
            string candidate = Path.GetFullPath(Path.Combine(dataFolder, "images", relative));
            string imageRoot = Path.GetFullPath(Path.Combine(dataFolder, "images")) + Path.DirectorySeparatorChar;
            return candidate.StartsWith(imageRoot, StringComparison.OrdinalIgnoreCase) && File.Exists(candidate);
        }
        return Path.IsPathRooted(localUrl) && File.Exists(localUrl);
    }

    private void PostProfileSyncFailureNotification(string profileId, SyncStatus status)
    {
        PostProfileSyncMessage(new
        {
            type = "doorpiNotification",
            id = $"profile-sync-failure-{profileId}",
            category = "profile-sync",
            profileId,
            title = ProfileSyncLocalized("Sincronização do perfil", "Profile synchronization"),
            message = ProfileSyncFailureMessage(status),
            persistent = false
        });
    }

    private void PostProfileSyncConflictNotification(string profileId)
    {
        PostProfileSyncMessage(new
        {
            type = "doorpiNotification",
            id = $"profile-sync-conflict-{profileId}",
            category = "profile-sync",
            profileId,
            action = "profile-sync-conflict",
            title = ProfileSyncLocalized("Conflito de sincronização", "Synchronization conflict"),
            message = ProfileSyncLocalized(
                "Escolha quais dados do perfil devem ser mantidos.",
                "Choose which profile data should be kept."),
            persistent = true
        });
    }

    private void RemoveProfileSyncNotification(string profileId, string kind)
    {
        PostProfileSyncMessage(new
        {
            type = "doorpiNotification",
            id = $"profile-sync-{kind}-{profileId}",
            profileId,
            remove = true
        });
    }

    private static string ProfileSyncLocalized(string portuguese, string english)
        => CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase)
            ? portuguese
            : english;

    private static string ProfileSyncFailureMessage(SyncStatus status)
        => status switch
        {
            SyncStatus.Offline => ProfileSyncLocalized(
                "Não foi possível acessar o Google Drive. Os dados locais foram mantidos.",
                "Google Drive is unavailable. Local data was preserved."),
            SyncStatus.AuthenticationRequired => ProfileSyncLocalized(
                "A conexão com o Google expirou. Entre novamente para sincronizar.",
                "Your Google authorization expired. Sign in again to sync."),
            _ => ProfileSyncLocalized(
                "Não foi possível sincronizar o perfil. Os dados locais foram mantidos.",
                "The profile could not be synchronized. Local data was preserved.")
        };

    private static void RenameBrowserProfilesForSyncedName(string oldName, string newName)
    {
        string oldSafeName = string.IsNullOrWhiteSpace(oldName)
            ? "default"
            : string.Concat(oldName.Where(character => !Path.GetInvalidFileNameChars().Contains(character)));
        string newSafeName = string.IsNullOrWhiteSpace(newName)
            ? "default"
            : string.Concat(newName.Where(character => !Path.GetInvalidFileNameChars().Contains(character)));
        if (string.Equals(oldSafeName, newSafeName, StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            string profilesDirectory = DoorpiPaths.BrowserProfilesFolder;
            if (!Directory.Exists(profilesDirectory)) return;
            foreach (string directory in Directory.GetDirectories(profilesDirectory))
            {
                string directoryName = Path.GetFileName(directory);
                if (!directoryName.StartsWith(oldSafeName + "-", StringComparison.OrdinalIgnoreCase)) continue;
                string suffix = directoryName[(oldSafeName.Length + 1)..];
                string destination = Path.Combine(profilesDirectory, newSafeName + "-" + suffix);
                if (!Directory.Exists(destination)) Directory.Move(directory, destination);
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine("[ProfileSync] Falha ao renomear perfis do navegador: " + ex.Message);
        }
    }

    private async Task CompletePendingSetupProfileSyncAsync(string profileId, bool importCloud)
    {
        if (importCloud && _profileSyncSetupImports.TryRemove(profileId, out ProfileSyncResult? remote) && remote.RemoteProfile != null)
        {
            await ApplyRemoteProfileAsync(profileId, remote).ConfigureAwait(false);
            return;
        }

        (CloudProfileV1 Snapshot, byte[]? Photo)? local = CreateLocalProfileSyncSnapshot(profileId);
        if (local == null) return;
        ProfileSyncResult uploaded = await ProfileSyncService.UploadProfileAsync(
            profileId,
            local.Value.Snapshot,
            local.Value.Photo).ConfigureAwait(false);
        PostProfileSyncResult(profileId, uploaded);
    }
}
