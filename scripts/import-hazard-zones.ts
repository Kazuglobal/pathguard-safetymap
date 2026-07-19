import path from "node:path"

import {
  parseHazardImportArgs,
  runHazardZoneImport,
  streamHazardFeatures,
} from "@/lib/hazard-zone-import"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

async function main() {
  const args = parseHazardImportArgs(process.argv.slice(2))
  const fullPath = path.resolve(args.filePath)
  const imported = await runHazardZoneImport(getSupabaseAdmin(), {
    args: { ...args, filePath: fullPath },
    features: streamHazardFeatures(fullPath, args.inputFormat),
  })

  console.log(
    `Imported ${imported.importedFeatures} hazard zone features for ${args.regionLabel} from ${fullPath}`,
  )
}

main().catch((error) => {
  console.error("[import-hazard-zones]", error)
  process.exitCode = 1
})
