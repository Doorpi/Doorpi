using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace Doorpi;

public partial class MainWindow
{
    private sealed class ActiveGameplayJournal
    {
        public int Version { get; set; } = 1;
        public long Generation { get; set; }
        public string SessionId { get; set; } = "";
        public string UserId { get; set; } = "";
        public string GameId { get; set; } = "";
        public string GameName { get; set; } = "";
        public DateTime ConfirmedStartedUtc { get; set; }
        public DateTime LastSnapshotUtc { get; set; }
        public long AccumulatedSeconds { get; set; }
        public long BaseTotalPlaytimeMinutes { get; set; }
    }

    private int _gameplayBackgroundMode;
    private int _gameplayBackgroundGeneration;
    private int _homeUiRefreshPendingAfterGameplay;
    private long _activeGameplayJournalGeneration;
    private TaskCompletionSource<bool>? _gameplayBackgroundResumeSignal;

    private bool IsGameplayBackgroundMode
        => Volatile.Read(ref _gameplayBackgroundMode) == 1;

    private string ActiveGameplayJournalPath
    {
        get
        {
            string directory = !string.IsNullOrWhiteSpace(gamesFile)
                ? Path.GetDirectoryName(gamesFile) ?? dataFolder
                : dataFolder;
            return Path.Combine(directory, "active-gameplay-session.json");
        }
    }

    private void ScheduleGameplayBackgroundMode(int delayMilliseconds = 350)
    {
        int generation = Volatile.Read(ref _gameplayBackgroundGeneration);
        _ = Task.Run(async () =>
        {
            try
            {
                if (delayMilliseconds > 0)
                    await Task.Delay(delayMilliseconds).ConfigureAwait(false);

                await Dispatcher.InvokeAsync(
                    () => EnterGameplayBackgroundModeAsync(generation),
                    DispatcherPriority.Background).Task.Unwrap().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[GameplayBackground] Falha ao suspender interface: " + ex.Message);
            }
        });
    }

    private async Task EnterGameplayBackgroundModeAsync(int generation)
    {
        if (generation != Volatile.Read(ref _gameplayBackgroundGeneration) ||
            !_gameSessionActive ||
            _gameIsMinimized ||
            !_gameIsRunningAndDoorpiHidden ||
            !IsForegroundOwnedByCurrentGame())
        {
            return;
        }

        if (Interlocked.Exchange(ref _gameplayBackgroundMode, 1) == 1)
            return;

        Interlocked.Exchange(
            ref _gameplayBackgroundResumeSignal,
            new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously));

        try
        {
            var core = webView?.CoreWebView2;
            if (core == null)
            {
                Interlocked.Exchange(ref _gameplayBackgroundMode, 0);
                CompleteGameplayBackgroundWaiters();
                return;
            }

            try
            {
                await core.ExecuteScriptAsync(@"
                    (() => {
                        window._doorpiGameplaySuspended = true;
                        window._stopSystemAudio?.();
                        window.stopHomeFeatureTrailer?.({ resumeAudio: false });
                        document.documentElement.classList.add('doorpi-native-gameplay-suspended');
                        let style = document.getElementById('doorpi-native-gameplay-suspend-style');
                        if (!style) {
                            style = document.createElement('style');
                            style.id = 'doorpi-native-gameplay-suspend-style';
                            style.textContent = '.doorpi-native-gameplay-suspended *, .doorpi-native-gameplay-suspended *::before, .doorpi-native-gameplay-suspended *::after { animation-play-state: paused !important; }';
                            document.head.appendChild(style);
                        }
                    })();");
            }
            catch { }

            if (generation != Volatile.Read(ref _gameplayBackgroundGeneration) ||
                !IsGameplayBackgroundMode)
            {
                return;
            }

            if (webView != null)
                webView.Visibility = Visibility.Hidden;
            try
            {
                _mousePollTimer?.Change(Timeout.Infinite, Timeout.Infinite);
                _mouseIdleTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            }
            catch (ObjectDisposedException) { }
            await Dispatcher.InvokeAsync(() => { }, DispatcherPriority.ContextIdle);

            bool suspended = false;
            try { suspended = await core.TrySuspendAsync(); }
            catch (Exception ex) { Debug.WriteLine("[GameplayBackground] WebView suspend: " + ex.Message); }

            if (generation != Volatile.Read(ref _gameplayBackgroundGeneration) ||
                !IsGameplayBackgroundMode)
            {
                try { core.Resume(); } catch { }
                if (webView != null)
                    webView.Visibility = Visibility.Visible;
                return;
            }

            DoorpiBootDiagnostics.Log(
                "gameplay-background-entered",
                $"game={_activeSessionGameId}; webViewSuspended={suspended}");
        }
        catch
        {
            Interlocked.Exchange(ref _gameplayBackgroundMode, 0);
            CompleteGameplayBackgroundWaiters();
            try { if (webView != null) webView.Visibility = Visibility.Visible; } catch { }
            try { _mousePollTimer?.Change(0, 100); } catch { }
            throw;
        }
    }

    private void ResumeGameplayBackgroundMode()
    {
        Interlocked.Increment(ref _gameplayBackgroundGeneration);

        if (!Dispatcher.CheckAccess())
        {
            _ = Dispatcher.BeginInvoke(ResumeGameplayBackgroundMode, DispatcherPriority.Send);
            return;
        }

        bool wasSuspended = Interlocked.Exchange(ref _gameplayBackgroundMode, 0) == 1;
        CompleteGameplayBackgroundWaiters();

        try { webView?.CoreWebView2?.Resume(); } catch { }
        try { if (webView != null) webView.Visibility = Visibility.Visible; } catch { }
        try
        {
            GetCursorPos(out _lastKnownCursorPos);
            _mousePollTimer?.Change(0, 100);
        }
        catch (ObjectDisposedException) { }
        try
        {
            _ = webView?.CoreWebView2?.ExecuteScriptAsync(@"
                window._doorpiGameplaySuspended = false;
                document.documentElement.classList.remove('doorpi-native-gameplay-suspended');");
        }
        catch { }

        if (wasSuspended)
            DoorpiBootDiagnostics.Log("gameplay-background-resumed", $"game={_activeSessionGameId}");

        if (Interlocked.Exchange(ref _homeUiRefreshPendingAfterGameplay, 0) == 1)
            SendRuntimeSessionsToUI();
    }

    private void CompleteGameplayBackgroundWaiters()
        => Interlocked.Exchange(ref _gameplayBackgroundResumeSignal, null)?.TrySetResult(true);

    private async Task WaitForGameplayBackgroundEndAsync(CancellationToken cancellationToken)
    {
        while (IsGameplayBackgroundMode)
        {
            TaskCompletionSource<bool>? signal = Volatile.Read(ref _gameplayBackgroundResumeSignal);
            if (signal == null)
            {
                await Task.Yield();
                continue;
            }
            await signal.Task.WaitAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private bool DeferHomeUiRefreshWhileGameplay()
    {
        if (!IsGameplayBackgroundMode) return false;
        Interlocked.Exchange(ref _homeUiRefreshPendingAfterGameplay, 1);
        return true;
    }

    private void ConfirmActiveSessionClock()
    {
        string gameId;
        string gameName;
        lock (_sessionPlaytimeLock)
        {
            GameWindowSession session = EnsureGameSession();
            if (session.StartedUtc != DateTime.MinValue ||
                string.IsNullOrWhiteSpace(session.ActiveGameId))
            {
                return;
            }

            gameId = session.ActiveGameId;
            gameName = session.ActiveGameName;
        }

        long initialPlaytime = ResolveInitialPlaytimeMinutes(gameId, gameName);
        lock (_sessionPlaytimeLock)
        {
            GameWindowSession session = EnsureGameSession();
            if (session.StartedUtc != DateTime.MinValue ||
                !string.Equals(session.ActiveGameId, gameId, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            session.StartedUtc = DateTime.UtcNow;
            session.InitialPlaytimeMinutes = initialPlaytime;
            session.LastCheckpointElapsedMinutes = 0;
            session.LastCheckpointElapsedSeconds = 0;
            session.PlaytimeSessionId = Guid.NewGuid().ToString("N");

            _playtimeCheckpointTimer ??= new System.Threading.Timer(
                _ => QueueActiveSessionCheckpoint(),
                null,
                Timeout.InfiniteTimeSpan,
                Timeout.InfiniteTimeSpan);
            _playtimeCheckpointTimer.Change(PlaytimeCheckpointInterval, PlaytimeCheckpointInterval);
        }

        PersistActiveSessionJournal();
    }

    private long ResolveInitialPlaytimeMinutes(string gameId, string gameName)
    {
        try
        {
            GameModel? game = LoadGames().FirstOrDefault(candidate =>
                string.Equals(candidate.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(candidate.Path, gameId, StringComparison.OrdinalIgnoreCase));
            if (game != null) return Math.Max(0, game.TotalPlaytimeMinutes);

            string key = NormalizeGameName(gameName);
            GameHistoryEntry? history = LoadGameHistory().FirstOrDefault(entry =>
                NormalizeGameName(entry.Name) == key);
            return Math.Max(0, history?.TotalPlaytimeMinutes ?? 0);
        }
        catch { return 0; }
    }

    private void PersistActiveSessionJournal()
    {
        ActiveGameplayJournal? journal;
        lock (_sessionPlaytimeLock)
        {
            GameWindowSession? session = _gameSession;
            if (session == null ||
                session.StartedUtc == DateTime.MinValue ||
                string.IsNullOrWhiteSpace(session.ActiveGameId) ||
                string.IsNullOrWhiteSpace(session.PlaytimeSessionId))
            {
                return;
            }

            long elapsedSeconds = Math.Max(
                session.LastCheckpointElapsedSeconds,
                (long)Math.Floor((DateTime.UtcNow - session.StartedUtc).TotalSeconds));
            session.LastCheckpointElapsedSeconds = elapsedSeconds;
            session.LastCheckpointElapsedMinutes = (int)Math.Min(int.MaxValue, elapsedSeconds / 60);

            journal = new ActiveGameplayJournal
            {
                Generation = Interlocked.Increment(ref _activeGameplayJournalGeneration),
                SessionId = session.PlaytimeSessionId,
                UserId = currentUserId,
                GameId = session.ActiveGameId,
                GameName = session.ActiveGameName,
                ConfirmedStartedUtc = session.StartedUtc,
                LastSnapshotUtc = DateTime.UtcNow,
                AccumulatedSeconds = elapsedSeconds,
                BaseTotalPlaytimeMinutes = Math.Max(0, session.InitialPlaytimeMinutes)
            };
        }

        try
        {
            DurableFileStore.WriteAllText(
                ActiveGameplayJournalPath,
                JsonSerializer.Serialize(journal, IndentedJsonOptions),
                keepBackup: true);
        }
        catch (Exception ex)
        {
            DoorpiBootDiagnostics.Log(
                "playtime-journal-write-failed",
                $"game={journal.GameId}; elapsedSeconds={journal.AccumulatedSeconds}; error={ex.Message}");
        }
    }

    private void FinalizeActiveSessionPlaytime()
    {
        string gameId;
        string gameName;
        long initialPlaytime;
        int elapsedMinutes;

        lock (_sessionPlaytimeLock)
        {
            GameWindowSession? session = _gameSession;
            if (session == null ||
                session.StartedUtc == DateTime.MinValue ||
                string.IsNullOrWhiteSpace(session.ActiveGameId))
            {
                StopPlaytimeCheckpointTimer();
                return;
            }

            long elapsedSeconds = Math.Max(
                session.LastCheckpointElapsedSeconds,
                (long)Math.Floor((DateTime.UtcNow - session.StartedUtc).TotalSeconds));
            gameId = session.ActiveGameId;
            gameName = session.ActiveGameName;
            initialPlaytime = Math.Max(0, session.InitialPlaytimeMinutes);
            elapsedMinutes = (int)Math.Min(int.MaxValue, elapsedSeconds / 60);
        }

        // Preserve the latest durable point before touching the larger library files.
        PersistActiveSessionJournal();

        bool committed = elapsedMinutes < 1;
        try
        {
            if (elapsedMinutes >= 1)
            {
                var games = LoadGames();
                var game = games.FirstOrDefault(candidate =>
                    string.Equals(candidate.LaunchUrl, gameId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(candidate.Path, gameId, StringComparison.OrdinalIgnoreCase));

                if (game != null)
                {
                    long desiredTotal = SaturatingAddPlaytimeMinutes(initialPlaytime, elapsedMinutes);
                    game.TotalPlaytimeMinutes = Math.Max(game.TotalPlaytimeMinutes, desiredTotal);
                    game.LastSessionMinutes = elapsedMinutes;
                    game.LastPlayed = DateTime.Now;
                    SaveGames(games);
                }
                else if (!string.IsNullOrWhiteSpace(gameName))
                {
                    CommitRecoveredOrDeletedSession(
                        gameName,
                        initialPlaytime,
                        elapsedMinutes,
                        DateTime.Now);
                }

                committed = true;
                Debug.WriteLine($"[Session] {gameName}: finalizado {elapsedMinutes}min");
            }
        }
        catch (Exception ex)
        {
            DoorpiBootDiagnostics.Log(
                "playtime-finalize-failed",
                $"game={gameId}; elapsedMinutes={elapsedMinutes}; error={ex.Message}");
        }

        if (!committed) return;

        DeleteActiveGameplayJournal();
        lock (_sessionPlaytimeLock)
        {
            StopPlaytimeCheckpointTimer();
            if (_gameSession != null)
            {
                _gameSession.StartedUtc = DateTime.MinValue;
                _gameSession.ActiveGameId = "";
                _gameSession.ActiveGameName = "";
                _gameSession.InitialPlaytimeMinutes = -1;
                _gameSession.LastCheckpointElapsedMinutes = 0;
                _gameSession.LastCheckpointElapsedSeconds = 0;
                _gameSession.PlaytimeSessionId = "";
            }
        }

        if (!IsGameplayBackgroundMode)
        {
            try { _ = Dispatcher.BeginInvoke(LoadGamesIntoUI); }
            catch { }
        }
        else
        {
            Interlocked.Exchange(ref _homeUiRefreshPendingAfterGameplay, 1);
        }
    }

    private void RecoverInterruptedGameplaySession()
    {
        string path = ActiveGameplayJournalPath;
        ActiveGameplayJournal? journal = null;
        bool recoveredFromBackup = false;

        if (!TryDeserializeJsonFile(path, options: null, out journal))
        {
            recoveredFromBackup = TryDeserializeJsonFile(
                path + ".bak",
                options: null,
                out journal);
        }

        if (journal == null ||
            journal.Version != 1 ||
            string.IsNullOrWhiteSpace(journal.GameId) ||
            (!string.IsNullOrWhiteSpace(journal.UserId) &&
             !string.Equals(journal.UserId, currentUserId, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        int elapsedMinutes = (int)Math.Min(int.MaxValue, Math.Max(0, journal.AccumulatedSeconds) / 60);
        try
        {
            if (elapsedMinutes >= 1)
            {
                var games = LoadGames();
                var game = games.FirstOrDefault(candidate =>
                    string.Equals(candidate.LaunchUrl, journal.GameId, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(candidate.Path, journal.GameId, StringComparison.OrdinalIgnoreCase));
                if (game != null)
                {
                    long desiredTotal = SaturatingAddPlaytimeMinutes(
                        Math.Max(0, journal.BaseTotalPlaytimeMinutes),
                        elapsedMinutes);
                    game.TotalPlaytimeMinutes = Math.Max(game.TotalPlaytimeMinutes, desiredTotal);
                    game.LastSessionMinutes = elapsedMinutes;
                    game.LastPlayed = journal.LastSnapshotUtc.ToLocalTime();
                    SaveGames(games);
                }
                else if (!string.IsNullOrWhiteSpace(journal.GameName))
                {
                    CommitRecoveredOrDeletedSession(
                        journal.GameName,
                        Math.Max(0, journal.BaseTotalPlaytimeMinutes),
                        elapsedMinutes,
                        journal.LastSnapshotUtc.ToLocalTime());
                }
            }

            DeleteActiveGameplayJournal();
            DoorpiBootDiagnostics.Log(
                "playtime-journal-recovered",
                $"game={journal.GameId}; elapsedMinutes={elapsedMinutes}; backup={recoveredFromBackup}");
        }
        catch (Exception ex)
        {
            DoorpiBootDiagnostics.Log(
                "playtime-journal-recovery-failed",
                $"game={journal.GameId}; error={ex.Message}");
        }
    }

    private void CommitRecoveredOrDeletedSession(
        string gameName,
        long initialPlaytime,
        int elapsedMinutes,
        DateTime lastPlayed)
    {
        var history = LoadGameHistory();
        string key = NormalizeGameName(gameName);
        var entry = history.FirstOrDefault(item => NormalizeGameName(item.Name) == key);
        if (entry == null)
        {
            entry = new GameHistoryEntry
            {
                Name = gameName,
                FirstPlayed = lastPlayed
            };
            history.Add(entry);
        }

        long desiredTotal = SaturatingAddPlaytimeMinutes(initialPlaytime, elapsedMinutes);
        entry.TotalPlaytimeMinutes = Math.Max(entry.TotalPlaytimeMinutes, desiredTotal);
        entry.LastSessionMinutes = elapsedMinutes;
        entry.LastPlayed = lastPlayed;
        SaveGameHistory(history);
    }

    private void DeleteActiveGameplayJournal()
    {
        string path = ActiveGameplayJournalPath;
        foreach (string candidate in new[] { path, path + ".bak" })
        {
            try { if (File.Exists(candidate)) File.Delete(candidate); }
            catch { }
        }
    }
}
