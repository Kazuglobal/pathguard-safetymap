"use client"

import { useEffect, useRef, useState } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2 } from "lucide-react"

export default function SharedGallery3D() {
  const { supabase } = useSupabase()
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imagesCount, setImagesCount] = useState(0)

  useEffect(() => {
    if (!supabase) return

    const loadGalleryImages = async () => {
      try {
        const { data, error } = await supabase
          .from("gallery_images")
          .select("*")
          .order("position", { ascending: true })

        if (error) {
          // テーブルが存在しない場合やRLSエラーの場合は、エラーを表示せずにカウント0で続行
          if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
            console.warn("Gallery images table does not exist yet. Will be created on first upload.")
            setImagesCount(0)
            setError(null)
          } else {
            console.warn("Gallery images load warning:", error.message || error)
            setImagesCount(0)
            setError(null) // エラー表示を抑制
          }
          return
        }

        setImagesCount(data?.length || 0)
        setError(null)
      } catch (err) {
        console.warn("Gallery load warning:", err)
        setImagesCount(0)
        setError(null) // エラー表示を抑制
      } finally {
        setIsLoading(false)
      }
    }

    loadGalleryImages()
  }, [supabase])

  const handleLoadGallery = () => {
    if (iframeRef.current) {
      iframeRef.current.style.display = "block"
      setIsLoading(false)
    }
  }

  return (
    <div className="relative w-full">
      <Card className="border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl overflow-hidden">
        <CardHeader className="relative pb-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,255,255,0.1),_transparent_70%)]" />
          <div className="relative">
            <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-transparent">
              3D Gallery
            </CardTitle>
            <CardDescription className="text-cyan-100/80 mt-2">
              サイバーパンク風の3Dギャラリーで共有画像を体験
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-slate-800/50 p-4 backdrop-blur-sm">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-cyan-300">共有画像</p>
                <p className="text-xs text-slate-400">
                  {isLoading ? "読み込み中..." : `${imagesCount} 件の画像が共有されています`}
                </p>
              </div>
              <Button
                onClick={handleLoadGallery}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-slate-900 font-semibold shadow-lg shadow-cyan-500/50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    読み込み中
                  </>
                ) : (
                  "3Dギャラリーを開く"
                )}
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-4 text-sm text-yellow-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-cyan-500/20 bg-slate-800/30 p-4 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                操作方法
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="inline-block min-w-[80px] rounded bg-cyan-950/50 px-2 py-1 font-mono text-cyan-400">
                    WASD / ↑↓←→
                  </span>
                  <span className="pt-1">移動</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="inline-block min-w-[80px] rounded bg-cyan-950/50 px-2 py-1 font-mono text-cyan-400">
                    マウスドラッグ
                  </span>
                  <span className="pt-1">カメラ回転</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="inline-block min-w-[80px] rounded bg-cyan-950/50 px-2 py-1 font-mono text-cyan-400">
                    スクロール
                  </span>
                  <span className="pt-1">ズーム</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="inline-block min-w-[80px] rounded bg-cyan-950/50 px-2 py-1 font-mono text-cyan-400">
                    クリック
                  </span>
                  <span className="pt-1">画像をアップロード・表示</span>
                </div>
              </div>
            </div>

            <div
              ref={containerRef}
              className="relative w-full rounded-xl border-2 border-cyan-500/30 bg-black overflow-hidden shadow-2xl shadow-cyan-500/20"
              style={{ height: "70vh", minHeight: "500px" }}
            >
              <iframe
                ref={iframeRef}
                src="/gallery.html"
                className="w-full h-full border-0"
                style={{ display: "none" }}
                title="3D Gallery"
                allow="web-share"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                  <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-cyan-400 mx-auto" />
                    <p className="text-sm text-cyan-300 font-semibold tracking-wider">
                      Loading Gallery...
                    </p>
                    <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden mx-auto">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 animate-pulse rounded-full" style={{ width: "60%" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-slate-800/30 p-3 backdrop-blur-sm">
              <div className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <p className="text-xs text-slate-400">
                ログインすると、自分の画像をアップロードして3Dギャラリーに表示できます
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
