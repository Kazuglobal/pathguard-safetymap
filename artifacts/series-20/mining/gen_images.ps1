# series-20: Codex の image_gen で写真を作り、色調と粒子を仕上げて images/epXX/<key>.jpg に置く。
# 使い方（PowerShell の前面で。Bash から呼ぶと codex exec が止まる）:
#   pwsh -File artifacts/series-20/mining/gen_images.ps1 -Ep 21 -Keys hook -Scratch <スクラッチのフォルダ>
#   -GradeOnly を付けると、生成せずに raw/ の png から仕上げだけやり直す。
# プロンプトは images/prompts.json（mining/write_image_prompts.mjs が作る）。Codex はスクラッチの中だけで動かす。
param(
  [Parameter(Mandatory)][string]$Ep,
  [Parameter(Mandatory)][string[]]$Keys,
  [Parameter(Mandatory)][string]$Scratch,
  [string]$Model = 'gpt-6-astra',
  [switch]$GradeOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Keys = @($Keys | ForEach-Object { $_ -split ',' } | Where-Object { $_ })  # pwsh -File では「safe,danger」が1つの文字列で届く
if ($Keys.Count -gt 2) { throw '1回に2枚まで（Codex は約10分で打ち切られる）' }

$series = Split-Path -Parent $PSScriptRoot
$prompts = Get-Content (Join-Path $series 'images/prompts.json') -Raw -Encoding utf8 | ConvertFrom-Json
$epData = $prompts.episodes.$Ep
if (-not $epData) { throw "prompts.json に EP$Ep がない" }
$work = Join-Path $Scratch "codex-img/ep$Ep"
$raw = Join-Path $work 'raw'
New-Item -ItemType Directory -Force -Path $raw | Out-Null
$outDir = Join-Path $series "images/ep$Ep"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

if (-not $GradeOnly) {
  $lines = @("image_gen で次の $($Keys.Count) 枚の写真を、書いてある順に1枚ずつ作ってください。")
  $i = 1
  foreach ($k in $Keys) {
    $p = $epData.$k.prompt
    if (-not $p) { throw "EP$Ep の $k のプロンプトがない" }
    $lines += "--- $i 枚目（$k）---"
    $lines += $p
    $i++
  }
  $lines += '--- 決まり ---'
  $lines += 'このディレクトリの外は読み書きしない。rm や削除のコマンドを使わない。既存のファイルを消さない。画像の生成以外のことはしない。'
  $lines += '終わったら RESULT: <作れた枚数> 枚 と1行で報告する。'
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $promptFile = Join-Path $work "prompt-$stamp.txt"
  $logFile = Join-Path $work "codex-$stamp.log"
  Set-Content -Path $promptFile -Value ($lines -join "`n") -Encoding utf8
  $start = Get-Date
  Get-Content $promptFile -Raw -Encoding utf8 | codex exec -m $Model --skip-git-repo-check --sandbox workspace-write -C $work *> $logFile
  $elapsed = [int]((Get-Date) - $start).TotalSeconds
  # 生成した画像は作業フォルダではなく ~/.codex/generated_images/<セッション>/ に出る → 開始後に書かれた png を古い順に取り出す
  $gen = Join-Path $HOME '.codex/generated_images'
  $pngs = @(Get-ChildItem -Path $gen -Recurse -Filter '*.png' | Where-Object { $_.LastWriteTime -gt $start } | Sort-Object LastWriteTime)
  "codex: $elapsed 秒・画像 $($pngs.Count) 枚（ログ: $logFile）"
  if ($pngs.Count -lt $Keys.Count) {
    Get-Content $logFile -Tail 20
    throw "画像が足りない（$($pngs.Count)/$($Keys.Count)）。使用上限なら codex exec ""Reply PING"" で戻る時刻を確かめる"
  }
  for ($j = 0; $j -lt $Keys.Count; $j++) { Copy-Item $pngs[$j].FullName (Join-Path $raw "$($Keys[$j]).png") -Force }
}

# 色調と粒子の仕上げ（40枚すべて同じ式。暗部を少し青に寄せ、彩度を少し落とし、細かな粒子と周辺減光）
$grade = 'eq=contrast=1.06:saturation=0.9:gamma=0.98,colorbalance=rs=-0.02:bs=0.04:bm=0.02,noise=alls=5:allf=u,vignette=angle=PI/5'
foreach ($k in $Keys) {
  $src = Join-Path $raw "$k.png"
  if (-not (Test-Path $src)) { throw "$src がない" }
  $dst = Join-Path $outDir "$k.jpg"
  if ($epData.$k.orient -eq 'portrait') { $fit = 'scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920' }
  else { $fit = 'scale=1536:1024:force_original_aspect_ratio=increase:flags=lanczos,crop=1536:1024' }
  ffmpeg -y -loglevel error -i $src -vf "$fit,$grade" -q:v 3 $dst
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg が失敗: $k" }
  "書き出し: $dst"
}
