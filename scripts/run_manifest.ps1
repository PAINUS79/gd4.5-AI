$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

if ($args.Count -lt 1) {
  Write-Host "Usage: run_manifest.ps1 <npm_script> [extra args...]"
  exit 2
}

$npmScript = $args[0]
$rest = @()
if ($args.Count -gt 1) { $rest = $args[1..($args.Count-1)] }

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
  & npm run $npmScript -- @rest
  exit $LASTEXITCODE
}

$corepackCmd = Get-Command corepack -ErrorAction SilentlyContinue
if ($corepackCmd) {
  & corepack npm run $npmScript -- @rest
  exit $LASTEXITCODE
}

Write-Host "ERROR: npm not found in PATH and corepack unavailable."
exit 127
