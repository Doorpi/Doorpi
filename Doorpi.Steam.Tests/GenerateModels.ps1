param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$result="#nullable enable`nusing System.Text.Json.Serialization;`nnamespace Doorpi;`n"
foreach($entry in @(@('MainWindow.xaml.cs','public class UserProfile'),@('MediaActivityHistory.cs','public sealed class MediaActivityHistoryEntry'))) {
    $text=[IO.File]::ReadAllText((Join-Path $PSScriptRoot ('../Doorpi/'+$entry[0])))
    $start=$text.IndexOf('    '+$entry[1],[StringComparison]::Ordinal)
    $end=$text.IndexOf("`n    }",$start,[StringComparison]::Ordinal)
    if($start -lt 0 -or $end -lt 0){throw 'Production model not found'}
    $result+=$text.Substring($start,$end+6-$start)+"`n"
}
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))) | Out-Null
[IO.File]::WriteAllText($OutputPath,$result)
