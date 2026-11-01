import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"

export const metadata: Metadata = {
  title: "利用規約",
  description: "PathGuardian(通学路みまもりアプリ)の利用規約です。",
}

export default function TermsPage() {
  return (
    <LegalPageShell title="利用規約" updatedAt="2026年10月30日">
      <LegalSection title="1. サービス概要">
        <p>
          PathGuardian(通学路みまもりアプリ。以下「本サービス」)は、通学路・生活道路の危険情報や不審者情報をユーザー同士で共有し、
          AI(Anthropic Claude / Google Geminiなど)による画像解析を活用して、地域の安全な移動をサポートすることを目的としたサービスです。
        </p>
      </LegalSection>

      <LegalSection title="2. 禁止事項">
        <p>本サービスの利用にあたり、以下の行為を禁止します。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>他者への誹謗中傷、嫌がらせ、脅迫にあたる投稿</li>
          <li>本人の同意なく第三者の顔・氏名・住所・車両ナンバーなど個人を特定できる情報を不適切に投稿する行為</li>
          <li>事実に基づかない虚偽の危険情報・不審者情報の投稿</li>
          <li>本サービスの運営を妨害する行為、不正アクセス、その他法令に違反する行為</li>
          <li>本サービスで得た情報を、投稿者や第三者の権利を侵害する目的で利用する行為</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 免責事項">
        <p>
          本サービスにおけるAIによる危険度判定・画像解析結果は、あくまで参考情報であり、安全を保証するものではありません。
          実際の通行・外出にあたっては、必ずご自身の判断と周囲の状況確認を優先してください。
        </p>
        <p>
          運営者は、本サービスの情報の正確性・完全性・最新性について保証せず、本サービスの利用により生じた損害について、
          法令上許容される範囲で責任を負いません。
        </p>
      </LegalSection>

      <LegalSection title="4. 未成年の利用について">
        <p>
          本サービスは子どもの通学路の安全確認を目的とした機能を含みます。未成年の方がご利用になる場合は、
          保護者の方の同意のもと、保護者の関与・見守りを前提としてご利用ください。
        </p>
      </LegalSection>

      <LegalSection title="5. 規約の変更">
        <p>
          運営者は、必要と判断した場合、ユーザーへの事前の通知なく本規約を変更できるものとします。
          変更後の規約は、本ページに掲載した時点から効力を生じるものとします。
        </p>
      </LegalSection>

      <LegalSection title="6. お問い合わせ">
        <p>
          本規約に関するお問い合わせは、お問い合わせページをご確認ください。
        </p>
      </LegalSection>

      <LegalSection title="7. Google Maps の利用">
        <p>
          本サービスは、事故地点の地図・周辺の景色を表示するため、Google Maps の機能とコンテンツを利用します。
          地図画面の「現地の景色を見る」では Maps Embed API による地図とストリートビューを表示します。
          Google Maps の機能とコンテンツの利用には、
          <a className="underline" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Google Maps の追加利用規約</a>と
          <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google のプライバシーポリシー</a>が適用されます。
        </p>
        <p>景色は事故当時や現在の状況を保証するものではなく、撮影位置が事故地点と異なる場合があります。</p>
      </LegalSection>
    </LegalPageShell>
  )
}
