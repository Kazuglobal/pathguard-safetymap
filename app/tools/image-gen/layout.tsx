import type { Metadata } from "next"
import type { ReactNode } from "react"
import { requireAdminPage } from "@/lib/admin-auth"

export const metadata: Metadata = { title: "画像生成(管理者用)" }

// 画像生成の確認用の画面なので、管理者だけが開ける。ページは client コンポーネントなので、判定はこのサーバの外枠で行う(UIUX改装 項目53)
export default async function ImageGenLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/tools/image-gen")
  return children
}
