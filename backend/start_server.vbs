
' 서버 시작을 위한 VBS 스크립트
' 시작 메뉴에 등록해서 터미널이 보이지 않고 실행되기 위한 용도
Set WshShell = CreateObject("WScript.Shell")

' 배치파일의 위치와 동일한 폴더 기준으로 실행하도록 현재 스크립트 경로를 가져옴
scriptPath = CreateObject("Scripting.FileSystemObject") _
                .GetParentFolderName(WScript.ScriptFullName)

' 실행 명령어 구성
command = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ _
          & scriptPath & "\server.ps1"" start"

' 실행 (창 숨김: 0, 대기 없음: False)
WshShell.Run command, 0, False
