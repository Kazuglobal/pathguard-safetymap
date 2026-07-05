"use client"

import Link from "next/link"
import Image from "next/image"
import {
  AlertTriangle,
  AlertCircle,
  Construction,
  FileText,
  Users,
  Clock,
  Tag,
  MapPin,
  Check,
  Sparkles,
} from "lucide-react"
import { formatNewsDate, type SchoolRouteNewsFeedItem } from "@/lib/school-route-news-feed"

export const CATEGORY_ICONS = {
  AlertTriangle: AlertTriangle,
  AlertCircle: AlertCircle,
  Construction: Construction,
  FileText: FileText,
  Users: Users,
} as const

interface NewsItemCardProps {
  item: SchoolRouteNewsFeedItem
  isRead: boolean
  onRead: (slug: string) => void
}

export function NewsItemCard({ item, isRead, onRead }: NewsItemCardProps) {
  const IconComponent =
    CATEGORY_ICONS[item.categoryIcon as keyof typeof CATEGORY_ICONS] ?? AlertTriangle

  return (
    <Link
      href={`/school-route-news/${item.slug}`}
      onClick={() => onRead(item.slug)}
      className={`block overflow-hidden rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-md ${
        isRead ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-col md:flex-row">
        {/* サムネイル画像 */}
        <div
          className="relative h-32 w-full flex-shrink-0 md:h-auto md:w-48"
          style={{ backgroundColor: `${item.categoryColor}15` }}
        >
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 192px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <IconComponent
                className="h-12 w-12 opacity-30"
                style={{ color: item.categoryColor }}
              />
            </div>
          )}
          {item.isBreaking && !isRead && (
            <span className="absolute left-2 top-2 rounded bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              注目
            </span>
          )}
        </div>

        <div className="flex-1">
          <div className="p-5">
            {/* カテゴリーバッジ・場所・日付 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: item.categoryColor }}
                >
                  <IconComponent className="h-3.5 w-3.5" />
                  {item.categoryLabel}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3 w-3" />
                  {item.location.prefecture}
                  {item.location.city ? ` ${item.location.city}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isRead && (
                  <span className="flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <Check className="h-3 w-3" />
                    既読
                  </span>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {formatNewsDate(item.publishedDate)}
                </div>
              </div>
            </div>

            {/* タイトル */}
            <h3 className="mb-2 text-lg font-bold leading-tight text-gray-900">
              {item.title}
            </h3>

            {/* 概要 */}
            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-gray-600">
              {item.excerpt}
            </p>

            {/* タグ */}
            <div className="flex flex-wrap items-center gap-2">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ポイント＋そなえの一言 */}
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
            <p className="mb-1.5 text-xs font-medium text-gray-500">ポイント</p>
            <ul className="space-y-0.5 text-xs text-gray-700">
              {item.keyPoints.slice(0, 2).map((point, index) => (
                <li key={index} className="line-clamp-1">
                  • {point}
                </li>
              ))}
            </ul>
            {item.actionAdvice && (
              <p className="mt-2 flex items-start gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs leading-snug text-emerald-800">
                <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  <span className="font-bold">そなえ: </span>
                  {item.actionAdvice}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
