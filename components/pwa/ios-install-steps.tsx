import { Share } from "lucide-react"

/**
 * iPhone・iPad で「ホーム画面に追加」する手順。
 * 画面の下に浮かぶ案内(ios-install-prompt.tsx)と、マイページの通知カードで同じ手順を出す。
 */
export function IosInstallSteps({ className }: { className?: string }) {
  return (
    <ol className={className}>
      <li className="flex items-center gap-1.5">
        <span className="font-medium">1.</span>
        ブラウザの共有ボタン
        <Share className="inline h-3.5 w-3.5" aria-label="共有アイコン" />
        をタップ
      </li>
      <li className="flex items-center gap-1.5">
        <span className="font-medium">2.</span>
        「ホーム画面に追加」を選択
      </li>
      <li className="flex items-center gap-1.5">
        <span className="font-medium">3.</span>
        追加したアイコンからアプリを開く
      </li>
    </ol>
  )
}
