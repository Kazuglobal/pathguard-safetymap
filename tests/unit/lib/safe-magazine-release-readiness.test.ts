import fs from "fs"
import path from "path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import { getArticleBySlug } from "@/lib/safe-magazine"

const ROOT = process.cwd()

describe("SAFE MAGAZINE release readiness regressions", () => {
  it("keeps image generator scripts free of committed Gemini API keys", () => {
    const scriptPaths = [
      "scripts/generate-new-article-images.mjs",
      "scripts/generate-new-article-content-images.mjs",
    ]

    for (const relativePath of scriptPaths) {
      const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8")
      expect(source).not.toMatch(/AIza[0-9A-Za-z_-]{35}/)
    }
  })

  it("keeps the aggregated image generator TypeScript file parseable", () => {
    const filePath = path.join(ROOT, "scripts/generate-safe-magazine-images.ts")
    const source = fs.readFileSync(filePath, "utf8")
    const result = ts.transpileModule(source, {
      fileName: filePath,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
    })

    const errors = (result.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    )

    expect(errors).toHaveLength(0)
  })

  it("uses verified Kakogawa camera facts instead of claiming every camera is AI-enabled", () => {
    const article = getArticleBySlug("ai-camera-kakogawa")

    expect(article).toBeDefined()
    expect(article?.excerpt).toContain("約1,500")
    expect(article?.excerpt).toContain("150台")
    expect(article?.excerpt).not.toContain("1,571台")
    expect(article?.content).toContain("約1,500ヵ所")
    expect(article?.content).toContain("150台")
    expect(article?.content).not.toContain("現在は市内に1,571台")
    expect(article?.content).not.toContain("AI搭載の見守りカメラ整備を進め")
  })

  it("uses verified suspicious-person timing stats and avoids unsupported location percentages", () => {
    const article = getArticleBySlug("suspicious-person-statistics")

    expect(article).toBeDefined()
    expect(article?.content).toContain("15時台")
    expect(article?.content).toContain("23.9%")
    expect(article?.content).toContain("14時台")
    expect(article?.content).toContain("16時台")
    expect(article?.content).not.toContain("26.7%")
    expect(article?.content).not.toContain("65.5%")
  })

  it("avoids overclaiming nationwide earphone rules in bicycle copy and tweets", () => {
    const article = getArticleBySlug("bicycle-blue-ticket")
    const tweetsPath = path.join(ROOT, "content/tweets/safe-magazine/2026-03-15-tweets.json")
    const tweets = fs.readFileSync(tweetsPath, "utf8")

    expect(article).toBeDefined()
    expect(article?.content).not.toContain("両耳への使用は禁止")
    expect(tweets).not.toContain("両耳イヤホンは禁止")
    expect(tweets).not.toContain("1,571台")
    expect(tweets).not.toContain("26.7%")
    expect(tweets).not.toContain("65.5%")
  })
})
