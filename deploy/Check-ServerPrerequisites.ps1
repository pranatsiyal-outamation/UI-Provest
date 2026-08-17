<#
.SYNOPSIS
    Read-only preflight check for hosting the ProVest FM Admin Tool on an IIS server.

.DESCRIPTION
    Reports what the server has and what it is missing. It is safe to run on a shared
    development server while other people are working on it.

    THIS SCRIPT MAKES NO CHANGES. It only reads:
      - OS and disk information
      - Installed Windows features and registry keys
      - IIS sites, app pools and modules (listing only)
      - Installed .NET runtimes
      - TCP reachability of the SQL Server

    It does not install anything, does not create or modify sites or app pools, does
    not write files outside the console, and does not restart any service.

.PARAMETER SqlServer
    Host name or IP of the SQL Server the app will connect to.

.PARAMETER SqlPort
    Port of that SQL Server instance.

.PARAMETER SkipSqlCheck
    Skip the database reachability test.

.EXAMPLE
    .\Check-ServerPrerequisites.ps1

.EXAMPLE
    .\Check-ServerPrerequisites.ps1 -SqlServer 10.1.0.12 -SqlPort 3310
#>

[CmdletBinding()]
param(
    [string] $SqlServer = '10.1.0.12',
    [int]    $SqlPort   = 3310,
    [switch] $SkipSqlCheck
)

$ErrorActionPreference = 'Continue'

# --------------------------------------------------------------------------------
# Result collection
# --------------------------------------------------------------------------------

$script:Results = @()

function Add-Result {
    param(
        [Parameter(Mandatory)][string] $Area,
        [Parameter(Mandatory)][string] $Check,
        [Parameter(Mandatory)][ValidateSet('PASS', 'FAIL', 'WARN', 'INFO')][string] $Status,
        [string] $Detail = '',
        # What breaks if this is missing. Only meaningful for FAIL/WARN.
        [string] $Impact = ''
    )
    $script:Results += [pscustomobject]@{
        Area = $Area; Check = $Check; Status = $Status; Detail = $Detail; Impact = $Impact
    }
}

function Write-Section($title) {
    Write-Host ''
    Write-Host "-- $title " -NoNewline -ForegroundColor Cyan
    Write-Host ('-' * [Math]::Max(0, 74 - $title.Length)) -ForegroundColor DarkCyan
}

Write-Host ''
Write-Host '================================================================================' -ForegroundColor White
Write-Host ' ProVest FM Admin Tool - server prerequisite check' -ForegroundColor White
Write-Host ' READ-ONLY. This script does not change anything on this server.' -ForegroundColor Yellow
Write-Host '================================================================================' -ForegroundColor White
Write-Host ("Machine : {0}" -f $env:COMPUTERNAME)
Write-Host ("User    : {0}\{1}" -f $env:USERDOMAIN, $env:USERNAME)
Write-Host ("Time    : {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ''
    Write-Host 'NOTE: not running elevated. IIS feature and module checks may be incomplete.' -ForegroundColor Yellow
    Write-Host '      Re-run as Administrator for a full picture. Still makes no changes.' -ForegroundColor Yellow
}

# --------------------------------------------------------------------------------
# System
# --------------------------------------------------------------------------------

Write-Section 'System'

try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    Add-Result 'System' 'Operating system' 'INFO' "$($os.Caption) ($($os.Version))"
    Write-Host ("  OS            : {0} {1}" -f $os.Caption, $os.Version)
} catch {
    Add-Result 'System' 'Operating system' 'WARN' $_.Exception.Message
}

try {
    $arch = $env:PROCESSOR_ARCHITECTURE
    Add-Result 'System' 'Architecture' 'INFO' $arch
    Write-Host ("  Architecture  : {0}" -f $arch)
} catch { }

try {
    $sysDrive = ($env:SystemDrive).TrimEnd(':')
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'" -ErrorAction Stop
    $freeGb = [Math]::Round($disk.FreeSpace / 1GB, 1)
    $status = if ($freeGb -lt 2) { 'WARN' } else { 'PASS' }
    Add-Result 'System' 'Free disk space' $status "$freeGb GB free on $($env:SystemDrive)" `
        'A publish needs a few hundred MB; under 2 GB is worth a look before deploying.'
    Write-Host ("  Free space    : {0} GB on {1}" -f $freeGb, $env:SystemDrive)
} catch {
    Add-Result 'System' 'Free disk space' 'WARN' $_.Exception.Message
}

# --------------------------------------------------------------------------------
# IIS
# --------------------------------------------------------------------------------

Write-Section 'IIS'

$iisInstalled = $false
try {
    $inetstp = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\InetStp' -ErrorAction Stop
    $iisVersion = "$($inetstp.MajorVersion).$($inetstp.MinorVersion)"
    $iisInstalled = $true
    Add-Result 'IIS' 'IIS installed' 'PASS' "version $iisVersion"
    Write-Host ("  IIS version   : {0}" -f $iisVersion)
} catch {
    Add-Result 'IIS' 'IIS installed' 'FAIL' 'HKLM:\SOFTWARE\Microsoft\InetStp not found' `
        'Nothing can be hosted without IIS.'
    Write-Host '  IIS           : NOT DETECTED' -ForegroundColor Red
}

try {
    $w3svc = Get-Service W3SVC -ErrorAction Stop
    $status = if ($w3svc.Status -eq 'Running') { 'PASS' } else { 'WARN' }
    Add-Result 'IIS' 'World Wide Web Publishing Service' $status "status: $($w3svc.Status)" `
        'IIS is installed but not serving.'
    Write-Host ("  W3SVC         : {0}" -f $w3svc.Status)
} catch {
    Add-Result 'IIS' 'World Wide Web Publishing Service' 'FAIL' 'service not found' `
        'IIS is not installed or not functional.'
}

# --------------------------------------------------------------------------------
# .NET runtime
# --------------------------------------------------------------------------------

Write-Section '.NET runtime (the API targets net8.0)'

$dotnetOnPath = $null
try { $dotnetOnPath = (Get-Command dotnet -ErrorAction Stop).Source } catch { }

if ($dotnetOnPath) {
    Add-Result '.NET' 'dotnet on PATH' 'PASS' $dotnetOnPath
    Write-Host ("  dotnet        : {0}" -f $dotnetOnPath)

    try {
        $runtimes = & dotnet --list-runtimes 2>$null
        $aspnet8 = $runtimes | Where-Object { $_ -match '^Microsoft\.AspNetCore\.App 8\.' }

        if ($aspnet8) {
            $versions = ($aspnet8 | ForEach-Object { ($_ -split ' ')[1] }) -join ', '
            Add-Result '.NET' 'ASP.NET Core 8 runtime' 'PASS' $versions
            Write-Host ("  ASP.NET Core 8: {0}" -f $versions) -ForegroundColor Green
        } else {
            $found = ($runtimes | Where-Object { $_ -match '^Microsoft\.AspNetCore\.App' }) -join '; '
            Add-Result '.NET' 'ASP.NET Core 8 runtime' 'FAIL' "not found. Present: $found" `
                'The API targets net8.0 and will not start. Install the ASP.NET Core 8 Hosting Bundle, or publish self-contained.'
            Write-Host '  ASP.NET Core 8: MISSING' -ForegroundColor Red
        }

        Write-Host ''
        Write-Host '  All installed runtimes:'
        $runtimes | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    } catch {
        Add-Result '.NET' 'ASP.NET Core 8 runtime' 'WARN' "could not list runtimes: $($_.Exception.Message)"
    }
} else {
    Add-Result '.NET' 'dotnet on PATH' 'WARN' 'not found on PATH' `
        'Not fatal by itself -- IIS can host without dotnet on PATH -- but it means the runtime check below could not run.'
    Write-Host '  dotnet        : not on PATH' -ForegroundColor Yellow
}

# --------------------------------------------------------------------------------
# IIS modules
# --------------------------------------------------------------------------------

Write-Section 'IIS modules'

# ASP.NET Core Module V2 -- installed by the Hosting Bundle, required to host the API.
$ancmPaths = @(
    "$env:ProgramFiles\IIS\Asp.Net Core Module\V2\aspnetcorev2.dll",
    "${env:ProgramFiles(x86)}\IIS\Asp.Net Core Module\V2\aspnetcorev2.dll"
)
$ancm = $ancmPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($ancm) {
    $ver = (Get-Item $ancm).VersionInfo.ProductVersion
    Add-Result 'IIS modules' 'ASP.NET Core Module V2' 'PASS' "$ancm (v$ver)"
    Write-Host ("  ANCM v2       : present (v{0})" -f $ver) -ForegroundColor Green
} else {
    Add-Result 'IIS modules' 'ASP.NET Core Module V2' 'FAIL' 'aspnetcorev2.dll not found' `
        'IIS cannot host an ASP.NET Core app. Install the ASP.NET Core Hosting Bundle.'
    Write-Host '  ANCM v2       : MISSING' -ForegroundColor Red
}

# URL Rewrite -- needed so deep links and refreshes fall back to index.html.
$rewriteKeys = @(
    'HKLM:\SOFTWARE\Microsoft\IIS Extensions\URL Rewrite',
    'HKLM:\SOFTWARE\Wow6432Node\Microsoft\IIS Extensions\URL Rewrite'
)
$rewrite = $null
foreach ($k in $rewriteKeys) {
    try { $rewrite = Get-ItemProperty $k -ErrorAction Stop; break } catch { }
}

if ($rewrite) {
    Add-Result 'IIS modules' 'URL Rewrite' 'PASS' "version $($rewrite.Version)"
    Write-Host ("  URL Rewrite   : present (v{0})" -f $rewrite.Version) -ForegroundColor Green
} else {
    Add-Result 'IIS modules' 'URL Rewrite' 'FAIL' 'registry key not found' `
        'The React app is a single-page app: without rewrite, refreshing on /clients returns 404 because no such file exists. The API itself would still work.'
    Write-Host '  URL Rewrite   : MISSING' -ForegroundColor Red
}

# --------------------------------------------------------------------------------
# Node -- BUILD ONLY
# --------------------------------------------------------------------------------

Write-Section 'Node.js (build-time only, not needed to serve)'

Write-Host '  The React app compiles to static HTML/CSS/JS. IIS serves those files directly;'
Write-Host '  Node is only required if you run "npm run build" ON this server. Building on a'
Write-Host '  workstation and copying dist/ across needs no Node here at all.'
Write-Host ''

$nodeCmd = $null
try { $nodeCmd = Get-Command node -ErrorAction Stop } catch { }

if ($nodeCmd) {
    $nodeVersion = (& node --version 2>$null)
    $major = 0
    if ($nodeVersion -match '^v(\d+)\.') { $major = [int]$Matches[1] }

    if ($major -ge 20) {
        Add-Result 'Node' 'Node.js (build only)' 'PASS' "$nodeVersion at $($nodeCmd.Source)"
        Write-Host ("  node          : {0}" -f $nodeVersion) -ForegroundColor Green
    } else {
        Add-Result 'Node' 'Node.js (build only)' 'WARN' "$nodeVersion -- Vite 8 needs Node 20+" `
            'Only matters if you build on this server.'
        Write-Host ("  node          : {0} (Vite 8 wants Node 20+)" -f $nodeVersion) -ForegroundColor Yellow
    }

    try {
        $npmVersion = (& npm --version 2>$null)
        Add-Result 'Node' 'npm (build only)' 'INFO' $npmVersion
        Write-Host ("  npm           : {0}" -f $npmVersion)
    } catch { }
} else {
    Add-Result 'Node' 'Node.js (build only)' 'INFO' 'not installed' `
        'Fine, as long as the frontend is built elsewhere and dist/ is copied over.'
    Write-Host '  node          : not installed (fine if you build elsewhere)' -ForegroundColor DarkGray
}

# --------------------------------------------------------------------------------
# Database reachability
# --------------------------------------------------------------------------------

Write-Section "Database reachability ($SqlServer`:$SqlPort)"

if ($SkipSqlCheck) {
    Write-Host '  skipped (-SkipSqlCheck)' -ForegroundColor DarkGray
    Add-Result 'Database' 'SQL Server reachable' 'INFO' 'skipped'
} else {
    try {
        $tcp = Test-NetConnection -ComputerName $SqlServer -Port $SqlPort -WarningAction SilentlyContinue
        if ($tcp.TcpTestSucceeded) {
            Add-Result 'Database' 'SQL Server reachable' 'PASS' "TCP $SqlServer`:$SqlPort open"
            Write-Host ("  TCP {0}:{1} : reachable" -f $SqlServer, $SqlPort) -ForegroundColor Green
        } else {
            Add-Result 'Database' 'SQL Server reachable' 'FAIL' "TCP $SqlServer`:$SqlPort refused or timed out" `
                'The API cannot reach the database. Check firewall and routing from this server.'
            Write-Host ("  TCP {0}:{1} : NOT reachable" -f $SqlServer, $SqlPort) -ForegroundColor Red
        }
    } catch {
        Add-Result 'Database' 'SQL Server reachable' 'WARN' $_.Exception.Message
    }

    Write-Host ''
    Write-Host '  NOTE: this only proves the port is open from this machine, as YOU.' -ForegroundColor Yellow
    Write-Host '        The app connects as the app pool identity with Integrated Security,' -ForegroundColor Yellow
    Write-Host '        so that account still needs its own SQL login and permissions.' -ForegroundColor Yellow
    Write-Host '        This script cannot verify that without impersonating it.' -ForegroundColor Yellow
}

# --------------------------------------------------------------------------------
# What is already on the box
# --------------------------------------------------------------------------------

Write-Section 'Existing IIS sites and app pools (for context, nothing is modified)'

$iisModuleLoaded = $false
try {
    Import-Module WebAdministration -ErrorAction Stop
    $iisModuleLoaded = $true
} catch {
    Write-Host '  WebAdministration module unavailable (needs elevation) - skipping.' -ForegroundColor Yellow
    Add-Result 'IIS' 'Site inventory' 'INFO' 'skipped, WebAdministration unavailable'
}

if ($iisModuleLoaded) {
    try {
        Write-Host '  Sites:'
        Get-ChildItem IIS:\Sites -ErrorAction Stop | ForEach-Object {
            $bindings = ($_.Bindings.Collection | ForEach-Object { $_.bindingInformation }) -join ', '
            Write-Host ("    {0,-28} {1,-9} {2}" -f $_.Name, $_.State, $bindings)
        }

        Write-Host ''
        Write-Host '  App pools:'
        Get-ChildItem IIS:\AppPools -ErrorAction Stop | ForEach-Object {
            Write-Host ("    {0,-28} {1,-9} CLR: {2,-8} {3}" -f `
                $_.Name, $_.State, $(if ($_.managedRuntimeVersion) { $_.managedRuntimeVersion } else { 'No Managed Code' }), $_.processModel.identityType)
        }

        Add-Result 'IIS' 'Site inventory' 'INFO' 'listed above'
    } catch {
        Add-Result 'IIS' 'Site inventory' 'WARN' $_.Exception.Message
    }

    Write-Host ''
    Write-Host '  A "No Managed Code" pool is what an ASP.NET Core app needs -- the runtime is' -ForegroundColor DarkGray
    Write-Host '  loaded by ANCM, not by the CLR IIS would otherwise start.' -ForegroundColor DarkGray
}

# --------------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------------

Write-Host ''
Write-Host '================================================================================' -ForegroundColor White
Write-Host ' SUMMARY' -ForegroundColor White
Write-Host '================================================================================' -ForegroundColor White

$script:Results |
    Where-Object { $_.Status -ne 'INFO' } |
    Format-Table @{ L = 'Status'; E = { $_.Status }; W = 7 },
                 @{ L = 'Area';   E = { $_.Area };   W = 12 },
                 @{ L = 'Check';  E = { $_.Check };  W = 34 },
                 @{ L = 'Detail'; E = { $_.Detail } } -AutoSize |
    Out-String -Width 200 | Write-Host

$fails = @($script:Results | Where-Object { $_.Status -eq 'FAIL' })
$warns = @($script:Results | Where-Object { $_.Status -eq 'WARN' })

if ($fails.Count -gt 0) {
    Write-Host 'BLOCKERS' -ForegroundColor Red
    foreach ($f in $fails) {
        Write-Host ("  [{0}] {1}" -f $f.Area, $f.Check) -ForegroundColor Red
        Write-Host ("      found  : {0}" -f $f.Detail)
        if ($f.Impact) { Write-Host ("      impact : {0}" -f $f.Impact) }
    }
    Write-Host ''
}

if ($warns.Count -gt 0) {
    Write-Host 'WARNINGS' -ForegroundColor Yellow
    foreach ($w in $warns) {
        Write-Host ("  [{0}] {1} - {2}" -f $w.Area, $w.Check, $w.Detail) -ForegroundColor Yellow
        if ($w.Impact) { Write-Host ("      {0}" -f $w.Impact) }
    }
    Write-Host ''
}

if ($fails.Count -eq 0) {
    Write-Host 'No blockers found. The server can host this application.' -ForegroundColor Green
} else {
    Write-Host ("{0} blocker(s) found - see above." -f $fails.Count) -ForegroundColor Red
}

Write-Host ''
Write-Host 'Nothing on this server was modified by this script.' -ForegroundColor Cyan
Write-Host ''

exit $(if ($fails.Count -gt 0) { 1 } else { 0 })
