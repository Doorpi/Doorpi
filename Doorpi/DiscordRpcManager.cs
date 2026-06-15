using DiscordRPC;
using DiscordRPC.Logging;
using System;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Doorpi
{

    public sealed class DiscordRpcManager : IDisposable
    {
        // ── Singleton ─────────────────────────────────────────────────────────
        public static readonly DiscordRpcManager Instance = new();

        private const string CLIENT_ID = "1508628714408120451";

        // ── Campos internos ───────────────────────────────────────────────────
        private DiscordRpcClient? _client;
        private bool _initialized;
        private string _lastContext = "";
        private string _lastDetail = "";

        // Construtor privado (Singleton)
        private DiscordRpcManager() { }


        public void Initialize()
        {
            try
            {
                _client = new DiscordRpcClient(CLIENT_ID)
                {
                    Logger = new NullLogger()
                };

                // Eventos informativos — falhas são silenciosas para o usuário final
                _client.OnReady += (_, e) =>
                    Debug.WriteLine($"[Discord] RPC conectado como: {e.User.Username}");
                _client.OnError += (_, e) =>
                    Debug.WriteLine($"[Discord] Erro RPC: {e.Message}");
                _client.OnConnectionFailed += (_, _) =>
                    Debug.WriteLine("[Discord] Discord não está aberto; RPC desativado silenciosamente.");
                _client.OnClose += (_, e) =>
                    Debug.WriteLine($"[Discord] Conexão encerrada: {e.Reason}");

                _initialized = _client.Initialize();
                Debug.WriteLine($"[Discord] Inicializado: {_initialized}");

                if (_initialized)
                {
                    // Estado inicial ao abrir o app
                    UpdateState("menu");
                }
            }
            catch (Exception ex)
            {
                // Nunca deve travar o Doorpi. Discord pode não estar instalado.
                Debug.WriteLine($"[Discord] Falha ao inicializar (Discord pode não estar instalado): {ex.Message}");
                _initialized = false;
            }
        }


        private static IReadOnlyList<(string Id, string Name, string Url)>? _nativeAppsRef;


        public void RegisterNativeApps(IReadOnlyList<(string Id, string Name, string Url)> apps)
        {
            _nativeAppsRef = apps;
        }

        private static (bool IsNative, string Id, string Name) ResolveApp(string url)
        {
            if (string.IsNullOrWhiteSpace(url))
                return (false, "", "Mídia");

            if (_nativeAppsRef != null)
            {
                // 1. Casa por Id exato
                var byId = _nativeAppsRef.FirstOrDefault(a =>
                    string.Equals(a.Id, url, StringComparison.OrdinalIgnoreCase));
                if (byId != default)
                    return (true, byId.Id, byId.Name);

                // 2. Casa por host da URL
                if (Uri.TryCreate(url, UriKind.Absolute, out var incomingUri))
                {
                    var byHost = _nativeAppsRef.FirstOrDefault(a =>
                        Uri.TryCreate(a.Url, UriKind.Absolute, out var nativeUri) &&
                        incomingUri.Host.Contains(nativeUri.Host, StringComparison.OrdinalIgnoreCase));
                    if (byHost != default)
                        return (true, byHost.Id, byHost.Name);
                }

                // 3. Casa por conteúdo de string
                var byContains = _nativeAppsRef.FirstOrDefault(a =>
                    url.Contains(a.Id, StringComparison.OrdinalIgnoreCase) ||
                    url.Contains(a.Url, StringComparison.OrdinalIgnoreCase));
                if (byContains != default)
                    return (true, byContains.Id, byContains.Name);
            }

            if (System.IO.File.Exists(url))
                return (false, "", System.IO.Path.GetFileNameWithoutExtension(url));

            try { return (false, "", new Uri(url).Host.Replace("www.", "")); }
            catch { return (false, "", url); }
        }


        private static string ExtractContentTitle(string rawTitle, string appId, string appName)
        {
            if (string.IsNullOrWhiteSpace(rawTitle)) return "";

            // ── 1. Strip do sufixo da plataforma ─────────────────────────────────
            string stripped = appId.ToLowerInvariant() switch
            {
                "netflix" => StripPrefix(
                                 StripSuffix(rawTitle, " | Netflix", " - Netflix"),
                                 "Netflix: "),

                "youtube" => StripSuffix(rawTitle,
                                 " - YouTube Music", " - YouTube", " | YouTube"),

                "twitch" => StripSuffix(rawTitle, " - Twitch", " | Twitch"),
                "kick" => StripSuffix(
                              StripSuffix(rawTitle,
                                  " - Watch live on Kick",
                                  " | Kick",
                                  " - Kick"),
                              " Stream"),

                "disneyplus" => StripPrefix(
                                    StripSuffix(rawTitle,
                                        " | Disney+", " - Disney+",
                                        " | Disney Plus", " - Disney Plus"),
                                    "Disney+: ", "Disney Plus: "),

                "primevideo" => StripWatchPrefix(
                                    StripPrefix(
                                        StripSuffix(rawTitle,
                                            " - Watch Online | Prime Video",
                                            " | Amazon Prime Video", " - Amazon Prime Video",
                                            " | Prime Video", " - Prime Video"),
                                        "Prime Video: ", "Amazon Prime Video: ")),

                "appletv" => StripPrefix(
                                 StripSuffix(rawTitle,
                                     " \u2014 Apple TV+", " | Apple TV+", " - Apple TV+",
                                     " \u2014 Apple TV", " | Apple TV"),
                                 "Apple TV+: ", "Apple TV: "),

                "max" => StripPrefix(
                             StripSuffix(rawTitle,
                                 " | Max", " - Max", " | HBO Max", " - HBO Max"),
                             "Max: ", "HBO Max: "),

                "crunchyroll" => StripSuffix(rawTitle, " - Crunchyroll", " | Crunchyroll"),

                _ => StripSuffix(rawTitle, $" | {appName}", $" - {appName}")
            };

            stripped = stripped.Trim();

            // ── 2. Formatar por plataforma ────────────────────────────────────────
            return appId.ToLowerInvariant() switch
            {
                // Título do vídeo com truncate mais generoso
                "youtube" => TruncateTitle(stripped, maxLen: 55),

                // Só nome do streamer — nenhum parse necessário
                "twitch" or "kick" => stripped,

                // Todos os streamings passam pelo parser unificado
                _ => ParseStreamingTitle(stripped)
            };
        }

        private static string ParseStreamingTitle(string text, int maxTitleLen = 38)
        {
            // Season N [,/-/:] Episode M [-/:] Title
            var mFull = Regex.Match(text,
                @"^(.+?)\s*[-:]\s*Season\s+(\d+)\s*[,\-:]\s*Episode\s+(\d+)\s*[-:]\s*(.+)$",
                RegexOptions.IgnoreCase);
            if (mFull.Success)
            {
                string label = $"{mFull.Groups[1].Value.Trim()} · S{mFull.Groups[2].Value}E{mFull.Groups[3].Value}";
                string ep = TruncateTitle(mFull.Groups[4].Value.Trim(), maxTitleLen);
                return string.IsNullOrEmpty(ep) ? label : $"{label} — {ep}";
            }

            // Season N [,/-/:] Episode M  (sem título de episódio)
            var mNoTitle = Regex.Match(text,
                @"^(.+?)\s*[-:]\s*Season\s+(\d+)\s*[,\-:]\s*Episode\s+(\d+)$",
                RegexOptions.IgnoreCase);
            if (mNoTitle.Success)
                return $"{mNoTitle.Groups[1].Value.Trim()} · S{mNoTitle.Groups[2].Value}E{mNoTitle.Groups[3].Value}";

            // Show [-:] Season N  (só temporada, sem ep)
            var mSeason = Regex.Match(text,
                @"^(.+?)\s*[-:]\s*Season\s+(\d+)$",
                RegexOptions.IgnoreCase);
            if (mSeason.Success)
                return $"{mSeason.Groups[1].Value.Trim()} · S{mSeason.Groups[2].Value}";

            // Crunchyroll: Show - Ep. N - Title  (suporta Ep. 5.5)
            var mCrunchyroll = Regex.Match(text,
                @"^(.+?)\s+-\s+(Ep\.?\s*[\d]+(?:[.,]\d+)?)\s+-\s+(.+)$",
                RegexOptions.IgnoreCase);
            if (mCrunchyroll.Success)
            {
                string label = $"{mCrunchyroll.Groups[1].Value.Trim()} · {mCrunchyroll.Groups[2].Value.Trim()}";
                string epTitle = TruncateTitle(mCrunchyroll.Groups[3].Value.Trim(), maxTitleLen);
                return string.IsNullOrEmpty(epTitle) ? label : $"{label} — {epTitle}";
            }

            // Filme ou série sem info de ep → retorna como está
            return text;
        }
        private static string StripPrefix(string text, params string[] prefixes)
        {
            foreach (var prefix in prefixes)
                if (text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    return text[prefix.Length..];
            return text;
        }
        private static string TruncateTitle(string title, int maxLen = 38)
        {
            if (string.IsNullOrWhiteSpace(title)) return "";
            return title.Length > maxLen ? title[..maxLen].TrimEnd() + "…" : title;
        }

        private static string StripSuffix(string text, params string[] suffixes)
        {
            foreach (var suffix in suffixes)
                if (text.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                    return text[..^suffix.Length];
            return text;
        }

        private static string StripWatchPrefix(string text)
        {
            // Prime Video às vezes começa com "Watch " no title
            if (text.StartsWith("Watch ", StringComparison.OrdinalIgnoreCase))
                return text[6..].Trim();
            return text;
        }
        public void UpdateState(string context, string nameOrUrl = "", string title = "", string channelName = "")
        {
            if (!_initialized || _client == null) return;

            string key = $"{context}|{nameOrUrl}|{title}|{channelName}";
            if (key == _lastDetail && context == _lastContext) return;
            _lastContext = context;
            _lastDetail = key;

            try
            {
                var presence = new RichPresence()
                {
                   
                    Assets = new Assets()
                    {
                       
                        LargeImageKey = "doorpi_logo",

                     
                        LargeImageText = "Doorpi"


                    }
                };

                switch (context.ToLowerInvariant())
                {
                    case "game":
                        presence.Details = "Jogando";
                        presence.State = !string.IsNullOrWhiteSpace(nameOrUrl) ? nameOrUrl : "Um Jogo";
                        presence.Timestamps = Timestamps.Now;
                        break;

                    case "media":
                        var (isNative, appId, appName2) = ResolveApp(nameOrUrl);

                        if (isNative)
                        {
                            string cleanTitle = ExtractContentTitle(title, appId, appName2);

                            if (appId.Equals("youtube", StringComparison.OrdinalIgnoreCase)
                                && !string.IsNullOrWhiteSpace(channelName))
                                presence.Details = $"Assistindo YouTube — {TruncateForDiscord(channelName, 60)}";
                            else
                                presence.Details = $"Assistindo {appName2}";

                            // State: só o conteúdo, nunca o nome do serviço
                            presence.State = !string.IsNullOrWhiteSpace(cleanTitle)
                                ? TruncateForDiscord(cleanTitle)
                                : "…"; // ← era appName2, que repetia o serviço
                        }
                        else
                        {
                            presence.Details = "Doorpi";
                            presence.State = TruncateForDiscord(
                                !string.IsNullOrWhiteSpace(title) ? title : appName2);
                        }
                        presence.Timestamps = Timestamps.Now;
                        break;

                    case "menu":
                    default:
                        presence.Details = "No Menu Principal";
                        presence.State = "Navegando";
                        break;
                }

                _client.SetPresence(presence);
                Debug.WriteLine($"[Discord] Presença: {context} | {presence.Details} | {presence.State}");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Discord] Erro ao atualizar presença: {ex.Message}");
            }
        }

        public void Dispose()
        {
            try
            {
                if (_client != null)
                {
                    _client.ClearPresence();
                    _client.Dispose();
                }
            }
            catch { /* Ignora erros no encerramento */ }
            finally
            {
                _initialized = false;
            }
        }


        // ── Helpers Privados ──────────────────────────────────────────────────

        private static string TruncateForDiscord(string value, int maxLength = 100)
        {
            if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return value;
            return value[..maxLength].TrimEnd() + "…";
        }
    }
}
