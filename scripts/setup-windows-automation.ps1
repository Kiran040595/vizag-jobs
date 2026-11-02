# Registers Windows Scheduled Tasks for VizagJobs automation:
# - Morning Window: 6:00 AM - 10:00 AM (runs daily, repeats every 1 hour)
# - Evening Window: 6:00 PM - 10:00 PM (runs daily, repeats every 1 hour)
# - Logon / PC Power-on: Checks if within window and executes automatically

$scriptPath = "D:\School Project\VIzagJobs\scripts\run-daily-career-automation.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

# 1. Morning Trigger: 06:00 AM repeating every 1 hour for 4 hours
$morningTrigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$morningTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At 6:00AM -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 4)).Repetition

# 2. Evening Trigger: 06:00 PM repeating every 1 hour for 4 hours
$eveningTrigger = New-ScheduledTaskTrigger -Daily -At 6:00PM
$eveningTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At 6:00PM -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 4)).Repetition

# 3. Logon / Power-on trigger
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn

try {
  Register-ScheduledTask -TaskName "VizagJobs_Career_Morning" -Action $action -Trigger $morningTrigger -Settings $settings -Description "Runs VizagJobs career scraper between 6am and 10am" -Force | Out-Null
  Register-ScheduledTask -TaskName "VizagJobs_Career_Evening" -Action $action -Trigger $eveningTrigger -Settings $settings -Description "Runs VizagJobs career scraper between 6pm and 10pm" -Force | Out-Null
  Register-ScheduledTask -TaskName "VizagJobs_Career_Logon" -Action $action -Trigger $logonTrigger -Settings $settings -Description "Runs VizagJobs career scraper on logon when PC powers on" -Force | Out-Null
  Write-Host "Successfully registered Windows Scheduled Tasks for VizagJobs career automation!"
  Write-Host "Tasks configured:"
  Write-Host " - VizagJobs_Career_Morning (06:00 - 10:00, hourly, catch-up on power on)"
  Write-Host " - VizagJobs_Career_Evening (18:00 - 22:00, hourly, catch-up on power on)"
  Write-Host " - VizagJobs_Career_Logon (on PC start/login, runs if within active windows)"
} catch {
  Write-Warning "Could not register task: $_"
}
