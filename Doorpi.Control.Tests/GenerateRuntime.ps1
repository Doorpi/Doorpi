param([Parameter(Mandatory=$true)][string]$SourcePath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$source=Get-Content -LiteralPath $SourcePath -Raw
function Get-Member([string]$signature){
    $start=$source.IndexOf('    private '+$signature,[StringComparison]::Ordinal)
    if($start -lt 0){throw "Missing production member: $signature"}
    $next=$source.IndexOf("`n    private ",$start+12,[StringComparison]::Ordinal)
    if($next -lt 0){throw "Missing boundary for: $signature"}
    return $source.Substring($start,$next-$start)
}
$members=@(
 'sealed class BindingRuntimeState',
 'readonly record struct BindingRuntimeKey(',
 'readonly record struct ControlBindingRoute(',
 'bool ProcessConfiguredControlBindingsCore(',
 'ControlBindingRoute[] GetCachedControlBindingRoutes(',
 'static bool IsContinuousAnalogBinding(',
 'void SuppressSubsetBindings(',
 'static IEnumerable<ControlBindingRoute> EnumerateControlBindingRoutes(',
 'static IEnumerable<string> BindingActivationChordKeys(',
 'static bool BindingHasActivationChord(',
 'static string ControlChordKey(',
 'static bool IsControlChordActive(',
 'static bool IsDominantStickDirection(',
 'static string GetDominantStickDirection(',
 'static bool IsAnalogControlInput(',
 'void BeginConfiguredControlAction(',
 'void EndConfiguredControlAction(',
 'void ReleaseConfiguredControlOutputs()',
 'void ReleaseConfiguredControlOutputsCore()'
)
$body="#nullable enable`nusing System.Diagnostics;`nnamespace Doorpi;`npartial class MainWindow {`n"
foreach($member in $members){$body+=(Get-Member $member)+"`n"}
$body+="}`n"
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),$body)
