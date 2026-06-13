param(
    [Parameter(Mandatory = $true)]
    [string]$DoorpiVersion,

    [string]$UpdaterVersion = "0.1.0",
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [bool]$SelfContained = $true,
    [string]$BaseDownloadUrl = "https://example.com/doorpi/updates"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifacts = Join-Path $root "artifacts"
$publishRoot = Join-Path $artifacts "publish"
$releaseRoot = Join-Path $artifacts "release"
$doorpiPublish = Join-Path $publishRoot "Doorpi"
$updaterPublish = Join-Path $publishRoot "Updater"

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

Reset-Directory $publishRoot
Reset-Directory $releaseRoot

$selfContainedArg = if ($SelfContained) { "true" } else { "false" }

Invoke-Checked "dotnet" @(
    "publish", (Join-Path $root "Doorpi\Doorpi.csproj"),
    "-c", $Configuration,
    "-r", $Runtime,
    "--self-contained", $selfContainedArg,
    "-p:PublishSingleFile=false",
    "-p:Version=$DoorpiVersion",
    "-o", $doorpiPublish
)

Invoke-Checked "dotnet" @(
    "publish", (Join-Path $root "DoorpiUpdater\DoorpiUpdater.csproj"),
    "-c", $Configuration,
    "-r", $Runtime,
    "--self-contained", $selfContainedArg,
    "-p:PublishSingleFile=false",
    "-p:Version=$UpdaterVersion",
    "-o", $updaterPublish
)

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

$draftManifest = [ordered]@{
    schemaVersion = 1
    channel = "beta"
    publishedAt = (Get-Date).ToUniversalTime().ToString("O")
    minimumSupportedManifestVersion = 1
    doorpi = [ordered]@{
        version = $DoorpiVersion
        downloadUrl = "$BaseDownloadUrl/doorpi-$DoorpiVersion-$Runtime.zip"
        sha256 = $doorpiHash
        sizeBytes = $doorpiSize
        minUpdaterVersion = $UpdaterVersion
        forceUpdate = $false
    }
    updater = [ordered]@{
        version = $UpdaterVersion
        downloadUrl = "$BaseDownloadUrl/updater-$UpdaterVersion-$Runtime.zip"
        sha256 = $updaterHash
        sizeBytes = $updaterSize
        forceUpdate = $false
    }
    changelog = @(
        [ordered]@{
            version = $DoorpiVersion
            title = "Doorpi $DoorpiVersion"
            items = @("Descreva as mudancas desta versao.")
        }
    )
}

$draftManifestPath = Join-Path $releaseRoot "manifest-beta.draft.json"
$draftManifest | ConvertTo-Json -Depth 10 | Set-Content -Path $draftManifestPath -Encoding UTF8

Write-Host ""
Write-Host "Release gerado em: $releaseRoot"
Write-Host "Doorpi ZIP:  $doorpiZip"
Write-Host "Doorpi SHA:  $doorpiHash"
Write-Host "Updater ZIP: $updaterZip"
Write-Host "Updater SHA: $updaterHash"
Write-Host "Manifesto:   $draftManifestPath"
