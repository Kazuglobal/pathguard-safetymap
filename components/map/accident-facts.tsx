import { toPopupDisplayData } from '@/lib/accident-display'

/** Same factual labels as the existing circle popup, without inventing causes. */
export function AccidentFacts({ properties, compact = false }: { properties: Record<string, unknown>; compact?: boolean }) {
  const data = toPopupDisplayData(properties)
  return <div>
    <p className="text-xs font-bold text-safety-strong">実事故・{data.severityLabel}</p>
    <h3 className="text-lg font-bold">{data.type ?? '事故の種類不明'}</h3>
    <p className="text-sm">{data.year !== null ? `${data.year}年` : '発生年不明'}{data.weather ? `・${data.weather}` : ''}</p>
    {!compact && <>
      <p className="text-sm">死亡: {data.fatalities}人 / 負傷: {data.injuries}人</p>
      {data.hasChild && <p className="text-xs">子ども関与（補充票確認分）</p>}
      {data.hasYoung && <p className="text-xs">若年者関与（24歳以下コード）</p>}
      {data.hasPedestrian && <p className="text-xs">歩行者関与</p>}
    </>}
  </div>
}
