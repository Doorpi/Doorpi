using System.Collections.Concurrent;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Google.Apis.Json;
using Google.Apis.Util.Store;

namespace Doorpi.ProfileSync;

internal sealed class DpapiDataStore : IDataStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Doorpi.GoogleOAuthTokens.v1");
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> DirectoryGates =
        new(StringComparer.OrdinalIgnoreCase);

    private readonly string _directory;
    private readonly FileDataStore _legacyStore;
    private readonly SemaphoreSlim _gate;

    public DpapiDataStore(string directory)
    {
        _directory = Path.GetFullPath(directory ?? throw new ArgumentNullException(nameof(directory)));
        Directory.CreateDirectory(_directory);
        _legacyStore = new FileDataStore(_directory, fullPath: true);
        _gate = DirectoryGates.GetOrAdd(_directory, _ => new SemaphoreSlim(1, 1));
    }

    public async Task StoreAsync<T>(string key, T value)
    {
        ArgumentNullException.ThrowIfNull(key);
        ArgumentNullException.ThrowIfNull(value);

        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            await WriteEncryptedAsync(key, value).ConfigureAwait(false);
            await _legacyStore.DeleteAsync<T>(key).ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task DeleteAsync<T>(string key)
    {
        ArgumentNullException.ThrowIfNull(key);

        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            string path = GetEncryptedPath(key);
            if (File.Exists(path)) File.Delete(path);
            if (File.Exists(path + ".bak")) File.Delete(path + ".bak");
            await _legacyStore.DeleteAsync<T>(key).ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        ArgumentNullException.ThrowIfNull(key);

        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            string encryptedPath = GetEncryptedPath(key);
            string encryptedBackupPath = encryptedPath + ".bak";
            if (File.Exists(encryptedPath) || File.Exists(encryptedBackupPath))
            {
                try
                {
                    string candidate = File.Exists(encryptedPath) ? encryptedPath : encryptedBackupPath;
                    return await ReadEncryptedAsync<T>(candidate).ConfigureAwait(false);
                }
                catch (Exception ex) when (ex is IOException or
                                                CryptographicException or
                                                FormatException or
                                                Newtonsoft.Json.JsonException)
                {
                    if (File.Exists(encryptedPath) && File.Exists(encryptedBackupPath))
                        return await ReadEncryptedAsync<T>(encryptedBackupPath).ConfigureAwait(false);
                    throw;
                }
            }

            T? legacyValue = await _legacyStore.GetAsync<T>(key).ConfigureAwait(false);
            if (legacyValue == null) return default;

            await WriteEncryptedAsync(key, legacyValue).ConfigureAwait(false);
            await _legacyStore.DeleteAsync<T>(key).ConfigureAwait(false);
            return legacyValue;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task ClearAsync()
    {
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            foreach (string path in Directory.EnumerateFiles(_directory, "*.dpapi"))
                File.Delete(path);
            foreach (string path in Directory.EnumerateFiles(_directory, "*.dpapi.bak"))
                File.Delete(path);
            await _legacyStore.ClearAsync().ConfigureAwait(false);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task WriteEncryptedAsync<T>(string key, T value)
    {
        string json = NewtonsoftJsonSerializer.Instance.Serialize(value);
        byte[] plaintext = Encoding.UTF8.GetBytes(json);
        byte[] encrypted;
        try
        {
            encrypted = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }

        string path = GetEncryptedPath(key);
        string temporaryPath = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(
                             temporaryPath,
                             FileMode.CreateNew,
                             FileAccess.Write,
                             FileShare.None,
                             64 * 1024,
                             FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await stream.WriteAsync(encrypted).ConfigureAwait(false);
                await stream.FlushAsync().ConfigureAwait(false);
                stream.Flush(flushToDisk: true);
            }

            if (File.Exists(path))
            {
                try
                {
                    File.Replace(temporaryPath, path, path + ".bak", ignoreMetadataErrors: true);
                }
                catch (PlatformNotSupportedException)
                {
                    File.Move(temporaryPath, path, overwrite: true);
                }
            }
            else
            {
                File.Move(temporaryPath, path);
                File.Copy(path, path + ".bak", overwrite: true);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(encrypted);
            if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
        }
    }

    private static async Task<T?> ReadEncryptedAsync<T>(string path)
    {
        byte[] encrypted = await File.ReadAllBytesAsync(path).ConfigureAwait(false);
        byte[] plaintext;
        try
        {
            plaintext = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(encrypted);
        }

        try
        {
            string json = Encoding.UTF8.GetString(plaintext);
            return NewtonsoftJsonSerializer.Instance.Deserialize<T>(json);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    private string GetEncryptedPath(string key)
    {
        string identity = $"Doorpi.GoogleOAuthTokens.v1:{key}";
        string fileName = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity))).ToLowerInvariant();
        return Path.Combine(_directory, fileName + ".dpapi");
    }
}
