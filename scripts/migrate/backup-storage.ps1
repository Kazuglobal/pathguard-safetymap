[CmdletBinding()]
param(
  [string]$SupabaseRemote = "supabase-storage",
  [string]$BackupRemote = "r2-backups",
  [string]$OutputDirectory = "artifacts/migration",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  throw "rclone is required. Configure an S3-compatible Supabase remote and an R2 backup remote first."
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$buckets = @("images", "danger-reports", "processed-images", "avatars", "hazard-simulations", "hunter-photos")
$rcloneCommon = @("--metadata", "--create-empty-src-dirs", "--checkers", "16", "--transfers", "16")
if ($DryRun) { $rcloneCommon += "--dry-run" }
$verifiedBuckets = [System.Collections.Generic.List[object]]::new()

foreach ($bucket in $buckets) {
  $source = "${SupabaseRemote}:$bucket"
  $destination = "${BackupRemote}:supabase-storage-pre-cutover/$stamp/$bucket"
  Write-Output "Backing up bucket $bucket"
  & rclone copy $source $destination @rcloneCommon
  if ($LASTEXITCODE -ne 0) { throw "Storage backup failed for $bucket with exit code $LASTEXITCODE." }
  if (-not $DryRun) {
    & rclone check $source $destination --download --one-way --checkers 16
    if ($LASTEXITCODE -ne 0) { throw "Storage backup verification failed for $bucket with exit code $LASTEXITCODE." }
  }
  $sourceStats = & rclone size $source --json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw "Unable to calculate source size for $bucket." }
  $destinationStats = if ($DryRun) { $null } else { & rclone size $destination --json | ConvertFrom-Json }
  if (-not $DryRun -and $LASTEXITCODE -ne 0) { throw "Unable to calculate destination size for $bucket." }
  if (-not $DryRun -and ($sourceStats.count -ne $destinationStats.count -or $sourceStats.bytes -ne $destinationStats.bytes)) {
    throw "Storage backup count/byte mismatch for $bucket."
  }
  $verifiedBuckets.Add([ordered]@{
    bucket = $bucket
    sourceCount = $sourceStats.count
    sourceBytes = $sourceStats.bytes
    destinationCount = if ($null -eq $destinationStats) { $null } else { $destinationStats.count }
    destinationBytes = if ($null -eq $destinationStats) { $null } else { $destinationStats.bytes }
  })
}

$directory = Join-Path (Resolve-Path -LiteralPath ".") $OutputDirectory
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$receipt = Join-Path $directory "storage-backup-$stamp.json"
[ordered]@{
  createdAt = [DateTime]::UtcNow.ToString("o")
  sourceRemote = $SupabaseRemote
  backupRemote = $BackupRemote
  backupPrefix = "supabase-storage-pre-cutover/$stamp"
  buckets = $buckets
  verification = $verifiedBuckets
  dryRun = [bool]$DryRun
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receipt -Encoding utf8NoBOM
Write-Output "Storage backup completed. Receipt: $receipt"
