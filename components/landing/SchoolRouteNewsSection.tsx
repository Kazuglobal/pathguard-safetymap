import Link from "next/link"
import Image from "next/image"
import { ChevronRight, AlertTriangle, AlertCircle, Construction, FileText, Users, MapPin, Clock, Newspaper } from "lucide-react"
import { formatLandingNewsDate, getLandingNewsPreview } from "@/lib/landing-news-preview"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "AlertCircle": AlertCircle,
  "Construction": Construction,
  "FileText": FileText,
  "Users": Users,
}

export function SchoolRouteNewsSection() {
  const newsItems = getLandingNewsPreview(5)

  return (
    <section className="py-6 md:py-10" style={{ background: C.paper }}>
      <div className="mx-auto max-w-6xl">
        {/* セクションヘッダー */}
        <div className="mb-4 flex flex-col items-start gap-2 px-4 md:mb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Newspaper className="h-5 w-5" style={{ color: C.primary }} aria-hidden="true" />
            <h2 className="whitespace-nowrap text-lg font-black md:text-xl" style={{ color: C.ink }}>
              通学路の安全ニュース
            </h2>
            <span
              className="flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: C.primarySoft, color: C.primaryStrong }}
            >
              編集部選定
            </span>
          </div>
          <Link
            href="/school-route-news"
            className={`flex items-center gap-0.5 self-start whitespace-nowrap rounded-full text-sm font-bold md:self-auto ${tankenTokens.cls.focus}`}
            style={{ color: C.primaryStrong }}
          >
            すべて見る
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* ニュースリスト */}
        <div className="px-4">
          <div
            className="divide-y overflow-hidden rounded-[22px] border"
            style={{
              background: C.card,
              borderColor: tankenTokens.border.faint,
              boxShadow: tankenTokens.shadow.soft,
            }}
          >
            {newsItems.map((item) => {
              const IconComponent =
                CATEGORY_ICONS[item.categoryIcon as keyof typeof CATEGORY_ICONS] ?? AlertTriangle

              return (
                <Link
                  key={item.id}
                  href={`/school-route-news/${item.slug}`}
                  className={`flex gap-3 p-3 transition-colors first:rounded-t-[22px] last:rounded-b-[22px] hover:bg-[#F7F0E1] md:p-4 ${tankenTokens.cls.focus}`}
                >
                  {/* サムネイル */}
                  <div
                    className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-[12px] md:h-24 md:w-24"
                    style={{ backgroundColor: `${item.categoryColor}15` }}
                  >
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {IconComponent && (
                          <IconComponent
                            className="h-8 w-8 opacity-40"
                            style={{ color: item.categoryColor }}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    )}
                    {item.isBreaking && (
                      <span
                        className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: C.danger }}
                      >
                        注目
                      </span>
                    )}
                  </div>

                  {/* コンテンツ */}
                  <div className="min-w-0 flex-1">
                    {/* カテゴリーと時間 */}
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: item.categoryColor }}
                      >
                        {IconComponent && <IconComponent className="h-2.5 w-2.5" aria-hidden="true" />}
                        {item.categoryLabel}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: C.inkFaint }}>
                        <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                        {formatLandingNewsDate(item.publishedDate)}
                      </span>
                    </div>

                    {/* タイトル */}
                    <h3
                      className="mb-1 line-clamp-2 text-sm font-bold leading-tight md:text-base"
                      style={{ color: C.ink }}
                    >
                      {item.title}
                    </h3>

                    {/* 場所 */}
                    <div className="flex items-center gap-1 text-xs" style={{ color: C.inkSoft }}>
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      <span>{item.location.prefecture}{item.location.city && ` ${item.location.city}`}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
