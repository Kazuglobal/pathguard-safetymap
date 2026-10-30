import Link from "next/link"
import { ChevronRight, BookOpen } from "lucide-react"
import { getLandingSafeMagazinePreview } from "@/lib/landing-safe-magazine-preview"
import { tankenTokens } from "@/lib/design/tanken"
import { SafeMagazineCard } from "./safe-magazine-card"
import { SafeMagazineCarousel } from "./safe-magazine-carousel"

const C = tankenTokens.color

/** スマホの自動スライドで流す記事数 */
export const SAFE_MAGAZINE_CAROUSEL_COUNT = 6
/** PCの3列グリッドで並べる記事数 */
export const SAFE_MAGAZINE_GRID_COUNT = 3

export function SafeMagazine() {
  const articles = getLandingSafeMagazinePreview(SAFE_MAGAZINE_CAROUSEL_COUNT)

  return (
    <section className="py-6 md:py-10" style={{ background: C.paper }}>
      <div className="mx-auto max-w-6xl">
        {/* セクションヘッダー */}
        <div className="mb-4 flex items-center justify-between px-4 md:mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 md:h-6 md:w-6" style={{ color: C.primary }} aria-hidden="true" />
            <h2 className="text-lg font-black md:text-xl" style={{ color: C.ink }}>
              PathGuard Press
            </h2>
          </div>
          <Link
            href="/safe-magazine"
            className={`flex items-center gap-0.5 rounded-full text-sm font-bold ${tankenTokens.cls.focus}`}
            style={{ color: C.primaryStrong }}
          >
            すべて見る
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* スマホは横の自動スライド */}
        <div className="md:hidden">
          <SafeMagazineCarousel articles={articles} />
        </div>

        {/* PCは3本を一度に見せるグリッド */}
        <div data-testid="safe-magazine-grid" className="hidden gap-6 px-4 md:grid md:grid-cols-3">
          {articles.slice(0, SAFE_MAGAZINE_GRID_COUNT).map((article) => (
            <SafeMagazineCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  )
}
