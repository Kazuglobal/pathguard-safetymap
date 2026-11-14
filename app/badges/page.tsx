import { redirect } from "next/navigation"

/**
 * バッジの画面は閉じた(2026-11-14)。バッジはポイントの数でもらう仕組みで、ポイントを画面に出さなく
 * なったので、もらえる条件を説明できない。古いリンクから来た人はマイページへ送る。
 * バッジのデータと付与の仕組み(lib/db/repos/gamification.repo.ts)は残してある。
 */
export default function BadgePage() {
  redirect("/mypage")
}
