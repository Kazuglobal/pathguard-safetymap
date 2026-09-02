[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Manifest,
  [string]$SupabaseRemote = "supabase-storage",
  [string]$PublicR2Remote = "r2-public",
  [string]$PrivateR2Remote = "r2-private",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) { throw "rclone is required." }
$manifestPath = (Resolve-Path -LiteralPath $Manifest).Path
$moves = [System.Collections.Generic.List[object]]::new()
$destinations = @{}

foreach ($line in [System.IO.File]::ReadLines($manifestPath)) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $move = $line | ConvertFrom-Json
  if ($move.source -notmatch "^[^/]+/.+" -or $move.destinationBucket -notin @("public", "private") -or [string]::IsNullOrWhiteSpace($move.destinationKey)) {
    throw "Invalid storage mapping in $manifestPath."
  }
  $destinationIdentity = "$($move.destinationBucket)/$($move.destinationKey)"
  if ($destinations.ContainsKey($destinationIdentity) -and $destinations[$destinationIdentity] -ne $move.source) {
    throw "Two source objects map to the same destination: $destinationIdentity"
  }
  if (-not $destinations.ContainsKey($destinationIdentity)) {
    $destinations[$destinationIdentity] = $move.source
    $moves.Add($move)
  }
}

$common = @("--metadata", "--ignore-times", "--check-first", "--checkers", "8", "--transfers", "8", "--retries", "5")
if ($DryRun) { $common += "--dry-run" }

for ($index = 0; $index -lt $moves.Count; $index += 1) {
  $move = $moves[$index]
  $destinationRemote = if ($move.destinationBucket -eq "public") { $PublicR2Remote } else { $PrivateR2Remote }
  $deliveryMetadata = if ($move.destinationBucket -eq "public") {
    @(
      "--metadata-set", "cache-control=public, max-age=31536000, immutable",
      "--metadata-set", "content-disposition=inline"
    )
  } else {
    @(
      "--metadata-set", "cache-control=private, max-age=300",
      "--metadata-set", "content-disposition=inline"
    )
  }
  $source = "${SupabaseRemote}:$($move.source)"
  $destination = "${destinationRemote}:$($move.destinationKey)"
  & rclone copyto $source $destination @common @deliveryMetadata
  if ($LASTEXITCODE -ne 0) {
    throw "Storage sync failed at mapping $($index + 1) of $($moves.Count). Re-running is safe."
  }
  if ((($index + 1) % 100) -eq 0 -or ($index + 1) -eq $moves.Count) {
    Write-Output "Synchronized $($index + 1)/$($moves.Count) objects"
  }
}

Write-Output "Storage synchronization completed for $($moves.Count) unique destination objects."
