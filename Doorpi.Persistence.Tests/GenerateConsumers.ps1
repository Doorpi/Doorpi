param([Parameter(Mandatory=$true)][string]$SourcePath,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$source=[IO.File]::ReadAllText($SourcePath)
function Get-Member([string]$signature) {
    $start=$source.IndexOf('        private '+$signature,[StringComparison]::Ordinal)
    if($start -lt 0){throw "Production member not found: $signature"}
    $next=$source.IndexOf("`n        private ",$start+17,[StringComparison]::Ordinal)
    if($next -lt 0){throw "Production member boundary not found: $signature"}
    return $source.Substring($start,$next-$start)
}
$members=@('void SaveGames(', 'List<GameModel> LoadGames()', 'List<GameHistoryEntry> LoadGameHistory()',
 'void SaveGameHistory(', 'void MergeGamesWithHistory(', 'static long SaturatingAddPlaytimeMinutes(',
 'static long SaturatingSumPlaytimeMinutes(', 'static bool HasGameBeenPlayed(', 'static string FirstNotBlank(', 'string NormalizeGameName(')
$result="#nullable enable`nusing System.IO;`nusing System.Text.Json;`nnamespace Doorpi;`npublic partial class MainWindow {`n"
foreach($member in $members){$result+=(Get-Member $member)+"`n"}
$result+="}`n"
foreach($model in @('InstalledApp','AppCacheModel','AutoAddSuppression')) {
    $start=$source.IndexOf('    public class '+$model,[StringComparison]::Ordinal)
    $next=$source.IndexOf('    public class ',$start+18,[StringComparison]::Ordinal)
    if($start -lt 0 -or $next -lt 0){throw "Production model boundary not found: $model"}
    $result+=$source.Substring($start,$next-$start)+"`n"
}
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath),$result)
