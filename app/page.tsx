import { redirect } from "next/navigation"

export default async function RootPage() {
  // ルートページにアクセスした場合、製品紹介LPにリダイレクト
  redirect("/lp")
}
