import Link from "next/link"
import Image from "next/image"
import {
  ChevronRight,
  BookOpen,
  AlertTriangle,
  BarChart2,
  Users,
  Clock,
  Shield,
  FileText,
} from "lucide-react"
import {
  formatLandingSafeMagazineDate,
  getLandingSafeMagazinePreview,
} from "@/lib/landing-safe-magazine-preview"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "BarChart2": BarChart2,
  "Users": Users,
  "Shield": Shield,
  "FileText": FileText,
}

export function SafeMagazine() {
  const articles = getLandingSafeMagazinePreview(3)

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

        {/* 記事リスト（デスクトップはグリッド） */}
        <div className="grid gap-4 px-4 md:grid-cols-3 md:gap-6">
          {articles.map((article) => {
            const IconComponent =
              CATEGORY_ICONS[article.categoryIcon as keyof typeof CATEGORY_ICONS] ?? null

            return (
              <Link
                key={article.id}
                href={`/safe-magazine/${article.slug}`}
                className={`flex flex-col overflow-hidden rounded-[22px] border transition-transform hover:-translate-y-0.5 ${tankenTokens.cls.focus}`}
                style={{
                  background: C.card,
                  borderColor: tankenTokens.border.faint,
                  boxShadow: tankenTokens.shadow.soft,
                }}
              >
                {/* サムネイル画像 */}
                <div
                  className="relative h-32 overflow-hidden md:h-40"
                  style={{ backgroundColor: `${article.categoryColor}15` }}
                >
                  {article.thumbnailUrl ? (
                    <Image
                      src={article.thumbnailUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : IconComponent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconComponent
                        className="h-16 w-16 opacity-30 md:h-20 md:w-20"
                        style={{ color: article.categoryColor }}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex items-center gap-2">
                    <span
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: article.categoryColor }}
                    >
                      {IconComponent && <IconComponent className="h-3 w-3" aria-hidden="true" />}
                      {article.categoryLabel}
                    </span>
                  </div>
                  <div
                    className="absolute right-3 top-3 flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                    style={{ background: "rgba(255,253,247,.92)", color: C.inkSoft }}
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatLandingSafeMagazineDate(article.publishedDate)}
                  </div>
                </div>

                {/* 記事情報 */}
                <div className="flex flex-1 flex-col p-4 md:p-5">
                  <h3
                    className="mb-2 text-base font-bold leading-tight md:text-lg"
                    style={{ color: C.ink }}
                  >
                    {article.title}
                  </h3>
                  <p
                    className="line-clamp-2 text-sm leading-relaxed md:line-clamp-3"
                    style={{ color: C.inkSoft }}
                  >
                    {article.excerpt}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
