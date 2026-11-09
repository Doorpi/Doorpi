param([string]$OutputDirectory = 'artifacts/boot-preview')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
if (!$output.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Preview output must be inside the workspace.' }
[IO.Directory]::CreateDirectory($output) | Out-Null
$xaml = [IO.File]::ReadAllText((Join-Path $root 'Doorpi/BootIntroWindow.xaml'))
$xaml = $xaml.Replace('x:Class="Doorpi.BootIntroWindow"', '') -replace ' Click="[^"]+"', ''
$window = [Windows.Markup.XamlReader]::Parse($xaml)
$surface = $window.Content

function Render-Frame([string]$name, [int]$width, [int]$height) {
    $surface.Measure((New-Object Windows.Size($width, $height)))
    $surface.Arrange((New-Object Windows.Rect(0, 0, $width, $height)))
    $surface.UpdateLayout()
    if ($window.FindName('StatusPanel').Visibility -eq [Windows.Visibility]::Visible) {
        $title = $window.FindName('TitleText')
        $line = $window.FindName('BreathingLine')
        $titleBounds = $title.TransformToAncestor($surface).TransformBounds((New-Object Windows.Rect(0, 0, $title.ActualWidth, $title.ActualHeight)))
        $lineBounds = $line.TransformToAncestor($surface).TransformBounds((New-Object Windows.Rect(0, 0, $line.ActualWidth, $line.ActualHeight)))
        if ($titleBounds.Bottom -ge $lineBounds.Top) { throw 'Preparation title overlaps the activity line.' }
        $script:titleTop = $titleBounds.Top
    }
    $bitmap = New-Object Windows.Media.Imaging.RenderTargetBitmap($width, $height, 96, 96, ([Windows.Media.PixelFormats]::Pbgra32))
    $bitmap.Render($surface)
    $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $stream = [IO.File]::Create((Join-Path $output $name))
    try { $encoder.Save($stream) } finally { $stream.Dispose() }
}

# Offscreen render of the actual XAML. No application startup, shell changes,
# Explorer launch, registry writes, audio or real user-session automation.
Render-Frame 'prelude-1280.png' 1280 720
$baselineTop = $script:titleTop
$window.FindName('SubtitleText').Text = 'Um instante'
Render-Frame 'prelude-subtitle-1280.png' 1280 720
if ([Math]::Abs($script:titleTop - $baselineTop) -gt .01) { throw 'Subtitle content moved the preparation title.' }
$window.FindName('SubtitleText').Visibility = [Windows.Visibility]::Collapsed
Render-Frame 'prelude-compact-1280.png' 1280 720
if ([Math]::Abs($script:titleTop - $baselineTop) -gt .01) { throw 'Conditional visibility moved the preparation title.' }
$window.FindName('SubtitleText').Visibility = [Windows.Visibility]::Visible
$window.FindName('SubtitleText').Text = ''
Render-Frame 'prelude-1920.png' 1920 1080
Render-Frame 'prelude-1024.png' 1024 768
$window.FindName('StatusPanel').Visibility = [Windows.Visibility]::Collapsed
$window.FindName('RecoveryPanel').Visibility = [Windows.Visibility]::Visible
Render-Frame 'recovery-1280.png' 1280 720
Render-Frame 'recovery-1024.png' 1024 768
$window.Close()
Write-Output "Rendered native boot previews in $output"
