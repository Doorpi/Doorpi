param(
    [string]$DoorpiOldVersion = "0.0.1-test",
    [string]$DoorpiNewVersion = "0.0.2-test",
    [string]$UpdaterOldVersion = "0.1.0-test",
    [string]$UpdaterNewVersion = "0.1.1-test",
    [switch]$ForceUpdate
)

$ErrorActionPreference = "Stop"
trap {
    try { Stop-Transcript | Out-Null } catch { }
    throw
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$testRoot = Join-Path $root ".manual-update-test"
$installRoot = Join-Path $testRoot "Install"
$appDataRoot = Join-Path $testRoot "AppData"
$keysRoot = Join-Path $testRoot "keys"
$privateKeyPath = Join-Path $keysRoot "test-signing-key.xml"
$logPath = Join-Path $testRoot "test-full-update.log"

function Stop-TestProcessesInRoot([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path)) { return }

    $resolvedRoot = [System.IO.Path]::GetFullPath($path).TrimEnd('\') + '\'
    Get-CimInstance Win32_Process |
        Where-Object {
            ($_.Name -eq 'Doorpi.exe' -or $_.Name -eq 'Updater.exe') -and
            $_.ExecutablePath -and
            [System.IO.Path]::GetFullPath($_.ExecutablePath).StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)
        } |
        ForEach-Object {
            try {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
                Start-Sleep -Milliseconds 250
            } catch {
                Write-Warning "Nao foi possivel encerrar processo de teste PID $($_.ProcessId): $($_.Exception.Message)"
            }
        }
}

function Reset-Directory([string]$path) {
    try { Stop-Transcript | Out-Null } catch { }

    if (Test-Path $path) {
        for ($attempt = 1; $attempt -le 5; $attempt++) {
            try {
                Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
                break
            } catch {
                if ($attempt -eq 5) {
                    $quarantine = "$path.locked.$(Get-Date -Format 'yyyyMMddHHmmss')"
                    try {
                        Rename-Item -LiteralPath $path -NewName (Split-Path $quarantine -Leaf) -ErrorAction Stop
                        Write-Warning "A pasta antiga estava travada e foi movida para: $quarantine"
                        break
                    } catch {
                        throw "Nao foi possivel limpar '$path'. Feche qualquer Doorpi/Updater de teste aberto e tente de novo. Detalhe: $($_.Exception.Message)"
                    }
                }

                Start-Sleep -Milliseconds (350 * $attempt)
            }
        }
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
Write-Host "Modo: $(if ($ForceUpdate) { 'obrigatorio / forceUpdate' } else { 'opcional / sem forceUpdate' })"
Write-Host ""
Write-Host "1/6 Limpando ambiente de teste..."
Stop-TestProcessesInRoot $testRoot
Reset-Directory $testRoot
Start-Transcript -Path $logPath -Force | Out-Null
New-Item -ItemType Directory -Path $keysRoot | Out-Null

Write-Host "2/6 Publicando instalacao velha fake..."
Invoke-Checked "dotnet" @(
    "publish", (Join-Path $root "Doorpi\Doorpi.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=false",
    "-p:DoorpiAllowDevUpdatePolicy=true",
    "-p:Version=$DoorpiOldVersion",
    "-o", $installRoot
)

Invoke-Checked "dotnet" @(
    "publish", (Join-Path $root "DoorpiUpdater\DoorpiUpdater.csproj"),
    "-c", "Release",
    "-r", "win-x64",
    "--self-contained", "true",
    "-p:PublishSingleFile=false",
    "-p:DoorpiAllowDevUpdatePolicy=true",
    "-p:Version=$UpdaterOldVersion",
    "-o", (Join-Path $installRoot "Updater")
)

Write-Host "3/6 Criando dados do usuario que devem sobreviver..."
$userData = Join-Path $appDataRoot "Doorpi\Data"
New-Item -ItemType Directory -Force -Path $userData | Out-Null
Set-Content -Path (Join-Path $userData "update-test-user-data.txt") -Value "NAO APAGAR - dado do usuario preservado" -Encoding UTF8

Write-Host "4/6 Gerando pacotes novos assinados..."
$artifactsRoot = Join-Path $root "artifacts"
$releaseRoot = Join-Path $root "artifacts\release"
New-Item -ItemType Directory -Force -Path $artifactsRoot | Out-Null
$releaseUri = (New-Object System.Uri((Join-Path $artifactsRoot "release"))).AbsoluteUri

& (Join-Path $root "scripts\create-signing-key.ps1") -PrivateKeyPath $privateKeyPath

$buildReleaseArgs = @{
    DoorpiVersion = $DoorpiNewVersion
    UpdaterVersion = $UpdaterNewVersion
    BaseDownloadUrl = $releaseUri
    ManifestPrivateKeyPath = $privateKeyPath
    ManifestVersion = 1
    DevUpdatePolicy = $true
}
if ($ForceUpdate) {
    $buildReleaseArgs.ForceUpdate = $true
}

& (Join-Path $root "scripts\build-release.ps1") @buildReleaseArgs

if ($LASTEXITCODE -ne 0) {
    throw "build-release.ps1 falhou com codigo $LASTEXITCODE."
}

Write-Host "5/6 Configurando a instalacao fake para confiar no manifesto assinado..."
$manifestPath = Join-Path $releaseRoot "manifest-beta.json"
$publicKeyPath = [System.IO.Path]::ChangeExtension($privateKeyPath, ".public.xml")
$settingsPath = Join-Path $installRoot "update-settings.json"

$settings = [ordered]@{
    manifestUrl = (New-Object System.Uri((Resolve-Path $manifestPath).Path)).AbsoluteUri
    requireManifestSignature = $true
    manifestPublicKeyPath = $publicKeyPath
}
$settings | ConvertTo-Json -Depth 5 | Set-Content -Path $settingsPath -Encoding UTF8
if (!(Test-Path $settingsPath)) {
    throw "Falha ao criar update-settings.json em $settingsPath"
}

Write-Host "6/6 Abrindo o Doorpi velho."
Write-Host ""
Write-Host "O que voce deve ver:"
Write-Host "- Doorpi abre"
if ($ForceUpdate) {
    Write-Host "- tela fullscreen de update aparece automaticamente"
    Write-Host "- Updater tambem aparece fullscreen"
    Write-Host "- Doorpi reabre no final"
} else {
    Write-Host "- Doorpi NAO deve atualizar sozinho"
    Write-Host "- depois da intro, deve aparecer o popup de atualizacao"
    Write-Host "- clique em Depois para confirmar que o badge fica na Home"
    Write-Host "- clique no badge Atualizacao para abrir o popup de novo"
    Write-Host "- clique em Atualizar agora para aplicar Updater + Doorpi"
}
Write-Host ""
Write-Host "Pasta da instalacao fake:"
Write-Host $installRoot
Write-Host ""
Write-Host "Dado preservado para conferir depois:"
Write-Host (Join-Path $userData "update-test-user-data.txt")
Write-Host ""

$doorpiExe = Join-Path $installRoot "Doorpi.exe"
if (!(Test-Path $doorpiExe)) {
    throw "Doorpi.exe de teste nao encontrado: $doorpiExe"
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $doorpiExe
$startInfo.WorkingDirectory = $installRoot
$startInfo.UseShellExecute = $false
$startInfo.EnvironmentVariables["DOORPI_APPDATA_ROOT"] = $appDataRoot

$process = [System.Diagnostics.Process]::Start($startInfo)
if ($null -eq $process) {
    throw "Nao foi possivel iniciar o Doorpi de teste."
}

Start-Sleep -Seconds 5
if ($process.HasExited) {
    throw "Doorpi de teste fechou logo apos abrir. ExitCode: $($process.ExitCode). Log: $logPath"
}

Write-Host "Teste iniciado. Pode fechar esta janela depois que o Doorpi abrir."
Write-Host "PID do Doorpi de teste: $($process.Id)"
Write-Host "Log do teste: $logPath"
Read-Host "Pressione Enter para fechar"
Stop-Transcript | Out-Null
