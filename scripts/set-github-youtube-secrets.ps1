# Sets YouTube GitHub Actions secrets from .env.local (requires: gh auth login)
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

Write-Host ""
Write-Host "Done. Verify: gh secret list"
gh secret list
