# Translation Server Start Script
# Simplified and refactored for better maintainability

param(
    [switch]$Force  # Force restart if server is already running
)

# Set console encoding to UTF-8 for proper Unicode display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$backendDir = Join-Path $scriptDir "backend"
$mainPath = Join-Path $backendDir "main.py"
$pidPath = Join-Path $scriptDir "app.pid"

function Test-Environment {
    if (-not (Test-Path $venvPython)) {
        throw "Virtual environment not found: $venvPython"
    }
    if (-not (Test-Path $mainPath)) {
        throw "Application file not found: $mainPath"
    }
}

function Test-ExistingServer {
    param([int]$Port = 5000)

    # Check port usage
    $listeningConnections = netstat -ano | findstr ":$Port " | findstr "LISTENING"
    if ($listeningConnections) {
        foreach ($line in $listeningConnections) {
            $parts = $line.Trim() -split '\s+'
            if ($parts.Length -ge 5) {
                $processPID = $parts[4]
                if ($processPID -match '^\d+$' -and $processPID -ne '0') {
                    $proc = Get-Process -Id $processPID -ErrorAction SilentlyContinue
                    if ($proc) {
                        throw "Port $Port is in use by PID:$($proc.Id) ($($proc.Name))"
                    }
                }
            }
        }
    }

    # Check PID file
    if (Test-Path $pidPath) {
        try {
            $existingPid = [int](Get-Content $pidPath -ErrorAction Stop)
            if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
                if (-not $Force) {
                    throw "Server already running (PID: $existingPid)"
                }
                Write-Host "Force restart: terminating existing server..."
                Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Warning "PID file check failed: $($_.Exception.Message)"
        }
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
    }

    # Check uvicorn processes
    $uvicornProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*uvicorn*" -and $_.CommandLine -like "*--port $Port*" }
    if ($uvicornProcesses.Count -gt 0) {
        foreach ($proc in $uvicornProcesses) {
            if (-not $Force) {
                throw "Found uvicorn process: PID:$($proc.Id)"
            }
            Write-Host "Terminating conflicting uvicorn process: PID:$($proc.Id)"
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-ServerProcess {
    Write-Host "Starting server..."

    $process = Start-Process -FilePath $venvPython `
        -ArgumentList "main.py" `
        -WorkingDirectory $backendDir `
        -PassThru `
        -WindowStyle Hidden

    Start-Sleep -Seconds 2

    if (-not $process -or $process.HasExited) {
        throw "Server failed to start. Check logs in backend directory."
    }

    $process.Id | Out-File -FilePath $pidPath -Encoding ascii
    Write-Host "Server started successfully (PID: $($process.Id))"
}

# Main execution
try {
    Write-Host "Translation Server Startup"
    Write-Host ("=" * 40)

    Test-Environment
    Write-Host "Environment check passed"

    Test-ExistingServer
    Write-Host "Server availability check passed"

    Start-ServerProcess
    Write-Host ("=" * 40)
    Write-Host "Ready! Use stop_server.bat to stop."

} catch {
    Write-Error "Startup failed: $($_.Exception.Message)"
    exit 1
}
