$shortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Python_Server.lnk"
$target = "powershell.exe"
$arguments = "-ExecutionPolicy Bypass -File `"$PSScriptRoot\start_server.ps1`""
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcut)
$sc.TargetPath = $target
$sc.Arguments = $arguments
$sc.Save()