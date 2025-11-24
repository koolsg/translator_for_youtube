[CmdletBinding()]

# Combined Server Management Script
# Unifies start_server.ps1 and stop_server.ps1 into single script
# Usage: .\server.ps1 start [-Force]
#        .\server.ps1 stop [-Force] [-ShowDetails]

param(
    [Parameter(Mandatory=$true)]
    [string]$Action,

    [switch]$Force,      # Force restart or termination
    [switch]$ShowDetails # Enable detailed logging (stop only), parameter name changed from Verbose to avoid conflicts

)

# Parameter validation (done before main script execution)
$validActions = @("start", "stop")
if ($validActions -notcontains $Action) {
    throw "Action must be one of: $($validActions -join ', ')"
}

if ($ShowDetails -and $Action -ne "stop") {
    throw "The '-Verbose' parameter is only valid when Action is 'stop'."
}

# Set console encoding to UTF-8 for proper Unicode display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory and define common paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = Split-Path $scriptDir
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$backendDir = $scriptDir
$mainPath = Join-Path $backendDir "main.py"
$pidPath = Join-Path $rootDir "app.pid"

# ================================
# Common Functions
# ================================

function Test-Environment {
    if (-not (Test-Path $venvPython)) {
        throw "Virtual environment not found: $venvPython"
    }
    if ($Action -eq "start" -and -not (Test-Path $mainPath)) {
        throw "Application file not found: $mainPath"
    }
}

# ================================
# Start Server Functions
# ================================

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

# ================================
# Stop Server Functions
# ================================

function Write-ServerStopHeader {
    Write-Host "Translation Server Shutdown"
    Write-Host ("=" * 40)
    if ($ShowDetails) {
        Write-Host "Script Directory: $scriptDir"
        Write-Host "Backend Directory: $backendDir"
        Write-Host "PID File Path: $pidPath"
    }
}

function Get-ProcessInfo {
    param([int]$ProcessId)

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) { return $null }

    # Get process details
    $processInfo = @{
        Id = $process.Id
        Name = $process.Name
        CPU = [math]::Round($process.CPU, 2)
        Memory = [math]::Round($process.WorkingSet64 / 1MB, 2)
        StartTime = $process.StartTime
        CommandLine = ""
    }

    try {
        $wmiProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
        if ($wmiProcess) {
            $processInfo.CommandLine = $wmiProcess.CommandLine
        }
    } catch {
        $processInfo.CommandLine = "Unable to retrieve command line"
    }

    return $processInfo
}

function Write-ProcessLog {
    param([string]$Message, [psobject]$ProcessInfo = $null)

    if ($ProcessInfo) {
        Write-Host "$Message`n   -> PID: $($ProcessInfo.Id)`n   -> Name: $($ProcessInfo.Name)`n   -> CPU: $($ProcessInfo.CPU)s`n   -> Memory: $($ProcessInfo.Memory)MB`n   -> Start: $($ProcessInfo.StartTime)`n   -> Command: $($ProcessInfo.CommandLine)"
    } else {
        Write-Host $Message
    }
}

function Stop-ProcessWithLogging {
    param([int]$ProcessId, [string]$Type)

    $processInfo = Get-ProcessInfo -ProcessId $ProcessId
    if (-not $processInfo) {
        Write-Host "Process $ProcessId ($Type) already stopped or not found."
        return $true
    }

    Write-ProcessLog -Message "Stopping $Type process:" -ProcessInfo $processInfo

    try {
        # Attempt graceful stop first (only if not using Force)
        if (-not $Force) {
            Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500

            if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
                Write-Host "[OK] $Type process stopped gracefully: $ProcessId"
                return $true
            }
        }

        # Force kill if needed or Force flag is set
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        Write-Host "[OK] $Type process force-stopped: $ProcessId"
        return $true

    } catch {
        Write-Warning "Failed to stop $Type process $ProcessId`: $($_.Exception.Message)"

        if ($Force) {
            Write-Warning "Force termination also failed for $Type process $ProcessId"
        }
        return $false
    }
}

function Stop-AllProcesses {
    param([int]$MainProcessId)

    $mainInfo = Get-ProcessInfo -ProcessId $MainProcessId
    Write-ProcessLog -Message "Shutting down server process:" -ProcessInfo $mainInfo

    # Step 1: Find all child processes
    $childProcesses = @(Get-ChildProcesses -ParentId $MainProcessId)
    if ($ShowDetails) { Write-Host "Found $($childProcesses.Count) child processes to stop." }

    # Step 2: Stop child processes first
    $childStopSuccess = $true
    foreach ($child in $childProcesses) {
        $success = Stop-ProcessWithLogging -ProcessId $child.ProcessId -Type "child"
        if (-not $success) { $childStopSuccess = $false }
    }

    # Step 3: Stop main process
    $mainStopSuccess = Stop-ProcessWithLogging -ProcessId $MainProcessId -Type "main"

    return $childStopSuccess -and $mainStopSuccess
}

function Test-ServerStatus {
    param($ProcessId)

    if ($null -eq $ProcessId -or $ProcessId -le 0) {
        Write-Host "[INFO] No valid PID file found. Server may not be running."
        return $false
    }

    $mainProcess = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $mainProcess) {
        Write-Warning "Process with PID $ProcessId not found. It may have already stopped."
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
        return $false
    }

    return $true
}

function Test-PidFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try {
        $content = Get-Content $Path -ErrorAction Stop
        $processId = $content.Trim()
        if ([string]::IsNullOrEmpty($processId) -or -not [int]::TryParse($processId, [ref]$null)) {
            return $null
        }
        $parsedPid = [int]$processId
        if ($parsedPid -le 0) {
            return $null
        }
        return $parsedPid
    }
    catch { return $null }
}

function Get-ChildProcesses {
    param([Parameter(Mandatory=$true)][int]$ParentId)

    # Find direct children of the current parent process
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentId" -ErrorAction SilentlyContinue

    if ($null -ne $children) {
        # Ensure children is always a collection for the loop
        $childrenArray = @($children)

        foreach ($child in $childrenArray) {
            # Output the current child object to the pipeline
            $child
            # Recursively call the function for the children of the current child
            Get-ChildProcesses -ParentId $child.ProcessId
        }
    }
}

function Remove-PidFile {
    if (Test-Path $pidPath) {
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
        if ($ShowDetails) { Write-Host "Cleaned up PID file: $pidPath" }
    }
}

# ================================
# Main Execution
# ================================

try {
    # Execute based on Action parameter
    switch ($Action) {
        "start" {
            # Start server logic
            Write-Host "Translation Server Startup"
            Write-Host ("=" * 40)

            Test-Environment
            Write-Host "Environment check passed"

            Test-ExistingServer
            Write-Host "Server availability check passed"

            Start-ServerProcess
            Write-Host ("=" * 40)
            Write-Host "Ready! Use 'server.ps1 stop' to stop."
        }

        "stop" {
            # Stop server logic
            Write-ServerStopHeader

            # Environment validation
            Test-Environment
            Write-Host "[OK] Environment check passed"

            # Get and validate process ID
            $processId = Test-PidFile -Path $pidPath
            if (-not (Test-ServerStatus -ProcessId $processId)) {
                Write-Host ("=" * 40)
                Write-Host "Server was not running or already stopped."
                exit 0
            }

            Write-Host "[OK] Server status check passed"
            Write-Host ""

            # Stop all processes
            $stopSuccess = Stop-AllProcesses -MainProcessId $processId

            # Cleanup
            Remove-PidFile

            Write-Host ""
            Write-Host ("=" * 40)

            if ($stopSuccess) {
                Write-Host "SUCCESS: Server and all child processes stopped successfully."
            } else {
                Write-Warning "WARNING: Some processes could not be stopped. Manual cleanup may be required."
                exit 1
            }
        }
    }

} catch {
    Write-Error "Server $($Action) failed: $($_.Exception.Message)"
    exit 1
}
