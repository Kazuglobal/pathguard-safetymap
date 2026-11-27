import type { Metadata } from "next"
import SafetyQuestClient from "./safety-quest-client"
import { BRAND } from "@/lib/brand"

const DESCRIPTION = "きけんハンターの セーフティクエスト。通学路の危険を、ゲームでさがして学びます。"

export const metadata: Metadata = {
  title: "セーフティクエスト",
  description: DESCRIPTION,
  alternates: { canonical: "/safety-quest" },
  openGraph: {
    title: `セーフティクエスト | ${BRAND.name}`,
    description: DESCRIPTION,
    url: "/safety-quest",
    type: "website",
  },
}

export default function SafetyQuestPage() {
  return <SafetyQuestClient />
}
