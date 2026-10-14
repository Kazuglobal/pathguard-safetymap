import type { SnapshotMetadata } from '@/lib/accidents/query'

function externalLink(value:string|undefined) {
  if(!value)return undefined
  try { return new URL(value).protocol==='https:'?value:undefined } catch { return undefined }
}

export default function SourceNotices({sources,version}:{sources:SnapshotMetadata['sources'];version?:string}) {
  return <>{sources.map(source=>{
    const sourceHref=externalLink(source.url),licenseHref=externalLink(source.licenseUrl)
    return <p key={source.url} className="mt-3 leading-7">
    {sourceHref?<a className="underline" href={sourceHref} rel="noreferrer">{source.name}</a>:source.name}
    （{licenseHref?<a className="underline" href={licenseHref} rel="noreferrer">{source.license}</a>:source.license}、取得日 {source.retrievedAt}）
    {source.attribution&&<span className="block">{source.attribution}</span>}
  </p>})}{version==='national-current-rule-v1-20261014'&&<p className="mt-4 leading-7"><a className="inline-flex min-h-11 items-center underline" href="https://github.com/Kazuglobal/pathguard-safetymap/releases/tag/pathguardian-accidents-national-current-rule-v1-20261014" rel="noreferrer">集計に使ったデータと利用条件を読む</a></p>}</>
}
