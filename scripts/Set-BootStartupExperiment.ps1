param(
    [Parameter(Mandatory = $true)][ValidateSet('direct', 'supervised', 'off')][string]$Mode,
    [string]$DataFolder = ''
)

$ErrorActionPreference = 'Stop'
if (!$DataFolder) {
    $appDataRoot = if ($env:DOORPI_APPDATA_ROOT) { $env:DOORPI_APPDATA_ROOT } else { [Environment]::GetFolderPath('LocalApplicationData') }
    $DataFolder = Join-Path $appDataRoot 'Doorpi/Data'
}
$folder = [IO.Path]::GetFullPath($DataFolder)
$file = Join-Path $folder 'boot-startup-experiment.json'
if (![IO.Path]::GetFullPath($file).StartsWith($folder.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid experiment path.' }

if ($Mode -eq 'off') {
    if (Test-Path -LiteralPath $file) {
        $backup = $file + '.disabled-' + [Guid]::NewGuid().ToString('N') + '.json'
        Move-Item -LiteralPath $file -Destination $backup
    }
    Write-Output 'Experiment disabled. The normal supervised startup remains selected. No registry or session settings changed.'
    return
}
[IO.Directory]::CreateDirectory($folder) | Out-Null
if (Test-Path -LiteralPath $file) {
    Copy-Item -LiteralPath $file -Destination ($file + '.previous-' + [Guid]::NewGuid().ToString('N') + '.json')
}
$content = @{ schemaVersion = 1; path = $Mode } | ConvertTo-Json
$temporary = Join-Path $folder ('boot-startup-experiment.' + [Guid]::NewGuid().ToString('N') + '.tmp')
[IO.File]::WriteAllText($temporary, $content, (New-Object Text.UTF8Encoding($false)))
Move-Item -LiteralPath $temporary -Destination $file -Force
Write-Output "Selected $Mode for the next immersive shell entry: $file"
Write-Output 'This does not enable immersive mode, restart Windows, change graphics flags, or modify the registry.'
