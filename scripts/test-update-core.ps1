$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$work = Join-Path $root ".build_check\UpdateCoreCheck"
$app = Join-Path $work "App"
$packageSource = Join-Path $work "PackageSource"
$zip = Join-Path $work "doorpi-test.zip"
$staging = Join-Path $work "Staging"
$backup = Join-Path $work "Backup"
$tester = Join-Path $work "Tester"

if (Test-Path $work) {
    Remove-Item -LiteralPath $work -Recurse -Force
}

New-Item -ItemType Directory -Path $app, $packageSource | Out-Null
New-Item -ItemType Directory -Path (Join-Path $app "Data"), (Join-Path $app "Updater") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageSource "Data"), (Join-Path $packageSource "Updater"), (Join-Path $packageSource "wwwroot") | Out-Null

Set-Content -Path (Join-Path $app "Doorpi.exe") -Value "old-doorpi" -Encoding UTF8
Set-Content -Path (Join-Path $app "Data\user.json") -Value "keep-user-data" -Encoding UTF8
Set-Content -Path (Join-Path $app "Updater\Updater.exe") -Value "keep-updater" -Encoding UTF8

Set-Content -Path (Join-Path $packageSource "Doorpi.exe") -Value "new-doorpi" -Encoding UTF8
Set-Content -Path (Join-Path $packageSource "Data\user.json") -Value "bad-package-data" -Encoding UTF8
Set-Content -Path (Join-Path $packageSource "Updater\Updater.exe") -Value "bad-package-updater" -Encoding UTF8
Set-Content -Path (Join-Path $packageSource "wwwroot\index.html") -Value "new-ui" -Encoding UTF8

@{
    component = "doorpi"
    version = "9.9.9-test"
    architecture = "win-x64"
    entryPoint = "Doorpi.exe"
    createdAt = (Get-Date).ToUniversalTime().ToString("O")
} | ConvertTo-Json | Set-Content -Path (Join-Path $packageSource "package-manifest.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $packageSource "*") -DestinationPath $zip -Force

dotnet new console -n Tester -o $tester --force | Out-Null
$testerProject = Join-Path $tester "Tester.csproj"
(Get-Content $testerProject) -replace "<TargetFramework>.*?</TargetFramework>", "<TargetFramework>net8.0-windows</TargetFramework>" | Set-Content $testerProject -Encoding UTF8
dotnet add $testerProject reference (Join-Path $root "Doorpi.UpdateCore\Doorpi.UpdateCore.csproj") | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "dotnet add reference falhou com codigo $LASTEXITCODE."
}

@'
using Doorpi.UpdateCore;
using System.Security.Cryptography;
using System.Text;

string work = args[0];
string zip = Path.Combine(work, "doorpi-test.zip");
string app = Path.Combine(work, "App");
string staging = Path.Combine(work, "Staging");
string backup = Path.Combine(work, "Backup");

PackageExtractor.ExtractAndValidate(zip, staging, "doorpi", "9.9.9-test");
new ComponentInstaller(new[] { "Data", "Updater" }).ApplyFromStaging(staging, app, backup);

string doorpi = File.ReadAllText(Path.Combine(app, "Doorpi.exe")).Trim();
string data = File.ReadAllText(Path.Combine(app, "Data", "user.json")).Trim();
string updater = File.ReadAllText(Path.Combine(app, "Updater", "Updater.exe")).Trim();
string ui = File.ReadAllText(Path.Combine(app, "wwwroot", "index.html")).Trim();

if (doorpi != "new-doorpi") throw new Exception("Doorpi.exe nao foi atualizado.");
if (data != "keep-user-data") throw new Exception("Data foi sobrescrito.");
if (updater != "keep-updater") throw new Exception("Updater foi sobrescrito.");
if (ui != "new-ui") throw new Exception("wwwroot nao foi atualizado.");

using RSA rsa = RSA.Create(3072);
var manifest = new UpdateManifest
{
    SchemaVersion = 1,
    Channel = "beta",
    PublishedAt = DateTimeOffset.FromUnixTimeSeconds(1234567890),
    MinimumSupportedManifestVersion = 1,
    Doorpi = new ComponentRelease
    {
        Version = "9.9.9-test",
        DownloadUrl = "file:///doorpi.zip",
        Sha256 = "abc",
        SizeBytes = 123,
        MinUpdaterVersion = "1.0.0",
        ForceUpdate = true
    },
    Updater = new ComponentRelease
    {
        Version = "1.0.1-test",
        DownloadUrl = "file:///updater.zip",
        Sha256 = "def",
        SizeBytes = 456,
        ForceUpdate = true
    },
    Changelog =
    {
        new ChangelogEntry
        {
            Version = "9.9.9-test",
            Title = "Teste",
            Items = { "Assinatura validada" }
        }
    }
};

byte[] payload = Encoding.UTF8.GetBytes(ManifestSignatureVerifier.BuildSigningPayload(manifest));
manifest.Signature = new ManifestSignature
{
    Algorithm = ManifestSignatureVerifier.SupportedAlgorithm,
    KeyId = "test",
    Value = Convert.ToBase64String(rsa.SignData(payload, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1))
};

string publicKey = rsa.ToXmlString(false);
ManifestSignatureVerifier.Verify(manifest, publicKey);

manifest.Doorpi.Version = "9.9.10-test";
try
{
    ManifestSignatureVerifier.Verify(manifest, publicKey);
    throw new Exception("Manifesto adulterado foi aceito.");
}
catch (InvalidDataException)
{
}

Console.WriteLine("Update core simulation passed.");
'@ | Set-Content -Path (Join-Path $tester "Program.cs") -Encoding UTF8

dotnet run --project $testerProject -- $work
if ($LASTEXITCODE -ne 0) {
    throw "dotnet run falhou com codigo $LASTEXITCODE."
}
