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
DisableDirPage=no
DisableProgramGroupPage=yes
UsePreviousAppDir=no
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

[CustomMessages]
brazilianportuguese.UninstallRemoveDataPrompt=Remover tambem os dados do Doorpi deste usuario?%n%nIsso apaga perfis, configuracoes, logs, cache de update e arquivos em %LOCALAPPDATA%\Doorpi.
english.UninstallRemoveDataPrompt=Also remove this user's Doorpi data?%n%nThis deletes profiles, settings, logs, update cache, and files under %LOCALAPPDATA%\Doorpi.
brazilianportuguese.InstallDirProtectedError=Essa pasta exige permissao administrativa. Para o Doorpi atualizar sem pedir elevacao, escolha uma pasta gravavel pelo usuario atual, como:%n%n%1
english.InstallDirProtectedError=This folder requires administrator permission. For Doorpi to update without elevation, choose a folder writable by the current user, such as:%n%n%1
brazilianportuguese.InstallDirWritableError=A conta atual nao consegue gravar na pasta escolhida. O Doorpi precisa instalar e atualizar em uma pasta gravavel sem elevacao, como:%n%n%1
english.InstallDirWritableError=The current account cannot write to the selected folder. Doorpi must install and update in a folder writable without elevation, such as:%n%n%1
brazilianportuguese.ShellRestoreFailed=Nao foi possivel restaurar a inicializacao do Windows. A desinstalacao foi interrompida para preservar o acesso ao Doorpi.
english.ShellRestoreFailed=Windows startup configuration could not be restored. Uninstall was stopped to preserve access to Doorpi.
brazilianportuguese.DirectUpgradeBlocked=Esta versao do instalador aceita apenas instalacao limpa. Para preservar perfis e permitir recuperacao dos dados, atualize pelo atualizador interno do Doorpi.%n%nUma instalacao ou dados anteriores foram encontrados. Nada foi alterado. Se a instalacao anterior foi removida, recupere-a com o atualizador compativel antes de continuar.
english.DirectUpgradeBlocked=This installer supports clean installation only. To preserve profiles and provide data recovery, upgrade using Doorpi's built-in updater.%n%nAn existing installation or previous data was found. Nothing was changed. If the previous installation was removed, recover it with a compatible updater before continuing.

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

[Code]
var
  RemoveUserData: Boolean;

function NormalizePath(const Value: string): string;
begin
  Result := RemoveBackslashUnlessRoot(ExpandFileName(Value));
end;

function IsSameOrSubPath(const Candidate, RootPath: string): Boolean;
var
  NormalizedCandidate: string;
  NormalizedRoot: string;
begin
  if RootPath = '' then
  begin
    Result := False;
    exit;
  end;

  NormalizedCandidate := Uppercase(NormalizePath(Candidate));
  NormalizedRoot := Uppercase(NormalizePath(RootPath));

  Result :=
    (NormalizedCandidate = NormalizedRoot) or
    ((Length(NormalizedCandidate) > Length(NormalizedRoot)) and
      (Copy(NormalizedCandidate, 1, Length(NormalizedRoot) + 1) = AddBackslash(NormalizedRoot)));
end;

function FindExistingParentDir(const DirName: string): string;
var
  RootDir: string;
begin
  Result := NormalizePath(DirName);
  RootDir := RemoveBackslashUnlessRoot(ExtractFileDrive(Result) + '\');

  while (Result <> '') and not DirExists(Result) do
  begin
    if Result = RootDir then
      Break;

    Result := RemoveBackslashUnlessRoot(ExtractFileDir(Result));
  end;

  if not DirExists(Result) then
    Result := '';
end;

function IsProtectedInstallRoot(const DirName: string): Boolean;
begin
  Result :=
    IsSameOrSubPath(DirName, GetEnv('ProgramFiles')) or
    IsSameOrSubPath(DirName, GetEnv('ProgramFiles(x86)')) or
    IsSameOrSubPath(DirName, GetEnv('ProgramW6432')) or
    IsSameOrSubPath(DirName, ExpandConstant('{win}')) or
    IsSameOrSubPath(DirName, ExpandConstant('{sys}'));
end;

function CanWriteToDirectoryTree(const DirName: string): Boolean;
var
  ProbeDir: string;
  ProbeFile: string;
begin
  ProbeDir := FindExistingParentDir(DirName);
  if ProbeDir = '' then
  begin
    Result := False;
    exit;
  end;

  ProbeFile :=
    AddBackslash(ProbeDir) + '.doorpi-write-test-' +
    GetDateTimeString('yyyymmddhhnnss', '-', ':') + '-' +
    IntToStr(Random(2147483647)) + '.tmp';
  Result := SaveStringToFile(ProbeFile, 'doorpi-write-test', False);
  if Result then
    DeleteFile(ProbeFile);
end;

function GetInstallDirValidationMessage(const DirName: string): string;
var
  RecommendedDir: string;
begin
  Result := '';
  RecommendedDir := ExpandConstant('{localappdata}\Programs\Doorpi');

  if IsProtectedInstallRoot(DirName) then
  begin
    Result := FmtMessage(CustomMessage('InstallDirProtectedError'), [RecommendedDir]);
    exit;
  end;

  if not CanWriteToDirectoryTree(DirName) then
    Result := FmtMessage(CustomMessage('InstallDirWritableError'), [RecommendedDir]);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ValidationMessage: string;
begin
  Result := True;

  if CurPageID = wpSelectDir then
  begin
    ValidationMessage := GetInstallDirValidationMessage(WizardDirValue);
    if ValidationMessage <> '' then
    begin
      MsgBox(ValidationMessage, mbCriticalError, MB_OK);
      Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): string;
begin
  Result := GetInstallDirValidationMessage(WizardDirValue);
  if (Result = '') and
     (FileExists(AddBackslash(WizardDirValue) + 'Doorpi.exe') or
      DirExists(ExpandConstant('{localappdata}\Doorpi\Data')) or
      FileExists(ExpandConstant('{localappdata}\Doorpi\storage\doorpi.db'))) then
    Result := CustomMessage('DirectUpgradeBlocked');
end;

function IsSilentUninstall(): Boolean;
begin
  Result := UninstallSilent;
end;

function InitializeUninstall(): Boolean;
begin
  RemoveUserData := False;

  if not IsSilentUninstall() then
    RemoveUserData :=
      SuppressibleMsgBox(
        CustomMessage('UninstallRemoveDataPrompt'),
        mbConfirmation,
        MB_YESNO or MB_DEFBUTTON2,
        IDNO) = IDYES;

  Result := True;
end;

function IsThisDoorpiCommand(const Command: string): Boolean;
var
  ExeName: string;
  QuoteEnd: Integer;
begin
  ExeName := Trim(Command);
  if Copy(ExeName, 1, 1) = '"' then
  begin
    Delete(ExeName, 1, 1);
    QuoteEnd := Pos('"', ExeName);
    if QuoteEnd > 0 then ExeName := Copy(ExeName, 1, QuoteEnd - 1);
  end;
  Result := CompareText(ExeName, ExpandConstant('{app}\Doorpi.exe')) = 0;
end;

procedure RestoreDoorpiStartupConfiguration();
var
  Key, SoundKey, Command, Previous: string;
  HasBackup, HasSound, PreviousKind: Cardinal;
  Restored: Boolean;
begin
  Key := 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon';
  SoundKey := 'AppEvents\Schemes\Apps\.Default\SystemStart\.Current';
  if RegQueryStringValue(HKCU, Key, 'Shell', Command) and IsThisDoorpiCommand(Command) then
  begin
    if RegQueryDWordValue(HKCU, Key, 'DoorpiShellBackupPresent', HasBackup) and
       (HasBackup = 1) and RegQueryStringValue(HKCU, Key, 'DoorpiPreviousShell', Previous) then
    begin
      if RegQueryDWordValue(HKCU, Key, 'DoorpiPreviousShellKind', PreviousKind) and (PreviousKind = 2) then
        Restored := RegWriteExpandStringValue(HKCU, Key, 'Shell', Previous)
      else Restored := RegWriteStringValue(HKCU, Key, 'Shell', Previous);
    end
    else
      Restored := RegDeleteValue(HKCU, Key, 'Shell');
    if not Restored then
    begin
      SuppressibleMsgBox(CustomMessage('ShellRestoreFailed'), mbError, MB_OK, IDOK);
      Abort;
    end;
    { Restore only the mute we installed; keep a sound changed by the user. }
    if RegQueryStringValue(HKCU, SoundKey, '', Command) and (Command = '') then
    begin
      if RegQueryDWordValue(HKCU, Key, 'DoorpiSoundBackupPresent', HasSound) then
      begin
        if (HasSound = 1) and RegQueryStringValue(HKCU, Key, 'DoorpiPreviousStartupSound', Previous) then
        begin
          if RegQueryDWordValue(HKCU, Key, 'DoorpiPreviousStartupSoundKind', PreviousKind) and (PreviousKind = 2) then
            RegWriteExpandStringValue(HKCU, SoundKey, '', Previous)
          else RegWriteStringValue(HKCU, SoundKey, '', Previous);
        end
        else RegDeleteValue(HKCU, SoundKey, '');
      end
      else RegDeleteValue(HKCU, SoundKey, '');
    end;
    RegDeleteValue(HKCU, Key, 'DoorpiShellBackupPresent');
    RegDeleteValue(HKCU, Key, 'DoorpiPreviousShell');
    RegDeleteValue(HKCU, Key, 'DoorpiSoundBackupPresent');
    RegDeleteValue(HKCU, Key, 'DoorpiPreviousStartupSound');
    RegDeleteValue(HKCU, Key, 'DoorpiPreviousStartupSoundKind');
    RegDeleteValue(HKCU, Key, 'DoorpiPreviousShellKind');
  end;
  Key := 'SOFTWARE\Microsoft\Windows\CurrentVersion\Run';
  if RegQueryStringValue(HKCU, Key, 'Doorpi', Command) and IsThisDoorpiCommand(Command) then
    RegDeleteValue(HKCU, Key, 'Doorpi');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then RestoreDoorpiStartupConfiguration();
  if (CurUninstallStep = usUninstall) and RemoveUserData then
  begin
    DelTree(ExpandConstant('{localappdata}\Doorpi'), True, True, True);
    DelTree(ExpandConstant('{app}\Data'), True, True, True);
  end;
end;
