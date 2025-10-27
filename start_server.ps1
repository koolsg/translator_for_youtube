# Start the translation server in background mode
# This script launches the FastAPI application using uvicorn
# and saves the process ID for later management

# Get script directory and set up environment
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location -Path $scriptDir  # Fix current directory to avoid shell startup influences

# Construct file paths
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$backendDir = Join-Path $scriptDir "backend"
$mainPath = Join-Path $backendDir "main.py"
$pidPath = Join-Path $scriptDir "app.pid"

try {
    # Check if virtual environment Python executable exists
    if (-not (Test-Path $venvPython)) {
        throw "Virtual environment Python not found: $venvPython`nPlease ensure venv is properly set up."
    }

    # Check if application file exists
    if (-not (Test-Path $mainPath)) {
        throw "Application file not found: $mainPath"
    }

    # Check if server is already running and prevent duplicate processes
    function Test-PortInUse {
        param([int]$Port)
        try {
            $connections = netstat -ano | findstr ":$Port "
            if ($connections) {
                $processesUsingPort = @()
                foreach ($line in $connections) {
                    $parts = $line.Trim() -split '\s+'
                    if ($parts.Length -ge 5) {
                        $processPID = $parts[4]
                        if ($processPID -match '^\d+$') {
                            try {
                                $proc = Get-Process -Id $processPID -ErrorAction SilentlyContinue
                                if ($proc) {
                                    $processesUsingPort += $proc
                                }
                            } catch { }
                        }
                    }
                }
                return $processesUsingPort
            }
        } catch {
            Write-Warning "Failed to check port $Port usage: $($_.Exception.Message)"
        }
        return @()
    }

    # Check if port 5000 is already in use
    Write-Host "Checking if port 5000 is available..."
    $processesOnPort = Test-PortInUse -Port 5000
    if ($processesOnPort.Count -gt 0) {
        $processInfo = $processesOnPort | ForEach-Object { "PID:$($_.Id) ($($_.Name))" } | Join-String -Separator ", "
        throw "Port 5000 is already in use by: $processInfo. Stop the existing server first."
    }

    # Check PID file and existing processes
    if (Test-Path $pidPath) {
        try {
            $existingPid = Get-Content $pidPath -ErrorAction Stop
            $existingPid = $existingPid.Trim()

            if ([int]::TryParse($existingPid, [ref]$null)) {
                # Check if the process with this PID is still running
                $runningProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
                if ($runningProcess) {
                    throw "Server is already running (PID: $existingPid). Stop it first using stop_server.ps1 or start_server.ps1 --force"
                } else {
                    Write-Host "Previous server process (PID: $existingPid) not found, cleaning up PID file."
                    Remove-Item $pidPath -Force
                }
            } else {
                Write-Host "Invalid PID file found, cleaning up."
                Remove-Item $pidPath -Force
            }
        }
        catch {
            Write-Warning "Failed to check previous PID file: $($_.Exception.Message)"
            # Continue with startup but force PID file removal
            if (Test-Path $pidPath) {
                try { Remove-Item $pidPath -Force } catch { }
            }
        }
    }

    # Additional check: Look for any uvicon processes with the specific command
    Write-Host "Checking for existing uvicorn processes..."
    $uvicornProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*uvicorn*" -and $_.CommandLine -like "*--port 5000*" }
    if ($uvicornProcesses.Count -gt 0) {
        $processInfo = $uvicornProcesses | ForEach-Object { "PID:$($_.Id)" } | Join-String -Separator ", "
        throw "Found existing uvicorn processes running on port 5000: $processInfo. Stop them first."
    }

    Write-Host "Starting server in background mode..."

    # Start the process in the background, with a specific working directory
    $process = Start-Process -FilePath $venvPython `
        -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 5000" `
        -WorkingDirectory $backendDir `
        -PassThru `
        -WindowStyle Hidden

    # Brief wait to see if the process exits immediately
    Start-Sleep -Seconds 2

    # Verify process started successfully
    if (-not $process -or $process.HasExited) {
        throw "Failed to start the process. For debugging, run 'uvicorn main:app' manually inside the 'backend' directory after activating the venv."
    }

    # Save process ID to PID file
    $process.Id | Out-File -FilePath $pidPath -Encoding ascii -ErrorAction Stop

    Write-Host "Server started successfully. (PID: $($process.Id))"
    Write-Host "PID file: $pidPath"
    Write-Host "Server is running in background. Use stop_server.ps1 to stop it."

}
catch {
    Write-Error "Server startup failed: $($_.Exception.Message)"
    exit 1
}
