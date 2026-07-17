# Sets YouTube (+ optional Drive / Gemini) GitHub Actions secrets from .env.local
# Requires: gh auth login
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repoRoot '.env.local'

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile"
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $eq = $line.IndexOf('=')
  if ($eq -lt 1) { return }
  $key = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
  $vars[$key] = $value
}

$required = @('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN')
foreach ($name in $required) {
  if (-not $vars[$name]) {
    Write-Error "Missing $name in .env.local"
  }
}

$optional = @('GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_DRIVE_WATCH_FOLDER_ID', 'GEMINI_API_KEY', 'GEMINI_API_KEYS')

gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "GitHub CLI not logged in. Run: gh auth login"
}

Set-Location $repoRoot
foreach ($name in $required) {
  Write-Host "Setting secret $name ..."
  $vars[$name] | gh secret set $name
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set $name"
  }
}

foreach ($name in $optional) {
  if (-not $vars[$name]) {
    Write-Host "Skipping optional secret $name (not in .env.local)"
    continue
  }
  Write-Host "Setting secret $name ..."
  $vars[$name] | gh secret set $name
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set $name"
  }
}

Write-Host ""
Write-Host "Done. Verify: gh secret list"
gh secret list
