import type { SnapshotMetadata } from '@/lib/accidents/query'

function externalLink(value:string|undefined) {
  if(!value)return undefined
  try { return new URL(value).protocol==='https:'?value:undefined } catch { return undefined }
}

export default function SourceNotices({sources}:{sources:SnapshotMetadata['sources']}) {
  return <>{sources.map(source=>{
    const sourceHref=externalLink(source.url),licenseHref=externalLink(source.licenseUrl)
    return <p key={source.url} className="mt-3 leading-7">
    {sourceHref?<a className="underline" href={sourceHref} rel="noreferrer">{source.name}</a>:source.name}
    （{licenseHref?<a className="underline" href={licenseHref} rel="noreferrer">{source.license}</a>:source.license}、取得日 {source.retrievedAt}）
    {source.attribution&&<span className="block">{source.attribution}</span>}
  </p>})}</>
}
