param([switch] $Check)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
    throw 'The 64-bit .NET Framework C# compiler was not found. Install .NET Framework 4.8 and build on Windows.'
}

$outputRoot = Join-Path $projectRoot 'build'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$sources = @('Core.cs', 'DiscordConnection.cs', 'ActivityReader.cs', 'PresenceWindow.cs') | ForEach-Object {
    Join-Path $projectRoot ('src/' + $_)
}
$icon = Join-Path $projectRoot 'assets/codex.ico'
$resources = @('thinking', 'coding', 'sleeping') | ForEach-Object {
    '/resource:' + (Join-Path $projectRoot ('assets/' + $_ + '.gif')) + ',' + $_ + '.gif'
}
$resources += '/resource:' + $icon + ',codex.ico'
$common = @(
    '/nologo', '/warnaserror+', '/langversion:5', '/platform:x64', '/optimize+', '/codepage:65001',
    '/reference:System.Windows.Forms.dll,System.Drawing.dll,System.Web.Extensions.dll'
)
$application = Join-Path $outputRoot 'CodexDiscordPresence.exe'
& $compiler @common /target:winexe @resources ('/win32icon:' + $icon) ('/out:' + $application) @sources
if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }

if ($Check) {
    foreach ($checkName in @('ReaderChecks', 'RuntimeChecks')) {
        $checkExe = Join-Path $outputRoot ($checkName + '.exe')
        $checkSource = Join-Path $projectRoot ('tests/' + $checkName + '.cs')
        & $compiler @common /target:exe ('/main:' + $checkName) ('/out:' + $checkExe) @sources $checkSource
        if ($LASTEXITCODE -ne 0) { throw ($checkName + ' did not compile.') }
        if ($checkName -eq 'ReaderChecks') {
            & $checkExe (Join-Path $outputRoot ('test-data-' + [Guid]::NewGuid().ToString('N')))
        } else {
            & $checkExe
        }
        if ($LASTEXITCODE -ne 0) { throw ($checkName + ' failed.') }
    }
}

Get-FileHash -LiteralPath $application -Algorithm SHA256 | Select-Object Path, Hash

