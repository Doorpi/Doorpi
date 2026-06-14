param(
    [Parameter(Mandatory = $true)]
    [string]$PrivateKeyPath,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

if ((Test-Path $PrivateKeyPath) -and !$Force) {
    throw "Chave privada ja existe: $PrivateKeyPath. Use -Force somente se voce tem certeza absoluta."
}

$folder = Split-Path -Parent $PrivateKeyPath
if (![string]::IsNullOrWhiteSpace($folder)) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

$rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider -ArgumentList 3072
$rsa.PersistKeyInCsp = $false

$privateXml = $rsa.ToXmlString($true)
$publicXml = $rsa.ToXmlString($false)
$publicKeyPath = [System.IO.Path]::ChangeExtension($PrivateKeyPath, ".public.xml")

Set-Content -Path $PrivateKeyPath -Value $privateXml -Encoding UTF8
Set-Content -Path $publicKeyPath -Value $publicXml -Encoding UTF8

$keyBytes = [System.Text.Encoding]::UTF8.GetBytes($publicXml)
$keyHash = ([System.Security.Cryptography.SHA256]::Create()).ComputeHash($keyBytes)
$keyId = ([BitConverter]::ToString($keyHash)).Replace("-", "").Substring(0, 16).ToLowerInvariant()

Write-Host ""
Write-Host "Chave de assinatura criada."
Write-Host "Privada: $PrivateKeyPath"
Write-Host "Publica: $publicKeyPath"
Write-Host "KeyId:   $keyId"
Write-Host ""
Write-Host "A chave privada nunca deve ir para GitHub, release, ZIP ou instalador."
