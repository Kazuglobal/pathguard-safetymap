import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase-server"
import Link from "next/link"
import { Camera, Flag, MapPin, MessageCircleQuestion } from "lucide-react"
import { Mascot } from "@/components/safety-quest/hunter/theme"
import { tankenTokens, PAPER_NOISE } from "@/lib/design/tanken"

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
  const t = tankenTokens

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
    <div className="min-h-screen py-8" style={{ backgroundColor: t.color.paper, backgroundImage: PAPER_NOISE, color: t.color.ink }}>
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-6 text-center">ランキング</h1>
        {rankRows.length === 0 ? (
          <section className="rounded-[22px] border p-5 text-center sm:p-8" style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.card }}>
            <Mascot size="lg" mood="cheer" />
            <h2 className="mt-3 text-xl font-black">まだ みんなの記録がないよ</h2>
            <p className="mt-2 text-sm font-bold" style={{ color: t.color.inkSoft }}>最初の10ptを あつめて 1ばんのりしよう！</p>
            <Link href="/missions" className={`mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 text-lg font-black ${t.cls.focus}`} style={{ background: t.color.sun, color: t.color.ink, boxShadow: t.shadow.pressSun }}>
              <Flag className="h-5 w-5" aria-hidden="true" /> 最初の10ptを取りにいく
            </Link>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["/map", "危険を1件見る", "+3pt", MapPin],
                ["/route-quiz", "クイズに答える", "+3pt", MessageCircleQuestion],
                ["/safety-quest/hunter", "写真ゲーム", "+5pt", Camera],
              ].map(([href, label, points, Icon]) => (
                <Link key={String(href)} href={String(href)} className={`flex min-h-[108px] flex-col items-center justify-center rounded-[18px] border p-2 text-xs font-black ${t.cls.focus}`} style={{ background: t.color.paper, borderColor: t.border.soft }}>
                  <Icon className="mb-1 h-5 w-5" style={{ color: t.color.primary }} aria-hidden="true" />
                  <span>{String(label)}</span>
                  <span className="mt-1 rounded-full px-2 py-0.5" style={{ background: t.color.primarySoft, color: t.color.primaryStrong }}>{String(points)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
        <table className="w-full overflow-hidden rounded-md bg-white shadow-sm">
          <thead className="bg-gray-100 text-gray-600 text-sm">
            <tr>
              <th className="py-2 px-4 text-left">順位</th>
              <th className="py-2 px-4 text-left">ユーザー</th>
              <th className="py-2 px-4 text-right">ポイント</th>
            </tr>
          </thead>
          <tbody>
              <>
                {rankRows.map((row, idx) => (
                  <tr
                    key={row.user_id}
                    className={
                      row.user_id === session.user.id ? "bg-yellow-50 font-semibold" : "hover:bg-gray-50"
                    }
                  >
                    <td className="py-2 px-4">{idx + 1}</td>
                    <td className="py-2 px-4">{(row.profiles as any)?.display_name ?? "匿名"}</td>
                    <td className="py-2 px-4 text-right">{row.points}pt</td>
                  </tr>
                ))}
                {myRow && (
                  <tr className="bg-yellow-50 font-semibold border-t">
                    <td className="py-2 px-4">-</td>
                    <td className="py-2 px-4">{(myRow.profiles as any)?.display_name ?? "あなた"}</td>
                    <td className="py-2 px-4 text-right">{myRow.points}pt</td>
                  </tr>
                )}
              </>
          </tbody>
        </table>
        )}
        {rankRows.length > 0 && (
          <p className="text-xs text-gray-500 mt-4 text-center">上位50名を表示しています</p>
        )}
      </div>
    </div>
  )
}
