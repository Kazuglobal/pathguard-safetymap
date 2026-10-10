param(
    [Parameter(Mandatory = $true)][string]$Directory,
    [ValidateSet('local', 'remote')][string]$Target = 'local'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    throw "Import directory not found: $Directory. Run prepare-school-districts.py successfully first."
}
$importDirectory = (Resolve-Path -LiteralPath $Directory).Path
$manifestPath = Join-Path $importDirectory 'manifest.json'
$files = if (Test-Path -LiteralPath $manifestPath) {
    (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json).files
} else {
    @('municipal-update.sql')
}

foreach ($name in $files) {
    if ([System.IO.Path]::GetFileName($name) -ne $name -or -not $name.EndsWith('.sql')) {
        throw 'Import manifest must contain SQL filenames without directories.'
    }
    $file = Join-Path $importDirectory $name
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing import: $file. SQL generation has not completed; fix the GeoJSON input and rerun prepare-school-districts.py first." }
}

foreach ($name in $files) {
    $file = Join-Path $importDirectory $name
    & pnpm exec wrangler d1 execute pathguardian "--$Target" --file $file
    if ($LASTEXITCODE -ne 0) { throw "School district import failed: $name" }
}

& pnpm exec wrangler d1 execute pathguardian "--$Target" --command 'SELECT count(*) AS districts, count(DISTINCT prefecture) AS prefectures, count(DISTINCT municipality_code) AS municipalities FROM school_districts; SELECT count(*) AS boundaries FROM school_district_boundaries;'
if ($LASTEXITCODE -ne 0) { throw 'School district count verification failed.' }
