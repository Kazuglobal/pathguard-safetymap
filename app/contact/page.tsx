import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"
import { BRAND } from "@/lib/brand"

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "PathGuardian(通学路みまもりアプリ)へのお問い合わせ方法と、アカウントの削除のご案内です。",
}

/**
 * お問い合わせ(UIUX改装 項目4・40)。公開の場(GitHub など)には誘導しない。
 * フォームの URL は lib/brand.ts の contactFormUrl。受け取るまでは「準備中」と出す。
 */
export default function ContactPage() {
  const formUrl = BRAND.contactFormUrl

  return (
    <LegalPageShell title="お問い合わせ" updatedAt="2026年10月29日">
      <LegalSection title="お問い合わせの方法">
        {formUrl ? (
          <>
            <p>ご質問・不具合のご報告・ご意見は、お問い合わせフォーム(Google フォーム)からお送りください。</p>
            <p>
              <a
                href={formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline underline-offset-4"
              >
                お問い合わせフォームを開く(新しいタブで開きます)
              </a>
            </p>
          </>
        ) : (
          <p role="status" data-testid="contact-form-preparing">
            お問い合わせフォーム(Google フォーム)は準備中です。公開まで、しばらくお待ちください。
          </p>
        )}
        <p>フォームに書いた内容は、ほかの利用者には公開されません。</p>
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
