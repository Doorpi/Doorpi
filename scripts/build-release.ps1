param(
    [Parameter(Mandatory = $true)]
    [string]$DoorpiVersion,

    [string]$UpdaterVersion = "0.1.0",
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [bool]$SelfContained = $true,
    [string]$BaseDownloadUrl = "",
    [string]$ManifestPrivateKeyPath = "",
    [long]$ManifestVersion = 0,
    [int]$ExpiresInDays = 14,
    [string]$ReleaseNotesPath = "",
    [switch]$ForceUpdate,
    [switch]$AllowRollback,
    [switch]$DevUpdatePolicy
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifacts = Join-Path $root "artifacts"
$publishRoot = Join-Path $artifacts "publish"
$releaseRoot = Join-Path $artifacts "release"
$doorpiPublish = Join-Path $publishRoot "Doorpi"
$updaterPublish = Join-Path $publishRoot "Updater"

if ([string]::IsNullOrWhiteSpace($BaseDownloadUrl)) {
    $BaseDownloadUrl = "https://github.com/Doorpi/Doorpi/releases/download/v$DoorpiVersion"
}

if ($ManifestVersion -le 0) {
    $ManifestVersion = [long](Get-Date -Format "yyyyMMddHHmm")
}

function Reset-Directory([string]$path) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $path | Out-Null
}

function Write-PackageManifest([string]$folder, [string]$component, [string]$version, [string]$entryPoint) {
    $manifest = [ordered]@{
        component = $component
        version = $version
        architecture = $Runtime
        entryPoint = $entryPoint
        createdAt = (Get-Date).ToUniversalTime().ToString("O")
    }

    $manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $folder "package-manifest.json") -Encoding UTF8
}

function New-ZipFromFolder([string]$folder, [string]$zipPath) {
    if (Test-Path $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }

    Compress-Archive -Path (Join-Path $folder "*") -DestinationPath $zipPath -Force
}

function Invoke-Checked([string]$file, [string[]]$arguments) {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$file falhou com codigo $LASTEXITCODE."
    }
}

function Add-SigningLine([System.Text.StringBuilder]$builder, [string]$name, [object]$value) {
    $text = if ($null -eq $value) { "" } else { [string]$value }
    $text = $text.Replace("`r", "\r").Replace("`n", "\n")
    [void]$builder.Append($name)
    [void]$builder.Append("=")
    [void]$builder.Append($text)
    [void]$builder.Append("`n")
}

function Get-ManifestUnixTime([object]$value) {
    $publishedAt = [DateTimeOffset]::Parse([string]$value)
    $epoch = [DateTimeOffset]::new(1970, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
    return [int64][Math]::Floor(($publishedAt.ToUniversalTime() - $epoch).TotalSeconds)
}

function Add-ReleaseSigningPayload([System.Text.StringBuilder]$builder, [string]$prefix, [object]$release) {
    Add-SigningLine $builder "$prefix.version" $release.version
    Add-SigningLine $builder "$prefix.downloadUrl" $release.downloadUrl
    Add-SigningLine $builder "$prefix.sha256" $release.sha256
    Add-SigningLine $builder "$prefix.sizeBytes" $release.sizeBytes
    Add-SigningLine $builder "$prefix.minUpdaterVersion" $release.minUpdaterVersion
    Add-SigningLine $builder "$prefix.forceUpdate" ($(if ($release.forceUpdate) { "true" } else { "false" }))
    Add-SigningLine $builder "$prefix.allowRollback" ($(if ($release.allowRollback) { "true" } else { "false" }))
}

function Get-ManifestSigningPayload([object]$manifest) {
    $builder = [System.Text.StringBuilder]::new()
    Add-SigningLine $builder "schemaVersion" $manifest.schemaVersion
    Add-SigningLine $builder "channel" $manifest.channel
    Add-SigningLine $builder "manifestVersion" $manifest.manifestVersion
    Add-SigningLine $builder "publishedAtUnix" (Get-ManifestUnixTime $manifest.publishedAt)
    Add-SigningLine $builder "expiresAtUnix" (Get-ManifestUnixTime $manifest.expiresAt)
    Add-SigningLine $builder "minimumSupportedManifestVersion" $manifest.minimumSupportedManifestVersion
    Add-ReleaseSigningPayload $builder "doorpi" $manifest.doorpi
    Add-ReleaseSigningPayload $builder "updater" $manifest.updater

    for ($i = 0; $i -lt $manifest.changelog.Count; $i++) {
        $entry = $manifest.changelog[$i]
        Add-SigningLine $builder "changelog.$i.version" $entry.version
        Add-SigningLine $builder "changelog.$i.title" $entry.title
        for ($itemIndex = 0; $itemIndex -lt $entry.items.Count; $itemIndex++) {
            Add-SigningLine $builder "changelog.$i.items.$itemIndex" $entry.items[$itemIndex]
        }
    }

    return $builder.ToString()
}

function Ensure-SigningKey([string]$privateKeyPath) {
    if ([string]::IsNullOrWhiteSpace($privateKeyPath)) {
        throw "Informe -ManifestPrivateKeyPath para gerar um release assinado."
    }

    if (!(Test-Path $privateKeyPath)) {
        throw "Chave privada nao encontrada: $privateKeyPath. Use scripts\create-signing-key.ps1 uma unica vez para cria-la."
    }

    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
    $rsa.PersistKeyInCsp = $false
    $rsa.FromXmlString((Get-Content $privateKeyPath -Raw))
    return $rsa
}

function Add-ManifestSignature([object]$manifest, [System.Security.Cryptography.RSA]$rsa) {
    $payload = Get-ManifestSigningPayload $manifest
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $signatureBytes = $rsa.SignData($bytes, [System.Security.Cryptography.CryptoConfig]::MapNameToOID("SHA256"))
    $publicXml = $rsa.ToXmlString($false)
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($publicXml)
    $keyHash = ([System.Security.Cryptography.SHA256]::Create()).ComputeHash($keyBytes)
    $keyId = ([BitConverter]::ToString($keyHash)).Replace("-", "").Substring(0, 16).ToLowerInvariant()

    $manifest["signature"] = [ordered]@{
        algorithm = "RSA-SHA256-PKCS1"
        keyId = $keyId
        value = [Convert]::ToBase64String($signatureBytes)
    }
}

Reset-Directory $publishRoot
Reset-Directory $releaseRoot

$selfContainedArg = if ($SelfContained) { "true" } else { "false" }
$devPolicyArgs = if ($DevUpdatePolicy) { @("-p:DoorpiAllowDevUpdatePolicy=true") } else { @() }

$doorpiPublishArgs = @(
    "publish", (Join-Path $root "Doorpi\Doorpi.csproj"),
    "-c", $Configuration,
    "-r", $Runtime,
    "--self-contained", $selfContainedArg,
    "-p:PublishSingleFile=false",
    "-p:Version=$DoorpiVersion",
    "-o", $doorpiPublish
) + $devPolicyArgs
Invoke-Checked "dotnet" $doorpiPublishArgs

$updaterPublishArgs = @(
    "publish", (Join-Path $root "DoorpiUpdater\DoorpiUpdater.csproj"),
    "-c", $Configuration,
    "-r", $Runtime,
    "--self-contained", $selfContainedArg,
    "-p:PublishSingleFile=false",
    "-p:Version=$UpdaterVersion",
    "-o", $updaterPublish
) + $devPolicyArgs
Invoke-Checked "dotnet" $updaterPublishArgs

$publishedData = Join-Path $doorpiPublish "Data"
if (Test-Path $publishedData) {
    Remove-Item -LiteralPath $publishedData -Recurse -Force
}

Write-PackageManifest $doorpiPublish "doorpi" $DoorpiVersion "Doorpi.exe"
Write-PackageManifest $updaterPublish "updater" $UpdaterVersion "Updater.exe"

$doorpiZip = Join-Path $releaseRoot "doorpi-$DoorpiVersion-$Runtime.zip"
$updaterZip = Join-Path $releaseRoot "updater-$UpdaterVersion-$Runtime.zip"

New-ZipFromFolder $doorpiPublish $doorpiZip
New-ZipFromFolder $updaterPublish $updaterZip

$doorpiHash = (Get-FileHash $doorpiZip -Algorithm SHA256).Hash.ToLowerInvariant()
$updaterHash = (Get-FileHash $updaterZip -Algorithm SHA256).Hash.ToLowerInvariant()
$doorpiSize = (Get-Item $doorpiZip).Length
$updaterSize = (Get-Item $updaterZip).Length
$publishedAt = (Get-Date).ToUniversalTime()
$expiresAt = $publishedAt.AddDays($ExpiresInDays)

$releaseTitle = "Doorpi $DoorpiVersion"
$releaseItems = @("Descreva as mudancas desta versao.")
if (![string]::IsNullOrWhiteSpace($ReleaseNotesPath) -and (Test-Path $ReleaseNotesPath)) {
    $notes = Get-Content $ReleaseNotesPath -Raw | ConvertFrom-Json
    if ($notes.title) {
        $releaseTitle = [string]$notes.title
    }
    if ($notes.items) {
        $releaseItems = @($notes.items | ForEach-Object { [string]$_ })
    }
}

$draftManifest = [ordered]@{
    schemaVersion = 1
    channel = "beta"
    manifestVersion = $ManifestVersion
    publishedAt = $publishedAt.ToString("O")
    expiresAt = $expiresAt.ToString("O")
    minimumSupportedManifestVersion = 1
    doorpi = [ordered]@{
        version = $DoorpiVersion
        downloadUrl = "$BaseDownloadUrl/doorpi-$DoorpiVersion-$Runtime.zip"
        sha256 = $doorpiHash
        sizeBytes = $doorpiSize
        minUpdaterVersion = $UpdaterVersion
        forceUpdate = [bool]$ForceUpdate
        allowRollback = [bool]$AllowRollback
    }
    updater = [ordered]@{
        version = $UpdaterVersion
        downloadUrl = "$BaseDownloadUrl/updater-$UpdaterVersion-$Runtime.zip"
        sha256 = $updaterHash
        sizeBytes = $updaterSize
        forceUpdate = [bool]$ForceUpdate
        allowRollback = [bool]$AllowRollback
    }
    changelog = @(
        [ordered]@{
            version = $DoorpiVersion
            title = $releaseTitle
            items = $releaseItems
        }
    )
}

$signingKey = Ensure-SigningKey $ManifestPrivateKeyPath
if ($null -ne $signingKey) {
    Add-ManifestSignature $draftManifest $signingKey
}

$manifestPath = Join-Path $releaseRoot "manifest-beta.json"
$draftManifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Host ""
Write-Host "Release gerado em: $releaseRoot"
Write-Host "Doorpi ZIP:  $doorpiZip"
Write-Host "Doorpi SHA:  $doorpiHash"
Write-Host "Updater ZIP: $updaterZip"
Write-Host "Updater SHA: $updaterHash"
Write-Host "Manifesto:   $manifestPath"
