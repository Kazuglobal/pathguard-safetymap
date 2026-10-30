import SafetyQuestClient from "./safety-quest-client"

export const metadata = {
  title: "セーフティクエスト",
  description: "きけんハンターの セーフティクエスト。通学路の危険を、ゲームでさがして学びます。",
}

export default function SafetyQuestPage() {
  return <SafetyQuestClient />
}
