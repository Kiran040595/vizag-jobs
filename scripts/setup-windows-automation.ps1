# Registers Windows Scheduled Tasks for VizagJobs automation:
# - Morning Run: 8:30 AM daily (once)
# - Evening Run: 6:30 PM daily (once)
# - Logon / PC Power-on: Checks if within window and executes automatically

$scriptPath = "D:\School Project\VIzagJobs\scripts\run-daily-career-automation.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

# 1. Morning Trigger: 08:30 AM daily
$morningTrigger = New-ScheduledTaskTrigger -Daily -At 8:30AM

# 2. Evening Trigger: 06:30 PM daily
$eveningTrigger = New-ScheduledTaskTrigger -Daily -At 6:30PM

# 3. Logon / Power-on trigger
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn

try {
  Register-ScheduledTask -TaskName "VizagJobs_Career_Morning" -Action $action -Trigger $morningTrigger -Settings $settings -Description "Runs VizagJobs career scraper daily at 8:30 AM" -Force | Out-Null
  Register-ScheduledTask -TaskName "VizagJobs_Career_Evening" -Action $action -Trigger $eveningTrigger -Settings $settings -Description "Runs VizagJobs career scraper daily at 6:30 PM" -Force | Out-Null
  Register-ScheduledTask -TaskName "VizagJobs_Career_Logon" -Action $action -Trigger $logonTrigger -Settings $settings -Description "Runs VizagJobs career scraper on logon when PC powers on" -Force | Out-Null
  Write-Host "Successfully registered Windows Scheduled Tasks for VizagJobs career automation!"
  Write-Host "Tasks configured:"
  Write-Host " - VizagJobs_Career_Morning (Daily at 08:30 AM)"
  Write-Host " - VizagJobs_Career_Evening (Daily at 06:30 PM)"
  Write-Host " - VizagJobs_Career_Logon (on PC start/login)"
} catch {
  Write-Warning "Could not register task: $_"
}
