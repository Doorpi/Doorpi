param(
    [Parameter(Mandatory = $true)]
    [string]$DoorpiVersion,

    [string]$UpdaterVersion = $DoorpiVersion,
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
    [switch]$SkipReleaseBuild,
    [string]$InnoSetupCompilerPath = ""
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$publishRoot = Join-Path $root "artifacts\publish"
$doorpiPublish = Join-Path $publishRoot "Doorpi"
$updaterPublish = Join-Path $publishRoot "Updater"
$installerRoot = Join-Path $root "artifacts\installer"
$issPath = Join-Path $root "installer\doorpi.iss"
$doorpiIcon = Join-Path $root "Doorpi\Assets\doorpi.ico"

function Resolve-ManifestPrivateKeyPath([string]$privateKeyPath) {
    if (![string]::IsNullOrWhiteSpace($privateKeyPath)) {
        return $privateKeyPath
    }

    $answer = Read-Host "Caminho da chave privada do manifesto"
    return $answer.Trim('"')
}

function Resolve-InnoSetupCompiler([string]$explicitPath) {
    if (![string]::IsNullOrWhiteSpace($explicitPath)) {
        if (!(Test-Path $explicitPath)) {
            throw "ISCC.exe nao encontrado em: $explicitPath"
        }
        return (Resolve-Path $explicitPath).Path
    }

    $cmd = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw "Inno Setup 6 nao encontrado. Instale o Inno Setup ou informe -InnoSetupCompilerPath."
}

function Invoke-Checked([string]$file, [string[]]$arguments) {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$file falhou com codigo $LASTEXITCODE."
    }
}

if (!$SkipReleaseBuild) {
    $ManifestPrivateKeyPath = Resolve-ManifestPrivateKeyPath $ManifestPrivateKeyPath

    $releaseParams = @{
        DoorpiVersion = $DoorpiVersion
        UpdaterVersion = $UpdaterVersion
        Configuration = $Configuration
        Runtime = $Runtime
        SelfContained = $SelfContained
        ManifestPrivateKeyPath = $ManifestPrivateKeyPath
        ExpiresInDays = $ExpiresInDays
    }

    if (![string]::IsNullOrWhiteSpace($BaseDownloadUrl)) {
        $releaseParams.BaseDownloadUrl = $BaseDownloadUrl
    }
    if ($ManifestVersion -gt 0) {
        $releaseParams.ManifestVersion = $ManifestVersion
    }
    if (![string]::IsNullOrWhiteSpace($ReleaseNotesPath)) {
        $releaseParams.ReleaseNotesPath = $ReleaseNotesPath
    }
    if ($ForceUpdate) {
        $releaseParams.ForceUpdate = $true
    }
    if ($AllowRollback) {
        $releaseParams.AllowRollback = $true
    }

    & (Join-Path $root "scripts\build-release.ps1") @releaseParams
    if ($LASTEXITCODE -ne 0) {
        throw "build-release.ps1 falhou com codigo $LASTEXITCODE."
    }
}

if (!(Test-Path (Join-Path $doorpiPublish "Doorpi.exe"))) {
    throw "Doorpi.exe nao encontrado em $doorpiPublish. Rode sem -SkipReleaseBuild primeiro."
}

if (!(Test-Path (Join-Path $updaterPublish "Updater.exe"))) {
    throw "Updater.exe nao encontrado em $updaterPublish. Rode sem -SkipReleaseBuild primeiro."
}

if (!(Test-Path $doorpiIcon)) {
    throw "Icone do Doorpi nao encontrado em $doorpiIcon."
}

New-Item -ItemType Directory -Force -Path $installerRoot | Out-Null

$iscc = Resolve-InnoSetupCompiler $InnoSetupCompilerPath
$isccArgs = @(
    "/DAppVersion=$DoorpiVersion",
    "/DDoorpiPublish=$doorpiPublish",
    "/DUpdaterPublish=$updaterPublish",
    "/DOutputDir=$installerRoot",
    "/DDoorpiIcon=$doorpiIcon",
    $issPath
)

Invoke-Checked $iscc $isccArgs

$installerPath = Join-Path $installerRoot "DoorpiSetup-$DoorpiVersion.exe"

Write-Host ""
Write-Host "Instalador gerado em: $installerPath"
Write-Host "Pasta de instalacao padrao: %LOCALAPPDATA%\Programs\Doorpi"
Write-Host "Dados do usuario:        %LOCALAPPDATA%\Doorpi\Data"
