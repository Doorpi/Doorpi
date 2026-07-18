using System.IO;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Util.Store;

namespace Doorpi.ProfileSync;

public sealed class GoogleOAuthClient
{
    private static readonly string[] Scopes = { DriveService.Scope.DriveAppdata };
    private readonly string _credentialsPath;
    private readonly string _tokensRoot;

    public GoogleOAuthClient(string credentialsPath, string tokensRoot)
    {
        _credentialsPath = Path.GetFullPath(credentialsPath ?? throw new ArgumentNullException(nameof(credentialsPath)));
        _tokensRoot = Path.GetFullPath(tokensRoot ?? throw new ArgumentNullException(nameof(tokensRoot)));
    }

    public async Task<GoogleOAuthSession> ConnectAsync(
        string profileId,
        Action? onAuthorizationCompleted = null,
        CancellationToken cancellationToken = default)
    {
        ClientSecrets secrets = await LoadClientSecretsAsync(cancellationToken).ConfigureAwait(false);
        IDataStore store = CreateStore(profileId);
        string tokenKey = TokenKey(profileId);
        using var codeReceiver = new DoorpiGoogleCodeReceiver(onAuthorizationCompleted);
        UserCredential credential = await GoogleWebAuthorizationBroker.AuthorizeAsync(
            secrets,
            Scopes,
            tokenKey,
            cancellationToken,
            store,
            codeReceiver).ConfigureAwait(false);
        return new GoogleOAuthSession(credential);
    }

    public async Task<GoogleOAuthSession?> LoadExistingAsync(
        string profileId,
        bool refreshIfExpired,
        CancellationToken cancellationToken = default)
    {
        ClientSecrets secrets = await LoadClientSecretsAsync(cancellationToken).ConfigureAwait(false);
        IDataStore store = CreateStore(profileId);
        string tokenKey = TokenKey(profileId);
        TokenResponse? token = await store.GetAsync<TokenResponse>(tokenKey).ConfigureAwait(false);
        if (token == null) return null;

        var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
        {
            ClientSecrets = secrets,
            Scopes = Scopes,
            DataStore = store
        });
        var credential = new UserCredential(flow, tokenKey, token);

        if (refreshIfExpired && credential.Token.IsStale)
        {
            if (string.IsNullOrWhiteSpace(credential.Token.RefreshToken) ||
                !await credential.RefreshTokenAsync(cancellationToken).ConfigureAwait(false))
            {
                flow.Dispose();
                throw new TokenResponseException(new TokenErrorResponse
                {
                    Error = "invalid_grant",
                    ErrorDescription = "A autorização do Google expirou ou foi revogada."
                });
            }
        }

        return new GoogleOAuthSession(credential, flow);
    }

    public async Task<bool> HasStoredAuthorizationAsync(string profileId)
    {
        IDataStore store = CreateStore(profileId);
        return await store.GetAsync<TokenResponse>(TokenKey(profileId)).ConfigureAwait(false) != null;
    }

    public async Task DisconnectAsync(
        string profileId,
        bool revoke,
        CancellationToken cancellationToken = default)
    {
        IDataStore store = CreateStore(profileId);
        string tokenKey = TokenKey(profileId);
        try
        {
            if (revoke)
            {
                using GoogleOAuthSession? session = await LoadExistingAsync(
                    profileId,
                    refreshIfExpired: false,
                    cancellationToken).ConfigureAwait(false);
                if (session != null)
                    await session.Credential.RevokeTokenAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        finally
        {
            await store.DeleteAsync<TokenResponse>(tokenKey).ConfigureAwait(false);
        }
    }

    public async Task TransferAuthorizationAsync(string sourceProfileId, string targetProfileId)
    {
        if (string.Equals(sourceProfileId, targetProfileId, StringComparison.OrdinalIgnoreCase)) return;

        IDataStore sourceStore = CreateStore(sourceProfileId);
        TokenResponse? token = await sourceStore.GetAsync<TokenResponse>(TokenKey(sourceProfileId)).ConfigureAwait(false);
        if (token == null) return;

        IDataStore targetStore = CreateStore(targetProfileId);
        await targetStore.StoreAsync(TokenKey(targetProfileId), token).ConfigureAwait(false);
        await sourceStore.DeleteAsync<TokenResponse>(TokenKey(sourceProfileId)).ConfigureAwait(false);
    }

    private async Task<ClientSecrets> LoadClientSecretsAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_credentialsPath))
            throw new GoogleOAuthConfigurationException(
                $"Credenciais OAuth não encontradas em '{_credentialsPath}'.");

        await using FileStream stream = File.OpenRead(_credentialsPath);
        using JsonDocument document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken)
            .ConfigureAwait(false);
        JsonElement root = document.RootElement;
        if (root.TryGetProperty("installed", out JsonElement installed)) root = installed;

        string clientId = ReadString(root, "client_id");
        string clientSecret = ReadString(root, "client_secret");
        if (string.IsNullOrWhiteSpace(clientId) ||
            !clientId.EndsWith(".apps.googleusercontent.com", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(clientSecret))
        {
            throw new GoogleOAuthConfigurationException(
                "O arquivo OAuth deve conter um ClientId Desktop e um ClientSecret válidos.");
        }

        return new ClientSecrets { ClientId = clientId, ClientSecret = clientSecret };
    }

    private IDataStore CreateStore(string profileId)
    {
        string directory = Path.Combine(_tokensRoot, SafeProfileId(profileId));
        return new DpapiDataStore(directory);
    }

    private static string TokenKey(string profileId) => "doorpi-" + SafeProfileId(profileId);

    internal static string SafeProfileId(string profileId)
    {
        if (string.IsNullOrWhiteSpace(profileId))
            throw new ArgumentException("Profile ID is required.", nameof(profileId));
        string safe = new(profileId
            .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_')
            .Take(96)
            .ToArray());
        if (string.IsNullOrWhiteSpace(safe))
            throw new ArgumentException("Profile ID is invalid.", nameof(profileId));
        return safe;
    }

    private static string ReadString(JsonElement element, string name)
        => element.TryGetProperty(name, out JsonElement value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? ""
            : "";
}

public sealed class GoogleOAuthSession : IDisposable
{
    private readonly GoogleAuthorizationCodeFlow? _ownedFlow;

    internal GoogleOAuthSession(UserCredential credential, GoogleAuthorizationCodeFlow? ownedFlow = null)
    {
        Credential = credential;
        _ownedFlow = ownedFlow;
    }

    public UserCredential Credential { get; }

    public void Dispose() => _ownedFlow?.Dispose();
}
