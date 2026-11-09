param([switch]$Check)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../Doorpi'))
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot 'Frontend/styles'))
$manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'bundle.json') -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or $manifest.output -ne 'wwwroot/style.css') {
    throw 'Unsupported frontend stylesheet manifest.'
}

$seen = @{}
$stream = New-Object IO.MemoryStream
try {
    foreach ($source in $manifest.sources) {
        $path = [IO.Path]::GetFullPath((Join-Path $sourceRoot $source.path))
        if (!$path.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
            [IO.Path]::GetExtension($path) -ne '.css') {
            throw "Invalid stylesheet path: $($source.path)"
        }
        if ($seen.ContainsKey($path)) { throw "Duplicate stylesheet: $($source.path)" }
        $seen[$path] = $true
        $bytes = [IO.File]::ReadAllBytes($path)
        $stream.Write($bytes, 0, $bytes.Length)
    }
    if ($seen.Count -eq 0) { throw 'No stylesheet modules listed.' }
    foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Filter '*.css' -Recurse -File) {
        if (!$seen.ContainsKey($file.FullName)) { throw "Unlisted stylesheet: $($file.FullName)" }
    }
    $expected = $stream.ToArray()
} finally {
    $stream.Dispose()
}

$outputPath = Join-Path $projectRoot $manifest.output
$matches = $false
if (Test-Path -LiteralPath $outputPath) {
    $actual = [IO.File]::ReadAllBytes($outputPath)
    if ($actual.Length -eq $expected.Length) {
        $matches = $true
        for ($i = 0; $i -lt $actual.Length; $i++) {
            if ($actual[$i] -ne $expected[$i]) { $matches = $false; break }
        }
    }
}
if (!$matches) {
    if ($Check) { throw 'style.css differs from its modules. Run scripts/Build-FrontendStyles.ps1.' }
    [IO.File]::WriteAllBytes($outputPath, $expected)
}
Write-Output "Frontend CSS: $($seen.Count) modules, $($expected.Length) bytes; bundle verified."
