param(
  [switch]$Force,
  [int]$Limit = 10
)

$repoPath = "D:\School Project\VIzagJobs"
Set-Location $repoPath

$logDir = Join-Path $repoPath "logs"
if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$stateFile = Join-Path $logDir "daily-portal-verify-state.json"
$today = (Get-Date).ToString("yyyy-MM-dd")

if (-not $Force -and (Test-Path $stateFile)) {
  try {
    $state = Get-Content $stateFile -Raw | ConvertFrom-Json
    if ($state.lastRunDate -eq $today) {
      Write-Host "[$today] Daily portal verification already ran today. Skipping."
      exit 0
    }
  } catch { }
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$logFile = Join-Path $logDir "daily-portal-verify-$timestamp.log"

Write-Host "[$((Get-Date).ToString('s'))] Starting daily 10-company Vizag portal verification..." | Tee-Object -FilePath $logFile -Append

try {
  $nodeArgs = @("scripts/auto-verify-company-portals-daily.mjs", "--limit", "$Limit")
  if ($Force) { $nodeArgs += "--force" }
  & node $nodeArgs 2>&1 | Tee-Object -FilePath $logFile -Append

  $docFiles = @(
    "docs/qa/2026-11-01/company-career-verification.md",
    "docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md"
  )
  $changedDocs = & git diff --name-only -- $docFiles

  if ($changedDocs) {
    Write-Host "[$((Get-Date).ToString('s'))] Running scraper regression tests before push..." | Tee-Object -FilePath $logFile -Append
    & node --test tests/company-career-fetch.test.mjs 2>&1 | Tee-Object -FilePath $logFile -Append

    if ($LASTEXITCODE -eq 0) {
      & git add -- $docFiles 2>&1 | Tee-Object -FilePath $logFile -Append
      & git commit -m "chore(careers): daily verified Vizag portals batch ($today)" 2>&1 | Tee-Object -FilePath $logFile -Append
      & git pull --rebase origin develop 2>&1 | Tee-Object -FilePath $logFile -Append
      & git push origin develop 2>&1 | Tee-Object -FilePath $logFile -Append
      Write-Host "[$((Get-Date).ToString('s'))] Pushed daily verification batch to origin/develop." | Tee-Object -FilePath $logFile -Append
    } else {
      Write-Host "[$((Get-Date).ToString('s'))] Tests failed; skipping git commit/push." | Tee-Object -FilePath $logFile -Append
    }
  } else {
    Write-Host "[$((Get-Date).ToString('s'))] No new verified portals in today's batch; nothing to commit." | Tee-Object -FilePath $logFile -Append
  }
} catch {
  Write-Host "[$((Get-Date).ToString('s'))] Error in daily portal verification: $_" | Tee-Object -FilePath $logFile -Append
}
