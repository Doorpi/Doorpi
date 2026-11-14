param([string]$OutputDirectory = 'artifacts/web-permission-preview')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
if (!$output.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output must stay inside the workspace.' }
[IO.Directory]::CreateDirectory($output) | Out-Null
$xaml = [IO.File]::ReadAllText((Join-Path $root 'Doorpi/Browser/BrowserPermissionDialog.xaml'))
$xaml = $xaml -replace 'x:Class="[^"]+"', '' -replace 'x:ClassModifier="[^"]+"', '' -replace ' (Click|PreviewKeyDown)="[^"]+"', ''
$window = [Windows.Markup.XamlReader]::Parse($xaml)
$window.FindName('Heading').Text = 'Permitir acesso ao microfone?'
$window.FindName('ApplicationLabel').Text = 'Aplicativo de chamadas'
$window.FindName('OriginLabel').Text = 'https://chamadas.exemplo.com'
$window.FindName('Explanation').Text = 'Sua decisão será salva para este perfil, aplicativo e site. Você pode removê-la nas configurações de permissões.'
$window.FindName('BlockButton').Content = 'Não permitir'
$window.FindName('AllowButton').Content = 'Permitir'
$window.FindName('Hints').Text = '← → Escolher   A / Enter Confirmar   B / Esc Cancelar'
foreach ($width in @(600, 420)) {
    $surface = $window.Content
    $surface.Background = $window.Background
    $surface.Measure((New-Object Windows.Size($width, 680)))
    $height = [Math]::Ceiling($surface.DesiredSize.Height)
    $surface.Arrange((New-Object Windows.Rect(0, 0, $width, $height)))
    $surface.UpdateLayout()
    if ($height -gt 680) { throw 'Permission dialog exceeds the available height.' }
    $bitmap = New-Object Windows.Media.Imaging.RenderTargetBitmap($width, $height, 96, 96, ([Windows.Media.PixelFormats]::Pbgra32))
    $bitmap.Render($surface)
    $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $stream = [IO.File]::Create((Join-Path $output "permission-$width.png"))
    try { $encoder.Save($stream) } finally { $stream.Dispose() }
}
$window.Close()
Write-Output "Rendered permission XAML offscreen in $output. No app, device or user-profile access."
