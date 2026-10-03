<#
.SYNOPSIS
    Synchronizes officially released government UAP packs (R01..RN) and watches for future drops.

.DESCRIPTION
    Scrapes the official portal manifest on https://www.war.gov/ufo/, audits local storage,
    and downloads missing packs upon user approval.

.PARAMETER Check
    Audit existing files against the live portal without downloading.

.PARAMETER Approve
    Auto-approve downloading of all missing packs without prompting.

.PARAMETER Watch
    Continuously monitor war.gov/ufo for newly dropped release tranches (e.g. R07+).

.PARAMETER TargetDir
    Custom download destination directory (defaults to D:\Downloads (D)\.2026\WARdotGOV\UAP File Dumps).

.EXAMPLE
    .\sync-packs.ps1 -Check
    .\sync-packs.ps1 -Approve
    .\sync-packs.ps1 -Watch
#>
[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$Approve,
    [switch]$Watch,
    [string]$TargetDir
)

$scriptPath = Join-Path $PSScriptRoot "scripts\sync-government-packs.js"
$cliArgs = [System.Collections.Generic.List[string]]::new()

if ($Check) { $cliArgs.Add("--check") }
if ($Approve) { $cliArgs.Add("--approve") }
if ($Watch) { $cliArgs.Add("--watch") }
if ($TargetDir) {
    $cliArgs.Add("--target")
    $cliArgs.Add("`"$TargetDir`"")
}

& node $scriptPath ($cliArgs -join " ")
