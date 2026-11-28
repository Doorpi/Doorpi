using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Doorpi.Steam;
using Doorpi.Storage;

namespace Doorpi;

public partial class MainWindow
{
    private static readonly HttpClient TrophyArtworkHttp = new(new HttpClientHandler { AllowAutoRedirect = false });
    private Window? _localTrophyPopup;
    private StackPanel? _localTrophyStack;
    private DispatcherTimer? _localTrophyTimeout;
    private bool _localTrophyPopupIsPlatinum;
    private double _trophyPopupScale;
    private MediaPlayer? _achievementSoundPlayer;
    private readonly Queue<TrophyNotice> _pendingTrophyNotices = new();

    private sealed record TrophyNotice(string GameName, SteamAchievementData[]? Achievements, string Owner, long Generation)
    {
        public bool IsPlatinum => Achievements == null;
    }

#if DEBUG
    private bool _localTrophyPreviewPending = Environment.GetCommandLineArgs()
        .Contains("--doorpi-preview-trophy", StringComparer.OrdinalIgnoreCase);

    private void ShowLocalTrophyPreviewOnLogin(string mode)
    {
        if (!_localTrophyPreviewPending || !_interactiveUserSessionStarted ||
            string.IsNullOrWhiteSpace(currentUserId) || mode.StartsWith("user-picker", StringComparison.Ordinal))
            return;

        _localTrophyPreviewPending = false;
        ShowLocalTrophy(Localized("Phantom Blade Zero · Prévia", "Phantom Blade Zero · Preview"),
        [
            new SteamAchievementData
            {
                Name = Localized("A Jornada do Coração", "The Heart's Journey"),
                GlobalUnlockPercent = 95.4,
                IconUrl = "https://shared.fastly.steamstatic.com/community_assets/images/apps/4115450/398f1c2ee03b7bf8fedcd32c4ff339939139d791.jpg"
            }
        ], followedByPlatinum: true);
    }
#endif

    private static string LocalTrophyLedger(string directory) => Path.Combine(directory,"doorpi-local-trophies.json");
    private static Dictionary<string,long> ReadLocalTrophies(string path)
    {
        if(!StateStorage.Exists(path))return new();
        var ledger=JsonSerializer.Deserialize<Dictionary<string,long>>(StateStorage.ReadAllText(path)) ?? throw new InvalidDataException("Registro de conquistas inválido.");
        // Early builds stored this game's API names without the application namespace.
        foreach(var key in ledger.Keys.Where(k=>System.Text.RegularExpressions.Regex.IsMatch(k,@"^ACH_\d+$")).ToArray())
        {
            string qualified="4115450/"+key;
            long stamp=ledger[key];
            if(!ledger.TryGetValue(qualified,out var prior) || prior==0 || (stamp>0 && stamp<prior))ledger[qualified]=stamp;
            ledger.Remove(key);
        }
        return ledger;
    }

    private void ShowLocalTrophy(string gameName, IEnumerable<SteamAchievementData> achievements, bool followedByPlatinum = false)
    {
        SteamAchievementData[] unlocked = achievements.ToArray();
        if (unlocked.Length > 0)
            QueueTrophyNotice(new TrophyNotice(gameName, unlocked, currentUserId, _themeProfileGeneration));
        if (followedByPlatinum)
            ShowLocalPlatinum(gameName);
    }

    private void ShowLocalPlatinum(string gameName)
        => QueueTrophyNotice(new TrophyNotice(gameName, null, currentUserId, _themeProfileGeneration));

    private void QueueTrophyNotice(TrophyNotice notice)
    {
        if (_localTrophyPopup != null && !_localTrophyPopupIsPlatinum && !notice.IsPlatinum && _pendingTrophyNotices.Count == 0)
        {
            PresentTrophyNotice(notice);
            return;
        }
        _pendingTrophyNotices.Enqueue(notice);
        ShowNextTrophyNotice();
    }

    private void ShowNextTrophyNotice()
    {
        if (_localTrophyPopup != null || Dispatcher.HasShutdownStarted) return;
        while (_pendingTrophyNotices.TryDequeue(out var notice))
        {
            if (!_interactiveUserSessionStarted || notice.Owner != currentUserId || notice.Generation != _themeProfileGeneration)
                continue;
            PresentTrophyNotice(notice);
            break;
        }
    }

    private void PresentTrophyNotice(TrophyNotice notice)
    {
        bool created = _localTrophyPopup == null;
        if (_localTrophyPopup == null)
        {
            _localTrophyPopupIsPlatinum = notice.IsPlatinum;
            var area = SystemParameters.WorkArea;
            // Scale the entire badge in WPF units so the text and art stay in proportion.
            _trophyPopupScale = Math.Clamp(Math.Min(area.Height / 900, area.Width / 1440), .9, 2.4);
            double inset = 20 * _trophyPopupScale;
            _localTrophyStack = new StackPanel { UseLayoutRounding = true };
            var scroll = new ScrollViewer
            {
                Content = _localTrophyStack,
                VerticalScrollBarVisibility = ScrollBarVisibility.Hidden,
                HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                MaxHeight = area.Height * .72,
                Background = Brushes.Transparent
            };
            double width = Math.Min(412 * _trophyPopupScale, area.Width - 2 * inset);
            _localTrophyPopup = new Window
            {
                Title = "Doorpi",
                WindowStyle = WindowStyle.None,
                ResizeMode = ResizeMode.NoResize,
                AllowsTransparency = true,
                Background = Brushes.Transparent,
                Topmost = true,
                ShowActivated = false,
                ShowInTaskbar = false,
                Focusable = false,
                SizeToContent = SizeToContent.Height,
                Width = width,
                MaxHeight = area.Height * .76,
                Left = area.Right - width - inset,
                Top = area.Top + inset,
                Content = scroll
            };
            _localTrophyPopup.Closed += (_, _) =>
            {
                _localTrophyTimeout?.Stop();
                _localTrophyTimeout = null;
                _localTrophyStack = null;
                _localTrophyPopup = null;
                _ = Dispatcher.InvokeAsync(ShowNextTrophyNotice);
            };
            _localTrophyPopup.Show();
            _localTrophyTimeout = new DispatcherTimer();
            _localTrophyTimeout.Tick += (_, _) => DismissLocalTrophies();
        }

        var stack = _localTrophyStack!;
        stack.BeginAnimation(UIElement.OpacityProperty, null);
        if (notice.Achievements is { } unlocked)
        {
            for (int i = 0; i < unlocked.Length; i++)
                stack.Children.Add(CreateLocalTrophyBadge(notice.GameName, unlocked[i], i, _trophyPopupScale));
        }
        else
        {
            stack.Children.Add(CreateLocalTrophyBadge(notice.GameName, null, 0, _trophyPopupScale));
        }

        var timeout = _localTrophyTimeout!;
        timeout.Stop();
        timeout.Interval = TimeSpan.FromSeconds(stack.Children.Count == 1 ? 5 : 6.5);
        timeout.Start();

        if (!created) return;
        PlayAchievementSound(notice.IsPlatinum);
    }

    private void PlayAchievementSound(bool platinum)
    {
        StopAchievementSound();
        int volume = GetAchievementVolume();
        if (volume == 0) return;
        try
        {
            string file = platinum ? "achievement-platinum.wav" : "achievement.wav";
            string soundPath = Path.Combine(AppContext.BaseDirectory, "wwwroot", "sounds", file);
            if (!File.Exists(soundPath)) return;
            var player = new MediaPlayer { Volume = volume / 100.0 };
            _achievementSoundPlayer = player;
            player.MediaEnded += (_, _) =>
            {
                if (_achievementSoundPlayer == player) StopAchievementSound();
            };
            player.MediaFailed += (_, e) =>
            {
                System.Diagnostics.Debug.WriteLine("[Local trophies] Som de conquista: " + e.ErrorException.Message);
                if (_achievementSoundPlayer == player) StopAchievementSound();
            };
            player.Open(new Uri(soundPath, UriKind.Absolute));
            player.Play();
        }
        catch (Exception ex)
        {
            StopAchievementSound();
            System.Diagnostics.Debug.WriteLine("[Local trophies] Som de conquista: " + ex.Message);
        }
    }

    private void StopAchievementSound()
    {
        var player = _achievementSoundPlayer;
        _achievementSoundPlayer = null;
        player?.Close();
    }

    private void DismissLocalTrophies()
    {
        _localTrophyTimeout?.Stop();
        if (_localTrophyPopup is not { } popup || _localTrophyStack is not { } stack) return;
        var fade = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(160));
        fade.Completed += (_, _) =>
        {
            if (_localTrophyPopup == popup && _localTrophyTimeout?.IsEnabled == false)
                popup.Close();
        };
        stack.BeginAnimation(UIElement.OpacityProperty, fade);
    }

    private static Border CreateLocalTrophyBadge(string gameName, SteamAchievementData? achievement, int order, double scale)
    {
        bool platinum = achievement == null;
        string? tier = platinum ? "platinum" : SteamMedals.Classify(achievement!.GlobalUnlockPercent);
        var colors = TrophyColors(tier);
        var accent = new SolidColorBrush(colors.Light);
        var art = new Grid { Width = 64, Height = 60, VerticalAlignment = VerticalAlignment.Center };
        var trophy = CreateTrophyIcon(tier, colors, platinum ? 64 : 56);
        art.Children.Add(trophy);

        var information = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(13, 0, 0, 0) };
        information.Children.Add(new TextBlock
        {
            Text = platinum ? Localized("Todos os troféus conquistados", "All trophies earned")
                : string.IsNullOrWhiteSpace(achievement!.Name) ? achievement.ApiName : achievement.Name,
            Foreground = new SolidColorBrush(Color.FromRgb(247, 246, 241)),
            FontSize = 20,
            FontWeight = FontWeights.SemiBold,
            TextWrapping = TextWrapping.Wrap,
            LineHeight = 24,
            LineStackingStrategy = LineStackingStrategy.BlockLineHeight,
            MaxHeight = 48,
            TextTrimming = TextTrimming.CharacterEllipsis
        });
        var details = new TextBlock
        {
            Foreground = new SolidColorBrush(Color.FromRgb(195, 196, 198)),
            FontSize = 13,
            Margin = new Thickness(0, 3, 0, 0),
            TextTrimming = TextTrimming.CharacterEllipsis
        };
        details.Inlines.Add(new System.Windows.Documents.Run(platinum ? Localized("Platina", "Platinum") : TrophyTierName(tier))
        {
            Foreground = accent
        });
        if (!string.IsNullOrWhiteSpace(gameName)) details.Inlines.Add("  ·  " + gameName);
        information.Children.Add(details);

        var content = new Grid { Margin = new Thickness(12, 8, 16, 8) };
        content.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        content.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        content.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        var artwork = new Border
        {
            Width = 46, Height = 46, CornerRadius = new CornerRadius(3),
            Margin = new Thickness(12, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center,
            Visibility = Visibility.Collapsed
        };
        Grid.SetColumn(artwork, 2);
        content.Children.Add(artwork);
        Grid.SetColumn(art, 0);
        Grid.SetColumn(information, 1);
        content.Children.Add(art);
        content.Children.Add(information);

        var badge = new Border
        {
            LayoutTransform = new ScaleTransform(scale, scale),
            Margin = new Thickness(0, 0, 0, 6),
            CornerRadius = new CornerRadius(6),
            Background = new SolidColorBrush(Color.FromArgb(244, 29, 32, 38)),
            Child = content,
            Opacity = 0,
            RenderTransform = new TranslateTransform(12, 0)
        };
        var fade = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(190))
        {
            BeginTime = TimeSpan.FromMilliseconds(Math.Min(order, 4) * 45),
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };
        badge.BeginAnimation(UIElement.OpacityProperty, fade);
        ((TranslateTransform)badge.RenderTransform).BeginAnimation(TranslateTransform.XProperty,
            new DoubleAnimation(12, 0, TimeSpan.FromMilliseconds(220))
            {
                BeginTime = fade.BeginTime,
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            });

        if (achievement == null) return badge;

        string? artUrl = SteamAchievementData.IsSteamImage(achievement.IconUrl) ? achievement.IconUrl : null;
        string? fallbackUrl = achievement.AppId > 0 && achievement.IconFile is { } iconFile &&
            Regex.IsMatch(iconFile, @"\A[0-9a-f]{40}\.(jpg|png)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
                ? $"https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/{achievement.AppId}/{iconFile}"
                : null;
        if (artUrl != null || fallbackUrl != null)
            _ = LoadTrophyArtworkAsync(artUrl, fallbackUrl, artwork);
        return badge;
    }

    private static async Task LoadTrophyArtworkAsync(string? url, string? fallbackUrl, Border target)
    {
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var bitmap = url == null ? null : await DownloadTrophyArtworkAsync(url, deadline.Token);
        if (bitmap == null && fallbackUrl != null && fallbackUrl != url && !deadline.IsCancellationRequested)
            bitmap = await DownloadTrophyArtworkAsync(fallbackUrl, deadline.Token);
        if (bitmap == null) return;

        target.Background = new ImageBrush(bitmap) { Stretch = Stretch.UniformToFill };
        target.Visibility = Visibility.Visible;
    }

    private static async Task<BitmapSource?> DownloadTrophyArtworkAsync(string url, CancellationToken token)
    {
        try
        {
            using var response = await TrophyArtworkHttp.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength is > 2_000_000) return null;
            await using var source = await response.Content.ReadAsStreamAsync(token).ConfigureAwait(false);
            using var buffer = new MemoryStream();
            byte[] chunk = new byte[16 * 1024];
            int read;
            while ((read = await source.ReadAsync(chunk, token).ConfigureAwait(false)) > 0)
            {
                if (buffer.Length + read > 2_000_000) return null;
                buffer.Write(chunk, 0, read);
            }
            buffer.Position = 0;
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = buffer;
            bitmap.DecodePixelWidth = 192;
            bitmap.EndInit();
            bitmap.Freeze();
            return bitmap;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine("[Local trophies] Arte de conquista: " + ex.Message);
            return null;
        }
    }

    private static Viewbox CreateTrophyIcon(string? tier, (Color Light, Color Metal, Color Shade) colors, double size)
    {
        // Match the trophy silhouettes in the profile, in the same 48 × 48 coordinate space.
        var icon = new Grid { Width = 48, Height = 48 };
        if (tier == "platinum")
            DrawPlatinumTrophy(icon);
        else
            DrawTrophyCup(icon, tier, colors);

        return new Viewbox
        {
            Width = size,
            Height = size,
            Child = icon,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center
        };
    }

    private static void DrawPlatinumTrophy(Grid icon)
    {
        (uint Color, string Shape)[] facets =
        [
            (0x244794, "M3 11l12 6L24 3l9 14 12-6-5 21-12 5v3l7 2v3H13v-3l7-2v-3L8 32Z"),
            (0x528cfa, "M3 11l12 6 9-14 9 14 12-6-9 15-12 9-12-9Z"),
            (0x3568ca, "M3 11l12 6 9 18-12-9Z"),
            (0x87b7ff, "M24 3l9 14-9 18Z"),
            (0xa8d2ff, "M24 3l-7 17-2-3Z M45 11l-9 15-7 4Z"),
            (0x759bc9, "M8 32l16 4 16-4-12 5h-8Z"),
            (0x46668d, "M20 40l4-2 4 2 7 2H13Z"),
            (0xa3c2e6, "M13 42h22v1H13Z")
        ];
        foreach (var (rgb, shape) in facets)
            icon.Children.Add(new System.Windows.Shapes.Path
            {
                Data = Geometry.Parse(shape),
                Fill = new SolidColorBrush(Color.FromRgb((byte)(rgb >> 16), (byte)(rgb >> 8), (byte)rgb))
            });
    }

    private static void DrawTrophyCup(Grid icon, string? tier, (Color Light, Color Metal, Color Shade) colors)
    {
        var (cup, handles, highlight) = tier switch
        {
            "gold" => ("M9 6h30l-2 12q-2 9-11 12v4l6 3v2h4v5H12v-5h4v-2l6-3v-4q-9-3-11-12Z",
                "M10 11C-1 7 3 24 16 24M38 11c11-4 7 13-6 13",
                "M9 6h30l-1 3H10Z M13 11h5q0 8 4 14-7-3-9-14Z"),
            "silver" => ("M12 5h24q-1 18-10 23v7l5 3 3 1v4H14v-4l3-1 5-3v-7Q13 23 12 5Z",
                "M13 11Q2 6 5 17q2 6 12 7M35 11q11-5 8 6-2 6-12 7",
                "M14 7h5q0 9 3 16-6-5-8-16Z"),
            "bronze" => ("M10 7h28l-2 12q-2 9-10 12v5l7 4v3H15v-3l7-4v-5q-8-3-10-12Z",
                "M12 12H5q0 11 12 12M36 12h7q0 11-12 12", "M10 7h28l-1 3H11Z"),
            _ => ("M12 8h24l-3 13q-2 7-7 9v7l6 3v3H16v-3l6-3v-7q-5-2-7-9Z", null,
                "M12 8h24l-1 3H13Z")
        };
        if (handles != null)
            icon.Children.Add(new System.Windows.Shapes.Path
            {
                Data = Geometry.Parse(handles),
                Stroke = new SolidColorBrush(colors.Metal),
                StrokeThickness = 3,
                StrokeStartLineCap = PenLineCap.Round,
                StrokeEndLineCap = PenLineCap.Round
            });
        var metal = new LinearGradientBrush(colors.Light, colors.Shade, 60);
        metal.GradientStops.Insert(1, new GradientStop(colors.Metal, .4));
        icon.Children.Add(new System.Windows.Shapes.Path { Data = Geometry.Parse(cup), Fill = metal });
        icon.Children.Add(new System.Windows.Shapes.Path
        {
            Data = Geometry.Parse(highlight),
            Fill = new SolidColorBrush(colors.Light)
        });
    }

    private static (Color Light, Color Metal, Color Shade) TrophyColors(string? tier) => tier switch
    {
        "platinum" => (Color.FromRgb(180, 214, 255), Color.FromRgb(96, 154, 248), Color.FromRgb(48, 87, 167)),
        "gold" => (Color.FromRgb(255, 229, 160), Color.FromRgb(231, 178, 76), Color.FromRgb(159, 111, 47)),
        "silver" => (Color.FromRgb(240, 245, 252), Color.FromRgb(186, 203, 220), Color.FromRgb(121, 139, 158)),
        "bronze" => (Color.FromRgb(242, 185, 148), Color.FromRgb(205, 141, 98), Color.FromRgb(151, 91, 60)),
        "iron" => (Color.FromRgb(191, 205, 215), Color.FromRgb(144, 163, 176), Color.FromRgb(99, 117, 132)),
        _ => (Color.FromRgb(202, 217, 231), Color.FromRgb(161, 182, 204), Color.FromRgb(109, 131, 158))
    };

    private static string TrophyTierName(string? tier) => tier switch
    {
        "gold" => Localized("Ouro", "Gold"),
        "silver" => Localized("Prata", "Silver"),
        "bronze" => Localized("Bronze", "Bronze"),
        "iron" => Localized("Ferro", "Iron"),
        _ => Localized("Troféu", "Trophy")
    };

    private static string Localized(string portuguese, string english)
        => System.Globalization.CultureInfo.CurrentUICulture.Name.StartsWith("pt", StringComparison.OrdinalIgnoreCase)
            ? portuguese
            : english;
}
