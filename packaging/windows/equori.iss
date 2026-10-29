; Installer of the Windows form (W-I1 to W-I7 of docs/specs/2026-10-27-distribution-windows-design.md).
; ISCC /DAppVersion=X.Y.Z /DPayload=<directory holding equori.exe and postgresql\> /O<output directory> equori.iss
; With /DSign, ISCC also needs /Ssigntool=<command>, and signs the installer and the uninstaller.

#ifndef AppVersion
  #error AppVersion is not defined
#endif
#ifndef Payload
  #error Payload is not defined
#endif

[Setup]
; The AppId ties every version to one entry of Settings > Apps: never change it.
AppId={{04E8C251-2877-43D0-851A-AED1F783A5E8}
AppName=equori
AppVersion={#AppVersion}
AppPublisher=equori
AppPublisherURL=https://github.com/andrelopes-code/equori
DefaultDirName={autopf}\equori
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=admin
; AF_UNIX, which managed mode needs, ships with Windows 10 1803.
MinVersion=10.0.17134
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=equori_{#AppVersion}_windows_amd64_setup
Compression=lzma2/ultra64
SolidCompression=yes
LanguageDetectionMethod=uilanguage
UninstallDisplayIcon={app}\equori.exe
UninstallDisplayName=equori
#ifdef Sign
SignTool=signtool
SignedUninstaller=yes
#endif

; One language per web catalog (docs/contributing/regions.md); none sets a user's language or region.
[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "ptBR"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[CustomMessages]
en.DeleteData=Delete the equori data in %1, the backups included? Choose No to keep it for a later installation.
ptBR.DeleteData=Apagar os dados do equori em %1, incluindo os backups? Escolha Não para mantê-los para uma instalação futura.
en.OpenEquori=Open equori
ptBR.OpenEquori=Abrir o equori

[Files]
Source: "{#Payload}\equori.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Payload}\postgresql\*"; DestDir: "{app}\postgresql"; Flags: ignoreversion recursesubdirs
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[INI]
Filename: "{autoprograms}\equori.url"; Section: "InternetShortcut"; Key: "URL"; String: "http://127.0.0.1:8080/"

[UninstallDelete]
Type: files; Name: "{autoprograms}\equori.url"

[Run]
Filename: "{app}\equori.exe"; Parameters: "service install"; Flags: runhidden waituntilterminated
Filename: "{code:SetupURL}"; Description: "{cm:OpenEquori}"; Flags: shellexec runasoriginaluser nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\equori.exe"; Parameters: "service uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "service"

[Code]
// An upgrade replaces files the running service holds open, so the installed service stops first.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\equori.exe')) then
    Exec(ExpandConstant('{app}\equori.exe'), 'service stop', '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

// The first-user screen while the setup is open (W-U1), the application afterwards; it waits up
// to 60 s for the service to answer.
function SetupURL(Param: String): String;
var
  Http: Variant;
  I: Integer;
  Url: AnsiString;
begin
  for I := 1 to 60 do
  begin
    try
      Http := CreateOleObject('WinHttp.WinHttpRequest.5.1');
      Http.Open('GET', 'http://127.0.0.1:8080/healthz', False);
      Http.Send('');
      if Http.Status = 200 then
        Break;
    except
    end;
    Sleep(1000);
  end;
  if LoadStringFromFile(ExpandConstant('{commonappdata}\equori\setup.url'), Url) then
    Result := Trim(String(Url))
  else
    Result := 'http://127.0.0.1:8080/';
end;

// Uninstalling keeps the data unless the person chooses otherwise; a silent uninstall keeps it (W-I6).
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Data: String;
begin
  if (CurUninstallStep = usPostUninstall) and not UninstallSilent then
  begin
    Data := ExpandConstant('{commonappdata}\equori');
    if DirExists(Data) and (MsgBox(FmtMessage(CustomMessage('DeleteData'), [Data]), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES) then
      DelTree(Data, True, True, True);
  end;
end;
