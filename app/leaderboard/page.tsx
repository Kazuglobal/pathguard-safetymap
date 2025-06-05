import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"

export const metadata = {
  title: "ランキング | 通学路安全マップ",
}

export default async function LeaderboardPage() {
  const supabase = await createServerClient()

  // セッション確認（未ログインならログインへ）
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    redirect("/login")
  }

  // user_points + profiles を結合して上位50名を取得
  const { data: rows } = await supabase
    .from("user_points")
    .select("user_id, points, level, profiles(display_name)")
    .order("points", { ascending: false })
    .limit(50)

  const rankRows = rows ?? []

  // 自分のポイントを取得してランクインしていない場合に自身の順位を追加表示
  const myIndex = rankRows.findIndex((r) => r.user_id === session.user.id)
  let myRow
  if (myIndex === -1) {
    const { data } = await supabase
      .from("user_points")
      .select("user_id, points, level, profiles(display_name)")
      .eq("user_id", session.user.id)
      .single()
    myRow = data ?? null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-6 text-center">ランキング</h1>
        <table className="w-full bg-white rounded-md shadow-sm overflow-hidden">
          <thead className="bg-gray-100 text-gray-600 text-sm">
            <tr>
              <th className="py-2 px-4 text-left">順位</th>
              <th className="py-2 px-4 text-left">ユーザー</th>
              <th className="py-2 px-4 text-right">ポイント</th>
            </tr>
          </thead>
          <tbody>
            {rankRows.map((row, idx) => (
              <tr
                key={row.user_id}
                className={
                  row.user_id === session.user.id ? "bg-yellow-50 font-semibold" : "hover:bg-gray-50"
                }
              >
                <td className="py-2 px-4">{idx + 1}</td>
                <td className="py-2 px-4">{row.profiles?.display_name ?? "匿名"}</td>
                <td className="py-2 px-4 text-right">{row.points}pt</td>
              </tr>
            ))}
            {myRow && (
              <tr className="bg-yellow-50 font-semibold border-t">
                <td className="py-2 px-4">-</td>
                <td className="py-2 px-4">{myRow.profiles?.display_name ?? "あなた"}</td>
                <td className="py-2 px-4 text-right">{myRow.points}pt</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-4 text-center">上位50名を表示しています</p>
      </div>
    </div>
  )
} 