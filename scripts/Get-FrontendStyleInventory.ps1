param([string]$OutputPath = '')

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$project = Join-Path $root 'Doorpi'
$generated = @{'Doorpi/wwwroot/style.css' = $true}
$scriptManifest = [IO.File]::ReadAllText((Join-Path $project 'Frontend/scripts/bundles.json')) | ConvertFrom-Json
foreach ($bundle in $scriptManifest.bundles) { $generated['Doorpi/' + $bundle.output] = $true }
$files = @(
    Get-ChildItem -LiteralPath (Join-Path $project 'wwwroot') -Recurse -File |
        Where-Object { $_.Extension -in '.js', '.html', '.css' }
    Get-ChildItem -LiteralPath (Join-Path $project 'TrailerExtension') -Recurse -File |
        Where-Object { $_.Extension -in '.js', '.html', '.css' }
    Get-ChildItem -LiteralPath (Join-Path $project 'Frontend/styles') -Recurse -File -Filter '*.css'
    Get-ChildItem -LiteralPath (Join-Path $project 'Frontend/injected-styles') -Recurse -File -Filter '*.css'
    Get-ChildItem -LiteralPath (Join-Path $project 'Frontend/scripts') -Recurse -File -Filter '*.js'
    Get-ChildItem -LiteralPath $project -File |
        Where-Object { $_.Extension -in '.cs', '.xaml' }
)
$patterns = [ordered]@{
    'style-element-creation' = 'createElement\(\s*[''"]style[''"]\s*\)'
    'embedded-style-tag' = '<style\b'
    'inline-style-attribute' = '\bstyle\s*='
    'style-property-write' = '\.style(?:\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*(?:=|\()'
    'cssom-write' = '\.(?:insertRule|deleteRule|replaceSync|addRule)\s*\('
    'stylesheet-link' = '<link\b[^>]*stylesheet'
    'native-xaml-style' = '<(?:Style|Setter|ControlTemplate|DataTemplate)\b'
    'build-time-css-reference' = '__doorpiCss\('
}
$inventory = @(
    foreach ($file in ($files | Sort-Object FullName -Unique)) {
        $relative = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
        $role = if ($generated.ContainsKey($relative)) { 'runtime-generated' }
            elseif ($relative.StartsWith('Doorpi/Frontend/')) { 'authored-source' }
            else { 'not-yet-migrated' }
        if ($file.Extension -eq '.css') {
            [ordered]@{ path = $relative; role = $role; line = 1; kind = 'stylesheet-file' }
            continue
        }
        $lines = [IO.File]::ReadAllLines($file.FullName)
        for ($i = 0; $i -lt $lines.Length; $i++) {
            foreach ($entry in $patterns.GetEnumerator()) {
                if ([regex]::IsMatch($lines[$i], $entry.Value)) {
                    [ordered]@{ path = $relative; role = $role; line = $i + 1; kind = $entry.Key }
                }
            }
        }
    }
)
$report = [ordered]@{
    schemaVersion = 1
    description = 'Review candidates, not a CSS parser. Includes HTML templates, JS writes, native host injection, intros, trailer extension and XAML. Line numbers change as extraction proceeds.'
    entries = $inventory
}
$json = $report | ConvertTo-Json -Depth 5
if ($OutputPath) {
    $destination = [IO.Path]::GetFullPath((Join-Path $root $OutputPath))
    if (!$destination.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The inventory output must stay inside the repository.'
    }
    [IO.File]::WriteAllText($destination, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    Write-Output "Frontend style inventory: $($inventory.Count) entries."
} else {
    $json
}
