import type { Metadata } from "next"
import type { ReactNode } from "react"

// このページは client コンポーネントなので、タイトルはここで決める(「ページ名 | PathGuardian」)
export const metadata: Metadata = { title: "マイページ" }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
