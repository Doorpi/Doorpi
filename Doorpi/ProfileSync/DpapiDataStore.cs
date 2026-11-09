using System.Collections.Concurrent;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Doorpi.Storage;
using Google.Apis.Json;
using Google.Apis.Util.Store;

namespace Doorpi.ProfileSync;

internal sealed class DpapiDataStore : IDataStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("Doorpi.GoogleOAuthTokens.v1");
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> DirectoryGates = new(StringComparer.OrdinalIgnoreCase);
    private sealed class TokenEnvelope
    {
        public int SchemaVersion { get; set; } = 1;
        public string EncryptedBase64 { get; set; } = "";
    }
    private readonly string _directory;
    private readonly FileDataStore _legacyStore;
    private readonly SemaphoreSlim _gate;

    public DpapiDataStore(string directory)
    {
        _directory = Path.GetFullPath(directory ?? throw new ArgumentNullException(nameof(directory)));
        // Google FileDataStore is read/delete-only here, solely for pre-DPAPI migration.
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
            WriteEncrypted(key, value);
        }
        finally { _gate.Release(); }
    }

    public async Task DeleteAsync<T>(string key)
    {
        ArgumentNullException.ThrowIfNull(key);
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            string path = GetDocumentPath(key);
            StateStorage.WriteBatch(new Dictionary<string, string?> { [path] = null, [path + ".bak"] = null });
            DeleteLegacyEncrypted(key);
            await _legacyStore.DeleteAsync<T>(key).ConfigureAwait(false);
        }
        finally { _gate.Release(); }
    }

    public async Task<T?> GetAsync<T>(string key)
    {
        ArgumentNullException.ThrowIfNull(key);
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            string path = GetDocumentPath(key);
            if (StateStorage.Exists(path) || StateStorage.Exists(path + ".bak"))
            {
                foreach (string candidate in new[] { path, path + ".bak" })
                {
                    if (!StateStorage.Exists(candidate)) continue;
                    try
                    {
                        TokenEnvelope envelope = JsonSerializer.Deserialize<TokenEnvelope>(StateStorage.ReadAllText(candidate))
                            ?? throw new InvalidDataException("Invalid OAuth token envelope.");
                        if (envelope.SchemaVersion != 1) throw new InvalidDataException("Unsupported OAuth token envelope.");
                        return Decrypt<T>(Convert.FromBase64String(envelope.EncryptedBase64));
                    }
                    catch (Exception ex) when (IsInvalidToken(ex))
                    {
                        if (candidate.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) || !StateStorage.Exists(path + ".bak")) throw;
                    }
                }
            }

            string legacyPath = GetLegacyEncryptedPath(key);
            foreach (string candidate in new[] { legacyPath, legacyPath + ".bak" })
            {
                if (!System.IO.File.Exists(candidate)) continue;
                try
                {
                    T? value = Decrypt<T>(await System.IO.File.ReadAllBytesAsync(candidate).ConfigureAwait(false));
                    if (value == null) return default;
                    WriteEncrypted(key, value);
                    return value;
                }
                catch (Exception ex) when (IsInvalidToken(ex))
                {
                    if (candidate.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(legacyPath + ".bak")) throw;
                }
            }

            T? legacyValue = await _legacyStore.GetAsync<T>(key).ConfigureAwait(false);
            if (legacyValue == null) return default;
            WriteEncrypted(key, legacyValue);
            return legacyValue;
        }
        finally { _gate.Release(); }
    }

    public async Task ClearAsync()
    {
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            var documents = StateStorage.EnumerateDocuments(_directory, "*.token.json");
            var writes = new Dictionary<string, string?>();
            foreach (string document in documents)
            {
                writes[document] = null;
                writes[document + ".bak"] = null;
            }
            StateStorage.WriteBatch(writes);
            if (Directory.Exists(_directory))
            {
                foreach (string path in Directory.EnumerateFiles(_directory, "*.dpapi")) System.IO.File.Delete(path);
                foreach (string path in Directory.EnumerateFiles(_directory, "*.dpapi.bak")) System.IO.File.Delete(path);
            }
            await _legacyStore.ClearAsync().ConfigureAwait(false);
        }
        finally { _gate.Release(); }
    }

    private void WriteEncrypted<T>(string key, T value)
    {
        byte[] plaintext = Encoding.UTF8.GetBytes(NewtonsoftJsonSerializer.Instance.Serialize(value));
        byte[] encrypted;
        try { encrypted = ProtectedData.Protect(plaintext, Entropy, DataProtectionScope.CurrentUser); }
        finally { CryptographicOperations.ZeroMemory(plaintext); }
        try
        {
            StateStorage.WriteAllText(GetDocumentPath(key), JsonSerializer.Serialize(new TokenEnvelope
            {
                EncryptedBase64 = Convert.ToBase64String(encrypted)
            }), keepBackup: true);
        }
        finally { CryptographicOperations.ZeroMemory(encrypted); }
    }

    private static T? Decrypt<T>(byte[] encrypted)
    {
        byte[] plaintext;
        try { plaintext = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser); }
        finally { CryptographicOperations.ZeroMemory(encrypted); }
        try { return NewtonsoftJsonSerializer.Instance.Deserialize<T>(Encoding.UTF8.GetString(plaintext)); }
        finally { CryptographicOperations.ZeroMemory(plaintext); }
    }

    private static bool IsInvalidToken(Exception ex)
        => ex is IOException or CryptographicException or FormatException or Newtonsoft.Json.JsonException or JsonException;

    private string GetDocumentPath(string key) => Path.ChangeExtension(GetLegacyEncryptedPath(key), ".token.json");

    private void DeleteLegacyEncrypted(string key)
    {
        string path = GetLegacyEncryptedPath(key);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
        if (System.IO.File.Exists(path + ".bak")) System.IO.File.Delete(path + ".bak");
    }

    private string GetLegacyEncryptedPath(string key)
    {
        string identity = $"Doorpi.GoogleOAuthTokens.v1:{key}";
        string name = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity))).ToLowerInvariant();
        return Path.Combine(_directory, name + ".dpapi");
    }
}

