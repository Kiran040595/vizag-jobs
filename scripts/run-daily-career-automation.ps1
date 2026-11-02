param(
  [switch]$Force
)

$currentHour = (Get-Date).Hour
$isMorningWindow = ($currentHour -ge 6 -and $currentHour -lt 10)
$isEveningWindow = ($currentHour -ge 18 -and $currentHour -lt 22)

if (-not $Force -and -not ($isMorningWindow -or $isEveningWindow)) {
  Write-Host "Current time ($((Get-Date).ToString('HH:mm'))) is outside active windows (06:00-10:00 and 18:00-22:00). Skipping."
  exit 0
}

$repoPath = "D:\School Project\VIzagJobs"
Set-Location $repoPath

$logDir = Join-Path $repoPath "logs"
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$logFile = Join-Path $logDir "career-automation-$timestamp.log"

Write-Host "[$((Get-Date).ToString('s'))] Starting VizagJobs career automation..." | Tee-Object -FilePath $logFile -Append

try {
  & node scripts/auto-company-careers.mjs 2>&1 | Tee-Object -FilePath $logFile -Append
  Write-Host "[$((Get-Date).ToString('s'))] Finished career automation." | Tee-Object -FilePath $logFile -Append
} catch {
  Write-Host "[$((Get-Date).ToString('s'))] Error running automation: $_" | Tee-Object -FilePath $logFile -Append
}
