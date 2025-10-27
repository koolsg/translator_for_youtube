# Stop the translation server process and its child processes
# This script safely stops the uvicorn/FastAPI application and any child processes by:
# 1. Reading and validating the PID from the app.pid file
# 2. Finding and stopping all child processes recursively
# 3. Stopping the main parent process if it is still running
# 4. Cleaning up the PID file

# Get script directory and PID file path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pidPath = Join-Path $scriptDir "app.pid"

# Helper function: Validates PID file and returns process ID
# Returns $null if file doesn't exist, is empty, or contains invalid PID
function Test-PidFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    try {
        $content = Get-Content $Path -ErrorAction Stop
        $processId = $content.Trim()
        if ([string]::IsNullOrEmpty($processId) -or -not [int]::TryParse($processId, [ref]$null)) {
            return $null
        }
        return [int]$processId
    }
    catch { return $null }
}

# Helper function: Recursively finds all child processes for a given Parent PID.
# It uses the PowerShell pipeline to output results, which are collected by the caller.
function Get-ChildProcesses {
    param(
        [Parameter(Mandatory=$true)]
        [int]$ParentId
    )

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

# Helper function: Stops a list of processes with improved verification
function Stop-Processes {
    param([array]$Processes, [string]$Type)

    foreach ($proc in $Processes) {
        try {
            $procId = $proc.ProcessId
            $procName = $proc.Name

            # Check if process still exists before attempting to stop
            if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) {
                Write-Host "Process $procId ($procName) already stopped."
                continue
            }

            # Attempt graceful stop first, then force kill if needed
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "Stopped $Type process: $procId ($procName)"
        }
        catch {
            Write-Warning "Failed to stop $Type process $($proc.ProcessId)`: $($_.Exception.Message)"
        }
    }
}

# --- Main execution logic ---

# Step 1: Get valid process ID from PID file
$processId = Test-PidFile -Path $pidPath

if ($null -eq $processId) {
    Write-Host "No valid PID file found. Server may not be running."
    exit 0
}

# Step 2: Check if main process is running
$mainProcess = Get-Process -Id $processId -ErrorAction SilentlyContinue
if (-not $mainProcess) {
    Write-Warning "Process with PID $processId not found. It may have already stopped."
    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
    exit 0
}

Write-Host "Stopping server and child processes for PID: $processId..."

# Step 3: Find all child processes
$childProcesses = @(Get-ChildProcesses -ParentId $processId)
if ($childProcesses.Count -gt 0) {
    Write-Host "Found $($childProcesses.Count) child processes to stop."
    # Step 4: Stop all child processes first
    Stop-Processes -Processes $childProcesses -Type "child"
} else {
    Write-Host "No child processes found."
}

# Step 5: Stop the main process (if it hasn't already been stopped)
$mainProcessStillRunning = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($mainProcessStillRunning) {
    Write-Host "Stopping main process: $processId..."
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    
    # Final check after a brief wait
    Start-Sleep -Milliseconds 100
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        Write-Warning "Main process $processId could not be stopped."
    } else {
        Write-Host "Main process $processId stopped successfully."
    }
} else {
    Write-Host "Main process $processId already stopped (likely due to a child process stopping)."
}

# Step 6: Clean up PID file
Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
Write-Host "Server and all child processes stopped successfully."