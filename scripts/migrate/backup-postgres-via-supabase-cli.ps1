[CmdletBinding()]
param(
  [string]$OutputDirectory = "artifacts/migration"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "Supabase CLI is required."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required by Supabase CLI db dump."
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$temporaryDirectory = Join-Path $temporaryRoot "pathguardian-postgres-backup-$stamp-$([Guid]::NewGuid().ToString('N'))"
$artifactDirectory = Join-Path (Resolve-Path -LiteralPath ".") (Join-Path $OutputDirectory "postgres-backup-$stamp")
$wrangler = Join-Path (Resolve-Path -LiteralPath ".") "node_modules/wrangler/bin/wrangler.js"

New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null

try {
  $rolesPath = Join-Path $temporaryDirectory "roles.sql"
  $schemaPath = Join-Path $temporaryDirectory "schema.sql"
  $dataPath = Join-Path $temporaryDirectory "data.sql"

  & supabase db dump --linked --file $rolesPath --role-only
  if ($LASTEXITCODE -ne 0) { throw "Supabase roles dump failed with exit code $LASTEXITCODE." }
  & supabase db dump --linked --file $schemaPath
  if ($LASTEXITCODE -ne 0) { throw "Supabase schema dump failed with exit code $LASTEXITCODE." }
  & supabase db dump --linked --file $dataPath --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
  if ($LASTEXITCODE -ne 0) { throw "Supabase data dump failed with exit code $LASTEXITCODE." }

  $receipts = @()
  foreach ($sourcePath in @($rolesPath, $schemaPath, $dataPath)) {
    $compressedPath = "$sourcePath.gz"
    $sourceStream = [IO.File]::OpenRead($sourcePath)
    try {
      $destinationStream = [IO.File]::Create($compressedPath)
      try {
        $gzip = [IO.Compression.GZipStream]::new($destinationStream, [IO.Compression.CompressionLevel]::SmallestSize, $true)
        try { $sourceStream.CopyTo($gzip) } finally { $gzip.Dispose() }
      } finally {
        $destinationStream.Dispose()
      }
    } finally {
      $sourceStream.Dispose()
    }
    Remove-Item -LiteralPath $sourcePath -Force

    $item = Get-Item -LiteralPath $compressedPath
    $name = $item.Name
    $objectKey = "postgres-pre-cutover/$stamp/$name"
    & node $wrangler r2 object put "pg-backups/$objectKey" --remote --force "--file=$compressedPath" "--content-type=application/gzip" "--content-disposition=attachment" "--cache-control=private, max-age=0, no-store"
    if ($LASTEXITCODE -ne 0) { throw "R2 upload failed for a Postgres backup component." }
    $receipts += [ordered]@{
      name = $name
      bytes = $item.Length
      sha256 = (Get-FileHash -LiteralPath $compressedPath -Algorithm SHA256).Hash.ToLowerInvariant()
      object = "pg-backups/$objectKey"
    }
    Write-Output "Uploaded Postgres backup component $($receipts.Count)/3 ($($item.Length) bytes)"
  }

  $manifest = [ordered]@{
    createdAt = [DateTime]::UtcNow.ToString("o")
    format = "Supabase CLI roles, schema, and COPY data SQL compressed with gzip"
    destinationPrefix = "pg-backups/postgres-pre-cutover/$stamp"
    files = $receipts
  }
  $manifestPath = Join-Path $artifactDirectory "manifest.json"
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
  & node $wrangler r2 object put "pg-backups/postgres-pre-cutover/$stamp/manifest.json" --remote --force "--file=$manifestPath" "--content-type=application/json" "--content-disposition=attachment" "--cache-control=private, max-age=0, no-store"
  if ($LASTEXITCODE -ne 0) { throw "R2 upload failed for the Postgres backup manifest." }

  Write-Output "Supabase Postgres backup complete: pg-backups/postgres-pre-cutover/$stamp"
  Write-Output "Manifest: $manifestPath"
} finally {
  $resolvedTemporaryDirectory = [IO.Path]::GetFullPath($temporaryDirectory)
  if (-not $resolvedTemporaryDirectory.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or
      -not ([IO.Path]::GetFileName($resolvedTemporaryDirectory)).StartsWith("pathguardian-postgres-backup-", [StringComparison]::Ordinal)) {
    throw "Refusing to remove an unexpected temporary path."
  }
  if (Test-Path -LiteralPath $resolvedTemporaryDirectory) {
    Remove-Item -LiteralPath $resolvedTemporaryDirectory -Recurse -Force
  }
}
