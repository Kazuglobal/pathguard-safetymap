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
    <section className="py-6 md:py-10">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">PathGuard Press</h2>
          </div>
          <Link
            href="/safe-magazine"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 記事リスト（デスクトップはグリッド） */}
        <div className="px-4 space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
          {articles.map((article) => {
            const IconComponent =
              CATEGORY_ICONS[article.categoryIcon as keyof typeof CATEGORY_ICONS] ?? null

            return (
              <Link
                key={article.id}
                href={`/safe-magazine/${article.slug}`}
                className="block bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                {/* サムネイル画像 */}
                <div
                  className="relative h-32 md:h-40 overflow-hidden"
                  style={{ backgroundColor: `${article.categoryColor}15` }}
                >
                  {article.thumbnailUrl ? (
                    <Image
                      src={article.thumbnailUrl}
                      alt={article.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : IconComponent && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <IconComponent
                        className="w-16 h-16 md:w-20 md:h-20 opacity-30"
                        style={{ color: article.categoryColor }}
                      />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-white text-xs font-medium rounded flex items-center gap-1"
                      style={{ backgroundColor: article.categoryColor }}
                    >
                      {IconComponent && <IconComponent className="w-3 h-3" />}
                      {article.categoryLabel}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 bg-white/90 text-gray-500 text-xs rounded">
                    <Clock className="w-3 h-3" />
                    {formatLandingSafeMagazineDate(article.publishedDate)}
                  </div>
                </div>

                {/* 記事情報 */}
                <div className="p-4 md:p-5">
                  <h3 className="text-base md:text-lg font-bold text-gray-900 leading-tight mb-2">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 md:line-clamp-3 leading-relaxed">
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
