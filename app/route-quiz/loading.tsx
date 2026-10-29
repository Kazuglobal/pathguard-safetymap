import { PageLoading } from "@/components/layout/page-loading"

// 画面を開くまでの共通の待ち表示(UIUX改装 項目42)
export default function Loading() {
  return <PageLoading label="安全クイズを準備しています…" />
}
