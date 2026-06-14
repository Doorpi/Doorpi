param(
    [string]$DoorpiOldVersion = "0.0.1-test",
    [string]$DoorpiNewVersion = "0.0.2-test",
    [string]$UpdaterOldVersion = "0.1.0-test",
    [string]$UpdaterNewVersion = "0.1.1-test"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$testRoot = Join-Path $root ".manual-update-test"
$installRoot = Join-Path $testRoot "Install"
$appDataRoot = Join-Path $testRoot "AppData"
$keysRoot = Join-Path $testRoot "keys"
$privateKeyPath = Join-Path $keysRoot "manifest.private.xml"

function Reset-Directory([string]$path) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $path | Out-Null
}

function Invoke-Checked([string]$file, [string[]]$arguments) {
    & $file @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$file falhou com codigo $LASTEXITCODE."
    }
}

Write-Host ""
Write-Host "Doorpi - teste completo de update"
Write-Host "================================="
Write-Host ""
Write-Host "1/6 Limpando ambiente de teste..."
Reset-Directory $testRoot
New-Item -ItemType Directory -Path $keysRoot | Out-Null

Write-Host "2/6 Publicando instalacao velha fake..."
Invoke-Checked "dotnet" @(
    "publish", (Join-Path $root "Doorpi\Doorpi.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=false",
    "-p:Version=$DoorpiOldVersion",
    "-o", $installRoot
)

Invoke-Checked "dotnet" @(
    "publish", (Join-Path $root "DoorpiUpdater\DoorpiUpdater.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=false",
    "-p:Version=$UpdaterOldVersion",
    "-o", (Join-Path $installRoot "Updater")
)

Write-Host "3/6 Criando dados do usuario que devem sobreviver..."
$userData = Join-Path $appDataRoot "Doorpi\Data"
New-Item -ItemType Directory -Force -Path $userData | Out-Null
Set-Content -Path (Join-Path $userData "update-test-user-data.txt") -Value "NAO APAGAR - dado do usuario preservado" -Encoding UTF8

Write-Host "4/6 Gerando pacotes novos assinados e obrigatorios..."
$artifactsRoot = Join-Path $root "artifacts"
$releaseRoot = Join-Path $root "artifacts\release"
New-Item -ItemType Directory -Force -Path $artifactsRoot | Out-Null
$releaseUri = (New-Object System.Uri((Join-Path $artifactsRoot "release"))).AbsoluteUri

& (Join-Path $root "scripts\build-release.ps1") `
    -DoorpiVersion $DoorpiNewVersion `
    -UpdaterVersion $UpdaterNewVersion `
    -BaseDownloadUrl $releaseUri `
    -ManifestPrivateKeyPath $privateKeyPath `
    -GenerateManifestKeyIfMissing `
    -ForceUpdate

if ($LASTEXITCODE -ne 0) {
    throw "build-release.ps1 falhou com codigo $LASTEXITCODE."
}

Write-Host "5/6 Configurando a instalacao fake para confiar no manifesto assinado..."
$manifestPath = Join-Path $releaseRoot "manifest-beta.draft.json"
$publicKeyPath = [System.IO.Path]::ChangeExtension($privateKeyPath, ".public.xml")

$settings = [ordered]@{
    manifestUrl = ([System.Uri](Resolve-Path $manifestPath)).AbsoluteUri
    requireManifestSignature = $true
    manifestPublicKeyPath = $publicKeyPath
}
$settings | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $installRoot "update-settings.json") -Encoding UTF8

Write-Host "6/6 Abrindo o Doorpi velho. Ele deve atualizar Updater + Doorpi sozinho."
Write-Host ""
Write-Host "O que voce deve ver:"
Write-Host "- Doorpi abre"
Write-Host "- tela fullscreen de update aparece"
Write-Host "- Updater tambem aparece fullscreen"
Write-Host "- Doorpi reabre no final"
Write-Host ""
Write-Host "Pasta da instalacao fake:"
Write-Host $installRoot
Write-Host ""
Write-Host "Dado preservado para conferir depois:"
Write-Host (Join-Path $userData "update-test-user-data.txt")
Write-Host ""

$env:DOORPI_APPDATA_ROOT = $appDataRoot
Start-Process -FilePath (Join-Path $installRoot "Doorpi.exe") -WorkingDirectory $installRoot

Write-Host "Teste iniciado. Pode fechar esta janela depois que o Doorpi abrir."
Read-Host "Pressione Enter para fechar"
