/**
 * 通学路の安全ニュース：記事データの画像参照を補完する
 *
 * `generate-missing-images.ts` は「記事が参照しているのに実ファイルが無い画像」だけを生成する。
 * そのため `thumbnailUrl` を書き忘れた記事は、生成スクリプトを何度実行しても
 * `欠落 0 件` となり画像が作られない（参照が無いので生成対象にならない）。
 *
 * このスクリプトは、その前段として記事データ側の参照だけを規約どおりに埋める。
 * 画像の生成はしない（生成は generate-missing-images.ts の役割）。
 *
 * 使い方:
 *   npx tsx scripts/ensure-news-image-refs.ts              # thumbnailUrl の欠落を補完
 *   npx tsx scripts/ensure-news-image-refs.ts --figures    # 併せて accident/suspicious に図版1件を補完
 *   npx tsx scripts/ensure-news-image-refs.ts --dry-run    # 変更内容を表示するだけ
 *
 * 規約:
 *   thumbnailUrl  : /images/school-route-news/thumbnails/{slug}.jpg
 *   contentImages : /images/school-route-news/articles/{slug}/{id}.jpg
 *
 * 図版の description は alt テキスト兼 生成プロンプトになる。ここでは記事が既に持っている
 * `actionAdvice`（そなえの一言）をそのまま使う。図が描くのはまさにその行動なので、
 * 新しい文章を機械で創作することはしない。
 */

import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const TARGET = path.join(ROOT, "lib", "school-route-news.ts")

function thumbnailUrlFor(slug: string): string {
  return `/images/school-route-news/thumbnails/${slug}.jpg`
}

function figureUrlFor(slug: string, id: string): string {
  return `/images/school-route-news/articles/${slug}/${id}.jpg`
}

async function main() {
  const args = process.argv.slice(2)
  const withFigures = args.includes("--figures")
  const dryRun = args.includes("--dry-run")

  const { NEWS_ITEMS } = await import("../lib/school-route-news")

  let text = fs.readFileSync(TARGET, "utf8")
  // 既存ファイルは CRLF。改行コードを混ぜると全行が差分になるため、元の改行に合わせる。
  const EOL = text.includes("\r\n") ? "\r\n" : "\n"

  const addedThumbnails: string[] = []
  const addedFigures: string[] = []
  const skipped: string[] = []

  for (const item of NEWS_ITEMS) {
    const anchor = `    slug: "${item.slug}",`
    const occurrences = text.split(anchor).length - 1
    if (occurrences !== 1) {
      skipped.push(`${item.slug}（slug 行が ${occurrences} 箇所。手で確認すること）`)
      continue
    }

    const inserts: string[] = []

    if (!item.thumbnailUrl) {
      inserts.push(`    thumbnailUrl: ${JSON.stringify(thumbnailUrlFor(item.slug))},`)
      addedThumbnails.push(item.slug)
    }

    const needsFigure = item.category === "accident" || item.category === "suspicious"
    if (withFigures && needsFigure && !item.contentImages?.length) {
      const description = (item.actionAdvice ?? "").trim()
      if (!description) {
        skipped.push(`${item.slug}（actionAdvice が無いため図版を足せない）`)
      } else {
        const id = "action"
        inserts.push(
          `    contentImages: [`,
          `      { id: ${JSON.stringify(id)}, url: ${JSON.stringify(figureUrlFor(item.slug, id))}, description: ${JSON.stringify(description)} },`,
          `    ],`,
        )
        addedFigures.push(`${item.slug}/${id}`)
      }
    }

    if (inserts.length === 0) continue
    text = text.replace(anchor, anchor + EOL + inserts.join(EOL))
  }

  const total = addedThumbnails.length + addedFigures.length
  console.log(`サムネイル参照の追加 ${addedThumbnails.length} 件 / 図版参照の追加 ${addedFigures.length} 件`)
  for (const slug of addedThumbnails) console.log(`  + thumbnail ${thumbnailUrlFor(slug)}`)
  for (const key of addedFigures) console.log(`  + figure    ${figureUrlFor(key.split("/")[0], key.split("/")[1])}`)
  for (const note of skipped) console.log(`  ! ${note}`)

  if (total === 0) {
    console.log("参照はすべて規約どおり。記事データの変更はない。")
    return
  }
  if (dryRun) {
    console.log("--dry-run のため書き込んでいない。")
    return
  }

  fs.writeFileSync(TARGET, text, "utf8")
  console.log(`${path.relative(ROOT, TARGET)} を更新した。画像の生成は generate-missing-images.ts が行う。`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
