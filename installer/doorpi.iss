#define AppName "Doorpi"
#ifndef AppVersion
#define AppVersion "0.0.0"
#endif
#ifndef DoorpiPublish
#define DoorpiPublish "..\artifacts\publish\Doorpi"
#endif
#ifndef UpdaterPublish
#define UpdaterPublish "..\artifacts\publish\Updater"
#endif
#ifndef OutputDir
#define OutputDir "..\artifacts\installer"
#endif
#ifndef DoorpiIcon
#define DoorpiIcon "..\Doorpi\Assets\doorpi.ico"
#endif

[Setup]
AppId={{9E9C58BC-0A3B-4879-B61B-7F2837E7714B}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Doorpi
DefaultDirName={localappdata}\Programs\Doorpi
DefaultGroupName=Doorpi
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename=DoorpiSetup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=Doorpi
SetupLogging=yes
SetupIconFile={#DoorpiIcon}
UninstallDisplayIcon={app}\Doorpi.exe

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#DoorpiPublish}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "Data\*"
Source: "{#UpdaterPublish}\*"; DestDir: "{app}\Updater"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Doorpi"; Filename: "{app}\Doorpi.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Doorpi"; Filename: "{app}\Doorpi.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\Doorpi.exe"; Description: "{cm:LaunchProgram,Doorpi}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\updates"
