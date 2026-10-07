"use client";

import { tankenTokens } from "@/lib/design/tanken";
import { HOTSPOT_ATTRIBUTION } from "@/lib/traffic-accident/hotspot-config";
import { hotspotBreakdown, hotspotOneLine } from "@/lib/traffic-accident/hotspot-presentation";
import type { AccidentHotspotSummary } from "@/lib/traffic-accident/hotspot-types";

/** 事故統計パネル内の「近くの事故多発地点」。該当が無ければ何も出さない。 */
export function NearbyHotspotsSection({
  hotspots,
  total,
}: {
  hotspots?: AccidentHotspotSummary[];
  /** 半径内の総数（hotspots は上位のみ）。 */
  total?: number;
}) {
  if (!hotspots || hotspots.length === 0) return null;
  const count = total != null && total > hotspots.length ? total : hotspots.length;
  return (
    <section
      aria-label="近くの事故多発地点"
      className="mt-3 rounded-lg p-2.5"
      style={{ backgroundColor: tankenTokens.color.dangerSoft }}
    >
      <p className="text-xs font-bold" style={{ color: tankenTokens.color.danger }}>
        近くに事故多発地点があります（{count}か所）
        {count > hotspots.length && `・件数の多い${hotspots.length}か所を表示`}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {hotspots.map((hotspot) => {
          const breakdown = hotspotBreakdown(hotspot);
          return (
            <li key={hotspot.id} className="text-xs leading-5" style={{ color: tankenTokens.color.ink }}>
              <span className="font-semibold">
                {hotspot.distanceMeters != null ? `${hotspot.distanceMeters}m先・` : ""}
                {hotspotOneLine(hotspot)}
              </span>
              {breakdown && <span className="block" style={{ color: tankenTokens.color.inkSoft }}>{breakdown}</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[10px]" style={{ color: tankenTokens.color.inkFaint }}>
        半径30m以内で5年間に5件以上の地点 ・{HOTSPOT_ATTRIBUTION}
      </p>
    </section>
  );
}
