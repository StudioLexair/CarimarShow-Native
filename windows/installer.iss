#define MyAppVersion "2.2.5"
[Setup]
AppId={{86940A02-EA6F-450C-9826-EE2A88494CB7}
AppName=CarimarShow
AppVersion={#MyAppVersion}
AppPublisher=Studio Lexair
AppPublisherURL=https://github.com/StudioLexair/CarimarShow-Native
DefaultDirName={autopf}\CarimarShow
DefaultGroupName=CarimarShow
UninstallDisplayIcon={app}\CarimarShow.exe
OutputDir=..\artifacts
OutputBaseFilename=CarimarShow-Windows-x64-Setup
SetupIconFile=app.ico
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
[Files]
Source: "..\artifacts\windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\artifacts\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
[Icons]
Name: "{group}\CarimarShow"; Filename: "{app}\CarimarShow.exe"
Name: "{autodesktop}\CarimarShow"; Filename: "{app}\CarimarShow.exe"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; Flags: unchecked
[Run]
Filename: "{tmp}\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"; Parameters: "/silent /install"; StatusMsg: "Instalando el motor WebView2 incluido (sin conexión)..."; Check: NeedsWebView2; Flags: waituntilterminated
Filename: "{app}\CarimarShow.exe"; Description: "Abrir CarimarShow"; Flags: nowait postinstall skipifsilent
[Code]
function NeedsWebView2: Boolean;
var Version: String;
begin
  Result := not (RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;
