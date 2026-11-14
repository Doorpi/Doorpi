param([switch]$Check)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../Doorpi'))
$encoding = New-Object Text.UTF8Encoding($false, $true)
$metadataPath = Join-Path $projectRoot 'Frontend/themes/contract.json'
$defaultsPath = Join-Path $projectRoot 'Frontend/styles/foundation/015-theme-tokens.css'
$metadata = [IO.File]::ReadAllText($metadataPath, $encoding) | ConvertFrom-Json
if ($metadata.schemaVersion -ne 1 -or $metadata.apiVersion -ne 1) { throw 'Unsupported theme contract source.' }
$defaults = @{}
foreach ($match in [regex]::Matches([IO.File]::ReadAllText($defaultsPath, $encoding), '(?m)^\s*(--doorpi-[a-z0-9-]+)\s*:\s*([^;]+);')) {
    $name = $match.Groups[1].Value
    if ($defaults.ContainsKey($name)) { throw "Duplicate theme default: $name" }
    $defaults[$name] = $match.Groups[2].Value.Trim()
}
$tokens = @($metadata.tokens.PSObject.Properties)
if (!$tokens.Count -or $tokens.Count -ne $defaults.Count) { throw 'Theme token metadata and CSS defaults disagree.' }
foreach ($token in $tokens) {
    if (!$defaults.ContainsKey($token.Name) -or !$token.Value.cssProperty -or !@($token.Value.bindings).Count) {
        throw "Invalid theme token metadata: $($token.Name)"
    }
    if ($token.Value.PSObject.Properties.Name -contains 'default') { throw 'Edit defaults in CSS, not in metadata.' }
    $token.Value | Add-Member -MemberType NoteProperty -Name 'default' -Value $defaults[$token.Name]
}
$expected = $encoding.GetBytes(($metadata | ConvertTo-Json -Depth 20) + "`n")
$output = Join-Path $projectRoot 'wwwroot/themes/contract.json'
$matches = $false
if (Test-Path -LiteralPath $output) {
    $actual = [IO.File]::ReadAllBytes($output)
    $matches = $actual.Length -eq $expected.Length
    if ($matches) {
        for ($i = 0; $i -lt $actual.Length; $i++) { if ($actual[$i] -ne $expected[$i]) { $matches = $false; break } }
    }
}
if (!$matches) {
    if ($Check) { throw 'Stale distributed theme contract. Run scripts/Build-FrontendStyles.ps1.' }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output)) | Out-Null
    [IO.File]::WriteAllBytes($output, $expected)
}
Write-Output "Theme contract: $($tokens.Count) defaults from CSS; metadata and distribution verified."
$packageSource = Join-Path $projectRoot 'Frontend/themes/package-contract.json'
$packageOutput = Join-Path $projectRoot 'wwwroot/themes/package-contract.json'
$packageText = [IO.File]::ReadAllText($packageSource, $encoding)
if (!(Test-Path -LiteralPath $packageOutput) -or [IO.File]::ReadAllText($packageOutput, $encoding) -cne $packageText) {
    if ($Check) { throw 'Stale package contract.' }
    [IO.File]::WriteAllText($packageOutput, $packageText, $encoding)
}
