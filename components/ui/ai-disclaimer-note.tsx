// AI分析結果に添える共通の免責文言。
// care-card.tsx の「おうちの人むけ」注記と同じトーン(です・ます調でやわらかく)に揃える。
// AI出力を表示する画面には必ずこれを添えること(チケット T-10)。

interface AiDisclaimerNoteProps {
  className?: string
}

export function AiDisclaimerNote({ className = "" }: AiDisclaimerNoteProps) {
  return (
    <p className={`text-xs leading-relaxed text-gray-500 ${className}`}>
      ※ このAI分析は参考情報です。誤りを含むことがあり、安全を保証するものではありません。最終的な判断は必ず大人の方が行ってください。
    </p>
  )
}
