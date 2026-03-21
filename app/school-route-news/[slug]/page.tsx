import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, AlertTriangle, AlertCircle, Construction, FileText, Users, Clock, Tag, MapPin, ExternalLink, CheckCircle, Zap } from "lucide-react"
import { getNewsItemBySlug, NEWS_CATEGORIES, formatNewsDate, type NewsCategory } from "@/lib/school-route-news"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const CATEGORY_ICONS = {
  "AlertTriangle": AlertTriangle,
  "AlertCircle": AlertCircle,
  "Construction": Construction,
  "FileText": FileText,
  "Users": Users,
}

type NewsDetailPageProps = {
  params: Promise<{
    slug: string
  }>
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params
  const item = getNewsItemBySlug(slug)

  if (!item) {
    notFound()
  }

  const category = NEWS_CATEGORIES[item.category as NewsCategory]
  const IconComponent = category ? CATEGORY_ICONS[category.icon as keyof typeof CATEGORY_ICONS] : AlertTriangle

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/school-route-news"
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-gray-500">通学路の安全ニュース</span>
            </div>
          </div>
        </div>
      </header>

      {/* サムネイル画像 */}
      {item.thumbnailUrl && (
        <div className="relative w-full aspect-[16/9] bg-gray-100">
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            className="object-contain"
            priority
          />
        </div>
      )}

      {/* 記事ヘッダー */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* カテゴリー・場所・日付 */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: item.categoryColor }}
          >
            {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
            {item.categoryLabel}
          </div>
          {item.isBreaking && (
            <span className="px-3 py-1 text-xs font-bold bg-red-500 text-white rounded-full">
              注目
            </span>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5" />
            {item.location.prefecture}{item.location.city ? ` ${item.location.city}` : ""}
            {item.location.area ? ` ${item.location.area}` : ""}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            {formatNewsDate(item.publishedDate)}
          </div>
        </div>

        {/* タイトル */}
        <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-4">
          {item.title}
        </h1>

        {/* 概要 */}
        <p className="text-base text-gray-600 leading-relaxed mb-6 pb-6 border-b border-gray-200">
          {item.excerpt}
        </p>

        {/* ポイントまとめ */}
        <div className="bg-red-50 rounded-xl p-5 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-bold text-red-700 mb-3">
            <CheckCircle className="w-4 h-4" />
            ポイント
          </h2>
          <ul className="space-y-2">
            {item.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-red-900">
                <span className="flex-shrink-0 w-5 h-5 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {index + 1}
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 記事本文 */}
      <article className="max-w-3xl mx-auto px-4 pb-8">
        <div className="max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-base text-gray-700 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 mb-4 space-y-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 mb-4 space-y-1">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-base text-gray-700 leading-relaxed">
                  {children}
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-gray-900">{children}</strong>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full border-collapse border border-gray-200 text-sm">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-200 px-4 py-2 text-gray-600">
                  {children}
                </td>
              ),
              input: ({ checked, ...props }) => (
                <input
                  {...props}
                  checked={checked}
                  disabled
                  readOnly
                  className="mr-2 h-4 w-4 align-middle accent-gray-900"
                />
              ),
            }}
          >
            {item.content}
          </ReactMarkdown>
        </div>
      </article>

      {/* タグ */}
      <div className="max-w-3xl mx-auto px-4 pb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 出典 */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-700 mb-3">
            <ExternalLink className="w-5 h-5" />
            出典・参考資料
          </h2>
          <ul className="space-y-2">
            {item.sources.map((source, index) => (
              <li key={index} className="text-sm text-gray-600 leading-relaxed">
                • {source}
              </li>
            ))}
          </ul>
          {item.verifiedAt && (
            <p className="mt-3 text-xs text-gray-400">
              検証日時: {formatNewsDate(item.verifiedAt)}
            </p>
          )}
        </div>
      </div>

      {/* フッターナビゲーション */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <Link
          href="/school-route-news"
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          ニュース一覧に戻る
        </Link>
      </div>
    </div>
  )
}
