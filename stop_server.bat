@echo off
REM Translation Server Stop Batch Script
REM Convenience wrapper to stop the server without typing the full PowerShell command

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "stop_server.ps1" %*

REM %* passes all command line arguments to the PowerShell script
