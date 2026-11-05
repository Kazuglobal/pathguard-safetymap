import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"
import { ContactForm } from "@/components/contact/contact-form"
import { contactKindFromParam } from "@/lib/contact/contact-schema"

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "PathGuardian(通学路みまもりアプリ)へのお問い合わせ・サービス改善要望の送信フォームと、アカウントの削除のご案内です。",
}

/**
 * お問い合わせ・サービス改善要望(UIUX改装 項目4・40)。公開の場(GitHub など)には誘導しない。
 * フォームから送られた内容は /api/contact が保存し、運営者のメールへ転送する。
 * /contact?type=improvement で「サービス改善要望」を最初から選んだ状態で開く。
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = searchParams ? await searchParams : {}

  return (
    <LegalPageShell title="お問い合わせ・ご要望" updatedAt="2026年11月5日">
      <LegalSection title="お問い合わせ・サービス改善要望">
        <p>ご質問・不具合のご報告・「こうなったら使いやすい」というご要望は、下のフォームからお送りください。ログインしなくても送れます。</p>
        <ContactForm initialKind={contactKindFromParam(params.type)} />
        <p>フォームに書いた内容は、ほかの利用者には公開されません。運営者のメールにだけ届きます。</p>
      </LegalSection>

      <LegalSection title="アカウントとデータの削除">
        <p>
          アカウントの削除(退会)は、ご自分でいつでもできます。ログインして「マイページ」の「設定」にある「アカウントを削除」から手続きしてください。
          報告と写真・通学路・お子さまの登録・記録など、あなたのデータをすべて削除します。
        </p>
        <p>お子さまの登録は「マイページ」の「設定」から、通学路は「通学路」の画面から、一つずつ消すこともできます。</p>
        <p>
          <Link href="/mypage" className="font-bold underline underline-offset-4">
            マイページを開く
          </Link>
        </p>
      </LegalSection>

      <LegalSection title="ご注意">
        <p>お問い合わせには、お子さまのお名前・ご住所・写真など、個人を特定できる情報を書かないでください。</p>
      </LegalSection>
    </LegalPageShell>
  )
}
