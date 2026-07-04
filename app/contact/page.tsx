import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "お問い合わせ | PathGuardian",
  description: "PathGuardian SafetyMapへのお問い合わせ方法のご案内です。",
}

export default function ContactPage() {
  return (
    <LegalPageShell title="お問い合わせ" updatedAt="2026年7月4日">
      <LegalSection title="お問い合わせ方法">
        <p>
          お問い合わせフォームは準備中です。実装までの間は、下記のGitHub Issueにて
          ご質問・不具合報告・削除請求などを受け付けています。
        </p>
        <p>
          <a
            href="https://github.com/Kazuglobal/pathguard-safetymap/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-4"
          >
            https://github.com/Kazuglobal/pathguard-safetymap/issues
          </a>
        </p>
      </LegalSection>

      <LegalSection title="ご注意">
        <p>
          個人情報(氏名・住所・写真など)を含むお問い合わせは、GitHub Issueが公開の場であるため、
          その旨を明記のうえ内容を控えめにご記載ください。詳細な確認が必要な場合は、
          Issue内でこちらから追加のご連絡方法をご案内します。
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
