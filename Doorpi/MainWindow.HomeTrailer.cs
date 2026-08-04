using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace Doorpi
{
    public partial class MainWindow
    {
        private const string HomeTrailerExtensionName = "Doorpi Clean Trailer Player";
        private static string GetBundledHomeTrailerExtensionPath()
        {
            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "TrailerExtension");
        }

        private async Task<bool> InstallHomeTrailerExtensionAsync(
            CoreWebView2 core,
            string extensionPath)
        {
            try
            {
                HashSet<string> obsoleteManagedIds = ReadObsoleteManagedExtensionIds();
                var installedExtensions = await core.Profile.GetBrowserExtensionsAsync();
                foreach (CoreWebView2BrowserExtension installed in installedExtensions)
                {
                    bool belongsToDoorpiTrailer =
                        string.Equals(installed.Name, HomeTrailerExtensionName, StringComparison.OrdinalIgnoreCase) ||
                        obsoleteManagedIds.Contains(installed.Id);

                    if (!belongsToDoorpiTrailer)
                        continue;

                    await installed.RemoveAsync();
                    Debug.WriteLine($"[TrailerExtension] Extensão anterior removida: {installed.Name} ({installed.Id})");
                }

                string manifestPath = Path.Combine(extensionPath, "manifest.json");
                if (!File.Exists(manifestPath))
                {
                    Debug.WriteLine($"[TrailerExtension] Manifesto interno não encontrado: {manifestPath}");
                    return false;
                }

                CoreWebView2BrowserExtension extension =
                    await core.Profile.AddBrowserExtensionAsync(extensionPath);
                Debug.WriteLine($"[TrailerExtension] Extensão interna ativa: {extension.Name} ({extension.Id})");
                RemoveObsoleteManagedExtensionCache();
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[TrailerExtension] Falha ao carregar a extensão interna: {ex}");
                return false;
            }
        }

        private HashSet<string> ReadObsoleteManagedExtensionIds()
        {
            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                string? managedRoot = GetObsoleteManagedExtensionCachePath();
                if (managedRoot == null || !Directory.Exists(managedRoot))
                    return ids;

                foreach (string extensionFolder in Directory.EnumerateDirectories(managedRoot))
                {
                    string extensionId = Path.GetFileName(extensionFolder);
                    if (!string.IsNullOrWhiteSpace(extensionId))
                        ids.Add(extensionId);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[TrailerExtension] Não foi possível identificar o cache obsoleto: {ex.Message}");
            }

            return ids;
        }

        private string? GetObsoleteManagedExtensionCachePath()
        {
            string managedRoot = Path.GetFullPath(Path.Combine(dataFolder, "extensions", "_managed"));
            string dataRoot = Path.GetFullPath(dataFolder).TrimEnd(Path.DirectorySeparatorChar) +
                              Path.DirectorySeparatorChar;
            return managedRoot.StartsWith(dataRoot, StringComparison.OrdinalIgnoreCase)
                ? managedRoot
                : null;
        }

        private void RemoveObsoleteManagedExtensionCache()
        {
            try
            {
                string? managedRoot = GetObsoleteManagedExtensionCachePath();
                if (managedRoot != null && Directory.Exists(managedRoot))
                    Directory.Delete(managedRoot, recursive: true);

            }
            catch (Exception ex)
            {
                // A limpeza do cache obsoleto não deve impedir o player interno de funcionar.
                Debug.WriteLine($"[TrailerExtension] Não foi possível limpar o cache obsoleto: {ex.Message}");
            }
        }
    }
}
