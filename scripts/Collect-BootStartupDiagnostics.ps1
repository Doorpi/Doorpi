param(
    [Parameter(Mandatory = $true)][string]$InstallFolder,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$DataFolder = ''
)

$ErrorActionPreference = 'Stop'
if (!$DataFolder) {
    $appDataRoot = if ($env:DOORPI_APPDATA_ROOT) { $env:DOORPI_APPDATA_ROOT } else { [Environment]::GetFolderPath('LocalApplicationData') }
    $DataFolder = Join-Path $appDataRoot 'Doorpi/Data'
}
$dataPath = [IO.Path]::GetFullPath($DataFolder)
$installPath = [IO.Path]::GetFullPath($InstallFolder)
$output = [IO.Path]::GetFullPath($OutputDirectory)
if ((Test-Path -LiteralPath $output) -and @(Get-ChildItem -LiteralPath $output -Force).Count -gt 0) { throw 'Output directory must be new or empty.' }
[IO.Directory]::CreateDirectory($output) | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
function Write-Json([string]$name, $value) {
    [IO.File]::WriteAllText((Join-Path $output $name), (ConvertTo-Json -InputObject $value -Depth 12), $utf8)
}
function Read-Registry([string]$path, [string]$name) {
    try { return (Get-ItemProperty -LiteralPath $path -ErrorAction Stop).$name } catch { return $null }
}
$os = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$gpuRoot = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
$gpus = @(Get-ChildItem -LiteralPath $gpuRoot -ErrorAction SilentlyContinue | Where-Object PSChildName -Match '^\d{4}$' | ForEach-Object {
    $properties = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
    [pscustomobject]@{ description = $properties.DriverDesc; version = $properties.DriverVersion; provider = $properties.ProviderName }
})
$runtimeId = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
Write-Json 'machine.json' @{
    schemaVersion = 1; collectedAtUtc = [DateTimeOffset]::UtcNow.ToString('O')
    osBuild = Read-Registry $os 'CurrentBuild'; ubr = Read-Registry $os 'UBR'; displayVersion = Read-Registry $os 'DisplayVersion'
    edition = Read-Registry $os 'EditionID'
    cpu = Read-Registry 'HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0' 'ProcessorNameString'
    gpuDrivers = $gpus
    registeredRuntimeMachine = Read-Registry "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$runtimeId" 'pv'
    registeredRuntimeUser = Read-Registry "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$runtimeId" 'pv'
    notes = @('Registered runtime is not proof of the version loaded by the app.', 'GPU driver inventory is not proof of the adapter/backend selected by Chromium.')
}
$binaries = @(foreach ($name in @('Doorpi.exe', 'Doorpi.dll', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.Wpf.dll', 'Doorpi.runtimeconfig.json')) {
    $file = Join-Path $installPath $name
    if (Test-Path -LiteralPath $file) { [pscustomobject]@{ name = $name; bytes = (Get-Item -LiteralPath $file).Length; sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash } }
})
Write-Json 'binaries.json' $binaries

$records = @()
$invalidLines = 0
$traces = @(Get-ChildItem -LiteralPath (Join-Path $dataPath 'logs') -Filter 'boot-trace-*.jsonl' -File -ErrorAction SilentlyContinue)
foreach ($trace in $traces) {
    Copy-Item -LiteralPath $trace.FullName -Destination (Join-Path $output $trace.Name)
    foreach ($line in [IO.File]::ReadAllLines($trace.FullName)) {
        try {
            $record = $line | ConvertFrom-Json -ErrorAction Stop
            if ($record.schemaVersion -ne 1 -or !$record.runId -or !$record.utc) { throw 'Invalid trace record.' }
            $records += $record
        } catch { $invalidLines++ }
    }
}
$summary = @(foreach ($run in ($records | Group-Object runId)) {
    $ordered = @($run.Group | Sort-Object { [DateTimeOffset]::Parse($_.utc) })
    $entry = $ordered | Where-Object { $_.stage -eq 'startup-route' -and $_.detail -match 'shellEntry=True' } | Select-Object -First 1
    if (!$entry) { $entry = $ordered | Where-Object stage -eq 'startup-route' | Select-Object -First 1 }
    $ready = $ordered | Where-Object stage -eq 'boot-ui-interactive' | Select-Object -First 1
    $phases = @($ordered | Where-Object stage -eq 'startup-phase-end' | ForEach-Object {
        if ($_.detail -match 'phase=([^ ]+) durationMs=(\d+)') { [pscustomobject]@{ phase = $matches[1]; durationMs = [long]$matches[2]; pid = $_.pid } }
    })
    $metrics = @(if ($ready) {
        $ordered | Where-Object { $_.stage -eq 'startup-process-metrics' -and $_.pid -eq $ready.pid } |
            ForEach-Object { try { $_.detail | ConvertFrom-Json } catch { } }
        if ($entry -and $entry.pid -ne $ready.pid) {
            $parentSample = $ordered | Where-Object { $_.stage -eq 'startup-process-metrics' -and $_.pid -eq $entry.pid } | Select-Object -First 1
            if ($parentSample) { try { $parentSample.detail | ConvertFrom-Json } catch { } }
        }
    })
    $privateTotal = ($metrics | Group-Object processId | ForEach-Object { $_.Group | Select-Object -Last 1 } | Measure-Object privateBytes -Sum).Sum
    [pscustomobject]@{
        runId = $run.Name; route = $entry.detail; observedInteractive = [bool]$ready
        processStartToInteractiveMs = if ($entry -and $ready) { [Math]::Round(([DateTimeOffset]::Parse($ready.utc) - [DateTimeOffset]::Parse($entry.processStartUtc)).TotalMilliseconds) } else { $null }
        phases = $phases; processMetrics = $metrics; summedPrivateBytes = if ($metrics.Count -gt 0) { $privateTotal } else { $null }
        loadedRuntime = @($ordered | Where-Object stage -eq 'home-webview-loaded-runtime' | Select-Object -ExpandProperty detail)
        builds = @($ordered | Where-Object stage -eq 'startup-build' | Select-Object -ExpandProperty detail)
        rejectedFocusRequests = @($ordered | Where-Object { $_.stage -eq 'boot-focus-reclaim' -and $_.detail -match 'accepted=False' }).Count
        failures = @($ordered | Where-Object { $_.stage -match 'failed|timeout|error' } | Select-Object stage, pid, detail)
    }
})
Write-Json 'startup-summary.json' @{
    schemaVersion = 1; traceFiles = $traces.Count; invalidLines = $invalidLines; runs = $summary
    limitations = @('Interactive is an application milestone, not a GPU health certificate.', 'Private bytes are committed private memory; shared working sets and GPU memory are not summed as physical RAM.', 'No conclusion about cold boot can be drawn from manual app reopen alone.')
}
Write-Output "Collected local boot diagnostics in $output. No files were sent; no registry, driver, process or session state was changed."
