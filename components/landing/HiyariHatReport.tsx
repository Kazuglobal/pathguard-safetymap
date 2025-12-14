"use client"

import * as React from "react"
import Image from "next/image"
import { ThumbsUp, AlertCircle, ChevronRight, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface HiyariHatPost {
  id: string
  userAvatar: string
  userName: string
  userLocation: string
  postedAt: string
  content: string
  imageUrl?: string
  location: string
  helpfulCount: number
  cautionCount: number
}

const posts: HiyariHatPost[] = [
  {
    id: "1",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces",
    userName: "さくらママ",
    userLocation: "東京都世田谷区",
    postedAt: "2時間前",
    content: "〇〇小学校前の横断歩道、信号が青になっても右折車が止まらずヒヤリ。子どもたちには青でも左右確認を徹底させています。",
    location: "世田谷区〇〇1丁目",
    helpfulCount: 24,
    cautionCount: 18,
  },
  {
    id: "2",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
    userName: "見守りパパ",
    userLocation: "神奈川県横浜市",
    postedAt: "5時間前",
    content: "駅前ロータリーで送迎車が歩道に乗り上げて駐車。子どもの通学時間帯は特に危険。学校にも報告しました。",
    imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop",
    location: "横浜市〇〇区駅前",
    helpfulCount: 45,
    cautionCount: 32,
  },
  {
    id: "3",
    userAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces",
    userName: "あんぜんばあば",
    userLocation: "埼玉県さいたま市",
    postedAt: "昨日",
    content: "公園横の道、植木が伸びすぎて見通しが悪くなっています。市役所に剪定依頼を出しましたが、皆さんも通る際はご注意を。",
    location: "さいたま市〇〇区",
    helpfulCount: 67,
    cautionCount: 41,
  },
]

export function HiyariHatReport() {
  const [reactions, setReactions] = React.useState<Record<string, { helpful: boolean; caution: boolean }>>({})

  const toggleReaction = (postId: string, type: "helpful" | "caution") => {
    setReactions((prev) => ({
      ...prev,
      [postId]: {
        helpful: type === "helpful" ? !prev[postId]?.helpful : (prev[postId]?.helpful || false),
        caution: type === "caution" ? !prev[postId]?.caution : (prev[postId]?.caution || false),
      },
    }))
  }

  return (
    <section className="py-6 md:py-10 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">みんなのヒヤリハット報告</h2>
          </div>
          <button
            type="button"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 投稿リスト（デスクトップはグリッド） */}
        <div className="px-4 space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
        {posts.map((post) => (
          <article
            key={post.id}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            {/* ユーザー情報 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={post.userAvatar}
                  alt={post.userName}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {post.userName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {post.userLocation}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{post.postedAt}</span>
              </div>
            </div>

            {/* 投稿内容 */}
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {post.content}
            </p>

            {/* 画像（ある場合） */}
            {post.imageUrl && (
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3">
                <Image
                  src={post.imageUrl}
                  alt="投稿画像"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            )}

            {/* 場所タグ */}
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {post.location}
            </div>

            {/* リアクションボタン */}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => toggleReaction(post.id, "helpful")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  reactions[post.id]?.helpful
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <ThumbsUp className="w-4 h-4" />
                参考になった
                <span className="text-xs">
                  {post.helpfulCount + (reactions[post.id]?.helpful ? 1 : 0)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleReaction(post.id, "caution")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  reactions[post.id]?.caution
                    ? "bg-orange-100 text-orange-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                <AlertCircle className="w-4 h-4" />
                気をつける
                <span className="text-xs">
                  {post.cautionCount + (reactions[post.id]?.caution ? 1 : 0)}
                </span>
              </button>
            </div>
          </article>
        ))}
      </div>

        {/* 投稿ボタン */}
        <div className="px-4 mt-4 md:mt-6">
          <button
            type="button"
            className="w-full md:w-auto md:px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors md:mx-auto md:block"
          >
            ヒヤリハットを報告する
          </button>
        </div>
      </div>
    </section>
  )
}
