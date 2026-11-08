param(
  [string]$Filter = '*',
  [string]$GamePath = 'game.json',
  [switch]$Visible
)
$ErrorActionPreference = 'Stop'
$rescueRoot = Split-Path -Parent $PSScriptRoot
$rescueGame = if ([System.IO.Path]::IsPathRooted($GamePath)) { $GamePath } else { Join-Path $rescueRoot $GamePath }
if (-not (Test-Path -LiteralPath $rescueGame)) { throw ('Game file not found: ' + $rescueGame) }
$rescueGame = (Resolve-Path -LiteralPath $rescueGame).Path
$rescueWorkspace = Split-Path -Parent $rescueRoot
$rescueRuntime = Join-Path $rescueWorkspace '.local\gdevelop\runtime'
$rescueEvidence = Join-Path $rescueRoot 'evidence'
New-Item -ItemType Directory -Path $rescueEvidence -Force | Out-Null
$rescueRun = Join-Path $rescueEvidence ('runs\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $rescueRun -Force | Out-Null
$rescueProfile = Join-Path $rescueRun 'gdevelop-profile'
New-Item -ItemType Directory -Path $rescueProfile -Force | Out-Null
$rescueResult = Join-Path $rescueRun 'gameplay-results.json'
$rescueArgs = @(('"' + $rescueGame + '"'), '--run-command', 'RUN_ALL_TESTS', '--results-path', ('"' + $rescueResult + '"'), '--disable-update-check', '--json', ('--user-data-dir="' + $rescueProfile + '"'))
if ($Filter -ne '*') {
  $rescueTestFilter = $Filter -replace '\.gameplay\.js$', ''
  $rescueArgs += @('--cmd-args', ('"' + $rescueTestFilter + '"'))
}
$startProcessArgs = @{
  FilePath = (Join-Path $rescueRuntime 'GDevelop.exe')
  ArgumentList = $rescueArgs
  WorkingDirectory = $rescueRuntime
  RedirectStandardOutput = (Join-Path $rescueRun 'cli.out.log')
  RedirectStandardError = (Join-Path $rescueRun 'cli.err.log')
  PassThru = $true
}
if (-not $Visible) { $startProcessArgs.WindowStyle = 'Hidden' }
$rescueProcess = Start-Process @startProcessArgs
Write-Output ('GDevelop test PID: ' + $rescueProcess.Id)
if (-not $rescueProcess.WaitForExit(180000)) { $rescueProcess.Kill(); throw ('GDevelop tests exceeded 180 seconds; inspect ' + $rescueRun) }
if (-not (Test-Path -LiteralPath $rescueResult)) { throw 'No gameplay report produced. Inspect evidence/cli.err.log.' }
$rescueReport = Get-Content -LiteralPath $rescueResult -Raw -Encoding utf8 | ConvertFrom-Json
if ($rescueReport.Count -eq 0) { throw 'GDevelop returned no tests; an empty run is not a pass.' }
Copy-Item -LiteralPath $rescueResult -Destination (Join-Path $rescueEvidence 'gameplay-results.json')
foreach ($rescueTest in $rescueReport) { Write-Output ($rescueTest.testName + ': ' + $rescueTest.status + ' (' + $rescueTest.framesExecuted + ' frames)'); if ($rescueTest.status -ne 'passed') { $rescueTest.errors | ForEach-Object { Write-Output $_ } } }
if (@($rescueReport | Where-Object { $_.status -ne 'passed' }).Count -gt 0) { exit 1 }
