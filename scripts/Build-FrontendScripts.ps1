param([switch]$Check)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../Doorpi'))
$sourceRoot = Join-Path $projectRoot 'Frontend'
$manifest = [IO.File]::ReadAllText((Join-Path $sourceRoot 'scripts/bundles.json')) | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1) { throw 'Unsupported frontend script manifest.' }
$encoding = New-Object Text.UTF8Encoding($false, $true)
$seenSources = @{}
$seenStyles = @{}
$outputs = @{}
$pending = @()
$macro = [regex]'__doorpiCss\("([^"\r\n]+)"\)'

function Resolve-Source([string]$relative, [string]$folder, [string]$extension) {
    $base = [IO.Path]::GetFullPath((Join-Path $sourceRoot $folder))
    $path = [IO.Path]::GetFullPath((Join-Path $sourceRoot $relative))
    if (!$path.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetExtension($path) -ne $extension) {
        throw "Invalid frontend source: $relative"
    }
    return $path
}

# Validate and expand everything before writing any bundle.
foreach ($bundle in $manifest.bundles) {
    $outputPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $bundle.output))
    if (!$outputPath.StartsWith((Join-Path $projectRoot 'wwwroot') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetExtension($outputPath) -ne '.js') { throw "Invalid bundle output: $($bundle.output)" }
    if ($outputs.ContainsKey($outputPath)) { throw "Duplicate bundle: $($bundle.output)" }
    $outputs[$outputPath] = $true
    if (@($bundle.sources).Count -eq 0) { throw "Empty bundle: $($bundle.output)" }
    $builder = New-Object Text.StringBuilder
    foreach ($source in $bundle.sources) {
        $path = Resolve-Source $source.path 'scripts' '.js'
        if ($seenSources.ContainsKey($path)) { throw "Duplicate script source: $($source.path)" }
        $seenSources[$path] = $true
        $text = [IO.File]::ReadAllText($path, $encoding)
        $declaredStyles = @{}
        foreach ($style in $source.styles) {
            $stylePath = Resolve-Source $style 'injected-styles' '.css'
            if ($declaredStyles.ContainsKey($stylePath)) { throw "Duplicate CSS declaration: $style" }
            $declaredStyles[$stylePath] = $true
        }
        $usedStyles = @{}
        $expanded = $macro.Replace($text, [Text.RegularExpressions.MatchEvaluator]{
            param($match)
            $stylePath = Resolve-Source $match.Groups[1].Value 'injected-styles' '.css'
            if (!$declaredStyles.ContainsKey($stylePath)) { throw "Undeclared injected CSS: $stylePath" }
            $usedStyles[$stylePath] = $true
            $seenStyles[$stylePath] = $true
            $css = [IO.File]::ReadAllText($stylePath, $encoding)
            # These files are literal template bodies, not executable templates.
            if ($css.Contains('`') -or $css.Contains('${') -or $css.Contains('\')) {
                throw "Injected CSS requires explicit escaping review: $stylePath"
            }
            return ([string][char]96) + $css + ([string][char]96)
        })
        if ($usedStyles.Count -ne $declaredStyles.Count) { throw "Unused CSS declaration in $($source.path)" }
        if ($expanded.Contains('__doorpiCss(')) { throw "Unresolved CSS macro in $($source.path)" }
        [void]$builder.Append($expanded)
    }
    $expected = $encoding.GetBytes($builder.ToString())
    $pending += [pscustomobject]@{ Path = $outputPath; Bytes = $expected }
}
if ($outputs.Count -eq 0) { throw 'No frontend bundles listed.' }
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'scripts') -Filter '*.js' -Recurse -File) {
    if (!$seenSources.ContainsKey($file.FullName)) { throw "Unlisted script source: $($file.FullName)" }
}
foreach ($file in Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'injected-styles') -Filter '*.css' -Recurse -File) {
    if (!$seenStyles.ContainsKey($file.FullName)) { throw "Unlisted injected CSS: $($file.FullName)" }
}
foreach ($item in $pending) {
    $matches = $false
    if (Test-Path -LiteralPath $item.Path) {
        $actual = [IO.File]::ReadAllBytes($item.Path)
        if ($actual.Length -eq $item.Bytes.Length) {
            $matches = $true
            for ($i = 0; $i -lt $actual.Length; $i++) {
                if ($actual[$i] -ne $item.Bytes[$i]) { $matches = $false; break }
            }
        }
    }
    if (!$matches) {
        if ($Check) { throw "Stale frontend bundle: $($item.Path). Run scripts/Build-FrontendScripts.ps1." }
        [IO.File]::WriteAllBytes($item.Path, $item.Bytes)
    }
}
Write-Output "Frontend JS: $($outputs.Count) bundles, $($seenSources.Count) source modules, $($seenStyles.Count) CSS blocks; verified."
