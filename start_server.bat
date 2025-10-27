@echo off
REM Translation Server Start Batch Script
REM Convenience wrapper to start the server without typing the full PowerShell command

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "start_server.ps1" %*

REM %* passes all command line arguments to the PowerShell script
