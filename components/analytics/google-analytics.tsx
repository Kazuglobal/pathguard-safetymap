import Script from "next/script"

/**
 * GA4 の読み込み。測定IDがないときは何も出さない。
 * 子どもも使うアプリのため、Google シグナルと広告のパーソナライズは切る(広告には使わない)。
 * ページの移動(App Router の画面遷移)は、GA4 の拡張計測が履歴の変化から自動で数える。
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${measurementId}', { allow_google_signals: false, allow_ad_personalization_signals: false });`}
      </Script>
    </>
  )
}
