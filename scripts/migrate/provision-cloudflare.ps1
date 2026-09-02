[CmdletBinding()]
param(
  [string]$DatabaseName = "pathguardian",
  [switch]$SkipSecrets
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
  throw "wrangler is required. Run this through the repository package manager."
}
if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_ACCOUNT_ID)) {
  throw "CLOUDFLARE_ACCOUNT_ID is required."
}

$databases = @(& wrangler d1 list --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw "Unable to list D1 databases." }
$database = $databases | Where-Object { $_.name -eq $DatabaseName } | Select-Object -First 1
if ($null -eq $database) {
  & wrangler d1 create $DatabaseName --location apac
  if ($LASTEXITCODE -ne 0) { throw "Unable to create D1 database $DatabaseName." }
  # Wrangler 4.125 removed `d1 create --json`. Re-list after creation so the
  # identifier comes from the stable JSON output of `d1 list`.
  $databases = @(& wrangler d1 list --json | ConvertFrom-Json)
  if ($LASTEXITCODE -ne 0) { throw "Unable to refresh D1 databases after creating $DatabaseName." }
  $database = $databases | Where-Object { $_.name -eq $DatabaseName } | Select-Object -First 1
  if ($null -eq $database) { throw "D1 database $DatabaseName was created but could not be listed." }
}
$databaseId = if ($database.uuid) { $database.uuid } elseif ($database.id) { $database.id } else { $database.database_id }
if ([string]::IsNullOrWhiteSpace($databaseId)) { throw "D1 create/list output did not contain a database id." }

$bucketNames = @("pg-media-public", "pg-media-private", "pg-backups", "pg-next-cache")
foreach ($bucketName in $bucketNames) {
  $null = & wrangler r2 bucket info $bucketName --json 2>$null
  if ($LASTEXITCODE -ne 0) {
    & wrangler r2 bucket create $bucketName
    if ($LASTEXITCODE -ne 0) { throw "Unable to create R2 bucket $bucketName." }
  }
}

& node scripts/migrate/configure-cloudflare.mjs "--account-id=$($env:CLOUDFLARE_ACCOUNT_ID)" "--database-id=$databaseId"
if ($LASTEXITCODE -ne 0) { throw "Unable to update wrangler.jsonc." }

if (-not $SkipSecrets) {
  $secretNames = @(
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "NEXT_PUBLIC_MEDIA_BASE_URL", "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAILS",
    "OPENAI_API_KEY", "OPENAI_ORG_ID", "GEMINI_API_KEY", "GOOGLE_API_KEY",
    "MAPBOX_SECRET_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
    "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "CRON_SECRET", "LINE_CHANNEL_ID", "LINE_CHANNEL_SECRET",
    "D1_REST_API_TOKEN", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT", "XROAD_API_KEY",
    "ACCIDENT_IMAGE_CONTEXT_ENABLED", "DANGER_REPORT_AI_MODERATION_MODE", "HAZARD_ZONE_GATE_MODE",
    "GEMINI_IMAGE_MODEL", "GEMINI_VISION_MODEL", "OPENAI_IMAGE_MODEL", "OPENAI_IMAGE_SIZE"
  )
  foreach ($name in $secretNames) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) {
      Write-Warning "Skipping unset secret $name"
      continue
    }
    $value | & wrangler secret put $name
    if ($LASTEXITCODE -ne 0) { throw "Unable to upload Worker secret $name." }
  }
}

$receiptDirectory = Join-Path (Resolve-Path -LiteralPath ".") "artifacts/migration"
New-Item -ItemType Directory -Path $receiptDirectory -Force | Out-Null
$receiptPath = Join-Path $receiptDirectory "cloudflare-resources.json"
[ordered]@{
  accountId = $env:CLOUDFLARE_ACCOUNT_ID
  d1DatabaseName = $DatabaseName
  d1DatabaseId = $databaseId
  r2Buckets = $bucketNames
  configuredAt = [DateTime]::UtcNow.ToString("o")
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receiptPath -Encoding utf8NoBOM
Write-Output "Cloudflare resources are provisioned. Receipt: $receiptPath"
