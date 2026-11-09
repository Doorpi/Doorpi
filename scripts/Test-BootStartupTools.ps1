param([string]$OutputRoot = 'artifacts/boot-tools-tests')
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixtures = [IO.Path]::GetFullPath((Join-Path $root $OutputRoot))
if (!$fixtures.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Fixtures must stay inside the workspace.' }
$id = [Guid]::NewGuid().ToString('N')
$folder = Join-Path $fixtures $id
$data = Join-Path $folder 'data'
$logs = Join-Path $data 'logs'
$install = Join-Path $folder 'install'
[IO.Directory]::CreateDirectory($logs) | Out-Null
[IO.Directory]::CreateDirectory($install) | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $install 'Doorpi.dll'), 'binary fixture', $utf8)
$events = @(
    @{ utc='2026-11-07T12:00:00.1Z'; stage='startup-route'; detail='shellEntry=True path=Direct source=experiment' },
    @{ utc='2026-11-07T12:00:00.3Z'; stage='startup-phase-end'; detail='phase=webview-controller durationMs=75' },
    @{ utc='2026-11-07T12:00:01Z'; stage='home-webview-loaded-runtime'; detail='157.test' },
    @{ utc='2026-11-07T12:00:01.5Z'; stage='boot-focus-reclaim'; detail='accepted=False' },
    @{ utc='2026-11-07T12:00:02Z'; stage='boot-ui-interactive'; detail='' },
    @{ utc='2026-11-07T12:00:02.1Z'; stage='startup-process-metrics'; detail='{"processId":1,"kind":"DoorpiMain","privateBytes":100}' },
    @{ utc='2026-11-07T12:00:02.2Z'; stage='startup-process-metrics'; detail='{"processId":2,"kind":"Gpu","privateBytes":200}' },
    @{ utc='2026-11-07T12:00:10Z'; stage='startup-process-metrics'; pid=3; detail='{"processId":3,"kind":"DoorpiMain","privateBytes":900}' }
)
$lines = @($events | ForEach-Object {
    $_.schemaVersion = 1; $_.runId = $id; if (!$_.pid) { $_.pid = 1 }; $_.processStartUtc = '2026-11-07T12:00:00Z'
    ConvertTo-Json -InputObject $_ -Compress
})
$trace = Join-Path $logs "boot-trace-$id-1.jsonl"
[IO.File]::WriteAllText($trace, ($lines -join "`n") + "`n{partial", $utf8)
& (Join-Path $PSScriptRoot 'Set-BootStartupExperiment.ps1') -Mode direct -DataFolder $data
$config = Join-Path $data 'boot-startup-experiment.json'
if (([IO.File]::ReadAllText($config) | ConvertFrom-Json).path -ne 'direct') { throw 'Direct selection failed.' }
& (Join-Path $PSScriptRoot 'Set-BootStartupExperiment.ps1') -Mode supervised -DataFolder $data
if (([IO.File]::ReadAllText($config) | ConvertFrom-Json).path -ne 'supervised') { throw 'Supervised selection failed.' }
$report = Join-Path $folder 'report'
& (Join-Path $PSScriptRoot 'Collect-BootStartupDiagnostics.ps1') -InstallFolder $install -DataFolder $data -OutputDirectory $report
$summary = [IO.File]::ReadAllText((Join-Path $report 'startup-summary.json')) | ConvertFrom-Json
if ($summary.invalidLines -ne 1 -or $summary.runs.Count -ne 1 -or !$summary.runs[0].observedInteractive -or
    $summary.runs[0].processStartToInteractiveMs -ne 2000 -or $summary.runs[0].summedPrivateBytes -ne 300 -or
    $summary.runs[0].phases[0].durationMs -ne 75 -or $summary.runs[0].rejectedFocusRequests -ne 1) { throw 'Invalid diagnostic summary.' }
& (Join-Path $PSScriptRoot 'Set-BootStartupExperiment.ps1') -Mode off -DataFolder $data
if (Test-Path -LiteralPath $config) { throw 'Off did not disable the experiment.' }
if (@(Get-ChildItem -LiteralPath $data -Filter '*.disabled-*.json').Count -ne 1) { throw 'Off did not preserve the previous configuration.' }
Write-Output 'PASS: experiment selection, restoration, binary hashing, partial trace, phase timing, focus and first-ready memory summary. Only workspace fixtures were written.'
