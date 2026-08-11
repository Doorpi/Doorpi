using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Doorpi
{
    public sealed class MediaActivityHistoryEntry
    {
        public string AppId { get; set; } = "";
        public string AppName { get; set; } = "";
        public string Category { get; set; } = "";
        public string ContentTitle { get; set; } = "";
        public string CreatorName { get; set; } = "";
        public string AlbumTitle { get; set; } = "";
        public string SeriesTitle { get; set; } = "";
        public string SeasonTitle { get; set; } = "";
        public string EpisodeNumber { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string PageUrl { get; set; } = "";
        public string TitleSource { get; set; } = "";
        public bool MediaSessionAvailable { get; set; }
        public string ArtworkRemoteUrl { get; set; } = "";
        public string ArtworkLocalUrl { get; set; } = "";
        public string ArtworkSource { get; set; } = "";
        public DateTime? MetadataCapturedUtc { get; set; }
        public long TotalPlaybackSeconds { get; set; }
        public long LastSessionSeconds { get; set; }
        public int SessionCount { get; set; }
        public double LastPositionSeconds { get; set; }
        public double DurationSeconds { get; set; }
        public DateTime FirstPlayed { get; set; } = DateTime.UtcNow;
        public DateTime LastPlayed { get; set; } = DateTime.UtcNow;
    }

    internal sealed class MediaArtworkCandidate
    {
        public string Url { get; set; } = "";
        public string Source { get; set; } = "";
        public string Sizes { get; set; } = "";
        public string MimeType { get; set; } = "";
        public double Score { get; set; }
    }

    internal sealed class MediaMetadataSnapshot
    {
        public string AlbumTitle { get; set; } = "";
        public string SeriesTitle { get; set; } = "";
        public string SeasonTitle { get; set; } = "";
        public string EpisodeNumber { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string PageUrl { get; set; } = "";
        public string TitleSource { get; set; } = "";
        public bool MediaSessionAvailable { get; set; }
        public bool IsLive { get; set; }
        public int MediaSessionArtworkCount { get; set; }
        public string MediaSessionArtworkSchemes { get; set; } = "";
        public string NetworkMetadataMatchedBy { get; set; } = "";
        public List<MediaArtworkCandidate> Artwork { get; set; } = new();
    }

    internal sealed class MediaMetadataProbeRecord
    {
        public string AppId { get; set; } = "";
        public string AppName { get; set; } = "";
        public string State { get; set; } = "";
        public string ContentTitle { get; set; } = "";
        public string CreatorName { get; set; } = "";
        public string AlbumTitle { get; set; } = "";
        public string SeriesTitle { get; set; } = "";
        public string SeasonTitle { get; set; } = "";
        public string EpisodeNumber { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string PageUrl { get; set; } = "";
        public string TitleSource { get; set; } = "";
        public bool MediaSessionAvailable { get; set; }
        public bool IsLive { get; set; }
        public int MediaSessionArtworkCount { get; set; }
        public string MediaSessionArtworkSchemes { get; set; } = "";
        public string NetworkMetadataMatchedBy { get; set; } = "";
        public List<MediaArtworkCandidate> ArtworkCandidates { get; set; } = new();
        public string SelectedArtworkUrl { get; set; } = "";
        public string SelectedArtworkSource { get; set; } = "";
        public string LocalArtworkUrl { get; set; } = "";
        public string DownloadStatus { get; set; } = "";
        public string DownloadError { get; set; } = "";
        public DateTime CapturedAtUtc { get; set; } = DateTime.UtcNow;
    }

    internal sealed class MediaNetworkProbeValue
    {
        public string Path { get; set; } = "";
        public string Key { get; set; } = "";
        public string Kind { get; set; } = "";
        public string Value { get; set; } = "";
    }

    internal sealed class MediaNetworkProbeMatch
    {
        public string ObjectPath { get; set; } = "";
        public string MatchedPath { get; set; } = "";
        public string MatchReason { get; set; } = "";
        public List<MediaNetworkProbeValue> MetadataValues { get; set; } = new();
    }

    internal sealed class MediaNetworkProbeRecord
    {
        public string AppId { get; set; } = "";
        public string PlayerUrl { get; set; } = "";
        public string RequestUrl { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string TargetId { get; set; } = "";
        public int ResponseBytes { get; set; }
        public bool RequestContainsTargetId { get; set; }
        public bool BodyContainsTargetId { get; set; }
        public List<string> TopLevelKeys { get; set; } = new();
        public List<MediaNetworkProbeMatch> Matches { get; set; } = new();
        public DateTime CapturedAtUtc { get; set; } = DateTime.UtcNow;
    }

    internal sealed class NativeMediaResolvedMetadata
    {
        public string AppId { get; set; } = "";
        public string TargetId { get; set; } = "";
        public string Title { get; set; } = "";
        public string SeriesTitle { get; set; } = "";
        public string SeasonTitle { get; set; } = "";
        public string EpisodeNumber { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string ArtworkUrl { get; set; } = "";
        public string ArtworkSizes { get; set; } = "";
        public DateTime CapturedAtUtc { get; set; } = DateTime.UtcNow;

        public string Key => AppId + ":" + TargetId;
    }

    internal sealed class MediaArtworkCaptureRequest
    {
        public string ProfileId { get; init; } = "";
        public string AppId { get; init; } = "";
        public string AppName { get; init; } = "";
        public string ContentTitle { get; init; } = "";
        public string CreatorName { get; init; } = "";
        public string PageUrl { get; init; } = "";
        public required MediaArtworkCandidate Candidate { get; init; }
        public required MediaMetadataSnapshot Metadata { get; init; }
        public string Key => $"{AppId}\u001f{ContentTitle}\u001f{CreatorName}".ToUpperInvariant();
    }

    internal sealed class ActiveMediaHistorySession
    {
        public string AppId { get; init; } = "";
        public string AppName { get; init; } = "";
        public string Category { get; init; } = "";
        public string ContentTitle { get; init; } = "";
        public string CreatorName { get; init; } = "";
        public string AlbumTitle { get; set; } = "";
        public string SeriesTitle { get; set; } = "";
        public string SeasonTitle { get; set; } = "";
        public string EpisodeNumber { get; set; } = "";
        public string ContentType { get; set; } = "";
        public string PageUrl { get; set; } = "";
        public string TitleSource { get; set; } = "";
        public bool MediaSessionAvailable { get; set; }
        public string ArtworkRemoteUrl { get; set; } = "";
        public string ArtworkLocalUrl { get; set; } = "";
        public string ArtworkSource { get; set; } = "";
        public DateTime? MetadataCapturedUtc { get; set; }
        public DateTime LastSampleUtc { get; set; }
        public double PositionSeconds { get; set; }
        public double DurationSeconds { get; set; }
        public double AccumulatedSeconds { get; set; }
        public double PersistedSeconds { get; set; }
        public bool SessionCountCommitted { get; set; }

        public string Key => $"{AppId}\u001f{ContentTitle}\u001f{CreatorName}".ToUpperInvariant();
    }

    public partial class MainWindow
    {
        private const double MediaHistoryMinimumSessionSeconds = 30;
        private const double MediaHistoryCheckpointSeconds = 30;
        private const long MediaArtworkMaximumBytes = 8L * 1024L * 1024L;
        private static readonly ConcurrentDictionary<string, byte> _mediaArtworkDownloads = new(StringComparer.Ordinal);
        private static readonly ConcurrentDictionary<string, NativeMediaResolvedMetadata> _nativeMediaResolvedMetadata =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly SemaphoreSlim _mediaNetworkProbeSemaphore = new(1, 1);
        private static readonly HttpClient _mediaArtworkHttpClient = new(new HttpClientHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.All
        })
        {
            Timeout = TimeSpan.FromSeconds(12)
        };
        private ActiveMediaHistorySession? _activeMediaHistorySession;

        private static string NormalizeMediaHistoryCategory(string? value)
            => (value ?? "").Trim().ToLowerInvariant() switch
            {
                "video-live" => "video-live",
                "film-series" => "film-series",
                "disabled" => "disabled",
                _ => "auto"
            };

        private static string MediaCategoryForApp(MediaAppModel app, MediaMetadataSnapshot metadata)
        {
            string preference = NormalizeMediaHistoryCategory(app.MediaHistoryCategory);
            if (preference == "film-series") return "film-series";
            if (preference == "video-live")
                return metadata.IsLive || string.Equals(app.Id, "twitch", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(app.Id, "kick", StringComparison.OrdinalIgnoreCase)
                    ? "live"
                    : "video";

            string appId = (app.Id ?? "").Trim().ToLowerInvariant();
            if (metadata.IsLive || appId is "twitch" or "kick") return "live";
            if (appId == "youtube") return "video";
            if (appId is "netflix" or "disneyplus" or "primevideo" or "appletv" or "max" or "crunchyroll")
                return "film-series";

            string contentType = (metadata.ContentType ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(metadata.SeriesTitle) ||
                contentType.Contains("episode", StringComparison.OrdinalIgnoreCase) ||
                contentType.Contains("series", StringComparison.OrdinalIgnoreCase) ||
                contentType.Contains("movie", StringComparison.OrdinalIgnoreCase) ||
                contentType.Contains("film", StringComparison.OrdinalIgnoreCase) ||
                contentType.Contains("tv", StringComparison.OrdinalIgnoreCase))
            {
                return "film-series";
            }

            return "video";
        }

        private static bool IsTmdbMediaArtwork(MediaArtworkCandidate? artwork)
            => artwork != null && IsTmdbMediaArtwork(artwork.Url, artwork.Source);

        private static bool IsTmdbMediaArtwork(string? artworkUrl, string? artworkSource)
        {
            if (!Uri.TryCreate(artworkUrl, UriKind.Absolute, out Uri? uri)) return false;
            return string.Equals(uri.Host, "image.tmdb.org", StringComparison.OrdinalIgnoreCase) &&
                   artworkSource is "media-session" or "video-poster" or "network-metadata" or
                       "dom-image" or "css-background" or "open-graph" or "json-ld";
        }

        private MediaAppModel? ResolveMediaTrackingApp(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;

            List<MediaAppModel> apps = LoadMediaApps();
            MediaAppModel? exact = apps.FirstOrDefault(app =>
                string.Equals(app.Id, url, StringComparison.OrdinalIgnoreCase) ||
                string.Equals((app.Url ?? "").TrimEnd('/'), url.TrimEnd('/'), StringComparison.OrdinalIgnoreCase));
            if (exact != null)
            {
                return IsTrackableMediaWebApp(exact) ? exact : null;
            }

            Uri.TryCreate(url, UriKind.Absolute, out var activeUri);
            foreach (var app in apps)
            {
                if (!IsTrackableMediaWebApp(app)) continue;

                if (activeUri != null && Uri.TryCreate(app.Url, UriKind.Absolute, out var appUri) &&
                    (string.Equals(activeUri.Host, appUri.Host, StringComparison.OrdinalIgnoreCase) ||
                     activeUri.Host.EndsWith("." + appUri.Host, StringComparison.OrdinalIgnoreCase)))
                {
                    return app;
                }
            }
            return null;
        }

        private static bool IsTrackableMediaWebApp(MediaAppModel app)
            => !string.Equals(app.Id, DoorpiBrowserAppId, StringComparison.OrdinalIgnoreCase) &&
               NormalizeMediaHistoryCategory(app.MediaHistoryCategory) != "disabled" &&
               (string.Equals(app.Type, "browser", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(app.Type, "webview", StringComparison.OrdinalIgnoreCase));

        private bool CanTrackRegisteredMediaWebApp(string url)
            => ResolveMediaTrackingApp(url) != null;

        private static string NormalizeTrackedMediaTitle(string value, string appName)
        {
            string title = (value ?? "").Trim();
            if (title.Length > 180) title = title[..180].Trim();
            foreach (string suffix in new[] { " - YouTube", " | Netflix", " - Twitch", " - Kick", " | Disney+", " - Prime Video", " | Max" })
            {
                if (title.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                    title = title[..^suffix.Length].Trim();
            }
            if (title.StartsWith("Watch ", StringComparison.OrdinalIgnoreCase)) title = title[6..].Trim();
            if (title.StartsWith("Assistir ", StringComparison.OrdinalIgnoreCase)) title = title[9..].Trim();
            if (title.StartsWith("Prime Video: ", StringComparison.OrdinalIgnoreCase)) title = title[13..].Trim();
            if (IsInvalidTrackedMediaTitle(title)) return "";
            return string.Equals(title, appName, StringComparison.OrdinalIgnoreCase) ? "" : title;
        }

        private static void ApplyResolvedNativeMediaMetadata(
            string pageUrl,
            ref string title,
            ref string seriesTitle,
            ref string seasonTitle,
            ref string episodeNumber,
            ref string contentType,
            ref string titleSource,
            ref string networkMetadataMatchedBy,
            List<MediaArtworkCandidate> artwork)
        {
            string appId = ResolveNativeMediaProbeAppId(pageUrl);
            string targetId = ExtractMediaPlayerTargetId(pageUrl);
            if (string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(targetId) ||
                !_nativeMediaResolvedMetadata.TryGetValue(appId + ":" + targetId, out NativeMediaResolvedMetadata? resolved) ||
                DateTime.UtcNow - resolved.CapturedAtUtc > TimeSpan.FromHours(6)) return;

            if (!string.IsNullOrWhiteSpace(resolved.Title)) title = resolved.Title;
            if (!string.IsNullOrWhiteSpace(resolved.SeriesTitle)) seriesTitle = resolved.SeriesTitle;
            if (!string.IsNullOrWhiteSpace(resolved.SeasonTitle)) seasonTitle = resolved.SeasonTitle;
            if (!string.IsNullOrWhiteSpace(resolved.EpisodeNumber)) episodeNumber = resolved.EpisodeNumber;
            if (!string.IsNullOrWhiteSpace(resolved.ContentType)) contentType = resolved.ContentType;
            titleSource = "network-metadata";
            networkMetadataMatchedBy = "content-id";

            if (!string.IsNullOrWhiteSpace(resolved.ArtworkUrl) &&
                !artwork.Any(candidate => string.Equals(candidate.Url, resolved.ArtworkUrl, StringComparison.Ordinal)))
            {
                artwork.Insert(0, new MediaArtworkCandidate
                {
                    Url = resolved.ArtworkUrl,
                    Source = "network-metadata",
                    Sizes = resolved.ArtworkSizes,
                    MimeType = "",
                    Score = 120
                });
            }
        }

        private static bool IsInvalidTrackedMediaTitle(string? value)
        {
            string title = (value ?? "").Trim();
            if (string.IsNullOrWhiteSpace(title)) return true;
            return System.Text.RegularExpressions.Regex.IsMatch(
                title,
                "^(?:details?|standard|default|hero|tile|poster)(?:[_-](?:details?|standard|default|hero|tile|poster))*$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase) ||
                System.Text.RegularExpressions.Regex.IsMatch(title, "^[a-z0-9]+(?:_[a-z0-9]+)+$");
        }

        private void TrackWebMediaActivity(
            string sourceUrl,
            string state,
            string title,
            string creator,
            double position,
            double duration,
            MediaMetadataSnapshot metadata)
        {
            MediaArtworkCaptureRequest? captureRequest = null;
            lock (_mediaHistoryFileLock)
            {
                var profile = LoadUserProfile();
                if (!profile.ApplicationHistoryEnabled)
                {
                    FinalizeMediaHistorySessionLocked(saveEligibleActivity: true);
                    return;
                }

                var app = ResolveMediaTrackingApp(sourceUrl);
                if (app == null) return;

                string normalizedTitle = NormalizeTrackedMediaTitle(title, app.Name);
                string normalizedCreator = NormalizeTrackedMediaCreator(creator);
                MediaArtworkCandidate? selectedArtwork = SelectMediaArtworkCandidate(
                    metadata.Artwork,
                    app.Id,
                    normalizedTitle);
                if (string.IsNullOrWhiteSpace(metadata.ContentType) && IsTmdbMediaArtwork(selectedArtwork))
                    metadata.ContentType = "movie-or-series";
                bool playing = string.Equals(state, "playing", StringComparison.OrdinalIgnoreCase);
                if (playing)
                {
                    WriteMediaMetadataProbeLocked(
                        profile.Id,
                        app,
                        state,
                        normalizedTitle,
                        normalizedCreator,
                        metadata,
                        selectedArtwork,
                        selectedArtwork == null ? "no-artwork" : "received");
                }
                if (!playing || string.IsNullOrWhiteSpace(normalizedTitle))
                {
                    FinalizeMediaHistorySessionLocked(saveEligibleActivity: true);
                    return;
                }

                var now = DateTime.UtcNow;
                var next = new ActiveMediaHistorySession
                {
                    AppId = app.Id,
                    AppName = app.Name,
                    Category = MediaCategoryForApp(app, metadata),
                    ContentTitle = normalizedTitle,
                    CreatorName = normalizedCreator,
                    AlbumTitle = TrimMetadataValue(metadata.AlbumTitle, 180),
                    SeriesTitle = TrimMetadataValue(metadata.SeriesTitle, 180),
                    SeasonTitle = TrimMetadataValue(metadata.SeasonTitle, 120),
                    EpisodeNumber = TrimMetadataValue(metadata.EpisodeNumber, 40),
                    ContentType = TrimMetadataValue(metadata.ContentType, 80),
                    PageUrl = NormalizeMetadataPageUrl(metadata.PageUrl),
                    TitleSource = TrimMetadataValue(metadata.TitleSource, 40),
                    MediaSessionAvailable = metadata.MediaSessionAvailable,
                    ArtworkRemoteUrl = selectedArtwork?.Url ?? "",
                    ArtworkSource = selectedArtwork?.Source ?? "",
                    MetadataCapturedUtc = now,
                    LastSampleUtc = now,
                    PositionSeconds = Math.Max(0, position),
                    DurationSeconds = Math.Max(0, duration)
                };

                if (_activeMediaHistorySession == null || _activeMediaHistorySession.Key != next.Key)
                {
                    FinalizeMediaHistorySessionLocked(saveEligibleActivity: true);
                    RestoreExistingMediaArtworkLocked(next);
                    _activeMediaHistorySession = next;
                }
                else
                {
                    var active = _activeMediaHistorySession;
                    double elapsed = Math.Clamp((now - active.LastSampleUtc).TotalSeconds, 0, 10);
                    active.AccumulatedSeconds += elapsed;
                    active.LastSampleUtc = now;
                    active.PositionSeconds = Math.Max(0, position);
                    active.DurationSeconds = Math.Max(0, duration);
                    ApplyMetadataToActiveSession(active, next);

                    if (active.AccumulatedSeconds >= MediaHistoryMinimumSessionSeconds &&
                        active.AccumulatedSeconds - active.PersistedSeconds >= MediaHistoryCheckpointSeconds)
                    {
                        PersistMediaHistorySessionLocked(active, isFinal: false);
                    }
                }

                var current = _activeMediaHistorySession;
                if (selectedArtwork != null && current != null &&
                    (string.IsNullOrWhiteSpace(current.ArtworkLocalUrl) ||
                     !string.Equals(current.ArtworkRemoteUrl, selectedArtwork.Url, StringComparison.Ordinal)))
                {
                    captureRequest = new MediaArtworkCaptureRequest
                    {
                        ProfileId = profile.Id,
                        AppId = app.Id,
                        AppName = app.Name,
                        ContentTitle = normalizedTitle,
                        CreatorName = normalizedCreator,
                        PageUrl = next.PageUrl,
                        Candidate = selectedArtwork,
                        Metadata = metadata
                    };
                }
            }

            if (captureRequest != null) QueueMediaArtworkCapture(captureRequest);
        }

        private static string TrimMetadataValue(string? value, int maxLength)
        {
            string result = (value ?? "").Trim();
            return result.Length <= maxLength ? result : result[..maxLength].Trim();
        }

        private static string NormalizeTrackedMediaCreator(string? value)
        {
            string result = TrimMetadataValue(value, 140);
            bool invalid = System.Text.RegularExpressions.Regex.IsMatch(
                result,
                "^[a-z]{2}(?:[-\\s_][a-z]{2})?$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase) ||
                System.Text.RegularExpressions.Regex.IsMatch(
                    result,
                    "^(?:index|player|watch)(?:\\.(?:php|html?|aspx?|jsp))?$|\\.(?:php|html?|aspx?|jsp)$",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return invalid ? "" : result;
        }

        private static string NormalizeMetadataPageUrl(string? value)
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? uri) ||
                (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)) return "";
            string result = uri.GetLeftPart(UriPartial.Path);
            return result.Length <= 2048 ? result : result[..2048];
        }

        private static MediaArtworkCandidate? SelectMediaArtworkCandidate(
            IEnumerable<MediaArtworkCandidate>? candidates,
            string appId,
            string contentTitle)
        {
            static int SourcePriority(string source) => source switch
            {
                "media-session" => 7,
                "network-metadata" => 6,
                "video-poster" => 6,
                "dom-image" or "css-background" => 5,
                "public-page" or "open-graph" => 4,
                "twitter" or "json-ld" => 3,
                "resource-image" => 1,
                _ => 0
            };

            static long ArtworkArea(string sizes)
            {
                long best = 0;
                foreach (string token in (sizes ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries))
                {
                    string[] dimensions = token.Split('x', StringSplitOptions.RemoveEmptyEntries);
                    if (dimensions.Length == 2 && long.TryParse(dimensions[0], out long width) &&
                        long.TryParse(dimensions[1], out long height) && width > 0 && height > 0)
                    {
                        best = Math.Max(best, Math.Min(100_000_000, width * height));
                    }
                }
                return best;
            }

            bool IsTrustedForProvider(MediaArtworkCandidate candidate)
            {
                if (appId.Equals("disneyplus", StringComparison.OrdinalIgnoreCase))
                    return candidate.Source is "media-session" or "network-metadata";
                if (appId.Equals("netflix", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(contentTitle)) return false;
                    return candidate.Source is "media-session" or "network-metadata" or "public-page";
                }
                return true;
            }

            return (candidates ?? Array.Empty<MediaArtworkCandidate>())
                .Where(IsTrustedForProvider)
                .Where(candidate => IsSafeMediaArtworkUri(candidate.Url, out _) && IsPlausibleMediaArtworkCandidate(candidate))
                .GroupBy(candidate => candidate.Url, StringComparer.Ordinal)
                .Select(group => group.First())
                .OrderByDescending(candidate => SourcePriority(candidate.Source))
                .ThenByDescending(candidate => ArtworkArea(candidate.Sizes))
                .ThenByDescending(candidate => candidate.Score)
                .FirstOrDefault();
        }

        private static bool IsPlausibleMediaArtworkCandidate(MediaArtworkCandidate candidate)
        {
            string value = candidate.Url ?? "";
            if (System.Text.RegularExpressions.Regex.IsMatch(
                value,
                "(?:onetrust|helpcenter|consent|/logos?/|log\\.go\\.com)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return false;
            return !System.Text.RegularExpressions.Regex.IsMatch(
                value,
                "\\.(?:mp4|mp4a|m4s|m3u8|mpd)(?:[?#]|$)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }

        private static bool IsSafeMediaArtworkUri(string? value, out Uri? uri)
        {
            uri = null;
            if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? candidate) ||
                candidate.Scheme != Uri.UriSchemeHttps ||
                !string.IsNullOrEmpty(candidate.UserInfo) ||
                string.IsNullOrWhiteSpace(candidate.Host)) return false;

            string host = candidate.IdnHost.TrimEnd('.');
            if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase) ||
                host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) ||
                IPAddress.TryParse(host, out _)) return false;

            uri = candidate;
            return true;
        }

        private void RestoreExistingMediaArtworkLocked(ActiveMediaHistorySession session)
        {
            var existing = LoadMediaHistoryLocked().FirstOrDefault(item =>
                string.Equals(item.AppId, session.AppId, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(item.ContentTitle, session.ContentTitle, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(NormalizeTrackedMediaCreator(item.CreatorName), session.CreatorName, StringComparison.OrdinalIgnoreCase));
            if (existing == null) return;

            if (string.IsNullOrWhiteSpace(session.ArtworkRemoteUrl))
            {
                session.ArtworkRemoteUrl = existing.ArtworkRemoteUrl;
                session.ArtworkSource = existing.ArtworkSource;
            }
            if (string.Equals(session.ArtworkRemoteUrl, existing.ArtworkRemoteUrl, StringComparison.Ordinal) &&
                MediaArtworkLocalFileExists(existing.ArtworkLocalUrl))
            {
                session.ArtworkLocalUrl = existing.ArtworkLocalUrl;
            }
        }

        private void ApplyMetadataToActiveSession(ActiveMediaHistorySession active, ActiveMediaHistorySession incoming)
        {
            active.AlbumTitle = FirstNotBlank(incoming.AlbumTitle, active.AlbumTitle);
            active.SeriesTitle = FirstNotBlank(incoming.SeriesTitle, active.SeriesTitle);
            active.SeasonTitle = FirstNotBlank(incoming.SeasonTitle, active.SeasonTitle);
            active.EpisodeNumber = FirstNotBlank(incoming.EpisodeNumber, active.EpisodeNumber);
            active.ContentType = FirstNotBlank(incoming.ContentType, active.ContentType);
            active.PageUrl = FirstNotBlank(incoming.PageUrl, active.PageUrl);
            active.TitleSource = FirstNotBlank(incoming.TitleSource, active.TitleSource);
            active.MediaSessionAvailable |= incoming.MediaSessionAvailable;
            active.MetadataCapturedUtc = incoming.MetadataCapturedUtc ?? active.MetadataCapturedUtc;

            if (!string.IsNullOrWhiteSpace(incoming.ArtworkRemoteUrl))
            {
                if (!string.Equals(active.ArtworkRemoteUrl, incoming.ArtworkRemoteUrl, StringComparison.Ordinal))
                    active.ArtworkLocalUrl = "";
                active.ArtworkRemoteUrl = incoming.ArtworkRemoteUrl;
                active.ArtworkSource = incoming.ArtworkSource;
            }
        }

        private static string FirstNotBlank(string? preferred, string? fallback)
            => !string.IsNullOrWhiteSpace(preferred) ? preferred : fallback ?? "";

        private bool MediaArtworkLocalFileExists(string? localUrl)
        {
            if (string.IsNullOrWhiteSpace(localUrl) ||
                !localUrl.StartsWith("https://data.local/", StringComparison.OrdinalIgnoreCase)) return false;
            string relative = Uri.UnescapeDataString(localUrl["https://data.local/".Length..])
                .Replace('/', Path.DirectorySeparatorChar);
            string root = Path.GetFullPath(dataFolder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string path = Path.GetFullPath(Path.Combine(root, relative));
            return path.StartsWith(root, StringComparison.OrdinalIgnoreCase) && File.Exists(path);
        }

        private void QueueMediaArtworkCapture(MediaArtworkCaptureRequest request)
        {
            string downloadKey = string.Join('\u001f', request.ProfileId, request.Key, request.Candidate.Url);
            if (!_mediaArtworkDownloads.TryAdd(downloadKey, 0)) return;

            _ = CaptureMediaArtworkAsync(request).ContinueWith(task =>
            {
                _mediaArtworkDownloads.TryRemove(downloadKey, out _);
                if (task.Exception != null)
                    Debug.WriteLine("[MediaArtworkProbe] Falha inesperada: " + task.Exception.GetBaseException().Message);
            }, TaskScheduler.Default);
        }

        private async Task CaptureMediaArtworkAsync(MediaArtworkCaptureRequest request)
        {
            string localUrl = "";
            string error = "";
            try
            {
                WriteMediaMetadataProbe(request, "downloading", "", "");
                string profileFolder = ResolveMediaProfileFolder(request.ProfileId);
                string artworkFolder = Path.Combine(profileFolder, "media-artwork");
                Directory.CreateDirectory(artworkFolder);
                string stableName = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Key)))
                    .ToLowerInvariant()[..24];
                string? localPath = await DownloadMediaArtworkAsync(
                    request.Candidate.Url,
                    request.PageUrl,
                    artworkFolder,
                    stableName).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(localPath))
                {
                    error = "A URL chegou ao Doorpi, mas o download ou a validação da imagem falhou.";
                }
                else
                {
                    string relative = Path.GetRelativePath(dataFolder, localPath).Replace(Path.DirectorySeparatorChar, '/');
                    localUrl = "https://data.local/" + Uri.EscapeDataString(relative).Replace("%2F", "/", StringComparison.OrdinalIgnoreCase);
                }
            }
            catch (Exception ex)
            {
                error = TrimMetadataValue(ex.Message, 240);
            }

            lock (_mediaHistoryFileLock)
            {
                if (!string.IsNullOrWhiteSpace(localUrl))
                    ApplyCapturedArtworkLocked(request, localUrl);
                WriteMediaMetadataProbeLocked(
                    request.ProfileId,
                    new MediaAppModel { Id = request.AppId, Name = request.AppName },
                    "playing",
                    request.ContentTitle,
                    request.CreatorName,
                    request.Metadata,
                    request.Candidate,
                    string.IsNullOrWhiteSpace(localUrl) ? "download-failed" : "cached",
                    localUrl,
                    error);
            }

            Debug.WriteLine(
                $"[MediaArtworkProbe] app={request.AppId} source={request.Candidate.Source} " +
                $"session={request.Metadata.MediaSessionAvailable} candidates={request.Metadata.Artwork.Count} " +
                $"status={(string.IsNullOrWhiteSpace(localUrl) ? "download-failed" : "cached")} " +
                $"title={request.ContentTitle}");
        }

        private void WriteMediaMetadataProbe(MediaArtworkCaptureRequest request, string status, string localUrl, string error)
        {
            lock (_mediaHistoryFileLock)
            {
                WriteMediaMetadataProbeLocked(
                    request.ProfileId,
                    new MediaAppModel { Id = request.AppId, Name = request.AppName },
                    "playing",
                    request.ContentTitle,
                    request.CreatorName,
                    request.Metadata,
                    request.Candidate,
                    status,
                    localUrl,
                    error);
            }
        }

        private string ResolveMediaProfileFolder(string profileId)
        {
            if (!string.IsNullOrWhiteSpace(profileId))
                return Path.Combine(dataFolder, "users", profileId);
            return !string.IsNullOrWhiteSpace(currentUserDataFolder)
                ? currentUserDataFolder
                : dataFolder;
        }

        private void WriteMediaMetadataProbeLocked(
            string profileId,
            MediaAppModel app,
            string state,
            string contentTitle,
            string creatorName,
            MediaMetadataSnapshot metadata,
            MediaArtworkCandidate? selected,
            string status,
            string localUrl = "",
            string error = "")
        {
            try
            {
                string profileFolder = ResolveMediaProfileFolder(profileId);
                Directory.CreateDirectory(profileFolder);
                string path = Path.Combine(profileFolder, "media-metadata-probe.json");
                List<MediaMetadataProbeRecord> records;
                try
                {
                    records = File.Exists(path)
                        ? JsonSerializer.Deserialize<List<MediaMetadataProbeRecord>>(SafeReadAllText(path)) ?? new()
                        : new();
                }
                catch
                {
                    records = new();
                }

                MediaMetadataProbeRecord? previous = records.FirstOrDefault(item =>
                    string.Equals(item.AppId, app.Id, StringComparison.OrdinalIgnoreCase));
                if (status == "received" && previous != null &&
                    string.Equals(previous.SelectedArtworkUrl, selected?.Url, StringComparison.Ordinal) &&
                    previous.DownloadStatus == "cached" && MediaArtworkLocalFileExists(previous.LocalArtworkUrl))
                {
                    status = "cached";
                    localUrl = previous.LocalArtworkUrl;
                }

                records.RemoveAll(item => string.Equals(item.AppId, app.Id, StringComparison.OrdinalIgnoreCase));
                records.Add(new MediaMetadataProbeRecord
                {
                    AppId = app.Id,
                    AppName = app.Name,
                    State = state,
                    ContentTitle = contentTitle,
                    CreatorName = creatorName,
                    AlbumTitle = TrimMetadataValue(metadata.AlbumTitle, 180),
                    SeriesTitle = TrimMetadataValue(metadata.SeriesTitle, 180),
                    SeasonTitle = TrimMetadataValue(metadata.SeasonTitle, 120),
                    EpisodeNumber = TrimMetadataValue(metadata.EpisodeNumber, 40),
                    ContentType = TrimMetadataValue(metadata.ContentType, 80),
                    PageUrl = NormalizeMetadataPageUrl(metadata.PageUrl),
                    TitleSource = TrimMetadataValue(metadata.TitleSource, 40),
                    MediaSessionAvailable = metadata.MediaSessionAvailable,
                    IsLive = metadata.IsLive,
                    MediaSessionArtworkCount = Math.Max(0, metadata.MediaSessionArtworkCount),
                    MediaSessionArtworkSchemes = TrimMetadataValue(metadata.MediaSessionArtworkSchemes, 80),
                    NetworkMetadataMatchedBy = TrimMetadataValue(metadata.NetworkMetadataMatchedBy, 40),
                    ArtworkCandidates = metadata.Artwork
                        .Where(candidate => IsSafeMediaArtworkUri(candidate.Url, out _))
                        .Take(16)
                        .ToList(),
                    SelectedArtworkUrl = selected?.Url ?? "",
                    SelectedArtworkSource = selected?.Source ?? "",
                    LocalArtworkUrl = localUrl,
                    DownloadStatus = status,
                    DownloadError = TrimMetadataValue(error, 240),
                    CapturedAtUtc = DateTime.UtcNow
                });

                string json = JsonSerializer.Serialize(
                    records.OrderBy(item => item.AppId, StringComparer.OrdinalIgnoreCase).ToList(),
                    IndentedJsonOptions);
                SafeWriteAllText(path, json);
                if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
                    SafeWriteAllText(Path.Combine(dataFolder, "media-metadata-probe.json"), json);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[MediaArtworkProbe] Falha ao salvar diagnóstico: " + ex.Message);
            }
        }

        private async Task RecordNativeMediaNetworkProbeAsync(
            string appId,
            string playerUrl,
            string requestUrl,
            string contentType,
            string responseBody)
        {
            if (string.IsNullOrWhiteSpace(responseBody) || responseBody.Length > 6_000_000) return;

            MediaNetworkProbeRecord record;
            try
            {
                using JsonDocument document = JsonDocument.Parse(responseBody, new JsonDocumentOptions
                {
                    AllowTrailingCommas = true,
                    CommentHandling = JsonCommentHandling.Skip,
                    MaxDepth = 128
                });

                string targetId = ExtractMediaPlayerTargetId(playerUrl);
                CaptureResolvedNativeMediaMetadata(appId, targetId, requestUrl, document.RootElement);
                record = new MediaNetworkProbeRecord
                {
                    AppId = appId,
                    PlayerUrl = SanitizeMediaProbeUrl(playerUrl, includeQueryKeys: false),
                    RequestUrl = SanitizeMediaProbeUrl(requestUrl, includeQueryKeys: true),
                    ContentType = TrimMetadataValue(contentType, 160),
                    TargetId = targetId,
                    ResponseBytes = Encoding.UTF8.GetByteCount(responseBody),
                    RequestContainsTargetId = !string.IsNullOrWhiteSpace(targetId) &&
                        requestUrl.Contains(targetId, StringComparison.OrdinalIgnoreCase),
                    BodyContainsTargetId = !string.IsNullOrWhiteSpace(targetId) &&
                        responseBody.Contains(targetId, StringComparison.OrdinalIgnoreCase),
                    TopLevelKeys = ReadMediaProbeTopLevelKeys(document.RootElement)
                };

                int visited = 0;
                FindMediaNetworkProbeMatches(
                    document.RootElement,
                    "$",
                    targetId,
                    record.Matches,
                    0,
                    ref visited);

                if (record.Matches.Count == 0 && record.RequestContainsTargetId)
                {
                    var requestMatch = new MediaNetworkProbeMatch
                    {
                        ObjectPath = "$",
                        MatchedPath = record.RequestUrl,
                        MatchReason = "request-url"
                    };
                    int extracted = 0;
                    ExtractMediaProbeMetadataValues(
                        document.RootElement,
                        "$",
                        requestMatch.MetadataValues,
                        0,
                        ref extracted);
                    if (requestMatch.MetadataValues.Count > 0) record.Matches.Add(requestMatch);
                }
            }
            catch (JsonException)
            {
                return;
            }

            string profileId = currentUserId;
            string profileFolder = ResolveMediaProfileFolder(profileId);
            await _mediaNetworkProbeSemaphore.WaitAsync().ConfigureAwait(false);
            try
            {
                Directory.CreateDirectory(profileFolder);
                string path = Path.Combine(profileFolder, "media-network-probe.json");
                List<MediaNetworkProbeRecord> records;
                try
                {
                    records = File.Exists(path)
                        ? JsonSerializer.Deserialize<List<MediaNetworkProbeRecord>>(SafeReadAllText(path)) ?? new()
                        : new();
                }
                catch
                {
                    records = new();
                }

                records.RemoveAll(existing =>
                    string.Equals(existing.AppId, record.AppId, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(existing.TargetId, record.TargetId, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(existing.RequestUrl, record.RequestUrl, StringComparison.OrdinalIgnoreCase));
                records.Add(record);
                records = records
                    .OrderByDescending(item => item.Matches.Count > 0)
                    .ThenByDescending(item => item.BodyContainsTargetId)
                    .ThenByDescending(item => item.CapturedAtUtc)
                    .Take(160)
                    .OrderBy(item => item.CapturedAtUtc)
                    .ToList();

                string json = JsonSerializer.Serialize(records, IndentedJsonOptions);
                SafeWriteAllText(path, json);
                if (string.Equals(profileId, currentUserId, StringComparison.OrdinalIgnoreCase))
                    SafeWriteAllText(Path.Combine(dataFolder, "media-network-probe.json"), json);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[MediaNetworkProbe] Falha ao salvar diagnóstico: " + ex.Message);
            }
            finally
            {
                _mediaNetworkProbeSemaphore.Release();
            }
        }

        private static void CaptureResolvedNativeMediaMetadata(
            string appId,
            string targetId,
            string requestUrl,
            JsonElement root)
        {
            try
            {
                if (appId == "netflix")
                    CaptureNetflixResolvedMetadata(targetId, requestUrl, root);
                else if (appId == "disneyplus")
                    CaptureDisneyResolvedMetadata(targetId, requestUrl, root);
            }
            catch (Exception ex)
            {
                Debug.WriteLine("[MediaNetworkMetadata] Payload ignorado: " + ex.Message);
            }
        }

        private static void CaptureNetflixResolvedMetadata(string targetId, string requestUrl, JsonElement root)
        {
            if (!requestUrl.Contains("/metadata", StringComparison.OrdinalIgnoreCase) ||
                !TryGetJsonProperty(root, "video", out JsonElement video) ||
                video.ValueKind != JsonValueKind.Object) return;

            string currentEpisodeId = GetJsonScalar(video, "currentEpisode");
            string resolvedTargetId = !string.IsNullOrWhiteSpace(currentEpisodeId) ? currentEpisodeId : targetId;
            if (string.IsNullOrWhiteSpace(resolvedTargetId)) return;

            string rootTitle = GetJsonScalar(video, "title");
            string rootType = GetJsonScalar(video, "type");
            var resolved = new NativeMediaResolvedMetadata
            {
                AppId = "netflix",
                TargetId = resolvedTargetId,
                Title = rootTitle,
                SeriesTitle = rootType.Equals("show", StringComparison.OrdinalIgnoreCase) ? rootTitle : "",
                ContentType = rootType.Equals("show", StringComparison.OrdinalIgnoreCase) ? "episode" : rootType,
                CapturedAtUtc = DateTime.UtcNow
            };

            if (!TryReadNetflixArtwork(video, "storyart", out string artworkUrl, out string artworkSizes) &&
                !TryReadNetflixArtwork(video, "artwork", out artworkUrl, out artworkSizes) &&
                !TryReadNetflixArtwork(video, "boxart", out artworkUrl, out artworkSizes))
            {
                artworkUrl = "";
                artworkSizes = "";
            }
            resolved.ArtworkUrl = artworkUrl;
            resolved.ArtworkSizes = artworkSizes;

            if (TryGetJsonProperty(video, "seasons", out JsonElement seasons) && seasons.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement season in seasons.EnumerateArray())
                {
                    if (!TryGetJsonProperty(season, "episodes", out JsonElement episodes) ||
                        episodes.ValueKind != JsonValueKind.Array) continue;
                    int episodeIndex = 0;
                    foreach (JsonElement episode in episodes.EnumerateArray())
                    {
                        episodeIndex++;
                        string episodeId = FirstNotBlank(GetJsonScalar(episode, "episodeId"), GetJsonScalar(episode, "id"));
                        if (!string.Equals(episodeId, resolvedTargetId, StringComparison.OrdinalIgnoreCase)) continue;

                        resolved.Title = FirstNotBlank(GetJsonScalar(episode, "title"), resolved.Title);
                        resolved.SeasonTitle = FirstNotBlank(
                            GetJsonScalar(season, "title"),
                            FirstNotBlank(GetJsonScalar(season, "longName"), GetJsonScalar(season, "shortName")));
                        resolved.EpisodeNumber = FirstNotBlank(
                            GetJsonScalar(episode, "episode"),
                            GetJsonScalar(episode, "episodeNumber"));
                        if (string.IsNullOrWhiteSpace(resolved.EpisodeNumber))
                            resolved.EpisodeNumber = episodeIndex.ToString(System.Globalization.CultureInfo.InvariantCulture);
                        break;
                    }
                    if (!string.IsNullOrWhiteSpace(resolved.SeasonTitle)) break;
                }
            }

            StoreResolvedNativeMediaMetadata(resolved);
        }

        private static bool TryReadNetflixArtwork(
            JsonElement video,
            string propertyName,
            out string artworkUrl,
            out string artworkSizes)
        {
            artworkUrl = "";
            artworkSizes = "";
            if (!TryGetJsonProperty(video, propertyName, out JsonElement artwork) ||
                artwork.ValueKind != JsonValueKind.Array) return false;
            foreach (JsonElement candidate in artwork.EnumerateArray())
            {
                string url = GetJsonScalar(candidate, "url");
                if (!IsSafeMediaArtworkUri(url, out _)) continue;
                artworkUrl = url;
                string width = FirstNotBlank(GetJsonScalar(candidate, "width"), GetJsonScalar(candidate, "w"));
                string height = FirstNotBlank(GetJsonScalar(candidate, "height"), GetJsonScalar(candidate, "h"));
                if (!string.IsNullOrWhiteSpace(width) && !string.IsNullOrWhiteSpace(height))
                    artworkSizes = width + "x" + height;
                return true;
            }
            return false;
        }

        private static void CaptureDisneyResolvedMetadata(string targetId, string requestUrl, JsonElement root)
        {
            if (requestUrl.Contains("/page/entity-", StringComparison.OrdinalIgnoreCase))
            {
                CaptureDisneyEntityPageMetadata(targetId, root);
                return;
            }

            if (!requestUrl.Contains("/deeplink", StringComparison.OrdinalIgnoreCase) ||
                !TryGetJsonPath(root, out JsonElement actions, "data", "deeplink", "actions") ||
                actions.ValueKind != JsonValueKind.Array) return;

            foreach (JsonElement action in actions.EnumerateArray())
            {
                string deeplinkId = GetJsonScalar(action, "deeplinkId");
                if (string.IsNullOrWhiteSpace(deeplinkId)) continue;
                string seriesEntityId = "";
                if (TryGetJsonPath(action, out JsonElement partnerFeed, "partnerFeed"))
                    seriesEntityId = GetJsonScalar(partnerFeed, "evaSeriesEntityId");
                if (string.IsNullOrWhiteSpace(seriesEntityId) &&
                    TryGetJsonPath(action, out JsonElement legacyPartnerFeed, "legacyPartnerFeed"))
                    seriesEntityId = GetJsonScalar(legacyPartnerFeed, "evaSeriesEntityId");

                if (!string.IsNullOrWhiteSpace(seriesEntityId) &&
                    _nativeMediaResolvedMetadata.TryGetValue("disneyplus:entity-" + seriesEntityId, out NativeMediaResolvedMetadata? series))
                {
                    StoreResolvedNativeMediaMetadata(new NativeMediaResolvedMetadata
                    {
                        AppId = "disneyplus",
                        TargetId = deeplinkId,
                        Title = series.Title,
                        SeriesTitle = FirstNotBlank(series.SeriesTitle, series.Title),
                        ContentType = FirstNotBlank(GetJsonScalar(action, "contentType"), series.ContentType),
                        ArtworkUrl = series.ArtworkUrl,
                        ArtworkSizes = series.ArtworkSizes,
                        CapturedAtUtc = DateTime.UtcNow
                    });
                }
            }
        }

        private static void CaptureDisneyEntityPageMetadata(string targetId, JsonElement root)
        {
            if (!TryGetJsonPath(root, out JsonElement page, "data", "page") || page.ValueKind != JsonValueKind.Object) return;
            if (!TryGetJsonProperty(page, "visuals", out JsonElement visuals) || visuals.ValueKind != JsonValueKind.Object) return;

            string seriesTitle = GetJsonScalar(visuals, "title");
            string artworkId = ReadDisneyArtworkId(visuals);
            string artworkUrl = string.IsNullOrWhiteSpace(artworkId)
                ? ""
                : "https://disney.images.edge.bamgrid.com/ripcut-delivery/v1/variant/disney/" +
                  Uri.EscapeDataString(artworkId) + "/scale?width=1920";
            string entityTargetId = targetId.StartsWith("entity-", StringComparison.OrdinalIgnoreCase)
                ? targetId
                : GetJsonScalar(page, "id");
            if (!string.IsNullOrWhiteSpace(entityTargetId))
            {
                StoreResolvedNativeMediaMetadata(new NativeMediaResolvedMetadata
                {
                    AppId = "disneyplus",
                    TargetId = entityTargetId,
                    Title = seriesTitle,
                    SeriesTitle = seriesTitle,
                    ContentType = "series",
                    ArtworkUrl = artworkUrl,
                    ArtworkSizes = "1920x1080",
                    CapturedAtUtc = DateTime.UtcNow
                });
            }

            if (TryGetJsonProperty(page, "actions", out JsonElement pageActions) && pageActions.ValueKind == JsonValueKind.Array)
            {
                foreach (JsonElement action in pageActions.EnumerateArray())
                    StoreDisneyPlaybackAction(action, visuals, seriesTitle, artworkUrl, "", "");
            }

            if (!TryGetJsonProperty(page, "containers", out JsonElement containers) ||
                containers.ValueKind != JsonValueKind.Array) return;
            foreach (JsonElement container in containers.EnumerateArray())
            {
                if (!TryGetJsonProperty(container, "seasons", out JsonElement seasons) ||
                    seasons.ValueKind != JsonValueKind.Array) continue;
                foreach (JsonElement season in seasons.EnumerateArray())
                {
                    string seasonTitle = "";
                    if (TryGetJsonProperty(season, "visuals", out JsonElement seasonVisuals))
                    {
                        seasonTitle = FirstNotBlank(
                            GetJsonScalar(seasonVisuals, "title"),
                            GetJsonScalar(seasonVisuals, "name"));
                    }
                    if (!TryGetJsonProperty(season, "items", out JsonElement items) ||
                        items.ValueKind != JsonValueKind.Array) continue;
                    foreach (JsonElement item in items.EnumerateArray())
                    {
                        if (!TryGetJsonProperty(item, "visuals", out JsonElement itemVisuals)) continue;
                        string episodeNumber = GetJsonScalar(itemVisuals, "episodeNumber");
                        if (!TryGetJsonProperty(item, "actions", out JsonElement actions) ||
                            actions.ValueKind != JsonValueKind.Array) continue;
                        foreach (JsonElement action in actions.EnumerateArray())
                            StoreDisneyPlaybackAction(action, itemVisuals, seriesTitle, artworkUrl, seasonTitle, episodeNumber);
                    }
                }
            }
        }

        private static void StoreDisneyPlaybackAction(
            JsonElement action,
            JsonElement visuals,
            string seriesTitle,
            string artworkUrl,
            string seasonTitle,
            string episodeNumber)
        {
            string deeplinkId = GetJsonScalar(action, "deeplinkId");
            string actionType = GetJsonScalar(action, "type");
            if (string.IsNullOrWhiteSpace(deeplinkId) ||
                (!actionType.Equals("playback", StringComparison.OrdinalIgnoreCase) &&
                 !TryGetJsonProperty(action, "resourceId", out _))) return;

            string episodeTitle = GetJsonScalar(visuals, "episodeTitle");
            string title = FirstNotBlank(episodeTitle, GetJsonScalar(visuals, "title"));
            string resolvedSeason = FirstNotBlank(seasonTitle, GetJsonScalar(visuals, "seasonNumber"));
            StoreResolvedNativeMediaMetadata(new NativeMediaResolvedMetadata
            {
                AppId = "disneyplus",
                TargetId = deeplinkId,
                Title = title,
                SeriesTitle = string.Equals(title, seriesTitle, StringComparison.OrdinalIgnoreCase) ? "" : seriesTitle,
                SeasonTitle = resolvedSeason,
                EpisodeNumber = episodeNumber,
                ContentType = string.IsNullOrWhiteSpace(episodeTitle) ? "movie" : "episode",
                ArtworkUrl = artworkUrl,
                ArtworkSizes = string.IsNullOrWhiteSpace(artworkUrl) ? "" : "1920x1080",
                CapturedAtUtc = DateTime.UtcNow
            });
        }

        private static string ReadDisneyArtworkId(JsonElement visuals)
        {
            string[][] paths =
            {
                new[] { "artwork", "standard", "background", "1.78", "imageId" },
                new[] { "artwork", "details", "background", "1.78", "imageId" },
                new[] { "artwork", "hero", "background", "1.78", "imageId" },
                new[] { "artwork", "tile", "background", "1.78", "imageId" },
                new[] { "artwork", "standard", "tile", "1.78", "imageId" }
            };
            foreach (string[] path in paths)
            {
                if (TryGetJsonPath(visuals, out JsonElement value, path))
                {
                    string imageId = MediaProbeScalarText(value);
                    if (!string.IsNullOrWhiteSpace(imageId)) return imageId;
                }
            }
            return "";
        }

        private static void StoreResolvedNativeMediaMetadata(NativeMediaResolvedMetadata metadata)
        {
            if (string.IsNullOrWhiteSpace(metadata.AppId) || string.IsNullOrWhiteSpace(metadata.TargetId)) return;
            _nativeMediaResolvedMetadata.AddOrUpdate(
                metadata.Key,
                metadata,
                (_, existing) => MergeResolvedNativeMediaMetadata(existing, metadata));
            if (_nativeMediaResolvedMetadata.Count <= 600) return;
            foreach (var stale in _nativeMediaResolvedMetadata
                         .OrderBy(pair => pair.Value.CapturedAtUtc)
                         .Take(_nativeMediaResolvedMetadata.Count - 500))
            {
                _nativeMediaResolvedMetadata.TryRemove(stale.Key, out _);
            }
        }

        private static NativeMediaResolvedMetadata MergeResolvedNativeMediaMetadata(
            NativeMediaResolvedMetadata existing,
            NativeMediaResolvedMetadata incoming)
        {
            static int Quality(NativeMediaResolvedMetadata item)
            {
                int score = 0;
                if (!string.IsNullOrWhiteSpace(item.Title)) score += 2;
                if (!string.IsNullOrWhiteSpace(item.SeriesTitle)) score += 4;
                if (!string.IsNullOrWhiteSpace(item.SeasonTitle)) score += 3;
                if (!string.IsNullOrWhiteSpace(item.EpisodeNumber)) score += 3;
                if (!string.IsNullOrWhiteSpace(item.ArtworkUrl)) score += 4;
                if (item.ContentType.Equals("episode", StringComparison.OrdinalIgnoreCase)) score += 8;
                return score;
            }

            NativeMediaResolvedMetadata preferred = Quality(incoming) >= Quality(existing) ? incoming : existing;
            NativeMediaResolvedMetadata fallback = ReferenceEquals(preferred, incoming) ? existing : incoming;
            return new NativeMediaResolvedMetadata
            {
                AppId = preferred.AppId,
                TargetId = preferred.TargetId,
                Title = FirstNotBlank(preferred.Title, fallback.Title),
                SeriesTitle = FirstNotBlank(preferred.SeriesTitle, fallback.SeriesTitle),
                SeasonTitle = FirstNotBlank(preferred.SeasonTitle, fallback.SeasonTitle),
                EpisodeNumber = FirstNotBlank(preferred.EpisodeNumber, fallback.EpisodeNumber),
                ContentType = FirstNotBlank(preferred.ContentType, fallback.ContentType),
                ArtworkUrl = FirstNotBlank(preferred.ArtworkUrl, fallback.ArtworkUrl),
                ArtworkSizes = FirstNotBlank(preferred.ArtworkSizes, fallback.ArtworkSizes),
                CapturedAtUtc = existing.CapturedAtUtc >= incoming.CapturedAtUtc
                    ? existing.CapturedAtUtc
                    : incoming.CapturedAtUtc
            };
        }

        private static bool TryGetJsonProperty(JsonElement element, string name, out JsonElement value)
        {
            value = default;
            return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out value);
        }

        private static bool TryGetJsonPath(JsonElement element, out JsonElement value, params string[] path)
        {
            value = element;
            foreach (string segment in path)
            {
                if (!TryGetJsonProperty(value, segment, out JsonElement next))
                {
                    value = default;
                    return false;
                }
                value = next;
            }
            return true;
        }

        private static string GetJsonScalar(JsonElement element, string propertyName)
        {
            return TryGetJsonProperty(element, propertyName, out JsonElement value)
                ? TrimMetadataValue(MediaProbeScalarText(value), 1200)
                : "";
        }

        private static string ExtractMediaPlayerTargetId(string playerUrl)
        {
            if (!Uri.TryCreate(playerUrl, UriKind.Absolute, out Uri? uri)) return "";
            string[] segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            for (int index = segments.Length - 1; index >= 0; index--)
            {
                string candidate = Uri.UnescapeDataString(segments[index]).Trim();
                if (candidate.Length is >= 5 and <= 120 &&
                    System.Text.RegularExpressions.Regex.IsMatch(candidate, "^[a-z0-9_-]+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase) &&
                    candidate is not ("watch" or "play" or "browse" or "home"))
                {
                    return candidate;
                }
            }
            return "";
        }

        private static string SanitizeMediaProbeUrl(string value, bool includeQueryKeys)
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)) return "";

            string clean = uri.GetLeftPart(UriPartial.Path);
            if (!includeQueryKeys || string.IsNullOrWhiteSpace(uri.Query)) return TrimMetadataValue(clean, 2048);

            string[] keys = uri.Query.TrimStart('?')
                .Split('&', StringSplitOptions.RemoveEmptyEntries)
                .Select(part => part.Split('=', 2)[0])
                .Select(Uri.UnescapeDataString)
                .Where(key => key.Length is > 0 and <= 80 &&
                    System.Text.RegularExpressions.Regex.IsMatch(key, "^[a-z0-9_.-]+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(12)
                .ToArray();
            return TrimMetadataValue(clean + (keys.Length > 0 ? "?" + string.Join("&", keys.Select(key => key + "=<redacted>")) : ""), 2048);
        }

        private static List<string> ReadMediaProbeTopLevelKeys(JsonElement root)
        {
            if (root.ValueKind == JsonValueKind.Object)
                return root.EnumerateObject().Select(property => TrimMetadataValue(property.Name, 120)).Take(80).ToList();
            if (root.ValueKind == JsonValueKind.Array) return new() { "[array]" };
            return new() { root.ValueKind.ToString() };
        }

        private static void FindMediaNetworkProbeMatches(
            JsonElement element,
            string path,
            string targetId,
            List<MediaNetworkProbeMatch> matches,
            int depth,
            ref int visited)
        {
            if (depth > 20 || visited++ > 80_000 || matches.Count >= 20) return;
            if (element.ValueKind == JsonValueKind.Array)
            {
                int index = 0;
                foreach (JsonElement item in element.EnumerateArray())
                {
                    FindMediaNetworkProbeMatches(item, $"{path}[{index++}]", targetId, matches, depth + 1, ref visited);
                    if (matches.Count >= 20) return;
                }
                return;
            }
            if (element.ValueKind != JsonValueKind.Object) return;

            string matchedPath = "";
            string matchReason = "";
            if (!string.IsNullOrWhiteSpace(targetId))
            {
                foreach (JsonProperty property in element.EnumerateObject())
                {
                    string propertyPath = AppendMediaProbeJsonPath(path, property.Name);
                    if (string.Equals(property.Name, targetId, StringComparison.OrdinalIgnoreCase))
                    {
                        matchedPath = propertyPath;
                        matchReason = "target-key";
                        break;
                    }
                    string scalar = MediaProbeScalarText(property.Value);
                    if (!string.Equals(scalar, targetId, StringComparison.OrdinalIgnoreCase)) continue;
                    matchedPath = propertyPath;
                    matchReason = IsMediaProbeIdentifierKey(property.Name) ? "content-id" : "target-value";
                    break;
                }
            }

            if (!string.IsNullOrWhiteSpace(matchReason))
            {
                var match = new MediaNetworkProbeMatch
                {
                    ObjectPath = path,
                    MatchedPath = matchedPath,
                    MatchReason = matchReason
                };
                int extracted = 0;
                ExtractMediaProbeMetadataValues(element, path, match.MetadataValues, 0, ref extracted);
                matches.Add(match);
            }

            foreach (JsonProperty property in element.EnumerateObject())
            {
                if (property.Value.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array)) continue;
                FindMediaNetworkProbeMatches(
                    property.Value,
                    AppendMediaProbeJsonPath(path, property.Name),
                    targetId,
                    matches,
                    depth + 1,
                    ref visited);
                if (matches.Count >= 20) return;
            }
        }

        private static void ExtractMediaProbeMetadataValues(
            JsonElement element,
            string path,
            List<MediaNetworkProbeValue> values,
            int depth,
            ref int visited)
        {
            if (depth > 9 || visited++ > 8_000 || values.Count >= 240) return;
            if (element.ValueKind == JsonValueKind.Array)
            {
                int index = 0;
                foreach (JsonElement item in element.EnumerateArray())
                {
                    ExtractMediaProbeMetadataValues(item, $"{path}[{index++}]", values, depth + 1, ref visited);
                    if (values.Count >= 240) return;
                }
                return;
            }
            if (element.ValueKind != JsonValueKind.Object) return;

            foreach (JsonProperty property in element.EnumerateObject())
            {
                string propertyPath = AppendMediaProbeJsonPath(path, property.Name);
                if (property.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
                {
                    ExtractMediaProbeMetadataValues(property.Value, propertyPath, values, depth + 1, ref visited);
                    if (values.Count >= 240) return;
                    continue;
                }
                if (!IsMediaProbeMetadataKey(property.Name)) continue;

                string scalar = SanitizeMediaProbeScalar(MediaProbeScalarText(property.Value));
                if (string.IsNullOrWhiteSpace(scalar)) continue;
                values.Add(new MediaNetworkProbeValue
                {
                    Path = propertyPath,
                    Key = TrimMetadataValue(property.Name, 120),
                    Kind = property.Value.ValueKind.ToString(),
                    Value = scalar
                });
                if (values.Count >= 240) return;
            }
        }

        private static string MediaProbeScalarText(JsonElement value) => value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? "",
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => ""
        };

        private static bool IsMediaProbeIdentifierKey(string key) =>
            System.Text.RegularExpressions.Regex.IsMatch(
                key,
                "(?:^|_)(?:id|guid|videoid|movieid|contentid|entityid|programid|mediaid|encodedseriesid)$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static bool IsMediaProbeMetadataKey(string key) =>
            System.Text.RegularExpressions.Regex.IsMatch(
                key,
                "(?:id|guid|title|name|text|value|episode|season|series|show|image|art|poster|thumb|tile|logo|url|href|type|purpose|ratio|aspect|width|height|program|entity|content|media|presentation|source|synopsis|description)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase) &&
            !System.Text.RegularExpressions.Regex.IsMatch(
                key,
                "(?:token|cookie|authorization|password|secret|signature|session)",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static string AppendMediaProbeJsonPath(string path, string key)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(key, "^[A-Za-z_$][A-Za-z0-9_$-]*$")) return path + "." + key;
            string escaped = key.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("'", "\\'", StringComparison.Ordinal);
            return path + "['" + escaped + "']";
        }

        private static string SanitizeMediaProbeScalar(string value)
        {
            string trimmed = value.Trim();
            if (Uri.TryCreate(trimmed, UriKind.Absolute, out Uri? uri) &&
                (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                string clean = uri.GetLeftPart(UriPartial.Path);
                return TrimMetadataValue(clean + (string.IsNullOrWhiteSpace(uri.Query) ? "" : "?<redacted>"), 1200);
            }
            if (trimmed.Length > 1200) trimmed = trimmed[..1200] + "…";
            return trimmed;
        }

        private async Task<string?> DownloadMediaArtworkAsync(
            string artworkUrl,
            string pageUrl,
            string destinationFolder,
            string stableName)
        {
            if (!IsSafeMediaArtworkUri(artworkUrl, out Uri? currentUri) || currentUri == null) return null;

            HttpResponseMessage? response = null;
            try
            {
                for (int redirect = 0; redirect <= 4; redirect++)
                {
                    using var request = new HttpRequestMessage(HttpMethod.Get, currentUri);
                    request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/avif"));
                    request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/webp"));
                    request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("image/*", 0.9));
                    request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36 Doorpi/1.0");
                    if (Uri.TryCreate(pageUrl, UriKind.Absolute, out Uri? referer) && referer.Scheme == Uri.UriSchemeHttps)
                        request.Headers.Referrer = referer;

                    response = await _mediaArtworkHttpClient.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false);

                    if ((int)response.StatusCode is >= 300 and <= 399 && response.Headers.Location != null)
                    {
                        Uri redirected = response.Headers.Location.IsAbsoluteUri
                            ? response.Headers.Location
                            : new Uri(currentUri, response.Headers.Location);
                        response.Dispose();
                        response = null;
                        if (!IsSafeMediaArtworkUri(redirected.AbsoluteUri, out currentUri) || currentUri == null) return null;
                        continue;
                    }
                    break;
                }

                if (response == null || !response.IsSuccessStatusCode) return null;
                long? declaredLength = response.Content.Headers.ContentLength;
                if (declaredLength > MediaArtworkMaximumBytes) return null;
                string contentType = response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() ?? "";
                if (!string.IsNullOrWhiteSpace(contentType) &&
                    (!contentType.StartsWith("image/", StringComparison.Ordinal) || contentType.Contains("svg", StringComparison.Ordinal)))
                    return null;

                Directory.CreateDirectory(destinationFolder);
                string temporaryPath = Path.Combine(destinationFolder, stableName + ".download-" + Guid.NewGuid().ToString("N"));
                try
                {
                    await using (Stream source = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                    await using (var target = new FileStream(
                        temporaryPath,
                        FileMode.CreateNew,
                        FileAccess.Write,
                        FileShare.None,
                        81920,
                        useAsync: true))
                    {
                        byte[] buffer = new byte[81920];
                        long total = 0;
                        while (true)
                        {
                            int read = await source.ReadAsync(buffer.AsMemory()).ConfigureAwait(false);
                            if (read == 0) break;
                            total += read;
                            if (total > MediaArtworkMaximumBytes) return null;
                            await target.WriteAsync(buffer.AsMemory(0, read)).ConfigureAwait(false);
                        }
                    }

                    string? extension = DetectMediaArtworkExtension(temporaryPath);
                    if (extension == null) return null;
                    string finalPath = Path.Combine(destinationFolder, stableName + extension);
                    File.Move(temporaryPath, finalPath, overwrite: true);
                    temporaryPath = "";
                    return finalPath;
                }
                finally
                {
                    try
                    {
                        if (!string.IsNullOrWhiteSpace(temporaryPath) && File.Exists(temporaryPath))
                            File.Delete(temporaryPath);
                    }
                    catch { }
                }
            }
            finally
            {
                response?.Dispose();
            }
        }

        private static string? DetectMediaArtworkExtension(string path)
        {
            byte[] header = new byte[16];
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            int read = stream.Read(header, 0, header.Length);
            if (read >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return ".png";
            if (read >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return ".jpg";
            if (read >= 6 && Encoding.ASCII.GetString(header, 0, 6) is "GIF87a" or "GIF89a") return ".gif";
            if (read >= 12 && Encoding.ASCII.GetString(header, 0, 4) == "RIFF" && Encoding.ASCII.GetString(header, 8, 4) == "WEBP") return ".webp";
            if (read >= 2 && header[0] == 0x42 && header[1] == 0x4D) return ".bmp";
            if (read >= 12 && Encoding.ASCII.GetString(header, 4, 4) == "ftyp")
            {
                string brand = Encoding.ASCII.GetString(header, 8, 4);
                if (brand is "avif" or "avis" or "mif1") return ".avif";
            }
            return null;
        }

        private void ApplyCapturedArtworkLocked(MediaArtworkCaptureRequest request, string localUrl)
        {
            if (string.Equals(currentUserId, request.ProfileId, StringComparison.OrdinalIgnoreCase) &&
                _activeMediaHistorySession?.Key == request.Key &&
                string.Equals(_activeMediaHistorySession.ArtworkRemoteUrl, request.Candidate.Url, StringComparison.Ordinal))
            {
                _activeMediaHistorySession.ArtworkLocalUrl = localUrl;
                _activeMediaHistorySession.ArtworkSource = request.Candidate.Source;
            }

            string historyPath = Path.Combine(ResolveMediaProfileFolder(request.ProfileId), "media-history.json");
            List<MediaActivityHistoryEntry> history;
            try
            {
                history = File.Exists(historyPath)
                    ? JsonSerializer.Deserialize<List<MediaActivityHistoryEntry>>(SafeReadAllText(historyPath)) ?? new()
                    : new();
            }
            catch
            {
                history = new();
            }

            string seriesTitle = TrimMetadataValue(request.Metadata.SeriesTitle, 180);
            List<MediaActivityHistoryEntry> matchingEntries = history.Where(item =>
                    string.Equals(item.AppId, request.AppId, StringComparison.OrdinalIgnoreCase) &&
                    (string.Equals(item.ContentTitle, request.ContentTitle, StringComparison.OrdinalIgnoreCase) ||
                     (!string.IsNullOrWhiteSpace(seriesTitle) &&
                      string.Equals(item.ContentTitle, seriesTitle, StringComparison.OrdinalIgnoreCase))) &&
                    string.Equals(NormalizeTrackedMediaCreator(item.CreatorName), request.CreatorName, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (matchingEntries.Count == 0) return;

            bool changed = false;
            foreach (MediaActivityHistoryEntry entry in matchingEntries)
            {
                if (!string.IsNullOrWhiteSpace(entry.ArtworkRemoteUrl) &&
                    !string.Equals(entry.ArtworkRemoteUrl, request.Candidate.Url, StringComparison.Ordinal)) continue;
                entry.ArtworkRemoteUrl = request.Candidate.Url;
                entry.ArtworkLocalUrl = localUrl;
                entry.ArtworkSource = request.Candidate.Source;
                entry.MetadataCapturedUtc = DateTime.UtcNow;
                if (string.IsNullOrWhiteSpace(entry.SeriesTitle) && !string.IsNullOrWhiteSpace(seriesTitle))
                    entry.SeriesTitle = seriesTitle;
                changed = true;
            }
            if (!changed) return;
            string json = JsonSerializer.Serialize(history, IndentedJsonOptions);
            SafeWriteAllText(historyPath, json);
            if (string.Equals(currentUserId, request.ProfileId, StringComparison.OrdinalIgnoreCase))
                SafeWriteAllText(Path.Combine(dataFolder, "media-history.json"), json);
        }

        private void FinalizeMediaHistorySession(bool saveEligibleActivity)
        {
            lock (_mediaHistoryFileLock)
                FinalizeMediaHistorySessionLocked(saveEligibleActivity);
        }

        private void FinalizeMediaHistorySessionLocked(bool saveEligibleActivity)
        {
            var active = _activeMediaHistorySession;
            _activeMediaHistorySession = null;
            if (active == null || !saveEligibleActivity || active.AccumulatedSeconds < MediaHistoryMinimumSessionSeconds) return;
            PersistMediaHistorySessionLocked(active, isFinal: true);
        }

        private List<MediaActivityHistoryEntry> LoadMediaHistoryLocked()
        {
            foreach (string candidate in new[] { mediaHistoryFile, mediaHistoryFile + ".bak" })
            {
                try
                {
                    if (!File.Exists(candidate)) continue;
                    var history = JsonSerializer.Deserialize<List<MediaActivityHistoryEntry>>(SafeReadAllText(candidate));
                    if (history == null) continue;
                    bool sanitized = SanitizeMediaHistoryEntries(history);
                    if (sanitized || !string.Equals(candidate, mediaHistoryFile, StringComparison.OrdinalIgnoreCase))
                    {
                        string cleanJson = JsonSerializer.Serialize(history, IndentedJsonOptions);
                        SafeWriteAllText(mediaHistoryFile, cleanJson);
                        SafeWriteAllText(Path.Combine(dataFolder, "media-history.json"), cleanJson);
                    }
                    return history;
                }
                catch { }
            }
            return new();
        }

        private void SanitizeMediaHistoryForActiveUser()
        {
            lock (_mediaHistoryFileLock)
            {
                try
                {
                    if (!File.Exists(mediaHistoryFile)) return;
                    var history = JsonSerializer.Deserialize<List<MediaActivityHistoryEntry>>(SafeReadAllText(mediaHistoryFile)) ?? new();
                    if (!SanitizeMediaHistoryEntries(history)) return;
                    string json = JsonSerializer.Serialize(history, IndentedJsonOptions);
                    SafeWriteAllText(mediaHistoryFile, json);
                    SafeWriteAllText(Path.Combine(dataFolder, "media-history.json"), json);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine("[MediaHistory] Falha ao higienizar histórico: " + ex.Message);
                }
            }
        }

        private void ApplyMediaHistoryCategoryPreferenceToExistingHistory(MediaAppModel app)
        {
            bool changed = false;
            lock (_mediaHistoryFileLock)
            {
                string preference = NormalizeMediaHistoryCategory(app.MediaHistoryCategory);
                if (preference == "disabled" &&
                    string.Equals(_activeMediaHistorySession?.AppId, app.Id, StringComparison.OrdinalIgnoreCase))
                {
                    FinalizeMediaHistorySessionLocked(saveEligibleActivity: true);
                }

                List<MediaActivityHistoryEntry> history = LoadMediaHistoryLocked();
                foreach (MediaActivityHistoryEntry entry in history.Where(item =>
                             string.Equals(item.AppId, app.Id, StringComparison.OrdinalIgnoreCase)))
                {
                    string category = preference switch
                    {
                        "film-series" => "film-series",
                        "video-live" => string.Equals(entry.Category, "live", StringComparison.OrdinalIgnoreCase)
                            ? "live"
                            : "video",
                        "disabled" => entry.Category,
                        _ => MediaCategoryForApp(app, new MediaMetadataSnapshot
                        {
                            SeriesTitle = entry.SeriesTitle,
                            ContentType = entry.ContentType,
                            IsLive = string.Equals(entry.Category, "live", StringComparison.OrdinalIgnoreCase),
                            Artwork = string.IsNullOrWhiteSpace(entry.ArtworkRemoteUrl)
                                ? new()
                                : new()
                                {
                                    new MediaArtworkCandidate
                                    {
                                        Url = entry.ArtworkRemoteUrl,
                                        Source = entry.ArtworkSource,
                                        Score = 100
                                    }
                                }
                        })
                    };
                    if (string.Equals(entry.Category, category, StringComparison.OrdinalIgnoreCase)) continue;
                    entry.Category = category;
                    changed = true;
                }

                if (changed)
                {
                    string json = JsonSerializer.Serialize(history, IndentedJsonOptions);
                    SafeWriteAllText(mediaHistoryFile, json);
                    string mirror = Path.Combine(dataFolder, "media-history.json");
                    if (!string.Equals(mediaHistoryFile, mirror, StringComparison.OrdinalIgnoreCase))
                        SafeWriteAllText(mirror, json);
                }
            }

            if (changed) ScheduleProfileSync(currentUserId, delayMs: 500);
        }

        private static bool SanitizeMediaHistoryEntries(List<MediaActivityHistoryEntry> history)
        {
            bool changed = history.RemoveAll(entry => IsInvalidTrackedMediaTitle(entry.ContentTitle)) > 0;
            foreach (MediaActivityHistoryEntry entry in history)
            {
                string creator = NormalizeTrackedMediaCreator(entry.CreatorName);
                if (!string.Equals(creator, entry.CreatorName, StringComparison.Ordinal))
                {
                    entry.CreatorName = creator;
                    changed = true;
                }

                if (string.Equals(entry.Category, "video", StringComparison.OrdinalIgnoreCase) &&
                    IsTmdbMediaArtwork(entry.ArtworkRemoteUrl, entry.ArtworkSource))
                {
                    entry.Category = "film-series";
                    if (string.IsNullOrWhiteSpace(entry.ContentType))
                        entry.ContentType = "movie-or-series";
                    changed = true;
                }

                bool sameAsPage = Uri.TryCreate(entry.PageUrl, UriKind.Absolute, out Uri? pageUri) &&
                    Uri.TryCreate(entry.ArtworkRemoteUrl, UriKind.Absolute, out Uri? artworkUri) &&
                    string.Equals(pageUri.Scheme, artworkUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(pageUri.Host, artworkUri.Host, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(pageUri.AbsolutePath, artworkUri.AbsolutePath, StringComparison.OrdinalIgnoreCase);
                bool untrustedDisneyArtwork = entry.AppId.Equals("disneyplus", StringComparison.OrdinalIgnoreCase) &&
                    entry.ArtworkSource is not ("media-session" or "network-metadata");
                bool untrustedNetflixArtwork = entry.AppId.Equals("netflix", StringComparison.OrdinalIgnoreCase) &&
                    entry.ArtworkSource is not ("media-session" or "network-metadata" or "public-page");
                if (sameAsPage || untrustedDisneyArtwork || untrustedNetflixArtwork)
                {
                    if (!string.IsNullOrWhiteSpace(entry.ArtworkRemoteUrl) ||
                        !string.IsNullOrWhiteSpace(entry.ArtworkLocalUrl) ||
                        !string.IsNullOrWhiteSpace(entry.ArtworkSource))
                    {
                        entry.ArtworkRemoteUrl = "";
                        entry.ArtworkLocalUrl = "";
                        entry.ArtworkSource = "";
                        changed = true;
                    }
                }
            }
            return changed;
        }

        private void PersistMediaHistorySessionLocked(ActiveMediaHistorySession active, bool isFinal)
        {
            long delta = (long)Math.Floor(active.AccumulatedSeconds - active.PersistedSeconds);
            if (delta <= 0 && !(isFinal && active.PersistedSeconds > 0)) return;

            var history = LoadMediaHistoryLocked();
            var entry = history.FirstOrDefault(item =>
                string.Equals(item.AppId, active.AppId, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(item.ContentTitle, active.ContentTitle, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(NormalizeTrackedMediaCreator(item.CreatorName), active.CreatorName, StringComparison.OrdinalIgnoreCase));

            if (entry == null)
            {
                entry = new MediaActivityHistoryEntry
                {
                    AppId = active.AppId,
                    AppName = active.AppName,
                    Category = active.Category,
                    ContentTitle = active.ContentTitle,
                    CreatorName = active.CreatorName,
                    FirstPlayed = DateTime.UtcNow
                };
                history.Add(entry);
            }

            entry.CreatorName = active.CreatorName;
            entry.AppName = active.AppName;
            entry.Category = active.Category;

            entry.AlbumTitle = FirstNotBlank(active.AlbumTitle, entry.AlbumTitle);
            entry.SeriesTitle = FirstNotBlank(active.SeriesTitle, entry.SeriesTitle);
            entry.SeasonTitle = FirstNotBlank(active.SeasonTitle, entry.SeasonTitle);
            entry.EpisodeNumber = FirstNotBlank(active.EpisodeNumber, entry.EpisodeNumber);
            entry.ContentType = FirstNotBlank(active.ContentType, entry.ContentType);
            entry.PageUrl = FirstNotBlank(active.PageUrl, entry.PageUrl);
            entry.TitleSource = FirstNotBlank(active.TitleSource, entry.TitleSource);
            entry.MediaSessionAvailable |= active.MediaSessionAvailable;
            entry.MetadataCapturedUtc = active.MetadataCapturedUtc ?? entry.MetadataCapturedUtc;
            if (!string.IsNullOrWhiteSpace(active.ArtworkRemoteUrl))
            {
                if (!string.Equals(entry.ArtworkRemoteUrl, active.ArtworkRemoteUrl, StringComparison.Ordinal))
                    entry.ArtworkLocalUrl = "";
                entry.ArtworkRemoteUrl = active.ArtworkRemoteUrl;
                entry.ArtworkSource = active.ArtworkSource;
            }
            if (!string.IsNullOrWhiteSpace(active.ArtworkLocalUrl))
                entry.ArtworkLocalUrl = active.ArtworkLocalUrl;

            entry.TotalPlaybackSeconds += Math.Max(0, delta);
            entry.LastPositionSeconds = active.PositionSeconds;
            entry.DurationSeconds = active.DurationSeconds;
            entry.LastPlayed = DateTime.UtcNow;
            if (!active.SessionCountCommitted)
            {
                entry.SessionCount++;
                active.SessionCountCommitted = true;
            }
            if (isFinal) entry.LastSessionSeconds = (long)Math.Floor(active.AccumulatedSeconds);

            active.PersistedSeconds += Math.Max(0, delta);
            string json = JsonSerializer.Serialize(history
                .OrderByDescending(item => item.LastPlayed)
                .Take(500)
                .ToList(), IndentedJsonOptions);
            SafeWriteAllText(mediaHistoryFile, json);
            string mirror = Path.Combine(dataFolder, "media-history.json");
            if (!string.Equals(mediaHistoryFile, mirror, StringComparison.OrdinalIgnoreCase)) SafeWriteAllText(mirror, json);
            ScheduleProfileSync(currentUserId, delayMs: 1800);
        }
    }
}
