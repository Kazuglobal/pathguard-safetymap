import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "@/components/legal/legal-page-shell"
import { PRODUCT_FACTS } from "@/lib/product-facts"
import { RETENTION_DAYS } from "@/lib/retention/policy"

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "PathGuardian(通学路みまもりアプリ)が預かる情報と、預からない情報、その使い方と保存の期間です。",
}

const years = (days: number) => (days % 365 === 0 ? `${days / 365}年` : `${days}日`)

/** 保持期間の表(値は lib/retention/policy.ts と同じ。毎日自動で消します) */
const RETENTION_ROWS: ReadonlyArray<[string, string]> = [
  ["非公開のまま(審査中・却下)の報告と写真", `作成から${RETENTION_DAYS.unpublishedReport}日`],
  ["公開中の報告・写真・コメント", `公開から${years(RETENTION_DAYS.publishedReport)}(解決済みは解決から${RETENTION_DAYS.resolvedReport}日)`],
  ["通学路・お子さまの登録", "退会するまで(自宅と学校の前の道は保存しません)"],
  ["通知の購読", `届かなくなったらすぐ。${RETENTION_DAYS.staleSubscription}日、更新も配信もなければ削除`],
  ["きけんハンターの写真", `${RETENTION_DAYS.hunterPhoto}日`],
  ["報告の作成の記録(連続投稿の制限にだけ使用)", `${RETENTION_DAYS.reportCreateHistory}日`],
  ["データベースのバックアップ", `${RETENTION_DAYS.backup}日`],
]

export default function PrivacyPage() {
  return (
    <LegalPageShell title="プライバシーポリシー" updatedAt="2026年10月29日">
      <LegalSection title="1. 基本の考え方">
        <p>
          PathGuardian(通学路みまもりアプリ)は、通学路の安全を見守るために必要な情報だけを預かり、
          氏名・自宅や学校の正確な場所・ぼかす前の写真は預からない設計にしています。
        </p>
      </LegalSection>

      <LegalSection title="2. 預かる情報と、預からない情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>ログイン用のメールアドレスとパスワード(パスワードは暗号化して保存)。LINE でログインした場合は LINE のユーザーID と、許可があればメールアドレス。表示名・アイコンは受け取りません</li>
          <li>Google でログインした場合のメールアドレス。Google の名前・写真の URL は、ログインのたびに削除します(認証サービス Supabase の認証の記録には残ります)</li>
          <li>表示名(ニックネーム)とアイコン(任意)。ランキングやコメントで、ほかの利用者にも表示されます</li>
          <li>お子さまの呼び名・学年・小学校区(任意)。本名は登録しないでください</li>
          <li>通学路。道すじの両端それぞれ200m以上(削る長さは毎回変えます)は保存せず(約450m未満の短い道すじは保存しません)、出発地・到着地は約1km(「粗く保存」では約10km)の粗さ、住所は市区町村までにして保存します。作成した端末には元の線を残し、自分でログアウトすると消します</li>
          <li>投稿した危険箇所・不審者情報の内容・場所・写真(端末でぼかした写真だけ)</li>
          <li>通知の宛先(端末の通知の登録情報と、配信する都道府県)、ポイント・バッジ・ミッション・きけんハンターの記録</li>
          <li>氏名は預かりません。2026年10月までに登録いただいた氏名と、LINE・Google から受け取ったお名前・アイコンは削除します</li>
          <li>現在地は、地図の表示と報告の場所の指定に使います。現在地そのものを記録として保存することはありません</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>危険箇所・不審者情報の地図表示、通学路の近くの危険のお知らせなどの機能の提供</li>
          <li>投稿内容の確認(公開してよい内容か)と、不正な利用の防止</li>
          <li>アカウントの管理、お問い合わせへの対応</li>
          <li>サービス改善のための統計(個人を特定しない形)</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. 写真と AI について">
        <p>
          写真は送る前に、お使いの端末の中で顔を自動でぼかし、ナンバープレート・表札・名札などは利用者が指で隠します。
          保存するのは、このぼかした写真だけです。元の写真は端末の外に出しません(撮影場所などの情報も残りません)。
        </p>
        <p>
          投稿内容と写真は、公開してよいかの確認や危険の解析のため、Google(Gemini)・Anthropic(Claude)・OpenAI の AI サービスへ送ります。
          送るのはぼかした写真だけですが、ぼかしは完全ではないため、写っている人や車が分かりにくい写真をお選びください。
          {/* 紹介HP・よくある質問と同じ説明(lib/product-facts.ts) */}
          {PRODUCT_FACTS.moderation.adult}
        </p>
        <p>以前に投稿された(ぼかしていない)写真は、運営がぼかし直すまで、ほかの利用者には表示しません。</p>
      </LegalSection>

      <LegalSection title="5. ほかの利用者に見えるもの">
        <ul className="list-disc space-y-1 pl-5">
          <li>公開された報告の内容・ぼかした写真・場所(約100mの粗さ)・日付(日単位)</li>
          <li>コメントやランキングに表示される表示名</li>
        </ul>
        <p>投稿者を特定できる ID や、審査の結果・理由は、ほかの利用者には表示しません。</p>
      </LegalSection>

      <LegalSection title="6. 外部のサービス(業務委託先)">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase(ログイン・アカウント)</li>
          <li>Cloudflare(サイトの配信・データベース・写真の保存)</li>
          <li>Google・Anthropic・OpenAI(AI による確認と解析。上記4.)</li>
          <li>Mapbox(地図の表示と住所の検索)</li>
          <li>Sentry(不具合の記録)。通常時の画面の録画はしません。エラーが起きたときだけ、その前後の画面を、文字と画像を隠した状態で記録します。通信の記録からは、住所の検索語や地図の範囲などが入る URL の後半(「?」から後ろ)を消して送ります</li>
          <li>ブラウザの通知サービス(通知を受け取る設定をした場合)</li>
        </ul>
        <p>法令に基づく場合を除き、本人の同意なく第三者へ提供しません。</p>
      </LegalSection>

      <LegalSection title="7. 保存の期間">
        <p>期間を過ぎたデータは、毎日自動で削除します。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" data-testid="privacy-retention-table">
            <thead>
              <tr>
                <th className="py-1 pr-3 font-bold">データ</th>
                <th className="py-1 font-bold">保存の期間</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_ROWS.map(([data, period]) => (
                <tr key={data} className="border-t">
                  <td className="py-1 pr-3 align-top">{data}</td>
                  <td className="py-1 align-top">{period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="8. 削除と退会">
        <p>
          お子さまの登録は「マイページ」の「設定」から、通学路は「通学路」の画面から、いつでも消せます。「アカウントを削除」で退会すると、
          あなたのデータ(報告と写真・通学路・お子さま・記録・アカウント)をすべて削除します。
          不具合の記録など一部の記録は、あなたを指す情報を消して残します。
        </p>
      </LegalSection>

      <LegalSection title="9. Cookie・アクセス解析">
        <p>
          ログイン状態の維持のため Cookie を使います。アクセス解析ツールによる第三者のトラッキングは行っていません。
          導入する場合は、このポリシーを改定してお知らせします。
        </p>
      </LegalSection>

      <LegalSection title="10. お問い合わせ">
        <p>このポリシーについてのお問い合わせは、お問い合わせページをご確認ください。</p>
      </LegalSection>

      <LegalSection title="11. 改定の履歴" id="revisions">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            2026年10月29日: 氏名を預からないようにしました(登録の氏名欄をなくし、既存の氏名と LINE・Google のお名前・アイコンを削除)。
            写真は端末でぼかしてから保存し、AI にもぼかした写真だけを送るようにしました。通学路の位置の保存を粗くし、
            「粗く保存」を選べるようにしました。保存の期間を定めて自動で削除し、設定から退会できるようにしました。
            不具合の記録(Sentry)での通常時の画面の録画をやめました。
          </li>
          <li>2026年7月4日: 制定</li>
        </ul>
      </LegalSection>
    </LegalPageShell>
  )
}
