import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "プライバシーポリシー | PathGuardian",
  description: "PathGuardian SafetyMapが取得する情報とその利用目的についてのご案内です。",
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="プライバシーポリシー" updatedAt="2026年7月4日">
      <LegalSection title="1. 収集する情報">
        <p>本サービスは、ご利用にあたり以下の情報を取得することがあります。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>氏名、メールアドレスなどアカウント登録情報</li>
          <li>GPSによる現在地・通学路などの位置情報</li>
          <li>ユーザーが投稿する危険箇所・不審者情報の写真、コメント</li>
          <li>お子様のお名前など、保護者の方が任意で登録する情報</li>
          <li>Google / LINEなどソーシャルログインを利用した場合の連携アカウント情報</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>危険箇所・不審者情報の地図表示、通学路の安全度判定などサービス機能の提供</li>
          <li>本人確認、アカウント管理、お問い合わせへの対応</li>
          <li>サービス改善のための統計的な分析(個人を特定しない形での利用)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 外部AIサービスへの送信について">
        <p>
          投稿された写真は、危険度・不審者情報の解析のため Anthropic(Claude)および Google(Gemini)が提供するAIサービスへ送信されます。
          送信前に、可能な範囲で顔や車両ナンバーなど個人を特定しやすい情報を匿名化する処理を行っていますが、
          外部AIサービスの仕様上、完全な匿名化を保証するものではありません。
        </p>
      </LegalSection>

      <LegalSection title="4. 保存期間">
        <p>
          収集した情報は、サービス提供に必要な期間、または法令で定められた期間保存します。
          アカウント削除後は、法令上の保存義務がある場合を除き、合理的な期間内に削除または匿名化します。
        </p>
      </LegalSection>

      <LegalSection title="5. 第三者提供">
        <p>
          取得した情報は、以下の場合を除き、本人の同意なく第三者へ提供しません。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>危険度・画像解析のためAnthropic / Googleへ送信する場合(上記3.)</li>
          <li>データベース・ホスティングなど、サービス運営に必要な業務委託先へ提供する場合</li>
          <li>法令に基づき開示が求められた場合</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. 削除請求の手続き">
        <p>
          ご自身の情報の開示・訂正・削除をご希望の場合は、お問い合わせページの窓口までご連絡ください。
          本人確認のうえ、合理的な期間内に対応します。
        </p>
      </LegalSection>

      <LegalSection title="7. Cookie・アクセス解析について">
        <p>
          本サービスは、ログイン状態の維持のためCookieを使用します。現時点でアクセス解析ツールによる
          第三者トラッキングは導入していませんが、導入する場合は本ポリシーを改定してお知らせします。
        </p>
      </LegalSection>

      <LegalSection title="8. お問い合わせ窓口">
        <p>
          本ポリシーに関するお問い合わせは、お問い合わせページをご確認ください。
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
