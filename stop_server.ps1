# Translation Server Stop Script
# Safely stops the uvicorn/FastAPI application with logging and cleanup
# Refactored following start_server.ps1 modular pattern and main.py logging style

param(
    [switch]$Force,      # Force termination if process is resistant
    [switch]$Verbose     # Enable detailed logging
)

# Set console encoding to UTF-8 for proper Unicode display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Get script directory and file paths
$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    # Fallback for when PSScriptRoot is not available (e.g., when run via -File parameter)
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$backendDir = Join-Path $scriptDir "backend"
$pidPath = Join-Path $scriptDir "app.pid"

# Test-Environment: Validates that the virtual environment exists
function Test-Environment {
    if (-not (Test-Path $venvPython)) {
        throw "Virtual environment not found: $venvPython"
    }
}

# Write-ServerStopHeader: Displays the shutdown header and script information
function Write-ServerStopHeader {
    Write-Host "Translation Server Shutdown"
    Write-Host ("=" * 40)
    if ($Verbose) {
        Write-Host "Script Directory: $scriptDir"
        Write-Host "Backend Directory: $backendDir"
        Write-Host "PID File Path: $pidPath"
    }
}

# Get-ProcessInfo: Retrieves detailed information about a process
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

# Write-ProcessLog: Logs process information in formatted output
function Write-ProcessLog {
    param([string]$Message, [psobject]$ProcessInfo = $null)

    if ($ProcessInfo) {
        Write-Host "$Message`n   -> PID: $($ProcessInfo.Id)`n   -> Name: $($ProcessInfo.Name)`n   -> CPU: $($ProcessInfo.CPU)s`n   -> Memory: $($ProcessInfo.Memory)MB`n   -> Start: $($ProcessInfo.StartTime)`n   -> Command: $($ProcessInfo.CommandLine)"
    } else {
        Write-Host $Message
    }
}



# Stop-ProcessWithLogging: Stops a process with logging, trying graceful stop first
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

# Stop-AllProcesses: Stops the main process and all its child processes
function Stop-AllProcesses {
    param([int]$MainProcessId)

    $mainInfo = Get-ProcessInfo -ProcessId $MainProcessId
    Write-ProcessLog -Message "Shutting down server process:" -ProcessInfo $mainInfo

    # Step 1: Find all child processes
    $childProcesses = @(Get-ChildProcesses -ParentId $MainProcessId)
    if ($Verbose) { Write-Host "Found $($childProcesses.Count) child processes to stop." }

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

# Test-ServerStatus: Checks if the server process is currently running
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

# Test-PidFile: Reads and validates the process ID from the PID file
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

# Get-ChildProcesses: Recursively finds all child processes of a parent process
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

# Remove-PidFile: Removes the PID file if it exists
function Remove-PidFile {
    if (Test-Path $pidPath) {
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
        if ($Verbose) { Write-Host "Cleaned up PID file: $pidPath" }
    }
}

# Main execution: Orchestrates the server shutdown process
try {
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

} catch {
    Write-Error "Shutdown failed: $($_.Exception.Message)"
    exit 1
}
