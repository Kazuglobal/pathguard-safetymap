import type { Metadata } from "next"
import type { ReactNode } from "react"

import { BRAND } from "@/lib/brand"

// 一覧のページは client コンポーネントなので、タイトルはここで決める(「ページ名 | PathGuardian」)。
// 文字だけで決めると、ルートの書式が下の記事のページ(/safe-magazine/[slug])に届かなくなるので、書式も渡す
export const metadata: Metadata = { title: { default: BRAND.magazine, template: BRAND.titleTemplate } }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
