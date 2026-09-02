[CmdletBinding()]
param(
  [string]$SiteUrl = $env:NEXT_PUBLIC_SITE_URL,
  [string]$MediaBaseUrl = $env:NEXT_PUBLIC_MEDIA_BASE_URL,
  [string]$ZoneId = $env:CLOUDFLARE_ZONE_ID,
  [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN,
  [string]$PublicBucket = "pg-media-public",
  [string]$PrivateBucket = "pg-media-private",
  [switch]$AllowManagedDomain,
  [switch]$SkipLifecycle
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-ProductionUri {
  param([string]$Name, [string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { throw "$Name is required." }
  try { $uri = [Uri]$Value } catch { throw "$Name must be a valid absolute HTTPS URL." }
  if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne "https") {
    throw "$Name must be a valid absolute HTTPS URL."
  }
  if ($uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -notin @("", "/")) {
    throw "$Name must contain only an HTTPS origin (no credentials, path, query, or fragment)."
  }
  if ([Uri]::CheckHostName($uri.DnsSafeHost) -ne [UriHostNameType]::Dns) {
    throw "$Name must use a DNS hostname."
  }
  return $uri
}

function Invoke-CloudflareApi {
  param(
    [ValidateSet("GET", "POST", "PATCH")][string]$Method,
    [string]$Path,
    [object]$Body,
    [switch]$AllowNotFound
  )

  $parameters = @{
    Uri = "https://api.cloudflare.com/client/v4$Path"
    Method = $Method
    Headers = @{ Authorization = "Bearer $ApiToken" }
    SkipHttpErrorCheck = $true
  }
  if ($null -ne $Body) {
    $parameters.ContentType = "application/json"
    $parameters.Body = $Body | ConvertTo-Json -Depth 12 -Compress
  }
  $response = Invoke-WebRequest @parameters
  if ($AllowNotFound -and $response.StatusCode -eq 404) { return $null }
  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    $details = try {
      (($response.Content | ConvertFrom-Json).errors | ForEach-Object { $_.message }) -join "; "
    } catch { "" }
    throw "Cloudflare API request failed ($($response.StatusCode))$(if ($details) { ": $details" })."
  }
  if ([string]::IsNullOrWhiteSpace($response.Content)) { return $null }
  return $response.Content | ConvertFrom-Json
}

if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
  throw "wrangler is required. Run this through the repository package manager."
}
if (-not $AllowManagedDomain) {
  if ($ZoneId -notmatch "^[0-9a-fA-F]{32}$") { throw "CLOUDFLARE_ZONE_ID must be a 32-character zone ID." }
  if ([string]::IsNullOrWhiteSpace($ApiToken)) { throw "CLOUDFLARE_API_TOKEN is required." }
}

$siteUri = Get-ProductionUri "NEXT_PUBLIC_SITE_URL" $SiteUrl
$mediaUri = Get-ProductionUri "NEXT_PUBLIC_MEDIA_BASE_URL" $MediaBaseUrl
$siteOrigin = $siteUri.GetLeftPart([UriPartial]::Authority)
$mediaHost = $mediaUri.DnsSafeHost.ToLowerInvariant()
if ($siteUri.DnsSafeHost -eq $mediaHost) {
  throw "NEXT_PUBLIC_MEDIA_BASE_URL must use the dedicated R2 media hostname."
}

$corsFile = [System.IO.Path]::GetTempFileName()
try {
  [ordered]@{
    rules = @(
      [ordered]@{
        allowed = [ordered]@{
          origins = @($siteOrigin)
          methods = @("GET", "HEAD")
          headers = @("Range", "If-None-Match", "If-Modified-Since")
        }
        exposeHeaders = @("Accept-Ranges", "Cache-Control", "Content-Length", "Content-Range", "Content-Type", "ETag", "Last-Modified")
        maxAgeSeconds = 86400
      }
    )
  } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $corsFile -Encoding utf8NoBOM

  & wrangler r2 bucket cors set $PublicBucket --file $corsFile --force
  if ($LASTEXITCODE -ne 0) { throw "Unable to configure CORS for $PublicBucket." }
} finally {
  Remove-Item -LiteralPath $corsFile -Force -ErrorAction SilentlyContinue
}

if ($AllowManagedDomain) {
  if ($mediaHost -notmatch '^pub-[0-9a-f]{32}\.r2\.dev$') {
    throw "Managed media mode requires the exact public bucket r2.dev hostname."
  }
  & wrangler r2 bucket dev-url enable $PublicBucket --force
  if ($LASTEXITCODE -ne 0) { throw "Unable to enable r2.dev access for $PublicBucket." }
} else {
  & wrangler r2 bucket domain get $PublicBucket --domain $mediaHost *> $null
  $domainExists = $LASTEXITCODE -eq 0
  if ($domainExists) {
    & wrangler r2 bucket domain update $PublicBucket --domain $mediaHost --min-tls 1.2
  } else {
    & wrangler r2 bucket domain add $PublicBucket --domain $mediaHost --zone-id $ZoneId --min-tls 1.2 --force
  }
  if ($LASTEXITCODE -ne 0) { throw "Unable to configure R2 custom domain $mediaHost." }
  & wrangler r2 bucket dev-url disable $PublicBucket --force
  if ($LASTEXITCODE -ne 0) { throw "Unable to disable r2.dev access for $PublicBucket." }
}

& wrangler r2 bucket dev-url disable $PrivateBucket --force
if ($LASTEXITCODE -ne 0) { throw "Unable to disable r2.dev access for $PrivateBucket." }

$lifecycleName = "hunter-photo-retention-insurance"
if (-not $SkipLifecycle) {
  $lifecycleOutput = (& wrangler r2 bucket lifecycle list $PrivateBucket 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "Unable to inspect lifecycle rules for $PrivateBucket." }
  $lifecycleBlock = ($lifecycleOutput -split "(?:\r?\n){2,}") |
    Where-Object { $_ -match "(?im)^name\s*:\s*$([regex]::Escape($lifecycleName))\s*$" } |
    Select-Object -First 1
  $lifecycleCorrect = $lifecycleBlock -and
    $lifecycleBlock -match "(?im)^prefix\s*:\s*hunter-photos/\s*$" -and
    $lifecycleBlock -match "(?im)^action\s*:\s*Expire objects after 97 days\s*$"
  if ($lifecycleBlock -and -not $lifecycleCorrect) {
    & wrangler r2 bucket lifecycle remove $PrivateBucket --name $lifecycleName
    if ($LASTEXITCODE -ne 0) { throw "Unable to replace lifecycle rule $lifecycleName." }
  }
  if (-not $lifecycleCorrect) {
    & wrangler r2 bucket lifecycle add $PrivateBucket $lifecycleName "hunter-photos/" --expire-days 97 --force
    if ($LASTEXITCODE -ne 0) { throw "Unable to add lifecycle rule $lifecycleName." }
  }
}

$ruleDescription = "PathGuardian public R2 media: Cache Everything / 1 year"
if (-not $AllowManagedDomain) {
  $cacheRule = [ordered]@{
    description = $ruleDescription
    expression = "(http.host eq `"$mediaHost`")"
    action = "set_cache_settings"
    action_parameters = [ordered]@{
      cache = $true
      edge_ttl = [ordered]@{
        mode = "respect_origin"
        status_code_ttl = @(
          [ordered]@{ status_code_range = [ordered]@{ to = 299 }; value = 31536000 }
          [ordered]@{ status_code_range = [ordered]@{ from = 300; to = 499 }; value = 0 }
          [ordered]@{ status_code_range = [ordered]@{ from = 500 }; value = -1 }
        )
      }
      # Successful objects already carry a one-year Cache-Control header. Respecting
      # origin here prevents a missing/error response from being cached by browsers.
      browser_ttl = [ordered]@{ mode = "respect_origin" }
    }
    enabled = $true
  }
  $entrypointPath = "/zones/$ZoneId/rulesets/phases/http_request_cache_settings/entrypoint"
  $entrypoint = Invoke-CloudflareApi "GET" $entrypointPath $null -AllowNotFound
  if ($null -eq $entrypoint) {
    $created = Invoke-CloudflareApi "POST" "/zones/$ZoneId/rulesets" ([ordered]@{
      name = "PathGuardian cache rules"
      description = "Cache rules managed by the PathGuardian cutover scripts"
      kind = "zone"
      phase = "http_request_cache_settings"
      rules = @($cacheRule)
    })
    if (-not $created.success) { throw "Unable to create the cache ruleset." }
  } else {
    $ruleset = $entrypoint.result
    $existingRule = $ruleset.rules | Where-Object { $_.description -eq $ruleDescription } | Select-Object -First 1
    if ($null -eq $existingRule) {
      $updated = Invoke-CloudflareApi "POST" "/zones/$ZoneId/rulesets/$($ruleset.id)/rules" $cacheRule
    } else {
      $updated = Invoke-CloudflareApi "PATCH" "/zones/$ZoneId/rulesets/$($ruleset.id)/rules/$($existingRule.id)" $cacheRule
    }
    if (-not $updated.success) { throw "Unable to configure the R2 media cache rule." }
  }
}

$receiptDirectory = Join-Path (Resolve-Path -LiteralPath ".") "artifacts/migration"
New-Item -ItemType Directory -Path $receiptDirectory -Force | Out-Null
$receiptPath = Join-Path $receiptDirectory "r2-delivery.json"
[ordered]@{
  publicBucket = $PublicBucket
  privateBucket = $PrivateBucket
  siteOrigin = $siteOrigin
  mediaOrigin = $mediaUri.GetLeftPart([UriPartial]::Authority)
  deliveryMode = if ($AllowManagedDomain) { "r2.dev" } else { "custom-domain" }
  customDomainMinimumTls = if ($AllowManagedDomain) { $null } else { "1.2" }
  r2DevAccess = if ($AllowManagedDomain) { "public-bucket-only" } else { "disabled" }
  corsMethods = @("GET", "HEAD")
  cacheEverythingSeconds = if ($AllowManagedDomain) { $null } else { 31536000 }
  cacheErrors = if ($AllowManagedDomain) { "managed-domain-default" } else { "disabled" }
  hunterPhotoInsuranceDays = if ($SkipLifecycle) { $null } else { 97 }
  configuredAt = [DateTime]::UtcNow.ToString("o")
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding utf8NoBOM

Write-Output "R2 delivery is configured. Receipt: $receiptPath"
