[CmdletBinding()]
param(
  [string]$OutputDirectory = "artifacts/migration",
  [string]$BackupRemote = "r2-backups",
  [switch]$SkipUpload
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($env:POSTGRES_URL)) {
  throw "POSTGRES_URL is required."
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump is required and was not found on PATH."
}
if (-not $SkipUpload -and -not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  throw "rclone is required unless -SkipUpload is used."
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$directory = Join-Path (Resolve-Path -LiteralPath ".") (Join-Path $OutputDirectory $stamp)
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$dumpPath = Join-Path $directory "supabase-postgres.dump"
$schemaPath = Join-Path $directory "supabase-schema.sql"

$databaseUri = [Uri]$env:POSTGRES_URL
if ($databaseUri.Scheme -notin @("postgres", "postgresql")) { throw "POSTGRES_URL must use postgres:// or postgresql://." }
$userInfoSeparator = $databaseUri.UserInfo.IndexOf(":")
if ($userInfoSeparator -lt 1) { throw "POSTGRES_URL must include a user and password." }
$databaseUser = [Uri]::UnescapeDataString($databaseUri.UserInfo.Substring(0, $userInfoSeparator))
$databasePassword = [Uri]::UnescapeDataString($databaseUri.UserInfo.Substring($userInfoSeparator + 1))
$databaseName = [Uri]::UnescapeDataString($databaseUri.AbsolutePath.TrimStart("/"))
if ([string]::IsNullOrWhiteSpace($databaseName)) { throw "POSTGRES_URL must include a database name." }
$databasePort = if ($databaseUri.IsDefaultPort) { 5432 } else { $databaseUri.Port }
$connectionArgs = @(
  "--host=$($databaseUri.Host)", "--port=$databasePort",
  "--username=$databaseUser", "--dbname=$databaseName"
)
$previousPassword = $env:PGPASSWORD
$previousSslMode = $env:PGSSLMODE
try {
  # Keep credentials out of the process command line and shell history.
  $env:PGPASSWORD = $databasePassword
  $env:PGSSLMODE = "require"
  & pg_dump --format=custom --no-owner --no-acl --file=$dumpPath @connectionArgs
  if ($LASTEXITCODE -ne 0) { throw "pg_dump data backup failed with exit code $LASTEXITCODE." }
  & pg_dump --schema-only --format=plain --no-owner --no-acl --file=$schemaPath @connectionArgs
  if ($LASTEXITCODE -ne 0) { throw "pg_dump schema backup failed with exit code $LASTEXITCODE." }
} finally {
  $env:PGPASSWORD = $previousPassword
  $env:PGSSLMODE = $previousSslMode
}

$files = @($dumpPath, $schemaPath) | ForEach-Object {
  $item = Get-Item -LiteralPath $_
  [ordered]@{
    name = $item.Name
    bytes = $item.Length
    sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}
$manifestPath = Join-Path $directory "manifest.json"
[ordered]@{
  createdAt = [DateTime]::UtcNow.ToString("o")
  format = "pg_dump custom plus schema-only SQL"
  files = $files
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM

if (-not $SkipUpload) {
  $destination = "${BackupRemote}:postgres-pre-cutover/$stamp"
  & rclone copy $directory $destination --checksum --metadata --create-empty-src-dirs
  if ($LASTEXITCODE -ne 0) { throw "Postgres backup upload failed with exit code $LASTEXITCODE." }
  & rclone check $directory $destination --download --one-way
  if ($LASTEXITCODE -ne 0) { throw "Postgres backup verification failed with exit code $LASTEXITCODE." }
  Write-Output "Postgres backup uploaded to $destination"
}

Write-Output "Postgres backup completed: $directory"
