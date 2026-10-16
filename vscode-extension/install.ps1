# =====================================================================
#  Installeert de VS Code-extensie van de F1 Coding Minigame.
#
#  Gebruik (in PowerShell, in de projectmap):
#     .\vscode-extension\install.ps1
#
#  Wat doet dit script?
#   1. Maakt een .vsix-bestand (dat is gewoon een zip met een vaste opbouw)
#      van package.json + extension.js. Geen Node.js of npm nodig.
#   2. Installeert dat bestand met "code --install-extension".
#  Daarna in VS Code: Ctrl+Shift+P -> "Developer: Reload Window".
# =====================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$dir = $PSScriptRoot
$pkg = Get-Content (Join-Path $dir 'package.json') -Raw | ConvertFrom-Json
$out = Join-Path $dir "$($pkg.name)-$($pkg.version).vsix"

# Inhoud van de verplichte bestanden in een .vsix
$contentTypes = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
'@

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="$($pkg.name)" Version="$($pkg.version)" Publisher="$($pkg.publisher)" />
    <DisplayName>$($pkg.displayName)</DisplayName>
    <Description xml:space="preserve">$($pkg.description)</Description>
    <Categories>Other</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="$($pkg.engines.vscode)" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
"@

# Zip maken (met / in de paden, anders snapt VS Code hem niet)
if (Test-Path $out) { Remove-Item $out }
$zip = [System.IO.Compression.ZipFile]::Open($out, 'Create')
function Add-Text($name, $text) {
  $entry = $zip.CreateEntry($name)
  $w = New-Object System.IO.StreamWriter($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
  $w.Write($text)
  $w.Close()
}
Add-Text '[Content_Types].xml' $contentTypes
Add-Text 'extension.vsixmanifest' $manifest
Add-Text 'extension/package.json' (Get-Content (Join-Path $dir 'package.json') -Raw)
Add-Text 'extension/extension.js' (Get-Content (Join-Path $dir 'extension.js') -Raw -Encoding UTF8)
$zip.Dispose()
Write-Host "==> gemaakt: $out"

# Installeren in VS Code
& code --install-extension $out --force
Write-Host '==> klaar! In VS Code: Ctrl+Shift+P -> "Developer: Reload Window"'
