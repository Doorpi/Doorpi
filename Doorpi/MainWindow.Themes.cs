using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Doorpi.Storage;
using Doorpi.Themes;

namespace Doorpi;

public partial class MainWindow
{
    private long _themeProfileGeneration;
    private static readonly JsonSerializerOptions ThemeMessageJson = new(JsonSerializerDefaults.Web);
    private string? _themeCatalogError;
    private string ThemePackagesRoot => Path.Combine(dataFolder, "theme-packages");
    private ThemeDescriptor[] InstalledThemes()
    {
        _themeCatalogError = null;
        ThemeDescriptor[] builtin;
        try { builtin = ThemeCatalog.Load(Path.Combine(DoorpiPaths.InstallFolder, "wwwroot")); }
        catch { builtin = new[] { ThemeCatalog.Default }; _themeCatalogError = "O catálogo padrão não pôde ser carregado. A restauração continua disponível."; }
        try { return builtin.Concat(ThemePackage.Catalog(ThemePackagesRoot)).ToArray(); }
        catch { _themeCatalogError = "Alguns pacotes não puderam ser consultados. Os arquivos foram preservados."; return builtin; }
    }
    private async Task<bool> TryHandleThemeSettingsAsync(string action, JsonElement root)
    {
        if (action is not ("requestThemeSettings" or "saveThemeSettings" or "resetThemeSettings" or "readThemePackage" or "importThemePackage")) return false;
        string profile = GetStr(root, "profileId"), request = GetStr(root, "requestId");
        long generation = _themeProfileGeneration;
        var store = new ThemePreferenceStore(dataFolder);
        bool IsCurrent() => generation == _themeProfileGeneration && !string.IsNullOrWhiteSpace(profile) && string.Equals(profile, currentUserId, StringComparison.OrdinalIgnoreCase);
        void Reply(bool ok, string? error = null, string? code = null, object? package = null, string? installedId = null)
        {
            ThemePreference? preference = null; DeviceThemePreference? device = null; string? deviceError = null;
            if (IsCurrent()) { try { preference = store.Read(profile); } catch (Exception ex) { error ??= ex.Message; ok = false; } }
            try { device = store.ReadDevice(); }
            catch (Exception ex)
            {
                deviceError = ex.Message;
                if (string.IsNullOrEmpty(profile) || GetStr(root, "part") == "login") { error ??= ex.Message; ok = false; }
            }
            var catalog = InstalledThemes();
            webView?.CoreWebView2?.PostWebMessageAsString(JsonSerializer.Serialize(new
            {
                type = "themeSettingsState",
                requestId = request,
                profileId = profile,
                ok,
                generation = _themeProfileGeneration.ToString(CultureInfo.InvariantCulture),
                revision = preference?.Revision.ToString(CultureInfo.InvariantCulture),
                profileRevision = preference?.ProfileRevision.ToString(CultureInfo.InvariantCulture),
                deviceRevision = device?.Revision.ToString(CultureInfo.InvariantCulture),
                themeId = preference?.ThemeId ?? "default",
                parts = preference?.Parts,
                deviceTheme = device?.ThemeId ?? "default",
                deviceError,
                error,
                errorCode = code,
                package,
                installedId,
                catalogError = _themeCatalogError,
                themes = catalog.Select(theme => new
                {
                    id = theme.Id,
                    name = theme.Name,
                    description = theme.Description,
                    manifest = theme.Manifest,
                    parts = theme.Parts ?? (theme.Id == "default" ? ThemePackage.Parts : new[] { "home", "side-panels" })
                })
            }, ThemeMessageJson));
        }
        try
        {
            if (action == "requestThemeSettings" && string.IsNullOrEmpty(profile)) { Reply(true); return true; }
            bool deviceRead = action == "readThemePackage" && string.IsNullOrEmpty(profile) && GetStr(root, "themeId") == store.ReadDevice().ThemeId;
            if (!IsCurrent() && !deviceRead) { Reply(false, "O perfil mudou. Abra a seleção novamente.", "profile-changed"); return true; }
            if (action == "importThemePackage")
            {
                var captured = store.Read(profile);
                string? selectedFile = await ShowDoorpiFileBrowserAsync(
                    "Adicionar pacote de temas", false, "Pacote Doorpi (*.doorpitheme)|*.doorpitheme", "themePackage");
                if (!IsCurrent()) { Reply(false, "O perfil mudou durante a seleção.", "profile-changed"); return true; }
                if (string.IsNullOrWhiteSpace(selectedFile)) { Reply(true); return true; }
                var staged = await Task.Run(() => ThemePackage.Stage(selectedFile));
                var latest = store.Read(profile);
                if (!IsCurrent() || latest.Revision != captured.Revision || latest.ProfileRevision != captured.ProfileRevision)
                { Reply(false, "O perfil mudou durante a importação; o pacote não foi instalado.", "conflict"); return true; }
                string id = ThemePackage.Commit(ThemePackagesRoot, staged);
                Reply(true, installedId: id); return true;
            }
            if (action == "readThemePackage")
            {
                string id = GetStr(root, "themeId");
                object package = await Task.Run(() => ThemePackage.Read(ThemePackagesRoot, id));
                if (!IsCurrent() && !(deviceRead && generation == _themeProfileGeneration)) { Reply(false, "A sessão mudou.", "profile-changed"); return true; }
                Reply(true, package: package); return true;
            }
            if (action == "resetThemeSettings")
            {
                if (GetStr(root, "generation") != generation.ToString(CultureInfo.InvariantCulture))
                { Reply(false, "A sessão do perfil mudou.", "profile-changed"); return true; }
                if (!long.TryParse(GetStr(root, "revision"), NumberStyles.None, CultureInfo.InvariantCulture, out long revision) ||
                    !long.TryParse(GetStr(root, "profileRevision"), NumberStyles.None, CultureInfo.InvariantCulture, out long profileRevision) ||
                    !long.TryParse(GetStr(root, "deviceRevision"), NumberStyles.None, CultureInfo.InvariantCulture, out long deviceRevision))
                    throw new InvalidDataException("As revisões dos temas não estão disponíveis.");
                store.ResetAll(profile, revision, profileRevision, deviceRevision);
            }
            if (action == "saveThemeSettings")
            {
                if (GetStr(root, "generation") != generation.ToString(CultureInfo.InvariantCulture))
                { Reply(false, "A sessão do perfil mudou.", "profile-changed"); return true; }
                string id = GetStr(root, "themeId"), part = GetStr(root, "part");
                if (string.IsNullOrEmpty(part)) part = "home";
                var requiredParts = part == "system" ? ThemePackage.Parts.Where(p => p != "login" && p != "profile").ToArray() : new[] { part };
                if ((part != "system" && !ThemePackage.Parts.Contains(part)) || (id != "default" && !InstalledThemes().Any(theme => theme.Id == id && requiredParts.All(p => (theme.Parts ?? new[] { "home", "side-panels" }).Contains(p)))))
                    throw new InvalidDataException("O tema não fornece esta área.");
                if (!long.TryParse(GetStr(root, "profileRevision"), NumberStyles.None, CultureInfo.InvariantCulture, out long profileRevision)) throw new InvalidDataException("Revisão do perfil ausente.");
                if (part == "login")
                {
                    if (!long.TryParse(GetStr(root, "deviceRevision"), NumberStyles.None, CultureInfo.InvariantCulture, out long revision)) throw new InvalidDataException("Revisão do dispositivo ausente.");
                    store.SaveDevice(profile, id, revision, profileRevision);
                }
                else
                {
                    if (!long.TryParse(GetStr(root, "revision"), NumberStyles.None, CultureInfo.InvariantCulture, out long revision)) throw new InvalidDataException("Revisão de preferências ausente.");
                    store.Save(profile, id, revision, profileRevision, part);
                }
            }
            Reply(true);
        }
        catch (StorageConflictException) { Reply(false, "As preferências mudaram. Tente novamente.", "conflict"); }
        catch (Exception ex) { Debug.WriteLine("[Themes] " + ex.Message); Reply(false, "Não foi possível carregar, instalar ou salvar o tema. Os dados foram preservados.", "storage-error"); }
        return true;
    }
}
